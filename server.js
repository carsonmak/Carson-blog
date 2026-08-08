const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ============ 缓存层 ============
// 简单内存缓存：缓存前台只读 API 响应，写操作自动清除对应缓存
const apiCache = new Map();
const CACHE_TTL = 60 * 1000; // 默认缓存 60 秒

function getCacheKey(req) {
  return req.method + ':' + req.originalUrl;
}

function setCache(key, data) {
  apiCache.set(key, { data: JSON.parse(JSON.stringify(data)), expireAt: Date.now() + CACHE_TTL });
}

function getCache(key) {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    apiCache.delete(key);
    return null;
  }
  return entry.data;
}

function clearCache(pattern) {
  if (!pattern) {
    const count = apiCache.size;
    apiCache.clear();
    return count;
  }
  let count = 0;
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
      count++;
    }
  }
  return count;
}

function getCacheStats() {
  let total = apiCache.size;
  let expired = 0;
  const now = Date.now();
  const keys = [];
  for (const [key, entry] of apiCache.entries()) {
    if (now > entry.expireAt) expired++;
    keys.push({ key, expireIn: Math.max(0, entry.expireAt - now) });
  }
  return { total, expired, active: total - expired, entries: keys.slice(0, 50) };
}

// 缓存中间件：仅缓存 GET 请求且白名单内的前台路由
const cacheWhitelist = [
  '/api/posts',
  '/api/announcements',
  '/api/meta',
  '/api/settings',
  '/api/about',
  '/api/friends',
  '/api/comments'
];

function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();
  const isWhitelisted = cacheWhitelist.some(function (p) {
    return req.path === p || req.path.startsWith(p + '?') || (p === '/api/comments' && req.path === '/api/comments');
  });
  if (!isWhitelisted) return next();
  const key = getCacheKey(req);
  const cached = getCache(key);
  if (cached) {
    return res.json(cached);
  }
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    try { setCache(key, data); } catch (e) {}
    return originalJson(data);
  };
  next();
}

app.use(cacheMiddleware);

