(function () {
  const form = document.querySelector('form.report');
  if (!form) return;
  const note = form.querySelector('.note');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.website.value) return;
    const message = form.message.value.trim();
    if (message.length < 10) { note.textContent = 'Please describe the problem in at least 10 characters.'; return; }
    let last = 0;
    try { last = Number(localStorage.getItem('gcm_report_ts') || 0); } catch (err) { last = 0; }
    if (Date.now() - last < 30000) { note.textContent = 'Please wait a moment before sending another report.'; return; }
    const body = { message: message, status: 'open', page_slug: form.dataset.slug.slice(0, 200) };
    if (form.dataset.listing) body.listing_id = form.dataset.listing;
    const email = form.email.value.trim();
    if (email) body.reporter_email = email;
    note.textContent = 'Sending…';
    try {
      const res = await fetch(form.dataset.url, {
        method: 'POST',
        headers: {
          apikey: form.dataset.key,
          Authorization: 'Bearer ' + form.dataset.key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('bad status');
      try { localStorage.setItem('gcm_report_ts', String(Date.now())); } catch (err) { last = 0; }
      form.reset();
      note.textContent = 'Thank you. We will review your report.';
    } catch (err) {
      note.textContent = 'Could not send the report. Please try again later.';
    }
  });
})();
