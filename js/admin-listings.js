(function () {
  const PAGE = 40;
  const STATUSES = ['draft', 'review', 'approved', 'published'];
  const state = { sb: null, root: null, note: null, q: '', status: '', page: 0 };

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k of kids) {
      if (k === null || k === undefined || k === false) continue;
      el.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
    }
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    return el;
  }

  const opt = (v, t) => h('option', { value: v }, t);
  const chip = (t, c) => h('span', { class: 'le-chip ' + (c || '') }, t);
  const day = (s) => (s ? String(s).slice(0, 10) : '');
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const section = (title, ...kids) => h('section', { class: 'le-sec' }, h('h3', {}, title), ...kids);

  function say(text, bad) {
    state.note.textContent = text || '';
    state.note.className = 'le-note' + (bad ? ' le-bad' : '');
  }

  function dpValue(d) {
    if (d.value_text !== null) return d.value_text;
    if (d.value_num !== null) return String(d.value_num);
    if (d.value_bool !== null) return d.value_bool ? 'yes' : 'no';
    return JSON.stringify(d.value_json);
  }

  function safeLink(url, label) {
    if (!/^https?:\/\//i.test(url || '')) return null;
    return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label);
  }

  function remembered() {
    try { return localStorage.getItem('le_checker') || ''; } catch (e) { return ''; }
  }

  function injectStyles() {
    if (document.getElementById('le-style')) return;
    const css = [
      '#listings-editor{color:#eee;font-size:16px}',
      '.le-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}',
      '.le-in{width:100%;box-sizing:border-box;padding:10px;font-size:16px;color:#eee;background:rgba(255,255,255,.06);border:1px solid rgba(240,180,41,.35);border-radius:8px}',
      '.le-body{font-family:inherit;line-height:1.5}',
      '.le-btn{padding:10px 16px;font-size:16px;color:#050409;background:#f0b429;border:0;border-radius:8px;cursor:pointer}',
      '.le-card{display:block;width:100%;text-align:left;margin:0 0 8px;padding:12px;color:inherit;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;cursor:pointer}',
      '.le-card strong{display:block}',
      '.le-sub{display:block;opacity:.7;margin:2px 0 6px}',
      '.le-chip{display:inline-block;margin:0 6px 6px 0;padding:2px 8px;font-size:13px;border-radius:999px;background:rgba(255,255,255,.12)}',
      '.le-ok{background:rgba(80,200,120,.3)}',
      '.le-warn{background:rgba(240,180,41,.3)}',
      '.le-sec{margin:20px 0;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:12px}',
      '.le-sec h3{margin:0 0 10px;color:#f0b429}',
      '.le-sec ul{padding-left:18px;margin:0}',
      '.le-sec li{margin-bottom:8px;overflow-wrap:anywhere}',
      '.le-sec .le-in{margin-bottom:8px}',
      '.le-sec a{color:#f0b429}',
      '.le-note{min-height:1.4em;color:#f0b429}',
      '.le-bad{color:#ff6b6b}'
    ].join('');
    document.head.appendChild(h('style', { id: 'le-style' }, css));
  }

  async function showList() {
    clear(state.root);
    state.root.appendChild(state.note);
    say('');
    const search = h('input', { class: 'le-in', type: 'search', placeholder: 'Search by name', value: state.q });
    const sel = h('select', { class: 'le-in', value: state.status }, opt('', 'All statuses'), ...STATUSES.map((s) => opt(s, s)));
    const go = h('button', {
      class: 'le-btn',
      onclick: () => { state.q = search.value.trim(); state.status = sel.value; state.page = 0; showList(); }
    }, 'Search');
    const list = h('div', {}, 'Loading…');
    state.root.append(h('div', { class: 'le-bar' }, search, sel, go), list);

    let q = state.sb.from('listings')
      .select('id,name,city,publish_status,counties(name)', { count: 'exact' })
      .order('name')
      .range(state.page * PAGE, state.page * PAGE + PAGE - 1);
    if (state.q) q = q.ilike('name', '%' + state.q.replace(/[%_,()]/g, ' ') + '%');
    if (state.status) q = q.eq('publish_status', state.status);
    const res = await q;
    if (res.error) { say(res.error.message, true); clear(list); return; }

    const rows = res.data || [];
    const ids = rows.map((r) => r.id);
    const [rd, ps] = ids.length
      ? await Promise.all([
          state.sb.from('listing_publish_ready').select('*').in('listing_id', ids),
          state.sb.from('listing_posts').select('listing_id,status').in('listing_id', ids)
        ])
      : [{ data: [] }, { data: [] }];
    const ready = Object.fromEntries((rd.data || []).map((x) => [x.listing_id, x]));
    const posted = Object.fromEntries((ps.data || []).map((x) => [x.listing_id, x.status]));

    clear(list);
    if (!rows.length) list.textContent = 'No listings found.';
    rows.forEach((row) => {
      const r = ready[row.id] || {};
      const ok = r.ready === true;
      list.appendChild(h('button', { class: 'le-card', onclick: () => showEditor(row.id) },
        h('strong', {}, row.name),
        h('span', { class: 'le-sub' }, [row.city, row.counties && row.counties.name].filter(Boolean).join(', ')),
        h('span', {},
          chip(row.publish_status),
          chip(ok ? 'ready' : 'not ready', ok ? 'le-ok' : 'le-warn'),
          chip('human checks: ' + (r.human_check_count || 0)),
          chip('commentary: ' + (posted[row.id] || 'none'))
        )
      ));
    });

    const total = res.count || 0;
    const last = Math.max(0, Math.ceil(total / PAGE) - 1);
    const prev = h('button', { class: 'le-btn', onclick: () => { state.page -= 1; showList(); } }, 'Prev');
    const next = h('button', { class: 'le-btn', onclick: () => { state.page += 1; showList(); } }, 'Next');
    prev.disabled = state.page <= 0;
    next.disabled = state.page >= last;
    state.root.appendChild(h('div', { class: 'le-bar' }, prev, h('span', {}, 'Page ' + (state.page + 1) + ' of ' + (last + 1) + ' (' + total + ' listings)'), next));
  }

  async function showEditor(id, notice) {
    clear(state.root);
    state.root.appendChild(state.note);
    say('Loading…');
    const sb = state.sb;
    const [lr, rr, dr, recr, vr, cr] = await Promise.all([
      sb.from('listings').select('*, counties(name,slug)').eq('id', id).single(),
      sb.from('listing_publish_ready').select('*').eq('listing_id', id).maybeSingle(),
      sb.from('listing_data_points').select('*').eq('listing_id', id).order('field_key'),
      sb.from('public_records').select('*').eq('listing_id', id).order('record_date', { ascending: false }),
      sb.from('listing_verifications').select('*').eq('listing_id', id).order('checked_at', { ascending: false }),
      sb.from('listing_posts').select('*').eq('listing_id', id).order('updated_at', { ascending: false }).limit(1)
    ]);
    const failed = [lr, rr, dr, recr, vr, cr].find((x) => x.error);
    if (failed) { say(failed.error.message, true); return; }

    const l = lr.data;
    const ready = rr.data || {};
    const points = dr.data || [];
    const records = recr.data || [];
    const checks = vr.data || [];
    const post = (cr.data || [])[0] || null;

    const back = h('button', { class: 'le-btn', onclick: showList }, '← Back to list');
    const address = [l.address, l.suite_or_unit, l.city, l.zip].filter(Boolean).join(', ');
    const head = section(l.name,
      h('p', {}, address || 'No address'),
      h('p', {}, [l.phone_primary, l.business_type].filter(Boolean).join(' · '), ' ', safeLink(l.website_url, 'website')),
      h('div', {},
        chip('Tier 1: ' + (ready.tier1_ok ? 'ok' : 'incomplete'), ready.tier1_ok ? 'le-ok' : 'le-warn'),
        chip('public records: ' + (ready.record_count || 0)),
        chip('data points: ' + (ready.data_point_count || 0)),
        chip('human checks: ' + (ready.human_check_count || 0))
      )
    );

    const stSel = h('select', { class: 'le-in', value: l.publish_status }, ...STATUSES.map((s) => opt(s, s)));
    const stBtn = h('button', {
      class: 'le-btn',
      onclick: async () => {
        const next = stSel.value;
        if (next === 'published') {
          const gaps = [];
          if (!ready.tier1_ok) gaps.push('Tier 1 fields incomplete');
          if (!(ready.record_count >= 1)) gaps.push('no public records');
          if (!(ready.data_point_count >= 3)) gaps.push('fewer than 3 public data points');
          if (!(ready.human_check_count >= 1)) gaps.push('no human check logged');
          if (gaps.length && !confirm('Publishing with gaps: ' + gaps.join('; ') + '. Publish anyway?')) return;
        }
        const up = await sb.from('listings').update({ publish_status: next }).eq('id', id);
        if (up.error) { say(up.error.message, true); return; }
        showEditor(id, 'Listing status saved');
      }
    }, 'Save status');
    const statusSec = section('Listing status', stSel, stBtn);

    const defSlug = (l.counties ? l.counties.slug + '-' : '') + l.slug + '-notes';
    const fTitle = h('input', { class: 'le-in', value: post ? post.title : 'Our notes on ' + l.name });
    const fSlug = h('input', { class: 'le-in', value: post ? post.slug : defSlug });
    const fBody = h('textarea', { class: 'le-in le-body', rows: '14', value: post ? post.body_md : '' });
    const fAuthor = h('select', { class: 'le-in', value: post ? post.author_type : 'ai_assisted' }, opt('human', 'human written'), opt('ai_assisted', 'AI assisted'));
    const fStatus = h('select', { class: 'le-in', value: post ? post.status : 'draft' }, opt('draft', 'draft'), opt('approved', 'approved'), opt('published', 'published'));
    const count = h('small', {}, '');
    const recount = () => { count.textContent = (fBody.value.trim() ? fBody.value.trim().split(/\s+/).length : 0) + ' words'; };
    fBody.addEventListener('input', recount);
    recount();
    const saveBtn = h('button', {
      class: 'le-btn',
      onclick: async () => {
        const slug = fSlug.value.trim();
        if (!fTitle.value.trim() || !fBody.value.trim()) { say('Title and commentary are required', true); return; }
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { say('Slug must be lowercase letters, numbers and dashes', true); return; }
        const payload = {
          slug,
          title: fTitle.value.trim(),
          body_md: fBody.value,
          listing_id: l.id,
          county_id: l.county_id,
          category_id: l.category_id,
          author_type: fAuthor.value,
          status: fStatus.value,
          published_at: fStatus.value === 'published' ? (post && post.published_at) || new Date().toISOString() : null
        };
        const res = post
          ? await sb.from('listing_posts').update(payload).eq('id', post.id)
          : await sb.from('listing_posts').insert(payload);
        if (res.error) {
          say(res.error.code === '23505' ? 'That slug is already used, or this listing already has a published commentary' : res.error.message, true);
          return;
        }
        showEditor(id, 'Commentary saved');
      }
    }, 'Save commentary');
    const postSec = section('Commentary', fTitle, fSlug, fBody, count, fAuthor, fStatus, saveBtn);

    const recSec = section('Public records (' + records.length + ')', h('ul', {}, ...records.map((r) =>
      h('li', {}, [r.record_type, r.result, r.score !== null ? 'score ' + r.score : null, r.grade, r.violation_count !== null ? r.violation_count + ' violations' : null, day(r.record_date)].filter(Boolean).join(' · '), ' ', safeLink(r.url, 'source'))
    )));

    const ptSec = section('Data points (' + points.length + ')', h('ul', {}, ...points.map((d) =>
      h('li', {},
        h('strong', {}, d.field_key + ': '),
        dpValue(d),
        ' ',
        h('small', {}, [d.source, d.confidence !== null ? 'conf ' + d.confidence : null, d.retrieved_at ? 'got ' + day(d.retrieved_at) : null, d.verified_at ? 'verified ' + day(d.verified_at) : null, d.needs_review ? 'NEEDS REVIEW' : null, d.is_public ? null : 'private'].filter(Boolean).join(' · ')),
        ' ',
        safeLink(d.source_url, 'source')
      )
    )));

    const fields = Array.from(new Set(points.map((d) => d.field_key)));
    const cField = h('select', { class: 'le-in' }, opt('', 'Whole listing'), ...fields.map((f) => opt(f, f)));
    const cKind = h('select', { class: 'le-in' }, opt('human', 'human check'), opt('ai', 'AI check'));
    const cResult = h('select', { class: 'le-in' }, opt('confirmed', 'confirmed'), opt('corrected', 'corrected'), opt('disputed', 'disputed'), opt('unable_to_verify', 'unable to verify'));
    const cBy = h('input', { class: 'le-in', placeholder: 'Your name', value: remembered() });
    const cNote = h('textarea', { class: 'le-in', rows: '3', placeholder: 'What did you check? Notes show publicly on the listing page.' });
    const cBtn = h('button', {
      class: 'le-btn',
      onclick: async () => {
        const by = cBy.value.trim();
        if (!by) { say('Enter your name for the log', true); return; }
        try { localStorage.setItem('le_checker', by); } catch (e) { /* storage unavailable */ }
        const row = {
          listing_id: id,
          field_key: cField.value || null,
          checked_by_kind: cKind.value,
          checked_by: by,
          result: cResult.value,
          note: cNote.value.trim() || null
        };
        const ins = await sb.from('listing_verifications').insert(row);
        if (ins.error) { say(ins.error.message, true); return; }
        if (row.field_key && row.checked_by_kind === 'human') {
          let patch = null;
          if (row.result === 'disputed') patch = { needs_review: true };
          if (row.result === 'confirmed' || row.result === 'corrected') patch = { verified_at: new Date().toISOString() };
          if (patch) {
            const up = await sb.from('listing_data_points').update(patch).eq('listing_id', id).eq('field_key', row.field_key);
            if (up.error) { say(up.error.message, true); return; }
          }
        }
        showEditor(id, 'Check logged');
      }
    }, 'Log check');
    const chkSec = section('Verification log (' + checks.length + ')',
      cField, cKind, cResult, cBy, cNote, cBtn,
      h('ul', {}, ...checks.map((v) =>
        h('li', {}, [day(v.checked_at), v.checked_by_kind, v.checked_by, v.result, v.field_key].filter(Boolean).join(' · '), v.note ? ' — ' + v.note : '')
      ))
    );

    state.root.append(back, head, statusSec, postSec, recSec, ptSec, chkSec);
    say(notice || '');
  }

  window.initListingsEditor = async function (sb, rootId) {
    state.sb = sb;
    state.root = document.getElementById(rootId || 'listings-editor');
    if (!state.root) return;
    injectStyles();
    state.note = h('p', { class: 'le-note' });
    const s = await sb.auth.getSession();
    if (!s.data || !s.data.session) { state.root.textContent = 'Sign in on the admin page first.'; return; }
    showList();
  };
})();
