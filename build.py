#!/usr/bin/env python3
"""God Child Media pre-renderer.

Reads public rows from Supabase and writes finished static HTML pages:
blog posts under /blog/, business index pages under /georgia/<county>/,
a sitemap.xml, and a crawlable link list inside /blog/index.html.
Standard library only. Run locally with:  python build.py
"""
import html
import json
import os
import re
import shutil
import sys
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

SITE = "https://www.godchildmedia.com"
SITE_NAME = "God Child Media"
SUPABASE_URL = "https://oobwtogzkvjgaghwpzxs.supabase.co"
STORAGE_BASE = SUPABASE_URL + "/storage/v1/object/public/"
THUMB_BASE = STORAGE_BASE + "thumbnails/"
DEFAULT_IMAGE = STORAGE_BASE + "media-files/gcm_logo.webp"
ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / ".prerender-manifest.json"
GENERATED_PREFIXES = ("/blog/", "/georgia/")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PAGE_SIZE = 1000
MIN_HUB = 5
INDEX_NAV = ""
DOT = " \u00b7 "

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
DEFAULT_DISCLAIMER = (
    "Information on this page was gathered from public records, business websites, "
    "and automated tools, then checked by people where noted. AI can make mistakes "
    "and humans can make mistakes. We show where each fact came from and what checks "
    "were made, but this data is provided as is. Anyone who relies on it for their own "
    "purposes is responsible for confirming it first. Spot an error? Report it and we "
    "will review it.")
LOAD_NOTE = "Load date shown; original portal check date not recorded."
WHEELCHAIR = [("wheelchair_entrance", "Entrance"), ("wheelchair_parking", "Parking"),
              ("wheelchair_restroom", "Restroom"), ("wheelchair_seating", "Seating")]
RECORD_LABELS = {
    "health_inspection": "Health inspection",
    "sos_corp_search": "Georgia Secretary of State business search",
    "tradename_registry": "Local trade-name registry",
    "city_business_account": "City business account",
    "alcohol_license": "Alcohol license",
    "building_permit": "Building permit",
}
SOURCE_LABELS = {
    "scraped": "Collected from public web sources",
    "public_record": "Public record",
    "inferred": "Inferred from review text",
    "business_reported": "Reported by the business",
    "user_submitted": "Submitted by a visitor",
    "self_verified": "Verified by God Child Media",
}
VERIF_LABELS = {"confirmed": "Confirmed", "corrected": "Corrected",
                "disputed": "Disputed", "unable_to_verify": "Could not verify"}
DP_LABELS = {
    "ordering_platforms": "Ordering platforms",
    "hours": "Hours",
    "social_links": "Social links",
    "parent_group": "Parent group",
    "other_services": "Other services on site",
    "name_variants": "Also listed as",
}

CSS = """
:root{color-scheme:dark;--bg:#050409;--fg:#e9e6f2;--muted:#9a95ad;--amber:#f0b429}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--amber)}
header.site{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.08)}
header.site a.brand{font-weight:700;letter-spacing:.12em;text-decoration:none}
header.site nav a{margin-left:1rem;text-decoration:none}
main{max-width:760px;margin:0 auto;padding:2rem 1.25rem 3rem}
h1{font-size:2rem;line-height:1.2;margin:.25rem 0 1rem}
.meta{color:var(--muted);font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;margin:0}
img{max-width:100%;height:auto;border-radius:12px}
.content{overflow-wrap:anywhere}
.content h2,.content h3{margin-top:2rem}
footer{text-align:center;color:var(--muted);font-size:.85rem;padding:2rem 1rem}
.crumbs{font-size:.85rem;color:var(--muted);margin:0 0 .5rem}
.snapshot{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:1rem 1.25rem;margin:1rem 0}
.snapshot dl{display:grid;grid-template-columns:max-content 1fr;gap:.35rem 1rem;margin:0}
.snapshot dt{color:var(--muted)}
.snapshot dd{margin:0;overflow-wrap:anywhere}
h2.sec{font-size:1.3rem;margin:2rem 0 .5rem}
.wrap{overflow-x:auto}
table.facts{width:100%;border-collapse:collapse;font-size:.95rem}
table.facts th,table.facts td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}
.note{color:var(--muted);font-size:.85rem}
.banner{border:1px solid rgba(240,180,41,.5);border-radius:12px;padding:.6rem 1rem;margin:1rem 0}
.disclaimer{border:1px solid rgba(240,180,41,.4);border-radius:12px;padding:1rem 1.25rem;margin:2rem 0;font-size:.9rem}
.card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.9rem 1.1rem;margin:0 0 .75rem}
.card h2{font-size:1.1rem;margin:0 0 .25rem}
.card p{margin:.15rem 0;font-size:.95rem}
details{margin:.75rem 0}
details summary{cursor:pointer}
form.report label{display:block;margin:.5rem 0 .2rem}
form.report input,form.report textarea{width:100%;padding:.6rem;font:inherit;color:var(--fg);background:rgba(255,255,255,.06);border:1px solid rgba(240,180,41,.35);border-radius:8px}
form.report button{margin-top:.6rem;padding:.6rem 1.2rem;font:inherit;color:#050409;background:var(--amber);border:0;border-radius:8px;cursor:pointer}
.hp{position:absolute;left:-9999px}
"""


