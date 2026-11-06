(function () {
  function safeUrl(url) {
    return typeof url === 'string' && /^(\/|https:\/\/)/.test(url);
  }

  function paragraphs(text) {
    return String(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  }

  function renderHeader(box, view) {
    box.textContent = '';

    const frame = document.createElement('div');
    frame.className = 'gcm-hero';
    if (safeUrl(view.hero)) {
      const img = document.createElement('img');
      img.className = 'gcm-hero-img';
      img.src = view.hero;
      img.alt = view.name;
      img.width = 240;
      img.height = 240;
      img.decoding = 'async';
      img.addEventListener('error', () => {
        img.remove();
        frame.classList.add('gcm-hero-fallback');
      });
      frame.appendChild(img);
    } else {
      frame.classList.add('gcm-hero-fallback');
      frame.setAttribute('role', 'img');
      frame.setAttribute('aria-label', view.name);
    }
    box.appendChild(frame);

    const title = document.createElement('h1');
    title.className = 'gcm-char-name';
    title.textContent = view.name;
    box.appendChild(title);

    if (view.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'gcm-char-subtitle';
      sub.textContent = view.subtitle;
      box.appendChild(sub);
    }

    if (view.tagline) {
      const line = document.createElement('p');
      line.className = 'gcm-char-tagline';
      line.textContent = view.tagline;
      box.appendChild(line);
    }

    const tabs = document.createElement('div');
    tabs.className = 'gcm-tabs';
    tabs.setAttribute('role', 'navigation');
    tabs.setAttribute('aria-label', view.name + ' pages');
    [['bio', 'Bio', view.base + 'bio/'], ['transmissions', 'Transmissions', view.base + 'transmissions/'], ['signup', 'Sign Up', view.base]].forEach(([key, label, href]) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (key === view.active) link.setAttribute('aria-current', 'page');
      tabs.appendChild(link);
    });
    box.appendChild(tabs);
  }

  function renderBio(row) {
    const bioBox = document.getElementById('gcm-bio-text');
    if (!bioBox || !row.bio) return;
    const panel = bioBox.closest('.gcm-panel');
    if (panel) panel.hidden = false;
    bioBox.textContent = '';
    paragraphs(row.bio).forEach((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      bioBox.appendChild(p);
    });
  }

  function renderSocials(row) {
    const socialsBox = document.getElementById('gcm-socials');
    if (!socialsBox) return;
    const items = [['tiktok', 'TikTok', row.tiktok_url], ['instagram', 'Instagram', row.instagram_url], ['youtube', 'YouTube', row.youtube_url]];
    socialsBox.textContent = '';
    items.forEach(([key, label, url]) => {
      if (!url || !/^https:\/\//.test(url)) return;
      const link = document.createElement('a');
      link.className = 'gcm-btn';
      link.href = url;
      link.textContent = label;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.dataset.track = key;
      socialsBox.appendChild(link);
    });
    socialsBox.hidden = socialsBox.children.length === 0;
  }

  async function init() {
    const box = document.getElementById('gcm-character');
    if (!box) return;

    const view = {
      name: box.dataset.name || '',
      subtitle: box.dataset.subtitle || '',
      tagline: box.dataset.tagline || '',
      hero: box.dataset.hero || '',
      base: box.dataset.base || '/',
      active: box.dataset.active || '',
    };
    renderHeader(box, view);

    const slug = box.dataset.slug;
    if (!slug || typeof GCM === 'undefined' || !GCM.db) return;

    let row = null;
    try {
      const result = await GCM.db.from('characters').select('*').eq('slug', slug).maybeSingle();
      if (!result.error) row = result.data;
    } catch (e) {}
    if (!row) return;

    view.name = row.name || view.name;
    view.subtitle = row.subtitle || '';
    view.tagline = row.tagline || '';
    if (row.hero_path) view.hero = GCM.thumbnails.url(row.hero_path);
    renderHeader(box, view);
    renderBio(row);
    renderSocials(row);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