// ============ 数据层 ============
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const FRIEND_AVATAR_DIR = path.join(UPLOAD_DIR, 'friends');
const SITE_LOGO_DIR = path.join(UPLOAD_DIR, 'site');
const ARTICLE_IMAGE_DIR = path.join(UPLOAD_DIR, 'articles');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(FRIEND_AVATAR_DIR)) fs.mkdirSync(FRIEND_AVATAR_DIR, { recursive: true });
if (!fs.existsSync(SITE_LOGO_DIR)) fs.mkdirSync(SITE_LOGO_DIR, { recursive: true });
if (!fs.existsSync(ARTICLE_IMAGE_DIR)) fs.mkdirSync(ARTICLE_IMAGE_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultFriends = [
  {
    id: 'friend-1',
    name: '天真',
    url: 'https://bin.zmide.com/',
    description: '与君初识，宛如故人',
    avatar: 'https://aka.doubaocdn.com/s/gbD3baqMhI',
    status: 'approved',
    visible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'friend-2',
    name: 'ligen131',
    url: 'https://ligen.life/',
    description: "Don't worry, be happy.",
    avatar: 'https://aka.doubaocdn.com/s/b7lTvYK1dr',
    status: 'approved',
    visible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'friend-3',
    name: 'jyi2ya 的博客',
    url: 'https://jyi2ya.github.io/',
    description: 'Let me write C again and kill me.',
    avatar: 'https://aka.doubaocdn.com/s/1quPpCxtBk',
    status: 'approved',
    visible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'friend-4',
    name: 'Chales',
    url: 'https://www.n2ptr.space/',
    description: 'just a blog',
    avatar: 'https://aka.doubaocdn.com/s/1tCmUyEKIU',
    status: 'approved',
    visible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'friend-5',
    name: '笨蛋小破站',
    url: 'https://blog.obdo.cc/',
    description: 'May all the beauty be blessed.',
    avatar: 'https://aka.doubaocdn.com/s/A8Wn2YvWm2',
    status: 'approved',
    visible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      posts: [
        {
          id: '1',
          title: '欢迎使用微信风格博客',
          summary: '一个简洁优雅的博客系统，灵感来源于微信的经典设计语言。',
          content: '<p>这是一个采用微信设计风格的博客系统。</p><h2>主要特性</h2><ul><li>简洁清新的界面设计</li><li>完整的后台管理系统</li><li>文章的增删改查</li><li>分类与标签管理</li><li>响应式布局，适配移动端</li></ul><p>微信风格的核心在于「克制」——用最少的视觉元素传达最清晰的信息。绿色主色调 #07C160 带来活力感，大面积留白让内容呼吸。</p><h2>使用方法</h2><p>1. 访问首页查看博客文章列表</p><p>2. 点击文章标题查看详情</p><p>3. 访问 /admin 进入后台管理</p><p>4. 默认管理员账号：admin / admin123</p><p>开始你的博客之旅吧！</p>',
          cover: '',
          author: 'Admin',
          category: '公告',
          tags: ['教程', '公告'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          views: 128,
          published: true,
          pinned: false,
          announcement: false,
          showOnHome: true
        },
        {
          id: '2',
          title: '如何写出高质量的技术博客',
          summary: '分享技术写作的方法论，从选题到结构到表达，让你的文章更专业。',
          content: '<p>技术博客是开发者最好的名片。本文分享一些实用的写作技巧。</p><h2>选题策略</h2><p>好的选题是成功的一半。建议从以下角度切入：</p><ul><li>解决过的技术难题</li><li>新技术的实践总结</li><li>项目架构设计复盘</li><li>性能优化案例分析</li></ul><h2>结构设计</h2><p>一篇好的技术文章通常包含：问题背景、方案选型、实现细节、踩坑记录、总结展望。逻辑要清晰，让读者能够跟上你的思路。</p><h2>表达技巧</h2><p>多用图表和代码示例，少用大段文字。关键概念加粗强调，复杂流程配示意图。代码要可运行，附带注释说明。</p><p>坚持写作，量变终会引起质变。</p>',
          cover: '',
          author: 'Admin',
          category: '技术',
          tags: ['写作', '技术'],
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          views: 56,
          published: true,
          pinned: false,
          announcement: false,
          showOnHome: true
        },
        {
          id: '3',
          title: '2024年前端开发趋势展望',
          summary: '从框架演进到工具链变革，梳理前端生态的最新发展方向。',
          content: '<p>前端领域瞬息万变，让我们一起看看当前的发展趋势。</p><h2>框架层面</h2><p>React、Vue、Angular 三足鼎立，但 Svelte 和 Solid 等编译时框架正在崛起。服务端组件（RSC）正在改变前端的开发范式。</p><h2>工具链</h2><p>Vite 已成为新一代构建工具的标准。Turbopack、Rspack 等 Rust/Go 编写的工具在性能上持续突破。</p><h2>AI 辅助开发</h2><p>AI 编程助手已从概念走向日常工具。代码生成、智能补全、自动化测试等场景正在被重新定义。</p><p>保持学习，拥抱变化，是前端开发者永恒的主题。</p>',
          cover: '',
          author: 'Admin',
          category: '技术',
          tags: ['前端', '趋势'],
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
          views: 89,
          published: true,
          pinned: false,
          announcement: false,
          showOnHome: true
        }
      ],
      categories: ['公告', '技术', '生活', '随笔'],
      tags: ['教程', '公告', '写作', '技术', '前端', '趋势', '生活', '随笔'],
      friends: defaultFriends,
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
          content: '<section class="about-card"><h2>设计理念</h2><p>本站延续微信式的简洁风格：绿色主色、清晰层级、卡片布局和大量留白，让读者把注意力放在内容本身。</p></section><section class="about-card"><h2>功能说明</h2><ul><li>前台支持文章列表、分类筛选、搜索、文章详情和友情链接页面。</li><li>后台支持登录认证、仪表盘统计、文章新增、编辑、删除和发布状态管理。</li><li>手机端底部导航包含主页、文章、朋友们、关于，方便移动端浏览。</li></ul></section><section class="about-card"><h2>友链交换</h2><p>如果你也有个人博客，可以按照“朋友们”页面中的卡片格式添加站点名称、链接、头像和一句简短介绍。</p><a class="btn-primary" href="friends.html">查看朋友们</a></section>'
        },
        commentSettings: {
          blockedKeywords: [],
          homepagePageSize: 5,
          postPageSize: 10
        }
      },
      admin: {
        username: 'admin',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqKQFqBzDqD4nYDvLqFqKqKqKqKqKq'
      }
    };
    // 使用 bcryptjs 的同步方法生成默认密码 hash
    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    initial.admin.password = bcrypt.hashSync('admin123', salt);
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  let changed = false;
  if (!Array.isArray(db.friends)) {
    db.friends = defaultFriends;
    changed = true;
  }
  if (!Array.isArray(db.users)) {
    db.users = [];
    changed = true;
  }
  if (!db.settings) {
    db.settings = { siteName: 'CARSON', description: 'CARSON 的个人博客，记录文章、朋友与留言反馈。', logo: '', footerText: '' };
    changed = true;
  }
  if (db.settings.description === undefined) {
    db.settings.description = 'CARSON 的个人博客，记录文章、朋友与留言反馈。';
    changed = true;
  }
  if (db.settings.footerText === undefined) {
    db.settings.footerText = '';
    changed = true;
  }
  if (!db.settings.about) {
    db.settings.about = {
      kicker: 'About',
      title: '关于本站',
      summary: '这是一个微信风格的轻量博客系统，专注于文章发布、内容阅读和简单后台管理。',
      content: '<section class="about-card"><h2>设计理念</h2><p>本站延续微信式的简洁风格：绿色主色、清晰层级、卡片布局和大量留白，让读者把注意力放在内容本身。</p></section><section class="about-card"><h2>功能说明</h2><ul><li>前台支持文章列表、分类筛选、搜索、文章详情和友情链接页面。</li><li>后台支持登录认证、仪表盘统计、文章新增、编辑、删除和发布状态管理。</li><li>手机端底部导航包含主页、文章、朋友们、关于，方便移动端浏览。</li></ul></section><section class="about-card"><h2>友链交换</h2><p>如果你也有个人博客，可以按照“朋友们”页面中的卡片格式添加站点名称、链接、头像和一句简短介绍。</p><a class="btn-primary" href="friends.html">查看朋友们</a></section>'
    };
    changed = true;
  }
  if (!Array.isArray(db.comments)) {
    db.comments = [];
    changed = true;
  }
  if (!db.settings.commentSettings) {
    db.settings.commentSettings = {
      blockedKeywords: [],
      homepagePageSize: 5,
      postPageSize: 10
    };
    changed = true;
  }
  if (!Array.isArray(db.settings.commentSettings.blockedKeywords)) {
    db.settings.commentSettings.blockedKeywords = [];
    changed = true;
  }
  if (!Number.isFinite(Number(db.settings.commentSettings.homepagePageSize))) {
    db.settings.commentSettings.homepagePageSize = 5;
    changed = true;
  }
  if (!Number.isFinite(Number(db.settings.commentSettings.postPageSize))) {
    db.settings.commentSettings.postPageSize = 10;
    changed = true;
  }
  db.posts = db.posts.map(post => {
    if (post.pinned === undefined || post.announcement === undefined || post.showOnHome === undefined) changed = true;
    return {
      pinned: false,
      announcement: false,
      showOnHome: true,
      ...post
    };
  });
  db.friends = db.friends.map((friend, i) => ({
    status: 'approved',
    visible: true,
    iconUrl: '',
    sortOrder: friend.sortOrder !== undefined ? friend.sortOrder : (i + 1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...friend,
    sortOrder: friend.sortOrder !== undefined ? friend.sortOrder : (i + 1)
  }));
  if (changed) saveDB(db);
  return db;
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ============ 上传配置 ============
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FRIEND_AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, Date.now() + '-' + Math.random().toString(16).slice(2) + ext);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(new Error('头像仅支持 PNG、JPG、GIF、WEBP、SVG 图片'));
    }
    cb(null, true);
  }
});

