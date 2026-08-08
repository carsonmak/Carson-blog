const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);

function now() {
  return new Date().toISOString();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function textEncoder() {
  return new TextEncoder();
}

function base64UrlEncode(input) {
  let bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return crypto.subtle.sign('HMAC', key, textEncoder().encode(text));
}

async function signToken(payload, env, ttlSeconds) {
  const secret = env.JWT_SECRET || 'wechat-blog-cloudflare-secret';
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const head = base64UrlEncode(textEncoder().encode(JSON.stringify(header)));
  const data = base64UrlEncode(textEncoder().encode(JSON.stringify(body)));
  const signature = base64UrlEncode(await hmacSha256(secret, `${head}.${data}`));
  return `${head}.${data}.${signature}`;
}

async function verifyToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const secret = env.JWT_SECRET || 'wechat-blog-cloudflare-secret';
  const expected = base64UrlEncode(await hmacSha256(secret, `${parts[0]}.${parts[1]}`));
  if (expected !== parts[2]) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function defaultDB() {
  const created = now();
  return {
    posts: [
      {
        id: '1',
        title: '欢迎使用微信风格博客',
        summary: '一个简洁优雅的博客系统，灵感来源于微信的经典设计语言。',
        content: '<p>这是一个采用微信设计风格的博客系统。</p><h2>主要特性</h2><ul><li>简洁清新的界面设计</li><li>完整的后台管理系统</li><li>文章的增删改查</li><li>分类与标签管理</li><li>响应式布局，适配移动端</li></ul><p>Cloudflare 版本使用 D1 保存数据，R2 保存上传图片，管理员账号密码由部署环境变量设置。</p>',
        cover: '',
        author: 'Admin',
        category: '公告',
        tags: ['教程', '公告'],
        createdAt: created,
        updatedAt: created,
        views: 0,
        published: true,
        pinned: false,
        announcement: false,
      showOnHome: true,
      reviewStatus: 'approved'
      }
    ],
    categories: ['公告', '技术', '生活', '随笔'],
    tags: ['教程', '公告', '写作', '技术', '前端', '趋势', '生活', '随笔'],
    friends: [],
    users: [],
    comments: [],
    settings: {
      siteName: 'CARSON',
      description: 'CARSON 的个人博客，记录文章、朋友与留言反馈。',
      logo: '',
      footerText: '',
      about: {
        kicker: 'About',
        title: '关于本站',
        summary: '这是一个微信风格的轻量博客系统，专注于文章发布、内容阅读和简单后台管理。',
        content: '<section class="about-card"><h2>设计理念</h2><p>本站延续微信式的简洁风格，让读者把注意力放在内容本身。</p></section>'
      },
      commentSettings: {
        blockedKeywords: [],
        homepagePageSize: 5,
        postPageSize: 10
      }
    }
  };
}

function migrateDB(db) {
  db.posts = Array.isArray(db.posts) ? db.posts : [];
  db.categories = Array.isArray(db.categories) ? db.categories : ['公告', '技术', '生活', '随笔'];
  db.tags = Array.isArray(db.tags) ? db.tags : [];
  db.friends = Array.isArray(db.friends) ? db.friends : [];
  db.users = Array.isArray(db.users) ? db.users : [];
  db.comments = Array.isArray(db.comments) ? db.comments : [];
  db.settings = db.settings || {};
  db.settings.siteName = db.settings.siteName || 'CARSON';
  db.settings.description = db.settings.description || 'CARSON 的个人博客，记录文章、朋友与留言反馈。';
  db.settings.logo = db.settings.logo || '';
  db.settings.footerText = db.settings.footerText || '';
  db.settings.about = db.settings.about || {
    kicker: 'About',
    title: '关于本站',
    summary: '',
    content: ''
  };
  db.settings.commentSettings = normalizeCommentSettings(db.settings.commentSettings || {});
  db.posts = db.posts.map(post => ({
    pinned: false,
    announcement: false,
    showOnHome: true,
    ...post,
    published: post.published !== false,
    reviewStatus: post.reviewStatus || (post.submittedBy ? (post.published ? 'approved' : 'pending') : 'approved')
  }));
  db.friends = db.friends.map(friend => ({
    status: 'approved',
    visible: true,
    iconUrl: '',
    createdAt: now(),
    updatedAt: now(),
    ...friend
  }));
  return db;
}

async function loadDB(env) {
  if (!env.DB) throw new Error('缺少 D1 绑定 DB');
  const row = await env.DB.prepare('SELECT data FROM app_data WHERE key = ?').bind('main').first();
  if (row && row.data) return migrateDB(JSON.parse(row.data));
  const db = defaultDB();
  await saveDB(env, db);
  return db;
}

async function saveDB(env, db) {
  await env.DB.prepare(
    'INSERT INTO app_data (key, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
  ).bind('main', JSON.stringify(db), now()).run();
}

function sortPostsForList(posts) {
  return posts.slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function normalizeUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return 'https://' + value;
}

function escapeUserContent(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

function normalizeCommentSettings(settings = {}) {
  const homepagePageSize = Math.max(1, Math.min(100, Number(settings.homepagePageSize) || 5));
  const postPageSize = Math.max(1, Math.min(100, Number(settings.postPageSize) || 10));
  const source = Array.isArray(settings.blockedKeywords)
    ? settings.blockedKeywords
    : String(settings.blockedKeywords || '').split(/[\n,，]/);
  return {
    blockedKeywords: source.map(item => String(item || '').trim()).filter(Boolean),
    homepagePageSize,
    postPageSize
  };
}

function sanitizePublicComment(comment) {
  const { matchedKeywords, ip, ...safe } = comment;
  return safe;
}

function getCommentTargetTitle(db, comment) {
  if (comment.targetType === 'home') return '网站主页留言区';
  const post = db.posts.find(item => String(item.id) === String(comment.postId));
  return post ? post.title : '文章留言区';
}

function requestPath(url) {
  return new URL(url).pathname.replace(/\/+$/, '') || '/';
}

async function readJSON(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

async function readForm(request) {
  try {
    return await request.formData();
  } catch (e) {
    return new FormData();
  }
}

function formString(form, key, fallback = '') {
  const value = form.get(key);
  return value === null || value === undefined ? fallback : String(value);
}

async function requireAuth(request, env) {
  const user = await verifyToken(request, env);
  if (!user) return null;
  return user;
}

async function requireFrontUser(request, env) {
  const user = await verifyToken(request, env);
  if (!user || user.type !== 'user') return null;
  return user;
}

async function putUpload(env, file, prefix, maxBytes) {
  if (!file || typeof file.arrayBuffer !== 'function') return '';
  if (file.size > maxBytes) throw new Error(maxBytes >= 5 * 1024 * 1024 ? '文章图片不能大于 5MB' : '图片不能大于 1MB');
  if (!IMAGE_TYPES.has(file.type)) throw new Error('仅支持 PNG、JPG、GIF、WEBP、SVG 图片');
  const extMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  };
  const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}${extMap[file.type] || '.png'}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name || '' }
  });
  return `/uploads/${key}`;
}

