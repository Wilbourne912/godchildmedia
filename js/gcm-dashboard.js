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

      if (videoUrl && !/^https:\/\//i.test(videoUrl)) {
        alert('Video URL must start with https://');
        return;
      }

      submit.disabled = true;
      try {
        if (editingId) {
          await GCM.admin.updatePost(editingId, {
            title: title.trim(),
            tag: tag.trim(),
            summary: summary.trim(),
            video_url: videoUrl || null,
            read_time: readTime.trim() || null,
          });
          alert('Transmission updated.');
        } else {
          await GCM.admin.createPost({ title, summary, tag, videoUrl, readTime });
          alert('Transmission broadcast to the network.');
        }
        resetForm();
        await loadPosts();
      } catch (err) {
        console.error('Save failed:', err);
        alert(err && err.code === '23505' ? 'A transmission with that title already exists.' : 'Failed to save transmission.');
      } finally {
        submit.disabled = false;
      }
    });

    bindTable('posts-table-body', async (action, id) => {
      if (action === 'edit') {
        const post = postsById[id];
        if (!post) return;
        editingId = id;
        $('post-title').value = post.title;
        $('post-tag').value = post.tag || '';
        $('post-video').value = post.video_url || '';
        $('post-read').value = post.read_time || '';
        $('post-summary').value = post.summary;
        submit.textContent = 'Save Changes \u2192';
        cancel.style.display = 'inline-block';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (!confirm('Delete this transmission and all its comments?')) return;
      await GCM.admin.deletePost(id);
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