function friendAvatarMiddleware(req, res, next) {
  uploadAvatar.single('avatar')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '头像图片不能大于 1MB' });
    }
    return res.status(400).json({ error: err.message || '头像上传失败' });
  });
}

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SITE_LOGO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, 'logo-' + Date.now() + '-' + Math.random().toString(16).slice(2) + ext);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(new Error('网站 Logo 仅支持 PNG、JPG、GIF、WEBP、SVG 图片'));
    }
    cb(null, true);
  }
});

function siteLogoMiddleware(req, res, next) {
  uploadLogo.single('logo')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '网站 Logo 不能大于 1MB' });
    }
    return res.status(400).json({ error: err.message || 'Logo 上传失败' });
  });
}

const articleImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ARTICLE_IMAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, 'article-' + Date.now() + '-' + Math.random().toString(16).slice(2) + ext);
  }
});

const uploadArticleImage = multer({
  storage: articleImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(new Error('文章图片仅支持 PNG、JPG、GIF、WEBP、SVG 图片'));
    }
    cb(null, true);
  }
});

function articleImageMiddleware(req, res, next) {
  uploadArticleImage.single('image')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文章图片不能大于 5MB' });
    }
    return res.status(400).json({ error: err.message || '文章图片上传失败' });
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

function fileToAvatarPath(file) {
  return file ? '/uploads/friends/' + file.filename : '';
}

function fileToLogoPath(file) {
  return file ? '/uploads/site/' + file.filename : '';
}

function fileToArticleImagePath(file) {
  return file ? '/uploads/articles/' + file.filename : '';
}

function removeLocalAvatar(avatar) {
  if (!avatar || !avatar.startsWith('/uploads/friends/')) return;
  const filePath = path.join(__dirname, avatar.replace(/^\//, ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function removeLocalUpload(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, fileUrl.replace(/^\//, ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function normalizeCommentSettings(settings = {}) {
  const homepagePageSize = Math.max(1, Math.min(100, Number(settings.homepagePageSize) || 5));
  const postPageSize = Math.max(1, Math.min(100, Number(settings.postPageSize) || 10));
  const blockedKeywords = Array.isArray(settings.blockedKeywords)
    ? settings.blockedKeywords
    : String(settings.blockedKeywords || '').split(/[\n,，]/);
  return {
    blockedKeywords: blockedKeywords.map(item => String(item || '').trim()).filter(Boolean),
    homepagePageSize,
    postPageSize
  };
}

function getCommentSettings(db) {
  db.settings = db.settings || {};
  db.settings.commentSettings = normalizeCommentSettings(db.settings.commentSettings || {});
  return db.settings.commentSettings;
}

function getMatchedKeywords(content, keywords) {
  const text = String(content || '').toLowerCase();
  return (keywords || []).filter(keyword => text.includes(String(keyword).toLowerCase()));
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

function optionalUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (e) {
    return null;
  }
}

function sortPostsForList(posts) {
  return posts.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

// ============ 认证中间件 ============
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const SECRET_KEY = process.env.JWT_SECRET || 'wechat-blog-secret-2024';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未登录或登录已过期' });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录令牌无效' });
  }
}

function userAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '请先登录前台账号' });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.type !== 'user') {
      return res.status(401).json({ error: '登录令牌无效' });
    }
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录令牌无效' });
  }
}

// 写操作后自动清除相关缓存
function clearCacheAfterMutation(scope) {
  // scope: 'posts', 'comments', 'friends', 'settings', 'meta', 'all'
  if (scope === 'all') {
    clearCache();
    return;
  }
  const patterns = {
    posts: ['/api/posts', '/api/announcements', '/api/meta'],
    comments: ['/api/comments'],
    friends: ['/api/friends'],
    settings: ['/api/settings', '/api/about'],
    meta: ['/api/meta', '/api/posts']
  };
  const list = patterns[scope] || [scope];
  list.forEach(function (p) { clearCache(p); });
}

function clearCacheByScope(scope, pattern) {
  if (scope === 'pattern' && pattern) return clearCache(pattern);
  if (scope === 'all' || !scope) return clearCache();
  const patterns = {
    posts: ['/api/posts', '/api/announcements', '/api/meta'],
    comments: ['/api/comments'],
    friends: ['/api/friends'],
    settings: ['/api/settings', '/api/about'],
    meta: ['/api/meta', '/api/posts']
  };
  const list = patterns[scope];
  if (!list) return clearCache();
  let count = 0;
  list.forEach(function (p) { count += clearCache(p); });
  return count;
}

