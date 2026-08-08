/* ============================
   CARSON 博客 - 前台逻辑
   ============================ */

/* ----------------------------
   工具函数
   ---------------------------- */

/**
 * 格式化日期为 "2024年1月15日"
 * @param {string} dateStr ISO 日期字符串
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

/**
 * HTML 转义，防止 XSS（用于卡片中展示纯文本字段）
 */
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 封装 fetch，统一错误处理
 */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = '请求失败（' + res.status + '）';
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch (e) { /* 忽略解析错误 */ }
    throw new Error(msg);
  }
  return res.json();
}

async function parseResponse(res) {
  var text = await res.text();
  var data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || '请求失败（' + res.status + '）');
  }
  return data;
}

function decodeFooterText(parts) {
  return parts.map(function (code) { return String.fromCharCode(code); }).join('');
}

function renderProtectedFooter() {
  var footer = document.querySelector('footer.footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'footer';
    document.body.appendChild(footer);
  }
  footer.id = 'globalFooter';
  footer.setAttribute('data-protected-footer', '1');
  var carson = decodeFooterText([67, 65, 82, 83, 79, 78]);
  var year = decodeFooterText([50, 48, 50, 54]);
  footer.innerHTML =
    '<div class="footer-divider"></div>' +
    '<p class="global-footer-line">© ' + year + ' Powered by ' +
      '<a href="https://520816.xyz" target="_blank" rel="noopener noreferrer">' + carson + '</a>' +
    '</p>' +
    '<p class="custom-footer-line" id="customFooterLine"></p>';
  applyCustomFooterText(window.__customFooterText || '');
}

function applyCustomFooterText(text) {
  window.__customFooterText = text || '';
  var line = document.getElementById('customFooterLine');
  if (!line) return;
  if (window.__customFooterText) {
    line.textContent = window.__customFooterText;
    line.style.display = '';
  } else {
    line.textContent = '';
    line.style.display = 'none';
  }
}

function protectGlobalFooter() {
  renderProtectedFooter();
  if (window.__globalFooterObserver) return;
  window.__globalFooterObserver = new MutationObserver(function () {
    var footer = document.querySelector('footer.footer[data-protected-footer="1"]');
    if (!footer || !footer.textContent.includes('CARSON')) {
      renderProtectedFooter();
    }
  });
  window.__globalFooterObserver.observe(document.body, { childList: true, subtree: true });
}

/* ----------------------------
   站点设置与前台账号
   ---------------------------- */

async function initSiteSettings() {
  try {
    const settings = await fetchJSON('/api/settings');
    const siteName = settings.siteName || 'CARSON';
    document.querySelectorAll('.site-logo').forEach(function (logo) {
      logo.classList.toggle('has-custom-logo', !!settings.logo);
      logo.innerHTML = (settings.logo ? '<img class="site-logo-img" src="' + escapeHTML(settings.logo) + '" alt="' + escapeHTML(siteName) + 'Logo">' : '') +
        '<span class="site-logo-text">' + escapeHTML(siteName) + '</span>';
    });
    if (settings.description) {
      document.querySelectorAll('meta[name="description"]').forEach(function (meta) {
        meta.setAttribute('content', settings.description);
      });
    }
    applyCustomFooterText(settings.footerText || '');
  } catch (e) {
    // 设置加载失败时保留默认 Logo
  }
}

function initFrontAuthActions() {
  const actions = document.getElementById('authActions');
  if (!actions) return;
  const username = localStorage.getItem('frontUsername');
  if (username) {
    const initial = (username.charAt(0) || 'U').toUpperCase();
    actions.innerHTML =
      '<div class="user-menu" id="userMenu">' +
        '<button class="user-avatar-btn" id="userAvatarBtn" type="button" aria-label="用户菜单" aria-expanded="false">' +
          escapeHTML(initial) +
        '</button>' +
        '<div class="user-dropdown" id="userDropdown">' +
          '<div class="user-dropdown-name">你好，' + escapeHTML(username) + '</div>' +
          '<a href="profile.html">个人中心</a>' +
          '<a href="/admin/login.html">后台管理</a>' +
          '<button type="button" id="frontLogoutBtn">退出</button>' +
        '</div>' +
      '</div>';

    const menu = document.getElementById('userMenu');
    const avatarBtn = document.getElementById('userAvatarBtn');
    const dropdown = document.getElementById('userDropdown');
    if (avatarBtn && dropdown && menu) {
      avatarBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        avatarBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!menu.contains(e.target)) {
          menu.classList.remove('open');
          avatarBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const logoutBtn = document.getElementById('frontLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('frontToken');
        localStorage.removeItem('frontUsername');
        window.location.href = 'index.html';
      });
    }
  } else {
    actions.innerHTML = '<a class="auth-link auth-link-primary" href="login.html">登录</a>';
  }
}

