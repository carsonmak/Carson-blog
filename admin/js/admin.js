/* ============================================================
   CARSON 管理后台 - 核心逻辑
   ============================================================ */

(function () {
  'use strict';

  /* -------------------- 工具函数 -------------------- */

  /**
   * 格式化日期为 YYYY-MM-DD HH:mm
   */
  function formatDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /**
   * 从对象中按优先键取值（兼容多种字段命名）
   */
  function pick(obj, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) {
        return obj[keys[i]];
      }
    }
    return fallback === undefined ? 0 : fallback;
  }

  /**
   * HTML 转义，防止 XSS
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Toast 提示
   */
  var toastTimer = null;
  function showToast(msg) {
    var toast = document.getElementById('toast');
    if (!toast) {
      alert(msg);
      return;
    }
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  /**
   * 根据数组生成标签 HTML
   */
  function renderTagsHtml(tags) {
    if (!tags || !tags.length) return '<span style="color:#ccc">-</span>';
    return tags.map(function (t) {
      return '<span class="tag-item">' + escapeHtml(t) + '</span>';
    }).join('');
  }


  function decodeProtectedText(parts) {
    return parts.map(function (code) { return String.fromCharCode(code); }).join('');
  }

  function renderAdminProtectedFooter() {
    var footer = document.getElementById('adminProtectedFooter');
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'adminProtectedFooter';
      footer.className = 'admin-protected-footer';
      document.body.appendChild(footer);
    }
    footer.setAttribute('data-protected-footer', '1');
    var carson = decodeProtectedText([67, 65, 82, 83, 79, 78]);
    var year = decodeProtectedText([50, 48, 50, 54]);
    footer.innerHTML = '© ' + year + ' Powered by ' +
      '<a href="https://520816.xyz" target="_blank" rel="noopener noreferrer">' + carson + '</a>' +
      ' ｜管理系统';
  }

  function protectAdminFooter() {
    renderAdminProtectedFooter();
    if (window.__adminFooterObserver) return;
    window.__adminFooterObserver = new MutationObserver(function () {
      var footer = document.getElementById('adminProtectedFooter');
      if (!footer || !footer.textContent.includes('CARSON') || !footer.textContent.includes('管理系统')) {
        renderAdminProtectedFooter();
      }
    });
    window.__adminFooterObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* -------------------- API 请求封装 -------------------- */

  /**
   * 统一 API 请求，自动携带 token
   * @param {string} url  请求地址
   * @param {string} method  HTTP 方法
   * @param {object|null} body  请求体
   * @returns {Promise<object>}
   */
  async function apiRequest(url, method, body) {
    method = method || 'GET';
    var token = localStorage.getItem('token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    var options = { method: method, headers: headers };
    if (body !== undefined && body !== null) {
      options.body = JSON.stringify(body);
    }

    var res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      throw new Error('网络请求失败，请检查网络连接');
    }

    // 401 未授权 → 清除登录态并跳转
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      showToast('登录已过期，请重新登录');
      setTimeout(function () {
        window.location.href = 'login.html';
      }, 800);
      throw new Error('Unauthorized');
    }

    var data;
    var text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = {};
    }

    if (!res.ok) {
      var msg = data.message || data.error || data.msg || ('请求失败 (' + res.status + ')');
      throw new Error(msg);
    }
    return data;
  }

  /**
   * 表单上传请求，自动携带 token，不设置 Content-Type 以便浏览器生成 multipart 边界
   */
  async function apiFormRequest(url, method, formData) {
    method = method || 'POST';
    var token = localStorage.getItem('token');
    var headers = {};
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var res;
    try {
      res = await fetch(url, {
        method: method,
        headers: headers,
        body: formData
      });
    } catch (err) {
      throw new Error('网络请求失败，请检查网络连接');
    }

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      showToast('登录已过期，请重新登录');
      setTimeout(function () {
        window.location.href = 'login.html';
      }, 800);
      throw new Error('Unauthorized');
    }

    var text = await res.text();
    var data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || ('请求失败 (' + res.status + ')'));
    }
    return data;
  }

  /* -------------------- 认证相关 -------------------- */

  function getToken() {
    return localStorage.getItem('token');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  /**
   * 页面加载时校验 token
   */
  async function checkAuth() {
    var token = getToken();
    if (!token) {
      window.location.href = 'login.html';
      return false;
    }
    try {
      var data = await apiRequest('/api/auth/verify', 'GET');
      if (data && data.valid) {
        return true;
      }
      window.location.href = 'login.html';
      return false;
    } catch (e) {
      // verify 失败时 apiRequest 内部已处理跳转
      return false;
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
  }

  /* -------------------- 登录页逻辑 -------------------- */

  function initLoginPage() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var usernameInput = document.getElementById('username');
      var passwordInput = document.getElementById('password');
      var loginBtn = document.getElementById('loginBtn');

      var username = usernameInput.value.trim();
      var password = passwordInput.value;

      if (!username || !password) {
        showToast('请输入用户名和密码');
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = '登录中...';

      try {
        var data = await apiRequest('/api/auth/login', 'POST', {
          username: username,
          password: password
        });
        if (data && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('username', data.username || username);
          showToast('登录成功');
          setTimeout(function () {
            window.location.href = 'index.html';
          }, 500);
        } else {
          showToast(data.message || '登录失败');
          loginBtn.disabled = false;
          loginBtn.textContent = '登 录';
        }
      } catch (err) {
        showToast(err.message || '登录失败');
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
      }
    });
  }

  /* -------------------- 后台管理逻辑 -------------------- */

  // 当前编辑的文章 ID（null 表示新建）
  var editingPostId = null;
  // 分类缓存
  var cachedCategories = [];
  // DZ 论坛风格编辑器实例
  var dzEditorInstance = null;

  /**
   * 显示某个页面，隐藏其他
   */
  function showPage(page, postId) {
    var pages = document.querySelectorAll('.page');
    pages.forEach(function (p) { p.classList.remove('active'); });

    var target = document.getElementById('page-' + page);
    if (target) {
      target.classList.add('active');
    }

    // 更新导航高亮
    var navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(function (n) { n.classList.remove('active'); });
    var activeNav = document.querySelector('.sidebar-nav .nav-item[data-page="' + page + '"]');
    if (activeNav) {
      activeNav.classList.add('active');
    }

    // 更新标题
    var titleMap = {
      dashboard: '仪表盘',
      posts: '文章管理',
      editor: postId ? '编辑文章' : '写文章',
      categories: '分类管理',
      friends: '友链管理',
      comments: '留言管理',
      cache: '缓存管理',
      settings: '网站设置'
    };
    var pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) {
      pageTitleEl.textContent = titleMap[page] || '';
    }

    // 按页面加载数据
    if (page === 'dashboard') {
      loadDashboard();
    } else if (page === 'posts') {
      loadPosts();
    } else if (page === 'editor') {
      loadEditor(postId || null);
    } else if (page === 'categories') {
      clearCategoryForm();
      loadCategoriesAdmin();
    } else if (page === 'friends') {
      clearFriendForm();
      loadFriends();
    } else if (page === 'comments') {
      loadCommentSettings();
      loadComments();
    } else if (page === 'cache') {
      loadCacheStats();
    } else if (page === 'settings') {
      loadSiteSettings();
    }

    // 移动端关闭侧边栏
    closeSidebar();
  }

  /* ---------- 仪表盘 ---------- */

  async function loadDashboard() {
    // 加载统计数据
    var statGrid = document.getElementById('statGrid');
    if (statGrid) {
      statGrid.innerHTML = '<div class="loading"><div class="spinner"></div><br>加载统计中...</div>';
    }
    try {
      var stats = await apiRequest('/api/admin/stats', 'GET');
      renderStats(stats || {});
    } catch (err) {
      if (statGrid) {
        statGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>统计数据加载失败</p></div>';
      }
    }

    // 加载最近文章
    var recentList = document.getElementById('recentList');
    if (recentList) {
      recentList.innerHTML = '<li class="loading"><div class="spinner"></div><br>加载中...</li>';
    }
    try {
      var posts = await apiRequest('/api/admin/posts', 'GET');
      renderRecentPosts(posts || []);
    } catch (err) {
      if (recentList) {
        recentList.innerHTML = '<li class="empty-state"><div class="empty-icon">📄</div><p>暂无文章数据</p></li>';
      }
    }
  }

  function renderStats(stats) {
    var statGrid = document.getElementById('statGrid');
    if (!statGrid) return;

    var total = pick(stats, ['totalPosts', 'total', 'posts', 'count']);
    var published = pick(stats, ['publishedPosts', 'published', 'publishedCount']);
    var views = pick(stats, ['totalViews', 'views', 'totalView', 'viewCount']);
    var categories = pick(stats, ['totalCategories', 'categories', 'categoryCount']);
    var tags = pick(stats, ['totalTags', 'tags', 'tagCount']);
    var drafts = pick(stats, ['draftPosts', 'drafts', 'draftCount']);
    if (!drafts && total && published) {
      drafts = total - published;
      if (isNaN(drafts) || drafts < 0) drafts = 0;
    }

    var cards = [
      { icon: '📄', label: '总文章数', value: total, bg: '#E8F8EF' },
      { icon: '📢', label: '已发布', value: published, bg: '#E8F8EF' },
      { icon: '📝', label: '草稿', value: drafts, bg: '#FFF3E0' },
      { icon: '👁', label: '总浏览量', value: views, bg: '#E8F8EF' },
      { icon: '📁', label: '总分类', value: categories, bg: '#F0F5FF' },
      { icon: '🏷', label: '总标签', value: tags, bg: '#FFF1F0' }
    ];

    statGrid.innerHTML = cards.map(function (c) {
      return (
        '<div class="stat-card">' +
          '<div class="stat-icon" style="background:' + c.bg + '">' + c.icon + '</div>' +
          '<div class="stat-body">' +
            '<div class="stat-value">' + escapeHtml(String(c.value)) + '</div>' +
            '<div class="stat-label">' + c.label + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderRecentPosts(posts) {
    var recentList = document.getElementById('recentList');
    if (!recentList) return;

    if (!posts.length) {
      recentList.innerHTML = '<li class="empty-state"><div class="empty-icon">📄</div><p>还没有文章，去写一篇吧</p></li>';
      return;
    }

    var recent = posts.slice(0, 6);
    recentList.innerHTML = recent.map(function (p) {
      return (
        '<li>' +
          '<span class="recent-title">' + escapeHtml(p.title || '无标题') + '</span>' +
          '<span class="recent-meta">' + (p.published ? '已发布' : '草稿') + ' · ' + formatDate(p.createdAt) + '</span>' +
        '</li>'
      );
    }).join('');
  }

  /* ---------- 文章列表 ---------- */

  async function loadPosts() {
    var tbody = document.getElementById('postsTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div><br>加载中...</div></td></tr>';
    }
    try {
      var posts = await apiRequest('/api/admin/posts', 'GET');
      renderPostTable(posts || []);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⚠️</div><p>' + escapeHtml(err.message) + '</p></div></td></tr>';
      }
    }
  }

  function renderPostTable(posts) {
    var tbody = document.getElementById('postsTableBody');
    if (!tbody) return;

    if (!posts.length) {
      tbody.innerHTML = (
        '<tr><td colspan="7"><div class="empty-state">' +
        '<div class="empty-icon">📄</div>' +
        '<p>暂无文章，点击右上角"写文章"开始创作</p>' +
        '</div></td></tr>'
      );
      return;
    }

    tbody.innerHTML = posts.map(function (p) {
      var statusBadge = p.published
        ? '<span class="badge badge-published">已发布</span>'
        : '<span class="badge badge-draft">草稿</span>';
      var typeBadges = '';
      if (p.pinned) typeBadges += '<span class="badge badge-pinned">置顶</span>';
      if (p.showOnHome) typeBadges += '<span class="badge badge-home">首页</span>';
      if (p.announcement) typeBadges += '<span class="badge badge-announcement">公告</span>';
      var categoryBadge = p.category
        ? '<span class="badge badge-category">' + escapeHtml(p.category) + '</span>'
        : '<span style="color:#ccc">-</span>';

      return (
        '<tr>' +
          '<td><div class="table-title-cell">' + escapeHtml(p.title || '无标题') + '</div><div class="post-type-badges">' + typeBadges + '</div></td>' +
          '<td>' + categoryBadge + '</td>' +
          '<td>' + renderTagsHtml(p.tags) + '</td>' +
          '<td>' + (p.views || 0) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="white-space:nowrap">' + formatDate(p.createdAt) + '</td>' +
          '<td>' +
            '<div class="row-actions">' +
              '<button class="btn btn-sm btn-ghost btn-edit" data-id="' + escapeHtml(String(p.id)) + '">编辑</button>' +
              '<button class="btn btn-sm btn-danger btn-delete" data-id="' + escapeHtml(String(p.id)) + '" data-title="' + escapeHtml(p.title || '') + '">删除</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  /* ---------- 文章编辑 ---------- */

  /**
   * 初始化 DZ 论坛风格编辑器（仅初始化一次，复用实例）
   */
  function initDzEditor() {
    var wrap = document.getElementById('dzEditorWrap');
    var textarea = document.getElementById('postContent');
    if (!wrap || !textarea || typeof window.DzEditor === 'undefined') return null;
    if (!dzEditorInstance) {
      dzEditorInstance = new window.DzEditor({
        container: wrap,
        textarea: textarea,
        placeholder: '请输入文章内容，支持富文本排版...',
        onUploadImage: async function (file) {
          var formData = new FormData();
          formData.append('image', file);
          var data = await apiFormRequest('/api/admin/uploads/images', 'POST', formData);
          return { url: data.url, html: data.html };
        }
      });
    }
    return dzEditorInstance;
  }

  /**
   * 加载编辑器：有 id 为编辑，无 id 为新建
   */
  async function loadEditor(postId) {
    editingPostId = postId || null;

    // 先确保分类已加载
    await ensureCategories();

    var editorTitle = document.getElementById('editorTitle');
    var form = document.getElementById('postForm');
    if (form) form.reset();

    // 初始化 DZ 编辑器
    var dzEditor = initDzEditor();

    if (postId) {
      if (editorTitle) editorTitle.textContent = '编辑文章';
      try {
        var post = await apiRequest('/api/admin/posts/' + encodeURIComponent(postId), 'GET');
        fillForm(post);
      } catch (err) {
        showToast(err.message || '加载文章失败');
        showPage('posts');
      }
    } else {
      if (editorTitle) editorTitle.textContent = '写文章';
      clearForm();
    }
  }

  /**
   * 确保分类下拉数据已加载
   */
  var categoriesLoaded = false;
  async function ensureCategories() {
    if (categoriesLoaded) {
      fillCategorySelect(cachedCategories);
      return;
    }
    try {
      var meta = await apiRequest('/api/meta', 'GET');
      cachedCategories = (meta && meta.categories) || [];
      categoriesLoaded = true;
      fillCategorySelect(cachedCategories);
    } catch (err) {
      fillCategorySelect([]);
    }
  }

  function fillCategorySelect(categories) {
    var select = document.getElementById('postCategory');
    if (!select) return;
    var currentVal = select.value;
    var html = '<option value="">请选择分类</option>';
    categories.forEach(function (c) {
      html += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    });
    select.innerHTML = html;
    select.value = currentVal;
  }

  function fillForm(post) {
    document.getElementById('postId').value = post.id || '';
    document.getElementById('postTitle').value = post.title || '';
    document.getElementById('postCategory').value = post.category || '';
    document.getElementById('postTags').value = (post.tags || []).join(', ');
    document.getElementById('postSummary').value = post.summary || '';
    // 同步内容到 DZ 编辑器（若已初始化）
    if (dzEditorInstance) {
      dzEditorInstance.setContent(post.content || '');
    } else {
      document.getElementById('postContent').value = post.content || '';
    }
    document.getElementById('postPublished').checked = post.published !== false;
    document.getElementById('postPinned').checked = !!post.pinned;
    document.getElementById('postShowOnHome').checked = post.showOnHome === true;
    document.getElementById('postAnnouncement').checked = !!post.announcement;
    updatePublishLabel();
  }

  function clearForm() {
    document.getElementById('postId').value = '';
    document.getElementById('postTitle').value = '';
    document.getElementById('postCategory').value = '';
    document.getElementById('postTags').value = '';
    document.getElementById('postSummary').value = '';
    // 清空 DZ 编辑器内容
    if (dzEditorInstance) {
      dzEditorInstance.setContent('');
    } else {
      document.getElementById('postContent').value = '';
    }
    document.getElementById('postPublished').checked = true;
    document.getElementById('postPinned').checked = false;
    document.getElementById('postShowOnHome').checked = false;
    document.getElementById('postAnnouncement').checked = false;
    updatePublishLabel();
  }

  function updatePublishLabel() {
    var checkbox = document.getElementById('postPublished');
    var label = document.getElementById('publishLabel');
    if (checkbox && label) {
      label.textContent = checkbox.checked ? '已发布' : '草稿';
    }
  }

  function collectFormData() {
    // 先同步 DZ 编辑器内容到隐藏 textarea
    if (dzEditorInstance) dzEditorInstance.sync();
    var tagsRaw = document.getElementById('postTags').value.trim();
    var tags = tagsRaw
      ? tagsRaw.split(/[,，]/).map(function (t) { return t.trim(); }).filter(function (t) { return t; })
      : [];

    return {
      title: document.getElementById('postTitle').value.trim(),
      summary: document.getElementById('postSummary').value.trim(),
      content: document.getElementById('postContent').value,
      cover: '',
      author: localStorage.getItem('username') || 'Admin',
      category: document.getElementById('postCategory').value,
      tags: tags,
      published: document.getElementById('postPublished').checked,
      pinned: document.getElementById('postPinned').checked,
      showOnHome: document.getElementById('postShowOnHome').checked,
      announcement: document.getElementById('postAnnouncement').checked
    };
  }

  function insertTextToTextarea(textarea, text) {
    if (!textarea) return;
    var start = textarea.selectionStart || textarea.value.length;
    var end = textarea.selectionEnd || textarea.value.length;
    var value = textarea.value || '';
    textarea.value = value.slice(0, start) + text + value.slice(end);
    var nextPos = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(nextPos, nextPos);
  }

  async function uploadArticleImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('文章图片不能大于 5MB');
      return;
    }
    var formData = new FormData();
    formData.append('image', file);
    try {
      var data = await apiFormRequest('/api/admin/uploads/images', 'POST', formData);
      var html = data.html || ('<p><img src="' + data.url + '" alt="文章图片"></p>');
      // 优先插入 DZ 编辑器，否则回退到 textarea
      if (dzEditorInstance) {
        var contentEl = dzEditorInstance.area;
        contentEl.focus();
        document.execCommand('insertHTML', false, '\n' + html + '\n');
        dzEditorInstance.sync();
      } else {
        insertTextToTextarea(document.getElementById('postContent'), '\n' + html + '\n');
      }
      showToast('图片已上传并插入正文');
    } catch (err) {
      showToast(err.message || '图片上传失败');
    }
  }

  async function savePost(e) {
    if (e) e.preventDefault();

    var data = collectFormData();
    if (!data.title) {
      showToast('请输入文章标题');
      return;
    }
    if (!data.content) {
      showToast('请输入文章内容');
      return;
    }

    var saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      if (editingPostId) {
        await apiRequest('/api/admin/posts/' + encodeURIComponent(editingPostId), 'PUT', data);
        showToast('文章更新成功');
      } else {
        await apiRequest('/api/admin/posts', 'POST', data);
        showToast('文章创建成功');
      }
      setTimeout(function () {
        showPage('posts');
      }, 600);
    } catch (err) {
      showToast(err.message || '保存失败');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存文章';
      }
    }
  }

  /* ---------- 删除文章 ---------- */

  var pendingDeleteId = null;

  function openDeleteModal(id, title) {
    pendingDeleteId = id;
    var desc = document.getElementById('deleteDesc');
    if (desc) {
      desc.textContent = '确定要删除「' + (title || '该文章') + '」吗？此操作不可恢复。';
    }
    var modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('show');
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    var modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('show');
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    var confirmBtn = document.getElementById('confirmDelete');
    if (confirmBtn) {
      confirmBtn.textContent = '删除中...';
      confirmBtn.disabled = true;
    }
    try {
      await apiRequest('/api/admin/posts/' + encodeURIComponent(pendingDeleteId), 'DELETE');
      showToast('删除成功');
      closeDeleteModal();
      loadPosts();
    } catch (err) {
      showToast(err.message || '删除失败');
    } finally {
      if (confirmBtn) {
        confirmBtn.textContent = '确定删除';
        confirmBtn.disabled = false;
      }
    }
  }

  /* ---------- 友链管理 ---------- */

  var cachedFriends = [];
  var editingFriendId = null;

  function getFriendStatusText(status) {
    if (status === 'approved') return '审核通过';
    if (status === 'rejected') return '审核不通过';
    return '待审核';
  }

  function getFriendStatusClass(status) {
    if (status === 'approved') return 'badge-published';
    if (status === 'rejected') return 'badge-rejected';
    return 'badge-draft';
  }

  async function loadFriends() {
    var tbody = document.getElementById('friendsTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div><br>加载中...</div></td></tr>';
    }
    try {
      cachedFriends = await apiRequest('/api/admin/friends', 'GET') || [];
      renderFriendsTable(cachedFriends);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><p>' + escapeHtml(err.message) + '</p></div></td></tr>';
      }
    }
  }

  function renderFriendsTable(friends) {
    var tbody = document.getElementById('friendsTableBody');
    if (!tbody) return;

    if (!friends.length) {
      tbody.innerHTML = (
        '<tr><td colspan="6"><div class="empty-state">' +
        '<div class="empty-icon">🤝</div>' +
        '<p>暂无友链，可以在上方添加或等待用户提交</p>' +
        '</div></td></tr>'
      );
      return;
    }

    tbody.innerHTML = friends.map(function (friend, index) {
      var icon = friend.avatar || friend.iconUrl || '';
      var avatar = icon
        ? '<img class="admin-friend-avatar" src="' + escapeHtml(icon) + '" alt="' + escapeHtml(friend.name || '友链') + '头像">'
        : '<span class="admin-friend-avatar avatar-placeholder-small">' + escapeHtml((friend.name || '友').slice(0, 1).toUpperCase()) + '</span>';
      var statusBadge = '<span class="badge ' + getFriendStatusClass(friend.status) + '">' + getFriendStatusText(friend.status) + '</span>';
      return (
        '<tr>' +
          '<td class="friend-order-cell">' + (index + 1) + '</td>' +
          '<td>' +
            '<div class="friend-site-cell">' +
              avatar +
              '<div class="friend-site-info">' +
                '<div class="friend-site-name">' + escapeHtml(friend.name || '未命名站点') + '</div>' +
                '<div class="friend-site-desc">' + escapeHtml(friend.description || '-') + '</div>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><a href="' + escapeHtml(friend.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(friend.url || '-') + '</a></td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="white-space:nowrap">' + formatDate(friend.createdAt) + '</td>' +
          '<td>' +
            '<div class="row-actions">' +
              '<button class="btn btn-sm btn-primary btn-friend-approve" data-id="' + escapeHtml(String(friend.id)) + '">通过</button>' +
              '<button class="btn btn-sm btn-ghost btn-friend-reject" data-id="' + escapeHtml(String(friend.id)) + '">不通过</button>' +
              '<button class="btn btn-sm btn-ghost btn-friend-edit" data-id="' + escapeHtml(String(friend.id)) + '">编辑</button>' +
              '<button class="btn btn-sm btn-danger btn-friend-delete" data-id="' + escapeHtml(String(friend.id)) + '">删除</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function clearFriendForm() {
    editingFriendId = null;
    var form = document.getElementById('friendForm');
    if (form) form.reset();
    var idInput = document.getElementById('friendId');
    if (idInput) idInput.value = '';
    var status = document.getElementById('friendStatus');
    if (status) status.value = 'approved';
    var title = document.getElementById('friendEditorTitle');
    if (title) title.textContent = '添加友链';
    renderFriendAvatarPreview('');
  }

  function renderFriendAvatarPreview(avatar) {
    var preview = document.getElementById('friendAvatarPreview');
    if (!preview) return;
    if (!avatar) {
      preview.innerHTML = '<span class="form-help">当前没有头像，保存时可上传新的小头像。</span>';
      return;
    }
    preview.innerHTML = '<img src="' + escapeHtml(avatar) + '" alt="当前友链头像"><span>当前头像</span>';
  }

  function fillFriendForm(friend) {
    editingFriendId = friend.id;
    document.getElementById('friendId').value = friend.id || '';
    document.getElementById('friendName').value = friend.name || '';
    document.getElementById('friendUrl').value = friend.url || '';
    document.getElementById('friendDescription').value = friend.description || '';
    document.getElementById('friendIconUrl').value = friend.iconUrl || '';
    document.getElementById('friendStatus').value = friend.status || 'pending';
    document.getElementById('friendAvatar').value = '';
    var title = document.getElementById('friendEditorTitle');
    if (title) title.textContent = '编辑友链';
    renderFriendAvatarPreview(friend.avatar || '');
  }

  function collectFriendFormData() {
    var avatar = document.getElementById('friendAvatar');
    var file = avatar && avatar.files && avatar.files[0];
    if (file && file.size > 1024 * 1024) {
      throw new Error('头像图片不能大于 1MB');
    }
    var formData = new FormData();
    formData.append('name', document.getElementById('friendName').value.trim());
    formData.append('url', document.getElementById('friendUrl').value.trim());
    formData.append('description', document.getElementById('friendDescription').value.trim());
    formData.append('iconUrl', document.getElementById('friendIconUrl').value.trim());
    formData.append('status', document.getElementById('friendStatus').value);
    formData.append('visible', document.getElementById('friendStatus').value === 'approved' ? 'true' : 'false');
    if (file) formData.append('avatar', file);
    return formData;
  }

  async function saveFriend(e) {
    if (e) e.preventDefault();
    var saveBtn = document.getElementById('saveFriendBtn');
    try {
      var name = document.getElementById('friendName').value.trim();
      var url = document.getElementById('friendUrl').value.trim();
      if (!name || !url) {
        showToast('请填写站点名称和链接');
        return;
      }

      var formData = collectFriendFormData();
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      if (editingFriendId) {
        await apiFormRequest('/api/admin/friends/' + encodeURIComponent(editingFriendId), 'PUT', formData);
        showToast('友链更新成功');
      } else {
        await apiFormRequest('/api/admin/friends', 'POST', formData);
        showToast('友链添加成功');
      }
      clearFriendForm();
      loadFriends();
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存友链';
      }
    }
  }

  async function updateFriendStatus(id, status) {
    try {
      await apiRequest('/api/admin/friends/' + encodeURIComponent(id) + '/status', 'PATCH', { status: status });
      showToast(status === 'approved' ? '已审核通过' : '已设为审核不通过');
      loadFriends();
    } catch (err) {
      showToast(err.message || '操作失败');
    }
  }

  async function deleteFriend(id) {
    if (!confirm('确定要删除这条友链吗？此操作不可恢复。')) return;
    try {
      await apiRequest('/api/admin/friends/' + encodeURIComponent(id), 'DELETE');
      showToast('友链删除成功');
      if (editingFriendId === id) clearFriendForm();
      loadFriends();
    } catch (err) {
      showToast(err.message || '删除失败');
    }
  }

  /* ---------- 分类管理 ---------- */

  var editingCategoryName = '';

  async function loadCategoriesAdmin() {
    var tbody = document.getElementById('categoriesTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="3"><div class="loading"><div class="spinner"></div><br>加载中...</div></td></tr>';
    }
    try {
      var categories = await apiRequest('/api/admin/categories', 'GET') || [];
      renderCategoriesTable(categories);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">⚠️</div><p>' + escapeHtml(err.message) + '</p></div></td></tr>';
      }
    }
  }

  function renderCategoriesTable(categories) {
    var tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;
    if (!categories.length) {
      tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">📁</div><p>暂无分类，请在上方添加</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = categories.map(function (cat) {
      return (
        '<tr>' +
          '<td><span class="badge badge-category">' + escapeHtml(cat.name) + '</span></td>' +
          '<td>' + (cat.postCount || 0) + '</td>' +
          '<td>' +
            '<div class="row-actions">' +
              '<button class="btn btn-sm btn-ghost btn-category-edit" data-name="' + escapeHtml(cat.name) + '">编辑</button>' +
              '<button class="btn btn-sm btn-danger btn-category-delete" data-name="' + escapeHtml(cat.name) + '" data-count="' + (cat.postCount || 0) + '">删除</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function clearCategoryForm() {
    editingCategoryName = '';
    var input = document.getElementById('categoryNameInput');
    var hidden = document.getElementById('editingCategoryName');
    var title = document.getElementById('categoryEditorTitle');
    var btn = document.getElementById('saveCategoryBtn');
    if (input) input.value = '';
    if (hidden) hidden.value = '';
    if (title) title.textContent = '添加分类';
    if (btn) btn.textContent = '保存分类';
  }

  async function saveCategory(e) {
    if (e) e.preventDefault();
    var input = document.getElementById('categoryNameInput');
    var btn = document.getElementById('saveCategoryBtn');
    var name = input ? input.value.trim() : '';
    if (!name) {
      showToast('请输入分类名称');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中...';
    }
    try {
      if (editingCategoryName) {
        await apiRequest('/api/admin/categories/' + encodeURIComponent(editingCategoryName), 'PUT', { name: name });
        showToast('分类已更新');
      } else {
        await apiRequest('/api/admin/categories', 'POST', { name: name });
        showToast('分类已添加');
      }
      categoriesLoaded = false;
      clearCategoryForm();
      loadCategoriesAdmin();
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = editingCategoryName ? '更新分类' : '保存分类';
      }
    }
  }

  function editCategory(name) {
    editingCategoryName = name;
    var input = document.getElementById('categoryNameInput');
    var hidden = document.getElementById('editingCategoryName');
    var title = document.getElementById('categoryEditorTitle');
    var btn = document.getElementById('saveCategoryBtn');
    if (input) {
      input.value = name;
      input.focus();
    }
    if (hidden) hidden.value = name;
    if (title) title.textContent = '编辑分类';
    if (btn) btn.textContent = '更新分类';
  }

  async function deleteCategory(name, postCount) {
    if (Number(postCount) > 0) {
      showToast('该分类下还有文章，不能删除。请先修改文章分类。');
      return;
    }
    if (!confirm('确定要删除分类「' + name + '」吗？')) return;
    try {
      await apiRequest('/api/admin/categories/' + encodeURIComponent(name), 'DELETE');
      showToast('分类删除成功');
      categoriesLoaded = false;
      if (editingCategoryName === name) clearCategoryForm();
      loadCategoriesAdmin();
    } catch (err) {
      showToast(err.message || '删除失败');
    }
  }

  /* ---------- 留言管理 ---------- */

  function getCommentStatusText(status) {
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '不通过';
    return '待审核';
  }

  function getCommentStatusClass(status) {
    if (status === 'approved') return 'badge-published';
    if (status === 'rejected') return 'badge-rejected';
    return 'badge-draft';
  }

  function getCommentTargetText(comment) {
    if (comment.targetType === 'home') return '主页留言区';
    return comment.targetTitle || '文章留言区';
  }

  async function loadCommentSettings() {
    try {
      var settings = await apiRequest('/api/admin/comment-settings', 'GET');
      var homeInput = document.getElementById('homepagePageSize');
      var postInput = document.getElementById('postPageSize');
      var keywordsInput = document.getElementById('blockedKeywords');
      if (homeInput) homeInput.value = settings.homepagePageSize || 5;
      if (postInput) postInput.value = settings.postPageSize || 10;
      if (keywordsInput) keywordsInput.value = (settings.blockedKeywords || []).join('\n');
    } catch (err) {
      showToast(err.message || '留言设置加载失败');
    }
  }

  async function saveCommentSettings(e) {
    if (e) e.preventDefault();
    var btn = document.getElementById('saveCommentSettingsBtn');
    var data = {
      homepagePageSize: Number(document.getElementById('homepagePageSize').value) || 5,
      postPageSize: Number(document.getElementById('postPageSize').value) || 10,
      blockedKeywords: document.getElementById('blockedKeywords').value
    };
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中...';
    }
    try {
      await apiRequest('/api/admin/comment-settings', 'POST', data);
      showToast('留言设置保存成功');
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '保存留言设置';
      }
    }
  }

  async function loadComments() {
    var tbody = document.getElementById('commentsTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div><br>加载中...</div></td></tr>';
    }
    var params = new URLSearchParams();
    var status = document.getElementById('commentStatusFilter')?.value || '';
    var targetType = document.getElementById('commentTargetFilter')?.value || '';
    if (status) params.append('status', status);
    if (targetType) params.append('targetType', targetType);
    try {
      var query = params.toString();
      var comments = await apiRequest('/api/admin/comments' + (query ? '?' + query : ''), 'GET');
      renderCommentsTable(comments || []);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><p>' + escapeHtml(err.message) + '</p></div></td></tr>';
      }
    }
  }

  function renderCommentsTable(comments) {
    var tbody = document.getElementById('commentsTableBody');
    if (!tbody) return;
    if (!comments.length) {
      tbody.innerHTML = (
        '<tr><td colspan="6"><div class="empty-state">' +
        '<div class="empty-icon">💬</div>' +
        '<p>暂无留言</p>' +
        '</div></td></tr>'
      );
      return;
    }

    tbody.innerHTML = comments.map(function (comment) {
      var statusBadge = '<span class="badge ' + getCommentStatusClass(comment.status) + '">' + getCommentStatusText(comment.status) + '</span>';
      var keywordHtml = (comment.matchedKeywords || []).length
        ? '<div class="comment-keywords">触碰关键词：' + escapeHtml(comment.matchedKeywords.join('、')) + '</div>'
        : '';
      return (
        '<tr>' +
          '<td><div class="comment-content-cell">' + escapeHtml(comment.content || '') + '</div>' + keywordHtml + '</td>' +
          '<td>' + escapeHtml(comment.authorName || '游客') + '</td>' +
          '<td><div class="comment-target-cell">' + escapeHtml(getCommentTargetText(comment)) + '</div></td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="white-space:nowrap">' + formatDate(comment.createdAt) + '</td>' +
          '<td>' +
            '<div class="row-actions">' +
              '<button class="btn btn-sm btn-primary btn-comment-approve" data-id="' + escapeHtml(String(comment.id)) + '">通过</button>' +
              '<button class="btn btn-sm btn-ghost btn-comment-pending" data-id="' + escapeHtml(String(comment.id)) + '">待审</button>' +
              '<button class="btn btn-sm btn-ghost btn-comment-reject" data-id="' + escapeHtml(String(comment.id)) + '">不通过</button>' +
              '<button class="btn btn-sm btn-danger btn-comment-delete" data-id="' + escapeHtml(String(comment.id)) + '">删除</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  async function updateCommentStatus(id, status) {
    try {
      await apiRequest('/api/admin/comments/' + encodeURIComponent(id) + '/status', 'PATCH', { status: status });
      showToast('留言状态已更新');
      loadComments();
    } catch (err) {
      showToast(err.message || '操作失败');
    }
  }

  async function deleteComment(id) {
    if (!confirm('确定要删除这条留言吗？此操作不可恢复。')) return;
    try {
      await apiRequest('/api/admin/comments/' + encodeURIComponent(id), 'DELETE');
      showToast('留言删除成功');
      loadComments();
    } catch (err) {
      showToast(err.message || '删除失败');
    }
  }

  /* ---------- 网站设置 ---------- */

  function renderSiteLogoPreview(logo) {
    var preview = document.getElementById('siteLogoPreview');
    if (!preview) return;
    if (!logo) {
      preview.innerHTML = '<span class="form-help">当前未上传网站 Logo，将使用默认微信绿图标。</span>';
      return;
    }
    preview.innerHTML = '<img src="' + escapeHtml(logo) + '" alt="当前网站Logo"><span>当前网站 Logo</span>';
  }

  async function loadSiteSettings() {
    try {
      var settings = await apiRequest('/api/settings', 'GET');
      var nameInput = document.getElementById('siteNameInput');
      var descriptionInput = document.getElementById('siteDescriptionInput');
      var footerInput = document.getElementById('footerTextInput');
      if (nameInput) nameInput.value = settings.siteName || 'CARSON';
      if (descriptionInput) descriptionInput.value = settings.description || '';
      if (footerInput) footerInput.value = settings.footerText || '';
      renderSiteLogoPreview(settings.logo || '');
    } catch (err) {
      showToast(err.message || '网站设置加载失败');
    }
    loadAboutSettings();
  }

  async function saveSiteSettings(e) {
    if (e) e.preventDefault();
    var logoInput = document.getElementById('siteLogoInput');
    var file = logoInput && logoInput.files && logoInput.files[0];
    if (file && file.size > 1024 * 1024) {
      showToast('网站 Logo 不能大于 1MB');
      return;
    }

    var formData = new FormData();
    formData.append('siteName', document.getElementById('siteNameInput').value.trim() || 'CARSON');
    formData.append('description', document.getElementById('siteDescriptionInput').value.trim());
    formData.append('footerText', document.getElementById('footerTextInput').value.trim());
    if (file) formData.append('logo', file);

    var btn = document.getElementById('saveSiteSettingsBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中...';
    }

    try {
      var settings = await apiFormRequest('/api/admin/settings', 'POST', formData);
      showToast('网站设置保存成功');
      if (logoInput) logoInput.value = '';
      renderSiteLogoPreview(settings.logo || '');
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '保存设置';
      }
    }
  }

  async function loadAboutSettings() {
    try {
      var about = await apiRequest('/api/about', 'GET');
      var kickerInput = document.getElementById('aboutKickerInput');
      var titleInput = document.getElementById('aboutTitleInput');
      var summaryInput = document.getElementById('aboutSummaryInput');
      var contentInput = document.getElementById('aboutContentInput');
      if (kickerInput) kickerInput.value = about.kicker || 'About';
      if (titleInput) titleInput.value = about.title || '关于本站';
      if (summaryInput) summaryInput.value = about.summary || '';
      if (contentInput) contentInput.value = about.content || '';
    } catch (err) {
      showToast(err.message || '关于页面加载失败');
    }
  }

  async function saveAboutSettings(e) {
    if (e) e.preventDefault();
    var btn = document.getElementById('saveAboutSettingsBtn');
    var data = {
      kicker: document.getElementById('aboutKickerInput').value.trim(),
      title: document.getElementById('aboutTitleInput').value.trim(),
      summary: document.getElementById('aboutSummaryInput').value.trim(),
      content: document.getElementById('aboutContentInput').value
    };
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中...';
    }
    try {
      await apiRequest('/api/admin/about', 'POST', data);
      showToast('关于页面保存成功');
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '保存关于页面';
      }
    }
  }

  /* ---------- 侧边栏（移动端） ---------- */

  function openSidebar() {
    var sidebar = document.getElementById('sidebar');
    var mask = document.getElementById('sidebarMask');
    if (sidebar) sidebar.classList.add('open');
    if (mask) mask.classList.add('show');
  }

  function closeSidebar() {
    var sidebar = document.getElementById('sidebar');
    var mask = document.getElementById('sidebarMask');
    if (sidebar) sidebar.classList.remove('open');
    if (mask) mask.classList.remove('show');
  }

  /* ---------- 事件绑定 ---------- */

  function bindAdminEvents() {
    // 侧边栏导航（事件委托）
    var sidebarNav = document.getElementById('sidebarNav');
    if (sidebarNav) {
      sidebarNav.addEventListener('click', function (e) {
        var item = e.target.closest('.nav-item');
        if (!item) return;
        var page = item.getAttribute('data-page');
        if (page) {
          showPage(page, null);
        }
      });
    }

    // 退出登录
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (confirm('确定要退出登录吗？')) {
          logout();
        }
      });
    }

    // 网站前台入口
    var viewFrontendBtn = document.getElementById('viewFrontendBtn');
    if (viewFrontendBtn) {
      viewFrontendBtn.addEventListener('click', function () {
        window.open('/', '_blank');
      });
    }

    // 缓存管理按钮
    var refreshCacheBtn = document.getElementById('refreshCacheBtn');
    if (refreshCacheBtn) {
      refreshCacheBtn.addEventListener('click', loadCacheStats);
    }
    var clearAllCacheBtn = document.getElementById('clearAllCacheBtn');
    if (clearAllCacheBtn) {
      clearAllCacheBtn.addEventListener('click', function () { clearCache('all'); });
    }
    var clearPostsCacheBtn = document.getElementById('clearPostsCacheBtn');
    if (clearPostsCacheBtn) {
      clearPostsCacheBtn.addEventListener('click', function () { clearCache('posts'); });
    }
    var clearCommentsCacheBtn = document.getElementById('clearCommentsCacheBtn');
    if (clearCommentsCacheBtn) {
      clearCommentsCacheBtn.addEventListener('click', function () { clearCache('comments'); });
    }
    var clearFriendsCacheBtn = document.getElementById('clearFriendsCacheBtn');
    if (clearFriendsCacheBtn) {
      clearFriendsCacheBtn.addEventListener('click', function () { clearCache('friends'); });
    }
    var clearSettingsCacheBtn = document.getElementById('clearSettingsCacheBtn');
    if (clearSettingsCacheBtn) {
      clearSettingsCacheBtn.addEventListener('click', function () { clearCache('settings'); });
    }

    // 跳转按钮（data-jump）
    document.addEventListener('click', function (e) {
      var jumpBtn = e.target.closest('[data-jump]');
      if (jumpBtn) {
        var target = jumpBtn.getAttribute('data-jump');
        showPage(target, null);
      }
    });

    // 文章表格操作（事件委托）
    var tbody = document.getElementById('postsTableBody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (btn.classList.contains('btn-edit')) {
          showPage('editor', id);
        } else if (btn.classList.contains('btn-delete')) {
          var title = btn.getAttribute('data-title') || '';
          openDeleteModal(id, title);
        }
      });
    }

    // 友链表格操作（事件委托）
    var friendsTbody = document.getElementById('friendsTableBody');
    if (friendsTbody) {
      friendsTbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (!id) return;

        if (btn.classList.contains('btn-friend-approve')) {
          updateFriendStatus(id, 'approved');
        } else if (btn.classList.contains('btn-friend-reject')) {
          updateFriendStatus(id, 'rejected');
        } else if (btn.classList.contains('btn-friend-edit')) {
          var friend = cachedFriends.find(function (item) { return String(item.id) === String(id); });
          if (friend) {
            fillFriendForm(friend);
            document.getElementById('page-friends').scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else if (btn.classList.contains('btn-friend-delete')) {
          deleteFriend(id);
        }
      });
    }

    // 留言表格操作（事件委托）
    var commentsTbody = document.getElementById('commentsTableBody');
    if (commentsTbody) {
      commentsTbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (!id) return;
        if (btn.classList.contains('btn-comment-approve')) {
          updateCommentStatus(id, 'approved');
        } else if (btn.classList.contains('btn-comment-pending')) {
          updateCommentStatus(id, 'pending');
        } else if (btn.classList.contains('btn-comment-reject')) {
          updateCommentStatus(id, 'rejected');
        } else if (btn.classList.contains('btn-comment-delete')) {
          deleteComment(id);
        }
      });
    }

    // 分类表格操作（事件委托）
    var categoriesTbody = document.getElementById('categoriesTableBody');
    if (categoriesTbody) {
      categoriesTbody.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var name = btn.getAttribute('data-name') || '';
        if (!name) return;
        if (btn.classList.contains('btn-category-edit')) {
          editCategory(name);
        } else if (btn.classList.contains('btn-category-delete')) {
          deleteCategory(name, btn.getAttribute('data-count') || 0);
        }
      });
    }

    // 删除弹窗
    var cancelBtn = document.getElementById('cancelDelete');
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);

    var confirmBtn = document.getElementById('confirmDelete');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);

    var deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
      deleteModal.addEventListener('click', function (e) {
        if (e.target === deleteModal) closeDeleteModal();
      });
    }

    // 表单提交
    var postForm = document.getElementById('postForm');
    if (postForm) {
      postForm.addEventListener('submit', savePost);
    }

    var articleImageInput = document.getElementById('articleImageInput');
    if (articleImageInput) {
      articleImageInput.addEventListener('change', function () {
        var file = articleImageInput.files && articleImageInput.files[0];
        uploadArticleImage(file);
        articleImageInput.value = '';
      });
    }

    var categoryForm = document.getElementById('categoryForm');
    if (categoryForm) {
      categoryForm.addEventListener('submit', saveCategory);
    }

    var resetCategoryBtn = document.getElementById('resetCategoryForm');
    if (resetCategoryBtn) {
      resetCategoryBtn.addEventListener('click', clearCategoryForm);
    }

    var refreshCategoriesBtn = document.getElementById('refreshCategoriesBtn');
    if (refreshCategoriesBtn) {
      refreshCategoriesBtn.addEventListener('click', loadCategoriesAdmin);
    }

    // 友链表单提交
    var friendForm = document.getElementById('friendForm');
    if (friendForm) {
      friendForm.addEventListener('submit', saveFriend);
    }

    var resetFriendBtn = document.getElementById('resetFriendForm');
    if (resetFriendBtn) {
      resetFriendBtn.addEventListener('click', clearFriendForm);
    }

    var refreshFriendsBtn = document.getElementById('refreshFriendsBtn');
    if (refreshFriendsBtn) {
      refreshFriendsBtn.addEventListener('click', loadFriends);
    }

    var commentSettingsForm = document.getElementById('commentSettingsForm');
    if (commentSettingsForm) {
      commentSettingsForm.addEventListener('submit', saveCommentSettings);
    }

    var refreshCommentsBtn = document.getElementById('refreshCommentsBtn');
    if (refreshCommentsBtn) {
      refreshCommentsBtn.addEventListener('click', loadComments);
    }

    var commentStatusFilter = document.getElementById('commentStatusFilter');
    if (commentStatusFilter) {
      commentStatusFilter.addEventListener('change', loadComments);
    }

    var commentTargetFilter = document.getElementById('commentTargetFilter');
    if (commentTargetFilter) {
      commentTargetFilter.addEventListener('change', loadComments);
    }

    var friendAvatarInput = document.getElementById('friendAvatar');
    if (friendAvatarInput) {
      friendAvatarInput.addEventListener('change', function () {
        var file = friendAvatarInput.files && friendAvatarInput.files[0];
        if (file && file.size > 1024 * 1024) {
          friendAvatarInput.value = '';
          showToast('头像图片不能大于 1MB');
        }
      });
    }

    var siteSettingsForm = document.getElementById('siteSettingsForm');
    if (siteSettingsForm) {
      siteSettingsForm.addEventListener('submit', saveSiteSettings);
    }

    var aboutSettingsForm = document.getElementById('aboutSettingsForm');
    if (aboutSettingsForm) {
      aboutSettingsForm.addEventListener('submit', saveAboutSettings);
    }

    var siteLogoInput = document.getElementById('siteLogoInput');
    if (siteLogoInput) {
      siteLogoInput.addEventListener('change', function () {
        var file = siteLogoInput.files && siteLogoInput.files[0];
        if (file && file.size > 1024 * 1024) {
          siteLogoInput.value = '';
          showToast('网站 Logo 不能大于 1MB');
        }
      });
    }

    // 发布开关
    var publishCheckbox = document.getElementById('postPublished');
    if (publishCheckbox) {
      publishCheckbox.addEventListener('change', updatePublishLabel);
    }

    // 移动端菜单
    var menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', openSidebar);
    }
    var mask = document.getElementById('sidebarMask');
    if (mask) {
      mask.addEventListener('click', closeSidebar);
    }

    // ESC 关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDeleteModal();
        closeSidebar();
      }
    });
  }

  /**
   * 更新顶栏用户信息
   */
  function updateUserInfo() {
    var username = localStorage.getItem('username') || 'Admin';
    var usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) usernameDisplay.textContent = username;
    var userAvatar = document.getElementById('userAvatar');
    if (userAvatar) userAvatar.textContent = (username.charAt(0) || 'A').toUpperCase();
  }

  /* -------------------- 缓存管理 -------------------- */

  async function loadCacheStats() {
    var grid = document.getElementById('cacheStatsGrid');
    var entries = document.getElementById('cacheEntries');
    if (grid) {
      grid.innerHTML = '<div class="loading"><div class="spinner"></div><br>加载中...</div>';
    }
    if (entries) {
      entries.innerHTML = '<p style="color:var(--text-secondary);">加载中...</p>';
    }
    try {
      var stats = await apiRequest('/api/admin/cache/stats', 'GET');
      renderCacheStats(stats || {});
    } catch (err) {
      if (grid) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>缓存数据加载失败</p></div>';
      }
      if (entries) {
        entries.innerHTML = '<p style="color:var(--danger);">' + escapeHtml(err.message || '加载失败') + '</p>';
      }
    }
  }

  function renderCacheStats(stats) {
    var grid = document.getElementById('cacheStatsGrid');
    if (grid) {
      var cards = [
        { label: '总缓存数', value: stats.total || 0 },
        { label: '活跃缓存', value: stats.active || 0 },
        { label: '已过期', value: stats.expired || 0 }
      ];
      grid.innerHTML = cards.map(function (c) {
        return '<div class="cache-stat-card">' +
          '<div class="stat-value">' + c.value + '</div>' +
          '<div class="stat-label">' + escapeHtml(c.label) + '</div>' +
        '</div>';
      }).join('');
    }

    var entries = document.getElementById('cacheEntries');
    if (entries) {
      var list = stats.entries || [];
      if (!list.length) {
        entries.innerHTML = '<p style="color:var(--text-secondary);">当前没有任何缓存条目</p>';
      } else {
        entries.innerHTML = list.map(function (entry) {
          var ttlSec = Math.round((entry.expireIn || 0) / 1000);
          return '<div class="cache-entry-item">' +
            '<span class="cache-key">' + escapeHtml(entry.key) + '</span>' +
            '<span class="cache-ttl">' + ttlSec + 's</span>' +
          '</div>';
        }).join('');
      }
    }
  }

  async function clearCache(scope) {
    if (!confirm(scope === 'all' ? '确定要清除全部缓存吗？' : '确定要清除该分类缓存吗？')) return;
    try {
      var pattern = '';
      if (scope !== 'all') {
        var patterns = {
          posts: '/api/posts',
          comments: '/api/comments',
          friends: '/api/friends',
          settings: '/api/settings'
        };
        pattern = patterns[scope] || scope;
      }
      var body = pattern ? { scope: 'pattern', pattern: pattern } : { scope: 'all' };
      var res = await apiRequest('/api/admin/cache/clear', 'POST', body);
      showToast(res.message || '缓存已清除（清除 ' + (res.cleared || 0) + ' 条）');
      loadCacheStats();
    } catch (err) {
      showToast(err.message || '清除失败');
    }
  }

  /* -------------------- 初始化 -------------------- */

  async function initAdmin() {
    updateUserInfo();
    bindAdminEvents();
    // 默认显示仪表盘
    showPage('dashboard');
  }

  document.addEventListener('DOMContentLoaded', async function () {
    protectAdminFooter();
    var isLoginPage = document.body.classList.contains('login-page');

    if (isLoginPage) {
      // 登录页：若已登录则跳转后台
      var token = getToken();
      if (token) {
        try {
          var data = await apiRequest('/api/auth/verify', 'GET');
          if (data && data.valid) {
            window.location.href = 'index.html';
            return;
          }
        } catch (e) {
          // verify 失败则留在登录页
        }
      }
      initLoginPage();
    } else {
      // 后台页：校验登录
      var valid = await checkAuth();
      if (valid) {
        initAdmin();
      }
    }
  });
})();