// ============ 后台缓存管理接口 ============
app.get('/api/admin/cache/stats', authMiddleware, (req, res) => {
  res.json(getCacheStats());
});

app.post('/api/admin/cache/clear', authMiddleware, (req, res) => {
  const scope = String(req.body.scope || 'all').trim();
  const pattern = req.body.pattern ? String(req.body.pattern).trim() : '';
  const cleared = clearCacheByScope(scope, pattern);
  res.json({ message: '缓存已清除', cleared: cleared });
});

// ============ 认证接口 ============
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  if (username !== db.admin.username) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  if (!bcrypt.compareSync(password, db.admin.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '24h' });
  res.json({ token, username });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ============ 前台用户接口 ============
app.post('/api/user/register', (req, res) => {
  const db = loadDB();
  const { username, password } = req.body;
  const name = String(username || '').trim();
  if (!name || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (name.length < 3) {
    return res.status(400).json({ error: '用户名至少需要 3 个字符' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: '密码至少需要 6 位' });
  }
  if (db.users.some(user => user.username === name)) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  const salt = bcrypt.genSaltSync(10);
  const user = {
    id: Date.now().toString(),
    username: name,
    password: bcrypt.hashSync(password, salt),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  saveDB(db);
  const token = jwt.sign({ username: name, type: 'user' }, SECRET_KEY, { expiresIn: '7d' });
  res.status(201).json({ token, username: name });
});

app.post('/api/user/login', (req, res) => {
  const db = loadDB();
  const { username, password } = req.body;
  const name = String(username || '').trim();
  if (name === db.admin.username && bcrypt.compareSync(password || '', db.admin.password)) {
    const token = jwt.sign({ username: db.admin.username, type: 'user', role: 'admin' }, SECRET_KEY, { expiresIn: '7d' });
    return res.json({ token, username: db.admin.username });
  }
  const user = db.users.find(item => item.username === name);
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ username: user.username, type: 'user' }, SECRET_KEY, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

app.get('/api/user/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.type !== 'user') return res.status(401).json({ error: '登录令牌无效' });
    res.json({ username: decoded.username });
  } catch (e) {
    res.status(401).json({ error: '登录令牌无效' });
  }
});

// 前台用户：查看自己的投稿记录
app.get('/api/user/submissions', userAuthMiddleware, (req, res) => {
  const db = loadDB();
  const username = req.user.username;
  const list = db.posts
    .filter(post => post.submittedBy === username)
    .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
    .map(({ content, ...rest }) => rest);
  res.json(list);
});

// 前台用户：提交文章投稿，默认待管理员审核，审核通过后才会在前台展示
app.post('/api/user/submissions', userAuthMiddleware, (req, res) => {
  const db = loadDB();
  const title = String(req.body.title || '').trim();
  const summary = String(req.body.summary || '').trim();
  const content = String(req.body.content || '').trim();
  const category = String(req.body.category || '投稿').trim() || '投稿';
  const rawTags = Array.isArray(req.body.tags)
    ? req.body.tags
    : String(req.body.tags || '').split(/[,，]/);
  const tags = rawTags.map(t => String(t || '').trim()).filter(Boolean).slice(0, 8);

  if (!title) return res.status(400).json({ error: '投稿标题不能为空' });
  if (!content) return res.status(400).json({ error: '投稿正文不能为空' });
  if (title.length > 80) return res.status(400).json({ error: '标题不能超过 80 个字符' });
  if (summary.length > 300) return res.status(400).json({ error: '摘要不能超过 300 个字符' });
  if (content.length > 20000) return res.status(400).json({ error: '正文不能超过 20000 个字符' });

  const post = {
    id: Date.now().toString() + '-' + Math.random().toString(16).slice(2, 8),
    title,
    summary,
    content: escapeUserContent(content),
    cover: '',
    author: req.user.username,
    category,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: 0,
    published: false,
    pinned: false,
    announcement: false,
    showOnHome: true,
    reviewStatus: 'pending',
    submittedBy: req.user.username,
    submittedAt: new Date().toISOString(),
    reviewedAt: '',
    reviewer: '',
    rejectionReason: ''
  };

  db.posts.push(post);
  if (!db.categories.includes(category)) db.categories.push(category);
  tags.forEach(t => { if (!db.tags.includes(t)) db.tags.push(t); });
  saveDB(db);
  clearCacheAfterMutation('meta');
  res.status(201).json({ message: '投稿已提交，请等待管理员审核', submission: { ...post, content: undefined } });
});

// ============ 文章接口 ============
// 获取文章列表（前台，只返回已发布的）
app.get('/api/posts', (req, res) => {
  const db = loadDB();
  const { category, tag, search, home } = req.query;
  let posts = db.posts.filter(p => p.published && !p.announcement);
  if (home === '1' || home === 'true') posts = posts.filter(p => p.showOnHome === true);
  if (category) posts = posts.filter(p => p.category === category);
  if (tag) posts = posts.filter(p => p.tags.includes(tag));
  if (search) {
    const kw = search.toLowerCase();
    posts = posts.filter(p =>
      p.title.toLowerCase().includes(kw) ||
      p.summary.toLowerCase().includes(kw) ||
      p.content.toLowerCase().includes(kw)
    );
  }
  posts = sortPostsForList(posts);
  // 列表不返回完整 content
  const list = posts.map(({ content, ...rest }) => rest);
  res.json(list);
});

// 获取网站公告（前台主页独立显示，与普通文章列表区分）
app.get('/api/announcements', (req, res) => {
  const db = loadDB();
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 5));
  const announcements = sortPostsForList(db.posts.filter(p => p.published && p.announcement));
  const list = announcements.slice(0, limit).map(({ content, ...rest }) => rest);
  res.json(list);
});

