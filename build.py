#!/usr/bin/env python3
"""God Child Media pre-renderer.

Reads public rows from Supabase and writes finished static HTML pages,
a sitemap.xml, and a crawlable link list inside /blog/index.html.
Standard library only. Run locally with:  python build.py
"""
import html
import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

SITE = "https://www.godchildmedia.com"
SITE_NAME = "God Child Media"
SUPABASE_URL = "https://oobwtogzkvjgaghwpzxs.supabase.co"
STORAGE_BASE = SUPABASE_URL + "/storage/v1/object/public/"
THUMB_BASE = STORAGE_BASE + "thumbnails/"
DEFAULT_IMAGE = STORAGE_BASE + "media-files/gcm_logo.webp"
ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / ".prerender-manifest.json"
GENERATED_PREFIXES = ("/blog/",)
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PAGE_SIZE = 1000

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
"""


def esc(value):
    return html.escape(str(value or ""), quote=True)


def plain(text):
    no_tags = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def clip(text, limit=155):
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


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


def fetch_rows(table, order):
    key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not key:
        sys.exit("SUPABASE_ANON_KEY is not set")
    rows = []
    offset = 0
    while True:
        url = (f"{SUPABASE_URL}/rest/v1/{table}?select=*&order={order}"
               f"&limit={PAGE_SIZE}&offset={offset}")
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


def page(title, description, path, main_html, image, jsonld):
    canonical = SITE + path
    full_title = f"{title} | {SITE_NAME}"
    ld = json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")
    og_image = image or DEFAULT_IMAGE
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="article">
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
<header class="site"><a class="brand" href="/">GOD CHILD MEDIA</a><nav><a href="/">Home</a><a href="/blog/">Transmissions</a></nav></header>
{main_html}
<footer>{esc(SITE_NAME)} · For Those Who Raise Dreams</footer>
</body>
</html>
"""


def post_page(item):
    meta = " · ".join(esc(x) for x in (item["tag"], item["date"], item["read_time"]) if x)
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
<p><a href="/blog/">← All transmissions</a></p>
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


def write_if_changed(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


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


def write_sitemap(items):
    newest = items[0]["date"] if items else ""
    entries = [(SITE + "/", ""), (SITE + "/blog/", newest)]
    entries += [(SITE + i["path"], i["date"]) for i in items]
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
    rows = fetch_rows("posts", "created_at.desc,slug.asc")
    items = blog_items(rows)
    if not items:
        sys.exit("No usable posts returned; aborting so existing pages are not deleted")
    written = 0
    for item in items:
        out = ROOT / item["path"].strip("/") / "index.html"
        if write_if_changed(out, post_page(item)):
            written += 1
    removed = sync_manifest({i["path"] for i in items})
    inject_archive(items)
    write_sitemap(items)
    print(f"{len(items)} posts, {written} pages written or changed, "
          f"{removed} stale pages removed, sitemap.xml updated")


if __name__ == "__main__":
    main()