function initProfilePage() {
  const profileName = document.getElementById('profileName');
  const profileAvatar = document.getElementById('profileAvatarLarge');
  if (!profileName || !profileAvatar) return;
  const username = localStorage.getItem('frontUsername');
  if (!username) {
    window.location.href = 'login.html';
    return;
  }
  profileName.textContent = username;
  profileAvatar.textContent = (username.charAt(0) || 'U').toUpperCase();
}

function getSubmissionStatusText(status) {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '不通过';
  return '待审核';
}

async function loadMySubmissions() {
  const list = document.getElementById('submissionList');
  if (!list) return;
  const token = localStorage.getItem('frontToken') || '';
  if (!token) {
    list.innerHTML = '<div class="empty"><p>请先登录后查看投稿。</p></div>';
    return;
  }
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>正在加载投稿...</p></div>';
  try {
    const res = await fetch('/api/user/submissions', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const submissions = await parseResponse(res);
    renderMySubmissions(submissions || []);
  } catch (err) {
    list.innerHTML = '<div class="error-tip"><p>投稿加载失败：' + escapeHTML(err.message) + '</p></div>';
  }
}

function renderMySubmissions(submissions) {
  const list = document.getElementById('submissionList');
  if (!list) return;
  if (!submissions.length) {
    list.innerHTML = '<div class="empty"><p>还没有投稿，写下第一篇吧。</p></div>';
    return;
  }
  list.innerHTML = submissions.map(function (item) {
    const status = item.reviewStatus || (item.published ? 'approved' : 'pending');
    const statusText = getSubmissionStatusText(status);
    const statusClass = status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending');
    const link = status === 'approved' && item.published
      ? '<a class="auth-link" href="post.html?id=' + encodeURIComponent(item.id) + '">查看文章</a>'
      : '';
    return (
      '<article class="submission-item">' +
        '<div class="submission-item-main">' +
          '<div class="submission-title-row">' +
            '<h3>' + escapeHTML(item.title || '无标题投稿') + '</h3>' +
            '<span class="submission-status ' + statusClass + '">' + statusText + '</span>' +
          '</div>' +
          '<p>' + escapeHTML(item.summary || '暂无摘要') + '</p>' +
          '<div class="submission-meta">' + formatDate(item.submittedAt || item.createdAt) + ' · ' + escapeHTML(item.category || '投稿') + '</div>' +
          (item.rejectionReason ? '<div class="submission-reason">原因：' + escapeHTML(item.rejectionReason) + '</div>' : '') +
        '</div>' +
        link +
      '</article>'
    );
  }).join('');
}

function initSubmissionForm() {
  const form = document.getElementById('submissionForm');
  if (!form) return;
  const btn = document.getElementById('submissionSubmitBtn');
  const msg = document.getElementById('submissionMsg');
  const refreshBtn = document.getElementById('refreshSubmissionsBtn');

  function setMsg(text, type) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = 'friend-submit-msg' + (type ? ' ' + type : '');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const token = localStorage.getItem('frontToken') || '';
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    const data = {
      title: document.getElementById('submissionTitle').value.trim(),
      category: document.getElementById('submissionCategory').value.trim() || '投稿',
      tags: document.getElementById('submissionTags').value.trim(),
      summary: document.getElementById('submissionSummary').value.trim(),
      content: document.getElementById('submissionContent').value.trim()
    };
    if (!data.title || !data.content) {
      setMsg('请填写标题和正文', 'error');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = '提交中...';
    }
    setMsg('', '');
    try {
      const res = await fetch('/api/user/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(data)
      });
      const result = await parseResponse(res);
      form.reset();
      setMsg(result.message || '投稿已提交，请等待审核', 'success');
      loadMySubmissions();
    } catch (err) {
      setMsg(err.message || '投稿提交失败', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '提交投稿';
      }
    }
  });

  if (refreshBtn) refreshBtn.addEventListener('click', loadMySubmissions);
  loadMySubmissions();
}

