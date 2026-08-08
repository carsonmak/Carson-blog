# CARSON博客系统

一个CARSON博客系统仿微信风格的轻量博客系统，包含前台博客、文章页、公告、留言、友链、用户登录和后台管理。


## 功能更新

- 2026/08/08
- 新更新注册用户可在前台个人中心-投稿-后台投稿管理，审核用户投稿发表
- 添加网站后台缓存管理
- 支持GitHub部署cloudflare覆盖更新系统功能，不影响网站正常使用
- 更多功能等您支持，开发。。。。。。
- 期待您的加入。。。。
  
## 功能

- 文章发布、编辑、删除、草稿和发布状态
- 文章置顶、首页显示、网站公告
- 分类管理，可在后台自行添加、改名、删除
- 文章正文支持 HTML，支持上传图片并插入正文
- 前台用户注册/登录，管理员账号也可在前台登录
- 主页留言、文章留言、微信风格表情、关键词审核、分页
- 友链提交与后台审核
- 网站名称、Logo、关于页面 HTML 后台可配置

## 本地运行

```bash
npm install
npm start
```

访问：

- 前台：`http://localhost:3000`
- 后台：`http://localhost:3000/admin`

默认后台账号：

- 用户名：`admin`
- 密码：`admin123`

首次启动时会自动创建本地数据库 `data/db.json`。

## 上传 GitHub

```bash
git init
git add .
git commit -m "init wechat blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

`.gitignore` 已默认排除：

- `node_modules/`
- 本地数据库 `data/db.json`
- 用户上传文件 `uploads/`
- `.env`
- 构建缓存和日志

## Cloudflare 部署

请查看 [Cloudflare 部署说明](./CLOUDFLARE_DEPLOY.md)。

重要说明：当前项目完整版使用 Express、JSON 文件数据库和本地上传目录。Cloudflare Pages 只能直接托管静态前台，不能完整运行后台、登录、上传和留言接口。完整版可通过 Node 服务部署后接入 Cloudflare 域名/CDN/Tunnel；如需真正 100% 运行在 Cloudflare Workers，需要把数据层迁移到 D1，把上传迁移到 R2。
