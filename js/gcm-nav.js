(function () {
  const LOGO = 'https://oobwtogzkvjgaghwpzxs.supabase.co/storage/v1/object/public/media-files/gcm_logo.webp';

  const FALLBACK_LINKS = [
    { label: 'AI Services & Products', url: '/', placement: 'both' },
    { label: 'GCM Blog', url: '/blog/', placement: 'both' },
    { label: 'FirstBorn 912', url: '/firstborn912/', placement: 'both' },
  ];

  const CSS = [
    '.gcm-nav { position: sticky; top: 0; z-index: 1000; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; padding: 8px 20px; background: rgba(5, 4, 9, 0.92); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(240, 180, 41, 0.2); font-family: inherit; }',
    '.gcm-nav-logo { display: flex; align-items: center; min-height: 48px; }',
    '.gcm-nav-logo img { height: 40px; width: auto; display: block; }',
    '.gcm-nav-menu { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }',
    '.gcm-nav-menu a { display: flex; align-items: center; min-height: 44px; padding: 0 14px; border: 1px solid transparent; border-radius: 10px; color: #f3f4f6; font-size: 0.9rem; font-weight: 500; text-decoration: none; transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease; }',
    '.gcm-nav-menu a:hover, .gcm-nav-menu a[aria-current="page"] { color: #f0b429; border-color: rgba(240, 180, 41, 0.4); background: rgba(240, 180, 41, 0.08); }',
    '.gcm-nav-menu .gcm-nav-cta a { background: linear-gradient(135deg, #f0b429, #d99a11); border-color: transparent; color: #050409; font-weight: 600; }',
    '.gcm-nav-menu .gcm-nav-cta a:hover { background: linear-gradient(135deg, #f7c344, #e6a414); color: #050409; }',
    '.gcm-nav-toggle { display: none; min-height: 48px; padding: 0 16px; background: rgba(13, 10, 20, 0.85); border: 1px solid rgba(240, 180, 41, 0.3); border-radius: 10px; color: #f0b429; font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }',
    '.gcm-nav a:focus-visible, .gcm-nav-toggle:focus-visible, .gcm-footer-list a:focus-visible { outline: 2px solid #f0b429; outline-offset: 2px; }',
    '@media (max-width: 760px) {',
    '  .gcm-nav-toggle { display: block; }',
    '  .gcm-nav-menu { display: none; width: 100%; flex-direction: column; align-items: stretch; padding-bottom: 8px; }',
    '  .gcm-nav-menu.open { display: flex; }',
    '}',
    '.gcm-footer-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; list-style: none; margin: 1rem 0 0; padding: 0; }',
    '.gcm-footer-list a { display: inline-block; padding: 8px 4px; color: #9ca3af; font-size: 0.8rem; text-decoration: none; }',
    '.gcm-footer-list a:hover { color: #f0b429; text-decoration: underline; }',
  ].join('\n');

  function safeUrl(url) {
    return typeof url === 'string' && /^(\/|https:\/\/)/.test(url);
  }

  function isCurrent(url) {
    if (url.charAt(0) !== '/') return false;
    const path = window.location.pathname.replace(/index\.html$/, '');
    if (url === '/') return path === '/';
    return path.indexOf(url) === 0;
  }

  function makeLink(item, skipCurrent) {
    const link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.label;
    if (!skipCurrent && isCurrent(item.url)) link.setAttribute('aria-current', 'page');
    if (item.url.charAt(0) !== '/') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return link;
  }

  function buildNav(container, links) {
    container.textContent = '';

    const bar = document.createElement('div');
    bar.className = 'gcm-nav';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Main');

    const logo = document.createElement('a');
    logo.className = 'gcm-nav-logo';
    logo.href = '/';
    const img = document.createElement('img');
    img.src = LOGO;
    img.alt = 'God Child Media';
    logo.appendChild(img);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'gcm-nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'gcm-nav-menu');
    toggle.textContent = 'Menu';

    const menu = document.createElement('ul');
    menu.id = 'gcm-nav-menu';
    menu.className = 'gcm-nav-menu';
    links.filter((item) => item.placement !== 'footer').forEach((item) => {
      const li = document.createElement('li');
      li.appendChild(makeLink(item));
      menu.appendChild(li);
    });

    const ctaLabel = container.dataset.ctaLabel;
    const ctaUrl = container.dataset.ctaUrl;
    if (ctaLabel && safeUrl(ctaUrl)) {
      const li = document.createElement('li');
      li.className = 'gcm-nav-cta';
      li.appendChild(makeLink({ label: ctaLabel, url: ctaUrl }, true));
      menu.appendChild(li);
    }

    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    bar.append(logo, toggle, menu);
    container.appendChild(bar);
  }

  function buildFooter(container, links) {
    container.textContent = '';
    const list = document.createElement('ul');
    list.className = 'gcm-footer-list';
    links.filter((item) => item.placement !== 'nav').forEach((item) => {
      const li = document.createElement('li');
      li.appendChild(makeLink(item));
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  function render(links) {
    const navBox = document.getElementById('gcm-nav');
    const footBox = document.getElementById('gcm-footer-links');
    if (navBox) buildNav(navBox, links);
    if (footBox) buildFooter(footBox, links);
  }

  async function loadLinks() {
    if (typeof GCM === 'undefined' || !GCM.db) return;
    try {
      const { data, error } = await GCM.db
        .from('site_links')
        .select('label, url, placement')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error || !data) return;
      const links = data.filter((item) => safeUrl(item.url));
      if (links.length) render(links);
    } catch (e) {}
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    render(FALLBACK_LINKS);
    loadLinks();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