async function handleAuth(request, env, path, method) {
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJSON(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const adminUser = env.ADMIN_USERNAME || 'admin';
    const adminPass = env.ADMIN_PASSWORD || 'admin123';
    if (username !== adminUser || password !== adminPass) return error('用户名或密码错误', 401);
    const token = await signToken({ username, role: 'admin' }, env, 24 * 3600);
    return json({ token, username });
  }
  if (path === '/api/auth/verify' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('登录令牌无效', 401);
    return json({ valid: true, username: user.username });
  }
  return null;
}

async function handleUsers(request, env, path, method) {
  if (path === '/api/user/register' && method === 'POST') {
    const db = await loadDB(env);
    const body = await readJSON(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return error('用户名和密码不能为空');
    if (username.length < 3) return error('用户名至少需要 3 个字符');
    if (password.length < 6) return error('密码至少需要 6 位');
    if (db.users.some(user => user.username === username)) return error('用户名已存在');
    const salt = crypto.randomUUID();
    const user = { id: Date.now().toString(), username, password: await sha256(`${salt}:${password}`), salt, createdAt: now() };
    db.users.push(user);
    await saveDB(env, db);
    const token = await signToken({ username, type: 'user' }, env, 7 * 24 * 3600);
    return json({ token, username }, 201);
  }
  if (path === '/api/user/login' && method === 'POST') {
    const db = await loadDB(env);
    const body = await readJSON(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (username === (env.ADMIN_USERNAME || 'admin') && password === (env.ADMIN_PASSWORD || 'admin123')) {
      const token = await signToken({ username, type: 'user', role: 'admin' }, env, 7 * 24 * 3600);
      return json({ token, username });
    }
    const user = db.users.find(item => item.username === username);
    if (!user || user.password !== await sha256(`${user.salt || ''}:${password}`)) return error('用户名或密码错误', 401);
    const token = await signToken({ username, type: 'user' }, env, 7 * 24 * 3600);
    return json({ token, username });
  }
  if (path === '/api/user/me' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.type !== 'user') return error('未登录', 401);
    return json({ username: user.username });
  }
  if (path === '/api/user/submissions' && method === 'GET') {
    const user = await requireFrontUser(request, env);
    if (!user) return error('请先登录前台账号', 401);
    const db = await loadDB(env);
    const list = db.posts
      .filter(post => post.submittedBy === user.username)
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
      .map(({ content, ...rest }) => rest);
    return json(list);
  }
  if (path === '/api/user/submissions' && method === 'POST') {
    const user = await requireFrontUser(request, env);
    if (!user) return error('请先登录前台账号', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    const title = String(body.title || '').trim();
    const summary = String(body.summary || '').trim();
    const content = String(body.content || '').trim();
    const category = String(body.category || '投稿').trim() || '投稿';
    const rawTags = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(/[,，]/);
    const tags = rawTags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 8);
    if (!title) return error('投稿标题不能为空');
    if (!content) return error('投稿正文不能为空');
    if (title.length > 80) return error('标题不能超过 80 个字符');
    if (summary.length > 300) return error('摘要不能超过 300 个字符');
    if (content.length > 20000) return error('正文不能超过 20000 个字符');
    const post = {
      id: Date.now().toString() + '-' + crypto.randomUUID().slice(0, 8),
      title,
      summary,
      content: escapeUserContent(content),
      cover: '',
      author: user.username,
      category,
      tags,
      createdAt: now(),
      updatedAt: now(),
      views: 0,
      published: false,
      pinned: false,
      announcement: false,
      showOnHome: true,
      reviewStatus: 'pending',
      submittedBy: user.username,
      submittedAt: now(),
      reviewedAt: '',
      reviewer: '',
      rejectionReason: ''
    };
    db.posts.push(post);
    if (!db.categories.includes(category)) db.categories.push(category);
    tags.forEach(tag => { if (tag && !db.tags.includes(tag)) db.tags.push(tag); });
    await saveDB(env, db);
    const { content: _content, ...safe } = post;
    return json({ message: '投稿已提交，请等待管理员审核', submission: safe }, 201);
  }
  return null;
}

async function handlePosts(request, env, path, method, url) {
  const publicPost = path.match(/^\/api\/posts\/([^/]+)$/);
  const adminPost = path.match(/^\/api\/admin\/posts\/([^/]+)$/);

  if (path === '/api/posts' && method === 'GET') {
    const db = await loadDB(env);
    const category = url.searchParams.get('category');
    const tag = url.searchParams.get('tag');
    const search = url.searchParams.get('search');
    const home = url.searchParams.get('home');
    let posts = db.posts.filter(p => p.published && !p.announcement);
    if (home === '1' || home === 'true') posts = posts.filter(p => p.showOnHome === true);
    if (category) posts = posts.filter(p => p.category === category);
    if (tag) posts = posts.filter(p => (p.tags || []).includes(tag));
    if (search) {
      const kw = search.toLowerCase();
      posts = posts.filter(p => String(p.title || '').toLowerCase().includes(kw) || String(p.summary || '').toLowerCase().includes(kw) || String(p.content || '').toLowerCase().includes(kw));
    }
    return json(sortPostsForList(posts).map(({ content, ...rest }) => rest));
  }

  if (path === '/api/announcements' && method === 'GET') {
    const db = await loadDB(env);
    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit')) || 5));
    const posts = sortPostsForList(db.posts.filter(p => p.published && p.announcement)).slice(0, limit);
    return json(posts.map(({ content, ...rest }) => rest));
  }

  if (publicPost && method === 'GET') {
    const db = await loadDB(env);
    const post = db.posts.find(p => String(p.id) === decodeURIComponent(publicPost[1]));
    if (!post || !post.published) return error('文章不存在', 404);
    post.views = Number(post.views || 0) + 1;
    await saveDB(env, db);
    return json(post);
  }

  if (path === '/api/admin/posts' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    return json(sortPostsForList(db.posts).map(({ content, ...rest }) => rest));
  }

  if (adminPost && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const post = db.posts.find(p => String(p.id) === decodeURIComponent(adminPost[1]));
    if (!post) return error('文章不存在', 404);
    return json(post);
  }

  if (path === '/api/admin/posts' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    if (!body.title || !body.content) return error('标题和内容不能为空');
    const post = {
      id: Date.now().toString(),
      title: body.title,
      summary: body.summary || '',
      content: body.content,
      cover: body.cover || '',
      author: body.author || user.username || 'Admin',
      category: body.category || '未分类',
      tags: Array.isArray(body.tags) ? body.tags : [],
      createdAt: now(),
      updatedAt: now(),
      views: 0,
      published: body.published !== undefined ? !!body.published : true,
      pinned: !!body.pinned,
      announcement: !!body.announcement,
      showOnHome: !!body.showOnHome,
      reviewStatus: 'approved'
    };
    db.posts.push(post);
    if (post.category && !db.categories.includes(post.category)) db.categories.push(post.category);
    post.tags.forEach(tag => { if (tag && !db.tags.includes(tag)) db.tags.push(tag); });
    await saveDB(env, db);
    return json(post, 201);
  }

  if (adminPost && method === 'PUT') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const id = decodeURIComponent(adminPost[1]);
    const idx = db.posts.findIndex(p => String(p.id) === id);
    if (idx === -1) return error('文章不存在', 404);
    const body = await readJSON(request);
    const current = db.posts[idx];
    db.posts[idx] = {
      ...current,
      title: body.title !== undefined ? body.title : current.title,
      summary: body.summary !== undefined ? body.summary : current.summary,
      content: body.content !== undefined ? body.content : current.content,
      cover: body.cover !== undefined ? body.cover : current.cover,
      author: body.author !== undefined ? body.author : current.author,
      category: body.category !== undefined ? body.category : current.category,
      tags: body.tags !== undefined ? body.tags : current.tags,
      published: body.published !== undefined ? !!body.published : current.published,
      pinned: body.pinned !== undefined ? !!body.pinned : !!current.pinned,
      announcement: body.announcement !== undefined ? !!body.announcement : !!current.announcement,
      showOnHome: body.showOnHome !== undefined ? !!body.showOnHome : current.showOnHome === true,
      updatedAt: now()
    };
    if (db.posts[idx].category && !db.categories.includes(db.posts[idx].category)) db.categories.push(db.posts[idx].category);
    (db.posts[idx].tags || []).forEach(tag => { if (tag && !db.tags.includes(tag)) db.tags.push(tag); });
    await saveDB(env, db);
    return json(db.posts[idx]);
  }

  if (adminPost && method === 'DELETE') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const idx = db.posts.findIndex(p => String(p.id) === decodeURIComponent(adminPost[1]));
    if (idx === -1) return error('文章不存在', 404);
    db.posts.splice(idx, 1);
    await saveDB(env, db);
    return json({ message: '删除成功' });
  }

  if (path === '/api/admin/uploads/images' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const form = await readForm(request);
    const urlPath = await putUpload(env, form.get('image'), 'articles', 5 * 1024 * 1024);
    if (!urlPath) return error('请先选择要上传的图片');
    return json({ url: urlPath, html: `<p><img src="${urlPath}" alt="文章图片"></p>` }, 201);
  }

  return null;
}

