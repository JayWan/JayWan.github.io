// 夜航 drift — 221 FOREVER
//
// 夜里的一条时间的河。最新的一封在最上面，往下是回头看，最底下是源头：2015.11.28 认识。
// 相片按写信的日子漂在轴的两岸，分近、中、远三层；点一张，它的白边就地长成一张信纸。
// 首页和读信是同一个页面的两种状态：河一直在，信纸在那张相片的位置上展开。
// 设计说明和「要改什么去哪里改」见同目录的 README.md。契约只有 ctx（assets/themes/README.md）。

const DAY = 864e5;
const T = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const between = (a, b) => Math.round((T(b) - T(a)) / DAY);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const pad = (n) => String(n).padStart(2, '0');

/** h('a', { href, className, onclick, 'data-x': … }, ...children) → element. Null children are skipped. */
function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const [name, value] of Object.entries(props)) if (name === 'role' || name.startsWith('data-') || name.startsWith('aria-')) node.setAttribute(name, value);
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

/* A title or a quoted line that has to break breaks after its own punctuation (「装修好了，／钥匙在门垫下面」, never 「钥／匙」). */
const phrases = (s) => {
  const raw = String(s).match(/[^，、；：。！？]+[，、；：。！？”’」』）]*|[，、；：。！？]+/g) || [String(s)], parts = [];
  let carry = '';
  raw.forEach((t, i) => {      // 「还有，」 does not stand on a line of its own: a short phrase goes with the one after it
    if (t.length < 4 && i < raw.length - 1) carry += t;
    else if (t.length < 4 && parts.length) parts[parts.length - 1] += carry + t;
    else { parts.push(carry + t); carry = ''; }
  });
  return parts.length < 2 ? [String(s)] : parts.map((t) => h('span', { className: 'nb' }, t));
};

/* 间距照时间来。step：相邻两封在轴上的距离（开方压缩）；clear：超过 180 天的空白里，两岸都空着的那一段，
   跟天数成正比，所以 838 天一定是整页最长的一段空白 */
const SILENCE = 180;
const step = (d) => 64 + 13 * Math.sqrt(Math.max(0, d));
const clear = (d) => (d <= 400 ? 53 + d : 453 + (d - 400) * 0.9);            // 207 天 → 260px … 838 天 → 847px
const clearPhone = (d) => (d <= 400 ? 90 + d * 0.5 : 290 + (d - 400) * 0.65);  // 207 天 → 193px … 838 天 → 575px
const CROSS = 30, KEEP = 22;      // a near print may reach this far over the axis; its caption keeps this far from it

