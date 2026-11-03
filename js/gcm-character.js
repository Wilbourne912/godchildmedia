(function () {
  function safeImage(url) {
    return typeof url === 'string' && /^(\/|https:\/\/)/.test(url);
  }

  function init() {
    const box = document.getElementById('gcm-character');
    if (!box) return;

    const name = box.dataset.name || '';
    const tagline = box.dataset.tagline || '';
    const hero = box.dataset.hero || '';
    const base = box.dataset.base || '/';
    const active = box.dataset.active || '';

    box.textContent = '';

    const frame = document.createElement('div');
    frame.className = 'gcm-hero';
    if (safeImage(hero)) {
      const img = document.createElement('img');
      img.className = 'gcm-hero-img';
      img.src = hero;
      img.alt = name;
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
      frame.setAttribute('aria-label', name);
    }
    box.appendChild(frame);

    const title = document.createElement('h1');
    title.className = 'gcm-char-name';
    title.textContent = name;
    box.appendChild(title);

    if (tagline) {
      const line = document.createElement('p');
      line.className = 'gcm-char-tagline';
      line.textContent = tagline;
      box.appendChild(line);
    }

    const tabs = document.createElement('div');
    tabs.className = 'gcm-tabs';
    tabs.setAttribute('role', 'navigation');
    tabs.setAttribute('aria-label', name + ' pages');
    [['bio', 'Bio', base + 'bio/'], ['transmissions', 'Transmissions', base + 'transmissions/'], ['signup', 'Sign Up', base]].forEach(([key, label, href]) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (key === active) link.setAttribute('aria-current', 'page');
      tabs.appendChild(link);
    });
    box.appendChild(tabs);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