async function handleSubmissions(request, env, path, method, url) {
  const statusMatch = path.match(/^\/api\/admin\/submissions\/([^/]+)\/status$/);
  if (path === '/api/admin/submissions' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const status = String(url.searchParams.get('status') || '').trim();
    let submissions = db.posts.filter(post => post.submittedBy || ['pending', 'approved', 'rejected'].includes(post.reviewStatus));
    if (['pending', 'approved', 'rejected'].includes(status)) {
      submissions = submissions.filter(post => (post.reviewStatus || (post.published ? 'approved' : 'pending')) === status);
    }
    return json(submissions
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
      .map(({ content, ...rest }) => rest));
  }
  if (statusMatch && method === 'PATCH') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    const post = db.posts.find(item => String(item.id) === decodeURIComponent(statusMatch[1]));
    if (!post || !post.submittedBy) return error('投稿不存在', 404);
    const status = String(body.status || '').trim();
    if (!['pending', 'approved', 'rejected'].includes(status)) return error('审核状态无效');
    post.reviewStatus = status;
    post.published = status === 'approved';
    post.reviewedAt = now();
    post.reviewer = user.username || 'admin';
    post.rejectionReason = status === 'rejected' ? String(body.reason || '').trim() : '';
    post.updatedAt = now();
    await saveDB(env, db);
    return json(post);
  }
  return null;
}

