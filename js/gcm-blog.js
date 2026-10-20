(function () {
  function run() {
    const grid = document.querySelector('.blog-grid');
    if (!grid) return;

    const LOGO = 'https://oobwtogzkvjgaghwpzxs.supabase.co/storage/v1/object/public/media-files/gcm_logo.webp';
    const REACTIONS = { like: '\uD83D\uDC4D', bookmark: '\uD83D\uDD16', flame: '\uD83D\uDD25' };

    const style = document.createElement('style');
    style.textContent = [
      '.gcm-empty { grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 2rem 0; }',
      '.gcm-post { max-width: 820px; margin: 0 auto; }',
      '.gcm-back { display: inline-block; margin-bottom: 1.5rem; }',
      '.gcm-post-media { width: 100%; aspect-ratio: 16 / 9; margin-bottom: 1.75rem; border-radius: 16px; overflow: hidden; background: #000; border: 1px solid rgba(240, 180, 41, 0.2); }',
      '.gcm-post-media iframe, .gcm-post-media video { width: 100%; height: 100%; border: 0; }',
      '.gcm-post-media img { display: block; width: 100%; height: 100%; object-fit: cover; }',
      '.gcm-post h1 { font-family: Cinzel, serif; font-size: clamp(1.6rem, 4vw, 2.4rem); line-height: 1.25; color: #f3f4f6; margin: 0.5rem 0 0.75rem; }',
      '.gcm-meta { color: #9ca3af; font-size: 0.85rem; margin-bottom: 1.5rem; }',
      '.gcm-lead { font-size: 1.15rem; line-height: 1.6; color: #f3f4f6; margin-bottom: 1.75rem; padding-left: 1rem; border-left: 3px solid #f0b429; }',
    '.gcm-body { line-height: 1.75; color: #d1d5db; font-size: 1.02rem; margin-bottom: 3rem; }',
    '.gcm-body p { white-space: pre-wrap; margin: 0 0 1.2rem; }',
      '.gcm-body a { color: #f0b429; text-decoration: underline; text-underline-offset: 3px; }',
      '.gcm-comments { padding: 1.75rem; border-radius: 16px; background: rgba(13, 10, 20, 0.85); border: 1px solid rgba(240, 180, 41, 0.2); backdrop-filter: blur(10px); }',
      '.gcm-comments h2 { font-family: Cinzel, serif; font-size: 1.2rem; color: #f0b429; margin-bottom: 1rem; }',
      '.gcm-totals { color: #9ca3af; font-size: 0.9rem; margin-bottom: 1rem; }',
      '.gcm-comment { padding: 0.9rem 0; border-top: 1px solid rgba(255, 255, 255, 0.06); }',
      '.gcm-comment-head { font-size: 0.78rem; color: #9ca3af; margin-bottom: 0.35rem; }',
      '.gcm-comment-head strong { color: #f0b429; font-weight: 600; }',
      '.gcm-comment p { color: #e5e7eb; font-size: 0.95rem; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }',
      '.gcm-form { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(240, 180, 41, 0.2); }',
      '.gcm-form input[type="email"], .gcm-form textarea { display: block; width: 100%; box-sizing: border-box; margin-bottom: 0.75rem; padding: 0.8rem 1rem; border-radius: 8px; border: 1px solid rgba(240, 180, 41, 0.2); background: rgba(5, 4, 9, 0.8); color: #f3f4f6; font: inherit; outline: none; }',
      '.gcm-form textarea { min-height: 110px; resize: vertical; }',
      '.gcm-form input:focus, .gcm-form textarea:focus { border-color: #f0b429; }',
      '.gcm-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }',
      '.gcm-chip { padding: 0.45rem 0.9rem; border-radius: 999px; border: 1px solid rgba(240, 180, 41, 0.35); background: transparent; color: #f3f4f6; font-size: 0.85rem; cursor: pointer; }',
      '.gcm-chip[aria-pressed="true"] { background: #f0b429; color: #050409; border-color: #f0b429; }',
      '.gcm-submit { padding: 0.75rem 1.5rem; border: 0; border-radius: 8px; background: #f0b429; color: #050409; font-weight: 600; font-size: 0.95rem; cursor: pointer; }',
      '.gcm-submit:disabled { opacity: 0.6; cursor: wait; }',
      '.gcm-status { min-height: 1.2em; margin-top: 0.75rem; font-size: 0.85rem; color: #34d399; }',
      '.gcm-status.gcm-error { color: #f87171; }',
      '.gcm-note { margin-top: 0.5rem; font-size: 0.75rem; color: #9ca3af; }',
      '.gcm-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }',
    ].join('\n');
    document.head.appendChild(style);

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    const fmtDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    function richText(parent, text) {
      const pattern = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>()]+)/g;
      let last = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let url = match[2] || match[3];
        if (match[3]) {
          const trail = url.match(/[.,;:!?]+$/);
          if (trail) {
            url = url.slice(0, -trail[0].length);
            pattern.lastIndex -= trail[0].length;
          }
        }
        if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
        const link = document.createElement('a');
        link.href = url;
        link.textContent = match[1] || url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        parent.appendChild(link);
        last = pattern.lastIndex;
      }
      if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
    }
    function showMessage(container, text) {
      container.textContent = '';
      container.appendChild(el('p', 'gcm-empty', text));
    }

    function youtubeId(url) {
      if (!url) return null;
      try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return null;
        const host = u.hostname.replace(/^www\./, '');
        let id = null;
        if (host === 'youtu.be') {
          id = u.pathname.slice(1);
        } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
          if (u.pathname === '/watch') id = u.searchParams.get('v');
          else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
        }
        return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      } catch (err) {
        return null;
      }
    }

    function mediaFor(url) {
      const id = youtubeId(url);
      if (id) {
        const frame = document.createElement('iframe');
        frame.src = 'https://www.youtube-nocookie.com/embed/' + id;
        frame.title = 'Transmission video';
        frame.allowFullscreen = true;
        frame.loading = 'lazy';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        return frame;
      }
      try {
        const u = new URL(url);
        if (u.protocol === 'https:' && /\.(mp4|webm)$/i.test(u.pathname)) {
          const video = document.createElement('video');
          video.controls = true;
          video.preload = 'metadata';
          video.src = u.href;
          return video;
        }
      } catch (err) {
        return null;
      }
      return null;
    }

    function thumbnailImage(post) {
      if (!post.thumbnail_path) return null;
      const img = document.createElement('img');
      img.src = GCM.thumbnails.url(post.thumbnail_path);
      img.alt = post.title;
      return img;
    }

    function buildCard(post) {
      const card = el('article', 'blog-card');
      const media = el('div', 'blog-card-media');
      const img = document.createElement('img');
      const thumb = GCM.thumbnails.forPost(post);
      img.src = thumb || LOGO;
      if (!thumb) img.style.objectFit = 'contain';
      img.alt = post.title;
      img.loading = 'lazy';
      media.appendChild(img);

      const body = el('div', 'blog-card-body');
      const summary = post.summary.length > 180 ? post.summary.slice(0, 180).trimEnd() + '...' : post.summary;
      const footer = el('div', 'blog-card-footer');
      footer.appendChild(el('span', '', fmtDate(post.created_at) + (post.read_time ? ' \u2022 ' + post.read_time : '')));
      const link = el('a', 'read-btn', 'Read Full Article');
      link.href = '?slug=' + encodeURIComponent(post.slug);
      footer.appendChild(link);

      body.appendChild(el('span', 'blog-tag', post.tag));
      body.appendChild(el('h2', '', post.title));
      body.appendChild(el('p', '', summary));
      body.appendChild(footer);
      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    async function renderArchive() {
      showMessage(grid, 'Loading transmissions...');
      try {
        const posts = await GCM.posts.list(50);
        grid.textContent = '';
        if (!posts.length) {
          showMessage(grid, 'No transmissions yet. Check back soon.');
          return;
        }
        posts.forEach((post) => grid.appendChild(buildCard(post)));
      } catch (err) {
        console.error('Archive load failed:', err);
        showMessage(grid, 'Could not load transmissions.');
      }
    }

    function buildComments(post) {
      const section = el('section', 'gcm-comments');
      section.appendChild(el('h2', '', 'Feedback & Reactions'));
      const totals = el('div', 'gcm-totals');
      const list = el('div', 'gcm-comment-list');
      section.appendChild(totals);
      section.appendChild(list);

      function renderComments(rows) {
        const counts = { like: 0, bookmark: 0, flame: 0 };
        rows.forEach((c) => {
          if (counts[c.reaction_type] !== undefined) counts[c.reaction_type] += 1;
        });
        totals.textContent = Object.keys(REACTIONS).map((k) => REACTIONS[k] + ' ' + counts[k]).join('   ');
        list.textContent = '';
        const withText = rows.filter((c) => c.content || c.reaction_type);
        if (!withText.length) {
          list.appendChild(el('p', 'gcm-empty', 'No feedback yet. Be the first.'));
          return;
        }
        withText.forEach((c) => {
          const item = el('div', 'gcm-comment');
          const head = el('div', 'gcm-comment-head');
          head.appendChild(el('strong', '', 'Operative'));
          head.appendChild(document.createTextNode(
            (c.reaction_type ? ' ' + REACTIONS[c.reaction_type] : '') + ' \u2022 ' + fmtDate(c.created_at)
          ));
          item.appendChild(head);
          if (c.content) item.appendChild(el('p', '', c.content));
          list.appendChild(item);
        });
      }

      const form = el('form', 'gcm-form');
      const email = el('input');
      email.type = 'email';
      email.placeholder = 'Your email (never shown publicly)';
      email.autocomplete = 'email';
      email.required = true;
      const text = el('textarea');
      text.placeholder = 'Leave your feedback...';
      text.maxLength = 2000;

      let selected = null;
      const chips = el('div', 'gcm-chips');
      Object.keys(REACTIONS).forEach((key) => {
        const chip = el('button', 'gcm-chip', REACTIONS[key] + ' ' + key.charAt(0).toUpperCase() + key.slice(1));
        chip.type = 'button';
        chip.dataset.key = key;
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', () => {
          selected = selected === key ? null : key;
          chips.querySelectorAll('.gcm-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.key === selected ? 'true' : 'false'));
        });
        chips.appendChild(chip);
      });

      const trap = el('div', 'gcm-hp');
      trap.setAttribute('aria-hidden', 'true');
      const honeypot = el('input');
      honeypot.type = 'text';
      honeypot.name = 'website';
      honeypot.tabIndex = -1;
      honeypot.autocomplete = 'off';
      trap.appendChild(honeypot);

      const submit = el('button', 'gcm-submit', 'Transmit');
      submit.type = 'submit';
      const status = el('div', 'gcm-status');
      const note = el('p', 'gcm-note', 'Comments appear publicly right away. Your email stays private.');

      [email, text, chips, trap, submit, status, note].forEach((node) => form.appendChild(node));
      section.appendChild(form);

      function setStatus(message, isError) {
        status.textContent = message;
        status.className = isError ? 'gcm-status gcm-error' : 'gcm-status';
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (honeypot.value) {
          setStatus('Transmission received.', false);
          return;
        }
        const content = text.value.trim();
        if (!content && !selected) {
          setStatus('Add a comment or pick a reaction.', true);
          return;
        }
        submit.disabled = true;
        try {
          const result = await GCM.comments.submit({ postId: post.id, email: email.value, content, reaction: selected });
          if (result.ok) {
            text.value = '';
            selected = null;
            chips.querySelectorAll('.gcm-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
            setStatus('Transmission received.', false);
            renderComments(await GCM.comments.list(post.id));
          } else {
            setStatus('Please enter a valid email address.', true);
          }
        } catch (err) {
          console.error('Comment submit failed:', err);
          setStatus('Could not send right now. Try again later.', true);
        } finally {
          submit.disabled = false;
        }
      });

      GCM.comments.watch(post.id, renderComments, 20000);
      return section;
    }

    async function renderPost(slug) {
      const hero = document.querySelector('.blog-hero-header');
      if (hero) hero.style.display = 'none';
      const wrap = el('div', 'gcm-post');
      grid.replaceWith(wrap);
      showMessage(wrap, 'Loading transmission...');

      let post;
      try {
        post = await GCM.posts.bySlug(slug);
      } catch (err) {
        console.error('Post load failed:', err);
        showMessage(wrap, 'Could not load this transmission.');
        return;
      }

      const back = el('a', 'read-btn gcm-back', '\u2190 All transmissions');
      back.href = './';

      if (!post) {
        wrap.textContent = '';
        wrap.appendChild(back);
        wrap.appendChild(el('p', 'gcm-empty', 'That transmission does not exist.'));
        return;
      }

      document.title = post.title + ' | God Child Media';
      wrap.textContent = '';
      wrap.appendChild(back);

      const media = mediaFor(post.video_url) || thumbnailImage(post);
      if (media) {
        const frame = el('div', 'gcm-post-media');
        frame.appendChild(media);
        wrap.appendChild(frame);
      }

      wrap.appendChild(el('span', 'blog-tag', post.tag));
      wrap.appendChild(el('h1', '', post.title));
      wrap.appendChild(el('div', 'gcm-meta', fmtDate(post.created_at) + (post.read_time ? ' \u2022 ' + post.read_time : '')));
      const fullText = (post.content || '').trim();
      if (fullText && fullText !== post.summary.trim()) {
        wrap.appendChild(el('p', 'gcm-lead', post.summary));
      }
      const bodyEl = el('div', 'gcm-body');
      (fullText || post.summary).split(/\n{2,}/).forEach((part) => {
                if (part.trim()) {
          const paragraph = el('p');
          richText(paragraph, part.trim());
          bodyEl.appendChild(paragraph);
                }

    if (typeof GCM === 'undefined') {
      showMessage(grid, 'Backend unavailable. Reload the page.');
      return;
    }

    const slug = new URLSearchParams(window.location.search).get('slug');
    if (slug) renderPost(slug);
    else renderArchive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
