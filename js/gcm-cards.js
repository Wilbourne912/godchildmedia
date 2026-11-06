(function () {
  const CSS = [
    'a.card, a.gcm-card { display: block; color: inherit; text-decoration: none; }',
    '.card.is-inactive { cursor: default; }',
    '.card.is-inactive:hover { transform: none; border-color: var(--border-color); box-shadow: none; }',
    '.gcm-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; width: 100%; text-align: left; }',
    '.gcm-cards-grid[hidden] { display: none; }',
    '.gcm-card { padding: 24px 20px; background: rgba(13, 10, 20, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(240, 180, 41, 0.2); border-radius: 16px; transition: border-color 0.2s ease, transform 0.2s ease; }',
    'a.gcm-card:hover { border-color: #f0b429; transform: translateY(-3px); }',
    '.gcm-card.is-inactive { opacity: 0.75; }',
    '.gcm-card .card-icon { margin-bottom: 12px; font-size: 1.8rem; }',
    '.gcm-card h3 { margin: 0 0 8px; font-family: "Cinzel", serif; font-size: 1.15rem; color: #f3f4f6; }',
    '.gcm-card p { margin: 0; color: #9ca3af; font-size: 0.95rem; line-height: 1.5; }',
    '.gcm-card-go, .gcm-card-badge { display: inline-block; margin-top: 14px; font-size: 0.8rem; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #f0b429; }',
    '.gcm-card-badge { padding: 4px 10px; border: 1px solid rgba(240, 180, 41, 0.4); border-radius: 999px; }',
    '@media (prefers-reduced-motion: reduce) { .gcm-card { transition: none; } }',
  ].join('\n');

  function buildCard(row, landing) {
    const clickable = row.is_active && row.link_url;
    const card = document.createElement(clickable ? 'a' : 'div');
    card.className = (landing ? 'card reveal' : 'gcm-card') + (row.is_active ? '' : ' is-inactive');

    if (clickable) {
      card.href = row.link_url;
      if (row.link_url.charAt(0) !== '/') {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
    }

    if (row.icon) {
      const icon = document.createElement('div');
      icon.className = 'card-icon';
      icon.textContent = row.icon;
      card.appendChild(icon);
    }

    const title = document.createElement('h3');
    title.textContent = row.title;
    card.appendChild(title);

    if (row.body) {
      const body = document.createElement('p');
      body.textContent = row.body;
      card.appendChild(body);
    }

    if (clickable) {
      const go = document.createElement('span');
      go.className = 'gcm-card-go';
      go.textContent = 'Explore \u2192';
      card.appendChild(go);
    } else if (!row.is_active) {
      const badge = document.createElement('span');
      badge.className = 'gcm-card-badge';
      badge.textContent = 'Coming soon';
      card.appendChild(badge);
    }
    return card;
  }

  function reveal(cards) {
    if (!('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('active-reveal'));
      return;
    }
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active-reveal');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    cards.forEach((card) => observer.observe(card));
  }

  async function init() {
    const containers = Array.from(document.querySelectorAll('[data-cards-page]'));
    if (!containers.length || typeof GCM === 'undefined' || !GCM.db) return;

    const pages = Array.from(new Set(containers.map((box) => box.dataset.cardsPage)));
    let rows;
    try {
      const result = await GCM.db.from('cards').select('*').in('page', pages).order('sort_order', { ascending: true });
      if (result.error || !result.data) return;
      rows = result.data;
    } catch (e) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    containers.forEach((box) => {
      const section = box.dataset.cardsSection || 'main';
      const landing = box.dataset.cardsStyle === 'landing';
      const matches = rows.filter((row) => row.page === box.dataset.cardsPage && row.section === section);
      if (!matches.length) return;
      box.textContent = '';
      const built = matches.map((row) => box.appendChild(buildCard(row, landing)));
      box.hidden = false;
      if (landing) reveal(built);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