def esc(value):
    return html.escape(str(value or ""), quote=True)


def s(value):
    return html.escape("" if value is None else str(value), quote=True)


def plain(text):
    no_tags = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def clip(text, limit=155):
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "\u2026"


def safe_url(value):
    value = (value or "").strip()
    return value if re.match(r"^https?://", value, re.I) else ""


def image_url(path):
    path = (path or "").strip()
    if not path:
        return ""
    if safe_url(path):
        return path
    path = path.lstrip("/")
    if path.startswith("thumbnails/"):
        path = path[len("thumbnails/"):]
    return THUMB_BASE + path


def render_body(text):
    text = text or ""
    if re.search(r"<(p|h[1-6]|ul|ol|div|br|img|a|blockquote)\b", text, re.I):
        return text
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    return "\n".join("<p>" + esc(p).replace("\n", "<br>") + "</p>" for p in paragraphs)


def render_md(text):
    out = []
    for block in re.split(r"\n\s*\n", (text or "").strip()):
        lines = [line.rstrip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        first = lines[0].strip()
        if all(line.lstrip().startswith(("- ", "* ")) for line in lines):
            items = "".join("<li>" + esc(line.lstrip()[2:]) + "</li>" for line in lines)
            out.append("<ul>" + items + "</ul>")
        elif len(lines) == 1 and first.startswith("### "):
            out.append("<h3>" + esc(first[4:]) + "</h3>")
        elif len(lines) == 1 and first.startswith(("## ", "# ")):
            out.append("<h2>" + esc(first.lstrip("#").strip()) + "</h2>")
        elif len(lines) == 1 and len(first) <= 60 and first[-1] not in ".!?:,;":
            out.append("<h2>" + esc(first) + "</h2>")
        else:
            out.append("<p>" + "<br>".join(esc(line) for line in lines) + "</p>")
    return "\n".join(out)


def slugify(text):
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    text = text.replace("&", " and ")
    text = re.sub(r"['\u2019]", "", text)
    return re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()


def plural(word):
    word = (word or "").strip()
    low = word.lower()
    if not word:
        return word
    if low.endswith("y") and len(low) > 1 and low[-2] not in "aeiou":
        return word[:-1] + "ies"
    if low.endswith("s"):
        return word
    if low.endswith(("x", "ch", "sh")):
        return word + "es"
    return word + "s"


def day(value):
    return (value or "")[:10]


def month_year(value):
    match = re.match(r"^(\d{4})-(\d{2})", value or "")
    if match and 1 <= int(match.group(2)) <= 12:
        return MONTHS[int(match.group(2)) - 1] + " " + match.group(1)
    return ""


def fetch_rows(table, order, select="*", extra=""):
    key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not key:
        sys.exit("SUPABASE_ANON_KEY is not set")
    rows = []
    offset = 0
    while True:
        url = (f"{SUPABASE_URL}/rest/v1/{table}?select={select}&order={order}"
               f"&limit={PAGE_SIZE}&offset={offset}")
        if extra:
            url += "&" + extra
        request = urllib.request.Request(
            url, headers={"apikey": key, "Authorization": "Bearer " + key})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                batch = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:300]
            sys.exit(f"Supabase error {err.code} on {table}: {detail}")
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def blog_items(rows):
    items = []
    for row in rows:
        slug = (row.get("slug") or "").strip()
        title = (row.get("title") or "").strip()
        if not SLUG_RE.match(slug) or not title:
            print(f"skipped posts row {row.get('id')}: bad slug or empty title",
                  file=sys.stderr)
            continue
        body = render_body(row.get("content"))
        summary = (row.get("summary") or "").strip() or clip(plain(body), 200)
        items.append({
            "path": f"/blog/{slug}/",
            "title": title,
            "summary": summary,
            "description": clip(summary),
            "date": (row.get("created_at") or "")[:10],
            "tag": (row.get("tag") or "").strip(),
            "read_time": (row.get("read_time") or "").strip(),
            "image": image_url(row.get("thumbnail_path")),
            "video": safe_url(row.get("video_url")),
            "body": body,
        })
    items.sort(key=lambda i: i["path"])
    items.sort(key=lambda i: i["date"], reverse=True)
    return items


