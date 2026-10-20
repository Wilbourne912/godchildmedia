(function () {
  const $ = (id) => document.getElementById(id);
  let editingId = null;
  let postsById = {};

  window.switchTab = function (tabId, btn) {
    document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach((b) => b.classList.remove('active'));
    $(tabId).classList.add('active');
    btn.classList.add('active');
  };

  function td(text, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function actionButton(label, className, action, id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
  }

  function messageRow(columns, text) {
    const row = document.createElement('tr');
    const cell = td(text);
    cell.colSpan = columns;
    cell.style.textAlign = 'center';
    cell.style.color = '#9ca3af';
    row.appendChild(cell);
    return row;
  }

  const fmtDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtDateTime = (v) => new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function loadPosts() {
    const tbody = $('posts-table-body');
    try {
      const posts = await GCM.posts.list(100);
      postsById = {};
      tbody.textContent = '';
      if (!posts.length) {
        tbody.appendChild(messageRow(4, 'No transmissions found.'));
        return;
      }
      posts.forEach((post) => {
        postsById[post.id] = post;
        const row = document.createElement('tr');
        const actions = document.createElement('div');
        actions.className = 'action-links';
        actions.appendChild(actionButton('Edit', 'edit-action', 'edit', post.id));
        actions.appendChild(actionButton('Delete', 'delete-action', 'delete', post.id));
        const actionCell = document.createElement('td');
        actionCell.appendChild(actions);
        row.appendChild(td(post.title, 'title-col'));
        row.appendChild(td(post.tag || 'Uncategorized'));
        row.appendChild(td(fmtDate(post.created_at)));
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load transmissions:', err);
      tbody.textContent = '';
      tbody.appendChild(messageRow(4, 'Could not load transmissions.'));
    }
  }

  async function loadComments() {
    const tbody = $('comments-table-body');
    try {
      const comments = await GCM.admin.listComments();
      tbody.textContent = '';
      if (!comments.length) {
        tbody.appendChild(messageRow(5, 'No recent feedback recorded.'));
        return;
      }
      comments.forEach((c) => {
        const row = document.createElement('tr');
        const reaction = c.reaction_type ? '[' + c.reaction_type + '] ' : '';
        const body = c.content ? '"' + c.content + '"' : '';
        const actionCell = document.createElement('td');
        actionCell.appendChild(actionButton('Remove', 'delete-action', 'delete', c.id));
        row.appendChild(td(c.user_email, 'title-col'));
        row.appendChild(td(c.posts && c.posts.title ? c.posts.title : 'General'));
        row.appendChild(td(reaction + body));
        row.appendChild(td(fmtDateTime(c.created_at)));
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load comments:', err);
      tbody.textContent = '';
      tbody.appendChild(messageRow(5, 'Could not load feedback.'));
    }
  }

  async function loadUsers() {
    const tbody = $('users-table-body');
    try {
      const users = await GCM.admin.listUsers();
      tbody.textContent = '';
      if (!users.length) {
        tbody.appendChild(messageRow(4, 'No registered operatives yet.'));
        return;
      }
      users.forEach((user) => {
        const row = document.createElement('tr');
        const isAdmin = user.role === 'admin';
        const statusCell = td(isAdmin ? 'Administrator' : user.status === 'active' ? 'Operative' : 'Suspended');
        statusCell.style.color = '#f0b429';
        const manageCell = document.createElement('td');
        if (isAdmin) {
          manageCell.textContent = 'Protected';
        } else {
          manageCell.appendChild(actionButton('Revoke', 'delete-action', 'delete', user.id));
        }
        row.appendChild(td(user.email, 'title-col'));
        row.appendChild(statusCell);
        row.appendChild(td(fmtDate(user.created_at)));
        row.appendChild(manageCell);
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load users:', err);
      tbody.textContent = '';
      tbody.appendChild(messageRow(4, 'Could not load users.'));
    }
  }

  function bindTable(tbodyId, handler) {
    $(tbodyId).addEventListener('click', async (e) => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      button.disabled = true;
      try {
        await handler(button.dataset.action, button.dataset.id);
      } catch (err) {
        console.error('Action failed:', err);
        alert('That action failed. Check the console and try again.');
      } finally {
        button.disabled = false;
      }
    });
  }

  function watch(table, reload) {
    let timer;
    GCM.subscribe(table, () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 300);
    });
  }

  function init() {
    const form = $('post-form');
    const submit = form.querySelector('button[type="submit"]');

    const summaryField = $('post-summary');
    const summaryGroup = summaryField.closest('.form-group');
    const summaryLabel = summaryGroup ? summaryGroup.querySelector('label') : null;
    if (summaryLabel) summaryLabel.textContent = 'Landing Page Summary (short teaser, max 300 characters)';
    summaryField.maxLength = 300;
    summaryField.placeholder = 'One or two sentences shown on the landing page and blog cards...';
    summaryField.style.minHeight = '90px';
    const counter = document.createElement('small');
    counter.style.cssText = 'display:block;margin-top:6px;color:#9ca3af;font-size:0.75rem;';
    const updateCounter = () => {
      counter.textContent = summaryField.value.length + ' / 300';
    };
    summaryField.addEventListener('input', updateCounter);
    summaryField.insertAdjacentElement('afterend', counter);

    let contentField = $('post-content');
    if (!contentField) {
      const group = document.createElement('div');
      group.className = 'form-group full';
      const label = document.createElement('label');
      label.textContent = 'Full Article Content (shown on the blog post page)';
      label.htmlFor = 'post-content';
      contentField = document.createElement('textarea');
      contentField.id = 'post-content';
      contentField.required = true;
      contentField.placeholder = 'Write the full transmission here. Leave a blank line between paragraphs.';
      contentField.style.minHeight = '280px';
      group.appendChild(label);
      group.appendChild(contentField);
      (summaryGroup || summaryField).insertAdjacentElement('afterend', group);
    }
    form.addEventListener('reset', () => setTimeout(updateCounter, 0));
    updateCounter();

    let thumbInput = $('post-thumb');
    let thumbPreview = null;
    let thumbRemove = null;
    let editingThumb = null;
    if (!thumbInput) {
      const group = document.createElement('div');
      group.className = 'form-group full';
      const label = document.createElement('label');
      label.textContent = 'Thumbnail (JPG, PNG or WebP, max 2 MB)';
      label.htmlFor = 'post-thumb';
      thumbInput = document.createElement('input');
      thumbInput.type = 'file';
      thumbInput.id = 'post-thumb';
      thumbInput.accept = 'image/jpeg,image/png,image/webp';
      thumbPreview = document.createElement('img');
      thumbPreview.alt = 'Current thumbnail';
      thumbPreview.style.cssText = 'display:none;max-width:240px;max-height:135px;margin-top:10px;border-radius:8px;border:1px solid rgba(240,180,41,0.3);object-fit:cover;';
      const removeLabel = document.createElement('label');
      removeLabel.style.cssText = 'display:none;margin-top:8px;font-size:0.85rem;color:#9ca3af;cursor:pointer;';
      thumbRemove = document.createElement('input');
      thumbRemove.type = 'checkbox';
      thumbRemove.style.marginRight = '8px';
      removeLabel.appendChild(thumbRemove);
      removeLabel.appendChild(document.createTextNode('Remove current thumbnail'));
      group.appendChild(label);
      group.appendChild(thumbInput);
      group.appendChild(thumbPreview);
      group.appendChild(removeLabel);
      (contentField.closest('.form-group') || summaryGroup || summaryField).insertAdjacentElement('afterend', group);
    }

    function setThumbPreview(path) {
      editingThumb = path || null;
      if (thumbPreview) {
        thumbPreview.style.display = path ? 'block' : 'none';
        if (path) thumbPreview.src = GCM.thumbnails.url(path);
      }
      if (thumbRemove) {
        thumbRemove.checked = false;
        thumbRemove.parentElement.style.display = path ? 'block' : 'none';
      }
    }
    const submitLabel = submit.textContent;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'edit-action';
    cancel.textContent = 'Cancel edit';
    cancel.style.display = 'none';
    cancel.style.marginLeft = '12px';
    submit.insertAdjacentElement('afterend', cancel);

    function resetForm() {
      form.reset();
      editingId = null;
      setThumbPreview(null);
      submit.textContent = submitLabel;
      cancel.style.display = 'none';
    }

    cancel.addEventListener('click', resetForm);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('post-title').value;
      const tag = $('post-tag').value;
      const videoUrl = $('post-video').value.trim();
      const readTime = $('post-read').value;
      const summary = $('post-summary').value;
      const content = contentField.value;

      if (videoUrl && !/^https:\/\//i.test(videoUrl)) {
        alert('Video URL must start with https://');
        return;
      }

      const file = thumbInput.files && thumbInput.files[0];
      if (file) {
        const problem = GCM.thumbnails.check(file);
        if (problem) {
          alert(problem);
          return;
        }
      }

      submit.disabled = true;
      let newPath = null;
      try {
        if (file) newPath = await GCM.admin.uploadThumbnail(file);
        try {
          if (editingId) {
            const fields = {
              title: title.trim(),
              tag: tag.trim(),
              summary: summary.trim(),
              content: content.trim() || null,
              video_url: videoUrl || null,
              read_time: readTime.trim() || null,
            };
            if (newPath) fields.thumbnail_path = newPath;
            else if (thumbRemove && thumbRemove.checked) fields.thumbnail_path = null;
            await GCM.admin.updatePost(editingId, fields);
            if ((newPath || fields.thumbnail_path === null) && editingThumb) await GCM.admin.removeThumbnail(editingThumb);
            alert('Transmission updated.');
          } else {
            await GCM.admin.createPost({ title, summary, content, tag, videoUrl, readTime, thumbnailPath: newPath });
            alert('Transmission broadcast to the network.');
          }
        } catch (saveErr) {
          if (newPath) await GCM.admin.removeThumbnail(newPath);
          throw saveErr;
        }
        resetForm();
        await loadPosts();
      } catch (err) {
        console.error('Save failed:', err);
        const reason = err && err.code === '23505' ? 'A transmission with that title already exists.'
          : err && err.code === '23514' ? 'Summary must be 300 characters or less.'
          : 'Failed to save transmission.';
        alert(reason);
      } finally {
        submit.disabled = false;
      }
    });

    bindTable('posts-table-body', async (action, id) => {
      if (action === 'edit') {
        const post = await GCM.admin.getPost(id);
        if (!post) return;
        editingId = id;
        $('post-title').value = post.title;
        $('post-tag').value = post.tag || '';
        $('post-video').value = post.video_url || '';
        $('post-read').value = post.read_time || '';
        $('post-summary').value = post.summary;
        contentField.value = post.content || '';
        updateCounter();
        thumbInput.value = '';
        setThumbPreview(post.thumbnail_path);
        submit.textContent = 'Save Changes \u2192';
        cancel.style.display = 'inline-block';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (!confirm('Delete this transmission and all its comments?')) return;
      const doomed = postsById[id];
      await GCM.admin.deletePost(id);
      if (doomed && doomed.thumbnail_path) await GCM.admin.removeThumbnail(doomed.thumbnail_path);
      if (editingId === id) resetForm();
      await loadPosts();
    });

    bindTable('comments-table-body', async (action, id) => {
      if (!confirm('Remove this comment?')) return;
      await GCM.admin.deleteComment(id);
      await loadComments();
    });

    bindTable('users-table-body', async (action, id) => {
      if (!confirm('Revoke this user / waitlist entry?')) return;
      await GCM.admin.deleteUser(id);
      await loadUsers();
    });

    Promise.all([loadPosts(), loadComments(), loadUsers()]);
    watch('posts', loadPosts);
    watch('comments', loadComments);
    watch('users', loadUsers);
  }

  window.addEventListener('gcm:admin-ready', init, { once: true });
})();