async function handleMetaSettings(request, env, path, method) {
  if (path === '/api/meta' && method === 'GET') {
    const db = await loadDB(env);
    return json({ categories: db.categories, tags: db.tags });
  }
  if (path === '/api/settings' && method === 'GET') {
    const db = await loadDB(env);
    return json({
      siteName: db.settings.siteName || 'CARSON',
      description: db.settings.description || '',
      logo: db.settings.logo || '',
      footerText: db.settings.footerText || ''
    });
  }
  if (path === '/api/about' && method === 'GET') {
    const db = await loadDB(env);
    return json(db.settings.about || {});
  }
  if (path === '/api/admin/settings' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const form = await readForm(request);
    const logo = form.get('logo');
    const nextLogo = logo && typeof logo.arrayBuffer === 'function' && logo.size
      ? await putUpload(env, logo, 'site', 1024 * 1024)
      : db.settings.logo || '';
    db.settings = {
      ...db.settings,
      siteName: formString(form, 'siteName', db.settings.siteName || 'CARSON').trim() || 'CARSON',
      description: formString(form, 'description', '').trim(),
      footerText: formString(form, 'footerText', '').trim(),
      logo: nextLogo,
      updatedAt: now()
    };
    await saveDB(env, db);
    return json(db.settings);
  }
  if (path === '/api/admin/about' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    db.settings.about = {
      kicker: String(body.kicker || 'About').trim() || 'About',
      title: String(body.title || '关于本站').trim() || '关于本站',
      summary: String(body.summary || '').trim(),
      content: String(body.content || '')
    };
    db.settings.updatedAt = now();
    await saveDB(env, db);
    return json(db.settings.about);
  }
  return null;
}