export default {
  mount(ctx) {
    const { site, letters, root, player, router, ui } = ctx;
    const { fmt } = ui;
    const today = site.today.date;
    const order = [...letters].reverse();            // newest first: scrolling down is looking back
    const N = order.length;
    const idx = (letter) => N - 1 - letter.index;
    const dot = (d) => fmt.date(d, 'dot');
    const mqPhone = matchMedia('(max-width: 759px)');
    const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    const EAGER = router.current.type === 'letter' ? 0 : mqPhone.matches ? 1 : 3;   // prints on the first screen of the home page
    const EASE = 'cubic-bezier(.2,.7,.2,1)';
    const motion = () => !mqReduce.matches;
    const store = {
      get(k) { try { return localStorage.getItem('f221:drift:' + k); } catch { return null; } },
      set(k, v) { try { localStorage.setItem('f221:drift:' + k, v); } catch { /* storage unavailable */ } },
    };

    const GAP = order.map((p, i) => Math.max(0, i ? between(p.date, order[i - 1].date) : between(p.date, today)));
    const GAP_END = Math.max(0, between(site.met, order[N - 1].date));
    const perYear = {};
    order.forEach((p) => { perYear[p.year] = (perYear[p.year] || 0) + 1; });

    /* ───────── who wrote it: stated on every print and every sheet, the same way for everyone ───────── */
    const names = (p) => (Array.isArray(p.authors) && p.authors.length ? p.authors : [p.author]);
    const other = { him: 'Pikachi', her: 'Pikajay' };
    const capWho = (p) => (p.role === 'both' ? names(p).join(' 和 ') : other[p.role] ? p.author : `${p.author} 写的`);
    const byline = (p) => (p.role === 'both' ? `${names(p)[0]} 起头，${names(p).slice(1).join('、')} 写`
      : other[p.role] ? `${p.author} 写给 ${other[p.role]}` : `${p.author} 写的`);

    /* ───────── depth: 2 near · 1 middle · 0 far ─────────
       Far: pictures found online (cover.own === false), a guest's letter, a letter without a cover.
       Their own photographs take the near layer when the file is good enough, at most two in a row. */
    let run = 0;
    const LAYER = order.map((p) => {
      const c = p.cover;
      if (!c || c.own === false || p.role === 'guest') { run = 0; return 0; }
      if (p.quiet || Math.max(c.w || 0, c.h || 0) < 1400 || run >= 2) { run = 0; return 1; }
      run++;
      return 2;
    });

    /* ───────── shell ───────── */
    const playButton = (cls, label, onclick) => h('button', { type: 'button', className: cls, 'data-play': '', 'aria-label': label, 'aria-pressed': 'false', onclick }, h('i'));
    const goHome = () => (router.home ? router.home() : router.back('/'));
    const closeClick = (event) => { event.preventDefault(); goHome(); };
    const miniToggle = () => { if (player.state.letter) player.toggle(); else if (openL && openL.song) player.toggle(openL); };

    let wantTop = false;
    const brand = h('a', { className: 'brand', href: '/', onclick: () => { if (openL) wantTop = true; } }, site.title);
    const barSong = h('a', { href: '/' });
    const barPlay = playButton('play play-s', '播放或暂停正在放的歌', miniToggle);
    const driftToggle = h('button', { type: 'button', className: 'bar-toggle', 'aria-pressed': 'true' }, '漂浮 ', h('b', {}, '开'));
    const bar = h('header', { className: 'bar' }, brand,
      h('nav', { className: 'bar-nav', 'aria-label': '导航' },
        h('span', { className: 'bar-song' }, barPlay, barSong),
        h('a', { className: 'bar-link', href: letters.latest.url }, '最新一封'),
        driftToggle),
      ui.switcher());      // changing theme: the last thing in the bar, top right (an open letter has its own, in the sheet's bar)

    const lost = h('p', { className: 'lost', hidden: true }, h('b', {}, '404'), h('span', {}, '没有信'));   // drawn like a year head: a number and what it holds
    const tdays = site.today.days;
    /* The river in miniature, lying on its side under the wordmark: honest, linear time from the day they met
       to today. One tick per letter, the line dashed over every silence, year marks below, a lamp where today is.
       It says what the page is before anything is read: crowded years, empty years, and which end is now.
       A drawing that carries meaning has a name for those who cannot see it; its marks are not read out one by one. */
    const strip = h('div', { className: 'strip', role: 'img', 'aria-label': `${N} 封信，${dot(site.met)} 至 ${dot(today)}` });
    {
      const s0 = T(site.met), s1 = Math.max(T(today), s0 + DAY), pc = (t) => (clamp((t - s0) / (s1 - s0), 0, 1) * 100).toFixed(2) + '%';
      const put = (e, t, t2) => { e.style.left = pc(t); if (t2) e.style.right = `calc(100% - ${pc(t2)})`; strip.append(e); };
      order.forEach((p, i) => {
        if (i && GAP[i] > SILENCE) put(h('i', { className: 'st-q' }), T(p.date), T(order[i - 1].date));
        put(h('i', {}), T(p.date));
      });
      const y0 = Number(site.met.slice(0, 4)) + 1, y1 = Number(today.slice(0, 4));
      for (let y = y0; y <= y1; y++) put(h('span', {}, String(y).slice(y1 - y0 > 12 ? 2 : 0)), Date.UTC(y, 0, 1));   // in time the years outgrow the line: then two digits each
      strip.append(h('b', {}));
    }
    const hero = h('section', { className: 'hero' },
      h('h1', {}, site.title),
      lost,
      h('p', { className: 'odo-today' }, `截至今天 ${dot(today)}`),
      h('dl', { className: 'odo' }, [['认识', site.met, tdays.met], ['在一起', site.together, tdays.together], ['结婚', site.married, tdays.married]]
        .filter((row) => row[1] && row[2] != null)
        .map(([k, d, n]) => h('div', {}, h('dt', {}, k), h('dd', {}, h('b', {}, String(n)), h('i', {}, '天'), h('span', {}, `自 ${dot(d)}`))))),
      strip);

    const axis = h('div', { className: 'axis', 'aria-hidden': 'true' });
    const list = h('ol', { className: 'prints' });
    const sheet = h('article', { className: 'sheet', hidden: true, tabIndex: -1 });
    const river = h('div', { className: 'river' }, axis, list, sheet);
    const stage = h('main', { className: 'stage', tabIndex: -1 }, hero, river);

    const yearpin = h('div', { className: 'yearpin', 'aria-hidden': 'true' });
    const ypNum = h('span', { className: 'yp-num' });
    const ypN = h('span', { className: 'yp-n' });
    yearpin.append(ypNum, ypN);

    const foot = h('footer', { className: 'foot' },
      h('p', { className: 'foot-name' }, site.title),
      h('p', { className: 'foot-hunger' }, ui.hunger().text),          // the site's own voice, unchanged
      h('p', { className: 'foot-c' }, `© 2016 – ${today.slice(0, 4)} Fan & Wan`));

    /* the ruler: linear, honest time. Right edge on desktop; on a phone it is the bottom dock. */
    const rulerYear = h('span', { className: 'ruler-year', 'aria-hidden': 'true' });
    const track = h('div', { className: 'ruler-track', 'aria-hidden': 'true' });
    const nowEl = h('i', { className: 'now' });
    const tip = h('div', { className: 'ruler-tip', 'aria-hidden': 'true' });
    const undo = h('button', { type: 'button', className: 'ruler-undo', hidden: true }, '回到刚才');
    const dockPlay = playButton('play play-s dock-play', '播放或暂停', miniToggle);
    const dockSong = h('span', { className: 'dock-song' });
    const dockClose = h('a', { className: 'dock-close', href: '/', 'data-back': '', onclick: closeClick }, '合上');
    track.append(nowEl);
    const ruler = h('nav', { className: 'ruler', 'aria-label': '时间刻度和正在放的歌' }, dockPlay, rulerYear, track, dockSong, dockClose, tip);

    root.replaceChildren(bar, stage, foot, yearpin, ruler, undo);
    root.classList.add('at-top');

    /* ───────── prints ───────── */
    const items = order.map((p, i) => {
      const z = LAYER[i], c = p.cover;
      const kind = !c ? 'blank' : c.own === false ? 'found' : 'own';
      const a = h('a', { className: `item z${z} ${kind}${p.quiet ? ' quiet' : ''}`, href: p.url, 'aria-label': `第 ${p.no} 封，${fmt.date(p.date)}，${p.title}，${capWho(p)}` });
      a.style.setProperty('--rot', ((rnd(i, 2) - 0.5) * (p.quiet ? 0 : 2.6)).toFixed(2) + 'deg');
      a.style.setProperty('--dur', (9 + rnd(i, 3) * 7).toFixed(1) + 's');
      a.style.setProperty('--del', (-rnd(i, 4) * 16).toFixed(1) + 's');
      const ph = h('span', { className: 'ph' });
      if (c) { ph.style.aspectRatio = clamp(c.w / c.h, 0.8, 2).toFixed(3); if (c.color) ph.style.backgroundColor = c.color; }
      const frame = h('span', { className: 'frame' }, c ? ph : [h('span', { className: 'blank-t' }, phrases(p.title)), p.quote && h('span', { className: 'blank-q' }, phrases(p.quote))]);
      const cap = h('span', { className: 'cap' },
        h('span', { className: 'cap-meta' }, h('span', {}, dot(p.date)), p.days.met != null && h('span', {}, '第', h('i', {}, String(p.days.met)), '天'), h('span', {}, capWho(p))),
        c && h('span', { className: 'cap-title' }, phrases(p.title)),
        p.song && h('span', { className: 'cap-song' }, `歌 · ${p.song.title}`),
        c && p.quote && h('span', { className: 'cap-quote' }, phrases(p.quote)));   // every letter carries its line (a print without a picture has it on the paper itself)
      a.append(h('span', { className: 'par' }, h('span', { className: 'bob' }, frame, cap)));
      a.addEventListener('pointerenter', () => router.prefetch(a.href));
      a.addEventListener('touchstart', () => router.prefetch(a.href), { passive: true });
      a.addEventListener('click', () => { a.classList.add('is-pending'); });
      list.append(h('li', {}, a));
      const tick = h('i', { className: 'tick' });
      axis.append(tick);
      return { p, a, frame, ph, cap, tick, pic: null, w: 0 };
    });
    const segs = Array.from({ length: N + 1 }, (_, s) => { const e = h('i', { className: 'seg' + (s > 0 && s < N && GAP[s] > SILENCE ? ' quiet' : '') }); axis.append(e); return e; });

    function setWidth(i, w) {
      const it = items[i];
      if (it.w === w) return;
      it.w = w;
      it.a.style.width = w + 'px';
      if (!it.p.cover) return;
      // derivatives only; only what the first screen shows is fetched at once. On a 3x screen a print asks for 2x
      // (behind the grain nobody sees the difference); a far print is dim and soft by design and asks for 1.6x at most;
      // and no print asks for a picture wider than 800px: the river shows prints, the opened letter shows the photograph.
      // That keeps the first screen within its weight on a phone and on a 2x desktop.
      const dpr = window.devicePixelRatio || 1;
      const sizes = Math.round(Math.min(w * Math.min(dpr, LAYER[i] ? 2 : 1.6), Math.max(800, w)) / dpr) + 'px';
      if (!it.pic) {
        it.pic = ctx.img(it.p.cover, { sizes, lazy: i >= EAGER });
        it.ph.append(it.pic);
      } else it.pic.querySelectorAll('source, img').forEach((n) => { n.sizes = sizes; });
    }

    /* ───────── notes on the axis: lamps (today, the three zero points), measured silences, year heads ─────────
       note.at = i means "just above print i"; -1 is the top of the river, N its source. */
    const notes = [];
    const addNote = (kind, at, kids, extra) => { const e = h('div', { className: 'note ' + kind }, kids); river.insertBefore(e, list); const n = { kind, at, e, y: 0, ...extra }; notes.push(n); return n; };
    const lampKids = (d, what, sub) => [h('span', { className: 'n-date' }, dot(d)), h('span', { className: 'n-what' }, what), sub && h('span', { className: 'n-sub' }, sub)];
    addNote('lamp', -1, lampKids(today, '今天', [tdays.met != null && `认识的第 ${tdays.met} 天 · `, '下一封还没写']));
    for (let i = 0; i < N; i++) {
      const newer = i ? order[i - 1].date : today, older = order[i].date;
      [[site.married, '结婚'], [site.together, '在一起']].forEach(([d, what]) => { if (d && d > older && d <= newer) addNote('lamp', i, lampKids(d, what)); });
      if (i && GAP[i] > SILENCE) {
        const empty = [];
        for (let y = order[i].year + 1; y < order[i - 1].year; y++) empty.push(y);
        const long = GAP[i] > 400;
        const g = addNote('gap', i, [h('b', {}, String(GAP[i])), h('i', {}, '天'),
          long && h('span', { className: 'n-sub' }, '没有信', empty.length ? [h('br'), `${empty.join('、')} 年一封也没有`] : null)]);
        const k = clamp((GAP[i] - SILENCE) / 650, 0, 1);
        g.e.style.setProperty('--fs', (24 + k * 40).toFixed(1) + 'px');
        g.e.style.setProperty('--fsp', (20 + k * 20).toFixed(1) + 'px');
      }
      if (!i || order[i].year !== order[i - 1].year) addNote('year', i, [h('b', {}, String(order[i].year)), h('span', {}, `${perYear[order[i].year]} 封`)]);
    }
    addNote('lamp', N, lampKids(site.met, '认识'));
    const noteAt = (i, kind) => notes.find((n) => n.at === i && n.kind === kind);

    /* ───────── layout ───────── */
    let G = null, openL = null, shift = 0;

    const hit = (a, b, m) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

    /* Desktop: a loose scatter on both banks. Each print wants to sit at its date; it is pushed down
       until its picture and caption are clear of what is already there. Prints of different depths
       may overlap a little (the far one tucks behind); captions are never covered. */
    function solveDesk(W) {
      const ax = Math.round(W / 2), wide = W >= 1100;
      const wz = [clamp(W * 0.165, 168, 250), clamp(W * 0.262, 236, 384), clamp(W * 0.375, 310, 560)];
      const xmin = wide ? 150 : 16, xmax = W - (wide ? 104 : 88);      // the ruler keeps the right edge
      const geo = order.map((p, i) => {
        const c = p.cover, r = c ? c.w / c.h : 1.6;
        const w = Math.round(wz[LAYER[i]] * (r < 1.15 ? 0.7 : 1));
        setWidth(i, w);
        return { z: LAYER[i], w };
      });
      geo.forEach((g, i) => { const it = items[i]; it.a.style.removeProperty('--ci'); g.h = it.frame.offsetHeight; g.cw = it.cap.offsetWidth; g.ch = it.cap.offsetHeight; });
      // a near print may reach over the axis; its caption then stays on its own bank, so it is measured that way too
      geo.forEach((g, i) => { if (g.z !== 2) return; const it = items[i]; it.a.style.setProperty('--ci', CROSS + KEEP + 'px'); g.cwi = it.cap.offsetWidth; g.chi = it.cap.offsetHeight; it.a.style.removeProperty('--ci'); });
      const heroAbs = getComputedStyle(hero).position === 'absolute';
      const origin = heroAbs ? 176 : 84;
      const obstacles = [{ x: ax - 110, y: origin - 30, w: 220, h: 128 }];
      if (heroAbs) obstacles.push({ x: 0, y: -9999, w: hero.offsetLeft + hero.offsetWidth + 36, h: 9999 + hero.offsetTop + hero.offsetHeight + 44 });
      const placed = [];

      const capBox = (g, x, side) => {
        const over = g.z === 2 && (side === 'R' ? x < ax : x + g.w > ax);
        const w = over ? g.cwi : g.cw;
        return { over, w, h: over ? g.chi : g.ch, x: side === 'R' ? (over ? ax + KEEP : x) : (over ? ax - KEEP : x + g.w) - w };
      };
      function settle(g, x, side, y) {
        const cb = capBox(g, x, side);
        for (let n = 0; n < 60; n++) {
          const P = { x, y, w: g.w, h: g.h }, C = { x: cb.x, y: y + g.h + 15, w: cb.w, h: cb.h };
          let to = 0;
          for (const o of obstacles) if (hit(P, o, 0) || hit(C, o, 0)) to = Math.max(to, o.y + o.h);
          for (let j = placed.length - 1; j >= 0 && j >= placed.length - 10; j--) {
            const O = placed[j];
            if (hit(C, O.P, 12) || hit(P, O.C, 12) || hit(C, O.C, 14)) { to = Math.max(to, O.bot + 26); continue; }
            if (!hit(P, O.P, g.z === O.z ? 34 : 0)) continue;
            if (g.z === O.z) { to = Math.max(to, O.bot + 34); continue; }
            const ix = Math.min(P.x + P.w, O.P.x + O.P.w) - Math.max(P.x, O.P.x);
            const iy = Math.min(P.y + P.h, O.P.y + O.P.h) - Math.max(P.y, O.P.y);
            const allow = 0.2 * Math.min(P.w * P.h, O.P.w * O.P.h);
            if (ix * iy > allow) to = Math.max(to, O.P.y + O.P.h - Math.floor(allow / ix));
          }
          if (to <= y) return y;
          y = Math.ceil(to);
        }
        return y;
      }

      let tick = origin, maxBot = origin + 98, lastSide = 'L';
      notes[0].y = origin;
      geo.forEach((g, i) => {
        const d = GAP[i];
        const lampN = noteAt(i, 'lamp'), gapN = noteAt(i, 'gap'), yearN = wide ? null : noteAt(i, 'year');
        const top0 = maxBot;
        let want = tick + step(d) - g.h * 0.35;
        if (gapN) want = Math.max(want, top0 + Math.max(clear(d), 200 + (lampN ? 130 : 0) + (yearN ? 120 : 0)));   // a lamp or a year head stands inside the silence, it does not lengthen it
        else if (lampN || yearN) want = Math.max(want, top0 + 34 + (lampN ? 136 : 0) + (yearN ? 120 : 0));
        if (!i) want = Math.max(want, origin + (heroAbs ? -30 : 100));   // beside the masthead the first print starts level with 今天
        const sides = lastSide === 'L' ? ['R', 'L'] : ['L', 'R'];
        let best = null;
        for (const side of sides) {
          const room = (side === 'R' ? xmax - ax : ax - xmin) - g.w;
          const guts = g.z === 2 ? [18 + rnd(i, 1) * 40, rnd(i, 9) > 0.5 ? -CROSS : 76]
            : g.z === 1 ? [56 + rnd(i, 1) * 64, 150]
              : [120 + rnd(i, 1) * 90, room, (room + 150) / 2];
          guts.forEach((gut0, n) => {
            const gut = Math.min(gut0, room);
            const x = Math.round(side === 'R' ? ax + gut : ax - gut - g.w);
            const y = settle(g, x, side, want);
            const cost = y - want + (side === lastSide ? 36 : 0) + rnd(i, 3 + n) * 30;
            if (!best || cost < best.cost) best = { x, y, side, cost };
          });
        }
        g.x = best.x; g.top = Math.round(best.y); g.side = best.side; g.tick = Math.round(best.y + g.h * 0.35);
        const P = { x: g.x, y: g.top, w: g.w, h: g.h }, cb = capBox(g, g.x, g.side);
        const C = { x: cb.x, y: g.top + g.h + 15, w: cb.w, h: cb.h };
        g.over = cb.over;
        placed.push({ P, C, z: g.z, bot: C.y + C.h });
        // what stands in the empty band above this print
        let hi = g.top;
        if (yearN) { yearN.y = hi - 70; hi -= 124; }
        if (lampN) { if (gapN) { lampN.y = hi - 74; hi -= 136; } else lampN.y = (top0 + hi) / 2 - 22; }
        if (gapN) gapN.y = (top0 + hi) / 2;
        maxBot = Math.max(maxBot, C.y + C.h);
        tick = g.tick; lastSide = g.side;
      });
      const end = Math.round(Math.max(maxBot + 120, tick + step(GAP_END)));
      notes[notes.length - 1].y = end;
      return { phone: false, wide, W, ax, it: geo, origin, end, height: end + 150 };
    }

    /* Phone: one bank. The axis runs down the left; depth is width (full, or 72% and dimmer for the far layer). */
    function solvePhone(W) {
      const ax = 22, x0 = 46, avail = W - x0 - 16;
      const geo = order.map((p, i) => {
        const c = p.cover, r = c ? c.w / c.h : 1.6, far = LAYER[i] === 0;
        const w = Math.round(avail * (far ? 0.72 : 1) * (r < 1.15 ? 0.8 : 1));
        setWidth(i, w);
        return { z: LAYER[i], w, side: 'R', x: far ? x0 + avail - w : x0 };
      });
      geo.forEach((g, i) => { items[i].a.style.removeProperty('--ci'); g.h = items[i].frame.offsetHeight; g.ch = items[i].cap.offsetHeight; });
      const origin = 44;
      notes[0].y = origin;
      let y = origin + 44;
      geo.forEach((g, i) => {
        const d = GAP[i];
        const lampN = noteAt(i, 'lamp'), gapN = noteAt(i, 'gap'), yearN = noteAt(i, 'year');
        // a measured silence is the whole empty band (a lamp or a year head stands inside its lower end), so it grows with the days alone
        const inside = (lampN ? 54 : 0) + (yearN ? 84 : 0);
        const band = gapN ? Math.max(110, clearPhone(d) - inside) : i ? 22 + 5 * Math.sqrt(d) : 8;
        if (gapN) gapN.y = y + band / 2;
        y += band;
        if (lampN) { lampN.y = y + 18; y += 54; }
        if (yearN) { yearN.y = y + 36; y += 84; }
        g.top = Math.round(y); g.tick = Math.round(y + Math.min(30, g.h * 0.32));
        y = g.top + g.h + 12 + g.ch;
      });
      const end = Math.round(y + 40 + 5 * Math.sqrt(GAP_END));
      notes[notes.length - 1].y = end;
      return { phone: true, wide: false, W, ax, it: geo, origin, end, height: end + 70 };
    }

    let pin = false, pinY = -1;
    const sheetTarget = () => Math.max(0, Math.round(sheet.getBoundingClientRect().top + window.scrollY - (mqPhone.matches ? 0 : 24)));

    function place() {
      const W = stage.clientWidth, phone = mqPhone.matches;
      G = phone ? solvePhone(W) : solveDesk(W);
      const g = G.it;
      shift = 0;
      if (openL) {   // an open letter pushes everything downstream of it
        const k = idx(openL);
        const sw = phone ? W : Math.min(780, W - 120), sx = phone ? 0 : Math.round(G.ax - sw / 2), st = Math.max(0, g[k].top - (phone ? 16 : 28));
        sheet.style.left = sx + 'px'; sheet.style.top = st + 'px'; sheet.style.width = sw + 'px';
        const sh = sheet.offsetHeight;
        let next = G.end - 30;
        for (let j = k + 1; j < N; j++) next = Math.min(next, g[j].top);
        notes.forEach((n) => { if (n.at > k && (n.kind !== 'year' || !G.wide)) next = Math.min(next, n.y - 56); });
        shift = Math.max(0, Math.round(st + sh + (phone ? 70 : 130) - next));
        for (let j = k + 1; j < N; j++) { g[j].top += shift; g[j].tick += shift; }
        notes.forEach((n) => { if (n.at > k) n.y += shift; });
        G.end += shift; G.height += shift;
      }
      river.style.height = G.height + 'px';
      river.style.setProperty('--ax', G.ax + 'px');
      g.forEach((q, i) => {
        const it = items[i], s = it.a.style;
        s.left = q.x + 'px'; s.top = q.top + 'px';
        it.a.classList.toggle('L', q.side === 'L');
        if (q.over) s.setProperty('--ci', CROSS + KEEP + 'px');
        it.tick.style.top = q.tick + 'px';
      });
      notes.forEach((n) => { n.e.style.top = Math.round(n.y) + 'px'; });
      const ys = [G.origin, ...g.map((q) => q.tick), G.end];
      segs.forEach((e, s) => { e.style.top = ys[s] + 'px'; e.style.height = Math.max(0, ys[s + 1] - ys[s]) + 'px'; });
      G.anchors = [{ t: T(today), y: G.origin }, ...g.map((q, i) => ({ t: T(order[i].date), y: q.tick })), { t: T(site.met), y: G.end }];
      if (pin && openL) { pinY = sheetTarget(); window.scrollTo(0, pinY); }
      queueChrome();
    }

    /* y ↔ time along the river (y grows as time goes back) */
    const dateAt = (y) => {
      const A = G.anchors; if (y <= A[0].y) return A[0].t;
      for (let i = 1; i < A.length; i++) if (y <= A[i].y) return A[i - 1].t + (A[i].t - A[i - 1].t) * ((y - A[i - 1].y) / Math.max(1, A[i].y - A[i - 1].y));
      return A[A.length - 1].t;
    };
    const yAt = (t) => {
      const A = G.anchors; if (t >= A[0].t) return A[0].y;
      for (let i = 1; i < A.length; i++) if (t >= A[i].t) return A[i - 1].y + (A[i].y - A[i - 1].y) * ((A[i - 1].t - t) / Math.max(1, A[i - 1].t - A[i].t));
      return A[A.length - 1].y;
    };
    const riverTop = () => river.getBoundingClientRect().top + window.scrollY;

    /* ───────── ruler ───────── */
    const R0 = T(site.met) - 30 * DAY, R1 = T(today) + 30 * DAY;
    const pOf = (t) => (t - R0) / (R1 - R0);
    order.forEach((p) => { const e = h('i', { className: 'tk' }); e.style.setProperty('--p', pOf(T(p.date)).toFixed(5)); track.append(e); });
    for (let y = Number(site.met.slice(0, 4)) + 1; y <= Number(today.slice(0, 4)); y++) {
      const e = h('span', { className: 'yr' }, h('span', { className: 'yr-l' }, String(y)), h('span', { className: 'yr-s' }, String(y).slice(2)));
      e.style.setProperty('--p', pOf(Date.UTC(y, 0, 1)).toFixed(5));
      track.append(e);
    }
    const nearest = (t) => order.reduce((b, p) => (Math.abs(T(p.date) - t) < Math.abs(T(b.date) - t) ? p : b), order[0]);
    const rulerP = (e) => {
      const r = track.getBoundingClientRect();
      return clamp(mqPhone.matches ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height, 0, 1);
    };
    let tipTimer = 0;
    const showTip = (t) => {
      const q = nearest(t);
      tip.replaceChildren(h('b', {}, q.title), h('span', {}, `No.${pad(q.no)} · ${dot(q.date)}`));
      tip.style.setProperty('--p', clamp(pOf(t), 0, 1).toFixed(4));
      tip.classList.add('on');
      clearTimeout(tipTimer);
    };
    const hideTip = (ms) => { clearTimeout(tipTimer); tipTimer = setTimeout(() => tip.classList.remove('on'), ms); };
    const scrollToTime = (t) => window.scrollTo(0, Math.max(0, riverTop() + yAt(t) - innerHeight * 0.42));
    let undoTimer = 0, undoY = 0;
    function offerUndo(y0) {
      if (Math.abs(window.scrollY - y0) < innerHeight * 0.6) return;
      undoY = y0; undo.hidden = false;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => { undo.hidden = true; }, 4500);
    }
    undo.addEventListener('click', () => { window.scrollTo(0, undoY); undo.hidden = true; });
    /* Nothing moves on touch-down. A deliberate drag along the ruler scrubs; a tap jumps to the nearest letter. */
    let arm = null;
    track.addEventListener('pointerdown', (e) => {
      if (openL || (e.pointerType === 'mouse' && e.button !== 0)) return;
      arm = { id: e.pointerId, x: e.clientX, y: e.clientY, y0: window.scrollY, scrub: false };
    });
    track.addEventListener('pointermove', (e) => {
      if (!arm || e.pointerId !== arm.id) { if (e.pointerType === 'mouse' && !openL && !ctx.env.touch) showTip(R0 + rulerP(e) * (R1 - R0)); return; }   // a hover label, only where there is hover
      if (!arm.scrub) {
        const dx = Math.abs(e.clientX - arm.x), dy = Math.abs(e.clientY - arm.y);
        const along = mqPhone.matches ? dx : dy, across = mqPhone.matches ? dy : dx;
        if (along < 8 || along <= across) { if (across > 14) arm = null; return; }
        arm.scrub = true;
        try { track.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
      const p = rulerP(e), t = R0 + p * (R1 - R0), q = nearest(t);
      const tt = Math.abs(pOf(T(q.date)) - p) < 0.012 ? T(q.date) : t;      // a little pull towards a letter
      scrollToTime(tt); showTip(tt);
    });
    track.addEventListener('pointerup', (e) => {
      if (!arm || e.pointerId !== arm.id) return;
      const a = arm; arm = null;
      if (!a.scrub) {
        if (Math.hypot(e.clientX - a.x, e.clientY - a.y) >= 8) return;
        const q = nearest(R0 + rulerP(e) * (R1 - R0));
        window.scrollTo(0, Math.max(0, riverTop() + G.it[idx(q)].top - innerHeight * 0.22));
        showTip(T(q.date));
      }
      offerUndo(a.y0); hideTip(900);
    });
    track.addEventListener('pointercancel', () => { arm = null; });      // the browser took the gesture (a vertical swipe): nothing happens
    track.addEventListener('pointerleave', () => { if (!arm) hideTip(0); });

    /* ───────── chrome that follows the scroll: year pin + ruler marker ───────── */
    let raf = 0, curYear = 0, lastScroll = 0, moveStart = 0, lastTouch = -1e9;
    function chrome() {
      raf = 0; if (!G) return;
      const top = river.getBoundingClientRect().top;
      const t = openL ? T(openL.date) : dateAt(innerHeight * 0.5 - top);
      nowEl.style.setProperty('--p', clamp(pOf(t), 0, 1).toFixed(4));
      const yr = new Date(t).getUTCFullYear();
      if (yr !== curYear) {
        curYear = yr;
        ypNum.replaceChildren(...String(yr).split('').map((c) => h('span', {}, c)));
        ypN.textContent = `${perYear[yr] || 0} 封`;
        rulerYear.textContent = String(yr);
      }
      // the pinned year waits until the masthead has passed above it: at no window height do its numerals cross the strip
      yearpin.classList.toggle('on', !openL && G.wide && hero.getBoundingClientRect().bottom < yearpin.getBoundingClientRect().top - 16 && innerHeight * 0.5 - top < G.end + 40);
    }
    const queueChrome = () => { if (!raf) raf = requestAnimationFrame(chrome); };
    addEventListener('scroll', () => { const now = performance.now(); if (now - lastScroll > 140) moveStart = now; lastScroll = now; if (pin && Math.abs(window.scrollY - pinY) > 4) pin = false; queueChrome(); }, { passive: true });

    /* only prints near the viewport drift */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '200px 0px' });
      items.forEach((it) => io.observe(it.a));
      new IntersectionObserver((es) => root.classList.toggle('at-top', es[es.length - 1].isIntersecting), { rootMargin: '-40px 0px 0px 0px' }).observe(hero.querySelector('h1'));
    } else items.forEach((it) => it.a.classList.add('live'));
    document.addEventListener('visibilitychange', () => root.classList.toggle('hidden-tab', document.hidden));
    const setDrift = (off) => { root.classList.toggle('paused', off); driftToggle.setAttribute('aria-pressed', String(!off)); driftToggle.querySelector('b').textContent = off ? '关' : '开'; };
    driftToggle.addEventListener('click', () => { const off = !root.classList.contains('paused'); setDrift(off); store.set('still', off ? '1' : '0'); });
    setDrift(mqReduce.matches || store.get('still') === '1');

    /* ───────── the sheet ───────── */
    const S = {
      paper: h('div', { className: 'sheet-paper', 'aria-hidden': 'true' }),
      no: h('span', { className: 'sb-no' }),
      miniName: h('span', { className: 'sb-song-name' }),
      cover: h('figure', { className: 'sheet-cover' }),
      meta: h('p', { className: 'sh-meta' }),
      title: h('h2', { className: 'sh-title' }),
      by: h('p', { className: 'sh-by' }),
      days: h('dl', { className: 'sh-days' }),
      play: playButton('play', '播放或暂停这封信的歌', () => { if (openL) player.toggle(openL); }),
      song: h('span', { className: 'track-name' }),
      time: h('span', { className: 'track-time' }),
      line: h('div', { className: 'track-line', role: 'slider', tabIndex: 0, 'aria-label': '播放进度', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('i')),
      body: h('div', { className: 'sheet-body letter-body' }),
      sign: h('p', { className: 'sheet-sign' }),
      nav: h('nav', { className: 'sheet-nav', 'aria-label': '上一封与下一封' }),
    };
    S.mini = playButton('play play-s', '播放或暂停', miniToggle);
    S.track = h('div', { className: 'track' }, S.play, h('div', { className: 'track-txt' }, h('span', { className: 'track-k' }, '这封信的歌'), S.song), S.time, S.line);
    /* closing is one word and one mark, the same at the head of the sheet and at its foot */
    const closeLink = (cls) => h('a', { className: cls, href: '/', 'data-back': '', onclick: closeClick }, h('span', {}, '合上'), h('i', { 'aria-hidden': 'true' }));
    /* While a letter is open the river's bar is put away, so the sheet's bar carries the control that changes theme:
       beside 合上, on the screen the reader lands on, and inside the sheet, where Tab stays. */
    S.bar = h('div', { className: 'sheet-bar' }, S.no, h('div', { className: 'sb-song' }, S.mini, S.miniName), ui.switcher(), closeLink('sb-close'));
    S.head = h('header', { className: 'sheet-head' }, h('div', { className: 'sh-main' }, S.meta, S.title, S.by), S.days, S.track);
    S.foot = h('footer', { className: 'sheet-foot' }, S.sign, S.nav, closeLink('sheet-close2'));
    sheet.append(S.paper, S.bar, S.cover, S.head, S.body, S.foot);

    const season = (d) => (typeof fmt.season === 'function' ? fmt.season(d) : '');
    /* previous / next replace the history entry (when the core supports it), so one Back always leaves for the river */
    const walk = (p) => (event) => { event.preventDefault(); router.go(p.url, { replace: true }); };
    function navCell(p, cls, k, none) {
      if (!p) return h('span', { className: `sn ${cls} none` }, h('span', { className: 'sn-k' }, k), h('span', { className: 'sn-t' }, none));
      const a = h('a', { className: `sn ${cls}`, href: p.url, rel: cls === 'sn-prev' ? 'prev' : 'next', onclick: walk(p) },
        h('span', { className: 'sn-k' }, cls === 'sn-prev' ? `← ${k} · ${dot(p.date)}` : `${dot(p.date)} · ${k} →`), h('span', { className: 'sn-t' }, phrases(p.title)));
      a.addEventListener('pointerenter', () => router.prefetch(a.href));
      a.addEventListener('touchstart', () => router.prefetch(a.href), { passive: true });
      return a;
    }

    function fillSheet(p, contentEl) {
      const c = p.cover;
      S.no.textContent = `No.${pad(p.no)} / ${N}`;
      sheet.dataset.role = p.role;
      S.cover.hidden = !c;
      S.cover.className = 'sheet-cover' + (c && c.own === false ? ' found' : '');
      if (c) S.cover.style.setProperty('--r', (c.w / c.h).toFixed(4));
      S.cover.replaceChildren(...(c ? [ctx.img(c, { sizes: c.own === false ? '(max-width: 759px) 70vw, 420px' : '(max-width: 759px) 100vw, 752px', lazy: false, lqip: true })] : []));
      const wd = fmt.date(p.date, 'weekday');
      S.meta.textContent = [dot(p.date), '周' + wd.slice(-1), season(p.date), p.place].filter(Boolean).join(' · ');
      S.title.replaceChildren(...phrases(p.title));
      S.by.textContent = byline(p);
      S.days.replaceChildren(...[['认识', p.days.met], ['在一起', p.days.together], ['结婚', p.days.married]].flatMap(([k, v]) => [
        h('dt', {}, k), v == null ? h('dd', { className: 'no' }, '还没有') : h('dd', {}, '第', h('b', {}, String(v)), '天')]));
      S.track.hidden = !p.song;
      S.song.textContent = p.song ? p.song.title : '';
      dockPlay.classList.toggle('can', Boolean(p.song));
      S.body.replaceChildren(contentEl);           // the live node Jekyll rendered: moved, never cloned
      // a picture that has not loaded yet keeps its place (its size is known from its attributes), so the letter
      // has its full length from the start and nothing below a picture moves when it arrives
      contentEl.querySelectorAll('.letter-figure > img[width][height]').forEach((im) => {
        const w = +im.getAttribute('width'), hh = +im.getAttribute('height');
        if (w > 0 && hh > 0) { im.style.setProperty('--w', w + 'px'); im.style.setProperty('--r', (w / hh).toFixed(4)); }
      });
      S.sign.replaceChildren(h('b', {}, names(p).join(' 和 ')), `${dot(p.date)}${p.days.met != null && p.role !== 'guest' ? ` · 认识的第 ${p.days.met} 天` : ''}`);   // the count is the couple's: a guest signs with the date alone
      S.nav.replaceChildren(navCell(p.prev, 'sn-prev', '上一封', '没有了'), navCell(p.next, 'sn-next', '下一封', '还没写'));
    }

    /* ───────── the song: one shared player, never started by anything but a click ───────── */
    let trackAway = false;
    function tickTime(st) {
      if (!openL || !st.letter || st.letter.no !== openL.no || st.error) return;
      S.time.classList.remove('cn');
      S.time.textContent = `${fmt.clock(st.time)} / ${fmt.clock(st.duration || openL.song.duration || 0)}`;
      const pr = st.duration ? clamp(st.time / st.duration, 0, 1) : 0;
      S.line.style.setProperty('--prog', pr.toFixed(4));
      S.line.setAttribute('aria-valuenow', String(Math.round(pr * 100)));
    }
    function paint(st) {
      const cur = st.letter, mine = Boolean(openL && cur && cur.no === openL.no), on = Boolean(cur && st.playing);
      root.classList.toggle('has-song', Boolean(cur));
      S.play.setAttribute('aria-pressed', String(mine && st.playing));
      sheet.classList.toggle('is-loading', mine && st.loading);
      [S.mini, dockPlay, barPlay].forEach((b) => b.setAttribute('aria-pressed', String(on)));
      const shown = cur || openL, name = shown && shown.song ? shown.song.title : '';
      S.miniName.textContent = name; dockSong.textContent = name;
      barSong.textContent = cur ? `${cur.song.title} · ${cur.title}` : '';
      if (cur) barSong.href = cur.url;
      sheet.classList.toggle('mini-on', Boolean(openL) && (trackAway || Boolean(cur && !mine)));
      sheet.classList.toggle('song-off', mine && Boolean(st.error));      // a song that did not start: the key goes dashed, like a silence on the river
      if (mine && !st.error) { tickTime(st); return; }
      // at rest the slot holds the length of the song (a thing with a length and a key is a thing to play)
      S.time.classList.toggle('cn', mine);
      S.time.textContent = mine ? '没放出来' : openL && openL.song && openL.song.duration ? fmt.clock(openL.song.duration) : '';
      S.line.style.setProperty('--prog', '0');
    }
    player.on('change', paint);
    player.on('time', tickTime);
    const mineLoaded = () => openL && player.state.letter && player.state.letter.no === openL.no && player.state.duration > 0;
    S.line.addEventListener('click', (e) => { if (!mineLoaded()) return; const r = S.line.getBoundingClientRect(); player.seek(clamp((e.clientX - r.left) / r.width, 0, 1) * player.state.duration); });
    S.line.addEventListener('keydown', (e) => {
      if (!mineLoaded() || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      e.stopPropagation();
      player.seek(player.state.time + (e.key === 'ArrowRight' ? 5 : -5));
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { const e = es[es.length - 1]; trackAway = !e.isIntersecting && e.boundingClientRect.top < 90; paint(player.state); }, { rootMargin: '-84px 0px 0px 0px' }).observe(S.track);
    }

    /* ───────── opening and closing ───────── */
    let closing = null, openedAt = 0, lastRead = null;
    const sheetInView = () => { const r = sheet.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

    function openSheet(route, first) {
      const p = route.letter, k = idx(p), it = items[k], was = openL;
      const fr = it.frame.getBoundingClientRect(), pr = it.ph.getBoundingClientRect();
      if (was) items[idx(was)].a.classList.remove('is-open');
      openL = p; lastRead = p;
      fillSheet(p, route.contentEl);
      root.classList.add('has-open'); root.classList.remove('walked');
      it.a.classList.add('is-open');
      sheet.hidden = false;
      trackAway = false;
      place();
      ctx.widgets.init(route.contentEl);            // the flip card re-measures itself in the sheet's width
      paint(player.state);
      const target = sheetTarget();
      const restore = !first && route.scrollY > 0;   // Back / Forward into a letter: the place the reader left
      const animate = !first && !restore && motion() && typeof sheet.animate === 'function';
      const near = !was && fr.bottom > -200 && fr.top < innerHeight + 200;
      if (restore) window.scrollTo(0, route.scrollY < target - innerHeight * 0.5 || route.scrollY > target + sheet.offsetHeight - innerHeight * 0.45 ? target : route.scrollY);   // a letter left by walking past it is opened at its top
      else if (animate && near && !p.quiet) {
        const D = 680, sr = sheet.getBoundingClientRect(), img = S.cover.querySelector('img');
        if (img && pr.width && img.getBoundingClientRect().width > 8) {
          const f = S.cover.getBoundingClientRect(), cr = img.getBoundingClientRect(), s = pr.width / Math.max(1, cr.width);
          S.cover.animate([{ transform: `translate(${pr.left - f.left - (cr.left - f.left) * s}px, ${pr.top - f.top - (cr.top - f.top) * s}px) scale(${s})` }, { transform: 'none' }], { duration: D, easing: EASE });
        }
        const t = clamp(fr.top - sr.top, 0, sr.height), l = clamp(fr.left - sr.left, 0, sr.width), r = clamp(sr.right - fr.right, 0, sr.width), b = clamp(sr.bottom - fr.bottom, 0, sr.height);
        S.paper.animate([{ clipPath: `inset(${t}px ${r}px ${b}px ${l}px)` }, { clipPath: 'inset(0px 0px 0px 0px)' }], { duration: D, easing: EASE });
        [S.bar, S.head, S.body, S.foot].forEach((n) => n.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: D + 160, easing: 'ease-out' }));
        window.scrollTo({ top: target, behavior: 'smooth' });
      } else {
        window.scrollTo(0, target);
        if (animate) sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      }
      openedAt = performance.now();
      if (!first) { try { sheet.focus({ preventScroll: true }); } catch { /* old engines */ } }
      queueChrome();
    }

    function closeSheet(route) {
      const mode = closing; closing = null;
      const top = wantTop; wantTop = false;
      if (!openL) { window.scrollTo(0, top ? 0 : route.scrollY || 0); return; }
      const k = idx(openL), it = items[k], p = openL;
      const above = sheet.getBoundingClientRect().bottom <= 0, y0 = window.scrollY, pushed = shift;
      sheet.hidden = true;
      S.body.replaceChildren();
      root.classList.remove('has-open', 'walked');
      it.a.classList.remove('is-open');
      openL = null; pin = false;
      place();
      paint(player.state);
      // Closed while the opening scroll was still gliding: Chrome lets that glide take one more step after an
      // instant scroll, so the place is set once more on the next frame.
      const land = (y) => { window.scrollTo(0, y); if (performance.now() - openedAt < 1200) requestAnimationFrame(() => { if (!openL) window.scrollTo(0, y); }); };
      if (top) land(0);
      else if (mode === 'silent') window.scrollTo(0, above ? Math.max(0, y0 - pushed) : y0);   // the reader walked on: nothing may jump
      else {
        // Back to the river, at the print of the letter just read (not wherever the reader set out from).
        const last = router.lastRead || lastRead || p, q = G.it[idx(last)], y = riverTop() + q.top, saved = route.scrollY || 0;
        const shown = Math.min(y + q.h, saved + innerHeight - (G.phone ? 64 : 20)) - Math.max(y, saved + 64);   // how much of that print the place the reader left would show
        const seen = saved > 0 && shown >= Math.min(q.h * 0.6, innerHeight * 0.4);
        land(seen ? saved : Math.max(0, Math.round(y - innerHeight * 0.28)));
        const back = items[idx(last)];
        try { back.a.focus({ preventScroll: true }); } catch { /* old engines */ }
        if (motion() && !last.quiet && back.frame.animate) back.frame.animate([{ opacity: 0.3, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE });
      }
      queueChrome();
    }

    /* Walked past the end of an open letter (or back above it). At once the river is at full strength again
       (no dimmed dead zone). The sheet itself is taken away only when the scroll has come to rest and no finger
       is down: that moves the page under the reader, and iOS does not keep a scroll position set mid-fling. */
    let away = 0, rest = 0, touching = false, lastSeen = 0;
    const walked = (on) => { root.classList.toggle('walked', on); root.classList.toggle('has-open', Boolean(openL) && !on); };
    const settle = () => {
      clearTimeout(rest);
      if (!openL || !root.classList.contains('walked')) return;
      if (sheetInView()) { walked(false); return; }
      if (touching || performance.now() - lastScroll < 140) { rest = setTimeout(settle, 150); return; }
      // The page came to rest at its very top, from far away, a moment after the letter was on screen, and no
      // finger started that movement: a tap on the iOS status bar. With a letter open, "the top" is the top of this letter.
      if (window.scrollY <= 1 && moveStart - lastTouch > 400 && performance.now() - lastSeen < 1600 && sheetTarget() > innerHeight * 2.5) { window.scrollTo(0, sheetTarget()); walked(false); return; }
      closing = 'silent';
      goHome();
    };
    const leave = () => {
      clearTimeout(away);
      if (!openL || sheetInView()) return;
      const wait = 600 - (performance.now() - openedAt);
      if (wait > 0) { away = setTimeout(leave, wait); return; }
      walked(true);
      settle();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        clearTimeout(away);
        if (!openL) return;
        if (es[es.length - 1].isIntersecting) walked(false); else { lastSeen = performance.now(); away = setTimeout(leave, 320); }
      }).observe(sheet);
    }
    addEventListener('touchstart', () => { touching = true; lastTouch = performance.now(); }, { passive: true });
    ['touchend', 'touchcancel'].forEach((t) => addEventListener(t, (e) => { touching = e.touches.length > 0; lastTouch = performance.now(); }, { passive: true }));

    addEventListener('keydown', (e) => {
      if (!openL || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (e.key === 'Tab') {      // an open letter keeps the focus: Tab walks its own controls round and round, Esc leaves
        if (root.classList.contains('walked')) return;   // (the next stop in the document is a print or the footer, screens away, and going there would close the letter)
        const stops = [...sheet.querySelectorAll('a[href], button, summary, input, select, textarea, audio[controls], video[controls], iframe, [tabindex="0"]')].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
        const at = stops.indexOf(document.activeElement), to = e.shiftKey ? stops.length - 1 : 0;
        if (stops.length && (at < 0 || at === (e.shiftKey ? 0 : stops.length - 1))) { e.preventDefault(); stops[to].focus(); }
        return;
      }
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable], [role="slider"]')) return;
      if (e.key === 'Escape') goHome();
      else if (e.key === 'Home' || e.key === 'End') {      // the open letter is the page: Home and End stay inside it
        e.preventDefault();
        window.scrollTo(0, e.key === 'Home' ? sheetTarget() : Math.max(sheetTarget(), Math.round(sheet.getBoundingClientRect().bottom + window.scrollY - innerHeight + 40)));
      }
      else if (t && t.closest && t.closest('.theme-switcher[data-open]')) return;   // (a reader inside the open list of themes is not turning pages)
      else if (e.key === 'ArrowLeft' && openL.prev) router.go(openL.prev.url, { replace: true });
      else if (e.key === 'ArrowRight' && openL.next) router.go(openL.next.url, { replace: true });
    });

    /* ───────── one function draws any route; the theme moves the reader itself (returns false) ───────── */
    function show(route, first) {
      items.forEach((it) => it.a.classList.remove('is-pending'));
      root.querySelectorAll('.theme-switcher[data-open] button').forEach((b) => b.click());   // a list of themes left open does not follow the reader into another view
      lost.hidden = route.type !== '404';
      root.dataset.view = route.type;
      if (route.type === 'letter') openSheet(route, first === true);
      else if (first !== true) closeSheet(route);
      return false;
    }

    /* ───────── go ───────── */
    place();
    const landed = router.current;
    if (landed.type === 'letter') {
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      pin = !nav || nav.type === 'navigate';      // keep the sheet in place while fonts and pictures settle, until the reader moves
      setTimeout(() => { pin = false; }, 4000);
    }
    show(landed, true);
    paint(player.state);
    /* A print can be picked up. Once, on arriving at the top of the river, the nearest print on the first screen
       lifts the way it does under a pointer, and settles. Not for a reader who asked for stillness. */
    if (landed.type !== 'letter' && sheet.animate) setTimeout(() => {
      if (openL || !motion() || root.classList.contains('paused') || window.scrollY > 60) return;
      const it = items.filter((x) => !x.p.quiet && x.frame.getBoundingClientRect().top < innerHeight - 120).sort((x, y) => LAYER[idx(y.p)] - LAYER[idx(x.p)])[0];
      if (it) it.frame.animate([{ transform: 'none' }, { transform: 'translateY(-10px) scale(1.025)', offset: 0.45 }, { transform: 'none' }], { duration: 1500, easing: 'ease-in-out' });
    }, 1300);

    let rsz = 0, lastW = stage.clientWidth;
    addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (stage.clientWidth !== lastW) { lastW = stage.clientWidth; place(); } }, 120); });
    if ('ResizeObserver' in window) { let h0 = 0; new ResizeObserver(() => { const hh = sheet.offsetHeight; if (openL && Math.abs(hh - h0) > 1) { h0 = hh; place(); } }).observe(sheet); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place());

    return { show };
  },
};
