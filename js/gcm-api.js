(function () {
  const SUPABASE_URL = 'https://oobwtogzkvjgaghwpzxs.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYnd0b2d6a3ZqZ2FnaHdwenhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDk4NTUsImV4cCI6MjEwNzc4NTg1NX0.pbmQ1K1_XnbLdvyZinH0PYQ-dXhtp5XCuDIwMNxApeQ';

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const POST_COLUMNS = 'id, title, slug, summary, tag, video_url, read_time, created_at';

  const clean = (v) => String(v || '').trim();
  const normEmail = (v) => clean(v).toLowerCase();
  const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  const GCM = {
    db,

    slugify(title) {
      return clean(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
      async createPost({ title, summary, content, tag, videoUrl, readTime, slug }) {
        return unwrap(await db.from('posts').insert({
          title: clean(title),
          slug: clean(slug) || GCM.slugify(title),
          summary: clean(summary),
          content: clean(content) || null,
          tag: clean(tag),
          video_url: clean(videoUrl) || null,
          read_time: clean(readTime) || null,
        }).select().single());
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