// 获取单篇文章
app.get('/api/posts/:id', (req, res) => {
  const db = loadDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post || !post.published) {
    return res.status(404).json({ error: '文章不存在' });
  }
  // 增加浏览量
  post.views = (post.views || 0) + 1;
  saveDB(db);
  clearCacheAfterMutation('posts');
  res.json(post);
});

// 后台：获取所有文章（含未发布）
app.get('/api/admin/posts', authMiddleware, (req, res) => {
  const db = loadDB();
  const posts = sortPostsForList(db.posts);
  const list = posts.map(({ content, ...rest }) => rest);
  res.json(list);
});

// 后台：获取用户投稿列表
app.get('/api/admin/submissions', authMiddleware, (req, res) => {
  const db = loadDB();
  const status = String(req.query.status || '').trim();
  let submissions = db.posts.filter(post => post.submittedBy || ['pending', 'approved', 'rejected'].includes(post.reviewStatus));
  if (['pending', 'approved', 'rejected'].includes(status)) {
    submissions = submissions.filter(post => (post.reviewStatus || (post.published ? 'approved' : 'pending')) === status);
  }
  submissions = submissions
    .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
    .map(({ content, ...rest }) => rest);
  res.json(submissions);
});

// 后台：审核用户投稿。通过后会正式发布到前台，不通过则继续隐藏。
app.patch('/api/admin/submissions/:id/status', authMiddleware, (req, res) => {
  const db = loadDB();
  const post = db.posts.find(item => String(item.id) === String(req.params.id));
  if (!post || !post.submittedBy) return res.status(404).json({ error: '投稿不存在' });
  const status = String(req.body.status || '').trim();
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '审核状态无效' });
  }
  post.reviewStatus = status;
  post.published = status === 'approved';
  post.reviewedAt = new Date().toISOString();
  post.reviewer = req.user.username || 'admin';
  post.rejectionReason = status === 'rejected' ? String(req.body.reason || '').trim() : '';
  post.updatedAt = new Date().toISOString();
  saveDB(db);
  clearCacheAfterMutation('posts');
  res.json(post);
});

// 后台：获取单篇文章
app.get('/api/admin/posts/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '文章不存在' });
  res.json(post);
});

// 创建文章
app.post('/api/admin/posts', authMiddleware, (req, res) => {
  const db = loadDB();
  const { title, summary, content, cover, author, category, tags, published, pinned, announcement, showOnHome } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }
  const post = {
    id: Date.now().toString(),
    title,
    summary: summary || '',
    content,
    cover: cover || '',
    author: author || 'Admin',
    category: category || '未分类',
    tags: tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: 0,
    published: published !== undefined ? published : true,
    pinned: !!pinned,
    announcement: !!announcement,
    showOnHome: !!showOnHome,
    reviewStatus: 'approved'
  };
  db.posts.push(post);
  // 更新分类和标签
  if (category && !db.categories.includes(category)) db.categories.push(category);
  if (tags) {
    tags.forEach(t => { if (!db.tags.includes(t)) db.tags.push(t); });
  }
  saveDB(db);
  clearCacheAfterMutation('posts');
  res.status(201).json(post);
});

// 更新文章
app.put('/api/admin/posts/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const idx = db.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '文章不存在' });
  const { title, summary, content, cover, author, category, tags, published, pinned, announcement, showOnHome } = req.body;
  db.posts[idx] = {
    ...db.posts[idx],
    title: title !== undefined ? title : db.posts[idx].title,
    summary: summary !== undefined ? summary : db.posts[idx].summary,
    content: content !== undefined ? content : db.posts[idx].content,
    cover: cover !== undefined ? cover : db.posts[idx].cover,
    author: author !== undefined ? author : db.posts[idx].author,
    category: category !== undefined ? category : db.posts[idx].category,
    tags: tags !== undefined ? tags : db.posts[idx].tags,
    published: published !== undefined ? published : db.posts[idx].published,
    pinned: pinned !== undefined ? !!pinned : !!db.posts[idx].pinned,
    announcement: announcement !== undefined ? !!announcement : !!db.posts[idx].announcement,
    showOnHome: showOnHome !== undefined ? !!showOnHome : db.posts[idx].showOnHome === true,
    updatedAt: new Date().toISOString()
  };
  if (category && !db.categories.includes(category)) db.categories.push(category);
  if (tags) {
    tags.forEach(t => { if (!db.tags.includes(t)) db.tags.push(t); });
  }
  saveDB(db);
  clearCacheAfterMutation('posts');
  res.json(db.posts[idx]);
});

// 删除文章
app.delete('/api/admin/posts/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const idx = db.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '文章不存在' });
  db.posts.splice(idx, 1);
  saveDB(db);
  clearCacheAfterMutation('posts');
  res.json({ message: '删除成功' });
});

// 后台：上传文章图片，返回可插入正文的图片地址
app.post('/api/admin/uploads/images', authMiddleware, articleImageMiddleware, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请先选择要上传的图片' });
  const url = fileToArticleImagePath(req.file);
  res.status(201).json({ url, html: '<p><img src="' + url + '" alt="文章图片"></p>' });
});

// 获取统计数据
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const db = loadDB();
  const totalPosts = db.posts.length;
  const publishedPosts = db.posts.filter(p => p.published).length;
  const pendingSubmissions = db.posts.filter(p => p.submittedBy && (p.reviewStatus || 'pending') === 'pending').length;
  const totalViews = db.posts.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalCategories = db.categories.length;
  const totalTags = db.tags.length;
  // 最近7天每天文章数
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const dateStr = date.toISOString().split('T')[0];
    const count = db.posts.filter(p => p.createdAt.split('T')[0] === dateStr).length;
    last7Days.push({ date: dateStr, count });
  }
  res.json({ totalPosts, publishedPosts, pendingSubmissions, totalViews, totalCategories, totalTags, last7Days });
});