function initFrontAuthForms() {
  const loginForm = document.getElementById('frontLoginForm');
  const registerForm = document.getElementById('frontRegisterForm');

  async function submitAuth(url, username, password) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    return parseResponse(res);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('frontLoginBtn');
      const msg = document.getElementById('frontLoginMsg');
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      btn.disabled = true;
      btn.textContent = '登录中...';
      msg.className = 'front-auth-msg';
      msg.textContent = '';
      try {
        const data = await submitAuth('/api/user/login', username, password);
        localStorage.setItem('frontToken', data.token);
        localStorage.setItem('frontUsername', data.username);
        msg.className = 'front-auth-msg success';
        msg.textContent = '登录成功，正在返回首页...';
        setTimeout(function () { window.location.href = 'index.html'; }, 600);
      } catch (err) {
        msg.className = 'front-auth-msg error';
        msg.textContent = err.message || '登录失败';
      } finally {
        btn.disabled = false;
        btn.textContent = '登录';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('frontRegisterBtn');
      const msg = document.getElementById('frontRegisterMsg');
      const username = document.getElementById('registerUsername').value.trim();
      const password = document.getElementById('registerPassword').value;
      btn.disabled = true;
      btn.textContent = '注册中...';
      msg.className = 'front-auth-msg';
      msg.textContent = '';
      try {
        const data = await submitAuth('/api/user/register', username, password);
        localStorage.setItem('frontToken', data.token);
        localStorage.setItem('frontUsername', data.username);
        msg.className = 'front-auth-msg success';
        msg.textContent = '注册成功，正在返回首页...';
        setTimeout(function () { window.location.href = 'index.html'; }, 600);
      } catch (err) {
        msg.className = 'front-auth-msg error';
        msg.textContent = err.message || '注册失败';
      } finally {
        btn.disabled = false;
        btn.textContent = '注册';
      }
    });
  }
}

async function loadAboutPage() {
  const container = document.getElementById('aboutPage');
  if (!container) return;
  try {
    const about = await fetchJSON('/api/about');
    const title = about.title || '关于本站';
    document.title = title + ' - 微信博客';
    container.innerHTML =
      '<section class="page-hero">' +
        '<p class="page-kicker">' + escapeHTML(about.kicker || 'About') + '</p>' +
        '<h1>' + escapeHTML(title) + '</h1>' +
        (about.summary ? '<p>' + escapeHTML(about.summary) + '</p>' : '') +
      '</section>' +
      '<div class="about-html-content">' + (about.content || '') + '</div>';
  } catch (err) {
    container.innerHTML =
      '<div class="error-tip">' +
        '<p>关于页面加载失败：' + escapeHTML(err.message) + '</p>' +
        '<button class="btn-primary retry-btn" onclick="loadAboutPage()">重新加载</button>' +
      '</div>';
  }
}

/* ----------------------------
   首页逻辑
   ---------------------------- */

// 当前筛选状态
const state = {
  category: '',   // 当前选中的分类，空字符串表示「全部」
  search: ''      // 当前搜索关键词
};

/**
 * 加载分类标签并渲染分类栏
 */
async function loadCategories() {
  const bar = document.getElementById('categoryBar');
  if (!bar) return;
  try {
    const meta = await fetchJSON('/api/meta');
    renderCategoryBar(meta.categories || []);
  } catch (e) {
    // 分类加载失败时至少渲染「全部」
    renderCategoryBar([]);
  }
}

/**
 * 渲染分类筛选标签栏
 */
function renderCategoryBar(categories) {
  const bar = document.getElementById('categoryBar');
  if (!bar) return;
  const all = ['全部'].concat(categories);
  bar.innerHTML = all.map(function (cat) {
    const isActive = (cat === '全部' && state.category === '') || cat === state.category;
    return '<button class="category-tag' + (isActive ? ' active' : '') +
      '" data-category="' + (cat === '全部' ? '' : escapeHTML(cat)) + '">' +
      escapeHTML(cat) + '</button>';
  }).join('');

  // 绑定点击事件
  bar.querySelectorAll('.category-tag').forEach(function (tag) {
    tag.addEventListener('click', function () {
      state.category = tag.getAttribute('data-category');
      // 切换分类时清空搜索框，避免筛选条件叠加混乱
      state.search = '';
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      // 更新激活态
      bar.querySelectorAll('.category-tag').forEach(function (t) { t.classList.remove('active'); });
      tag.classList.add('active');
      loadPosts();
    });
  });
}

