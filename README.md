# 221Forever

## 本地开发

### 前置依赖

需要安装以下两样东西：

- **Ruby**：运行 `ruby -v` 确认已安装，否则参照 [Jekyll 官方文档](https://jekyllrb.com/docs/installation/) 安装。
- **Node.js / npm**：运行 `node -v` 确认已安装，否则前往 [nodejs.org](https://nodejs.org/) 下载安装。

### 第一次运行

```bash
# 1. 安装 Ruby 依赖（Jekyll 等）
bundle install

# 2. 安装 Node.js 依赖（Gulp、Sass、Sharp 等）
npm install
```

### 启动开发服务器

```bash
npm start
```

这个命令会依次完成：生成缩略图 → 编译 SCSS 为 CSS → 启动 Jekyll 构建 → 启动 BrowserSync 热重载服务器（默认 http://localhost:3000）。

> **注意**：`assets/css/` 已加入 `.gitignore`，CSS 文件不在仓库里。每次开发前必须先跑 `npm start` 或 `npm run styles` 编译出 CSS，直接用 `bundle exec jekyll serve` 会因为缺少样式文件导致页面无样式。

### 只编译 CSS（不启动服务器）

```bash
npm run styles
```

## 写文章

在 `_posts/` 目录下用 Markdown 写文章，文件名格式为 `YYYY-M-D-标题.markdown`。写好之后 push 到 `master` 分支，GitHub Actions 会自动触发构建并发布到网站。

CSS 的编译也包含在 CI 流程里，push 前不需要手动提交编译产物。

## License

Open sourced under the [MIT license](LICENSE.md).