// 获取分类和标签
app.get('/api/meta', (req, res) => {
  const db = loadDB();
  res.json({ categories: db.categories, tags: db.tags });
});

// 后台：分类管理
app.get('/api/admin/categories', authMiddleware, (req, res) => {
  const db = loadDB();
  const categories = (db.categories || []).map(name => ({
    name,
    postCount: db.posts.filter(post => post.category === name).length
  }));
  res.json(categories);
});

app.post('/api/admin/categories', authMiddleware, (req, res) => {
  const db = loadDB();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  if (name.length > 30) return res.status(400).json({ error: '分类名称不能超过 30 个字符' });
  if (db.categories.includes(name)) return res.status(400).json({ error: '分类已存在' });
  db.categories.push(name);
  saveDB(db);
  clearCacheAfterMutation('meta');
  res.status(201).json({ name, postCount: 0 });
});

app.put('/api/admin/categories/:name', authMiddleware, (req, res) => {
  const db = loadDB();
  const oldName = decodeURIComponent(req.params.name || '');
  const newName = String(req.body.name || '').trim();
  if (!oldName || !db.categories.includes(oldName)) return res.status(404).json({ error: '分类不存在' });
  if (!newName) return res.status(400).json({ error: '新分类名称不能为空' });
  if (newName.length > 30) return res.status(400).json({ error: '分类名称不能超过 30 个字符' });
  if (newName !== oldName && db.categories.includes(newName)) return res.status(400).json({ error: '新分类名称已存在' });
  db.categories = db.categories.map(item => item === oldName ? newName : item);
  db.posts = db.posts.map(post => post.category === oldName ? { ...post, category: newName, updatedAt: new Date().toISOString() } : post);
  saveDB(db);
  clearCacheAfterMutation('meta');
  res.json({ name: newName, postCount: db.posts.filter(post => post.category === newName).length });
});

app.delete('/api/admin/categories/:name', authMiddleware, (req, res) => {
  const db = loadDB();
  const name = decodeURIComponent(req.params.name || '');
  if (!name || !db.categories.includes(name)) return res.status(404).json({ error: '分类不存在' });
  const usedCount = db.posts.filter(post => post.category === name).length;
  if (usedCount > 0) return res.status(400).json({ error: '该分类下还有文章，不能删除。请先修改文章分类。' });
  db.categories = db.categories.filter(item => item !== name);
  saveDB(db);
  clearCacheAfterMutation('meta');
  res.json({ message: '删除成功' });
});

// 公开：获取站点设置
app.get('/api/settings', (req, res) => {
  const db = loadDB();
  res.json({
    siteName: db.settings?.siteName || 'CARSON',
    description: db.settings?.description || '',
    logo: db.settings?.logo || '',
    footerText: db.settings?.footerText || ''
  });
});

// 公开：获取关于页面内容
app.get('/api/about', (req, res) => {
  const db = loadDB();
  res.json(db.settings.about || {});
});

// 后台：更新站点名称与 Logo
app.post('/api/admin/settings', authMiddleware, siteLogoMiddleware, (req, res) => {
  const db = loadDB();
  const siteName = String(req.body.siteName || db.settings?.siteName || 'CARSON').trim() || 'CARSON';
  const description = String(req.body.description || '').trim();
  const footerText = String(req.body.footerText || '').trim();
  const oldLogo = db.settings?.logo || '';
  const nextLogo = req.file ? fileToLogoPath(req.file) : oldLogo;
  if (req.file && oldLogo) removeLocalUpload(oldLogo);
  db.settings = {
    ...(db.settings || {}),
    siteName,
    description,
    footerText,
    logo: nextLogo,
    updatedAt: new Date().toISOString()
  };
  saveDB(db);
  clearCacheAfterMutation('settings');
  res.json(db.settings);
});

// 后台：保存关于页面内容，正文支持 HTML
app.post('/api/admin/about', authMiddleware, (req, res) => {
  const db = loadDB();
  db.settings = db.settings || {};
  db.settings.about = {
    kicker: String(req.body.kicker || 'About').trim() || 'About',
    title: String(req.body.title || '关于本站').trim() || '关于本站',
    summary: String(req.body.summary || '').trim(),
    content: String(req.body.content || '')
  };
  db.settings.updatedAt = new Date().toISOString();
  saveDB(db);
  clearCacheAfterMutation('settings');
  res.json(db.settings.about);
});

// ============ 留言接口 ============
// 公开：获取已审核通过的留言，支持主页和文章留言分页
app.get('/api/comments', (req, res) => {
  const db = loadDB();
  const settings = getCommentSettings(db);
  const targetType = req.query.targetType === 'post' ? 'post' : 'home';
  const postId = String(req.query.postId || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const defaultLimit = targetType === 'home' ? settings.homepagePageSize : settings.postPageSize;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || defaultLimit));

  let comments = db.comments.filter(comment => comment.status === 'approved' && comment.targetType === targetType);
  if (targetType === 'post') {
    comments = comments.filter(comment => String(comment.postId || '') === postId);
  }

  comments = comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = comments.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  res.json({
    comments: comments.slice(start, start + limit).map(sanitizePublicComment),
    page,
    limit,
    total,
    totalPages
  });
});

