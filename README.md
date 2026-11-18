# 221Forever

## 本地开发

### 前置依赖

需要安装以下两样东西，版本都写在 `mise.toml` 里：

- **Ruby 3.4**：运行 Jekyll，整个网站（HTML、CSS、`letters.json`）都由它生成。
- **Node.js 24**：生成封面的缩略图（sharp）和跑测试（Playwright），不参与网站构建。

推荐用 [mise](https://mise.jdx.dev) 一次装好：在项目目录里运行 `mise install`。不用 mise 的话，自己装上面两个版本也可以，运行 `ruby -v` 和 `node -v` 确认。

> Ruby 依赖里有几个需要本地编译的 gem，所以机器上要有 C/C++ 编译器（macOS 运行 `xcode-select --install`，Ubuntu 安装 `build-essential`）。

### 第一次运行

```bash
# 1. 安装 Ruby 依赖（Jekyll）
bundle install

# 2. 安装 Node.js 依赖（sharp 和 Playwright）
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
npm run preview        # http://127.0.0.1:4201
```

### 主题

网站现在有好几套主题，每次到访自动挑一套：旧版（classic，就是原来的样子）、夜航（drift）、笺（folio）、唱片（sides）、绕日（orbit）。

- **怎么挑**：离开网站超过 30 分钟再回来算一次新的到访，重新抽；同一次到访里刷新、点链接、后退都不会换。纪念日有固定的主题（2-21 绕日，11-28 夜航，2-6 和 7-4 唱片，8-12 笺，9-15 网站生日是旧版）。夜里 11 点到早上 6 点只抽深色的。其余时候轮流来，每套轮一遍才会重复。
- **想换一套**：每个页面的页脚都有一排主题的名字（旧版 / 夜航 / 笺 / 唱片 / 绕日，当前这套有记号），点哪个就换成哪个，这次到访里会一直用它。夜航里打开一封信的时候，信尾「合上」的下面也有一排（河的页脚离那里有十几屏）。旧版也有这一排，而且有两处：页面的最后（首页在最后一张卡片下面，信在 © 那行下面，404 页在页面底部），和右上角那个三条线的按钮点开的侧栏里、「221 FOREVER」的下面。旧版的页面很长，侧栏那一排不用滚到底就点得到。网址不会变（主题不写在网址里，所以同一个链接在哪套主题下都打得开），后退键也不会把人带回上一套。
- **不点也行**：在网址后面加 `?theme=名字`，比如 `http://localhost:4301/?theme=drift`，效果和点那一排一样。`?theme=classic` 回到旧版，`?theme=random` 重新抽一次。
- **想停用某一套**：打开 `_data/themes.yml`，把那一套的 `enabled: true` 改成 `false`。除了 classic 都改成 `false`，就整个回到只有旧版的网站。纪念日和夜间时段也在这个文件里。
- **出了问题怎么办**：某个主题加载失败或者报错，页面会自动换回旧版，不会白屏。浏览器太旧或者关掉了 JavaScript，看到的也是旧版。

它的做法是：Jekyll 生成的还是旧版的 HTML；`<head>` 最前面的一小段脚本（`_includes/theme-boot.html`）先决定用哪个主题，抽到旧版就照原样加载，抽到别的就只加载那个主题自己的 CSS 和 JS，由它把页面重新画一遍。旧版的样式在 `_scss/`，新主题各自在 `assets/themes/<名字>/`，共用的部分在 `assets/js/core/`。

要改主题或者新做一套，先看 [`assets/themes/README.md`](assets/themes/README.md)。

### 测试

```bash
npm test
```

会先构建一遍网站，再用电脑上装的 Chrome 自动检查：每个主题的首页、信、404 能不能正常显示，打错的网址是不是落在网站自己的 404 页上，有没有横向滚动，歌能不能放、换页时会不会断，主题坏掉时能不能回到旧版，选主题的规则对不对，从旧版能不能点到每一套主题、又能不能点回来，每封信的几句摘句是不是都抽得到，敲 `221` 那张纸在每套主题下能不能打开和关上。大约一分钟。想连 iPhone 尺寸的 Safari 内核和 Firefox 一起测，先运行一次 `npx playwright install webkit firefox`。

### 样式

这一节说的是旧版（classic）的样式。入口是 `assets/css/main.scss`，各个模块在 `_scss/` 目录，由 Jekyll 自带的 Sass 编译成 `/assets/css/main.css`，仓库里不再有编译产物，也不需要单独编译 CSS。

旧版的页面要和换肤之前一模一样，只多了那一排主题名（页脚一排，侧栏里一排，样式都在 `_scss/_theme-switcher.scss`）。改旧版的样式之前先看 [`assets/themes/README.md`](assets/themes/README.md) 第十节末尾，怎么确认别的地方一个像素都没动。

> 以前用 gulp 时生成在 `assets/css/` 里的 `main.css`、`main.min.css` 已经不再使用，Git 和 Jekyll 都会忽略它们，看到可以直接删掉。

现在没有 Autoprefixer 了：个别还需要前缀的属性（例如 `-webkit-user-select`、`-webkit-line-clamp`、`-webkit-text-size-adjust`）请直接手写。

### 图片

封面图放在 `assets/images/hero/`。由它生成两样东西，都不用自己动手：

- 旧版侧边栏用的缩略图，在 `assets/images/thumbnail/`（同名文件，宽 350px）。
- 新主题用的几种尺寸（480 / 800 / 1200 / 1600px，AVIF 和 JPEG 各一份），在 `assets/m/`，不进 Git。新主题从不直接加载原图。

```bash
npm run images              # 只生成缺少的和封面换过的
npm run images -- --force   # 全部重新生成（大约三分钟）
```

`npm start` 和 `npm run build` 都会先跑一遍，GitHub Actions 也会，所以忘了提交缩略图也没关系。同一个脚本还会读出每首歌的时长和演唱者，写进 `_data/media.json`（也不进 Git）。

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
author: Pikajay                # Pikajay / Pikachi / 别的名字（新主题会把别人写的信当作客人的信）
categories: Story
image:
  feature: 32.jpg              # assets/images/hero/ 里的文件名
  topPosition: -700px          # 旧版文章页封面图的垂直偏移
  heroPosition: "50% 40%"      # 可省略，旧版首页卡片上封面图的位置
  focus: [0.68, 0.6]           # 可省略，新主题裁切封面时要保住的中心点（横、纵，0–1），默认正中
bgContrast: dark
bgGradientOpacity: darker      # darker / lighter，可省略
syntaxHighlighter: no
bgm: 风之诗.mp3                 # assets/bgm/ 里的文件名，文件名就是新主题里显示的歌名
quotes:                        # 可省略，从信里摘的几句，一行一句（见下面「摘句」）
  - "你的双眸明亮，可能是灯火，可能是月光。"
  - "我看着你的脸，感觉好爱好爱你，善良热烈的你。"
place: "Oak Creek 家中"         # 可省略，写信的地方
# standalone: true             # 信里自己写了 <script> 的才需要，表示这封信总是整页打开
# quiet: true                  # 沉重的信才需要，新主题不会在它周围放俏皮的动效
---
```

新的信发布之后，页脚里网站自己的那句话会知道它又被「喂」了一次。

**摘句。** 新主题的目录里，每封信会带一句从信里摘出来的话。一封信可以摘好几句，都写在 `quotes:` 下面，一行一句，每行以两个空格加 `- ` 开头，句子用英文双引号括起来；每次打开网站，每封信从自己的几句里随机用一句。想加一句就加一行，想去掉哪句就删掉那一行，只留一行也可以（以前的写法 `quote: "……"` 仍然有效，等于只有一句）。句子要和信里的原文一字不差；句子里有英文双引号的话，在它前面加一个反斜杠（`\"`）。

### 藏着的一页

在网站的任何一页上直接敲键盘 `221`，会弹出一张纸。纸上写什么，由 `_includes/egg-221.md` 决定：把内容写在文件里那段注释的下面，Markdown，和写信一样（图片也用 `{{ site.baseurl_posts_img }}文件名.jpg`），push 之后就生效。文件现在是空的，所以弹出来的是一张白纸。按 Esc、点纸的外面、或者点右上角的 ×，纸就收起来。

文章的网址是 `/story/年/月/日/文件名里的标题/`，例如 `/story/2026/08/12/木婚快乐/`：

- 年月日取自 front matter 里的 `date`（不是文件名里的日期），你写的是哪天网址里就是哪天。网站统一按 UTC 处理时间（`_config.yml` 里的 `timezone: UTC`），在哪台电脑上构建结果都一样，不要改这个设置。
- 标题部分取自文件名，空格和标点会变成 `-`。
- 文章发布之后不要再改文件名和 `date`，否则网址会变。

## 部署

push 到 `master` 后由 `.github/workflows/jekyll.yml` 自动完成：按 `mise.toml` 安装 Ruby 和 Node.js → `bundle install` / `npm ci` → 取回上一次生成的封面缩略图（只有新增或换过的封面需要重新生成）→ `npm run build` → 发布 `_site/` 到 GitHub Pages。

## License

Open sourced under the [MIT license](LICENSE.md).
