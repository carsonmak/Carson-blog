-- 微信风格博客 Cloudflare D1 初始化结构
-- 数据以 JSON 文档形式存放在 D1 中，便于从原本的 data/db.json 平滑迁移。

CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_app_data_updated_at ON app_data(updated_at);

INSERT OR IGNORE INTO app_data (key, data, updated_at)
VALUES (
  'main',
  json_object(
    'posts', json_array(
      json_object(
        'id', '1',
        'title', '欢迎使用微信风格博客',
        'summary', '一个简洁优雅的博客系统，灵感来源于微信的经典设计语言。',
        'content', '<p>这是一个采用微信设计风格的博客系统。</p><h2>主要特性</h2><ul><li>简洁清新的界面设计</li><li>完整的后台管理系统</li><li>文章的增删改查</li><li>分类与标签管理</li><li>响应式布局，适配移动端</li></ul><p>微信风格的核心在于「克制」——用最少的视觉元素传达最清晰的信息。绿色主色调 #07C160 带来活力感，大面积留白让内容呼吸。</p><h2>使用方法</h2><p>1. 访问首页查看博客文章列表</p><p>2. 点击文章标题查看详情</p><p>3. 访问 /admin 进入后台管理</p><p>4. 管理员账号密码由 Cloudflare 环境变量自定义设置</p><p>开始你的博客之旅吧！</p>',
        'cover', '',
        'author', 'Admin',
        'category', '公告',
        'tags', json_array('教程', '公告'),
        'createdAt', '2026-08-04T00:00:00.000Z',
        'updatedAt', '2026-08-04T00:00:00.000Z',
        'views', 0,
        'published', 1,
        'pinned', 0,
        'announcement', 0,
        'showOnHome', 1
      )
    ),
    'categories', json_array('公告', '技术', '生活', '随笔'),
    'tags', json_array('教程', '公告', '写作', '技术', '前端', '趋势', '生活', '随笔'),
    'friends', json_array(),
    'users', json_array(),
    'comments', json_array(),
    'settings', json_object(
      'siteName', '微信博客',
      'logo', '',
      'footerText', '',
      'about', json_object(
        'kicker', 'About',
        'title', '关于本站',
        'summary', '这是一个微信风格的轻量博客系统，专注于文章发布、内容阅读和简单后台管理。',
        'content', '<section class="about-card"><h2>设计理念</h2><p>本站延续微信式的简洁风格：绿色主色、清晰层级、卡片布局和大量留白，让读者把注意力放在内容本身。</p></section><section class="about-card"><h2>功能说明</h2><ul><li>前台支持文章列表、分类筛选、搜索、文章详情和友情链接页面。</li><li>后台支持登录认证、仪表盘统计、文章新增、编辑、删除和发布状态管理。</li><li>Cloudflare 版本使用 D1 保存数据，R2 保存上传图片。</li></ul></section>'
      ),
      'commentSettings', json_object(
        'blockedKeywords', json_array(),
        'homepagePageSize', 5,
        'postPageSize', 10
      )
    )
  ),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