async function handleCategories(request, env, path, method) {
  const match = path.match(/^\/api\/admin\/categories\/(.+)$/);
  if (path === '/api/admin/categories' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    return json((db.categories || []).map(name => ({
      name,
      postCount: db.posts.filter(post => post.category === name).length
    })));
  }
  if (path === '/api/admin/categories' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    const name = String(body.name || '').trim();
    if (!name) return error('分类名称不能为空');
    if (name.length > 30) return error('分类名称不能超过 30 个字符');
    if (db.categories.includes(name)) return error('分类已存在');
    db.categories.push(name);
    await saveDB(env, db);
    return json({ name, postCount: 0 }, 201);
  }
  if (match && method === 'PUT') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const oldName = decodeURIComponent(match[1]);
    const body = await readJSON(request);
    const newName = String(body.name || '').trim();
    if (!oldName || !db.categories.includes(oldName)) return error('分类不存在', 404);
    if (!newName) return error('新分类名称不能为空');
    if (newName !== oldName && db.categories.includes(newName)) return error('新分类名称已存在');
    db.categories = db.categories.map(item => item === oldName ? newName : item);
    db.posts = db.posts.map(post => post.category === oldName ? { ...post, category: newName, updatedAt: now() } : post);
    await saveDB(env, db);
    return json({ name: newName, postCount: db.posts.filter(post => post.category === newName).length });
  }
  if (match && method === 'DELETE') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const name = decodeURIComponent(match[1]);
    if (!name || !db.categories.includes(name)) return error('分类不存在', 404);
    if (db.posts.some(post => post.category === name)) return error('该分类下还有文章，不能删除。请先修改文章分类。');
    db.categories = db.categories.filter(item => item !== name);
    await saveDB(env, db);
    return json({ message: '删除成功' });
  }
  return null;
}

