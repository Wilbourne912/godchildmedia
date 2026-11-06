(function () {
  const LINK_PATTERN = /^(\/|https:\/\/)/;
  const KEY_PATTERN = /^[a-z0-9_-]{1,32}$/;
  const state = { pages: ['home'], started: false };

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function heading(text, color) {
    const h = el('h3', null, text);
    h.style.cssText = "font-family: 'Cinzel', serif; margin-bottom: 1.25rem; font-size: 1.1rem; color: " + (color || '#f0b429') + ';';
    return h;
  }

  function friendly(error) {
    if (!error) return 'Something went wrong.';
    if (error.code === '23505') return 'That entry already exists.';
    if (error.code === '23514') return 'A value was rejected. Check lengths, and that links start with https:// or /.';
    if (error.code === '42501') return 'Permission denied. Sign out and back in as admin.';
    return error.message || 'Something went wrong.';
  }

  function td(text, className) {
    const cell = el('td', className, text);
    return cell;
  }

  function actionButton(label, className, handler) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('That file could not be read as an image.'));
      };
      img.src = url;
    });
  }

  function readField(field, input) {
    if (field.type === 'checkbox') return input.checked;
    let value = input.value.trim();
    if (field.type === 'number') {
      if (value === '') value = String(field.default || 0);
      if (!/^-?\d+$/.test(value)) throw new Error(field.name + ' must be a whole number.');
      return parseInt(value, 10);
    }
    if (!value) {
      if (field.required) throw new Error(field.name + ' is required.');
      return null;
    }
    if (field.max && value.length > field.max) throw new Error(field.name + ' must be ' + field.max + ' characters or fewer.');
    if (field.validate === 'link' && !LINK_PATTERN.test(value)) throw new Error(field.name + ' must start with https:// or /');
    if (field.validate === 'https' && !/^https:\/\//.test(value)) throw new Error(field.name + ' must start with https://');
    if (field.validate === 'key' && !KEY_PATTERN.test(value)) throw new Error(field.name + ' can only use lowercase letters, numbers, hyphens and underscores (max 32).');
    return value;
  }

  function buildInput(field, ui) {
    let input;
    if (field.type === 'textarea') {
      input = el('textarea');
    } else if (field.type === 'select') {
      input = el('select');
      field.options().forEach((value) => {
        const option = el('option', null, value);
        option.value = value;
        input.appendChild(option);
      });
    } else if (field.type === 'checkbox') {
      input = el('input');
      input.type = 'checkbox';
      input.style.cssText = 'width: auto; margin: 0 8px 0 0;';
    } else if (field.type === 'image') {
      input = el('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
    } else {
      input = el('input');
      input.type = field.type === 'number' ? 'number' : 'text';
    }
    if (field.placeholder) input.placeholder = field.placeholder;
    input.id = ui.prefix + '-' + field.key;
    return input;
  }

  function mountCrud(root, cfg) {
    const ui = { editing: null, filter: '', inputs: {}, rows: [], prefix: 'site-' + cfg.table };
    root.textContent = '';

    const formCard = el('div', 'glass-card');
    const formTitle = heading('Add ' + cfg.singular);
    const form = el('form');
    const grid = el('div', 'form-grid');

    cfg.fields.forEach((field) => {
      const group = el('div', 'form-group' + (field.full ? ' full' : ''));
      const label = el('label', null, field.label);
      label.htmlFor = ui.prefix + '-' + field.key;
      const input = buildInput(field, ui);
      ui.inputs[field.key] = input;
      if (field.type === 'checkbox') {
        label.style.cssText = 'display: flex; align-items: center;';
        label.insertBefore(input, label.firstChild);
        group.appendChild(label);
      } else {
        group.appendChild(label);
        group.appendChild(input);
      }
      if (field.hint) {
        const hint = el('p', null, field.hint);
        hint.style.cssText = 'color: #9ca3af; font-size: 0.8rem; margin-top: 6px;';
        group.appendChild(hint);
      }
      if (field.type === 'image') {
        const preview = el('img');
        preview.alt = '';
        preview.style.cssText = 'display: none; width: 96px; height: 96px; margin-top: 10px; border-radius: 50%; object-fit: cover; border: 2px solid #f0b429;';
        ui.preview = preview;
        group.appendChild(preview);
      }
      grid.appendChild(group);
    });
    form.appendChild(grid);

    const buttons = el('div');
    buttons.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap; align-items: center;';
    const submit = el('button', 'btn-amber', 'Add ' + cfg.singular);
    submit.type = 'submit';
    const cancel = el('button', null, 'Cancel edit');
    cancel.type = 'button';
    cancel.style.cssText = 'display: none; background: none; border: 1px solid rgba(255,255,255,0.2); color: #f3f4f6; padding: 0.9rem 1.4rem; border-radius: 8px; cursor: pointer; font-family: inherit;';
    buttons.append(submit, cancel);
    form.appendChild(buttons);
    formCard.append(formTitle, form);

    const listCard = el('div', 'glass-card');
    const listTitle = heading(cfg.listTitle, '#f3f4f6');
    listCard.appendChild(listTitle);

    if (cfg.filter) {
      const bar = el('div', 'form-group');
      bar.style.marginBottom = '1rem';
      const label = el('label', null, cfg.filter.label);
      const select = el('select');
      const all = el('option', null, cfg.filter.all);
      all.value = '';
      select.appendChild(all);
      cfg.filter.options().forEach((value) => {
        const option = el('option', null, value);
        option.value = value;
        select.appendChild(option);
      });
      select.addEventListener('change', () => {
        ui.filter = select.value;
        renderRows();
      });
      bar.append(label, select);
      listCard.appendChild(bar);
    }

    const count = el('p');
    count.style.cssText = 'color: #9ca3af; font-size: 0.85rem; margin-bottom: 0.75rem;';
    const wrap = el('div');
    wrap.style.overflowX = 'auto';
    const table = el('table');
    const thead = el('thead');
    const headRow = el('tr');
    cfg.columns.forEach((column) => headRow.appendChild(el('th', null, column[0])));
    headRow.appendChild(el('th', null, 'Actions'));
    thead.appendChild(headRow);
    const tbody = el('tbody');
    table.append(thead, tbody);
    wrap.appendChild(table);
    listCard.append(count, wrap);
    root.append(formCard, listCard);

    function resetForm() {
      form.reset();
      ui.editing = null;
      formTitle.textContent = 'Add ' + cfg.singular;
      submit.textContent = 'Add ' + cfg.singular;
      cancel.style.display = 'none';
      cfg.fields.forEach((field) => {
        const input = ui.inputs[field.key];
        input.disabled = false;
        if (field.default !== undefined) {
          if (field.type === 'checkbox') input.checked = field.default;
          else input.value = field.default;
        }
      });
      if (ui.preview) ui.preview.style.display = 'none';
    }

    function startEdit(row) {
      ui.editing = row;
      formTitle.textContent = 'Edit ' + cfg.singular;
      submit.textContent = 'Save changes';
      cancel.style.display = 'inline-block';
      cfg.fields.forEach((field) => {
        const input = ui.inputs[field.key];
        if (field.type === 'image') {
          input.value = '';
          const url = row[field.pathKey] ? GCM.thumbnails.url(row[field.pathKey]) : null;
          ui.preview.style.display = url ? 'block' : 'none';
          if (url) ui.preview.src = url;
          return;
        }
        if (field.type === 'checkbox') input.checked = Boolean(row[field.key]);
        else input.value = row[field.key] === null || row[field.key] === undefined ? '' : row[field.key];
        input.disabled = Boolean(field.lockOnEdit);
      });
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderRows() {
      tbody.textContent = '';
      const rows = ui.filter ? ui.rows.filter((row) => row[cfg.filter.field] === ui.filter) : ui.rows;
      count.textContent = rows.length + (rows.length === 1 ? ' item' : ' items');
      rows.forEach((row) => {
        const tr = el('tr');
        cfg.columns.forEach((column) => tr.appendChild(td(column[1](row), column[2])));
        const actions = el('div', 'action-links');
        actions.appendChild(actionButton('Edit', 'edit-action', () => startEdit(row)));
        if (cfg.deletable) {
          actions.appendChild(actionButton('Delete', 'delete-action', async () => {
            if (!window.confirm('Delete "' + cfg.label(row) + '"? This cannot be undone.')) return;
            const { data, error } = await GCM.db.from(cfg.table).delete().eq(cfg.idKey, row[cfg.idKey]).select();
            if (error || !data || !data.length) {
              window.alert(error ? friendly(error) : 'Nothing was deleted. Check that you are signed in as admin.');
              return;
            }
            if (ui.editing && ui.editing[cfg.idKey] === row[cfg.idKey]) resetForm();
            await load();
          }));
        }
        const cell = el('td');
        cell.appendChild(actions);
        tr.appendChild(cell);
        tbody.appendChild(tr);
      });
    }

    async function load() {
      let query = GCM.db.from(cfg.table).select('*');
      cfg.order.forEach(([column, ascending]) => {
        query = query.order(column, { ascending });
      });
      const { data, error } = await query;
      if (error) {
        window.alert(friendly(error));
        return;
      }
      ui.rows = data || [];
      renderRows();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      let uploaded = null;
      try {
        const payload = {};
        cfg.fields.forEach((field) => {
          if (field.type === 'image') return;
          if (ui.editing && field.lockOnEdit) return;
          payload[field.key] = readField(field, ui.inputs[field.key]);
        });
        if (cfg.prepare) uploaded = await cfg.prepare(payload, ui);

        const table = GCM.db.from(cfg.table);
        const result = ui.editing
          ? await table.update(payload).eq(cfg.idKey, ui.editing[cfg.idKey]).select()
          : await table.insert(payload).select();

        if (result.error || !result.data || !result.data.length) {
          if (uploaded) await GCM.admin.removeThumbnail(uploaded.newPath);
          throw new Error(result.error ? friendly(result.error) : 'Nothing was saved. Check that you are signed in as admin.');
        }
        if (uploaded && uploaded.oldPath) await GCM.admin.removeThumbnail(uploaded.oldPath);
        resetForm();
        await load();
      } catch (error) {
        window.alert(error.message);
      } finally {
        submit.disabled = false;
      }
    });

    cancel.addEventListener('click', resetForm);
    resetForm();
    return load();
  }

  const RESOURCES = {
    cards: {
      table: 'cards',
      singular: 'card',
      listTitle: 'All Cards',
      idKey: 'id',
      deletable: true,
      label: (row) => row.title,
      order: [['page', true], ['section', true], ['sort_order', true]],
      filter: { field: 'page', label: 'Show cards for page', all: 'All pages', options: () => state.pages },
      fields: [
        { key: 'page', name: 'Page', label: 'Page', type: 'select', options: () => state.pages, required: true },
        { key: 'section', name: 'Section', label: 'Section (home page uses solutions or engine; other pages use main)', type: 'text', required: true, default: 'main', validate: 'key', max: 32 },
        { key: 'icon', name: 'Icon', label: 'Icon (one emoji, optional)', type: 'text', max: 8 },
        { key: 'title', name: 'Title', label: 'Title', type: 'text', required: true, max: 120 },
        { key: 'body', name: 'Description', label: 'Description', type: 'textarea', full: true, max: 600 },
        { key: 'link_url', name: 'Link', label: 'Link (https://... or /page/, optional)', type: 'text', validate: 'link', max: 300 },
        { key: 'sort_order', name: 'Order', label: 'Order (lower numbers show first)', type: 'number', default: 0 },
        { key: 'is_active', name: 'Active', label: 'Active (clickable). Unchecked cards stay visible as "Coming soon".', type: 'checkbox', default: true },
      ],
      columns: [
        ['Title', (row) => row.title, 'title-col'],
        ['Page / Section', (row) => row.page + ' / ' + row.section],
        ['Link', (row) => row.link_url || '\u2014'],
        ['Status', (row) => (row.is_active ? 'Active' : 'Coming soon')],
        ['Order', (row) => String(row.sort_order)],
      ],
    },

    links: {
      table: 'site_links',
      singular: 'link',
      listTitle: 'Navigation & Footer Links',
      idKey: 'id',
      deletable: true,
      label: (row) => row.label,
      order: [['sort_order', true]],
      fields: [
        { key: 'label', name: 'Label', label: 'Label', type: 'text', required: true, max: 60 },
        { key: 'url', name: 'Link', label: 'Link (https://... or /page/)', type: 'text', required: true, validate: 'link', max: 300 },
        { key: 'placement', name: 'Placement', label: 'Show in', type: 'select', options: () => ['both', 'nav', 'footer'], required: true, default: 'both' },
        { key: 'sort_order', name: 'Order', label: 'Order (lower numbers show first)', type: 'number', default: 0 },
        { key: 'is_active', name: 'Active', label: 'Active (unchecked links are hidden everywhere)', type: 'checkbox', default: true },
      ],
      columns: [
        ['Label', (row) => row.label, 'title-col'],
        ['Link', (row) => row.url],
        ['Shows in', (row) => row.placement],
        ['Status', (row) => (row.is_active ? 'Active' : 'Hidden')],
        ['Order', (row) => String(row.sort_order)],
      ],
    },

    characters: {
      table: 'characters',
      singular: 'character',
      listTitle: 'Characters',
      idKey: 'slug',
      deletable: false,
      label: (row) => row.name,
      order: [['slug', true]],
      fields: [
        { key: 'slug', name: 'Page key', label: 'Page key (lowercase, cannot change later)', type: 'text', required: true, validate: 'key', lockOnEdit: true, max: 32 },
        { key: 'name', name: 'Name', label: 'Display name (stage name)', type: 'text', required: true, max: 80 },
        { key: 'subtitle', name: 'Subtitle', label: 'Subtitle (real name, optional)', type: 'text', max: 120 },
        { key: 'tagline', name: 'Tagline', label: 'Tagline (under the name)', type: 'text', full: true, max: 200 },
        { key: 'bio', name: 'Bio', label: 'Bio text', type: 'textarea', full: true, max: 4000, hint: 'Leave a blank line between paragraphs.' },
        { key: 'hero', pathKey: 'hero_path', name: 'Hero image', label: 'Hero image (square, 1024 x 1024 px, JPG/PNG/WebP, max 2 MB)', type: 'image', full: true, hint: 'Leave empty to keep the current image. Keep the subject centered; the circle crop trims the corners.' },
        { key: 'tiktok_url', name: 'TikTok link', label: 'TikTok link (https://...)', type: 'text', validate: 'https', max: 300 },
        { key: 'instagram_url', name: 'Instagram link', label: 'Instagram link (https://...)', type: 'text', validate: 'https', max: 300 },
        { key: 'youtube_url', name: 'YouTube link', label: 'YouTube link (https://...)', type: 'text', validate: 'https', max: 300 },
      ],
      columns: [
        ['Name', (row) => row.name, 'title-col'],
        ['Page key', (row) => row.slug],
        ['Hero image', (row) => (row.hero_path ? 'Set' : 'Not set')],
        ['Updated', (row) => new Date(row.updated_at).toLocaleDateString()],
      ],
      async prepare(payload, ui) {
        payload.updated_at = new Date().toISOString();
        const input = ui.inputs.hero;
        const file = input.files && input.files[0];
        if (!file) return null;
        const problem = GCM.thumbnails.check(file);
        if (problem) throw new Error(problem);
        const size = await loadImage(file);
        if (size.width !== size.height) {
          const ok = window.confirm('This image is ' + size.width + ' x ' + size.height + ', not square. It will be center-cropped into the circle. Use it anyway?');
          if (!ok) throw new Error('Upload cancelled.');
        } else if (size.width < 600) {
          const ok = window.confirm('This image is only ' + size.width + ' px wide and may look soft. Use it anyway?');
          if (!ok) throw new Error('Upload cancelled.');
        }
        const newPath = await GCM.admin.uploadThumbnail(file);
        payload.hero_path = newPath;
        return { newPath: newPath, oldPath: ui.editing ? ui.editing.hero_path : null };
      },
    },
  };

  function csvCell(value) {
    let text = String(value === null || value === undefined ? '' : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  async function mountSupporters(root) {
    root.textContent = '';
    const card = el('div', 'glass-card');
    card.appendChild(heading('Supporters', '#f3f4f6'));

    const bar = el('div');
    bar.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 1rem;';
    const group = el('div', 'form-group');
    group.style.marginBottom = '0';
    group.appendChild(el('label', null, 'List'));
    const select = el('select');
    const all = el('option', null, 'All lists');
    all.value = '';
    select.appendChild(all);
    state.pages.filter((page) => page !== 'home').forEach((page) => {
      const option = el('option', null, page);
      option.value = page;
      select.appendChild(option);
    });
    group.appendChild(select);
    const exportButton = el('button', 'btn-amber', 'Export CSV');
    exportButton.type = 'button';
    bar.append(group, exportButton);

    const count = el('p');
    count.style.cssText = 'color: #9ca3af; font-size: 0.85rem; margin-bottom: 0.75rem;';
    const wrap = el('div');
    wrap.style.overflowX = 'auto';
    const table = el('table');
    const thead = el('thead');
    const headRow = el('tr');
    ['Email', 'List', 'Source', 'Joined', 'Actions'].forEach((name) => headRow.appendChild(el('th', null, name)));
    thead.appendChild(headRow);
    const tbody = el('tbody');
    table.append(thead, tbody);
    wrap.appendChild(table);
    card.append(bar, count, wrap);
    root.appendChild(card);

    let rows = [];

    function visible() {
      return select.value ? rows.filter((row) => row.list === select.value) : rows;
    }

    function render() {
      tbody.textContent = '';
      const shown = visible();
      count.textContent = shown.length + ' shown' + (rows.length >= 1000 ? ' (showing the 1,000 most recent; export covers the same rows)' : '');
      shown.forEach((row) => {
        const tr = el('tr');
        tr.append(td(row.email, 'title-col'), td(row.list), td(row.source), td(new Date(row.created_at).toLocaleDateString()));
        const actions = el('div', 'action-links');
        actions.appendChild(actionButton('Delete