/**
 * 加载文章列表并渲染
 */
async function loadPosts() {
  const app = document.getElementById('app');
  if (!app) return;
  // 显示加载状态
  app.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>正在加载文章...</p>' +
    '</div>';

  // 拼接查询参数
  const params = new URLSearchParams();
  if (app.getAttribute('data-home-only') === 'true') params.append('home', '1');
  if (state.category) params.append('category', state.category);
  if (state.search) params.append('search', state.search);
  const query = params.toString();
  const url = '/api/posts' + (query ? '?' + query : '');

  try {
    const posts = await fetchJSON(url);
    renderPostList(posts);
  } catch (e) {
    app.innerHTML =
      '<div class="error-tip">' +
        '<p>加载失败：' + escapeHTML(e.message) + '</p>' +
        '<button class="btn-primary retry-btn" onclick="loadPosts()">重新加载</button>' +
      '</div>';
  }
}

async function loadAnnouncements() {
  const section = document.getElementById('announcementSection');
  if (!section) return;
  section.innerHTML =
    '<div class="announcement-card announcement-loading">' +
      '<div class="spinner"></div>' +
      '<p>正在加载网站公告...</p>' +
    '</div>';
  try {
    const announcements = await fetchJSON('/api/announcements?limit=5');
    renderAnnouncements(announcements || []);
  } catch (e) {
    section.innerHTML = '';
  }
}

function renderAnnouncements(announcements) {
  const section = document.getElementById('announcementSection');
  if (!section) return;
  if (!announcements.length) {
    section.innerHTML = '';
    return;
  }
  section.innerHTML =
    '<div class="announcement-card">' +
      '<div class="announcement-header">' +
        '<span class="announcement-icon">公告</span>' +
        '<div>' +
          '<h2>网站公告</h2>' +
          '<p>这里显示站点通知，与普通文章列表分开展示。</p>' +
        '</div>' +
      '</div>' +
      '<div class="announcement-list">' +
        announcements.map(function (item) {
          return (
            '<article class="announcement-item" data-id="' + escapeHTML(String(item.id)) + '">' +
              '<div class="announcement-title-row">' +
                (item.pinned ? '<span class="post-pin-badge">置顶</span>' : '') +
                '<h3>' + escapeHTML(item.title || '无标题公告') + '</h3>' +
              '</div>' +
              (item.summary ? '<p>' + escapeHTML(item.summary) + '</p>' : '') +
              '<div class="announcement-meta">' + formatDate(item.createdAt) + ' · ' + (item.views || 0) + ' 次浏览</div>' +
            '</article>'
          );
        }).join('') +
      '</div>' +
    '</div>';

  section.querySelectorAll('.announcement-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var id = item.getAttribute('data-id');
      window.location.href = 'post.html?id=' + encodeURIComponent(id);
    });
  });
}

/**
 * 渲染文章列表卡片
 */
function renderPostList(posts) {
  const app = document.getElementById('app');
  if (!app) return;

  if (!posts || posts.length === 0) {
    app.innerHTML =
      '<div class="empty">' +
        '<p>暂无文章</p>' +
      '</div>';
    return;
  }

  app.innerHTML = posts.map(function (post) {
    var coverHTML = post.cover
      ? '<img class="post-card-cover" src="' + escapeHTML(post.cover) + '" alt="' + escapeHTML(post.title) + '" loading="lazy">'
      : '';
    var tagsHTML = (post.tags || []).map(function (t) {
      return '<span class="post-detail-tag">#' + escapeHTML(t) + '</span>';
    }).join('');

    return (
      '<article class="post-card" data-id="' + escapeHTML(post.id) + '">' +
        coverHTML +
        '<div class="post-card-title-row">' +
          (post.pinned ? '<span class="post-pin-badge">置顶</span>' : '') +
          '<h2 class="post-card-title">' + escapeHTML(post.title) + '</h2>' +
        '</div>' +
        (post.summary ? '<p class="post-card-summary">' + escapeHTML(post.summary) + '</p>' : '') +
        '<div class="post-card-meta">' +
          '<span class="post-card-category">' + escapeHTML(post.category || '未分类') + '</span>' +
          '<span class="meta-divider">·</span>' +
          '<span class="post-card-meta-item">' + formatDate(post.createdAt) + '</span>' +
          '<span class="meta-divider">·</span>' +
          '<span class="post-card-meta-item">' + (post.views || 0) + ' 次浏览</span>' +
          (tagsHTML ? '<span class="post-detail-tags">' + tagsHTML + '</span>' : '') +
        '</div>' +
      '</article>'
    );
  }).join('');

  // 绑定卡片点击事件，跳转到详情页
  app.querySelectorAll('.post-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var id = card.getAttribute('data-id');
      window.location.href = 'post.html?id=' + encodeURIComponent(id);
    });
  });
}