async function handleComments(request, env, path, method, url) {
  const statusMatch = path.match(/^\/api\/admin\/comments\/([^/]+)\/status$/);
  const deleteMatch = path.match(/^\/api\/admin\/comments\/([^/]+)$/);
  if (path === '/api/comments' && method === 'GET') {
    const db = await loadDB(env);
    const settings = normalizeCommentSettings(db.settings.commentSettings);
    const targetType = url.searchParams.get('targetType') === 'post' ? 'post' : 'home';
    const postId = String(url.searchParams.get('postId') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || (targetType === 'home' ? settings.homepagePageSize : settings.postPageSize)));
    let comments = db.comments.filter(comment => comment.status === 'approved' && comment.targetType === targetType);
    if (targetType === 'post') comments = comments.filter(comment => String(comment.postId || '') === postId);
    comments = comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = comments.length;
    const start = (page - 1) * limit;
    return json({ comments: comments.slice(start, start + limit).map(sanitizePublicComment), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  }
  if (path === '/api/comments' && method === 'POST') {
    const db = await loadDB(env);
    const settings = normalizeCommentSettings(db.settings.commentSettings);
    const body = await readJSON(request);
    const user = await verifyToken(request, env);
    const targetType = body.targetType === 'post' ? 'post' : 'home';
    const postId = String(body.postId || '').trim();
    const content = String(body.content || '').trim();
    const authorName = user?.username || String(body.authorName || '').trim() || '游客';
    if (!content) return error('留言内容不能为空');
    if (content.length > 1000) return error('留言内容不能超过 1000 字');
    if (targetType === 'post' && !db.posts.find(item => String(item.id) === postId && item.published)) return error('文章不存在，无法留言', 404);
    const matchedKeywords = settings.blockedKeywords.filter(keyword => content.toLowerCase().includes(String(keyword).toLowerCase()));
    const comment = {
      id: Date.now().toString() + '-' + crypto.randomUUID().slice(0, 8),
      targetType,
      postId: targetType === 'post' ? postId : '',
      authorName,
      content,
      status: matchedKeywords.length ? 'pending' : 'approved',
      matchedKeywords,
      ip: request.headers.get('CF-Connecting-IP') || '',
      createdAt: now(),
      updatedAt: now()
    };
    db.comments.push(comment);
    await saveDB(env, db);
    return json({ message: comment.status === 'pending' ? '留言已提交，需管理员审核后显示' : '留言发布成功', comment: sanitizePublicComment(comment) }, 201);
  }
  if (path === '/api/admin/comments' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const status = String(url.searchParams.get('status') || '').trim();
    const targetType = String(url.searchParams.get('targetType') || '').trim();
    let comments = db.comments || [];
    if (['pending', 'approved', 'rejected'].includes(status)) comments = comments.filter(comment => comment.status === status);
    if (['home', 'post'].includes(targetType)) comments = comments.filter(comment => comment.targetType === targetType);
    return json(comments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(comment => ({ ...comment, targetTitle: getCommentTargetTitle(db, comment) })));
  }
  if (statusMatch && method === 'PATCH') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    const comment = db.comments.find(item => String(item.id) === decodeURIComponent(statusMatch[1]));
    if (!comment) return error('留言不存在', 404);
    if (!['pending', 'approved', 'rejected'].includes(body.status)) return error('状态无效');
    comment.status = body.status;
    comment.updatedAt = now();
    await saveDB(env, db);
    return json(comment);
  }
  if (deleteMatch && method === 'DELETE') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const idx = db.comments.findIndex(item => String(item.id) === decodeURIComponent(deleteMatch[1]));
    if (idx === -1) return error('留言不存在', 404);
    db.comments.splice(idx, 1);
    await saveDB(env, db);
    return json({ message: '删除成功' });
  }
  if (path === '/api/admin/comment-settings' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    return json(normalizeCommentSettings(db.settings.commentSettings));
  }
  if (path === '/api/admin/comment-settings' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    db.settings.commentSettings = normalizeCommentSettings(body);
    db.settings.updatedAt = now();
    await saveDB(env, db);
    return json(db.settings.commentSettings);
  }
  return null;
}