def page(title, description, path, main_html, image, jsonld, og_type="article"):
    canonical = SITE + path
    full_title = f"{title} | {SITE_NAME}"
    ld = json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")
    og_image = image or DEFAULT_IMAGE
    index_link = f'<a href="{esc(INDEX_NAV)}">Business Index</a>' if INDEX_NAV else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="{esc(og_type)}">
<meta property="og:site_name" content="{esc(SITE_NAME)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{esc(og_image)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{ld}</script>
<style>{CSS}</style>
</head>
<body>
<header class="site"><a class="brand" href="/">GOD CHILD MEDIA</a><nav><a href="/">Home</a><a href="/blog/">Transmissions</a>{index_link}</nav></header>
{main_html}
<footer>{esc(SITE_NAME)} \u00b7 For Those Who Raise Dreams</footer>
</body>
</html>
"""


def post_page(item):
    meta = DOT.join(esc(x) for x in (item["tag"], item["date"], item["read_time"]) if x)
    image_html = (f'<p><img src="{esc(item["image"])}" alt="{esc(item["title"])}"></p>'
                  if item["image"] else "")
    video_html = (f'<p><a href="{esc(item["video"])}" rel="noopener">Watch the video</a></p>'
                  if item["video"] else "")
    main_html = f"""<main>
