(function () {
  const SUPABASE_URL = 'https://oobwtogzkvjgaghwpzxs.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYnd0b2d6a3ZqZ2FnaHdwenhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDk4NTUsImV4cCI6MjEwNzc4NTg1NX0.pbmQ1K1_XnbLdvyZinH0PYQ-dXhtp5XCuDIwMNxApeQ';

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const POST_COLUMNS = 'id, title, slug, summary, tag, video_url, read_time, thumbnail_path, created_at';
  const THUMB_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const THUMB_MAX_BYTES = 2 * 1024 * 1024;

  const clean = (v) => String(v || '').trim();
  const normEmail = (v) => clean(v).toLowerCase();
  const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  function youtubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return null;
      const host = u.hostname.replace(/^www\./, '');
      let id = null;
      if (host === 'youtu.be') {
        id = u.pathname.slice(1);
      } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
      }
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch (err) {
      return null;
    }
  }

  function newFileName(ext) {
    const id = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return id + '.' + ext;
  }

  const GCM = {
    db,

    slugify(title) {
      return clean(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },

    thumbnails: {
      url(path) {
        return path ? db.storage.from('thumbnails').getPublicUrl(path).data.publicUrl : null;
      },
      check(file) {
        if (!THUMB_TYPES[file.type]) return 'Thumbnail must be a JPG, PNG or WebP image.';
        if (file.size > THUMB_MAX_BYTES) return 'Thumbnail must be 2 MB or smaller.';
        return null;
      },
      forPost(post) {
        if (post.thumbnail_path) return GCM.thumbnails.url(post.thumbnail_path);
        const id = youtubeId(post.video_url);
        return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : null;
      },
    },

    posts: {
      async list(limit = 50) {
        return unwrap(await db.from('posts').select(POST_COLUMNS).order('created_at', { ascending: false }).limit(limit));
      },
      async latest() {
        return unwrap(await db.from('posts').select(POST_COLUMNS).order('created_at', { ascending: false }).limit(1).maybeSingle());
      },
      async bySlug(slug) {
        return unwrap(await db.from('posts').select('*').eq('slug', slug).maybeSingle());
      },
    },

    comments: {
      async list(postId) {
        return unwrap(await db.from('comments_public').select('*').eq('post_id', postId).order('created_at', { ascending: false }));
      },
      async submit({ postId, email, content, reaction }) {
        const { error } = await db.from('comments').insert({
          post_id: postId,
          user_email: normEmail(email),
          content: clean(content),
          reaction_type: reaction || null,
        });
        if (error) {
          if (error.code === '23514') return { ok: false, reason: 'invalid' };
          throw error;
        }
        return { ok: true };
      },
      watch(postId, callback, intervalMs = 15000) {
        const tick = async () => callback(await GCM.comments.list(postId));
        tick();
        const timer = setInterval(tick, intervalMs);
        return () => clearInterval(timer);
      },
    },

    waitlist: {
      async join(email) {
        const { error } = await db.from('users').insert({ email: normEmail(email) });
        if (!error) return { ok: true, duplicate: false };
        if (error.code === '23505') return { ok: true, duplicate: true };
        if (error.code === '23514') return { ok: false, reason: 'invalid' };
        throw error;
      },
    },

    auth: {
      async signIn(email, password) {
        return unwrap(await db.auth.signInWithPassword({ email: normEmail(email), password }));
      },
      async signOut() {
        await db.auth.signOut();
      },
      async session() {
        const { data } = await db.auth.getSession();
        return data.session;
      },
      async isAdmin() {
        const session = await GCM.auth.session();
        if (!session) return false;
        const { data, error } = await db.rpc('is_admin');
        return !error && data === true;
      },
      async requireAdmin(redirectTo = '/') {
        if (!(await GCM.auth.isAdmin())) {
          window.location.replace(redirectTo);
          return false;
        }
        return true;
      },
    },

    admin: {
      async createPost({ title, summary, content, tag, videoUrl, readTime, slug, thumbnailPath }) {
        return unwrap(await db.from('posts').insert({
          title: clean(title),
          slug: clean(slug) || GCM.slugify(title),
          summary: clean(summary),
          content: clean(content) || null,
          thumbnail_path: clean(thumbnailPath) || null,
          tag: clean(tag),
          video_url: clean(videoUrl) || null,
          read_time: clean(readTime) || null,
        }).select().single());
      },
      async uploadThumbnail(file) {
        const ext = THUMB_TYPES[file.type];
        if (!ext) throw new Error('Unsupported thumbnail type');
        const name = newFileName(ext);
        const { error } = await db.storage.from('thumbnails').upload(name, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '31536000',
        });
        if (error) throw error;
        return name;
      },
      async removeThumbnail(path) {
        if (!path) return;
        const { error } = await db.storage.from('thumbnails').remove([path]);
        if (error) console.warn('Thumbnail cleanup failed:', error.message);
      },
      async getPost(id) {
        return unwrap(await db.from('posts').select('*').eq('id', id).single());
      },
      async updatePost(id, fields) {
        return unwrap(await db.from('posts').update(fields).eq('id', id).select().single());
      },
      async deletePost(id) {
        unwrap(await db.from('posts').delete().eq('id', id));
      },
      async listComments() {
        return unwrap(await db.from('comments').select('*, posts(title, slug)').order('created_at', { ascending: false }).limit(200));
      },
      async deleteComment(id) {
        unwrap(await db.from('comments').delete().eq('id', id));
      },
      async listUsers() {
        return unwrap(await db.from('users').select('*').order('created_at', { ascending: false }).limit(500));
      },
      async updateUser(id, fields) {
        return unwrap(await db.from('users').update(fields).eq('id', id).select().single());
      },
      async deleteUser(id) {
        unwrap(await db.from('users').delete().eq('id', id));
      },
    },

    subscribe(table, handler) {
      const channel = db
        .channel('gcm-' + table + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table }, handler)
        .subscribe();
      return () => db.removeChannel(channel);
    },
  };

  window.GCM = GCM;
})();
