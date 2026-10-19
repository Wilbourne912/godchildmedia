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
    const post = await GCM.posts.latest();
    if (!post) return;

    const setText = (selector, value) => {
      const el = widget.querySelector(selector);
      if (el) el.textContent = value;
    };

    setText('.transmission-tag', post.tag);
    setText('.transmission-info h3', post.title);
    setText('.transmission-info p', post.summary);

    const badge = widget.querySelector('.transmission-badge span:last-child');
    if (badge) badge.textContent = 'Latest Transmission';

    const meta = widget.querySelector('.transmission-meta');
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

    const link = widget.querySelector('.transmission-actions a');
    if (link) link.href = 'blog/?slug=' + encodeURIComponent(post.slug);
  }

  loadLatestTransmission().catch((err) => console.error('Latest transmission error:', err));
})();