// 公开：提交留言，游客和登录用户均可提交；命中关键词进入待审核
app.post('/api/comments', (req, res) => {
  const db = loadDB();
  const settings = getCommentSettings(db);
  const user = optionalUser(req);
  const targetType = req.body.targetType === 'post' ? 'post' : 'home';
  const postId = String(req.body.postId || '').trim();
  const content = String(req.body.content || '').trim();
  const authorName = user?.username || String(req.body.authorName || '').trim() || '游客';

  if (!content) return res.status(400).json({ error: '留言内容不能为空' });
  if (content.length > 1000) return res.status(400).json({ error: '留言内容不能超过 1000 字' });
  if (authorName.length > 30) return res.status(400).json({ error: '昵称不能超过 30 个字符' });
  if (targetType === 'post') {
    const post = db.posts.find(item => String(item.id) === postId && item.published);
    if (!post) return res.status(404).json({ error: '文章不存在，无法留言' });
  }

  const matchedKeywords = getMatchedKeywords(content, settings.blockedKeywords);
  const status = matchedKeywords.length ? 'pending' : 'approved';
  const comment = {
    id: Date.now().toString() + '-' + Math.random().toString(16).slice(2, 8),
    targetType,
    postId: targetType === 'post' ? postId : '',
    authorName,
    content,
    status,
    matchedKeywords,
    ip: req.ip || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.comments.push(comment);
  saveDB(db);
  clearCacheAfterMutation('comments');
  res.status(201).json({
    message: status === 'pending' ? '留言已提交，需管理员审核后显示' : '留言发布成功',
    comment: sanitizePublicComment(comment)
  });
});

// 后台：获取全部留言，包含待审核、已通过和不通过
app.get('/api/admin/comments', authMiddleware, (req, res) => {
  const db = loadDB();
  const status = String(req.query.status || '').trim();
  const targetType = String(req.query.targetType || '').trim();
  let comments = db.comments || [];
  if (['pending', 'approved', 'rejected'].includes(status)) {
    comments = comments.filter(comment => comment.status === status);
  }
  if (['home', 'post'].includes(targetType)) {
    comments = comments.filter(comment => comment.targetType === targetType);
  }
  comments = comments
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(comment => ({
      ...comment,
      targetTitle: getCommentTargetTitle(db, comment)
    }));
  res.json(comments);
});

// 后台：更新留言审核状态
app.patch('/api/admin/comments/:id/status', authMiddleware, (req, res) => {
  const db = loadDB();
  const comment = db.comments.find(item => String(item.id) === String(req.params.id));
  if (!comment) return res.status(404).json({ error: '留言不存在' });
  const status = String(req.body.status || '').trim();
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '状态无效' });
  }
  comment.status = status;
  comment.updatedAt = new Date().toISOString();
  saveDB(db);
  clearCacheAfterMutation('comments');
  res.json(comment);
});

// 后台：删除留言
app.delete('/api/admin/comments/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const idx = db.comments.findIndex(item => String(item.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '留言不存在' });
  db.comments.splice(idx, 1);
  saveDB(db);
  clearCacheAfterMutation('comments');
  res.json({ message: '删除成功' });
});

// 后台：读取留言设置
app.get('/api/admin/comment-settings', authMiddleware, (req, res) => {
  const db = loadDB();
  res.json(getCommentSettings(db));
});

// 后台：保存留言关键词与分页设置
app.post('/api/admin/comment-settings', authMiddleware, (req, res) => {
  const db = loadDB();
  db.settings = db.settings || {};
  db.settings.commentSettings = normalizeCommentSettings({
    blockedKeywords: req.body.blockedKeywords,
    homepagePageSize: req.body.homepagePageSize,
    postPageSize: req.body.postPageSize
  });
  db.settings.updatedAt = new Date().toISOString();
  saveDB(db);
  clearCacheAfterMutation('comments');
  res.json(db.settings.commentSettings);
});

// ============ 友链接口 ============
// 前台：只展示审核通过且可见的友链
app.get('/api/friends', (req, res) => {
  const db = loadDB();
  const friends = db.friends
    .filter(friend => friend.status === 'approved' && friend.visible !== false)
    .sort((a, b) => {
      var sa = Number(a.sortOrder);
      var sb = Number(b.sortOrder);
      if (isFinite(sa) && isFinite(sb) && sa !== sb) return sa - sb;
      if (isFinite(sa) && !isFinite(sb)) return -1;
      if (!isFinite(sa) && isFinite(sb)) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  res.json(friends);
});

// 前台：用户提交友链，默认进入待审核
app.post('/api/friends', friendAvatarMiddleware, (req, res) => {
  try {
    const db = loadDB();
    const { name, url, description, iconUrl } = req.body;
    const siteName = String(name || '').trim();
    const siteUrl = normalizeUrl(url);
    const siteDesc = String(description || '').trim();
    const siteIconUrl = normalizeUrl(iconUrl);

    if (!siteName || !siteUrl) {
      if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
      return res.status(400).json({ error: '站点名称和链接不能为空' });
    }

    try {
      new URL(siteUrl);
    } catch (e) {
      if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
      return res.status(400).json({ error: '请输入有效的链接地址' });
    }
    if (siteIconUrl) {
      try {
        new URL(siteIconUrl);
      } catch (e) {
        if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
        return res.status(400).json({ error: '请输入有效的小图标链接' });
      }
    }

    const friend = {
      id: Date.now().toString(),
      name: siteName,
      url: siteUrl,
      description: siteDesc || '这个朋友还没有留下签名',
      avatar: fileToAvatarPath(req.file),
      iconUrl: siteIconUrl,
      sortOrder: 0,
      status: 'pending',
      visible: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.friends.push(friend);
    saveDB(db);
    clearCacheAfterMutation('friends');
    res.status(201).json({ message: '友链已提交，请等待后台审核', friend });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '头像图片不能大于 1MB' });
    }
    res.status(400).json({ error: err.message || '提交失败' });
  }
});

