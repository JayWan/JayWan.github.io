// 笺 folio — 把这些信做成一本书：首页是竖排的目录，一年一叶；点开是一张横格信笺。
// 没有动效。契约只有 ctx（见 ../README.md），这里不从核心引入任何东西。
// 设计说明和「改哪里」见同目录的 README.md。

/* ── 小工具 ─────────────────────────────────────────── */

/** h('a', { class, href, onclick, 'aria-label' }, ...children) → 元素。值为 null / false 的属性和孩子会被跳过。 */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

/* 汉字数字 */
const DIG = '〇一二三四五六七八九';
const yearZh = (y) => String(y).replace(/\d/g, (d) => DIG[d]);
function numZh(n) {
  if (n < 10) return DIG[n];
  if (n < 20) return '十' + (n % 10 ? DIG[n % 10] : '');
  if (n < 100) return DIG[Math.floor(n / 10)] + '十' + (n % 10 ? DIG[n % 10] : '');
  return yearZh(n);
}
const mdZh = (date) => { const a = date.split('-'); return `${numZh(+a[1])}月${numZh(+a[2])}日`; };
const ymdZh = (date) => `${yearZh(date.slice(0, 4))}年${mdZh(date)}`;

/* ── 竖排用的文字整理 ───────────────────────────────────
   汉字直立；两位以内的数字、落单的符号做纵中横；其余西文整段侧排（像书脊）；
   夹在汉字之间的半角标点换成全角。返回节点数组，数据里的文字从不当作 HTML。 */
const CJK = /[⺀-鿿豈-﫿︰-﹏＀-￯　-〿—…·“”‘’]/;
const FULL = { ',': '，', '!': '！', '?': '？', ':': '：', ';': '；', '(': '（', ')': '）', '~': '～' };
function vt(str) {
  const runs = [];
  let cur = '', kind = null;
  for (const ch of String(str == null ? '' : str)) {
    const k = CJK.test(ch) ? 'c' : 'l';
    if (k !== kind && cur) { runs.push([kind, cur]); cur = ''; }
    kind = k; cur += ch;
  }
  if (cur) runs.push([kind, cur]);
  const out = [];
  for (const [k, text] of runs) {
    if (k === 'c') { out.push(text); continue; }
    const core = text.trim();
    if (!core) continue;
    if (!/[A-Za-z0-9Ͱ-Ͽ]/.test(core)) {
      if (/^-+$/.test(core)) { out.push('——'); continue; }
      for (const ch of core.replace(/\s+/g, '')) out.push(FULL[ch] || h('span', { class: 'tcy' }, ch));
    } else if (/^\d{1,2}$/.test(core) || core.length === 1) out.push(h('span', { class: 'tcy' }, core));
    else out.push(h('span', { class: 'lat', lang: 'en' }, core));
  }
  return out;
}
/** 一段文字竖排时大约有几个字高（西文按宽度折算）。 */
function units(s) { let u = 0; for (const ch of String(s)) u += CJK.test(ch) ? 1 : (ch === ' ' ? 0.25 : 0.46); return u; }

/* ── 题名分行 ───────────────────────────────────────────
   竖排一行放不下的题名拆成两行。断在哪里，好看与否差别很大，所以常见的几封手工指定；
   新的信没有指定时按标点、词界自动拆。 */
const BREAKS = {
  '写给第一次一个人出门在外的宝贝儿': ['写给第一次一个人', '出门在外的宝贝儿'],
  '祝宝贝儿第二个二十岁生日快乐': ['祝宝贝儿第二个', '二十岁生日快乐'],
  '七夕&一点九周年快乐': ['七夕&', '一点九周年快乐'],
  '祝安贝儿第三个生日快乐': ['祝安贝儿', '第三个生日快乐'],
  '祝安贝儿第五个生日快乐': ['祝安贝儿', '第五个生日快乐'],
  '致: 我和小天使的1000个日日夜夜': ['致: 我和小天使的', '1000个日日夜夜'],
  '两年不见，你还好吗': ['两年不见，', '你还好吗'],
  'Happy 26th Birthday Pikajay': ['Happy 26th Birthday', 'Pikajay'],
  'Happy 27th BD My Boy': ['Happy 27th BD', 'My Boy'],
  '找到你是我最大伟大的成功': ['找到你是我', '最大伟大的成功'],
  '你我同绕日，十度春秋': ['你我同绕日，', '十度春秋'],
};
function splitTitle(title) {
  const t = String(title);
  if (BREAKS[t]) return BREAKS[t];
  if (units(t) <= 9.6) return [t];
  const half = units(t) / 2;
  let cut = -1, best = 1e9;
  for (let i = 1; i < t.length; i++) {
    if (/[，、：:&\s]/.test(t[i - 1])) { const d = Math.abs(units(t.slice(0, i)) - half); if (d < best) { best = d; cut = i; } }
  }
  if (cut < 0 || best > half * 0.6) {
    cut = Math.round(t.length / 2);
    try {
      best = 1e9;
      for (const s of new Intl.Segmenter('zh', { granularity: 'word' }).segment(t)) {
        if (!s.index) continue;
        const d = Math.abs(units(t.slice(0, s.index)) - half);
        if (d < best) { best = d; cut = s.index; }
      }
    } catch { /* 没有 Intl.Segmenter：就从中间断 */ }
  }
  return [t.slice(0, cut).trim(), t.slice(cut).trim()].filter(Boolean);
}
/** 竖排的题名：每行一个 .ln；tail 接在最后一行下面（双行夹注）。 */
function titleLines(title, tail) {
  const lines = splitTitle(title);
  return lines.map((ln, i) => h('span', { class: 'ln' }, h('span', { class: 'lt v' }, vt(ln)), i === lines.length - 1 && tail));
}

