// sides — 「Side A / Side B」
//
// 这份档案是一张唱片：每封信是一首歌，首页是唱片背面的曲目表，信是这首歌的内页说明。
// A 面是他写的（海蓝），B 面是她写的（森林绿），两个人合写的标 A/B，客人写的是附赠曲目（黑）。
// 设计说明见同目录的 README.md。契约只有 ctx（assets/themes/README.md），不从核心引入任何东西。

/** h('a', { class, href, 'data-x', onclick }, ...children) → element */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(3).filter((c) => c != null && c !== false));
  return el;
}
/** 固定的图标字符串 → 元素（只用于写死在这里的 SVG，数据里的文字一律走 textContent） */
function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstChild;
}
const I_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="sd-i-play" d="M8 5.5v13l11-6.5z"/><path class="sd-i-pause" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';
const I_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2.2v12H6zM19 6v12l-9.5-6z"/></svg>';
const I_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 6H18v12h-2.2zM5 6v12l9.5-6z"/></svg>';
// 八分音符：自己画的，跟着文字颜色走（系统字体里的 ♪ 又细又歪）
const I_NOTE = '<svg class="sd-note" viewBox="0 0 10 13" aria-hidden="true"><ellipse cx="2.9" cy="10.4" rx="2.9" ry="2.2" transform="rotate(-18 2.9 10.4)"/><path d="M4.6 0h1.2v10.4H4.6z"/><path d="M5.2 0c.5 2 1.5 2.7 2.9 3.7 1.3.9 1.9 2 1.5 3.7C9 5.9 7.6 5 5.2 4.4z"/></svg>';

const pad2 = (n) => (n < 10 ? '0' : '') + n;
const pad3 = (n) => String(n).padStart(3, '0');
const visualLen = (s) => { let n = 0; for (const c of s) n += c.codePointAt(0) > 0x2e7f ? 1 : 0.55; return n; };
const latinOnly = (s) => /^[\x20-\x7e]+$/.test(s);