<article>
<p class="meta">{meta}</p>
<h1>{esc(item["title"])}</h1>
{image_html}
<div class="content">
{item["body"]}
</div>
{video_html}
</article>
<p><a href="/blog/">\u2190 All transmissions</a></p>
</main>"""
    jsonld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": item["title"],
        "description": item["description"],
        "url": SITE + item["path"],
        "mainEntityOfPage": SITE + item["path"],
        "image": item["image"] or DEFAULT_IMAGE,
        "author": {"@type": "Organization", "name": SITE_NAME},
        "publisher": {"@type": "Organization", "name": SITE_NAME},
    }
    if item["date"]:
        jsonld["datePublished"] = item["date"]
    return page(item["title"], item["description"], item["path"], main_html,
                item["image"], jsonld)


def group_by(rows, key):
    out = defaultdict(list)
    for row in rows:
        out[row.get(key)].append(row)
    return out


def load_index():
    listings = fetch_rows("listings", "slug.asc", extra="publish_status=eq.published")
    if not listings:
        return {"listings": []}
    counties = {c["id"]: c for c in fetch_rows("counties", "slug.asc")}
    points = group_by(fetch_rows(
        "listing_data_points", "listing_id.asc,field_key.asc,source.asc",
        extra="is_public=eq.true"), "listing_id")
    records = group_by(fetch_rows(
        "public_records", "listing_id.asc,record_type.asc,retrieved_at.asc",
        extra="is_public=eq.true"), "listing_id")
    posts = {}
    for post in fetch_rows("listing_posts", "listing_id.asc,updated_at.desc",
                           extra="status=eq.published"):
        if post.get("listing_id") and post["listing_id"] not in posts:
            posts[post["listing_id"]] = post
    verifs = group_by(fetch_rows(
        "listing_verifications", "listing_id.asc,checked_at.desc,id.asc"), "listing_id")
    links = group_by(fetch_rows(
        "listing_properties", "listing_id.asc,property_id.asc",
        select="listing_id,property_id,relationship"), "listing_id")
    props = {p["id"]: p for p in fetch_rows(
        "properties", "id.asc",
        select="id,parcel_id,address,zoning_code,year_built,building_sqft,lot_acres,property_type")}
    settings = {r["key"]: r["value"] for r in fetch_rows(
        "index_settings", "key.asc", select="key,value")}
    return {"listings": listings, "counties": counties, "points": points,
            "records": records, "posts": posts, "verifs": verifs, "links": links,
            "props": props, "settings": settings}


def latest_health(recs):
    best = None
    for rec in recs:
        if (rec.get("record_type") == "health_inspection" and rec.get("result") == "found"
                and rec.get("score") is not None):
            if best is None or (rec.get("record_date") or "") >= (best.get("record_date") or ""):
                best = rec
    return best


def build_models(raw):
    models = []
    for row in raw["listings"]:
        slug = (row.get("slug") or "").strip()
        county = raw["counties"].get(row.get("county_id"))
        if not county or not SLUG_RE.match(slug) or not SLUG_RE.match(county.get("slug") or ""):
            print(f"skipped listing {row.get('id')}: bad slug or missing county", file=sys.stderr)
            continue
        lid = row["id"]
        pts = raw["points"].get(lid, [])
        recs = raw["records"].get(lid, [])
        verifs = raw["verifs"].get(lid, [])
        post = raw["posts"].get(lid)
        props = [raw["props"][link["property_id"]] | {"relationship": link.get("relationship")}
                 for link in raw["links"].get(lid, []) if link["property_id"] in raw["props"]]
        access = {key: True for key, _ in WHEELCHAIR
                  if any(p.get("field_key") == key and p.get("value_bool") is True for p in pts)}
        stamps = [day(verifs[0].get("checked_at"))] if verifs else []
        if post:
            stamps.append(day(post.get("updated_at")))
        models.append({
            "row": row, "id": lid, "county": county,
            "path": f"/georgia/{county['slug']}/{slug}/",
            "points": pts, "records": recs, "verifs": verifs, "post": post,
            "props": props, "health": latest_health(recs), "access": access,
            "parent": None, "children": [], "lastmod": max([x for x in stamps if x] or [""]),
        })
    by_id = {m["id"]: m for m in models}
    for model in models:
        parent = by_id.get(model["row"].get("parent_listing_id"))
        if parent and parent is not model:
            model["parent"] = parent
            parent["children"].append(model)
    for model in models:
        model["children"].sort(key=lambda m: m["row"]["name"].lower())
    return models


def address_line(row):
    parts = [row.get("address"), row.get("suite_or_unit")]
    street = ", ".join(p for p in parts if p)
    city = ", ".join(p for p in [row.get("city"), "GA " + (row.get("zip") or "").strip()] if p)
    return ", ".join(p for p in [street, city.strip()] if p)


def tel_href(phone):
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        digits = "1" + digits
    return "tel:+" + digits if digits else ""


def dp_value_html(point):
    if point.get("value_json") is not None:
        value = point["value_json"]
        if isinstance(value, list):
            return ", ".join(s(v) for v in value)
        if isinstance(value, dict):
            bits = []
            for key, val in value.items():
                url = safe_url(str(val))
                label = s(key).capitalize()
                bits.append(f'<a href="{esc(url)}" rel="noopener nofollow">{label}</a>' if url
                            else f"{label}: {s(val)}")
            return DOT.join(bits)
        return s(value)
    if point.get("value_text") is not None:
        return s(point["value_text"])
    if point.get("value_num") is not None:
        return s(point["value_num"])
    if point.get("value_bool") is not None:
        return "Yes" if point["value_bool"] else "No"
    return ""


def record_summary(rec):
    result = rec.get("result")
    if result == "not_found":
        base = "No match found in this search"
    elif result == "found":
        bits = []
        if rec.get("score") is not None:
            bits.append(f"Score {s(rec['score'])} out of 100")
        if rec.get("grade"):
            bits.append("Grade " + s(rec["grade"]))
        if rec.get("violation_count") is not None:
            bits.append(f"{s(rec['violation_count'])} violations")
        if rec.get("record_ref"):
            bits.append("Reference " + s(rec["record_ref"]))
        details = rec.get("details")
        if isinstance(details, dict):
            for key, val in details.items():
                bits.append(f"{s(key).replace('_', ' ').capitalize()}: {s(val)}")
        if rec.get("record_date"):
            bits.append("Record date " + s(day(rec["record_date"])))
        base = "; ".join(bits) or "Record found"
    else:
        base = "Not available"
    note = (rec.get("notes") or "").replace(LOAD_NOTE, "").strip()
    if note:
        base += f'<br><span class="note">{esc(note)}</span>'
    return base


def card(model):
    row = model["row"]
    facts = []
    if row.get("rating") is not None:
        text = f"Rating {s(row['rating'])}"
        if row.get("review_count"):
            text += f" ({int(row['review_count']):,} reviews)"
        facts.append(text)
    if model["health"]:
        facts.append(f"Health score {s(model['health']['score'])}")
    if model["access"]:
        facts.append("Wheelchair access reported: " + ", ".join(
            label.lower() for key, label in WHEELCHAIR if key in model["access"]))
    facts_text = DOT.join(facts)
    facts_html = '<p class="note">' + facts_text + "</p>" if facts else ""
    return (f'<div class="card"><h2><a href="{esc(model["path"])}">{esc(row["name"])}</a></h2>'
            f'<p>{esc(address_line(row))}</p>{facts_html}</div>')


def disclaimer_html(raw):
    text = raw["settings"].get("data_disclaimer") or DEFAULT_DISCLAIMER
    return f'<section class="disclaimer"><p>{esc(text)}</p></section>'


def report_form(model):
    key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    listing = esc(model["id"]) if model else ""
    path = esc(model["path"]) if model else ""
    return f"""<section id="report">
