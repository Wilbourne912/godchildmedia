(function () {
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active-reveal');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('active-reveal'));
  }

  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach((section) => {
      if (window.pageYOffset >= section.offsetTop - 200) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (current && link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });

  const form = document.getElementById('waitlistForm');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const emailInput = document.getElementById('userEmail');
      const email = emailInput.value.trim();
      const button = form.querySelector('button[type="submit"]');
      if (typeof GCM === 'undefined') {
        alert('System error during initialization. Please try again later.');
        return;
      }
      try {
        button.disabled = true;
        button.textContent = 'Initializing...';
        const result = await GCM.waitlist.join(email);
        if (result.ok && result.duplicate) {
          alert('Notice: that email is already registered in the GCM operative registry.');
          form.reset();
        } else if (result.ok) {
          alert('Initialization successful! Welcome to God Child Media.');
          form.reset();
        } else {
          alert('Error: Please provide a valid email address.');
        }
      } catch (err) {
        console.error('Waitlist join error:', err);
        alert('System error during initialization. Please try again later.');
      } finally {
        button.disabled = false;
        button.textContent = 'Initialize';
      }
    });
  }

  async function loadLatestTransmission() {
    const widget = document.querySelector('.latest-transmission-container');
    if (!widget || typeof GCM === 'undefined') return;
    const posts = await GCM.posts.list(4, 'all');
    if (!posts.length) return;

    const card = widget.querySelector('.transmission-card');
    const thumbImg = widget.querySelector('.preview-thumb');
    const overlay = widget.querySelector('.play-button-overlay');
    const badge = widget.querySelector('.transmission-badge span:last-child');
    const meta = widget.querySelector('.transmission-meta');
    const link = widget.querySelector('.transmission-actions a');
    const preview = widget.querySelector('.video-preview-wrapper');
    const defaultThumb = thumbImg ? thumbImg.getAttribute('src') : null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setText = (selector, value) => {
      const el = widget.querySelector(selector);
      if (el) el.textContent = value;
    };

    let tap = null;
    if (preview) {
      tap = document.createElement('a');
      tap.style.cssText = 'position:absolute;inset:0;display:block;z-index:2;';
      preview.appendChild(tap);
    }

    const channelOf = (post) => GCM.channels[post.channel] || GCM.channels.standard;
    const urlFor = (post) => channelOf(post).path + '?slug=' + encodeURIComponent(post.slug);

    function render(post) {
      setText('.transmission-tag', post.tag);
      setText('.transmission-info h3', post.title);
      setText('.transmission-info p', post.summary.length > 220 ? post.summary.slice(0, 220).trimEnd() + '...' : post.summary);

      const thumbSrc = GCM.thumbnails.forPost(post);
      if (thumbImg) {
        thumbImg.src = thumbSrc || defaultThumb;
        thumbImg.style.objectFit = thumbSrc ? 'cover' : '';
      }
      if (overlay) overlay.style.display = post.video_url ? '' : 'none';
      if (badge) badge.textContent = channelOf(post).label;

      if (meta) {
        meta.textContent = '';
        if (post.read_time) {
          const readTime = document.createElement('span');
          readTime.textContent = post.read_time;
          meta.appendChild(readTime);
        }
        if (post.video_url) {
          const video = document.createElement('span');
          video.textContent = 'Video Included';
          meta.appendChild(video);
        }
      }

      const postUrl = urlFor(post);
      if (link) link.href = postUrl;
      if (tap) {
        tap.href = postUrl;
        tap.setAttribute('aria-label', 'Open transmission: ' + post.title);
      }
    }

    let current = 0;
    let timer = null;
    let dotEls = [];

    function markDots() {
      dotEls.forEach((dot, i) => {
        if (i === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    function show(index, instant) {
      current = index;
      markDots();
      if (instant || reduceMotion || !card) {
        render(posts[index]);
        return;
      }
      card.style.opacity = '0';
      setTimeout(() => {
        render(posts[index]);
        card.style.opacity = '1';
      }, 300);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      if (reduceMotion || posts.length < 2) return;
      timer = setInterval(() => show((current + 1) % posts.length, false), 6000);
    }

    show(0, true);
    if (posts.length < 2) return;

    if (card) card.style.transition = 'opacity 0.3s ease';

    const style = document.createElement('style');
    style.textContent = [
      '.gcm-carousel-dots { display: flex; justify-content: center; gap: 4px; margin-top: 0.75rem; }',
      '.gcm-carousel-dot { width: 24px; height: 24px; padding: 0; border: 0; background: none; cursor: pointer; position: relative; }',
      '.gcm-carousel-dot::after { content: ""; position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); }',
      '.gcm-carousel-dot[aria-current="true"]::after { background: #f0b429; box-shadow: 0 0 8px #f0b429; }',
      '.gcm-carousel-dot:focus-visible { outline: 2px solid #f0b429; outline-offset: 2px; }',
    ].join('\n');
    document.head.appendChild(style);

    const dots = document.createElement('div');
    dots.className = 'gcm-carousel-dots';
    posts.forEach((post, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'gcm-carousel-dot';
      dot.setAttribute('aria-label', 'Show transmission ' + (index + 1));
      dot.addEventListener('click', () => {
        show(index, false);
        start();
      });
      dots.appendChild(dot);
      dotEls.push(dot);
    });
    widget.appendChild(dots);
    markDots();

    widget.addEventListener('mouseenter', stop);
    widget.addEventListener('mouseleave', start);
    widget.addEventListener('focusin', stop);
    widget.addEventListener('focusout', start);
    widget.addEventListener('touchstart', stop, { passive: true });
    widget.addEventListener('touchend', start, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });
    start();
  }

  loadLatestTransmission().catch((err) => console.error('Latest transmission error:', err));
})();

