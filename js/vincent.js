const SUPABASE_URL = 'https://oobwtogzkvjgaghwpzxs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYnd0b2d6a3ZqZ2FnaHdwenhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDk4NTUsImV4cCI6MjEwNzc4NTg1NX0.pbmQ1K1_XnbLdvyZinH0PYQ-dXhtp5XCuDIwMNxApeQ';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const rawSource = (params.get('s') || 'direct').toLowerCase();
const source = /^[a-z0-9_-]{1,32}$/.test(rawSource) ? rawSource : 'direct';
const SUCCESS_MESSAGE = "You're in. Thanks for supporting Vincent and God Child Media.";

async function logClick(target) {
  try {
    await sb.from('link_clicks').insert({ page: 'vincent', target: target, source: source });
  } catch (e) {}
}

async function submitSupporter(email) {
  const clean = email.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean) || clean.length > 254) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  const { error } = await sb.from('supporters').insert({ email: clean, source: source, list: 'vincent' });
  if (error && error.code !== '23505') {
    return { ok: false, message: 'Something went wrong. Try again in a minute.' };
  }
  return { ok: true, message: SUCCESS_MESSAGE };
}

document.addEventListener('DOMContentLoaded', () => {
  logClick('page-view');

  const form = document.getElementById('supporter-form');
  const emailInput = document.getElementById('supporter-email');
  const honeypot = document.getElementById('supporter-website');
  const statusEl = document.getElementById('supporter-status');
  const button = document.getElementById('supporter-submit');

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (honeypot && honeypot.value !== '') {
        statusEl.textContent = SUCCESS_MESSAGE;
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
  }

  document.querySelectorAll('[data-track]').forEach((el) => {
    el.addEventListener('click', () => logClick(el.dataset.track));
  });
});