<h2 class="sec">Report an error</h2>
<form class="report" data-url="{esc(SUPABASE_URL)}/rest/v1/data_reports" data-key="{esc(key)}" data-listing="{listing}" data-slug="{path}">
<label for="report-message">What is wrong or out of date?</label>
<textarea id="report-message" name="message" rows="4" minlength="10" maxlength="2000" required></textarea>
<label for="report-email">Your email (optional)</label>
<input id="report-email" name="email" type="email" maxlength="254">
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button type="submit">Send report</button>
<p class="note" role="status"></p>
</form>
<script src="/js/index-report.js" defer></script>
</section>"""


def link_cell(url):
    url = safe_url(url)
    return f'<a href="{esc(url)}" rel="noopener nofollow">link</a>' if url else ""


def listing_page(model, raw):
    row = model["row"]
    county = model["county"]
    county_path = f"/georgia/{county['slug']}/"
    county_label = f"{county.get('name')} County, GA"
    name = row["name"]
    meta = DOT.join(esc(x) for x in (row.get("primary_category"), row.get("neighborhood"),
                                       row.get("city")) if x)
    snap = []
    snap.append(("Address", esc(address_line(row))))
    phones = [p for p in (row.get("phone_primary"), row.get("phone_secondary")) if p]
    if phones:
        snap.append(("Phone", DOT.join(
            f'<a href="{esc(tel_href(p))}">{esc(p)}</a>' for p in phones)))
    site = safe_url(row.get("website_url"))
    if site:
        host = re.sub(r"^https?://(www\.)?", "", site).rstrip("/")
        snap.append(("Website", f'<a href="{esc(site)}" rel="noopener nofollow">{esc(host)}</a>'))
    if row.get("rating") is not None:
        text = s(row["rating"])
        if row.get("review_count"):
            text += f" from {int(row['review_count']):,} reviews"
        when = month_year(row.get("rating_as_of"))
        text += f" as of {when}" if when else " (date not recorded)"
        snap.append(("Public review rating", text))
    if model["health"]:
        h = model["health"]
        text = f"{s(h['score'])} out of 100"
        if h.get("grade"):
            text += f" (Grade {s(h['grade'])})"
        text += f", record date {s(day(h['record_date']))}" if h.get("record_date") else ", record date not recorded"
        snap.append(("Health inspection", text))
    if model["parent"]:
        parent = model["parent"]
        snap.append(("Part of", f'<a href="{esc(parent["path"])}">{esc(parent["row"]["name"])}</a>'))
    snapshot = ('<div class="snapshot"><dl>' + "".join(
        f"<dt>{label}</dt><dd>{value}</dd>" for label, value in snap) + "</dl></div>")

    banner = ""
    if (row.get("status") or "").lower() in ("closed", "permanently_closed", "temporarily_closed"):
        banner = '<p class="banner">This business is listed as closed. Confirm before you go.</p>'

    commentary = ""
    if model["post"]:
        who = ("Written by a person" if model["post"].get("author_type") == "human"
               else "Drafted with AI assistance")
        commentary = (f'<section class="content"><p class="note">Our notes \u00b7 {who}</p>'
                      f'{render_md(model["post"].get("body_md"))}</section>')

    access_rows = "".join(
        f"<tr><th>{label}</th><td>" + ("Reported accessible" if key in model["access"]
                                       else "Not recorded") + "</td></tr>"
        for key, label in WHEELCHAIR)
    access = (f'<h2 class="sec">Wheelchair access</h2><div class="wrap"><table class="facts">{access_rows}</table></div>'
              '<p class="note">Not recorded means we do not know, not that the feature is missing. Call ahead if it matters.</p>')

    rec_rows = "".join(
        f"<tr><th>{esc(RECORD_LABELS.get(r.get('record_type'), r.get('record_type')))}</th><td>{record_summary(r)}</td></tr>"
        for r in model["records"])
    records = (f'<h2 class="sec">Public records</h2><div class="wrap"><table class="facts">{rec_rows}</table></div>'
               if rec_rows else "")

    wheel_keys = {key for key, _ in WHEELCHAIR}
    other = [p for p in model["points"] if p.get("field_key") not in wheel_keys]
    other_rows = "".join(
        f"<tr><th>{esc(DP_LABELS.get(p['field_key'], p['field_key'].replace('_', ' ').capitalize()))}</th><td>{dp_value_html(p)}</td></tr>"
        for p in other)
    details = (f'<h2 class="sec">More details</h2><div class="wrap"><table class="facts">{other_rows}</table></div>'
               if other_rows else "")

    site_html = ""
    if model["props"]:
        rows = []
        for prop in model["props"]:
            bits = []
            if prop.get("parcel_id"):
                bits.append("Parcel " + s(prop["parcel_id"]))
            if prop.get("zoning_code"):
                bits.append("Zoning " + s(prop["zoning_code"]))
            if prop.get("year_built"):
                bits.append("Built " + s(prop["year_built"]))
            if prop.get("lot_acres") is not None:
                bits.append(f"{s(prop['lot_acres'])} acres")
            if prop.get("relationship") and prop["relationship"] != "unknown":
                bits.append("Business is a " + s(prop["relationship"]))
            rows.append("<li>" + DOT.join(bits) + "</li>")
        site_html = '<h2 class="sec">The site</h2><ul>' + "".join(rows) + "</ul>"

    related = ""
    if model["children"]:
        related = ('<h2 class="sec">Also at this location</h2>' + "".join(
            card(child) for child in model["children"]))

    prov_rows = []
    for p in model["points"]:
        link = safe_url(p.get("source_url"))
        prov_rows.append(
            f"<tr><td>{esc(DP_LABELS.get(p['field_key'], p['field_key'].replace('_', ' ').capitalize()))}</td>"
            f"<td>{esc(SOURCE_LABELS.get(p.get('source'), p.get('source')))}</td>"
            f"<td>{esc(day(p.get('retrieved_at')))}</td><td>{esc(day(p.get('verified_at')))}</td>"
            f"<td>{link_cell(link)}</td></tr>")
    for r in model["records"]:
        link = safe_url(r.get("url"))
        prov_rows.append(
            f"<tr><td>{esc(RECORD_LABELS.get(r.get('record_type'), r.get('record_type')))}</td>"
            f"<td>Public record search</td><td>{esc(day(r.get('retrieved_at')))}</td><td></td>"
            f"<td>{link_cell(link)}</td></tr>")
    provenance = ""
    if prov_rows:
        provenance = ('<details><summary>Where this data came from</summary><div class="wrap">'
                      '<table class="facts"><tr><th>Item</th><th>Source type</th><th>Entered</th><th>Verified</th><th>Link</th></tr>'
                      + "".join(prov_rows) + "</table></div></details>")

    if model["verifs"]:
        items = []
        for v in model["verifs"]:
            field = f" on {esc(v['field_key'].replace('_', ' '))}" if v.get("field_key") else ""
            kind = "human check" if v.get("checked_by_kind") == "human" else "AI check"
            note = f" \u2014 {esc(v['note'])}" if v.get("note") else ""
            items.append(
                f"<li><strong>{esc(VERIF_LABELS.get(v.get('result'), v.get('result')))}</strong>{field} \u00b7 "
                f'{esc(v.get("checked_by"))} ({kind}){note} <span class="note">Logged {esc(day(v.get("checked_at")))}</span></li>')
        verification = '<h2 class="sec">Checks on this listing</h2><ul>' + "".join(items) + "</ul>"
    else:
        verification = ('<h2 class="sec">Checks on this listing</h2>'
                        '<p>No human check has been logged for this listing yet.</p>')

    main_html = f"""<main>
