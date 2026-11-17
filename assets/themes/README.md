# 主题作者指南

这个网站有好几套主题，每次到访自动挑一套。这份文档写给要做主题的人：一个主题需要哪些文件、拿到手的 `ctx` 里有什么、哪些规矩必须守、怎么在本地看和测。

最朴素的完整例子是 [`probe/`](probe/)（`theme.js` 约 150 行）。它把 `ctx` 的每一项都用了一遍，建议先读它，再读这里。

- [一、它是怎么工作的](#一它是怎么工作的)
- [二、一个主题由什么组成](#二一个主题由什么组成)
- [三、最小骨架](#三最小骨架)
- [四、ctx 里有什么](#四ctx-里有什么)
- [五、生命周期](#五生命周期)
- [六、信的正文](#六信的正文)
- [七、三种要特别对待的信](#七三种要特别对待的信)
- [八、网站自己的声音和彩蛋](#八网站自己的声音和彩蛋)
- [九、规矩](#九规矩)
- [十、本地预览和测试](#十本地预览和测试)
- [十一、iOS Safari 上常见的坑](#十一ios-safari-上常见的坑)

## 一、它是怎么工作的

Jekyll 生成的 HTML 和以前一样，是旧版（classic）的页面。它同时是没有 JavaScript 时的样子，也是每封信正文的唯一来源。

`<head>` 最前面有一小段内联脚本（`_includes/theme-boot.html`），在页面画出任何东西之前决定这次用哪个主题：

- 抽到 **classic**：按原样加载旧版的样式表、字体和 jQuery，页面和以前完全一样。
- 抽到**别的主题**：旧版的样式和脚本根本不加载，旧版的 DOM 保持隐藏。脚本改为加载 `assets/themes/<id>/theme.css`（会挡住首帧，所以不闪），随后核心模块 `assets/js/core/main.js` 引入 `assets/themes/<id>/theme.js`，调用它的 `mount(ctx)`。主题把整页画进 `#theme-root`，数据来自页面里的一段 JSON，信的正文就是 Jekyll 已经渲染好的那个节点。

同一时刻只有一个主题的 CSS 被加载，主题之间不可能互相影响。主题加载失败、抛异常，或 5 秒内什么都没画出来，页面会自动回到 classic（见[生命周期](#五生命周期)）。

选主题的顺序：`?theme=<id>` → 本次到访已经定下的主题（离开网站超过 30 分钟才算新的到访；刷新、站内跳转、后退、新标签页都不换）→ 纪念日 → 夜里（23:00–05:59）只抽深色主题 → 洗牌袋（每个主题轮一遍才会重复，相邻两次不相同）。

## 二、一个主题由什么组成

```
assets/themes/<id>/theme.css     这个主题需要的全部样式
assets/themes/<id>/theme.js      ES 模块，default export 一个带 mount(ctx) 的对象
assets/themes/<id>/…             主题自己的小文件（svg、纹理图）
_data/themes.yml                 登记表里的一项：名字、底色、深浅、字体、纪念日、是否启用
```

- 两个文件都存在，主题才会参加抽选。四个新主题已经登记好了，文件放进来就生效。
- 主题只读自己目录里的文件。CSS 里用相对路径（`url(grain.png)`），JS 里用 `new URL('./mark.svg', import.meta.url)`。
- 不要从 `assets/js/core/` 引入任何东西，契约只有 `ctx`。需要小工具函数就自己写（`probe/theme.js` 开头的 `h()` 只有 6 行）。
- 没有打包器，没有框架，没有 npm 运行时依赖。`theme.js` 可以用相对路径 `import` 自己目录下的其他模块。
- 运行时不向第三方请求任何东西：没有 Google Fonts，没有 CDN。
- 目录里的 `.md` 文件不会被发布，可以放设计说明。

### 登记表里的字段（`_data/themes.yml`）

| 字段 | 含义 |
|---|---|
| `id` | 目录名 |
| `name` | 界面上显示的名字（换主题的那排链接用它） |
| `ground` | 底色。CSS 到达之前页面先铺这个颜色，所以它要和 `theme.css` 里 `html` 的背景一致 |
| `dark` | 是不是深色主题。夜里只抽深色的；它也决定 `color-scheme` |
| `fonts` | 字体名列表。每个名字对应 `assets/fonts/<名字>.css`（由字体那部分工作提供），只在这个主题下加载，排在 `theme.css` 之前。`theme.css` 里直接用其中定义的 `font-family` |
| `dates` | 这个主题的日子，`"月-日"`。那天新的到访一定是它 |
| `enabled` | `false` 就不参加抽选，仍可用 `?theme=<id>` 预览 |

## 三、最小骨架

`assets/themes/demo/theme.js`

```js
export default {
  mount(ctx) {
    const { letters, root, router } = ctx;

    function show(route) {                      // route: { type: 'home' | 'letter' | '404', letter, contentEl }
      if (route.type === 'letter') {
        const body = document.createElement('article');
        body.className = 'letter-body';         // 正文的容器必须叫这个名字
        body.append(route.contentEl);           // 把 Jekyll 渲染好的节点「搬」进来，不要克隆
        ctx.widgets.init(route.contentEl);      // 搬完之后让翻转卡片按新的宽度重新量一下
        root.replaceChildren(body);
      } else {
        const list = document.createElement('ol');
        for (const letter of letters) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = letter.url;                  // 普通链接即可，核心会接管成不换页的跳转
          a.textContent = letter.title;
          li.append(a);
          list.append(li);
        }
        root.replaceChildren(list);
      }
    }

    show(router.current);                       // 先画进来时的这一页
    return { show };                            // 之后每次站内跳转，核心都会再调 show(route)
  },
};
```

`assets/themes/demo/theme.css`

```css
html { background: #f7f6f2; color: #23221f; }   /* 和 themes.yml 里的 ground 一致 */
body { margin: 0; font: 17px/1.75 serif; }
#theme-root { max-width: 40rem; margin: 0 auto; padding: 1.5rem; }
.letter-body p { margin: 1.25em 0 0; }
```

在 `_data/themes.yml` 里加一项，然后打开 `http://localhost:4301/?theme=demo`。

## 四、ctx 里有什么

下面用 TypeScript 的写法描述形状，实际代码都是普通 JavaScript。

```ts
interface Ctx {
  site: Site;
  letters: Letters;           // 所有的信，最早的在前
  page: Page;                 // 现在屏幕上的这一页（站内跳转后核心会更新它）
  root: HTMLElement;          // #theme-root，主题的一切都画在它里面
  env: Env;
  player: Player;
  router: Router;
  img(cover: Cover | null, options?: ImgOptions): HTMLPictureElement;
  ui: {
    hunger(): { days: number; level: 0 | 1 | 2 | 3 | 4; text: string };
    switcher(): HTMLElement;  // <nav class="theme-switcher">，没有样式
    fmt: Fmt;
  };
  widgets: { init(el: Element): void };
}
```

### `ctx.site`

```ts
interface Site {
  title: string;      // "221 FOREVER"
  name: string;       // "LoveStory"
  met: string;        // "2015-11-28"  认识
  together: string;   // "2016-02-21"  在一起
  married: string;    // "2021-08-12"  结婚
  born: string;       // "2016-09-15"  这个网站出生
  built: string;      // 构建时间，"2026-11-17T12:00:00Z"
  today: { date: string; days: Days };   // 访客本地的今天，以及到今天各过了多少天
}
interface Days { met: number | null; together: number | null; married: number | null }
```

天数按他们自己的数法：整天数，当天是第 0 天，`2024-11-19` 是认识第 3279 天。那一天还没到就是 `null`。

### `ctx.letters`

一个普通数组（最早的在前），外加三个帮手：

```ts
interface Letters extends Array<Letter> {
  byUrl(url: string): Letter | null;   // 路径或完整网址、编码过或没编码过都可以
  byNo(no: number): Letter | null;
  latest: Letter;                      // 最新的一封
}

interface Letter {
  no: number;               // 第几封，从 1 开始
  index: number;            // 在数组里的位置（no - 1）
  title: string;
  url: string;              // "/story/2026/08/12/木婚快乐/"，可以直接放进 href
  date: string;             // "2026-08-12"
  time: string;             // "19:25"，front matter 里写的时间；很多封只是占位（00:00、01:00）
  year: number;             // 2026
  doy: number;              // 一年里的第几天，1–366
  author: string;           // "Pikajay" | "Pikachi" | "Claude" | …
  role: 'him' | 'her' | 'guest';        // him = Pikajay，her = Pikachi，其他人都是 guest
  days: Days;               // 写这封信那天，各过了多少天
  quote: string | null;     // 从信里摘的一句
  place: string | null;
  song: { title: string; src: string; duration: number | null; artist: string | null } | null;
  cover: Cover | null;
  chars: number;            // 字数（去掉标记和空白）
  standalone: boolean;      // 这封信自带脚本，只能整页打开
  quiet: boolean;           // 沉重的信，周围不要有俏皮的动效
  prev: Letter | null;      // 前一封、后一封（不可枚举，JSON.stringify 不会带上）
  next: Letter | null;
}

interface Cover {
  file: string;             // "32.jpg"
  orig: string;             // 原图地址。不要直接用，见 ctx.img
  w: number; h: number;     // 原图尺寸
  color: string;            // 平均色，"#474a52"
  lqip: string;             // 16px 的模糊小图，data: URI
  focus: [number, number];  // 裁切时要保住的中心点，0–1
  base: string; widths: number[];   // 缩略图：`${base}-${width}.avif` / `.jpg`
}
```

`song.title` 是 mp3 的文件名去掉扩展名（他们就是这样给歌起名的）。`song.duration` 是秒，可能带小数；`artist` 来自 mp3 的 ID3 标签，有几首没有。

### `ctx.page`

```ts
interface Page {
  type: 'home' | 'letter' | '404';
  url: string;
  letter: Letter | null;          // 信的页面才有
  contentEl: HTMLElement | null;  // 信的页面才有：Jekyll 渲染的 .content-body，活的节点
}
```

### `ctx.env`

```ts
interface Env {
  reducedMotion: boolean;       // prefers-reduced-motion: reduce
  touch: boolean;               // 没有悬停能力或是粗指针
  standaloneDisplay: boolean;   // 从主屏幕图标打开
}
```

这是 `mount` 那一刻的快照。需要跟着变化的地方用 CSS 的媒体查询，或自己 `matchMedia(...).addEventListener('change', …)`。

### `ctx.img(cover, options)`

封面只能通过它上页面。它返回一个还没插入文档的 `<picture>`：AVIF 和 JPEG 两套 `srcset`，带 `width`/`height`（不会跳版），背景是封面的平均色。

```ts
interface ImgOptions {
  sizes?: string;        // 默认 '100vw'。照实写，它决定浏览器下载哪个尺寸
  alt?: string;          // 默认 ''
  lazy?: boolean;        // 默认 true。首屏里的图传 false
  className?: string;    // 加在 <picture> 上
  widths?: number[];     // 只用这些宽度，比如缩略图传 [480]
  lqip?: boolean;        // true = 加载完成前先显示模糊小图
}
```

里面的 `<img>` 上有两个自定义属性 `--fx`、`--fy`，是 `cover.focus` 换成的百分比。要裁切封面时这样写，脸就不会被切掉：

```css
.thumb img { width: 100%; height: 100%; object-fit: cover; object-position: var(--fx) var(--fy); }
```

`cover` 是 `null`（信没有封面）时返回一个空的 `<picture class="is-empty">`，版式代码不用特判。

### `ctx.player`

整个网站只有一个 `<audio>`，归核心所有。它不属于任何一个视图，所以在目录和信之间跳转时歌不会断。

```ts
interface Player {
  state: {
    letter: Letter | null;   // 正在放（或暂停着）哪封信的歌
    playing: boolean;
    time: number;            // 已播放的秒数
    duration: number;        // 总秒数；文件加载前用数据里的值
    loading: boolean;        // 已经点了播放、声音还没出来
    error: null | 'blocked' | 'failed';
  };
  toggle(letter?: Letter): void;   // 放这封信的歌；已经是它就暂停 / 继续。不传参数 = 暂停 / 继续当前的
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  next(): void;                    // 下一封有歌的信，并播放
  prev(): void;
  on(event: 'change' | 'time', fn: (state) => void): () => void;   // 返回值是取消监听的函数
}
```

- `'change'`：除了进度以外的任何变化。收到后把整个播放界面重画一遍最省事。
- `'time'`：进度变了，每秒最多 4 次。
- **只在用户的点击里调用 `toggle()` / `play()`**。浏览器不允许没有手势就出声，核心也绝不自动播放。
- 一首歌放完就停，不会自动放下一首。一封信，一首歌。
- 按播放之前不会请求任何音频数据。
- 核心已经接好了 Media Session（锁屏和耳机上的播放控制）。
- **每一个能开始放歌的控件都要带 `data-play` 属性**（值随意），测试靠它找到播放键。

### `ctx.router`

```ts
interface Router {
  go(url: string): Promise<boolean>;   // 等同于点了一个链接。true = 没有换页
  prefetch(url: string): void;         // 提前把一封信取回来（指针移上去或手指按下时调用）
  current: Route;                      // 现在屏幕上的这一页
  soft: boolean;                       // mount 返回了 show 之后为 true
}

type Route =
  | { type: 'home'; url: string; scrollY: number }
  | { type: 'letter'; url: string; letter: Letter; contentEl: HTMLElement; scrollY: number }
  | { type: '404'; url: string; scrollY: number };      // 只可能是进来时的那一页
```

`mount()` 返回 `{ show(route) }` 之后，核心会接管这样的点击：同源的 `<a>`，路径是 `/` 或某封信的地址，没有查询参数，没有 `target`、`download`，没有按着修饰键。其他链接照常跳转。

一次不换页的跳转做这些事：取回那封信的页面 → 取出 `.content-body` → `ctx.widgets.init` → `history.pushState` → 改 `document.title` → 更新 `ctx.page` → 调 `show(route)` → 等它结束（可以返回 Promise）→ 设置滚动位置。

- 滚动位置：点链接过去是顶部，后退 / 前进是当时离开的位置，这个值在 `route.scrollY` 里。主题想自己管滚动（比如信是原地展开的），就让 `show` 返回 `false`（或 resolve 成 `false`），核心便不再动它。无论谁来管，**后退之后读者必须回到离开时的位置**。
- 取回来的信在本次到访里一直缓存着，再次打开拿到的是同一个节点。
- `standalone` 的信，以及任何失败，都退回成一次真正的页面跳转。最坏的情况永远是「像普通网站一样」。
- `mount()` 不返回 `show` 也可以：所有链接都整页跳转，只是歌会在换页时停。
- 换完视图后把焦点移到新内容上（`probe` 的做法：`main.focus({ preventScroll: true })`），键盘和读屏用户才知道页面换了。

### `ctx.ui`

- `hunger()`：网站自己的那句话，见[第八节](#八网站自己的声音和彩蛋)。每个主题都要把 `text` 显示在页脚。
- `switcher()`：换主题的那排链接，结构如下，样式由主题决定。每个主题都要把它放在页面上。

  ```html
  <nav class="theme-switcher" aria-label="换一种读法">
    <ul>
      <li><a href="?theme=classic" data-theme-id="classic">旧版</a></li>
      <li><a href="?theme=drift" data-theme-id="drift" aria-current="true">夜航</a></li>
      …
    </ul>
  </nav>
  ```

- `fmt`：几个共用的格式化函数。

  ```ts
  interface Fmt {
    date(day: string, style?: 'zh' | 'iso' | 'dot' | 'md' | 'weekday' | 'year'): string;
    //   'zh' 2026年8月12日（默认） 'iso' 2026-08-12   'dot' 2026.08.12
    //   'md' 8月12日              'weekday' 星期三   'year' 2026
    days(n: number | null): string;      // 4007 → "4007 天"；null → ""
    clock(seconds: number): string;      // 241.6 → "4:01"
  }
  ```

### `ctx.widgets.init(el)`

让一段信的正文里的小部件活起来（现在是翻转卡片）。核心对进来时的正文和每一段取回来的正文都已经调过一次；主题把正文搬进自己的版式之后**再调一次**，卡片会按新的宽度重新量高度。可以重复调用。

## 五、生命周期

1. `<head>`：内联脚本选好主题，在 `<html>` 上写 `data-theme="<id>"`、`lang="zh-Hans"`、`color-scheme`，把视口改成 `width=device-width,initial-scale=1,viewport-fit=cover`，然后依次写出字体 CSS、`shared/widgets.css`、`theme.css`（都会挡住首帧），并预取核心模块和 `theme.js`。
2. 页面解析。旧版的 DOM 是隐藏的（`body` 下除了 `#theme-root`、`script`、`style` 以外的一切都是 `display: none !important`）。信的页面里 `.content-body` 是活的，信自带的内联脚本此时已经执行。
3. `<body>` 末尾：核心读数据、组装 `ctx`、引入 `theme.js`、调用 `mount(ctx)`。
4. `mount` 结束（可以是 async）后：路由开始工作，`<html>` 上出现 `data-theme-ready="<id>"`。需要「JS 就绪后才开始」的入场动画用它来开启，不要用它来隐藏内容。
5. 之后每次站内跳转：`show(route)`。

**失败时**：`theme.css` 没加载到、`theme.js` 引入失败、`mount` 抛异常或 reject、`mount` 结束时 `ctx.root` 还是空的、5 秒内 `mount` 没结束且什么都没画，任何一种都会让页面以 classic 重新加载一次，并在本次到访里一直用 classic。失败原因会打印在重新加载后的控制台里（`[221] fell back to the classic theme because …`）。

所以：**`mount` 里先同步画出东西**，不要等字体、图片或动画结束才画第一笔。

主题没有卸载这一步。换主题就是带着 `?theme=<id>` 重新加载页面。

调试时可以在控制台看 `__theme`：`__theme.id`（当前主题）、`__theme.by`（为什么是它：`url` / `visit` / `date` / `night` / `bag` / `clock`）、`__theme.ctx`（就是传给 `mount` 的那个对象）。

## 六、信的正文

`route.contentEl`（进来时是 `ctx.page.contentEl`）是 kramdown 渲染出来的 HTML。31 封信里出现过的东西：

- 段落、`<br>`、`<b>`、`<em>`、链接
- `<blockquote>`：多数是歌词，每行一个 `<br>`
- `<blockquote class="largeQuote">`：大号的引语（2021 年那封里网站自己的留言就是它）
- `<img>`，有的包在 `<div align="center">` 或 `<p style="text-align:center">` 里，有的带内联的 `width`
- `<div class="img img--fullContainer img--14xLeading" style="background-image:url(…)">`：用背景图放的照片和 GIF，高度由类名决定（5x–16x）
- 「木婚快乐」里的 `.flip-card`，「29, 28, π」里的礼物盒（内联 `<style>`、`<script>` 和一块 `position: fixed` 的 `<canvas>`）

规矩：

1. **搬，不要克隆，不要用 HTML 重建。** 信自带的脚本已经对着这个节点执行过了。
2. 正文外面包的那层元素 class 必须是 **`letter-body`**。
3. 读信的时候，`.letter-body` 的**任何祖先都不能有 `transform`、`filter`、`perspective`**（`will-change: transform`、`contain: paint`、`backdrop-filter` 也一样）。否则礼物盒那块固定定位的画布会被困在那个祖先里。入场动画结束后要把 `transform` 清掉，不能留一个 `translateY(0)`。
4. 如果要改动正文（比如给西文包一层 `<span>`），要做成可重复执行的：同一个节点在本次到访里会被反复交给 `show`。不要动带 `id` 的元素。
5. **每个主题都要把全部的信过一遍**，看有没有横向溢出，两封特别的信是不是正常。

`shared/widgets.css` 在每个新主题下都会先于 `theme.css` 加载，里面是正文离不开的结构性样式，主题不用重写：

- 正文里的 `img`、`video` 不超出容器；`.img` 和 `.img--NxLeading` 的高度（N × `--letter-leading`，默认 `1.5rem`）
- 翻转卡片的结构和翻转动作
- 礼物盒在新主题下需要的几处修正（比如把写死的深色文字改成跟随主题）

外观全部通过自定义属性调整，在 `#theme-root` 或 `.letter-body` 上设置即可：

| 属性 | 默认值 | 作用 |
|---|---|---|
| `--letter-leading` | `1.5rem` | 正文的一行；照片块的高度是它的整数倍 |
| `--flip-front-bg` / `--flip-front-ink` / `--flip-front-border` / `--flip-front-pad` | `#fafaf8` / 继承 / `1px solid #e8e8e4` / `2rem 1.5rem` | 卡片正面（文字那面） |
| `--flip-back-bg` / `--flip-back-pad` / `--flip-photo-shadow` | `#f5f0e8` / `1.5rem` / 一道浅影 | 卡片背面（照片那面） |
| `--flip-hint-ink` / `--flip-hint-opacity` | 当前文字色 / `.45` | 卡片底部那行提示 |
| `--flip-duration` / `--flip-margin` / `--flip-focus` | `.7s` / `1.5rem 0` / 当前文字色 | 翻转时长、外边距、键盘焦点框 |
| `--gift-ink` / `--gift-margin` / `--gift-radius` / `--gift-shadow` | 继承 / `3rem 0` / `18px` / 一道深影 | 礼物盒揭开后的文字和图片 |

这些规则的优先级都很低，在 `theme.css` 里直接覆盖也可以。

## 七、三种要特别对待的信

**客人写的信（`role === 'guest'`）。** 第 32 封是 Claude 写的，孩子也出生了，所以不要假设只有两个作者。每个主题用自己的语言给客人的信一个安静的位置（唱片的附赠曲目、一颗路过的天体、一篇跋、一张标着「Claude 写的」的相片），不要藏起来，也不要比他们俩的信更显眼。

**沉重的信（`quiet === true`）。** 现在是 2026-02-06 的「世界赠予我们的」，写的是流产。它周围不要有俏皮的动效：不漂、不弹、不抖，悬停放大也不要。照常排版即可。

**自带脚本的信（`standalone === true`）。** 现在是「29, 28, π」。它总是整页加载（核心会处理），主题不需要做什么，照常给它一个普通链接。整页加载之后它和别的信一样通过 `ctx.page` 交给主题。

## 八、网站自己的声音和彩蛋

2021 年那封「两年不见，你还好吗」的末尾，网站自己说过话：前三年很幸福，因为「不停有人喂我吃东西」，后来两年被冷落，「好气呀」。**「喂我吃东西」的意思是有人来更新网站，写了一封新的信。**

- `ctx.ui.hunger()` 按最新一封信距今的天数给出网站现在的状态，共五档：刚吃过、还不饿、有点饿、很饿、破纪录（比至今最长的 838 天空白还久）。文字统一写在 `core/eggs.js`，口吻是它自己的：第一人称，有点气鼓鼓，短，不煽情。**每个主题都要在页脚显示 `text`**，用主题自己的字体和位置；不要改写它，也不要给它加修饰。`level`（0–4）可以用来决定样式。
- 控制台里有几句问候（所有主题，包括 classic）。
- 在页面上敲 `221`（焦点不在输入框里时）会换到下一个主题，敲 `pi` 会在角落里显示「在一起第 N 天」对应的 π 的第 N 位起的十位数字。主题不用为它们做任何事，只是不要占用这两个按键序列。
- 纪念日本身也是彩蛋：02-21 是 orbit，11-28 是 drift，02-06 和 07-04 是 sides，08-12 是 folio，09-15（网站的生日）是 classic。

## 九、规矩

**体积**
- 首页首屏（冷缓存）：HTML + CSS + JS + 字体 + 首屏可见的图片，传输量 ≤ 700 KB。
- `theme.css` ≤ 40 KB，`theme.js` ≤ 60 KB（不用压缩，GitHub Pages 会 gzip）。
- 封面只通过 `ctx.img()`，永远不直接用原图，除非读者明确要求看原图。
- 读者按下播放之前不请求音频。

**动效**
- `prefers-reduced-motion: reduce` 时没有动画。
- `quiet` 的信周围没有俏皮的动效。

**版式**
- 402px 宽时没有横向滚动（1440px 也一样）。
- 可点的东西至少 44px。
- 尊重安全区（`env(safe-area-inset-*)`）。
- 需要整屏高度的地方用 `svh` / `dvh`，不用 `100vh`。
- 没有任何功能只能靠悬停触发。
- 核心版式只用 Safari 16.4 已经支持的特性，更新的 CSS 放在 `@supports` 里做渐进增强。

**键盘和读屏**
- 每封信都能用 Tab 到达，焦点看得见，Esc 能关掉浮层，后退键做读者预期的事。
- `<html lang="zh-Hans">` 由核心设置。

**文字**
- 界面上的字都用中文，平实，是他们俩的语气。没有爱心，没有粉色，没有花体字，没有婚礼套路。

**边界**
- 主题的 CSS 可以写 `html`、`body`、`#theme-root` 以及它里面的一切。不要试图把 `#theme-root` 以外的东西显示出来。
- 需要记住读者的选择时用 `localStorage`，键名以 `f221:<id>:` 开头，读写都包在 `try/catch` 里。

## 十、本地预览和测试

```bash
npm start                        # http://localhost:4301
```

- `http://localhost:4301/?theme=<id>` 强制用某个主题，并在本次到访里一直用它（之后的刷新、跳转都不用再带参数）。
- `?theme=classic` 回到旧版，`?theme=random` 重新抽一次，`?theme=probe` 看参考主题。
- 没启用（`enabled: false`）的主题也可以这样预览。
- 404 页在 `http://localhost:4301/404/?theme=<id>`。（`permalink: pretty` 把 `404.html` 生成在 `/404/` 下，所以线上遇到不存在的地址时，GitHub Pages 显示的是它自己的 404 页，不是这一页。）

```bash
npm test                                     # 全部测试
npx playwright test -g 'theme "drift"'       # 只测一个主题
npx playwright test --project=chrome         # 只用 Chrome
npx playwright test --ui                     # 带界面，能一步步看
```

`npm test` 会先构建网站（到 `tests/.site/`），在一个空闲端口上起一个小服务器，然后用机器上装的 Chrome（1440 × 900）跑。装了 Playwright 的 WebKit（`npx playwright install webkit`）的话，还会用 WebKit 在 402 × 874 下再跑一遍，这是不用真机时最接近 iOS Safari 的办法；装了 Playwright 的 Firefox 也会多跑一遍。

对 `assets/themes/` 里**每一个有文件的主题**，测试会检查（`tests/themes.spec.mjs`）：

- 首页、一封普通的信、沉重的那封、两封特别的信、404 页：画进了 `#theme-root`，没有报错，没有横向滚动，没有请求站外的任何东西，没有请求封面原图，按播放之前没有请求音频
- 信的正文在 `.letter-body` 里面
- 翻转卡片点一下翻过去，用键盘能翻回来
- 礼物盒点开后彩纸铺满整个屏幕（验证的就是「祖先没有 transform」）
- 首页 → 点一封信（不换页）→ 点 `[data-play]` 歌响了 → 后退（不换页，回到原来的滚动位置，歌还在放）→ 前进
- 402px 宽、`prefers-reduced-motion: reduce` 下各种页面都不溢出
- 两个文件没有超出体积上限

测试靠三个约定找到东西：正文容器叫 `.letter-body`；放歌的控件带 `data-play`；首页用普通的 `<a href="{letter.url}">` 链接到信。

改了核心或模板之后，还要确认旧版没有被动到：让每一页都以 classic 打开，再和线上版本逐页对比。

```bash
npm run build
node tests/server.mjs --dir _site --port 4201 --theme classic    # 每个页面都当作 ?theme=classic 打开
```

## 十一、iOS Safari 上常见的坑

没有真机时，以 WebKit 那一组测试和 402 × 874 的截图为准；下面这些是它测不出来或容易漏掉的。

1. **`100vh` 比看得见的区域高。** 地址栏会遮住一截。整屏的封面用 `min-height: 100svh`（稳定，不跳），需要跟着工具栏伸缩的用 `dvh`。不要用 `dvh` 驱动动画。
2. **`position: fixed` 遇到有 `transform` 的祖先就不再相对视口。** `filter`、`perspective`、`backdrop-filter`、`will-change: transform`、`contain: paint` 同理。见[第六节](#六信的正文)第 3 条。
3. **安全区。** 核心已经把视口设成 `viewport-fit=cover`，所以贴边的固定元素要自己让出刘海和底部横条：`padding-bottom: calc(.5rem + env(safe-area-inset-bottom))`。横屏时左右也有。
4. **声音必须从手势里来。** `player.toggle()` 要在 `click` 处理函数里同步调用，中间不能隔着 `await`、`setTimeout` 或动画结束的回调。
5. **悬停会「粘住」。** 点一下之后 `:hover` 样式一直留着。悬停效果写在 `@media (hover: hover)` 里，并且保证不靠悬停也能用。
6. **`background-attachment: fixed` 没有效果。** 固定背景用一个独立的 `position: fixed` 的层。
7. **回弹时会露出 `html` 的背景。** 把底色设在 `html` 上（和 `ground` 一致），不要只设在某个容器上。
8. **表单控件字号小于 16px 时，聚焦会把页面放大。**
9. **没有 `requestIdleCallback`，`scrollend` 要到 26.2 才有。** 用 `setTimeout` 和滚动停止的计时器兜底。
10. **自定义滚动条**：`::-webkit-scrollbar` 只有 `display: none` 有效，用标准的 `scrollbar-width`。
11. **日期字符串**：`new Date('2026-08-12 19:25')` 在 Safari 里是 Invalid Date。数据里的日期都是 `YYYY-MM-DD`，天数用 `letter.days` 和 `ctx.ui.fmt`，不要自己解析。
12. **竖排**：`writing-mode` 不要设在 `<html>` 上，放在一个明确给了宽高的内部滚动容器里；纵中横用 `text-combine-upright: all`（数字要自己包一层元素）。
13. **`backface-visibility` 要写 `-webkit-` 前缀**，并且父元素要有 `transform-style: preserve-3d`。（共用的翻转卡片已经处理好，并且在不支持背面剔除的环境里也不会穿帮。）
14. **侧滑返回自带系统动画。** 自己再给后退加一段转场，会出现两段动画叠在一起。后退时的转场要短，或者干脆没有。
15. **长按图片和链接会弹出系统菜单**，可拖动的元素上要考虑 `-webkit-touch-callout: none`；但信里的照片不要禁用，读者可能想存下来。
