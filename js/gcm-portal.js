(function () {
  const form = document.getElementById('b2bPortalForm');
  if (!form) return;

  let statusDiv = document.getElementById('portalStatusMsg');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'portalStatusMsg';
    statusDiv.style.cssText = 'margin-bottom: 1rem; font-size: 0.9rem; min-height: 1.2em; text-align: center;';
    form.insertBefore(statusDiv, form.querySelector('button[type="submit"]'));
  }

  function setStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? '#f87171' : '#34d399';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setStatus('', false);

    const submitBtn = document.getElementById('portalSubmitBtn');
    let websiteVal = document.getElementById('busWebsite').value.trim();

    // Frictionless Auto-Formatting: If they entered a website without http:// or https://, fix it automatically.
    if (websiteVal && !/^https?:\/\//i.test(websiteVal)) {
      websiteVal = 'https://' + websiteVal;
    }

    const leadData = {
      businessName: document.getElementById('busName').value.trim(),
      location: document.getElementById('busLocation').value.trim(),
      email: document.getElementById('busEmail').value.trim(),
      phone: document.getElementById('busPhone').value.trim(),
      website: websiteVal || null,
    };

    if (typeof GCM === 'undefined' || !GCM.leads) {
      setStatus('System connection error. Please refresh the page and try again.', true);
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Request...';

      const result = await GCM.leads.submit(leadData);

      if (result.ok) {
        setStatus('Thank you for your submission! You will hear from us soon with your verification status and demo credentials.', false);
        form.reset();
      } else if (result.reason === 'duplicate') {
        setStatus('Notice: An access request with this email address has already been submitted.', true);
      } else if (result.reason === 'invalid') {
        setStatus('Error: Please provide valid contact details and a proper email format.', true);
      }
    } catch (err) {
      console.error('B2B Lead submission error:', err);
      setStatus('System error during submission. Please try again later.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Demo Password \u2192';
    }
  });
})();