/* ----------------------------
   搜索功能
   ---------------------------- */

function initSearch() {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');
  if (!input) return;

  function doSearch() {
    state.search = input.value.trim();
    // 搜索时清除分类选中态
    state.category = '';
    const bar = document.getElementById('categoryBar');
    if (bar) {
      bar.querySelectorAll('.category-tag').forEach(function (t) { t.classList.remove('active'); });
      const allTag = bar.querySelector('.category-tag[data-category=""]');
      if (allTag) allTag.classList.add('active');
    }
    loadPosts();
  }

  // 回车触发搜索
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch();
    }
  });

  // 搜索按钮触发
  if (btn) {
    btn.addEventListener('click', doSearch);
  }
}

/* ----------------------------
   手机端底部导航
   ---------------------------- */

function initMobileTabbar() {
  const tabbar = document.querySelector('.mobile-tabbar');
  if (!tabbar) return;

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const hash = window.location.hash;
  let activeTab = 'home';

  if (path === 'articles.html' || path === 'post.html' || hash === '#articles') {
    activeTab = 'articles';
  } else if (path === 'friends.html') {
    activeTab = 'friends';
  } else if (path === 'about.html') {
    activeTab = 'about';
  }

  tabbar.querySelectorAll('.mobile-tabbar-item').forEach(function (item) {
    item.classList.toggle('active', item.getAttribute('data-tab') === activeTab);
  });
}

/* ----------------------------
   友链页面逻辑
   ---------------------------- */

async function loadFriends() {
  const grid = document.getElementById('friendGrid');
  if (!grid) return;
  grid.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>正在加载友链...</p>' +
    '</div>';

  try {
    const friends = await fetchJSON('/api/friends');
    renderFriends(friends || []);
  } catch (e) {
    grid.innerHTML =
      '<div class="error-tip">' +
        '<p>友链加载失败：' + escapeHTML(e.message) + '</p>' +
        '<button class="btn-primary retry-btn" onclick="loadFriends()">重新加载</button>' +
      '</div>';
  }
}

function renderFriends(friends) {
  const grid = document.getElementById('friendGrid');
  if (!grid) return;
  if (!friends.length) {
    grid.innerHTML = '<div class="empty"><p>暂无审核通过的友链</p></div>';
    return;
  }

  grid.innerHTML = friends.map(function (friend) {
    var icon = friend.avatar || friend.iconUrl || '';
    var avatar = icon
      ? '<img class="friend-avatar" src="' + escapeHTML(icon) + '" alt="' + escapeHTML(friend.name || '友链') + '头像" loading="lazy">'
      : '<div class="friend-avatar avatar-placeholder">' + escapeHTML((friend.name || '友').slice(0, 1).toUpperCase()) + '</div>';
    return (
      '<a class="friend-card" href="' + escapeHTML(friend.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
        avatar +
        '<div class="friend-info">' +
          '<h3>' + escapeHTML(friend.name || '未命名站点') + '</h3>' +
          '<p>' + escapeHTML(friend.description || '这个朋友还没有留下签名') + '</p>' +
        '</div>' +
      '</a>'
    );
  }).join('');
}

function initFriendSubmit() {
  const form = document.getElementById('friendSubmitForm');
  if (!form) return;
  const avatarInput = document.getElementById('friendAvatar');
  const submitBtn = document.getElementById('friendSubmitBtn');
  const msg = document.getElementById('friendSubmitMsg');

  function setMsg(text, type) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = 'friend-submit-msg' + (type ? ' ' + type : '');
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', function () {
      const file = avatarInput.files && avatarInput.files[0];
      if (file && file.size > 1024 * 1024) {
        avatarInput.value = '';
        setMsg('头像图片不能大于 1MB', 'error');
      } else {
        setMsg('', '');
      }
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const file = avatarInput && avatarInput.files && avatarInput.files[0];
    if (file && file.size > 1024 * 1024) {
      setMsg('头像图片不能大于 1MB', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '提交中...';
    }
    setMsg('', '');

    try {
      const formData = new FormData(form);
      const res = await fetch('/api/friends', {
        method: 'POST',
        body: formData
      });
      const data = await parseResponse(res);
      form.reset();
      setMsg(data.message || '已提交，请等待审核', 'success');
    } catch (err) {
      setMsg(err.message || '提交失败，请稍后再试', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交审核';
      }
    }
  });
}

