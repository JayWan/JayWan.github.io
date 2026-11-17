# 221Forever

## 本地开发

### 前置依赖

需要安装以下两样东西，版本都写在 `mise.toml` 里：

- **Ruby 3.4**：运行 Jekyll，整个网站（HTML、CSS、`letters.json`）都由它生成。
- **Node.js 24**：只用来生成图片缩略图（sharp），不参与网站构建。

推荐用 [mise](https://mise.jdx.dev) 一次装好：在项目目录里运行 `mise install`。不用 mise 的话，自己装上面两个版本也可以，运行 `ruby -v` 和 `node -v` 确认。

> Ruby 依赖里有几个需要本地编译的 gem，所以机器上要有 C/C++ 编译器（macOS 运行 `xcode-select --install`，Ubuntu 安装 `build-essential`）。

### 第一次运行

```bash
# 1. 安装 Ruby 依赖（Jekyll）
bundle install

# 2. 安装 Node.js 依赖（只有 sharp）
npm install
```

### 启动开发服务器

```bash
npm start
```

然后自己打开 http://localhost:4301 （不会自动弹出浏览器）。

这个命令会依次完成：补齐缺少的缩略图 → 启动 `jekyll serve`。之后修改文章、模板、SCSS 或图片，保存后大约半秒页面就会自动刷新，不需要再开别的进程。

- 端口和自动刷新写在 `_config.yml` 里，所以直接运行 `bundle exec jekyll serve` 效果完全一样。
- 修改 `_config.yml` 之后需要重启才会生效。
- 想用手机真机预览：`npm start -- --host 0.0.0.0`，然后在手机上访问 `http://<电脑的局域网 IP>:4301`。

### 构建

```bash
npm run build
```

生成的网站在 `_site/` 目录，和 GitHub Actions 上跑的是同一条命令。想在本地看构建结果：

```bash
python3 -m http.server 4201 --bind 127.0.0.1 --directory _site
```

### 样式

入口是 `assets/css/main.scss`，各个模块在 `_scss/` 目录，由 Jekyll 自带的 Sass 编译成 `/assets/css/main.css`，仓库里不再有编译产物，也不需要单独编译 CSS。

现在没有 Autoprefixer 了：个别还需要前缀的属性（例如 `-webkit-user-select`、`-webkit-line-clamp`、`-webkit-text-size-adjust`）请直接手写。

### 图片

封面图放在 `assets/images/hero/`，侧边栏用的缩略图在 `assets/images/thumbnail/`（同名文件，宽 350px）。

```bash
npm run images              # 只生成缺少的缩略图
npm run images -- --force   # 全部重新生成（比如替换了某张封面图之后）
```

`npm start` 和 `npm run build` 都会先跑一遍，GitHub Actions 也会，所以忘了提交缩略图也没关系。

## 写文章

1. 在 `_posts/` 目录下新建一个 Markdown 文件，文件名格式为 `YYYY-M-D-标题.markdown`，例如 `2026-8-12-木婚快乐.markdown`。
2. 文件开头写上下面这段 front matter，后面就是正文（Markdown，也可以直接写 HTML）。
3. 封面图放进 `assets/images/hero/`，音乐放进 `assets/bgm/`，正文里的图片放进 `assets/images/posts/`，正文中用 `{{ site.baseurl_posts_img }}文件名.jpg` 引用。
4. push 到 `master` 分支，GitHub Actions 会自动构建并发布到网站。

```yaml
---
layout: post
title:  "木婚快乐"
date:   2026-8-12 19:25:00     # 写信的日期和时间，不带时区
excerpt: "一句话摘要"            # 可以留空 ""
author: Pikajay                # 可省略，默认 Pikajay
categories: Story
image:
  feature: 32.jpg              # assets/images/hero/ 里的文件名
  topPosition: -700px          # 文章页封面图的垂直偏移
  heroPosition: "50% 40%"      # 可省略，首页卡片上封面图的位置
bgContrast: dark
bgGradientOpacity: darker      # darker / lighter，可省略
syntaxHighlighter: no
bgm: 风之诗.mp3                 # assets/bgm/ 里的文件名
---
```

文章的网址是 `/story/年/月/日/文件名里的标题/`，例如 `/story/2026/08/12/木婚快乐/`：

- 年月日取自 front matter 里的 `date`（不是文件名里的日期），你写的是哪天网址里就是哪天。网站统一按 UTC 处理时间（`_config.yml` 里的 `timezone: UTC`），在哪台电脑上构建结果都一样，不要改这个设置。
- 标题部分取自文件名，空格和标点会变成 `-`。
- 文章发布之后不要再改文件名和 `date`，否则网址会变。

## 部署

push 到 `master` 后由 `.github/workflows/jekyll.yml` 自动完成：按 `mise.toml` 安装 Ruby 和 Node.js → `bundle install` / `npm ci` → `npm run build` → 发布 `_site/` 到 GitHub Pages。

## License

Open sourced under the [MIT license](LICENSE.md).