<p class="crumbs"><a href="/">Home</a> \u203a <a href="{esc(county_path)}">{esc(county_label)}</a></p>
<p class="meta">{meta}</p>
<h1>{esc(name)}</h1>
{banner}
{snapshot}
{commentary}
{access}
{records}
{details}
{site_html}
{related}
{provenance}
{verification}
{disclaimer_html(raw)}
{report_form(model)}
</main>"""

    desc_bits = [f"{name} at {address_line(row)}."]
    if row.get("rating") is not None:
        desc_bits.append(f"Rating {s(row['rating'])}.")
    if model["health"]:
        desc_bits.append(f"Health score {s(model['health']['score'])}.")
    desc_bits.append("Sources and checks shown.")
    description = clip(" ".join(desc_bits))
    title = f"{name} - {row.get('primary_category') or 'Restaurant'} in {row.get('neighborhood') or row.get('city') or county.get('name')}, GA"

    address = {"@type": "PostalAddress", "streetAddress": ", ".join(
        p for p in (row.get("address"), row.get("suite_or_unit")) if p),
        "addressLocality": row.get("city"), "addressRegion": "GA",
        "postalCode": row.get("zip"), "addressCountry": "US"}
    ld = {"@context": "https://schema.org", "@type": "FoodEstablishment", "name": name,
          "url": SITE + model["path"], "address": {k: v for k, v in address.items() if v}}
    if phones:
        ld["telephone"] = phones[0]
    if site:
        ld["sameAs"] = [site]
    return page(title, description, model["path"], main_html, "", ld, "website")


def hub_page(county, hub, raw):
    county_path = f"/georgia/{county['slug']}/"
    cards = "".join(card(m) for m in hub["items"])
    main_html = f"""<main>