/* 题记：尽量在标点处换行，一行一个分句；L 是一行最多几个字。 */
function quoteLines(text, L) {
  const clauses = String(text).match(/[^，。；！？、,;!?…]+[，。；！？、,;!?…”’」』）)]*\s*/g) || [String(text)];
  const parts = [];
  for (const c of clauses) {                              // 单个分句就超长的，按字数（西文按空格）均分
    const u = units(c), n = Math.ceil(u / L), target = u / n;
    let start = 0;
    for (let k = 1; k < n; k++) {
      let best = start + 1, bd = 1e9;
      for (let i = start + 1; i < c.length; i++) {
        const d = Math.abs(units(c.slice(start, i)) - target) - (c[i] === ' ' || c[i - 1] === ' ' ? 2.5 : 0);
        if (d < bd) { bd = d; best = i; }
      }
      parts.push(c.slice(start, best)); start = best;
    }
    parts.push(c.slice(start));
  }
  const n2 = parts.length;
  let bestLines = null, bestScore = 1e9;
  for (let mask = 0; mask < (1 << (n2 - 1)) && n2 <= 12; mask++) {   // 分句很少，穷举所有分行方式
    const lines = [];
    let cur = parts[0], ok = true, score = 0;
    for (let j = 1; j < n2; j++) { if (mask & (1 << (j - 1))) { lines.push(cur); cur = parts[j]; } else cur += parts[j]; }
    lines.push(cur);
    for (const ln of lines) { const w = units(ln.trim()); if (w > L + 0.01) ok = false; score += w * w; }
    score += lines.length * 1e4;                           // 先求行数最少，再求各行最匀
    if (ok && score < bestScore) { bestScore = score; bestLines = lines; }
  }
  return (bestLines || parts).map((s) => s.trim()).filter(Boolean);
}

const PLAY_SVG = '<svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><circle class="play-ring" cx="22" cy="22" r="15.5"/><path class="ic-play" d="M19.2 16.6 L28.4 22 L19.2 27.4 Z"/><path class="ic-pause" d="M17.8 16.8h2.6v10.4h-2.6zM23.6 16.8h2.6v10.4h-2.6z"/></svg>';

/* 首页每一叶默认印哪一句眉批：有这几封就用它们，否则用这一排的第一封。 */
const PICKS = new Set(['221 FOREVER', 'One Year']);