async function handleFriends(request, env, path, method) {
  const adminMatch = path.match(/^\/api\/admin\/friends\/([^/]+)$/);
  const statusMatch = path.match(/^\/api\/admin\/friends\/([^/]+)\/status$/);
  if (path === '/api/friends' && method === 'GET') {
    const db = await loadDB(env);
    return json(db.friends.filter(friend => friend.status === 'approved' && friend.visible !== false).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }
  if (path === '/api/friends' && method === 'POST') {
    const db = await loadDB(env);
    const form = await readForm(request);
    const name = formString(form, 'name').trim();
    const url = normalizeUrl(formString(form, 'url'));
    const iconUrl = normalizeUrl(formString(form, 'iconUrl'));
    if (!name || !url) return error('站点名称和链接不能为空');
    try { new URL(url); if (iconUrl) new URL(iconUrl); } catch (e) { return error('请输入有效的链接地址'); }
    const avatar = await putUpload(env, form.get('avatar'), 'friends', 1024 * 1024).catch(() => '');
    const friend = {
      id: Date.now().toString(),
      name,
      url,
      description: formString(form, 'description').trim() || '这个朋友还没有留下签名',
      avatar,
      iconUrl,
      status: 'pending',
      visible: false,
      createdAt: now(),
      updatedAt: now()
    };
    db.friends.push(friend);
    await saveDB(env, db);
    return json({ message: '友链已提交，请等待后台审核', friend }, 201);
  }
  if (path === '/api/admin/friends' && method === 'GET') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    return json(db.friends.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }
  if (path === '/api/admin/friends' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const form = await readForm(request);
    const name = formString(form, 'name').trim();
    const url = normalizeUrl(formString(form, 'url'));
    const iconUrl = normalizeUrl(formString(form, 'iconUrl'));
    if (!name || !url) return error('站点名称和链接不能为空');
    try { new URL(url); if (iconUrl) new URL(iconUrl); } catch (e) { return error('请输入有效的链接地址'); }
    const finalStatus = ['pending', 'approved', 'rejected'].includes(formString(form, 'status')) ? formString(form, 'status') : 'approved';
    const friend = {
      id: Date.now().toString(),
      name,
      url,
      description: formString(form, 'description').trim(),
      avatar: await putUpload(env, form.get('avatar'), 'friends', 1024 * 1024).catch(() => ''),
      iconUrl,
      status: finalStatus,
      visible: finalStatus === 'approved' && formString(form, 'visible') !== 'false',
      createdAt: now(),
      updatedAt: now()
    };
    db.friends.push(friend);
    await saveDB(env, db);
    return json(friend, 201);
  }
  if (adminMatch && method === 'PUT') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const idx = db.friends.findIndex(friend => String(friend.id) === decodeURIComponent(adminMatch[1]));
    if (idx === -1) return error('友链不存在', 404);
    const current = db.friends[idx];
    const form = await readForm(request);
    const nextStatus = ['pending', 'approved', 'rejected'].includes(formString(form, 'status')) ? formString(form, 'status') : current.status;
    const uploadedAvatar = await putUpload(env, form.get('avatar'), 'friends', 1024 * 1024).catch(() => '');
    const next = {
      ...current,
      name: form.has('name') ? formString(form, 'name').trim() : current.name,
      url: form.has('url') ? normalizeUrl(formString(form, 'url')) : current.url,
      description: form.has('description') ? formString(form, 'description').trim() : current.description,
      avatar: uploadedAvatar || current.avatar,
      iconUrl: form.has('iconUrl') ? normalizeUrl(formString(form, 'iconUrl')) : current.iconUrl,
      status: nextStatus,
      visible: nextStatus === 'approved' && formString(form, 'visible', String(current.visible)) !== 'false',
      updatedAt: now()
    };
    try { if (next.url) new URL(next.url); if (next.iconUrl) new URL(next.iconUrl); } catch (e) { return error('请输入有效的链接地址'); }
    db.friends[idx] = next;
    await saveDB(env, db);
    return json(next);
  }
  if (statusMatch && method === 'PATCH') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const body = await readJSON(request);
    const friend = db.friends.find(item => String(item.id) === decodeURIComponent(statusMatch[1]));
    if (!friend) return error('友链不存在', 404);
    if (!['pending', 'approved', 'rejected'].includes(body.status)) return error('状态无效');
    friend.status = body.status;
    friend.visible = body.status === 'approved';
    friend.updatedAt = now();
    await saveDB(env, db);
    return json(friend);
  }
  if (adminMatch && method === 'DELETE') {
    const user = await requireAuth(request, env);
    if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
    const db = await loadDB(env);
    const idx = db.friends.findIndex(friend => String(friend.id) === decodeURIComponent(adminMatch[1]));
    if (idx === -1) return error('友链不存在', 404);
    db.friends.splice(idx, 1);
    await saveDB(env, db);
    return json({ message: '删除成功' });
  }
  return null;
}