<p class="crumbs"><a href="/">Home</a> \u203a <a href="{esc(county_path)}">{esc(county.get('name'))} County, GA</a></p>
<h1>{esc(hub['title'])}</h1>
<p>{esc(hub['intro'])}</p>
<p class="note">{len(hub['items'])} listings</p>
{cards}
{disclaimer_html(raw)}
</main>"""
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": hub["title"],
          "url": SITE + hub["path"],
          "mainEntity": {"@type": "ItemList", "itemListElement": [
              {"@type": "ListItem", "position": i + 1, "url": SITE + m["path"], "name": m["row"]["name"]}
              for i, m in enumerate(hub["items"])]}}
    return page(hub["title"], clip(hub["intro"]), hub["path"], main_html, "", ld, "website")


def make_hubs(county, models):
    base = f"/georgia/{county['slug']}/"
    cname = f"{county.get('name')} County, GA"
    hubs = []

    by_type = defaultdict(list)
    for m in models:
        if m["row"].get("primary_category"):
            by_type[m["row"]["primary_category"]].append(m)
    for category, items in by_type.items():
        slug = slugify(category)
        if slug and len(items) >= MIN_HUB:
            hubs.append({"path": f"{base}type/{slug}/", "title": f"{plural(category)} in {cname}",
                         "intro": f"{plural(category)} in {cname} with their addresses, public records, accessibility details and where each fact came from.",
                         "items": items})

    by_hood = defaultdict(list)
    for m in models:
        if m["row"].get("neighborhood"):
            by_hood[m["row"]["neighborhood"]].append(m)
    for hood, items in by_hood.items():
        slug = slugify(hood)
        city = Counter(m["row"].get("city") for m in items if m["row"].get("city")).most_common(1)
        where = f"{hood}, {city[0][0]}" if city else hood
        if slug and len(items) >= MIN_HUB:
            hubs.append({"path": f"{base}neighborhood/{slug}/", "title": f"Restaurants and food trucks in {where}",
                         "intro": f"Restaurants, food trucks and caterers in the {hood} area of {cname}, with public records and sources shown for each.",
                         "items": items})

    access = sorted((m for m in models if m["access"]),
                    key=lambda m: (-len(m["access"]), m["row"]["name"].lower()))
    if len(access) >= MIN_HUB:
        hubs.append({"path": f"{base}wheelchair-accessible-restaurants/",
                     "title": f"Wheelchair accessible restaurants and food trucks in {cname}",
                     "intro": "These listings are reported as wheelchair accessible in at least one category: entrance, parking, restroom or seating. Reports come from public listing data and can be out of date, so call ahead.",
                     "items": access})

    trucks = [m for m in models if m["row"].get("business_type") == "food_truck"]
    if len(trucks) >= MIN_HUB:
        hubs.append({"path": f"{base}food-trucks/", "title": f"Food trucks in {cname}",
                     "intro": f"Food trucks and trailers in {cname}, with registry and inspection records where we have them. Locations and hours change, so confirm before you go.",
                     "items": trucks})

    perfect = [m for m in models if m["health"] and m["health"]["score"] == 100]
    if len(perfect) >= MIN_HUB:
        hubs.append({"path": f"{base}perfect-health-inspection-scores/",
                     "title": f"Restaurants and food trucks with a 100 health inspection score on record in {cname}",
                     "intro": "Each listing here has a 100 out of 100 on its most recent inspection record we have on file. Check the record date on each page, since scores change with every inspection.",
                     "items": perfect})

    for hub in hubs:
        hub["items"] = sorted(hub["items"], key=lambda m: m["row"]["name"].lower()) \
            if "wheelchair" not in hub["path"] else hub["items"]
        hub["lastmod"] = max([m["lastmod"] for m in hub["items"]] or [""])
    return hubs


def county_page(county, models, hubs, raw):
    county_path = f"/georgia/{county['slug']}/"
    cname = f"{county.get('name')} County, GA"
    hub_links = ""
    if hubs:
        hub_links = ('<h2 class="sec">Browse by topic</h2><ul>' + "".join(
            f'<li><a href="{esc(h["path"])}">{esc(h["title"])}</a> ({len(h["items"])})</li>'
            for h in hubs) + "</ul>")
    cards = "".join(card(m) for m in sorted(models, key=lambda m: m["row"]["name"].lower()))
    intro = (f"Restaurants, food trucks and caterers in {cname}, with public records, accessibility "
             "details, human checks and the source of each fact.")
    main_html = f"""<main>