// 封套怎么裁：默认按 cover.focus 裁成正方形。下面这些封面一裁就会把人或内容切掉
// （两个人分站画面两头、拼贴、图表、插画），改成整幅放进方框，四周露出油墨底色。
// 键是封面文件名；新的封面不在表里时，特别宽（≥ 2.1:1）的也整幅放。
const FIT = new Set(['9.png', '10.jpg', '11.jpg', '18.png', '19.png', '20.jpg', '23.jpg', '24.png']);
const fits = (cover) => Boolean(cover && (FIT.has(cover.file) || (cover.w && cover.h && cover.w / cover.h >= 2.1)));
// 整幅放的封面里，白底的插画和图表（平均色很亮）四周留纸色、加一圈细线；照片四周才是油墨。
const light = (cover) => { const m = /^#([0-9a-f]{6})$/i.exec((cover && cover.color) || ''); const n = m ? parseInt(m[1], 16) : 0; return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 190; };

export default {
  mount(ctx) {
    const { site, letters, root, player, router, ui } = ctx;
    const { fmt } = ui;
    const phone = window.matchMedia('(max-width: 860px)');
    const hovers = window.matchMedia('(hover: hover) and (pointer: fine)');   // 触屏上点一下也会补发鼠标事件：那不算悬停

    // ---------- 面 ----------
    // him → A，her → B，both → A/B，其他人 → 附赠曲目（不占曲号）
    const sideOf = (l) => ({ him: 'a', her: 'b', both: 'ab' })[l.role] || 'x';
    const SIDE_NAME = { a: 'A 面', b: 'B 面', ab: 'A / B 面', x: '附 · Bonus track' };
    const tracks = letters.filter((l) => sideOf(l) !== 'x');
    const trackNo = new Map(tracks.map((l, i) => [l, i + 1]));
    const noText = (l) => (trackNo.has(l) ? pad2(trackNo.get(l)) : '+');
    const latest = tracks[tracks.length - 1] || letters.latest;     // 最新的一首（播放器闲着时备着它）
    const newest = letters.latest || latest;                         // 最新的一封信，不管是谁写的
    const dot = (d) => fmt.date(d, 'dot');
    const authorsOf = (l) => (Array.isArray(l.authors) && l.authors.length ? l.authors : [l.author]);
    const byline = (l) => {
      const who = authorsOf(l);
      return sideOf(l) === 'ab' && who.length > 1 ? `${who[0]} 起头 · ${who.slice(1).join('、')} 写` : `${l.author} 写`;
    };
    /** 歌手来自 mp3 的标签；「群星」这类合辑标签不是歌手，不印 */
    const artistOf = (l) => { const a = l.song && l.song.artist ? l.song.artist.trim() : ''; return /^(群星|various( artists?)?|va|unknown( artist)?)$/i.test(a) ? '' : a; };
    const dayLines = (l) => {
      const d = l.days || {};
      return [d.met != null && `认识第 ${d.met} 天`, d.together != null && `相恋第 ${d.together} 天`, d.married != null && `结婚第 ${d.married} 天`].filter(Boolean);
    };

    /** 数据里的文字 → 节点。& 交给中文字体画（Archivo 的 & 像个 ε）。 */
    const tx = (s) => String(s).split('&').flatMap((part, i) => (i ? [h('span', { class: 'sd-amp' }, '&'), part] : [part]));
    const note = () => svg(I_NOTE);
    /** 曲号。A/B 的两位数字一蓝一绿。 */
    function noEl(l, cls, tag = 'span') {
      const t = noText(l);
      const el = h(tag, { class: cls, 'aria-hidden': 'true' });
      if (sideOf(l) === 'ab' && t.length === 2) el.append(h('span', { class: 'sd-na' }, t[0]), h('span', { class: 'sd-nb' }, t[1]));
      else el.textContent = t;
      return el;
    }
    function chip(side) {
      const say = { role: 'img', 'aria-label': { a: 'A 面 · 他写的', b: 'B 面 · 她写的', ab: 'A / B 面 · 两个人写的', x: '附赠曲目 · 客人写的' }[side] };   // 只念给读屏听，不出气泡
      if (side === 'ab') return h('i', { class: 'sd-chip sd-chip-ab', ...say }, h('span', {}, 'A'), h('span', {}, 'B'));
      if (side === 'x') return h('i', { class: 'sd-chip sd-chip-x', ...say }, '附');
      return h('i', { class: `sd-chip sd-chip-${side}`, ...say }, side.toUpperCase());
    }
    /** 页眉正中的厂牌：A 空心蓝、B 实心绿，两种油墨先在这里各印一次 */
    const mark = () => h('i', { class: 'sd-chip sd-chip-ab sd-mark', 'aria-hidden': 'true' }, h('span', {}, 'A'), h('span', {}, 'B'));
    /** 方形封套：双色调由 CSS 的混合模式做（见 theme.css「封套」） */
    function sleeve(l, opts, cls = '') {
      const fit = fits(l.cover);
      const pic = ctx.img(l.cover, opts);
      if (fit) { const im = pic.querySelector('img'); if (im) im.style.backgroundColor = ''; }
      return h('span', { class: `sd-slv ${cls}`, 'data-side': sideOf(l), 'data-fit': fit ? (light(l.cover) ? 'paper' : 'ink') : null }, pic);
    }
    /** 每个能开始放歌的控件都带 data-play */
    function playBtn(l, cls) {
      if (!l.song) return null;
      const b = h('button', { type: 'button', class: cls, 'data-play': l.no, 'aria-pressed': 'false', 'aria-label': `播放《${l.song.title}》` });
      b.append(svg(I_PLAY));
      return b;
    }
    const warm = (a) => {
      a.addEventListener('pointerenter', () => router.prefetch(a.href));
      a.addEventListener('touchstart', () => router.prefetch(a.href), { passive: true });
    };

    // =====================================================================================
    // 外壳：视图 + 页脚 + 贴底的迷你播放器
    // =====================================================================================
    const main = h('main', { class: 'sd-main', tabindex: '-1' });

    // 网站自己那句话：不为它去下载字体。字体切片已经到手的字用主题的黑体，其余的先由系统黑体画
    //（首页有 700 KB 的预算，现在这句话里有三个字在别的切片里，要多下 60 KB）。
    const hunger = ui.hunger().text;
    const hungerEl = h('p', { class: 'sd-hunger' }, hunger);
    function inkHunger() {
      if (!(document.fonts && document.fonts.check)) return;
      const runs = [];
      for (const ch of hunger) {
        let ok = false;
        try { ok = document.fonts.check('500 15px "F221 Sans"', ch); } catch { /* 查不了就留给系统字体 */ }
        const last = runs[runs.length - 1];
        if (last && last[0] === ok) last[1] += ch; else runs.push([ok, ch]);
      }
      hungerEl.replaceChildren(...runs.map(([ok, t]) => (ok ? h('span', { class: 'sd-zh' }, t) : t)));
    }
    // 每来一批字体就再看一遍（fonts.ready 在第一次排版之前就可能已经 resolve 了）
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', inkHunger);

    const foot = h('footer', { class: 'sd-foot' },
      hungerEl,
      h('div', { class: 'sd-foot-row' },
        h('span', {}, tx('© 2016 – 2026 Fan & Wan')),
        ui.switcher()));

    const P = {
      el: h('div', { class: 'sd-player', role: 'region', 'aria-label': '播放器' }),
      prog: h('div', { class: 'sd-pprog', role: 'slider', tabindex: '0', 'aria-label': '播放进度', 'aria-valuemin': '0' }, h('i')),
      play: h('button', { type: 'button', class: 'sd-pbtn sd-pplay', 'data-play': '', 'aria-label': '播放' }),
      meta: h('a', { class: 'sd-pmeta' }),
      no: h('span', { class: 'sd-pno' }),
      song: h('strong'),
      sub: h('span'),
      time: h('span', { class: 'sd-ptime' }),
      prev: h('button', { type: 'button', class: 'sd-pbtn sd-pskip', 'aria-label': '上一首' }),
      next: h('button', { type: 'button', class: 'sd-pbtn sd-pskip', 'aria-label': '下一首' }),
    };
    P.play.append(svg(I_PLAY)); P.prev.append(svg(I_PREV)); P.next.append(svg(I_NEXT));
    P.meta.append(P.no, h('span', { class: 'sd-ptxt' }, P.song, P.sub));
    P.el.append(P.prog, h('div', { class: 'sd-pwrap' }, P.play, P.meta, P.time, P.prev, P.next));

    root.replaceChildren(main, foot, P.el);

    // ---------- 播放器 ----------
    const withSong = (l, step) => { for (let x = l && l[step]; x; x = x[step]) if (x.song) return x; return null; };
    /** 迷你播放器上现在备着的那一首：正在放的 → 眼前这封信的 → 最新一首 */
    const cued = () => player.state.letter || (ctx.page.letter && ctx.page.letter.song ? ctx.page.letter : null) || (latest && latest.song ? latest : withSong(latest, 'prev'));

    P.play.addEventListener('click', () => { const l = cued(); if (l) player.toggle(l); });
    P.prev.addEventListener('click', () => { const l = withSong(cued(), 'prev'); if (l) player.toggle(l); });
    P.next.addEventListener('click', () => { const l = withSong(cued(), 'next'); if (l) player.toggle(l); });
    P.prog.addEventListener('click', (e) => {
      const st = player.state;
      if (!st.letter || !st.duration) return;
      const r = P.prog.getBoundingClientRect();
      player.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * st.duration);
    });
    P.prog.addEventListener('keydown', (e) => {
      const st = player.state;
      const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
      if (step && st.letter) { e.preventDefault(); player.seek(st.time + step); }
    });

    let view = { type: '', letter: null };   // 现在画着的是什么（自己记，不存 router.current）
    let band = null;                          // 信页色带里跟着播放器走的几个元素
    let home = null;                          // 首页只建一次

    function paint(st = player.state) {
      const cur = cued();
      const on = Boolean(st.letter && (st.playing || st.loading));
      const side = cur ? sideOf(cur) : 'a';
      P.el.dataset.side = side;
      P.el.classList.toggle('is-playing', on);
      P.play.classList.toggle('is-playing', on);
      P.el.classList.toggle('is-idle', !st.letter);
      P.play.setAttribute('aria-label', on ? '暂停' : '播放');
      P.play.disabled = !cur;
      if (cur) {
        P.no.replaceChildren(...noEl(cur, '').childNodes);
        P.song.replaceChildren(...tx(cur.song.title));
        P.sub.replaceChildren(...(st.letter && st.error ? ['放不出来，再点一次试试'] : tx(cur.title)));
        P.meta.href = cur.url;
        P.meta.setAttribute('aria-label', `《${cur.song.title}》是《${cur.title}》的歌，去读这封信`);
      }
      P.prev.disabled = !withSong(cur, 'prev');
      P.next.disabled = !withSong(cur, 'next');
      P.prog.setAttribute('aria-valuemax', String(Math.round(st.letter ? st.duration : 0)));

      // 所有带 data-play 的钮
      root.querySelectorAll('[data-play]').forEach((b) => {
        if (b === P.play) return;
        const mine = st.letter && b.dataset.play === String(st.letter.no);
        b.classList.toggle('is-playing', Boolean(mine && on));
        b.setAttribute('aria-pressed', String(Boolean(mine && on)));
      });
      // 曲目表里的那一行
      if (home) home.cue(st.letter, on);
      tick(st);
    }
    function tick(st = player.state) {
      const cur = cued();
      const mine = st.letter && st.letter === cur;
      const d = mine ? st.duration : (cur && cur.song && cur.song.duration) || 0;
      const t = mine ? st.time : 0;
      const r = d ? Math.min(1, t / d) : 0;
      P.prog.firstChild.style.width = (r * 100).toFixed(2) + '%';
      P.prog.setAttribute('aria-valuenow', String(Math.round(t)));
      P.time.textContent = `${fmt.clock(t)} / ${fmt.clock(d)}`;
      if (band) {
        const here = st.letter === band.letter;
        band.bar.style.width = ((here && st.duration ? Math.min(1, st.time / st.duration) : 0) * 100).toFixed(2) + '%';
        band.time.textContent = `${fmt.clock(here ? st.time : 0)} / ${fmt.clock(here ? st.duration : band.letter.song.duration || 0)}`;
        band.err.hidden = !(here && st.error);
      }
    }
    player.on('change', paint);
    player.on('time', tick);

    // =====================================================================================
    // 首页：曲目表
    // =====================================================================================
    function buildHome() {
      const years = [...new Set(tracks.map((l) => l.year))];
      const total = letters.reduce((s, l) => s + ((l.song && l.song.duration) || 0), 0);
      const totalText = `${Math.floor(total / 3600)}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(Math.round(total % 60))}`;
      const span = years.length ? `${Math.min(years[0], Number(site.met.slice(0, 4)))} – ${years[years.length - 1]}` : '';
      const bonus = letters.length - tracks.length;
      const td = site.today.days || {};
      const today = [['认识', td.met], ['相恋', td.together], ['结婚', td.married]].filter(([, n]) => n != null);
      const count = { a: 0, b: 0 };
      tracks.forEach((l) => { const s = sideOf(l); if (s !== 'b') count.a++; if (s !== 'a') count.b++; });

      // ---- 刊头 ----
      const title = h('h1', { class: 'sd-title', 'aria-label': site.title }, h('span', {}, '221'), ' ', h('span', {}, 'FOREVER'));
      // 大字下面只有一条规格栏：三个数。两面各是谁写的，由筛选钮上的 A / B 标记和油墨颜色说
      const info = h('dl', { class: 'sd-info' },
        h('div', {}, h('dt', { class: 'sd-l' }, '曲目'), h('dd', {}, String(tracks.length), bonus ? h('small', {}, ` + ${bonus}`) : null)),
        h('div', {}, h('dt', { class: 'sd-l' }, '年头'), h('dd', {}, span)),
        h('div', {}, h('dt', { class: 'sd-l' }, '全长'), h('dd', {}, totalText)));
      const latestLink = newest && h('a', { class: 'sd-latest', href: newest.url, 'data-side': sideOf(newest) },
        h('span', {}, '最新一封'), noEl(newest, 'sd-latest-no', 'b'), h('u', {}, tx(newest.title)), h('i', { 'aria-hidden': 'true' }, '→'));
      if (latestLink) warm(latestLink);
      const tab = (f, label, n, c) => h('button', { type: 'button', class: 'sd-tab' + (f === 'all' ? ' is-on' : ''), 'data-filter': f, 'aria-pressed': String(f === 'all') }, c, h('span', {}, label), h('b', {}, String(n)));
      const tabs = h('div', { class: 'sd-tabs', role: 'group', 'aria-label': '按 A 面 / B 面筛选' },
        tab('all', '全部', tracks.length),
        tab('a', '他写的', count.a, h('i', { class: 'sd-chip sd-chip-a', 'aria-hidden': 'true' }, 'A')),
        tab('b', '她写的', count.b, h('i', { class: 'sd-chip sd-chip-b', 'aria-hidden': 'true' }, 'B')));

      // ---- 封套栏：拼版 ----
      const cells = Math.max(36, Math.ceil((tracks.length + 1) / 6) * 6);
      const mosaic = h('div', { class: 'sd-mosaic' });
      tracks.forEach((l, i) => {
        // 拼版是曲目表的另一个入口，每封信在表里都有一行：不占 Tab 键的位置
        const a = h('a', { href: l.url, 'data-side': sideOf(l), tabindex: '-1', 'aria-label': `${noText(l)} ${l.title}` },
          sleeve(l, { sizes: '(max-width: 860px) 12vw, 64px', widths: [160, 480], lazy: i > 23 }));
        mosaic.append(a);
      });
      for (let k = tracks.length + 1; k <= cells; k++) mosaic.append(h('span', { class: 'sd-slot' }, String(k)));
      const big = h('div', { class: 'sd-big' });
      const cap = h('div', { class: 'sd-cap' });
      const sq = h('div', { class: 'sd-sq' }, mosaic, big);
      sq.style.setProperty('--mr', String(cells / 6));
      sq.style.setProperty('--mp', String(Math.ceil((tracks.length + 1) / 8)));
      // 拼版自己说话：两种油墨是两个人，印着曲号的空格子是还没写的。没有悬停时，下面只放「今天」：他们自己的数法。
      //（不放摘句：摘句里的字不在首屏字体切片里，要多下 90 KB）
      const restCap = today.length ? [h('dl', { class: 'sd-cap-now' },
        h('dt', { class: 'sd-l' }, `今天 · ${dot(site.today.date)}`),
        today.map(([k, n]) => h('dd', {}, h('span', {}, `${k}第`), h('b', {}, String(n)), h('span', {}, '天'))))] : [];

      // ---- 曲目表 ----
      const list = h('ol', { class: 'sd-list' });
      const rows = new Map();
      function row(l) {
        const s = sideOf(l);
        const a = h('a', { class: 'sd-ttl', href: l.url }, tx(l.title));
        warm(a);
        const li = h('li', { class: 'sd-trk', 'data-side': s, 'data-quiet': l.quiet || null },
          noEl(l, 'sd-no'), a,
          h('span', { class: 'sd-song' }, l.song ? [note(), tx(l.song.title)] : null),
          h('time', { class: 'sd-date', datetime: l.date }, l.date.slice(5).replace('-', '.')),
          h('span', { class: 'sd-len' }, l.song && l.song.duration ? fmt.clock(l.song.duration) : ''),
          chip(s),
          playBtn(l, 'sd-play'));
        rows.set(l, li);
        return li;
      }
      // 年份行：没有信的年份也列出来。核心有 letters.years 就用它，没有就自己数
      const byYear = letters.years
        ? letters.years.map((y) => ({ year: y.year, all: y.letters.length, list: y.letters.filter((l) => trackNo.has(l)) }))
        : years.length ? Array.from({ length: years[years.length - 1] - years[0] + 1 }, (_, i) => years[0] + i).map((y) => ({ year: y, all: 0, list: tracks.filter((l) => l.year === y) })) : [];
      const yearRows = [];                                   // [年份行, 这一年的信, 写着「N 封」的那个元素]
      byYear.forEach(({ year, all, list: ofYear }) => {
        if (ofYear.length) {
          const n = h('span', {}, `${ofYear.length} 封`);
          yearRows.push([list.appendChild(h('li', { class: 'sd-yr' }, h('span', {}, String(year)), n)), ofYear, n]);
        } else if (!all) yearRows.push([list.appendChild(h('li', { class: 'sd-yr sd-yr--empty' }, h('span', {}, String(year)), h('span', {}, '这一年没有信'))), ofYear, null]);
        ofYear.forEach((l) => list.append(row(l)));
      });
      const extras = letters.filter((l) => !trackNo.has(l));
      if (extras.length) {
        yearRows.push([list.appendChild(h('li', { class: 'sd-yr sd-yr--bonus' }, h('span', {}, 'Bonus track'), h('span', {}, [...new Set(extras.map((l) => l.author))].join('、')))), [], null]);
        extras.forEach((l) => list.append(row(l)));
      }

      const el = h('div', { class: 'sd-home', 'data-filter': 'all' },
        h('div', { class: 'sd-cat sd-l' }, h('span', {}, '221–LP'), mark(), h('span', {}, 'Stereo · 双声道')),
        h('header', { class: 'sd-mast' }, title, info, latestLink, h('div', { class: 'sd-ctl' }, tabs)),
        h('aside', { class: 'sd-panel', 'aria-label': '封套' }, h('div', { class: 'sd-stick' }, sq, cap)),
        h('section', { class: 'sd-tracks', 'aria-label': '曲目表' }, list));

      // ---- 悬停 / 键盘聚焦：整行换成这一面的油墨色，右栏换成这封信的封套 ----
      let onLetter = null;
      const bigs = new Map();
      function panel(l) {
        big.classList.toggle('is-show', Boolean(l));
        if (!l) { cap.removeAttribute('data-side'); cap.replaceChildren(...restCap); return; }
        if (!bigs.has(l)) bigs.set(l, sleeve(l, { sizes: '400px', widths: [480, 800], lazy: false }));
        big.replaceChildren(bigs.get(l));
        cap.dataset.side = sideOf(l);
        const d = sideOf(l) === 'x' ? null : l.days && l.days.met;     // 客人的信：那是他们的天数，不是写信人的
        cap.replaceChildren(
          h('div', { class: 'sd-cap-top' }, noEl(l, 'sd-cap-no', 'b'),
            h('div', {},
              h('p', { class: 'sd-cap-lbl sd-l' }, `${SIDE_NAME[sideOf(l)]} · ${dot(l.date)}`, d != null && h('span', { class: 'sd-cap-day' }, ` · 认识第 ${d} 天`)),
              h('h2', { class: 'sd-cap-title' }, tx(l.title)),
              l.song && h('p', { class: 'sd-cap-song' }, note(), tx(l.song.title), artistOf(l) ? ` · ${artistOf(l)}` : ''))),
          l.quote && h('p', { class: 'sd-cap-quote' }, l.quote));
      }
      function setOn(l) {
        if (l === onLetter) return;
        if (onLetter && rows.get(onLetter)) rows.get(onLetter).classList.remove('is-on');
        onLetter = l;
        if (l) rows.get(l).classList.add('is-on');
        if (!phone.matches) panel(l);
      }
      const letterOfRow = (node) => { const li = node.closest && node.closest('.sd-trk'); if (!li) return null; for (const [l, r] of rows) if (r === li) return l; return null; };
      list.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && hovers.matches) { const l = letterOfRow(e.target); if (l) setOn(l); } });
      list.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setOn(null); });
      list.addEventListener('focusin', (e) => { const l = letterOfRow(e.target); if (l && !phone.matches && e.target.matches(':focus-visible')) setOn(l); });
      list.addEventListener('focusout', () => setOn(null));
      panel(null);

      // ---- 行内播放钮：不离开曲目表就开始放；手机上这一行自己展开 ----
      list.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-play]');
        if (!b) return;
        e.preventDefault();
        const l = letters.byNo(Number(b.dataset.play));
        const li = rows.get(l);
        const before = li.getBoundingClientRect().top;
        player.toggle(l);
        paint();
        const d = li.getBoundingClientRect().top - before;      // 上面的行收起时，手指下的这一行不跳
        if (Math.abs(d) > 1) window.scrollBy(0, d);
      });
      let cuedRow = null;
      function cue(l, on) {
        if (cuedRow && cuedRow !== rows.get(l)) cuedRow.classList.remove('is-cued', 'is-playing', 'is-open');
        cuedRow = (l && rows.get(l)) || null;
        if (!cuedRow) return;
        if (!cuedRow.querySelector('.sd-more')) {
          cuedRow.append(h('div', { class: 'sd-more' }, sleeve(l, { sizes: '92px', widths: [160, 480] }),
            h('div', {}, l.quote && h('p', {}, l.quote), h('small', {}, '读这封信 →'))));
        }
        cuedRow.classList.add('is-cued', 'is-open');
        cuedRow.classList.toggle('is-playing', on);
        if (ctx.env.touch && !phone.matches && !onLetter) panel(on ? l : null);   // 没有悬停的宽屏（平板）：右栏跟着正在放的那一行
      }

      // ---- 筛选 ----
      const shows = (f, s) => f === 'all' || s === f || s === 'ab';
      tabs.addEventListener('click', (e) => {
        const b = e.target.closest('.sd-tab');
        if (!b) return;
        const f = b.dataset.filter;
        tabs.querySelectorAll('.sd-tab').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        el.dataset.filter = f;
        rows.forEach((li, l) => { li.hidden = !shows(f, sideOf(l)); });
        mosaic.querySelectorAll('a').forEach((a) => a.classList.toggle('is-dim', !shows(f, a.dataset.side)));
        // 年份行：只数筛出来的那些；筛选时没有信的年份和附赠曲目不出现
        yearRows.forEach(([li, ofYear, n]) => {
          const k = ofYear.filter((l) => shows(f, sideOf(l))).length;
          li.hidden = f !== 'all' && !k;
          if (n) n.textContent = `${k} 封`;
        });
      });

      // ---- 刊头大字：按栏宽撑满（桌面一行，手机两行） ----
      const spans = [...title.querySelectorAll('span')];
      const textW = (s) => { const r = document.createRange(); r.selectNodeContents(s); return r.getBoundingClientRect().width; };
      function fit() {
        const box = info.getBoundingClientRect().width;
        if (!box) return;
        title.style.setProperty('--ts', '100px');
        const w = phone.matches ? Math.max(...spans.map(textW)) : spans[1].getBoundingClientRect().right - spans[0].getBoundingClientRect().left;
        if (w > 0) title.style.setProperty('--ts', Math.floor((box / w) * 1000) / 10 + 'px');
      }
      if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(info);
      else window.addEventListener('resize', fit);
      // 窄体字到之前先不显示大字（后备字体不是窄体，会撑破一行）；最多等 1.2 秒
      const ready = () => { fit(); title.classList.add('is-set'); };
      if (document.fonts && document.fonts.load) {
        Promise.race([document.fonts.load('800 10px "F221 Grotesk"', '221 FOREVER'), new Promise((r) => setTimeout(r, 1200))]).then(ready, ready);
        document.fonts.ready.then(fit);
      } else ready();

      return { el, cue, fit, rows, clear: () => setOn(null) };
    }

    // =====================================================================================
    // 信：内页说明
    // =====================================================================================
    /** 给正文做的几件小事，可以重复执行（同一个节点在本次到访里会被反复交给 show） */
    function dress(el) {
      if (el.hasAttribute('data-sd')) return;
      el.setAttribute('data-sd', '');
      const cored = Boolean(ctx.prose);                       // 核心已经给引文分过类了吗
      el.querySelectorAll('blockquote').forEach((q) => {
        if (q.classList.contains('largeQuote')) return;
        const hasBr = Boolean(q.querySelector('br'));
        // 每句都不长才算歌词；用 <br> 分行的长段落（第一封信的半文言）只分行，不上色、不悬挂
        const short = () => q.innerHTML.split(/<br\s*\/?>/i).every((line) => line.replace(/<[^>]+>/g, '').trim().length <= 60);
        const lyric = (cored ? q.classList.contains('lyrics') : hasBr) && short();
        if (lyric) q.classList.add('sd-lyrics');
        if (!hasBr) return;
        // 每句一行，折行时悬挂缩进：把 <br> 分开的每一句包成一行
        const hosts = q.querySelectorAll('p').length ? [...q.querySelectorAll('p')] : [q];
        hosts.forEach((host) => {
          if (![...host.childNodes].some((n) => n.nodeName === 'BR')) return;
          const lines = [[]];
          [...host.childNodes].forEach((n) => { if (n.nodeName === 'BR') lines.push([]); else lines[lines.length - 1].push(n); });
          host.replaceChildren(...lines.filter((ns) => ns.some((n) => n.textContent.trim())).map((ns) => h('span', { class: 'sd-ln' }, ns)));
        });
      });
      // 信里的图：把原图的宽高交给 CSS（--w / --h），加载之前就占好位置，竖图按屏幕高度收窄
      el.querySelectorAll('.letter-figure > img[width][height]').forEach((im) => {
        if (im.id) return;
        im.style.setProperty('--w', im.getAttribute('width'));
        im.style.setProperty('--h', im.getAttribute('height'));
      });
      // 只有换行的空段落（作者用来空行）：留一行的空，不留三行
      el.querySelectorAll('p').forEach((p) => {
        if (!p.id && !p.textContent.trim() && !p.querySelector('img, picture, video, audio, iframe, svg, canvas, object')) p.classList.add('sd-gap');
        else if (p.querySelector('br')) p.classList.add('sd-rag');       // 作者自己分了行的段落：不两端对齐，免得折行的那一句被撑开
      });
      // 整段英文：换用西文字体画引号和撇号
      el.querySelectorAll('p, li, .sd-ln, blockquote').forEach((n) => {
        const t = n.textContent;
        if (!n.id && t.length > 12 && !/[⺀-鿿＀-￯]/.test(t) && /[A-Za-z]{3}/.test(t)) n.setAttribute('lang', 'en');
      });
      // 中文段落里夹着的英文撇号（didn’t）：中文字体把它画成全角，后面空出半个字，换成西文字体的
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const found = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/[A-Za-z][‘’][A-Za-z]/.test(n.data) && !n.parentElement.closest('script, style, [lang="en"]')) found.push(n);
      found.forEach((n) => {
        const out = [];
        let at = 0;
        n.data.replace(/[A-Za-z]([‘’])(?=[A-Za-z])/g, (m, q, i) => { out.push(n.data.slice(at, i + 1), h('span', { lang: 'en' }, q)); at = i + 2; return m; });
        n.replaceWith(...out, n.data.slice(at));
      });
    }

    function pnTile(l, label, rel) {
      if (l === 'first') return h('div', { class: 'sd-pnt sd-pnt--none' }, h('span', { class: 'sd-pn-no' }, '00'), h('span', {}, h('p', { class: 'sd-pn-lbl sd-l' }, label), h('p', { class: 'sd-pn-title' }, '这是第一首'), h('p', { class: 'sd-pn-song' }, '前面没有了。')));
      if (l === 'none') return h('div', { class: 'sd-pnt sd-pnt--none' }, h('span', { class: 'sd-pn-no' }, String(tracks.length + 1)), h('span', {}, h('p', { class: 'sd-pn-lbl sd-l' }, label), h('p', { class: 'sd-pn-title' }, '还没写'), h('p', { class: 'sd-pn-song' }, '不知道会是 A 面还是 B 面。')));
      const s = sideOf(l);
      const a = h('a', { class: 'sd-pnt', href: l.url, rel, 'data-side': s },
        noEl(l, 'sd-pn-no'),
        h('span', {},
          h('p', { class: 'sd-pn-lbl sd-l' }, `${label} · ${SIDE_NAME[s]} · ${dot(l.date)}`),
          h('p', { class: 'sd-pn-title' }, tx(l.title)),
          l.song && h('p', { class: 'sd-pn-song' }, note(), tx(l.song.title))));
      warm(a);
      return a;
    }

    function letterView({ letter: l, contentEl }) {
      const s = sideOf(l);
      const guest = s === 'x';
      const season = fmt.season ? fmt.season(l.date) : '';
      const who = authorsOf(l);
      const credits = [
        ['写信', s === 'ab' && who.length > 1 ? [`${who[0]} 起头`, h('span', {}, `${who.slice(1).join('、')} 写`, chip(s))] : [l.author, chip(s)]],   // 名字后面跟着这一面的标记
        ['日期', [dot(l.date), h('small', {}, [season, fmt.date(l.date, 'weekday')].filter(Boolean).join(' · '))]],
        l.place && ['地点', [l.place]],
        dayLines(l).length && [guest ? '这一天' : '天数', dayLines(l).map((t, i) => h('span', {}, guest && !i ? `他们${t}` : t))],
        l.song && ['歌', [tx(l.song.title), h('small', {}, [artistOf(l), l.song.duration && fmt.clock(l.song.duration)].filter(Boolean).join(' · '))]],
        l.chars ? ['篇幅', [`${l.chars} 字`]] : null,
        ['编号', [guest ? '221–附' : `221–${pad3(trackNo.get(l))}`]],
      ].filter(Boolean);

      // ---- 色带 ----
      const metDay = !guest && l.days && l.days.met != null ? `认识第 ${l.days.met} 天` : '';
      const h1 = h('h1', { class: 'sd-h1' + (visualLen(l.title) > 12 ? ' is-long' : visualLen(l.title) > 10 ? ' is-mid' : '') + (latinOnly(l.title) ? ' is-lat' : '') }, tx(l.title));
      let songBox = null;
      band = null;
      if (l.song) {
        const bar = h('i');
        const time = h('span', { class: 'sd-ltime' });
        const err = h('span', { class: 'sd-lerr', hidden: true }, ' · 放不出来，再点一次试试');
        const btn = playBtn(l, 'sd-lplay');
        btn.addEventListener('click', () => player.toggle(l));
        songBox = h('div', { class: 'sd-sbox' }, btn,
          h('div', {}, h('p', { class: 'sd-sname' }, tx(l.song.title)), h('p', { class: 'sd-sart' }, '这封信的歌', artistOf(l) ? ` · ${artistOf(l)}` : '', err)),
          time, h('div', { class: 'sd-lprog' }, bar));
        band = { letter: l, bar, time, err };
      }
      const bandEl = h('div', { class: 'sd-band' }, h('div', { class: 'sd-in' },
        h('nav', { class: 'sd-nav sd-l', 'aria-label': '导航' },
          h('a', { href: '/', 'data-back': '' }, h('span', { 'aria-hidden': 'true' }, '←'), ' 曲目表'),
          h('a', { href: '/', class: 'sd-brand' }, site.title),
          h('span', { class: 'sd-pos' }, guest ? `附 · ${tracks.length} + ${letters.length - tracks.length}` : `${noText(l)} / ${tracks.length}`)),
        h('header', { class: 'sd-head' },
          noEl(l, 'sd-bigno', 'b'),
          h('div', { class: 'sd-lbls' },
            h('p', { class: 'sd-lbl sd-l' }, guest ? SIDE_NAME.x : `${SIDE_NAME[s]} · 第 ${trackNo.get(l)} 首`),
            h('p', { class: 'sd-lbl sd-l' }, h('span', {}, byline(l)), h('span', {}, dot(l.date)), metDay && h('span', {}, metDay))),
          h('div', { class: 'sd-htx' }, h1, songBox))));

      // ---- 封套（点一下看原图：同一张缩略图，去掉双色调，不裁切） ----
      let aside = null;
      if (l.cover) {
        const slv = sleeve(l, { sizes: '(max-width: 860px) 100vw, 400px', lazy: false, lqip: false });
        const tag = h('span', { class: 'sd-slvtag' }, '看原图');
        const btn = h('button', { type: 'button', class: 'sd-slvbtn', 'aria-pressed': 'false', 'aria-label': '在双色封套和原图之间切换' }, slv, tag);
        btn.addEventListener('click', () => {
          const on = slv.classList.toggle('is-orig');
          btn.setAttribute('aria-pressed', String(on));
          tag.textContent = on ? '回到双色' : '看原图';
        });
        if (l.cover.w && l.cover.h) {
          const ar = l.cover.w / l.cover.h;
          slv.style.setProperty('--ar', String(ar));                                    // 看原图时的比例
          slv.style.setProperty('--strip', String(Math.min(2.4, Math.max(1.2, ar))));   // 手机上横幅的比例
        }
        aside = h('aside', { class: 'sd-aside' }, h('div', { class: 'sd-pin' }, btn));
      }

      // ---- 正文：把 Jekyll 渲染好的节点搬进来 ----
      dress(contentEl);
      const body = h('div', { class: 'letter-body sd-prose' }, contentEl);
      ctx.widgets.init(contentEl);

      const pn = h('nav', { class: 'sd-pn', 'aria-label': '上一首 / 下一首 / 曲目表' }, h('div', { class: 'sd-pn-in' },
        pnTile(l.prev || 'first', '上一首', 'prev'),
        pnTile(l.next || 'none', '下一首', 'next'),
        h('a', { class: 'sd-pn-back', href: '/', 'data-back': '' }, h('span', { 'aria-hidden': 'true' }, '←'), h('span', {}, '回到曲目表'), h('small', {}, `全部 ${tracks.length} 首`))));
      // 上一首 / 下一首是普通链接：从一封信到另一封信，核心会替换历史记录，所以从任何一封信按后退都回到曲目表

      return h('article', { class: 'sd-letter' + (aside ? '' : ' no-slv'), 'data-side': s, 'data-quiet': l.quiet || null, 'data-plain': l.quiet || guest || null },
        bandEl,
        h('div', { class: 'sd-body' }, h('div', { class: 'sd-cols' },
          aside,
          h('div', { class: 'sd-text' }, body, h('p', { class: 'sd-end' }, `${authorsOf(l).join('、')} · ${dot(l.date)}`)),
          h('aside', { class: 'sd-cred', 'aria-label': '署名' }, h('div', { class: 'sd-pin' },
            h('dl', { class: 'sd-credits' }, credits.map(([k, v]) => h('div', {}, h('dt', { class: 'sd-l' }, k), h('dd', {}, v)))))))),
        pn);
    }

    const lostView = () => h('section', { class: 'sd-lost' },
      h('div', { class: 'sd-cat sd-l' }, h('span', {}, '221–LP'), h('span', {}, '404')),
      h('b', { class: 'sd-lost-no', 'aria-hidden': 'true' }, '404'),
      h('h1', {}, '这张唱片里没有这一首。'),
      h('p', {}, `曲目表上一共 ${tracks.length} 首，都还在。`),
      h('p', { class: 'sd-lost-go' }, h('a', { href: '/' }, '← 回到曲目表'), newest && h('a', { href: newest.url }, `最新一封 · ${newest.title} →`)));

    // =====================================================================================
    // 路由：一个函数画任何一页
    // =====================================================================================
    /** 核心记下的「刚读过的那封信」（CORE-ADDENDUM C）。没有就是 null。 */
    function lastRead() {
      const v = router.lastRead;
      if (!v) return null;
      if (typeof v === 'object' && v.no && v.url) return letters.byUrl(v.url);
      return letters.byUrl(typeof v === 'string' ? v : v.url || '') || null;
    }
    // 浏览器的状态栏跟着色带走。两个人写的那封色带是渐变（没有底色）：用上半截 / 左半边的蓝
    function tint() {
      const el = main.firstElementChild;
      const m = document.querySelector('meta[name="theme-color"]');
      if (!el || !m) return;
      const ground = getComputedStyle(view.type === 'letter' ? el.firstElementChild : document.documentElement).backgroundColor;
      m.content = /^(transparent|rgba\(.*,\s*0\))$/.test(ground) ? getComputedStyle(el).getPropertyValue('--sea').trim() : ground;
    }

    let first = true;
    let entered = null;                       // 从曲目表点开的是哪一封（之后可能翻到别的信去了）
    let popHome = false;                      // 这一次回到曲目表是后退 / 前进带来的（核心取信要等一下，所以这个记号总在 show 之前）
    let asked = false;                        // 读者点了「回到曲目表」或按了 Esc
    window.addEventListener('popstate', () => { popHome = location.pathname === '/'; });
    root.addEventListener('click', (e) => {
      if (e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && e.target.closest && e.target.closest('a[data-back]')) asked = true;
    });
    function show(route) {
      const from = view;
      const pop = popHome;
      const want = asked;
      popHome = asked = false;
      let moved;
      if (route.type === 'letter') {
        if (from.type === 'home') entered = route.letter;
        main.replaceChildren(letterView(route));
        view = { type: 'letter', letter: route.letter };
      } else if (route.type === 'home') {
        band = null;
        home = home || buildHome();
        home.clear();
        home.rows.forEach((li) => li.classList.remove('is-last'));
        main.replaceChildren(home.el);
        home.fit();
        view = { type: 'home', letter: null };
        // 回到曲目表：刚读过的那一行做个记号（router.lastRead）。后退回来、读的还是当初点开的那一封，位置由核心原样恢复；
        // 翻到别的信去了，或者这条曲目表是「回到曲目表」新添的（信是直接打开的，后面没有曲目表），就把那一行带到眼前。
        // 页眉的站名是普通链接，去曲目表的顶上，不动。
        // （拼版里每封信都有链接，手机上它不是吸顶的，核心会以为「已经在屏幕上」，所以这一步主题自己做。）
        const last = lastRead();
        const li = last && home.rows.get(last);
        if (li && !li.hidden) {
          li.classList.add('is-last');
          const top = li.getBoundingClientRect().top + window.scrollY;
          const vh = window.innerHeight - P.el.offsetHeight;
          const y = route.scrollY || 0;
          if (from.type === 'letter' && (pop ? last !== entered : want) && (top < y + 8 || top + li.offsetHeight > y + vh - 8)) {
            window.scrollTo(0, Math.max(0, Math.round(top - vh * 0.38)));
            moved = false;                                      // 滚动位置我们自己管了
          }
        }
        entered = null;
      } else {
        band = null;
        main.replaceChildren(lostView());
        view = { type: '404', letter: null };
      }
      root.dataset.view = view.type;
      tint();
      paint();
      inkHunger();
      if (!first) main.focus({ preventScroll: true });
      first = false;
      return moved;
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || view.type !== 'letter' || e.defaultPrevented) return;
      asked = true;
      if (router.home) router.home(); else router.back('/');
    });

    show(router.current);
    setTimeout(tint, 0);                      // 核心在 mount 之后才写 theme-color（纸色）；直接打开一封信时再改成色带的颜色
    return { show };
  },
};