// 后台：获取全部友链
app.get('/api/admin/friends', authMiddleware, (req, res) => {
  const db = loadDB();
  const friends = db.friends.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(friends);
});

// 后台：添加友链，可直接审核通过
app.post('/api/admin/friends', authMiddleware, friendAvatarMiddleware, (req, res) => {
  try {
    const db = loadDB();
    const { name, url, description, iconUrl, status, visible } = req.body;
    const siteName = String(name || '').trim();
    const siteUrl = normalizeUrl(url);
    const siteIconUrl = normalizeUrl(iconUrl);
    if (!siteName || !siteUrl) {
      if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
      return res.status(400).json({ error: '站点名称和链接不能为空' });
    }
    try {
      new URL(siteUrl);
    } catch (e) {
      if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
      return res.status(400).json({ error: '请输入有效的链接地址' });
    }
    if (siteIconUrl) {
      try {
        new URL(siteIconUrl);
      } catch (e) {
        if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
        return res.status(400).json({ error: '请输入有效的小图标链接' });
      }
    }
    const finalStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : 'approved';
    const sortOrderNum = Math.max(0, Math.min(9999, parseInt(req.body.sortOrder, 10) || 0));
    const friend = {
      id: Date.now().toString(),
      name: siteName,
      url: siteUrl,
      description: String(description || '').trim(),
      avatar: fileToAvatarPath(req.file),
      iconUrl: siteIconUrl,
      sortOrder: sortOrderNum,
      status: finalStatus,
      visible: finalStatus === 'approved' && visible !== 'false',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.friends.push(friend);
    saveDB(db);
    clearCacheAfterMutation('friends');
    res.status(201).json(friend);
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '头像图片不能大于 1MB' });
    }
    res.status(400).json({ error: err.message || '保存失败' });
  }
});

// 后台：更新友链资料、审核状态和头像
app.put('/api/admin/friends/:id', authMiddleware, friendAvatarMiddleware, (req, res) => {
  try {
    const db = loadDB();
    const idx = db.friends.findIndex(friend => friend.id === req.params.id);
    if (idx === -1) {
      if (req.file) removeLocalAvatar(fileToAvatarPath(req.file));
      return res.status(404).json({ error: '友链不存在' });
    }

    const current = db.friends[idx];
    const { name, url, description, iconUrl, status, visible, sortOrder } = req.body;
    const nextStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : current.status;
    const nextAvatar = req.file ? fileToAvatarPath(req.file) : current.avatar;
    const nextSortOrder = sortOrder !== undefined ? Math.max(0, Math.min(9999, parseInt(sortOrder, 10) || 0)) : (current.sortOrder || 0);

    if (req.file && current.avatar) removeLocalAvatar(current.avatar);

    const nextUrl = url !== undefined ? normalizeUrl(url) : current.url;
    const nextIconUrl = iconUrl !== undefined ? normalizeUrl(iconUrl) : (current.iconUrl || '');
    if (nextUrl) {
      try {
        new URL(nextUrl);
      } catch (e) {
        if (req.file) removeLocalAvatar(nextAvatar);
        return res.status(400).json({ error: '请输入有效的链接地址' });
      }
    }
    if (nextIconUrl) {
      try {
        new URL(nextIconUrl);
      } catch (e) {
        if (req.file) removeLocalAvatar(nextAvatar);
        return res.status(400).json({ error: '请输入有效的小图标链接' });
      }
    }

    db.friends[idx] = {
      ...current,
      name: name !== undefined ? String(name).trim() : current.name,
      url: nextUrl,
      description: description !== undefined ? String(description).trim() : current.description,
      avatar: nextAvatar,
      iconUrl: nextIconUrl,
      sortOrder: nextSortOrder,
      status: nextStatus,
      visible: nextStatus === 'approved' && visible !== 'false',
      updatedAt: new Date().toISOString()
    };
    saveDB(db);
    clearCacheAfterMutation('friends');
    res.json(db.friends[idx]);
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '头像图片不能大于 1MB' });
    }
    res.status(400).json({ error: err.message || '更新失败' });
  }
});

// 后台：快捷审核
app.patch('/api/admin/friends/:id/status', authMiddleware, (req, res) => {
  const db = loadDB();
  const friend = db.friends.find(item => item.id === req.params.id);
  if (!friend) return res.status(404).json({ error: '友链不存在' });
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '状态无效' });
  }
  friend.status = status;
  friend.visible = status === 'approved';
  friend.updatedAt = new Date().toISOString();
  saveDB(db);
  clearCacheAfterMutation('friends');
  res.json(friend);
});

// 后台：删除友链
app.delete('/api/admin/friends/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const idx = db.friends.findIndex(friend => friend.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '友链不存在' });
  const [removed] = db.friends.splice(idx, 1);
  removeLocalAvatar(removed.avatar);
  saveDB(db);
  clearCacheAfterMutation('friends');
  res.json({ message: '删除成功' });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`\n  微信风格博客系统已启动！`);
  console.log(`  ────────────────────────────`);
  console.log(`  前台博客:  http://localhost:${PORT}`);
  console.log(`  后台管理:  http://localhost:${PORT}/admin`);
  console.log(`  ────────────────────────────`);
  console.log(`  默认账号:  admin`);
  console.log(`  默认密码:  admin123\n`);
});
