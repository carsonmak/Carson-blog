# Cloudflare 原生完整版部署说明

本仓库已包含 Cloudflare Worker 版本，可以从 GitHub 部署到 Cloudflare，并使用 D1 保存站点数据、R2 保存上传图片。原本的 Node.js/Express 版本仍可本地运行，Cloudflare 部署使用 `workers/api.js`。

## 已支持功能

- 前台文章列表、文章详情、分类筛选、搜索、公告、关于页、友链、留言。
- 后台登录、文章管理、分类管理、友链审核、留言审核、站点名称、Logo、关于页和底部文字设置。
- 加密版权底部保持不变，后台设置的底部文字只显示在加密版权下方。
- D1 替代 `data/db.json`，R2 替代本地 `uploads/`。
- 管理员账号密码在部署时自定义，不再写死到代码里。

## 文件说明

- `workers/api.js`：Cloudflare Worker 入口，处理 `/api/*`、`/uploads/*` 和静态页面。
- `d1/schema.sql`：D1 初始化 schema。
- `scripts/build-cloudflare.js`：把 `public/` 和 `admin/` 打包到 `dist/`。
- `wrangler.toml`：Worker、Assets、D1、R2 绑定配置。

## 本地准备

安装依赖并检查语法：

```bash
npm install
npm run check
npm run build:cf
```

## 创建 D1

先登录 Cloudflare：

```bash
npx wrangler login
```

创建 D1 数据库：

```bash
npx wrangler d1 create wechat-blog-db
```

命令会返回 `database_id`。把返回的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "wechat-blog-db"
database_id = "这里替换成真实 database_id"
```

初始化 D1 表结构：

```bash
npx wrangler d1 execute wechat-blog-db --file=d1/schema.sql
```

## 创建 R2

创建用于保存上传图片的 R2 Bucket：

```bash
npx wrangler r2 bucket create wechat-blog-uploads
```

`wrangler.toml` 已配置：

```toml
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "wechat-blog-uploads"
```

## 设置管理员账号

管理员用户名可以写在 `wrangler.toml` 的 `[vars]` 中：

```toml
[vars]
ADMIN_USERNAME = "你的管理员用户名"
```

管理员密码和 JWT 密钥建议用 Secret 设置，不要提交到 GitHub：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put JWT_SECRET
```

执行命令后按提示输入自定义密码和随机密钥。部署后后台地址是 `/admin`，用这里设置的管理员账号密码登录。

## 从 GitHub 部署

推荐流程：

1. 把整个项目推送到 GitHub。
2. 在 Cloudflare 控制台进入 `Workers & Pages`。
3. 选择 `Create application`，连接 GitHub 仓库。
4. 使用 Worker 项目部署，构建命令填写：

```bash
npm install && npm run build:cf
```

5. 部署命令使用 Wrangler，或者在本地首次部署：

```bash
npx wrangler deploy
```

如果 Cloudflare 控制台没有自动读取 `wrangler.toml`，请确认根目录包含 `wrangler.toml`，并且构建产物目录为 `dist`。

## 本地预览

本地预览 Worker 完整版：

```bash
npm run build:cf
npx wrangler dev
```

本地预览时也需要 D1/R2 绑定。首次预览前先完成 D1 和 R2 的创建与 `wrangler.toml` 配置。

## 数据迁移

当前 Cloudflare 版本默认使用 `d1/schema.sql` 中的初始化数据。如果要迁移本地 `data/db.json`，可以在后续增加一次性导入脚本，把 JSON 写入 D1 的 `app_data` 表：

```sql
UPDATE app_data
SET data = '这里放转义后的 db.json 内容',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'main';
```

如果内容较多，建议用脚本读取 `data/db.json` 后调用 D1 API 或 `wrangler d1 execute` 导入。

## 注意事项

- `wrangler.toml` 中的 `database_id` 必须替换为真实值，否则无法部署。
- 不要把真实 `ADMIN_PASSWORD` 和 `JWT_SECRET` 写入 GitHub。
- R2 图片通过 Worker 的 `/uploads/*` 代理访问，不需要单独公开 Bucket。
- Cloudflare Worker 版本不使用 Express、bcrypt 或本地磁盘，部署后数据以 D1/R2 为准。
