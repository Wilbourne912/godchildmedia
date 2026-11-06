const sb = GCM.db;

const params = new URLSearchParams(window.location.search);
const rawSource = (params.get('s') || 'direct').toLowerCase();
const source = /^[a-z0-9_-]{1,32}$/.test(rawSource) ? rawSource : 'direct';
let pageKey = 'firstborn';

async function logClick(target) {
  try {
    await sb.from('link_clicks').insert({ target: target, source: source, page: pageKey });
  } catch (e) {}
}

async function submitSupporter(email, list, successMessage) {
  const clean = email.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean) || clean.length > 254) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  const { error } = await sb.from('supporters').insert({ email: clean, source: source, list: list });
  if (error && error.code !== '23505') {
    return { ok: false, message: 'Something went wrong. Try again in a minute.' };
  }
  return { ok: true, message: successMessage };
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('supporter-form');
  const emailInput = document.getElementById('supporter-email');
  const honeypot = document.getElementById('supporter-website');
  const statusEl = document.getElementById('supporter-status');
  const button = document.getElementById('supporter-submit');

  const list = /^[a-z0-9_-]{1,32}$/.test(form.dataset.list || '') ? form.dataset.list : 'firstborn';
  const successMessage = form.dataset.success || "You're in. Thanks for joining.";
  pageKey = list;

  logClick('page-view');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (honeypot.value !== '') {
      statusEl.textContent = successMessage;
      return;
    }
    button.disabled = true;
    statusEl.textContent = 'Joining...';
    const result = await submitSupporter(emailInput.value, list, successMessage);
    statusEl.textContent = result.message;
    if (result.ok) {
      form.reset();
    } else {
      button.disabled = false;
    }
  });

  document.addEventListener('click', (event) => {
    const tracked = event.target.closest('[data-track]');
    if (tracked) logClick(tracked.dataset.track);
  });
});