<p class="crumbs"><a href="/">Home</a></p>
<h1>Restaurants and food trucks in {esc(cname)}</h1>
<p>{esc(intro)}</p>
{hub_links}
<h2 class="sec">All listings ({len(models)})</h2>
{cards}
{disclaimer_html(raw)}
</main>"""
    ld = {"@context": "https://schema.org", "@type": "CollectionPage",
          "name": f"Restaurants and food trucks in {cname}", "url": SITE + county_path,
          "mainEntity": {"@type": "ItemList", "itemListElement": [
              {"@type": "ListItem", "position": i + 1, "url": SITE + m["path"], "name": m["row"]["name"]}
              for i, m in enumerate(sorted(models, key=lambda m: m["row"]["name"].lower()))]}}
    return page(f"Restaurants and food trucks in {cname}", clip(intro), county_path, main_html, "", ld, "website")


def build_index(raw):
    global INDEX_NAV
    if not raw["listings"]:
        return [], [], ""
    models = build_models(raw)
    pages = []
    entries = []
    by_county = defaultdict(list)
    for m in models:
        by_county[m["county"]["id"]].append(m)
    nav = ""
    if by_county:
        first = next(iter(by_county.values()))[0]["county"]
        nav = f"/georgia/{first['slug']}/"
    INDEX_NAV = nav
    for county_models in by_county.values():
        county = county_models[0]["county"]
        hubs = make_hubs(county, county_models)
        county_path = f"/georgia/{county['slug']}/"
        newest = max([m["lastmod"] for m in county_models] or [""])
        pages.append((county_path, county_page(county, county_models, hubs, raw)))
        entries.append((county_path, newest))
        for hub in hubs:
            pages.append((hub["path"], hub_page(county, hub, raw)))
            entries.append((hub["path"], hub["lastmod"]))
        for m in county_models:
            pages.append((m["path"], listing_page(m, raw)))
            entries.append((m["path"], m["lastmod"]))
    return pages, entries, nav


def write_if_changed(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def previous_index_paths():
    if not MANIFEST.exists():
        return []
    old = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return [p for p in old if p.startswith("/georgia/")]


def sync_manifest(paths):
    old = []
    if MANIFEST.exists():
        old = json.loads(MANIFEST.read_text(encoding="utf-8"))
    removed = 0
    for path in old:
        if path in paths or not path.startswith(GENERATED_PREFIXES):
            continue
        target = (ROOT / path.strip("/")).resolve()
        if ROOT in target.parents and target.is_dir():
            shutil.rmtree(target)
            removed += 1
    write_if_changed(MANIFEST, json.dumps(sorted(paths), indent=2) + "\n")
    return removed


def inject_archive(items):
    target = ROOT / "blog" / "index.html"
    if not target.exists():
        print("blog/index.html not found; archive link list skipped")
        return
    source = target.read_text(encoding="utf-8")
    pattern = re.compile(r"(<!-- PRERENDER:START -->).*?(<!-- PRERENDER:END -->)", re.S)
    if not pattern.search(source):
        print("blog/index.html has no PRERENDER markers; archive link list skipped")
        return
    links = "\n".join(
        f'<li><a href="{esc(i["path"])}">{esc(i["title"])}</a> - {esc(i["summary"])}</li>'
        for i in items)
    block = "\n<ul>\n" + links + "\n</ul>\n"
    updated = pattern.sub(lambda m: m.group(1) + block + m.group(2), source)
    if write_if_changed(target, updated):
        print("updated crawlable link list in blog/index.html")


def write_sitemap(items, index_entries):
    newest = items[0]["date"] if items else ""
    entries = [(SITE + "/", ""), (SITE + "/blog/", newest)]
    entries += [(SITE + i["path"], i["date"]) for i in items]
    entries += [(SITE + path, lastmod) for path, lastmod in index_entries]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{esc(loc)}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{esc(lastmod)}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    write_if_changed(ROOT / "sitemap.xml", "\n".join(lines) + "\n")


def main():
    global INDEX_NAV
    rows = fetch_rows("posts", "created_at.desc,slug.asc")
    items = blog_items(rows)
    if not items:
        sys.exit("No usable posts returned; aborting so existing pages are not deleted")
    index_pages, index_entries, nav = build_index(load_index())
    if not index_pages and previous_index_paths() and os.environ.get("ALLOW_EMPTY_INDEX") != "1":
        sys.exit("No published listings returned but business pages exist; refusing to delete "
                 "them. Set ALLOW_EMPTY_INDEX=1 to remove them on purpose.")
    INDEX_NAV = nav
    written = 0
    for item in items:
        out = ROOT / item["path"].strip("/") / "index.html"
        if write_if_changed(out, post_page(item)):
            written += 1
    index_written = 0
    for path, content in index_pages:
        out = ROOT / path.strip("/") / "index.html"
        if write_if_changed(out, content):
            index_written += 1
    removed = sync_manifest({i["path"] for i in items} | {p for p, _ in index_pages})
    inject_archive(items)
    write_sitemap(items, index_entries)
    print(f"{len(items)} posts, {written} pages written or changed, "
          f"{len(index_pages)} business pages, {index_written} written or changed, "
          f"{removed} stale pages removed, sitemap.xml updated")


if __name__ == "__main__":
    main()
