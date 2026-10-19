(function () {
  const css = [
    'html:not(.gcm-ready) body > *:not(#gcm-login) { display: none !important; }',
    '#gcm-login { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: #050409; color: #f3f4f6; font-family: Inter, system-ui, sans-serif; z-index: 99999; }',
    '#gcm-login .gcm-card { width: 100%; max-width: 380px; padding: 32px 28px; border-radius: 14px; background: rgba(13, 10, 20, 0.85); border: 1px solid rgba(240, 180, 41, 0.2); backdrop-filter: blur(10px); box-shadow: 0 0 40px rgba(99, 43, 168, 0.25); }',
    '#gcm-login h1 { margin: 0 0 6px; font-family: Cinzel, serif; font-size: 1.5rem; color: #f0b429; letter-spacing: 2px; text-transform: uppercase; background: none; -webkit-text-fill-color: #f0b429; }',
    '#gcm-login .gcm-sub { margin: 0 0 22px; font-size: 0.85rem; color: #9ca3af; }',
    '#gcm-login input { display: block; width: 100%; box-sizing: border-box; margin: 0 0 12px; padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(240, 180, 41, 0.2); background: rgba(5, 4, 9, 0.8); color: #f3f4f6; font-size: 1rem; outline: none; }',
    '#gcm-login input:focus { border-color: #f0b429; }',
    '#gcm-login button { width: 100%; padding: 12px; border: 0; border-radius: 8px; background: #f0b429; color: #050409; font-size: 1rem; font-weight: 600; cursor: pointer; }',
    '#gcm-login button:disabled { opacity: 0.6; cursor: wait; }',
    '#gcm-login .gcm-msg { min-height: 1.2em; margin: 0 0 12px; font-size: 0.85rem; color: #f87171; }',
    '#gcm-signout { position: fixed; right: 16px; bottom: 16px; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(240, 180, 41, 0.4); background: rgba(13, 10, 20, 0.9); color: #f0b429; font-size: 0.85rem; cursor: pointer; z-index: 99998; }',
  ].join('\n');

  const style = document.createElement('style');
  style.id = 'gcm-lock';
  style.textContent = css;
  document.head.appendChild(style);

  let unlocked = false;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    (children || []).forEach((child) => node.appendChild(child));
    return node;
  }

  function unlock(overlay) {
    unlocked = true;
    overlay.remove();
    document.documentElement.classList.add('gcm-ready');
    const signOut = el('button', { id: 'gcm-signout', type: 'button', textContent: 'Sign out' });
    signOut.addEventListener('click', async () => {
      signOut.disabled = true;
      await GCM.auth.signOut();
      window.location.reload();
    });
    document.body.appendChild(signOut);
    window.dispatchEvent(new CustomEvent('gcm:admin-ready'));
  }

  function showForm(overlay, card) {
    card.textContent = '';
    const email = el('input', { type: 'email', placeholder: 'Email', autocomplete: 'username', required: true });
    const password = el('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', required: true });
    const message = el('p', { className: 'gcm-msg' });
    const button = el('button', { type: 'submit', textContent: 'Sign in' });
    const form = el('form', {}, [email, password, message, button]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      button.disabled = true;
      message.textContent = '';
      let ok = false;
      try {
        await GCM.auth.signIn(email.value, password.value);
        ok = await GCM.auth.isAdmin();
        if (!ok) await GCM.auth.signOut();
      } catch (err) {
        ok = false;
      }
      if (ok) {
        unlock(overlay);
      } else {
        message.textContent = 'Invalid credentials.';
        password.value = '';
        button.disabled = false;
      }
    });

    card.appendChild(el('h1', { textContent: 'Command Center' }));
    card.appendChild(el('p', { className: 'gcm-sub', textContent: 'Authorized operatives only.' }));
    card.appendChild(form);
    email.focus();
  }

  async function start() {
    const card = el('div', { className: 'gcm-card' }, [
      el('p', { className: 'gcm-sub', textContent: 'Verifying access...' }),
    ]);
    const overlay = el('div', { id: 'gcm-login' }, [card]);
    document.body.appendChild(overlay);

    if (typeof GCM === 'undefined') {
      card.textContent = 'Backend unavailable. Reload the page.';
      return;
    }

    GCM.db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && unlocked) window.location.reload();
    });

    let admin = false;
    try {
      admin = await GCM.auth.isAdmin();
    } catch (err) {
      admin = false;
    }
    if (admin) {
      unlock(overlay);
    } else {
      showForm(overlay, card);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
