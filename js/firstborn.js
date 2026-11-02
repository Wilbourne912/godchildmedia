const sb = GCM.db;

const params = new URLSearchParams(window.location.search);
const rawSource = (params.get('s') || 'direct').toLowerCase();
const source = /^[a-z0-9_-]{1,32}$/.test(rawSource) ? rawSource : 'direct';

async function logClick(target) {
  try {
    await sb.from('link_clicks').insert({ target: target, source: source });
  } catch (e) {}
}

async function submitSupporter(email) {
  const clean = email.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean) || clean.length > 254) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  const { error } = await sb.from('supporters').insert({ email: clean, source: source });
  if (error && error.code !== '23505') {
    return { ok: false, message: 'Something went wrong. Try again in a minute.' };
  }
  return { ok: true, message: "You're in. Thanks for riding with FirstBorn 912." };
}

function buildCarouselCard(post, index) {
  const link = document.createElement('a');
  link.className = 'carousel-card';
  link.href = '/firstborn912/transmissions/?slug=' + encodeURIComponent(post.slug);
  link.addEventListener('click', () => logClick('carousel-' + (index + 1)));

  const thumbSrc = GCM.thumbnails.forPost(post);
  if (thumbSrc) {
    const img = document.createElement('img');
    img.className = 'carousel-thumb';
    img.src = thumbSrc;
    img.alt = '';
    img.loading = 'lazy';
    link.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'carousel-body';
  const tag = document.createElement('span');
  tag.className = 'carousel-tag';
  tag.textContent = post.tag;
  const title = document.createElement('h3');
  title.className = 'carousel-title';
  title.textContent = post.title;
  const summary = document.createElement('p');
  summary.className = 'carousel-summary';
  summary.textContent = post.summary.length > 120 ? post.summary.slice(0, 120).trimEnd() + '...' : post.summary;
  body.append(tag, title, summary);
  link.appendChild(body);
  return link;
}

async function loadCarousel() {
  const section = document.getElementById('transmissions-carousel');
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  if (!section || !track || !dots) return;

  let posts;
  try {
    posts = await GCM.posts.list(4, 'firstborn');
  } catch (e) {
    return;
  }
  if (!posts.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let timer = null;

  function markActive(index) {
    current = index;
    dots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function showSlide(index) {
    track.scrollTo({ left: index * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    markActive(index);
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
    timer = setInterval(() => showSlide((current + 1) % posts.length), 5000);
  }

  posts.forEach((post, index) => {
    track.appendChild(buildCarouselCard(post, index));
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', 'Show transmission ' + (index + 1));
    dot.addEventListener('click', () => {
      showSlide(index);
      start();
    });
    dots.appendChild(dot);
  });

  track.addEventListener('scroll', () => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== current && index >= 0 && index < posts.length) markActive(index);
  }, { passive: true });

  section.addEventListener('mouseenter', stop);
  section.addEventListener('mouseleave', start);
  section.addEventListener('focusin', stop);
  section.addEventListener('focusout', start);
  track.addEventListener('touchstart', stop, { passive: true });
  track.addEventListener('touchend', start, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  section.hidden = false;
  markActive(0);
  start();
}

document.addEventListener('DOMContentLoaded', () => {
  logClick('page-view');
  loadCarousel();

  const form = document.getElementById('supporter-form');
  const emailInput = document.getElementById('supporter-email');
  const honeypot = document.getElementById('supporter-website');
  const statusEl = document.getElementById('supporter-status');
  const button = document.getElementById('supporter-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (honeypot.value !== '') {
      statusEl.textContent = "You're in. Thanks for riding with FirstBorn 912.";
      return;
    }
    button.disabled = true;
    statusEl.textContent = 'Joining...';
    const result = await submitSupporter(emailInput.value);
    statusEl.textContent = result.message;
    if (result.ok) {
      form.reset();
    } else {
      button.disabled = false;
    }
  });

  document.querySelectorAll('[data-track]').forEach((el) => {
    el.addEventListener('click', () => logClick(el.dataset.track));
  });
});