export default {
  mount(ctx) {
    const { site, letters, root, player, router, ui } = ctx;
    const { fmt } = ui;
    const wide = window.matchMedia('(min-width: 720px)');
    const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;

    const authorsOf = (l) => (Array.isArray(l.authors) && l.authors.length ? l.authors : [l.author || '']);
    const who = (l) => authorsOf(l).join('、');
    const isGuest = (l) => l.role === 'guest';
    const own = letters.filter((l) => !isGuest(l));       // 他们俩的信
    const guests = letters.filter(isGuest);               // 客人的信：放在书末的「跋」
    const newest = own[own.length - 1] || letters.latest;

    /* ── 回目录：有 router.home() 就用它，否则靠链接上的 data-back ── */
    function goHome(e) {
      if (e && !plain(e)) return;
      if (typeof router.home === 'function') { if (e) e.preventDefault(); router.home(); }
      else if (!e) router.back('/');
    }
    const homeLink = (cls, ...kids) => h('a', { class: cls, href: '/', 'data-back': true, onclick: goHome }, kids);
    /* 上一封 / 下一封：替换历史记录，这样「后退」总是回到目录 */
    function hop(e) {
      if (!plain(e)) return;
      e.preventDefault();
      router.go(e.currentTarget.getAttribute('href'), { replace: true });
    }

    /* ══════════════ 目录（首页） ══════════════ */

    /** 双行夹注（其实是三行）：日期、执笔、《歌》 */
    function wari(l) {
      return h('span', { class: 'wari v' },
        h('span', {}, mdZh(l.date)),
        h('span', {}, vt(who(l))),
        l.song && (CJK.test(l.song.title) ? h('span', {}, '《', vt(l.song.title), '》') : h('span', { class: 'lat it', lang: 'en' }, l.song.title)));
    }
    function column(l, label) {
      const d = l.days.met;
      const a = h('a', {
        class: 'col', href: l.url,
        'aria-label': `第 ${l.no} 封：${l.title}，${fmt.date(l.date)}，${who(l)} 写${l.song ? `，配歌《${l.song.title}》` : ''}${d != null ? `，相识第 ${d} 日` : ''}`,
      },
      label && h('span', { class: 'latest-k v' }, label),
      h('span', { class: 't' }, titleLines(l.title, wari(l))),
      h('span', { class: 'lead', 'aria-hidden': 'true' }),
      h('span', { class: 'day', lang: 'en' }, d != null ? String(d) : ''));
      a.addEventListener('pointerenter', () => router.prefetch(a.href));
      a.addEventListener('touchstart', () => router.prefetch(a.href), { passive: true });
      return a;
    }
    function mei(l) {
      if (!l.quote) return null;
      const p = h('p', { class: 'mei v' }, vt(l.quote));
      p.dataset.u = units(l.quote).toFixed(1);
      return p;
    }
    const cells = new Map();                               // 信 → <li>，换栏数时重复使用
    function letterCell(l) {
      if (!cells.has(l)) cells.set(l, h('li', { class: 'cell cell--letter' + (l.quiet ? ' is-quiet' : ''), 'data-no': l.no }, column(l), mei(l)));
      return cells.get(l);
    }
    const blank = () => h('li', { class: 'cell cell--blank', 'aria-hidden': 'true' });

    /* 一叶：年份一行，其后每封信一行，剩下的行空着（空白也是内容） */
    function leaf(g, k, slim) {
      const count = g.list.length;
      const ol = h('ol', { class: 'cols', style: `--k:${k}` },
        h('li', { class: 'cell cell--year' }, h('div', { class: 'yr' },
          h('h2', { class: 'yr-t v' }, g.title),
          h('p', { class: 'yr-n v' }, g.note),
          count > 0 && h('p', { class: 'yr-foot' }, '日数'))));
      g.list.forEach((l, i) => {
        const cell = letterCell(l);
        cell.classList.remove('is-mei', 'is-off');
        cell.dataset.row = Math.floor((i + 1) / k);
        ol.append(cell);
      });
      for (let i = (k - (count + 1) % k) % k; i > 0; i--) ol.append(blank());
      for (let r = 0; r * k < count + 1; r++) {             // 每一排默认印一句眉批
        const row = g.list.filter((l, i) => Math.floor((i + 1) / k) === r && l.quote);
        const pick = row.find((l) => PICKS.has(l.title)) || row[0];
        if (pick) letterCell(pick).classList.add('is-mei');
      }
      return h('section', { class: 'leaf' + (count ? '' : ' leaf--blank') + (slim ? ' leaf--slim' : '') + (g.guest ? ' leaf--ba' : ''), id: g.id, 'aria-label': g.label }, ol);
    }

    const groups = [];
    if (letters.length) {
      const y1 = Math.max(letters[letters.length - 1].year, own.length ? own[own.length - 1].year : 0);
      for (let y = letters[0].year; y <= y1; y++) {
        const list = own.filter((l) => l.year === y);
        groups.push({ id: 'y' + y, year: y, title: yearZh(y), note: list.length ? numZh(list.length) + '封' : '没有信', list, label: `${y} 年，${list.length ? list.length + ' 封' : '没有信'}` });
      }
      while (groups.length > 1 && !groups[groups.length - 1].list.length && groups[groups.length - 1].year > (own.length ? own[own.length - 1].year : 0)) groups.pop();
      if (guests.length) groups.push({ id: 'ba', guest: true, title: '跋', note: numZh(guests.length) + '篇', list: guests, label: `跋，客人写的 ${guests.length} 篇` });
    }

    const leaves = h('div', { class: 'leaves' });
    let lastN = 0;
    function buildLeaves() {
      const n = parseInt(getComputedStyle(root).getPropertyValue('--n'), 10) || 12;
      if (n === lastN) return;
      lastN = n;
      const half = n % 2 ? 0 : n / 2;
      const small = (g) => Boolean(half && g && g.list.length <= half - 1);
      const out = [];
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i], nx = groups[i + 1];
        if (small(g) && small(nx)) { out.push(h('div', { class: 'spread spread--pair' }, leaf(g, half), leaf(nx, half))); i++; }
        else if (g.guest && small(g)) out.push(h('div', { class: 'spread spread--pair' }, leaf(g, half)));
        else out.push(h('div', { class: 'spread' }, leaf(g, n, !g.list.length)));
      }
      leaves.replaceChildren(...out);
      markRead();
    }
    /* 眉批：分成差不多长的几行；靠左放不下时改为向右展开 */
    function layoutHome() {
      if (!homeEl || !homeEl.isConnected) return;
      buildLeaves();
      const maxPer = wide.matches ? 7 : 9;
      for (const m of homeEl.querySelectorAll('.mei')) {
        const u = Number(m.dataset.u) || 1, per = Math.ceil(u / Math.max(1, Math.ceil(u / maxPer)));
        m.style.height = ((per + 0.7) * 1.06).toFixed(2) + 'em';
      }
      for (const lf of homeEl.querySelectorAll('.leaf')) {
        const left = lf.getBoundingClientRect().left;
        for (const c of lf.querySelectorAll('.cell--letter, .cell--latest')) {
          const m = c.querySelector('.mei');
          if (!m) continue;
          m.classList.remove('mei--l');
          m.classList.toggle('mei--l', m.getBoundingClientRect().left < left - 1);
        }
      }
    }

    /* 刚读过的那封：回到目录时它那一列亮着，眉批换成它的 */
    let lastShown = null;
    const lastRead = () => router.lastRead || lastShown;
    function markRead() {
      const l = lastRead();
      for (const c of leaves.querySelectorAll('.is-read, .is-off')) c.classList.remove('is-read', 'is-off');
      const cell = l && cells.get(l);
      if (!cell || !cell.isConnected) return null;
      cell.classList.add('is-read');
      for (const c of cell.parentNode.querySelectorAll(`.is-mei[data-row="${cell.dataset.row}"]`)) if (c !== cell) c.classList.add('is-off');
      return cell;
    }

    function titleLeaf() {
      const count = (l) => numZh(l.length);
      const span = letters.length ? `${yearZh(letters[0].year)}—${yearZh(letters[letters.length - 1].year)}` : '';
      const pens = [];
      for (const l of own) { const a = l.author; const p = pens.find((x) => x[0] === a); if (p) p[1]++; else pens.push([a, 1]); }
      const rule = (text) => h('div', { class: 'half' }, h('p', { class: 'v' }, vt(text)));
      const pair = (cls, a, b) => h('li', { class: 'cell cell--fl ' + cls }, rule(a), rule(b));
      const latest = newest && h('li', { class: 'cell cell--latest' }, column(newest, '最近一封'), mei(newest));
      return h('header', { class: 'leaf leaf--title', 'aria-label': '扉页' },
        h('ol', { class: 'cols' },
          h('li', { class: 'cell cell--name' }, h('h1', { class: 'name v' }, h('span', { lang: 'en' }, site.title))),
          h('li', { class: 'cell cell--sub' },
            h('div', { class: 'ln' }, h('p', { class: 'sub-kind v' }, '书信集'),
              h('p', { class: 'wari v' }, h('span', {}, count(own) + '封' + (guests.length ? `，跋${count(guests)}篇` : '')), h('span', {}, span))),
            pens.length > 0 && h('p', { class: 'pens wari v' }, pens.map(([a, n]) => h('span', {}, vt(a), ' ' + numZh(n) + '封')))),
          h('li', { class: 'cell cell--gap', 'aria-hidden': 'true' }),
          h('li', { class: 'cell cell--flh' }, h('h2', { class: 'v' }, '凡例')),
          pair('fl-a',
            `一、收信${count(own)}封${guests.length ? `，另跋${count(guests)}篇` : ''}。一年一叶，自右向左读。`,
            '一、上边空白处是从信里摘的一句。点哪一列，展哪封信。'),
          pair('fl-b',
            '一、目录不标页码，标的是相识以来的日数。',
            `一、相识在${ymdZh(site.met)}，是为第〇日。`),
          pair('fl-c',
            '一、每信配歌一首，不自动播放。',
            '一、空白处是没写信的日子，并非漏印。'),
          latest));
    }
    function yearIndex() {
      return h('nav', { class: 'yidx', 'aria-label': '翻到某一年' },
        h('span', { class: 'yidx-k' }, '翻到'),
        groups.map((g) => h('a', { href: '#' + g.id, class: g.list.length ? '' : 'is-blank', lang: g.guest ? null : 'en', 'aria-label': g.label }, g.guest ? '跋' : String(g.year))));
    }

    let homeEl = null;
    function homeView() {
      if (!homeEl) homeEl = h('div', { class: 'home' }, titleLeaf(), yearIndex(), leaves);
      return homeEl;
    }

    /* ══════════════ 读信：一张横格笺 ══════════════ */

    function playButton(l, cls) {
      const b = h('button', { type: 'button', class: 'play ' + (cls || ''), 'data-play': l ? l.no : '', 'aria-pressed': 'false', 'aria-label': '播放' });
      b.innerHTML = PLAY_SVG;
      b.addEventListener('click', () => player.toggle(l || player.state.letter || (ctx.page.letter && ctx.page.letter.song ? ctx.page.letter : null) || newest));
      return b;
    }

    function plate(l) {
      if (!l.cover) return null;
      const ink = l.cover.own === false || l.cover.own === undefined;    // 网上找来的图印成墨色；自己拍的照片是原色
      const portrait = l.cover.h > l.cover.w;
      const fig = h('figure', { class: 'plate' + (ink ? '' : ' is-color') + (portrait ? ' plate--tall' : '') });
      const hint = h('span', { class: 'plate-hint' });
      const btn = h('button', { type: 'button', class: 'plate-btn', 'aria-pressed': String(!ink), 'aria-label': '封面图，点按切换墨色与原色' },
        ctx.img(l.cover, { sizes: '(max-width: 719px) 62vw, (max-width: 1179px) 340px, 264px', widths: [480, 800], lazy: false, alt: `第 ${l.no} 封的封面` }));
      const say = () => { hint.textContent = fig.classList.contains('is-color') ? '点图见墨色' : '点图见原色'; };
      btn.addEventListener('click', () => { btn.setAttribute('aria-pressed', String(fig.classList.toggle('is-color'))); say(); });
      say();
      fig.append(btn, h('figcaption', {}, h('span', {}, '图版 ', h('span', { class: 'n', lang: 'en' }, String(l.no)), ' · 封面'), hint));
      return fig;
    }

    function songBox(l) {
      if (!l.song) return null;
      const bar = h('span', { class: 'song-bar', role: 'presentation' }, h('i', {}));
      bar.addEventListener('click', (e) => {                              // 点进度线：从那里放
        const s = player.state, r = bar.getBoundingClientRect();
        if (s.letter === l && s.duration && r.width) player.seek((e.clientX - r.left) / r.width * s.duration);
      });
      return h('section', { class: 'song', 'aria-label': '配歌', 'data-song': l.no },
        h('p', { class: 'song-k' }, '配歌'),
        h('p', { class: 'song-t' }, l.song.title),
        l.song.artist && h('p', { class: 'song-a' }, l.song.artist),
        h('div', { class: 'song-c' }, playButton(l), bar, h('span', { class: 'song-time', lang: 'en' }, fmt.clock(l.song.duration))),
        h('p', { class: 'song-err', role: 'status' }));
    }

    function counts(l) {
      const nth = (n) => [h('span', { class: 'u' }, '第'), h('span', { class: 'n', lang: 'en' }, String(n)), h('span', { class: 'u' }, '日')];
      const rows = [['执笔', h('span', { class: 'pen' }, who(l))]];
      if (l.days.met != null) rows.push(['相识', nth(l.days.met)]);
      if (l.days.together != null) rows.push(['相恋', nth(l.days.together)]);
      if (l.days.married != null) rows.push(['结婚', nth(l.days.married)]);
      return h('dl', { class: 'counts' }, rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))));
    }

    /* 信末的一小叶：上一封 | 目录 | 下一封（书往左翻，所以上一封在右） */
    function feet(l) {
      const side = (to, label, none) => {
        if (!to) return h('li', { class: 'cell cell--foot' }, h('div', { class: 'col' }, h('span', { class: 'foot-none v' }, none)));
        const d = to.days.met;
        return h('li', { class: 'cell cell--foot' },
          h('a', { class: 'col', href: to.url, rel: label === '上一封' ? 'prev' : 'next', onclick: hop, 'aria-label': `${label}：${to.title}` },
            h('span', { class: 'latest-k v' }, label),
            h('span', { class: 't' }, titleLines(to.title)),
            h('span', { class: 'day', lang: 'en' }, d != null ? String(d) : '')));
      };
      const prev = side(l.prev, '上一封', '这是第一封。');
      const next = side(l.next, '下一封', '下一封还没写。');
      const home = h('li', { class: 'cell cell--foot cell--home' },
        homeLink('col', h('span', { class: 't' }, h('span', { class: 'ln' }, h('span', { class: 'lt v' }, '目录'), h('span', { class: 'wari v' }, h('span', {}, isGuest(l) ? '回到跋那一叶' : `回到${yearZh(l.year)}年那一叶`)))), h('span', { class: 'day day--k' }, '日数')));
      return h('nav', { class: 'feet', 'aria-label': '上一封、目录、下一封' }, h('ol', { class: 'cols', style: '--k:3' }, prev, home, next));
    }

    /* 信的正文：只加几个 class，可以重复执行；节点本身是搬过来的，不重建 */
    const SNAP = 'figure, .fo-fig, .flip-card, .gift-scene, div.img, pre, table, video, iframe';
    function dress(el) {
      for (const q of el.querySelectorAll('blockquote:not(.largeQuote)')) {
        const ps = q.querySelectorAll('p');
        for (const p of (ps.length ? ps : [q])) {
          const t = p.textContent;
          if (/[A-Za-z]{3}/.test(t) && !/[㐀-鿿]/.test(t)) { p.classList.add('q-en'); p.lang = 'en'; }
        }
      }
      /* 着重号：加粗的每个汉字包一层，点画在字的正下方（不占行高）；西文画一道细线 */
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const texts = [];
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const p = t.parentNode;
        if (p.closest('b, strong') && !p.closest('code, .dz, .lz') && /[\u3400-\u9fffA-Za-z0-9]/.test(t.nodeValue)) texts.push(t);
      }
      for (const t of texts) {
        const parts = t.nodeValue.match(/[\u3400-\u9fff]|[A-Za-z0-9][A-Za-z0-9 .,'’!?-]*[A-Za-z0-9]|[A-Za-z0-9]|[^\u3400-\u9fffA-Za-z0-9]+/g) || [];
        t.replaceWith(...parts.map((s) => (/^[\u3400-\u9fff]$/.test(s) ? h('span', { class: 'dz' }, s) : /^[A-Za-z0-9]/.test(s) ? h('span', { class: 'lz' }, s) : s)));
      }
      for (const p of el.querySelectorAll('p, div[align]')) {
        if (p.closest('.flip-card-back, .gift-scene')) continue;
        const t = p.textContent.trim();
        if (!t && p.querySelector('img') && !p.querySelector('p, div')) p.classList.add('fo-fig');
        else if (p.tagName === 'P' && t.length < 80 && (!p.nextElementSibling || p.nextElementSibling.matches('.flip-card-hint')) && /^(\d{4}\s*年\s*\d|-{4,})/.test(t)) p.classList.add('fo-sign');
        else if (p.tagName === 'P' && /^-{4,}.*-{4,}$/.test(t)) p.classList.add('fo-sign');
      }
    }
    /* 图、卡片这些不是字的东西：把它占的高度凑成整行，后面的字才落回格线上 */
    let ro = null;
    function snap(el) {
      const body = el.closest('.letter-body');
      if (!body) return;
      const L = parseFloat(getComputedStyle(body).lineHeight) || 36;
      const hgt = el.getBoundingClientRect().height;
      if (hgt < 2) { el.style.marginBottom = ''; el.style.top = ''; return; }
      const r = (L - (hgt % L)) % L;
      const mb = (L + r).toFixed(2) + 'px', top = (r / 2).toFixed(2) + 'px';
      if (el.style.marginBottom !== mb) el.style.marginBottom = mb;
      if (el.style.top !== top) el.style.top = top;
    }
    /* 短信的笺是被两边的栏撑高的：把它补到整行，底边才落在格线上 */
    function fit() {
      const body = root.querySelector('.letter-body');
      if (!body) return;
      body.style.minHeight = '';
      const cs = getComputedStyle(body), L = parseFloat(cs.lineHeight) || 36, H = body.getBoundingClientRect().height;
      const inner = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      const r = inner % L;
      if (r > 0.5 && L - r > 0.5) body.style.minHeight = (H + L - r).toFixed(2) + 'px';
    }
    function snapAll(el) {
      if (ro) ro.disconnect();
      if (typeof ResizeObserver === 'function') ro = ro || new ResizeObserver((entries) => { for (const e of entries) snap(e.target); });
      for (const b of el.querySelectorAll(SNAP)) {
        if (b.parentElement.closest(SNAP)) continue;
        b.classList.add('fo-snap');
        snap(b);
        if (ro) ro.observe(b);
      }
    }

    let letterEl = null;
    function letterView({ letter: l, contentEl }) {
      const guest = isGuest(l);
      dress(contentEl);
      const body = h('div', { class: 'letter-body body' }, contentEl);
      const quote = l.quote ? quoteLines(l.quote, wide.matches ? 20 : 19) : [];
      letterEl = h('article', { class: 'letter' + (l.quiet ? ' is-quiet' : '') + (guest ? ' is-guest' : ''), 'data-no': l.no },
        h('header', { class: 'bar' },
          homeLink('bar-back', '目录'),
          h('span', { class: 'bar-name', lang: 'en' }, site.title),
          h('span', { class: 'bar-no', lang: 'en' }, guest ? h('b', { lang: 'zh-Hans' }, '跋') : [h('b', {}, String(l.no)), ' / ' + letters.length])),
        h('div', { class: 'sheet' },
          h('aside', { class: 'side' }, h('div', { class: 'side-in' }, plate(l), songBox(l), counts(l))),
          h('header', { class: 'tiji' }, h('div', { class: 'tiji-in' },
            h('h1', { class: 'tiji-title', 'aria-label': l.title }, guest && h('span', { class: 'tiji-k v' }, '跋'), titleLines(l.title)),
            quote.length > 0 && h('p', { class: 'tiji-quote v' }, quote.map((ln, i) => [i > 0 && h('br'), vt(ln)])))),
          h('div', { class: 'head' },
            h('span', { class: 'head-l' }, h('span', { lang: 'en' }, site.title), ' 用笺'),
            h('span', { class: 'head-r' }, ymdZh(l.date) + (l.place ? ' · ' + l.place : ''))),
          body,
          feet(l)));
      return letterEl;
    }
    /** 搬进文档之后才能量：翻转卡片按新宽度重量一次，图和卡片凑整行 */
    function settle(contentEl) {
      ctx.widgets.init(contentEl);
      snapAll(contentEl);
      fit();
    }

    function lostView() {
      const n = parseInt(getComputedStyle(root).getPropertyValue('--n'), 10) || 12;
      const fill = [];
      for (let i = Math.max(0, n - 4); i > 0; i--) fill.push(blank());
      return h('div', { class: 'home home--lost' },
        h('div', { class: 'spread' },
          h('section', { class: 'leaf leaf--lost', 'aria-label': '没有这一页' },
            h('ol', { class: 'cols' },
              h('li', { class: 'cell cell--year' }, h('div', { class: 'yr' }, h('h1', { class: 'yr-t v' }, '缺页'), h('p', { class: 'yr-n v' }, '四〇四'))),
              h('li', { class: 'cell cell--fl' }, h('div', { class: 'half' }, h('p', { class: 'v' }, '这一页是空白的。')), h('div', { class: 'half' }, h('p', { class: 'v' }, '这回不是没写信，是地址不对。'))),
              h('li', { class: 'cell cell--foot cell--home' }, h('a', { class: 'col', href: '/' }, h('span', { class: 't' }, h('span', { class: 'ln' }, h('span', { class: 'lt v' }, '目录'), h('span', { class: 'wari v' }, h('span', {}, '回到第一叶')))), h('span', { class: 'day day--k' }, '日数'))),
              fill))));
    }

    /* ══════════════ 外壳：正文、版权页、底边的一行歌 ══════════════ */

    const main = h('main', { class: 'fo-main', tabindex: '-1' });
    const hunger = ui.hunger();
    const dToday = site.today.days.met;
    const colophon = h('footer', { class: 'colophon' },
      dToday != null && h('p', { class: 'colophon-today' }, '今天是相识的第', h('span', { class: 'n', lang: 'en' }, String(dToday)), '日。下一封还没写。'),
      hunger.text && h('p', { class: 'colophon-voice', 'data-level': hunger.level }, h('span', { class: 'voice-k' }, '网站按'), h('span', { class: 'voice-t' }, hunger.text)),
      h('p', { class: 'colophon-name', lang: 'en' }, site.title),
      h('p', { class: 'colophon-c', lang: 'en' }, `© 2016 – ${Math.max(2026, Number(fmt.date(site.today.date, 'year')) || 0)} Fan & Wan`),
      ui.switcher());

    const now = {
      el: h('aside', { class: 'now', 'aria-label': '配歌' }),
      play: playButton(null, 'play--now'),
      title: h('a', { class: 'now-t' }),
      time: h('span', { class: 'song-time', lang: 'en' }),
      home: homeLink('now-home', '目录'),
    };
    now.el.append(now.play, now.title, now.time, now.home);
    root.replaceChildren(main, colophon, now.el);

    /* ── 播放器 → 界面 ── */
    function paint(s) {
      const pl = ctx.page.letter;
      for (const b of root.querySelectorAll('[data-play]')) {
        const mine = b.dataset.play ? s.letter && String(s.letter.no) === b.dataset.play : Boolean(s.letter);
        const on = Boolean(mine && s.playing);
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? '暂停' : '播放');
        b.classList.toggle('is-loading', Boolean(mine && s.loading));
      }
      const box = root.querySelector('.song');
      if (box) {
        const mine = s.letter && String(s.letter.no) === box.dataset.song;
        box.querySelector('.song-err').textContent = mine && s.error ? '没放出来，再点一下试试。' : mine && s.loading ? '正在取歌…' : '';
        box.classList.toggle('is-on', Boolean(mine));
      }
      /* 底边那一行：有歌载入了就在；读信时窄屏上一直在（暂停要够得着，目录也在这里） */
      const target = s.letter || (pl && pl.song ? pl : null);
      now.el.toggleAttribute('data-on', Boolean(s.letter));
      now.el.toggleAttribute('data-same', Boolean(s.letter && pl && s.letter === pl));
      now.play.hidden = !target;
      now.title.textContent = '';
      if (target) {
        now.title.append(h('span', { class: 'now-k' }, s.error ? '没放出来' : '配歌'), target.song.title);
        if (pl === target) now.title.removeAttribute('href'); else now.title.setAttribute('href', target.url);
      }
      root.toggleAttribute('data-song', Boolean(s.letter));
      tick(s);
    }
    function tick(s) {
      const pl = ctx.page.letter;
      const box = root.querySelector('.song');
      if (box) {
        const mine = s.letter && String(s.letter.no) === box.dataset.song;
        const l = pl && pl.song ? pl : null;
        box.querySelector('.song-time').textContent = mine ? fmt.clock(s.time) : fmt.clock(l ? l.song.duration : 0);
        box.querySelector('.song-bar i').style.width = mine && s.duration ? (s.time / s.duration * 100).toFixed(2) + '%' : '0';
      }
      const target = s.letter || (pl && pl.song ? pl : null);
      now.time.textContent = s.letter ? `${fmt.clock(s.time)} / ${fmt.clock(s.duration)}` : target ? fmt.clock(target.song.duration) : '';
    }
    player.on('change', paint);
    player.on('time', tick);

    /* ── 一个函数画任何一页；之后每次站内跳转核心都会再调它 ── */
    let first = true;
    function show(route) {
      let moved;
      if (ro) ro.disconnect();
      if (route.type === 'letter') {
        main.replaceChildren(letterView(route));
        root.dataset.view = 'letter';
        root.toggleAttribute('data-quiet', Boolean(route.letter.quiet));
        settle(route.contentEl);
        lastShown = route.letter;
      } else if (route.type === 'home') {
        main.replaceChildren(homeView());
        root.dataset.view = 'home';
        root.removeAttribute('data-quiet');
        layoutHome();
        /* 回到目录：落在刚读过的那封信所在的那一叶，而不是当初出发的地方 */
        const cell = markRead();
        if (cell && !route.hash) {
          const r = cell.getBoundingClientRect(), y0 = window.scrollY, top = r.top + y0, vh = window.innerHeight;
          const tian = parseFloat(getComputedStyle(cell.closest('.leaf')).paddingTop) || 0;
          if (top - tian < route.scrollY || top + r.height > route.scrollY + vh) {
            window.scrollTo(0, Math.max(0, top - tian - 12));
            moved = false;
          }
        }
      } else {
        main.replaceChildren(lostView());
        root.dataset.view = 'lost';
      }
      paint(player.state);
      if (!first) main.focus({ preventScroll: true });
      first = false;
      return moved;
    }

    /* 栏数随宽度变；字体到了以后眉批要重排一次 */
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { layoutHome(); fit(); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutHome(); fit(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.dataset.view === 'letter' && !e.defaultPrevented && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) goHome();
    });

    show(router.current);
    return { show };
  },
};
