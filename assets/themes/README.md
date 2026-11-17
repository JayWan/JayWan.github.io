# 主题作者指南

这个网站有好几套主题，每次到访自动挑一套。这份文档写给要做主题的人：一个主题需要哪些文件、拿到手的 `ctx` 里有什么、哪些规矩必须守、怎么在本地看和测。

最朴素的完整例子是 [`probe/`](probe/)（`theme.js` 不到 200 行）。它把 `ctx` 的每一项都用了一遍，建议先读它，再读这里。

- [一、它是怎么工作的](#一它是怎么工作的)
- [二、一个主题由什么组成](#二一个主题由什么组成)
- [三、最小骨架](#三最小骨架)
- [四、ctx 里有什么](#四ctx-里有什么)
- [五、生命周期](#五生命周期)
- [六、信的正文](#六信的正文)
- [七、要特别对待的几种信](#七要特别对待的几种信)
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
| `fonts` | 字体名列表。每个名字对应 `assets/fonts/<名字>.css`，只在这个主题下加载，排在 `theme.css` 之前。有哪些字体、CSS 里该写的 `font-family` 名字（都以 `F221` 开头）、字体栈怎么排，见 [`assets/fonts/README.md`](../fonts/README.md)。文件不存在的名字在构建时会被跳过，页面改用字体栈里的后备字体，不会出现 404；写错的名字由 `npm test` 指出 |
| `dates` | 这个主题的日子，`"月-日"`。那天新的到访一定是它 |
| `enabled` | `false` 就不参加抽选，仍可用 `?theme=<id>` 预览 |
| `hidden` | `true` 就永远不参加抽选，只能用 `?theme=<id>` 打开（`probe` 就是这样） |

一项写出来是这样（四个新主题的已经写好，字体名也对好了，一般不用改）：

```yaml
  - id: drift
    name: 夜航
    ground: "#14130f"
    dark: true
    fonts: [serif-sc, sans-sc-400, mono]   # 一行写完的 [列表]
    dates: ["11-28"]
    enabled: true
```

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

两件容易踩到的事：

- **旧版的 DOM 还在文档里，只是被隐藏了**（`article.postWrapper`、`footer.section--footer`、分享浮层等等）。所以找元素一律从 `ctx.root` 出发：`root.querySelector('footer')`，不要写 `document.querySelector('footer')`，后者会先找到旧版的那个。
- **数据里的文字不是 HTML。** 有一封信的标题是 `七夕&一点九周年快乐`，另一封是 `29, 28, π`。用 `textContent` 或 `append('文字')` 放进页面；如果用 `innerHTML` 拼字符串，标题、摘句、地点、歌名都要先转义。

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
  prose: { prepare(el: Element, letter?: Letter): Element };   // 正文的统一整理，核心已经替主题调过，见第六节
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

一个普通数组（最早的在前，按信**真正写下的那一天**排），外加四个帮手：

```ts
interface Letters extends Array<Letter> {
  byUrl(url: string | URL | Element): Letter | null;   // 路径、完整网址、编码过或没编码过都可以，也可以直接传一个 <a>
  byNo(no: number): Letter | null;
  latest: Letter;                      // 最新的一封
  years: { year: number; letters: Letter[] }[];   // 从第一封信那年到最新一封那年，一年一项，最早的在前；
                                                  // 没有人写信的年份（现在是 2020 和 2022）也有一项，letters 是 []
}

interface Letter {
  no: number;               // 第几封，从 1 开始
  index: number;            // 在数组里的位置（no - 1）
  title: string;
  url: string;              // "/story/2026/08/12/木婚快乐/"，可以直接放进 href
  date: string;             // "2026-08-12"，信真正写下的那一天（见下面「日期」）
  time: string | null;      // "19:25"，front matter 里写的时间；很多封只是占位（00:00、01:00）。真实日期和网址不一致的信是 null
  year: number;             // 2026
  doy: number;              // 一年里的第几天，1–366
  author: string;           // 第一作者："Pikajay" | "Pikachi" | "Claude" | …
  authors: string[];        // 所有作者，第一作者在前：["Pikajay"]、["Pikajay", "Pikachi"]、["Claude"]
  role: 'him' | 'her' | 'both' | 'guest';   // him = Pikajay，her = Pikachi，both = 两个人一起写的，其他人都是 guest
  days: Days;               // 写这封信那天，各过了多少天；信里自己说了数字的，以信为准（见下面「天数」）
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
  own: boolean;             // false = 这张封面是网上找的图，不是他们自己拍的照片（现在有 10 封）
  base: string; widths: number[];   // 缩略图：`${base}-${width}.avif` / `.jpg`
}
```

`song.title` 是 mp3 的文件名去掉扩展名（他们就是这样给歌起名的）。`song.duration` 是秒，可能带小数；`artist` 来自 mp3 的 ID3 标签，有几首没有。

**`song`、`cover`、`quote`、`place` 都可能是 `null`，作者也不只有两个人。** 现在的 32 封信恰好每一封都有歌、封面和摘句，所以照着现有数据写，很容易写出 `letter.song.title` 这样的代码；下一封信只要没配歌，整个主题就会抛异常、全站退回旧版。测试会把数据改写成「有一封客人写的信、有一封没有歌没有封面没有摘句的信」再把每个主题跑一遍（见[第十节](#十本地预览和测试)）。

几件数据上的事，都已经在核心里处理好，主题照着字段用就对了：

- **日期。** 「One Year」是 2017-02-21 写的，但 front matter 里的 `date` 当年打错了，并且成了它的网址。这封信在 front matter 里另有 `written_on: 2017-02-21`：`letter.date`（以及 `year`、`doy`、`days`、排序和编号）用的都是真实的这一天，`letter.time` 是 `null`，`letter.url` 保持原样。**界面上的日期一律用 `letter.date`，不要从网址里取。**
- **天数。** `letter.days` 是按日历算的整天数，但信里自己写了数字的以信为准：「221 FOREVER」说认识 295 天，「和小天使的三百天」说在一起 300 天（他们有时把当天也算进去，日历上是 294 和 299）。front matter 里写的是 `days: { met: 295 }` / `days: { together: 300 }`。
- **作者。** `role` 有四种，主题四种都要能画。`both` 现在只有「教小天使发布文章」（front matter 里 `coauthor: Pikachi`，正文大半是她写的，那是她第一次在这个网站上写字）；`guest` 现在是第 32 封，Claude 写的。**她写的信不是例外。** 要标作者，就每一封都标（`probe` 的写法：「他写的」「她写的」「两个人一起写的」「Claude 写的」）；不要只在她的信或客人的信上加记号。
- **封面是不是他们自己的照片。** `cover.own === false` 的封面是早年从网上找的配图。主题不要把这样的图当成他们的照片来放大、做成相片或铺满首屏；`probe` 的做法是把它压得很小。

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

`cover` 是 `null`（信没有封面）时返回一个空的 `<picture class="is-empty">`（里面没有 `<img>`），版式代码不用特判；需要占位的话给 `.is-empty` 写样式。

`<img>` 上的 `width` / `height` 属性是原图的尺寸（比如 4032 × 3024），平均色和模糊小图也在 `<img>` 上。`shared/widgets.css` 给 `#theme-root picture > img` 垫了一层 `max-width: 100%; height: auto`（优先级为零），所以不写任何样式时封面也不会撑破版面；要裁成固定比例就像上面那样自己写宽高。`<picture>` 本身是行内元素，通常要给它 `display: block`。

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
- `on()` 只是登记，不会立刻回调一次；`state` 始终是同一个对象，随时可以读。刚画出来的按钮自己读一次 `player.state`（`probe` 在每次 `show` 之后调一次 `paint(player.state)`）。
- 状态的组合：刚点了一首新歌是 `playing: false, loading: true`，出声后变成 `playing: true, loading: false`；换歌时也是先回到 `playing: false`。
- 没有歌的信传给 `toggle()` 什么都不会发生；什么都没加载时 `toggle()`、`play()`、`seek()` 也什么都不做。`next()` / `prev()` 到了头就停住，不会绕回去。
- 常驻的播放键（没有歌在放时也看得见的那种）要自己决定放哪一首，例如 `player.toggle(player.state.letter || ctx.page.letter || letters.latest)`。
- `error` 是 `'failed'`（文件取不到）时，再调一次 `toggle()` 或 `play()` 会重新加载文件，所以出错的界面留一个能再点的播放键就够了。`'blocked'` 是浏览器不让出声（没有手势），同样再点一次即可。
- `seek()` 会夹在 0 和总时长之间；在歌加载完之前调用，等于指定从哪里开始放。
- **只在用户的点击里调用 `toggle()` / `play()`**。浏览器不允许没有手势就出声，核心也绝不自动播放。
- 一首歌放完就停，不会自动放下一首。一封信，一首歌。
- 按播放之前不会请求任何音频数据。
- 核心已经接好了 Media Session（锁屏和耳机上的播放控制）。
- **每一个能开始放歌的控件都要带 `data-play` 属性**（值随意），测试靠它找到播放键：在信的页面上，测试会点第一个看得见的 `[data-play]`，这一下必须让这封信的歌开始加载。
- 播放键不要放在 `<a>` 里面：点嵌在链接里的按钮，浏览器照样会跟着链接走（核心的不换页跳转也一样），歌刚响页面就换了。版式上非嵌不可时，在按钮的 `click` 里调用 `event.preventDefault()`。

### `ctx.router`

```ts
interface Router {
  go(url: string, options?: { replace?: boolean }): Promise<boolean>;
                                         // 等同于点了一个链接。true = 没有换页。replace 见下面「历史记录」
  home(): Promise<boolean>;              // 「回到目录」，就是 back('/')
  back(url?: string): Promise<boolean>;  // 「回到 url」，默认 url 是 '/'。见下面
  lastRead: Letter | null;               // 刚读过的那封信；这个标签页里还没打开过信时是 null
  prefetch(url: string): void;           // 提前把一封信的 HTML 取回来（指针移上去或手指按下时调用）
  current: Route;                        // 现在屏幕上的这一页
  soft: boolean;                         // mount 返回了 show 之后为 true
}

type Route =
  | { type: 'home'; url: string; hash: string; scrollY: number }
  | { type: 'letter'; url: string; hash: string; letter: Letter; contentEl: HTMLElement; scrollY: number }
  | { type: '404'; url: string; hash: string; scrollY: number };      // 只可能是进来时的那一页
```

`mount()` 返回 `{ show(route) }` 之后，核心会接管这样的点击：同源的 `<a>`（HTML 的和 SVG 里的都算），路径是 `/` 或某封信的地址，没有查询参数，没有 `target`、`download`，没有按着修饰键。其他链接照常跳转。指向**当前这一页**里某个锚点的链接（`href="#某个id"`）也不接管，由浏览器自己滚过去，所以「跳到正文」这样的链接可以照常写。

一次不换页的跳转做这些事：取回那封信的页面 → 取出 `.content-body` → `ctx.prose.prepare`（见[第六节](#六信的正文)）→ `ctx.widgets.init` → 写历史记录（新增一条或替换当前这条，见下一条）→ 改 `document.title` → 更新 `ctx.page` → 调 `show(route)` → 等它结束（可以返回 Promise）→ 设置滚动位置。

- **历史记录，所有主题都一样：从目录打开一封信是新增一条；从一封信到另一封信（上一封 / 下一封）是替换当前这条。** 于是目录永远在信的后面一步，在任何一封信上按后退都回到目录，而不是把翻过的信一封封倒回去。这是默认规则，点链接和 `router.go(url)` 都照它办，主题什么都不用做：上一封 / 下一封写成普通的 `<a href>` 就是替换。想明确指定时传 `router.go(url, { replace: true })`（替换）或 `{ replace: false }`（新增）。翻到 `standalone` 的那封信时是整页加载，核心同样用替换的方式加载，后退仍然回到目录。
- **滚动位置**：点链接过去是顶部，后退 / 前进是当时离开的位置，这个值在 `route.scrollY` 里（记的是 `window.scrollY`）。链接带着锚点（`/story/…/#某个id`）时 `route.hash` 是 `"#某个id"`，核心会滚到那个元素。主题想自己管滚动（比如信是原地展开的），就让 `show` 返回 `false`（或 resolve 成 `false`），核心便不再动它。无论谁来管，**后退之后读者必须回到离开时的位置**。`show(route)` 被调用的那一刻，页面还停在上一个视图的滚动位置，需要的话可以在函数开头读 `window.scrollY`。
- **`show()` 不会重叠。** 上一次 `show` 返回的 Promise 还没结束时（比如转场动画还在放），下一次跳转会等它，最多等 2 秒；这期间读者又点了几次，只有最后一次会被画出来。所以 `show` 里不用防备「画到一半又被调用」，但也因此**只在确实需要核心等待时才返回 Promise**（等的是「滚动位置可以设置了」这一刻，不必等整段动画放完），并且它一定要结束。
- **「回到目录」**：给链接加上 `data-back` 属性，`<a href="/" data-back>`；键盘的 Esc 等其他入口调 `router.home()`（就是 `router.back('/')`），效果相同。目录如果就在后面一步（读者是从目录点进来的，之后不管翻了多少封），它等同于后退键：回到目录，不会多出一条历史记录。目录不在后面（直接打开的信），它就新增一条目录的记录。不带 `data-back` 的普通 `<a href="/">`（比如页眉的站名）永远是新增一条、去目录的顶部。
- **回到目录时，眼前应该是刚读过的那封信，而不是当初出发的位置。** 核心把「刚读过的那封信」记在 `router.lastRead` 里（整页加载之后也还在，存在这个标签页的 `sessionStorage` 里）。读者从目录点开第 29 封，一路翻到第 21 封，再回目录，这时目录应该停在第 21 封那里。
  - `show(home)` 没有返回 `false` 的主题（滚动交给核心）：核心先恢复离开时的位置；如果读者翻过信（现在的 `lastRead` 不是当初点开的那一封），或者这条目录记录是 `home()` 新增的，而目录里指向 `lastRead` 的链接（`<a href="{letter.url}">`）又不在屏幕上，核心就滚动窗口，把离得最近的那个链接放到屏幕中间。读者原样后退（点开一封、读完、后退）时目录一动不动。核心只滚动窗口；固定或吸附在屏幕上的元素里的链接（比如播放条上那封信的名字）不算目录。
  - `show(home)` 返回 `false` 的主题（自己管滚动）：自己读 `router.lastRead`，把那封信带到眼前。
  - 两种主题都可以在 `show(home)` 里用 `router.lastRead` 给那一封做个记号（`probe` 给它的标题加了下划线）。
- **等待中的提示**：信还在路上时，`<html>` 上有 `data-navigating` 属性，取到就去掉。`shared/widgets.css` 只把指针改成了「忙」，主题可以用 `html[data-navigating] …` 画自己的提示（给它加一点 `animation-delay`，网快的时候就不会闪一下）。超过 8 秒还没取到，就改成整页跳转。
- `prefetch` 只取 HTML，不会下载信里的照片（有的一张就 4 MB）；照片要到这封信真的被打开时才开始加载。所以可以放心在 `pointerenter` / `touchstart` 上调用。
- 取回来的信在本次到访里一直缓存着，再次打开拿到的是同一个节点。
- `standalone` 的信，以及任何失败（包括 `show` 抛异常），都退回成一次真正的页面跳转。最坏的情况永远是「像普通网站一样」。
- `mount()` 不返回 `show` 也可以：所有链接都整页跳转，只是歌会在换页时停。
- 换完视图后把焦点移到新内容上（`probe` 的做法：`main.focus({ preventScroll: true })`），键盘和读屏用户才知道页面换了。
- `router.current` 始终是同一个对象，跳转时原地更新；传给 `show` 的 `route` 则每次都是新的。要记住「上一页是什么」就自己存需要的字段，不要存 `router.current` 本身。
- 主题可以用 `history.pushState` / `replaceState` 记同一页里的状态（选中了哪一封、浮层开没开），路径没变时核心不会插手，`popstate` 由主题自己处理。写的时候把已有的状态带上：`history.replaceState({ ...history.state, sel: 12 }, '', '#12')`。**不要在 `pagehide`、`beforeunload` 或页面变为不可见时调用 `replaceState`**：WebKit 会因此把这条历史记录的状态整个清空（回来时 `history.state` 是 `null`），Chrome 在刷新时则直接丢掉这次写入。要在离开时存东西，用 `sessionStorage`。

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
    season(day: string | Date): '春' | '夏' | '秋' | '冬' | '';
    //   按月份（北半球）：3–5 月春，6–8 月夏，9–11 月秋，12–2 月冬。season('2016-06-08') → "夏"
    days(n: number | null): string;      // 4007 → "4007 天"；null → ""
    clock(seconds: number): string;      // 241.6 → "4:01"
  }
  ```

  **一封信的季节用 `fmt.season(letter.date)`，不要用节气或天文季节来算。** 6 月 8 日的「Hang Zhou」写着「夏花烂漫」，按夏至来算它却成了春天。

### `ctx.widgets.init(el)`

让一段信的正文里的小部件活起来（现在是翻转卡片）。核心对进来时的正文和每一段取回来的正文都已经调过一次；主题把正文搬进自己的版式之后**再调一次**，卡片会按新的宽度重新量高度。可以重复调用。

### `ctx.prose.prepare(el, letter)`

把一段正文从「旧版页面写的样子」整理成「任何主题都能直接排的样子」，做了什么见[第六节](#六信的正文)。**主题通常不需要调用它**：进来时的那段正文在 `mount` 之前、每一段取回来的正文在交给 `show` 之前，核心都已经整理过，主题拿到的永远是整理好的。同一段正文再调一次什么都不会发生（正文上有 `data-prose` 标记）。旧版（classic）下从不调用。

## 五、生命周期

1. `<head>`：内联脚本选好主题，在 `<html>` 上写 `data-theme="<id>"`、`lang="zh-Hans"`、`color-scheme`，把视口改成 `width=device-width,initial-scale=1,viewport-fit=cover`，然后依次写出字体 CSS、`shared/widgets.css`、`theme.css`（都会挡住首帧），并预取核心模块和 `theme.js`。
2. 页面解析。旧版的 DOM 是隐藏的（`body` 下除了 `#theme-root`、`script`、`style` 以外的一切都是 `display: none !important`）。信的页面里 `.content-body` 是活的，信自带的内联脚本此时已经执行。
3. `<body>` 末尾：核心读数据、组装 `ctx`（信的页面在这一步整理正文：`ctx.prose.prepare`，然后 `ctx.widgets.init`）、引入 `theme.js`、调用 `mount(ctx)`。
4. `mount` 结束（可以是 async）后：路由开始工作，`<html>` 上出现 `data-theme-ready="<id>"`。需要「JS 就绪后才开始」的入场动画用它来开启，不要用它来隐藏内容。
5. 之后每次站内跳转：`show(route)`。一次只有一个 `show` 在跑（见 [`ctx.router`](#ctxrouter)）。

**失败时**：`theme.css` 没加载到、`theme.js` 引入失败、`mount` 抛异常或 reject、`mount` 结束时 `ctx.root` 还是空的、5 秒内 `mount` 没结束且什么都没画，任何一种都会让页面以 classic 重新加载一次，并在本次到访里一直用 classic。失败原因会打印在重新加载后的控制台里（`[221] fell back to the classic theme because …`）。

所以：**`mount` 里先同步画出东西**，不要等字体、图片或动画结束才画第一笔。

主题没有卸载这一步。换主题就是带着 `?theme=<id>` 重新加载页面。

调试时可以在控制台看 `__theme`：`__theme.id`（当前主题）、`__theme.by`（为什么是它：`url` / `visit` / `date` / `night` / `bag` / `clock`）、`__theme.ctx`（就是传给 `mount` 的那个对象）。

## 六、信的正文

`route.contentEl`（进来时是 `ctx.page.contentEl`）是 kramdown 渲染出来的 HTML，**并且已经被核心用 `ctx.prose.prepare` 整理过**。旧版页面里有不少只在旧版样式下才成立的写法（用背景图放的照片、没有尺寸的图片、写死的高度），每个主题都得做同样的修补，所以统一在核心里做一次，主题拿到手的正文是这样的：

- 段落、`<br>`、`<b>`、`<em>`、链接、带 `id` 的标题
- **照片**：每一张都是 `<figure class="letter-figure"><img …></figure>`；原来单独包着一张图的 `<p>` 或 `<div align="center">` 已经换成了这个 `figure`。旧版用 `<div class="img img--NxLeading" style="background-image:url(…)">` 放的 21 张也已经换成了它，一张都没有少。
  - `<img>` 上有 `width` / `height`（原图尺寸，页面不会跳）、`loading="lazy"`、`decoding="async"`、`alt`；有缩略图的带 `srcset` 和 `sizes`，原图地址留在 `data-orig`。
  - `figure` 上的类：`is-gif`（会动的图，`<img>` 上同时有 `data-gif`，主题可以决定怎么对待它，比如尊重 `prefers-reduced-motion`）、`is-portrait`（竖图）、`is-small`（原图不到 400px 宽，不要放大）。
  - 作者自己给图片写过宽度（`width: 70%`）的，这个值在 `figure` 的 `--fig-w` 上。
  - 默认样式在 `shared/widgets.css`：保持比例，不超出版心，不放大，居中，竖图不超过一屏高。主题可以整个覆盖。
  - 夹在一句话中间的 `<img>` 留在原处，只补了尺寸。
- `<blockquote class="lyrics">`：用 `<br>` 一行一行排的引文，多数是歌词。结尾那行「- 某某」包在 `<span class="quote-by">` 里。只有一句话加一个出处的引文不算 `lyrics`。
- `<blockquote class="largeQuote">`：大号的引语（2021 年那封里网站自己的留言就是它）
- `<blockquote class="u--startsWithDoubleQuote">`（22 处）：以 `“` 开头的引语。旧版用 `text-indent: -0.4em` 把引号悬挂到版心外面；新主题可以照做，也可以不管
- **粗体**：「教小天使发布文章」里她写的那 14 行，每行开头一个 `<b>`、从不关闭（kramdown 把它们一层套一层）。整理之后是每行一个独立的 `<b>`，不嵌套，也不会漏到信的外面。那些行本来就是粗体，是她自己加的。
- 写死的高度（`style="height: 800px"`）已经去掉，其余的内联样式保留；信里自带的 `<style>`、带 `id` 的元素和两件小部件不动。
- 「木婚快乐」里的 `.flip-card`，「29, 28, π」里的礼物盒（内联 `<style>`、`<script>` 和一块 `position: fixed` 的 `<canvas>`）。它们原样保留，只是里面的图片补了尺寸，卡片正面最后的日期和地点两行是 `<p class="letter-signoff">`。

**这两封信是「东西」，不是文字加配图，任何主题都不能把它们摊平、预先打开或换成占位符：**

- 翻转卡片：正面是打出来的信和落款（「2026年8月12日 7:25 PM」「Oak Creek 家中」），背面是那张手写卡片的照片；点一下（或用键盘 Enter / 空格）翻面。整页打开和不换页跳转过来都要能翻。
- 礼物盒：读者点了才打开，打开后是那张图片和一句「生日快乐，我的小天使！」，彩纸铺满整个屏幕。

它们的结构性样式在 `shared/widgets.css`，主题只负责「换皮」（下面表格里的自定义属性）。

规矩：

1. **搬，不要克隆，不要用 HTML 重建。** 信自带的脚本已经对着这个节点执行过了。
2. 正文外面包的那层元素 class 必须是 **`letter-body`**。
3. 读信的时候，`.letter-body` 的**任何祖先都不能有 `transform`、`filter`、`perspective`**（`will-change: transform`、`contain: paint`、`backdrop-filter` 也一样）。否则礼物盒那块固定定位的画布会被困在那个祖先里。入场动画结束后要把 `transform` 清掉，不能留一个 `translateY(0)`。
4. 如果要改动正文（比如给西文包一层 `<span>`），要做成可重复执行的：同一个节点在本次到访里会被反复交给 `show`。不要动带 `id` 的元素（kramdown 给每个标题都生成了 `id`，礼物盒的脚本也按 `id` 找元素）。
5. **每个主题都要把全部的信过一遍**，看有没有横向溢出，两封特别的信是不是正常。
6. 礼物盒那封信自带的 `<style>` 只要这封信在页面上就对整页生效。它用到的名字不要再用：类名 `gift-scene`、`gift-anim`、`gift-hint`、`float-img`、`reveal-words`，动画名 `hint-pulse`、`float-bob`、`pop-in`（主题里也叫 `pop-in` 的 `@keyframes` 会在读这封信时被它的那一份盖掉）。

`shared/widgets.css` 在每个新主题下都会先于 `theme.css` 加载，里面是正文离不开的结构性样式，主题不用重写：

- 正文里的 `img`、`video` 不超出容器；`figure.letter-figure` 的默认排法（见上）
- 翻转卡片的结构和翻转动作
- 礼物盒在新主题下需要的几处修正（比如把写死的深色文字改成跟随主题）

外观全部通过自定义属性调整，在 `#theme-root` 或 `.letter-body` 上设置即可：

| 属性 | 默认值 | 作用 |
|---|---|---|
| `--letter-leading` | `1.5rem` | 正文的一行；照片上方的间距是它 |
| `--flip-front-bg` / `--flip-front-ink` / `--flip-front-border` / `--flip-front-pad` | `#fafaf8` / `#23221f` / `1px solid #e8e8e4` / `2rem 1.5rem` | 卡片正面（文字那面）。默认是一张浅色的卡片配深色的字，放在深色主题里也读得清；要改就底色和字色一起改 |
| `--flip-back-bg` / `--flip-back-pad` / `--flip-photo-shadow` | `#f5f0e8` / `1.5rem` / 一道浅影 | 卡片背面（照片那面） |
| `--flip-hint-ink` / `--flip-hint-opacity` | 当前文字色 / `.45` | 卡片底部那行提示 |
| `--flip-duration` / `--flip-margin` / `--flip-focus` | `.7s` / `1.5rem 0` / 当前文字色 | 翻转时长、外边距、键盘焦点框 |
| `--gift-ink` / `--gift-margin` / `--gift-radius` / `--gift-shadow` | 继承 / `3rem 0` / `18px` / 一道深影 | 礼物盒揭开后的文字和图片 |

这些规则的优先级都很低，在 `theme.css` 里直接覆盖也可以。

## 七、要特别对待的几种信

**客人写的信（`role === 'guest'`）。** 第 32 封「装修好了，钥匙在门垫下面」是 Claude 写的，孩子也出生了，所以不要假设只有两个作者。每个主题用自己的语言给客人的信一个安静的位置（唱片的附赠曲目、一颗路过的天体、一篇跋、一张标着「Claude 写的」的相片），不要藏起来，也不要比他们俩的信更显眼。按 `role` 查表的代码要给 `guest` 留一项，或者有默认值：`({ him: 'A', her: 'B' })[letter.role]` 在客人的信上是 `undefined`。名字从 `letter.authors` 里取，不要写死成 Claude。

**两个人一起写的信（`role === 'both'`）。** 现在是「教小天使发布文章」：开头几行是他写的，后面大半是她的。它既不是「他的信」也不是「她的信」，按作者分栏、分面、分色的主题要给它一个说得通的位置，`letter.authors` 里有两个名字。

**她写的信（`role === 'her'`）不需要特别对待，这正是要说的。** 现在有 4 封。不要只给她的信加标签、换颜色或者单独归一类，好像他写才是常态：要标作者就每一封都标，要分就两边对等地分。

**沉重的信（`quiet === true`）。** 现在是 2026-02-06 的「世界赠予我们的」，写的是流产。它周围不要有俏皮的动效：不漂、不弹、不抖，悬停放大也不要。照常排版即可。

**自带脚本的信（`standalone === true`）。** 现在是「29, 28, π」。它总是整页加载（核心会处理），主题不需要做什么，照常给它一个普通链接。整页加载之后它和别的信一样通过 `ctx.page` 交给主题。

## 八、网站自己的声音和彩蛋

2021 年那封「两年不见，你还好吗」的末尾，网站自己说过话：前三年很幸福，因为「不停有人喂我吃东西」，后来两年被冷落，「好气呀」。**「喂我吃东西」的意思是有人来更新网站，写了一封新的信。**

- `ctx.ui.hunger()` 按最新一封信距今的天数给出网站现在的状态，共五档：刚吃过、还不饿、有点饿、很饿、破纪录（比至今最长的 838 天空白还久）。文字统一写在 `core/eggs.js`，口吻是它自己的：第一人称，有点气鼓鼓，短，不煽情。**每个主题都要在页脚显示 `text`**，用主题自己的字体和位置；不要改写它，也不要给它加修饰。`level`（0–4）可以用来决定样式。
- 控制台里有几句问候（所有主题，包括 classic）。
- 在页面上敲 `221`（焦点不在输入框里时）会换到下一个主题，敲 `pi` 会在角落里显示「在一起第 N 天」对应的 π 的第 N 位起的十位数字。主题不用为它们做任何事，只是不要占用这两个按键序列。那行数字是核心临时放进 `#theme-root` 的一个 `position: fixed` 的小块（`#egg-pi`），不用管它。
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

**读信的路（每个主题都一样）**
- 上一封 / 下一封不增加历史记录，在任何一封信上后退都回到目录（核心的默认规则，见 [`ctx.router`](#ctxrouter)；主题不要用 `{ replace: false }` 把它改回去）。
- **每封信的末尾都有回目录的入口**，不能只在顶上有。读完一封长信，目录要在一次点按之内：一个 `<a href="/" data-back>`，或者一条始终留在屏幕上的栏。
- 回到目录时，刚读过的那封信在眼前（`router.lastRead`）。
- **手机上，最新的一封信在首页第一屏里就点得到**，不用滚动。
- **手机上，歌一旦在放，暂停键要在拇指够得着的地方**：屏幕的下半部分，并且读者往下读的时候它一直在。它和所有能放歌的控件一样带 `data-play`。
- 一首歌放完就停。一封信的歌后面永远不接另一封信的歌（核心不会自动放下一首，主题也不要自己接）。

**文字**
- 界面上的字都用中文，平实，是他们俩的语气。没有爱心，没有粉色，没有花体字，没有婚礼套路。
- 没有人写信的年份（`letters.years` 里 `letters` 为空的那几项）写「没有信」或「这一年没有写信」。**不要写「无信」**，它读起来也是「言而无信」的那个无信。
- 一封信的季节用 `fmt.season(letter.date)`（按月份），不要用节气。
- 日期用 `letter.date`，天数用 `letter.days`（信里自己说的数字优先），不要自己从网址或日期重新算。
- 要标作者就每一封都标；封面不是他们自己照片的（`cover.own === false`）不要当成照片来展示。

**边界**
- 主题的 CSS 可以写 `html`、`body`、`#theme-root` 以及它里面的一切。不要试图把 `#theme-root` 以外的东西显示出来。
- 需要记住读者的选择时用 `localStorage`，键名以 `f221:<id>:` 开头，读写都包在 `try/catch` 里。

## 十、本地预览和测试

```bash
npm start                        # http://localhost:4301，改了文件会自动刷新
```

4301 被占用时（比如同一台机器上还有别人在跑），换个端口：`bundle exec jekyll serve --port 4311 --livereload-port 35731`；或者只构建一次，用小服务器看：`bundle exec jekyll build --destination /tmp/site && node tests/server.mjs --dir /tmp/site --port 4311`。下面的地址相应换掉端口。

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
- 首页上有 `ctx.ui.hunger().text` 那句话，有 `ctx.ui.switcher()`
- 信的正文在 `.letter-body` 里面
- 把数据改写成「最新的一封是客人写的、有一封没有歌没有封面没有摘句没有地点」之后，首页和这两封信照样画得出来，没有报错（整页打开和不换页跳转都试）
- 翻转卡片（整页打开和不换页跳转各试一次）：正面是打出来的信和落款，照片在翻面之前看不见；点一下翻过去，照片加载出来并保持比例；用键盘能翻回来
- 礼物盒：一开始是关着的；点开后彩纸铺满整个屏幕（验证的就是「祖先没有 transform」），盒子里的图片加载出来，下面是「生日快乐，我的小天使！」
- 首页 → 点一封信（不换页）→ 点 `[data-play]` 歌响了 → 后退（不换页，回到原来的滚动位置，歌还在放）→ 前进
- 一封信读到末尾（正文最后一行滚到屏幕上方）时，屏幕上有回目录的入口：指向 `/` 的链接，或带 `data-back` 的元素
- 首页上没有「无信」两个字
- 手机尺寸（402 × 874）下：首页不滚动就有一个看得见的、指向最新一封信的 `<a href>`；歌放起来之后往下读，屏幕下半部分一直有一个看得见的 `[data-play]`（这一项只在能真的出声的 Chrome 里查）
- 402px 宽、`prefers-reduced-motion: reduce` 下各种页面都不溢出
- 两个文件没有超出体积上限；首页冷缓存打开、读者什么都还没做时，一共传输不超过 700 KB（文本按 gzip 后算；超了的话，测试会列出最重的几个文件）

测试靠三个约定找到东西：正文容器叫 `.letter-body`；放歌的控件（包括常驻的播放 / 暂停键）带 `data-play`；首页用普通的 `<a href="{letter.url}">` 链接到信。

核心自己的行为用 `probe` 来测（`tests/core.spec.mjs`、`tests/prose.spec.mjs`、`tests/eggs.spec.mjs`）：上一封 / 下一封替换历史记录、`router.home()`、`router.lastRead`、回到目录时把刚读过的信带到眼前；32 封信逐封检查整理前后图片一张不少、每张都加载得出来、没有横向滚动、粗体没有多也没有少；四种 `role`、信里自己说的天数、`fmt.season`、`letters.years`。

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
15. **离开页面时不要写 `history.state`。** 在 `pagehide` 里调用 `history.replaceState`，WebKit 会把这条记录的状态清空。核心自己的滚动位置因此存在 `sessionStorage` 里；主题要在离开时记东西也用它。
16. **长按图片和链接会弹出系统菜单**，可拖动的元素上要考虑 `-webkit-touch-callout: none`；但信里的照片不要禁用，读者可能想存下来。