/* ----------------------------
   文章详情页逻辑
   ---------------------------- */

/**
 * 从 URL 参数获取文章 id
 */
function getPostIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * 加载并渲染文章详情
 */
async function loadPostDetail() {
  const container = document.getElementById('postDetail');
  if (!container) return;

  const id = getPostIdFromURL();
  if (!id) {
    container.innerHTML =
      '<div class="error-tip">' +
        '<p>未指定文章 ID</p>' +
        '<a class="btn-primary retry-btn" href="index.html">返回首页</a>' +
      '</div>';
    return;
  }

  // 加载状态
  container.innerHTML =
    '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<p>正在加载文章...</p>' +
    '</div>';

  try {
    const post = await fetchJSON('/api/posts/' + encodeURIComponent(id));
    renderPostDetail(post);
  } catch (e) {
    container.innerHTML =
      '<div class="error-tip">' +
        '<p>加载失败：' + escapeHTML(e.message) + '</p>' +
        '<a class="btn-primary retry-btn" href="index.html">返回首页</a>' +
      '</div>';
  }
}

/**
 * 渲染文章详情
 */
function renderPostDetail(post) {
  const container = document.getElementById('postDetail');
  if (!container) return;

  // 文档标题同步文章标题
  document.title = (post.title || '文章详情') + ' - 微信博客';

  var tagsHTML = (post.tags || []).map(function (t) {
    return '<span class="post-detail-tag">#' + escapeHTML(t) + '</span>';
  }).join('');

  container.innerHTML =
    '<button class="back-btn" onclick="history.back()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="15 18 9 12 15 6"></polyline>' +
      '</svg>' +
      '返回' +
    '</button>' +
    '<div class="post-detail-title-row">' +
      (post.announcement ? '<span class="post-pin-badge announcement-detail-badge">网站公告</span>' : '') +
      (post.pinned ? '<span class="post-pin-badge">置顶</span>' : '') +
      '<h1 class="post-detail-title">' + escapeHTML(post.title || '') + '</h1>' +
    '</div>' +
    '<div class="post-detail-meta">' +
      '<span class="post-card-category">' + escapeHTML(post.category || '未分类') + '</span>' +
      '<span class="post-detail-author">' + escapeHTML(post.author || 'Admin') + '</span>' +
      '<span class="meta-divider">·</span>' +
      '<span>' + formatDate(post.createdAt) + '</span>' +
      '<span class="meta-divider">·</span>' +
      '<span>' + (post.views || 0) + ' 次浏览</span>' +
      (tagsHTML ? '<span class="post-detail-tags">' + tagsHTML + '</span>' : '') +
    '</div>' +
    // 文章正文：content 为受信任的 HTML（后台编辑器产出），直接渲染
    '<div class="post-content">' + (post.content || '') + '</div>' +
    '<div class="post-detail-footer">' +
      '<a class="btn-primary" href="index.html">返回首页</a>' +
    '</div>' +
    '<div class="comment-section" id="postCommentSection" data-target-type="post" data-post-id="' + escapeHTML(String(post.id || '')) + '">' +
    '</div>';

  initCommentSection(document.getElementById('postCommentSection'));
}

/* ----------------------------
   留言区逻辑
   ---------------------------- */

function getFrontUser() {
  return {
    token: localStorage.getItem('frontToken') || '',
    username: localStorage.getItem('frontUsername') || ''
  };
}

const wechatEmojiList = [
  '😀', '😄', '😊', '😉', '😍', '😘', '😋', '😎',
  '😢', '😭', '😡', '😳', '😴', '😷', '🤔', '😅',
  '👍', '👎', '👏', '🙏', '💪', '👌', '🤝', '🙌',
  '❤️', '💔', '🌹', '🎉', '🎁', '🔥', '⭐', '☕'
];