async function handleStats(request, env, path, method) {
  if (path !== '/api/admin/stats' || method !== 'GET') return null;
  const user = await requireAuth(request, env);
  if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
  const db = await loadDB(env);
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const dateStr = date.toISOString().split('T')[0];
    last7Days.push({ date: dateStr, count: db.posts.filter(p => String(p.createdAt || '').split('T')[0] === dateStr).length });
  }
  return json({
    totalPosts: db.posts.length,
    publishedPosts: db.posts.filter(p => p.published).length,
    totalViews: db.posts.reduce((sum, p) => sum + Number(p.views || 0), 0),
    totalCategories: db.categories.length,
    totalTags: db.tags.length,
    draftPosts: db.posts.filter(p => !p.published).length,
    pendingSubmissions: db.posts.filter(p => p.submittedBy && (p.reviewStatus || 'pending') === 'pending').length,
    last7Days
  });
}

async function handleCache(request, env, path, method) {
  if (path !== '/api/admin/cache/stats' && path !== '/api/admin/cache/clear') return null;
  const user = await requireAuth(request, env);
  if (!user || user.role !== 'admin') return error('未登录或登录已过期', 401);
  if (path === '/api/admin/cache/stats' && method === 'GET') {
    return json({
      total: 0,
      expired: 0,
      active: 0,
      entries: [],
      mode: 'cloudflare',
      message: 'Cloudflare Worker 版本没有本地内存缓存；静态资源和边缘缓存由 Cloudflare 平台管理。'
    });
  }
  if (path === '/api/admin/cache/clear' && method === 'POST') {
    return json({
      message: 'Cloudflare 版本已接收清理请求。应用数据接口实时读取 D1；如需清理边缘缓存，请在 Cloudflare 控制台执行 Purge Cache。',
      cleared: 0,
      mode: 'cloudflare'
    });
  }
  return null;
}

async function handleUploadGet(env, path) {
  const key = decodeURIComponent(path.replace(/^\/uploads\//, ''));
  if (!key || !env.UPLOADS) return error('文件不存在', 404);
  const object = await env.UPLOADS.get(key);
  if (!object) return error('文件不存在', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

async function serveAsset(request, env, path) {
  if (!env.ASSETS) return error('静态资源绑定 ASSETS 未配置', 500);
  const url = new URL(request.url);
  if (path === '/') url.pathname = '/index.html';
  else if (path === '/admin') url.pathname = '/admin/index.html';
  else if (!/\.[a-z0-9]+$/i.test(path) && !path.startsWith('/api/') && !path.startsWith('/uploads/')) {
    url.pathname = `${path}.html`;
  }
  return env.ASSETS.fetch(new Request(url.toString(), request));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });
    const url = new URL(request.url);
    const path = requestPath(request.url);
    const method = request.method.toUpperCase();

    try {
      if (path.startsWith('/uploads/') && method === 'GET') return handleUploadGet(env, path);

      const handlers = [
        handleAuth,
        handleUsers,
        handlePosts,
        handleSubmissions,
        handleMetaSettings,
        handleCategories,
        handleComments,
        handleFriends,
        handleStats,
        handleCache
      ];

      for (const handler of handlers) {
        const response = await handler(request, env, path, method, url);
        if (response) return response;
      }

      if (path.startsWith('/api/')) return error('接口不存在', 404);
      return serveAsset(request, env, path);
    } catch (err) {
      return error(err.message || '服务器错误', 500);
    }
  }
};