function renderWechatEmojiPicker() {
  return '<div class="emoji-picker" data-role="emoji-picker">' +
    wechatEmojiList.map(function (emoji) {
      return '<button type="button" class="emoji-item" data-emoji="' + escapeHTML(emoji) + '">' + escapeHTML(emoji) + '</button>';
    }).join('') +
    '</div>';
}

function insertTextAtCursor(textarea, text) {
  if (!textarea) return;
  var start = textarea.selectionStart || 0;
  var end = textarea.selectionEnd || 0;
  var value = textarea.value || '';
  textarea.value = value.slice(0, start) + text + value.slice(end);
  var nextPos = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(nextPos, nextPos);
}

function renderCommentShell(section) {
  if (!section || section.dataset.ready === '1') return;
  const targetType = section.getAttribute('data-target-type') || 'home';
  const sectionId = section.id;
  const title = targetType === 'post' ? '文章留言' : (sectionId === 'aboutCommentSection' ? '留言反馈' : '主页留言');
  const user = getFrontUser();
  section.dataset.page = '1';
  section.dataset.ready = '1';
  section.innerHTML =
    '<div class="comment-header">' +
      '<div>' +
        '<h2>' + title + '</h2>' +
        '<p>欢迎留下想法，触碰审核关键词的留言会在管理员通过后显示。</p>' +
      '</div>' +
    '</div>' +
    '<form class="comment-form" data-role="comment-form">' +
      (!user.username ? '<input type="text" class="comment-input" name="authorName" maxlength="30" placeholder="游客昵称（可选）">' : '<div class="comment-user-tip">当前以「' + escapeHTML(user.username) + '」身份留言</div>') +
      '<textarea class="comment-textarea" name="content" maxlength="1000" placeholder="写下你的留言..." required></textarea>' +
      '<div class="emoji-toolbar">' +
        '<button type="button" class="emoji-toggle" data-role="emoji-toggle">表情</button>' +
        renderWechatEmojiPicker() +
      '</div>' +
      '<div class="comment-actions">' +
        '<button type="submit" class="btn-primary">提交留言</button>' +
        '<span class="comment-msg" data-role="comment-msg"></span>' +
      '</div>' +
    '</form>' +
    '<div class="comment-list" data-role="comment-list">' +
      '<div class="loading"><div class="spinner"></div><p>正在加载留言...</p></div>' +
    '</div>' +
    '<div class="comment-pagination" data-role="comment-pagination"></div>';
}

async function loadCommentsForSection(section, page) {
  if (!section) return;
  page = Math.max(1, Number(page) || 1);
  section.dataset.page = String(page);
  const list = section.querySelector('[data-role="comment-list"]');
  const pager = section.querySelector('[data-role="comment-pagination"]');
  if (list) {
    list.innerHTML = '<div class="loading"><div class="spinner"></div><p>正在加载留言...</p></div>';
  }
  if (pager) pager.innerHTML = '';

  const targetType = section.getAttribute('data-target-type') || 'home';
  const postId = section.getAttribute('data-post-id') || '';
  const params = new URLSearchParams({ targetType: targetType, page: String(page) });
  if (targetType === 'post') params.append('postId', postId);

  try {
    const data = await fetchJSON('/api/comments?' + params.toString());
    renderComments(section, data);
  } catch (err) {
    if (list) list.innerHTML = '<div class="error-tip"><p>留言加载失败：' + escapeHTML(err.message) + '</p></div>';
  }
}

function renderComments(section, data) {
  const list = section.querySelector('[data-role="comment-list"]');
  const pager = section.querySelector('[data-role="comment-pagination"]');
  const comments = data.comments || [];
  if (!list || !pager) return;

  if (!comments.length) {
    list.innerHTML = '<div class="empty comment-empty"><p>暂无留言，来做第一个留言的人吧。</p></div>';
  } else {
    list.innerHTML = comments.map(function (comment) {
      return (
        '<div class="comment-item">' +
          '<div class="comment-avatar">' + escapeHTML((comment.authorName || '游').slice(0, 1).toUpperCase()) + '</div>' +
          '<div class="comment-body">' +
            '<div class="comment-meta">' +
              '<span class="comment-author">' + escapeHTML(comment.authorName || '游客') + '</span>' +
              '<span>' + formatDate(comment.createdAt) + '</span>' +
            '</div>' +
            '<div class="comment-content">' + escapeHTML(comment.content || '') + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  if ((data.totalPages || 1) <= 1) {
    pager.innerHTML = '';
    return;
  }
  var current = Number(data.page) || 1;
  var totalPages = Number(data.totalPages) || 1;
  pager.innerHTML =
    '<button class="comment-page-btn" data-page="' + (current - 1) + '"' + (current <= 1 ? ' disabled' : '') + '>上一页</button>' +
    '<span class="comment-page-info">第 ' + current + ' / ' + totalPages + ' 页，共 ' + (data.total || 0) + ' 条</span>' +
    '<button class="comment-page-btn" data-page="' + (current + 1) + '"' + (current >= totalPages ? ' disabled' : '') + '>下一页</button>';
}

function initCommentSection(section) {
  if (!section) return;
  renderCommentShell(section);
  const form = section.querySelector('[data-role="comment-form"]');
  const msg = section.querySelector('[data-role="comment-msg"]');
  const pager = section.querySelector('[data-role="comment-pagination"]');
  const targetType = section.getAttribute('data-target-type') || 'home';
  const postId = section.getAttribute('data-post-id') || '';
  const emojiToggle = section.querySelector('[data-role="emoji-toggle"]');
  const emojiPicker = section.querySelector('[data-role="emoji-picker"]');
  const commentTextarea = form ? form.elements.content : null;

  if (emojiToggle && emojiPicker && emojiPicker.dataset.bound !== '1') {
    emojiPicker.dataset.bound = '1';
    emojiToggle.addEventListener('click', function () {
      emojiPicker.classList.toggle('show');
    });
    emojiPicker.addEventListener('click', function (e) {
      const emojiBtn = e.target.closest('.emoji-item');
      if (!emojiBtn) return;
      insertTextAtCursor(commentTextarea, emojiBtn.getAttribute('data-emoji') || '');
    });
  }

  if (form && form.dataset.bound !== '1') {
    form.dataset.bound = '1';
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const user = getFrontUser();
      const btn = form.querySelector('button[type="submit"]');
      const content = form.elements.content.value.trim();
      const authorName = form.elements.authorName ? form.elements.authorName.value.trim() : '';
      if (!content) {
        if (msg) msg.textContent = '请输入留言内容';
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = '提交中...';
      }
      if (msg) {
        msg.className = 'comment-msg';
        msg.textContent = '';
      }
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (user.token) headers.Authorization = 'Bearer ' + user.token;
        const res = await fetch('/api/comments', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ targetType: targetType, postId: postId, authorName: authorName, content: content })
        });
        const data = await parseResponse(res);
        form.reset();
        if (msg) {
          msg.className = 'comment-msg success';
          msg.textContent = data.message || '留言发布成功';
        }
        loadCommentsForSection(section, 1);
      } catch (err) {
        if (msg) {
          msg.className = 'comment-msg error';
          msg.textContent = err.message || '提交失败';
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '提交留言';
        }
      }
    });
  }

  if (pager && pager.dataset.bound !== '1') {
    pager.dataset.bound = '1';
    pager.addEventListener('click', function (e) {
      const btn = e.target.closest('.comment-page-btn');
      if (!btn || btn.disabled) return;
      loadCommentsForSection(section, Number(btn.getAttribute('data-page')) || 1);
    });
  }

  loadCommentsForSection(section, Number(section.dataset.page) || 1);
}

/* ----------------------------
   页面初始化入口
   ---------------------------- */

document.addEventListener('DOMContentLoaded', function () {
  // 加载站点 Logo / 名称
  initSiteSettings();

  // 初始化前台注册登录按钮与表单
  initFrontAuthActions();
  initFrontAuthForms();
  initProfilePage();
  initSubmissionForm();

  // 初始化手机端底部导航
  initMobileTabbar();

  // 初始化搜索功能（两个页面都有搜索框）
  initSearch();

  // 根据页面元素判断当前页面
  if (document.getElementById('app')) {
    // 首页：加载公告、分类和普通文章列表
    loadAnnouncements();
    loadCategories();
    loadPosts();
    initCommentSection(document.getElementById('homeCommentSection'));
  } else if (document.getElementById('postDetail')) {
    // 详情页
    loadPostDetail();
  } else if (document.getElementById('friendGrid')) {
    // 友链页
    loadFriends();
    initFriendSubmit();
  } else if (document.getElementById('aboutPage')) {
    // 关于页
    loadAboutPage();
    initCommentSection(document.getElementById('aboutCommentSection'));
  }
  protectGlobalFooter();
});
