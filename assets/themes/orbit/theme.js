// 「绕日」 orbit — 把所有的信画成一张日心轨道图版：一年一圈，一封信一个天体，旁边是一张星历表。
// 设计说明见同目录的 README.md。契约只有 mount(ctx)，不从核心引入任何东西。

const NS = 'http://www.w3.org/2000/svg';
const DAY = 864e5;

/** h('a', { class, href, onclick }, ...children) → HTML 元素。null / false 的属性和子节点会被跳过。 */
function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...kids.flat(9).filter((c) => c != null && c !== false));
  return node;
}
/** SVG 元素 */
function S(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}
/** 写死的小图标（里面没有任何数据） */
function icon(w, ht, inner, cls) {
  const t = document.createElement('template');
  t.innerHTML = `<svg viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${inner}</svg>`;
  return t.content.firstChild;
}
const f1 = (n) => Math.round(n * 100) / 100;
const utc = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const yearOf = (ms) => new Date(ms).getUTCFullYear();
const dots = (iso) => iso.replace(/-/g, '·');
const md = (iso) => iso.slice(5).replace('-', '·');
const latin = (s) => /^[\x20-\x7e]+$/.test(s);
const mod = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0;

/** 地球的日心黄经（度）。天文年历的低精度太阳公式，误差约 0.01°。 */
function helioT(t) {
  const n = t / DAY + 2440587.5 - 2451545.0;
  const L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * Math.PI / 180;
  const lam = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  return (((lam + 180) % 360) + 360) % 360;
}
const helio = (ms) => helioT(ms + DAY / 2);          // 当天正午的位置

/** 图上印的二分二至（3·20 / 6·21 / 9·23 / 12·21），按日历天数算距离 */
const CARDINALS = [['03-20', '春分'], ['06-21', '夏至'], ['09-23', '秋分'], ['12-21', '冬至']];
function nearCardinal(iso) {
  const ms = utc(iso), y = Number(iso.slice(0, 4));
  let best = null;
  for (const yy of [y - 1, y, y + 1]) for (const [d, name] of CARDINALS) {
    const n = Math.round((utc(`${yy}-${d}`) - ms) / DAY);
    if (!best || Math.abs(n) < Math.abs(best.n)) best = { n, name };
  }
  return best.n === 0 ? `${best.name}当日` : best.n > 0 ? `${best.name}前 ${best.n} d` : `${best.name}后 ${-best.n} d`;
}

// 执笔人的记号：实心 = 他，空心 = 她，半实 = 合写，带尾巴的小天体 = 访客
const GLYPH = {
  him: '<circle cx="6" cy="6" r="3.7" class="f"/>',
  her: '<circle cx="6" cy="6" r="3.3" class="s"/>',
  both: '<circle cx="6" cy="6" r="3.3" class="s"/><path d="M6 2.7A3.3 3.3 0 0 0 6 9.3Z" class="f"/>',
  guest: '<circle cx="4.4" cy="7.6" r="2.1" class="f"/><path d="M6.6 5.4L11 1M7.6 7.2l3-1.3M4.8 4.4l1.3-3" class="s"/>',
};
const roleOf = (letter) => (GLYPH[letter.role] ? letter.role : 'guest');
const glyph = (letter) => icon(12, 12, GLYPH[roleOf(letter)], 'g');
function byline(letter) {
  const role = roleOf(letter), names = letter.authors || [letter.author];
  if (role === 'both' && names.length > 1) return `${names[0]} 起头 · ${names[1]} 写`;
  return role === 'guest' ? `${letter.author} · 访客` : `${letter.author} 执笔`;
}

const ARROW = '<path d="M0 5h14M10 1l4 4-4 4" fill="none" stroke="currentColor"/>';
const RING = 2 * Math.PI * 19;
const PLAY = `<circle class="p-ring" cx="22" cy="22" r="19"/><circle class="p-prog" cx="22" cy="22" r="19" transform="translate(22 22) scale(-1 1) rotate(-90) translate(-22 -22)" stroke-dasharray="${f1(RING)}" stroke-dashoffset="${f1(RING)}"/><circle class="p-dot" cx="22" cy="3" r="2.4"/><path class="i-play" d="M18.2 14.6v14.8L30 22z"/><path class="i-pause" d="M16.6 15h3.6v14h-3.6zM23.8 15h3.6v14h-3.6z"/>`;

export default {
  mount(ctx) {
    const { site, letters, root, player, router, ui, env } = ctx;
    const { fmt } = ui;
    const MET = utc(site.met), TOG = utc(site.together), TODAY = utc(site.today.date);
    const Y0 = yearOf(MET), Y1 = Math.max(letters.latest.year, yearOf(TODAY));
    const still = env.reducedMotion;
    const geo = letters.map((l) => { const ms = utc(l.date); return { ms, a: helio(ms) }; });
    const gapOf = (l) => Math.round((geo[l.index].ms - (l.prev ? geo[l.prev.index].ms : MET)) / DAY);
    const season = (iso) => (fmt.season ? fmt.season(iso) : '');
    /** 「季节」一格：大字是按月份的春夏秋冬（核心给），小字是离最近的二分二至几天。核心还没有 season 时只报节气，不自己猜季节。 */
    const cell = (dt, dd, small) => h('div', {}, h('dt', {}, dt), h('dd', {}, dd), h('small', {}, small));
    const seasonCell = (iso) => { const s = season(iso), c = nearCardinal(iso); return s ? cell('季节', s, c) : cell('节气', c.slice(0, 2), c.slice(2)); };
    const names = (l) => (l.authors && l.authors.length > 1 ? l.authors.join(' · ') : l.author);
    // 每年都会经过的五个日子
    const SPOKES = [[site.met, '认识'], [site.together, '在一起'], [site.married, '结婚'], ['-02-06', '他的生日'], ['-07-04', '她的生日']]
      .filter((x) => x[0]).map(([d, label]) => ({ md: d.slice(-5), label }));

    /** 第几圈、本圈走了多少度；从在一起那天起算，之前是「入轨前」 */
    function lapOf(ms) {
      if (ms < TOG) return null;
      let deg = ((helio(ms) - helio(TOG)) % 360 + 360) % 360;
      if (deg > 359.5) deg = 0;
      return { n: Math.round(((ms - TOG) / DAY - deg / 360 * 365.2422) / 365.2422) + 1, deg: Math.round(deg) };
    }

    // ───────────────────────── 绕日图 ─────────────────────────
    function makeChart(host, opt = {}) {
      host.textContent = '';
      const W = Math.round(host.clientWidth), H = Math.round(host.clientHeight);
      if (!W || !H) return null;
      const mini = !!opt.mini, phone = !mini && W < 520, big = !mini && !phone, lab = mini && W >= 220;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true',
        class: 'orbit' + (mini ? ' is-mini' : '') + (phone ? ' is-phone' : '') + (opt.intro ? ' intro' : '') }, host);
      const cx = W / 2, cy = H / 2;
      let R, band, rOut, rIn, dotR, sunR;
      if (mini) { R = Math.min(W, H) / 2 - (lab ? 24 : 2); band = 0; rOut = R - (lab ? 12 : 7); rIn = R * 0.19; dotR = lab ? 1.7 : 1.2; sunR = lab ? 4.5 : 3; }
      else if (phone) { R = Math.min(W / 2 - 16, H / 2 - 22); band = 15; rOut = R - band - 8; rIn = R * 0.2; dotR = 2.8; sunR = 5.5; }
      else {
        R = Math.min(W / 2 - (W < 700 ? 58 : 66), H / 2 - 34);
        // 图版左上角压着站名：圆不能碰到它
        const hr = host.getBoundingClientRect(), t = host.parentElement.querySelector('.masthead h1'), tr = t && t.getBoundingClientRect();
        if (tr && tr.bottom > hr.top && tr.right > hr.left) R = Math.min(R, Math.hypot(cx - (tr.right - hr.left - 4), cy - (tr.bottom - hr.top - 6)) - 2);
        band = 20; rOut = R - band - 16; rIn = R * 0.25; dotR = Math.max(3.2, Math.min(4.4, R / 82)); sunR = 9;
      }
      if (big) svg.style.setProperty('--z', f1(Math.min(1.3, Math.max(1, R / 290))));     // 图大了，图上的字跟着大
      const step = (rOut - rIn) / Math.max(1, Y1 - Y0);
      const rOf = (y) => rOut - (Math.min(Math.max(y, Y0), Y1) - Y0) * step;
      const P = (deg, r) => { const a = deg * Math.PI / 180; return [f1(cx + r * Math.cos(a)), f1(cy - r * Math.sin(a))]; };
      const line = (p0, p1, cls, parent) => S('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: cls }, parent);
      /** 沿半径 r 逆时针从 a0 到 a1 的一段弧 */
      function arc(r, a0, a1) {
        const sw = ((a1 - a0) % 360 + 360) % 360, p0 = P(a0, r), p1 = P(a1, r);
        return `M${p0[0]} ${p0[1]}A${f1(r)} ${f1(r)} 0 ${sw > 180 ? 1 : 0} 0 ${p1[0]} ${p1[1]}`;
      }
      const tangent = (deg) => { deg = (deg % 360 + 360) % 360; return deg < 180 ? 90 - deg : 270 - deg; };
      const text = (str, x, y, cls, parent, extra) => S('text', { x: f1(x), y: f1(y), class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...extra }, parent, str);
      const [gBack, gRings, gMid, gTrace, gBodies, gSel, gOut] = Array.from({ length: 7 }, () => S('g', null, svg));

      // 二分二至的十字轴，把图分成四季
      [0, 90, 180, 270].forEach((a) => line(P(a, sunR + (mini ? 3 : 7)), P(a, R), 'lc', gBack));

      if (!mini) {
        // 每年都会经过的五个日子：五条径向虚线
        SPOKES.forEach((an) => {
          const a = helio(utc('2021-' + an.md)), c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
          line(P(a, rIn - step * 0.55), P(a, R - band), 'lb dash', gBack);
          line(P(a, R), P(a, R + (big ? 9 : 5)), 'la', gOut);
          const q = P(a, R + (big ? 15 : 9)), mid = Math.abs(c) <= 0.25;
          const anchor = mid ? (c > 0 ? 'start' : 'end') : c > 0 ? 'start' : 'end';
          const dy = mid ? (sn > 0 ? -6 : 8) : (sn > 0.5 ? -3 : sn < -0.5 ? 4 : 0), dx = mid ? (c > 0 ? 11 : -11) : 0;
          const t = S('text', { x: f1(q[0] + dx), y: f1(q[1] + dy), class: 't-spoke', 'text-anchor': anchor, 'dominant-baseline': 'central' }, gOut);
          if (big) S('tspan', { class: 'n' }, t, `${Number(an.md.slice(0, 2))}·${Number(an.md.slice(3))} `);
          S('tspan', null, t, an.label);
        });
        // 日历尺：一天一格，一月一条分界
        S('circle', { cx, cy, r: f1(R), class: 'la' }, gBack);
        S('circle', { cx, cy, r: f1(R - band), class: 'lb' }, gBack);
        let ticks = '', div = '';
        for (let d = 0; d < 365; d++) {
          const ms = Date.UTC(2021, 0, 1 + d), dom = new Date(ms).getUTCDate(), a = helioT(ms);
          if (dom === 1) { const m0 = P(a, R), m1 = P(a, R - band); div += `M${m0[0]} ${m0[1]}L${m1[0]} ${m1[1]}`; continue; }
          const major = dom === 11 || dom === 21, len = band * (major ? 0.42 : 0.2);
          if (phone && !major && dom % 2 === 0) continue;
          const t0 = P(a, R), t1 = P(a, R - len); ticks += `M${t0[0]} ${t0[1]}L${t1[0]} ${t1[1]}`;
        }
        S('path', { d: ticks, class: 'lb' }, gBack);
        S('path', { d: div, class: 'la' }, gBack);
        for (let m = 0; m < 12; m++) {
          const am = helioT(Date.UTC(2021, m, 1) + new Date(Date.UTC(2021, m + 1, 0)).getUTCDate() * DAY / 2);
          const pm = P(am, R - band * (phone ? 0.56 : 0.63));
          text(phone ? String(m + 1) : `${m + 1}月`, pm[0], pm[1] + 0.3, 't-month', gBack, phone ? null : { transform: `rotate(${f1(tangent(am))} ${pm[0]} ${pm[1]})` });
        }
      } else {
        S('circle', { cx, cy, r: f1(R), class: 'lb' }, gBack);
        let mt = '';
        for (let m = 0; m < 12; m++) { const a = helioT(Date.UTC(2021, m, 1)), u0 = P(a, R), u1 = P(a, R - (lab ? 5 : 3)); mt += `M${u0[0]} ${u0[1]}L${u1[0]} ${u1[1]}`; }
        S('path', { d: mt, class: 'lb' }, gBack);
      }

      // 二分二至的名字，写在尺外
      if (!mini || lab) {
        const off = big ? 15 : phone ? 11 : 13;
        [[90, '冬至', '12·21'], [180, '春分', '3·20'], [270, '夏至', '6·21'], [0, '秋分', '9·23']].forEach(([a, name, date]) => {
          const p = P(a, R + off), up = a === 90 ? -1 : 1;
          if (a === 90 || a === 270) {
            const t = text(name, p[0], p[1] + up, 't-card', gOut);
            if (big) { t.setAttribute('text-anchor', 'end'); t.setAttribute('x', f1(p[0] + 12)); text(date, p[0] + 17, p[1] + up, 't-card-d', gOut, { 'text-anchor': 'start' }); }
          } else if (big) {
            const side = a === 180 ? -1 : 1, anchor = { 'text-anchor': a === 180 ? 'end' : 'start' };
            text(name, p[0] + side * 6, p[1] - 8, 't-card', gOut, anchor);
            text(date, p[0] + side * 8, p[1] + 9, 't-card-d', gOut, anchor);
          } else {
            const x = a === 180 ? cx - R - off + 2 : cx + R + off - 2, fs = lab ? 10 : 11.5;
            text(name[0], x, cy - fs * 0.6, 't-card', gOut, { 'letter-spacing': 0 });
            text(name[1], x, cy + fs * 0.6, 't-card', gOut, { 'letter-spacing': 0 });
          }
        });
      }

      // 年环：时间真的走过的部分是实线，认识之前和今天之后是虚线
      for (let y = Y0; y <= Y1; y++) {
        const r = rOf(y), j1 = Date.UTC(y, 0, 1), d31 = Date.UTC(y, 11, 31);
        const from = Math.max(j1, MET), to = Math.min(d31, TODAY);
        if (from <= j1 && to >= d31) S('circle', { cx, cy, r: f1(r), class: 'ring' }, gRings);
        else {
          if (from > j1) S('path', { d: arc(r, helioT(j1), helio(from)), class: 'ring off' }, gRings);
          if (to > from) S('path', { d: arc(r, helio(from), to >= d31 ? helioT(d31 + DAY) : helio(to)), class: 'ring' }, gRings);
          if (to < d31) S('path', { d: arc(r, helio(Math.max(to, j1)), helioT(d31 + DAY)), class: 'ring off' }, gRings);
        }
        // 年份写在 6 点钟方向；手机上只标首尾和每五年
        if (!mini && (big || y === Y0 || y === Y1 || ((y - Y0) % 5 === 0 && Y1 - y > 1))) {
          const py = P(270, r);
          text(phone ? String(y).slice(2) : String(y), py[0], py[1] + 0.3, 't-year halo', gOut);
        }
      }

      // 太阳，以及围着它的四季
      if (!mini) [[135, '冬'], [225, '春'], [315, '夏'], [45, '秋']].forEach(([a, name]) => { const p = P(a, rIn * (phone ? 0.52 : 0.56)); text(name, p[0], p[1], 't-season', gMid); });
      S('circle', { cx, cy, r: f1(sunR + (mini ? 2.2 : 3.5)), class: 'sun-ring' }, gMid);
      S('circle', { cx, cy, r: sunR, class: 'sun' }, gMid);

      // 认识、在一起、结婚：各在自己那一年的环上
      if (!mini) [site.met, site.together, site.married].filter(Boolean).forEach((d) => {
        const ms = utc(d), p = P(helio(ms), rOf(yearOf(ms))), k = big ? 3.6 : 3;
        S('path', { d: `M${p[0]} ${f1(p[1] - k)}L${f1(p[0] + k)} ${p[1]}L${p[0]} ${f1(p[1] + k)}L${f1(p[0] - k)} ${p[1]}Z`, class: 'evt' }, gMid);
      });

      /** 一个天体的记号，画进 g */
      function mark(g, b, r) {
        const [x, y] = [b.x, b.y];
        if (mini) return void S('circle', { cx: x, cy: y, r }, g);
        if (b.role === 'guest') {          // 路过的小天体：尾巴背向太阳
          const t0 = P(b.a, b.r + r * 0.6 + 2), t1 = P(b.a, b.r + r * 0.6 + 8), u0 = P(b.a + 80 / b.r, b.r + r * 0.6 + 1.5), u1 = P(b.a + 190 / b.r, b.r + r * 0.6 + 5.5), v0 = P(b.a - 80 / b.r, b.r + r * 0.6 + 1.5), v1 = P(b.a - 190 / b.r, b.r + r * 0.6 + 5.5);
          S('circle', { cx: x, cy: y, r: f1(r * 0.72), class: 'f' }, g);
          S('path', { d: `M${t0[0]} ${t0[1]}L${t1[0]} ${t1[1]}M${u0[0]} ${u0[1]}L${u1[0]} ${u1[1]}M${v0[0]} ${v0[1]}L${v1[0]} ${v1[1]}`, class: 'tail' }, g);
        } else if (b.role === 'him') S('circle', { cx: x, cy: y, r, class: 'f' }, g);
        else {
          const q = r + 0.35;
          S('circle', { cx: x, cy: y, r: f1(q), class: 'o' }, g);
          if (b.role === 'both') S('path', { d: `M${x} ${f1(y - q)}A${f1(q)} ${f1(q)} 0 0 0 ${x} ${f1(y + q)}Z`, class: 'f' }, g);
        }
      }

      const ta = helio(TODAY), tr = rOf(yearOf(TODAY)), tp = P(ta, tr);          // 今日
      // 信
      const bodies = letters.map((l, i) => {
        const a = geo[i].a, r = rOf(l.year), xy = P(a, r);
        const b = { no: l.no, ms: geo[i].ms, a, r, x: xy[0], y: xy[1], role: roleOf(l), label: null };
        mark(S('g', { class: 'body', style: `--i:${i}` }, gBodies), b, dotR);
        return b;
      });
      if (big) bodies.forEach((b, i) => {
        // 编号写在前进方向一侧；同一环上紧跟着另一封时写在后面
        let lead = Math.hypot(b.x - tp[0], b.y - tp[1]) > 30;      // 「今日」两个字写在今天的前方，编号让到后面
        bodies.forEach((o) => { if (o !== b && o.r === b.r) { const da = ((o.a - b.a) % 360 + 360) % 360; if (da > 0 && da * Math.PI / 180 * b.r < 30) lead = false; } });
        const wide = b.no > 9, dpx = dotR + (Math.hypot(b.x - tp[0], b.y - tp[1]) < dotR + 7 ? 13 : 7) + (wide ? 6 : 3.4), q = P(b.a + (dpx / b.r) * 180 / Math.PI * (lead ? 1 : -1), b.r);
        b.label = text(String(b.no), q[0], q[1] + 0.4, 't-num halo', gBodies, { style: `--i:${i}` });
      });

      let todayAt = null;
      if (!mini) {
        const gT = S('g', { class: 'today' }, gBodies);
        // 今天正好有一封信（或刚写完）时，⊕ 变成套住它的一个准星
        const on = bodies.some((b) => Math.hypot(b.x - tp[0], b.y - tp[1]) < dotR + 7);
        const k = on ? dotR + (big ? 5.5 : 4) : big ? 4.8 : 4, k0 = on ? k - 2 : 0, k1 = on ? k + (big ? 3 : 2) : k;
        if (!still) S('circle', { cx: tp[0], cy: tp[1], r: k, class: 'pulse' }, gT);
        S('circle', { cx: tp[0], cy: tp[1], r: k, class: on ? 'open' : null }, gT);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => line([f1(tp[0] + dx * k0), f1(tp[1] + dy * k0)], [f1(tp[0] + dx * k1), f1(tp[1] + dy * k1)], null, gT));
        if (big) { const tq = P(ta + ((k1 + 17) / tr) * 180 / Math.PI, tr); text('今日', tq[0], tq[1], 't-today halo', gT); }
        todayAt = { x: tp[0], y: tp[1] };
      }

      // 前进方向
      if (big) {
        const rr = R + 12, e = P(212, rr), tl = P(208.8, rr + 3.2), trr = P(208.8, rr - 3.2);
        S('path', { d: arc(rr, 198, 212), class: 'la' }, gOut);
        S('path', { d: `M${tl[0]} ${tl[1]}L${e[0]} ${e[1]}L${trr[0]} ${trr[1]}`, class: 'la' }, gOut);
      }

      /** 从 a 那天到 b 那天连续扫过的轨迹：中间每满一年就是一整圈 */
      function tracePath(a, b) {
        const a0 = helio(a), base = ((helio(b) - a0) % 360 + 360) % 360, days = (b - a) / DAY;
        const laps = Math.max(0, Math.round((days - base / 360 * 365.2422) / 365.2422)), total = base + 360 * laps;
        const r0 = rOf(yearOf(a)), r1 = rOf(yearOf(b)), n = Math.max(2, Math.ceil(total / 1.5));
        let d = '';
        for (let i = 0; i <= n; i++) { const t = i / n, pt = P(a0 + total * t, r0 + (r1 - r0) * t); d += (i ? 'L' : 'M') + pt[0] + ' ' + pt[1]; }
        return d;
      }
      function trace(a, b, animate) {
        if (b - a < DAY) return;
        const path = S('path', { d: tracePath(a, b), class: 'sel-trace' }, gTrace);
        if (animate && !still && path.getTotalLength) {
          const len = path.getTotalLength();
          path.style.strokeDasharray = len; path.style.setProperty('--len', len); path.classList.add('draw');
        }
      }
      let current = null;
      /** 选中一封：它变成琥珀色，外圈读出日期，并画出自上一封以来走过的弧。no 为空 = 今日（自最新一封走到今天的弧） */
      function select(no, animate) {
        gSel.textContent = ''; gTrace.textContent = '';
        bodies.forEach((b) => { if (b.label) b.label.classList.toggle('is-sel', b.no === no); });
        current = no || null;
        if (!no) {                           // 今日：自最新一封走到今天的弧；今天正是它那一天，就画它自己走过的那一段
          const n = bodies.length, last = bodies[n - 1];
          if (!mini && last) { if (TODAY - last.ms >= DAY) trace(last.ms, TODAY, false); else trace(n > 1 ? bodies[n - 2].ms : MET, last.ms, false); }
          return;
        }
        const b = bodies[no - 1], prev = no > 1 ? bodies[no - 2] : null;
        trace(prev ? prev.ms : MET, b.ms, animate);
        const pp = prev ? [prev.x, prev.y] : P(helio(MET), rOf(Y0));
        S('circle', { cx: pp[0], cy: pp[1], r: f1(dotR + (mini ? 2.2 : 3.2)), class: 'prev-dot' }, gSel);
        if (!mini) {
          const tA = P(b.a, R + 1), tB = P(b.a + 0.9, R + 7), tC = P(b.a - 0.9, R + 7);
          line(P(b.a, b.r + dotR + 5), P(b.a, R - band), 'sel-line', gSel);
          S('path', { d: `M${tA[0]} ${tA[1]}L${tB[0]} ${tB[1]}L${tC[0]} ${tC[1]}Z`, class: 'sel-tick' }, gSel);
        }
        S('circle', { cx: b.x, cy: b.y, r: f1(dotR + (mini ? 3.4 : 5)), class: 'sel-halo' }, gSel);
        mark(S('g', { class: 'body sel' }, gSel), b, dotR + (mini ? 0.9 : 0.6));
      }
      function nearest(clientX, clientY) {
        const rc = svg.getBoundingClientRect(), x = (clientX - rc.left) * (W / rc.width), y = (clientY - rc.top) * (H / rc.height);
        let best = null, bd = 1e9;
        bodies.forEach((b) => { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } });
        return { no: best.no, dist: bd, inside: Math.hypot(x - cx, y - cy) <= R + 24, today: todayAt ? Math.hypot(todayAt.x - x, todayAt.y - y) : 1e9 };
      }
      select(opt.sel || null, false);
      return { svg, select, nearest, phone, get current() { return current; } };
    }

    /** 让一个容器里的图跟着它的尺寸重画 */
    const sizes = new WeakMap();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => entries.forEach((en) => {
      const el = en.target, key = `${el.clientWidth}x${el.clientHeight}`;
      if (!el.isConnected) return observer.unobserve(el);
      if (sizes.get(el) !== key) { sizes.set(el, key); el.redraw(); }
    })) : null;
    function keepDrawn(host, redraw) {
      host.redraw = redraw;
      sizes.set(host, `${host.clientWidth}x${host.clientHeight}`);
      redraw();
      if (observer) observer.observe(host);
    }

    // ───────────────────────── 歌 ─────────────────────────
    function playButton(letter) {
      if (!letter.song) return null;
      return h('button', { type: 'button', class: 'play', 'data-play': letter.no, 'aria-label': `播放《${letter.song.title}》`, 'aria-pressed': 'false',
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); player.toggle(letter); } }, icon(44, 44, PLAY));     // 只在点击里出声
    }
    function orbitDot(button, q) {          // 进度点绕着按钮逆时针公转
      const a = (90 + q * 360) * Math.PI / 180, prog = button.querySelector('.p-prog'), dot = button.querySelector('.p-dot');
      prog.setAttribute('stroke-dashoffset', f1(RING * (1 - q)));
      dot.setAttribute('cx', f1(22 + 19 * Math.cos(a))); dot.setAttribute('cy', f1(22 - 19 * Math.sin(a)));
    }
    const np = {
      el: h('aside', { class: 'np', 'aria-label': '正在播放' }),
      btn: h('button', { type: 'button', class: 'play', 'aria-label': '播放 / 暂停', 'aria-pressed': 'false', onclick: () => player.toggle() }, icon(44, 44, PLAY)),
      title: h('a', { class: 'np-t' }),
      sub: h('span', { class: 'np-s' }),
      time: h('span', { class: 'np-time' }),
      fill: h('i'),
    };
    np.el.append(h('span', { class: 'np-rule' }, np.fill), np.btn, h('span', { class: 'np-meta' }, np.title, np.sub), np.time);
    let strip = null;                       // 信页上那一行配乐的各个零件
    const clockOf = (st, letter) => (st.letter === letter ? `${fmt.clock(st.time)} / ${fmt.clock(st.duration)}` : `0:00 / ${letter.song.duration ? fmt.clock(letter.song.duration) : '–:––'}`);
    function tick(st) {
      const cur = st.letter, q = cur && st.duration ? Math.min(1, st.time / st.duration) : 0;
      root.querySelectorAll('[data-play]').forEach((b) => orbitDot(b, cur && String(cur.no) === b.dataset.play ? q : 0));
      orbitDot(np.btn, q);
      np.fill.style.width = `${q * 100}%`;
      if (cur) np.time.textContent = `${fmt.clock(st.time)} / ${fmt.clock(st.duration)}`;
      if (strip) {
        const mine = cur === strip.letter;
        strip.fill.style.width = strip.knob.style.left = `${mine ? q * 100 : 0}%`;
        strip.time.textContent = clockOf(st, strip.letter);
        strip.track.setAttribute('aria-valuenow', Math.round(mine ? q * 100 : 0));
      }
    }
    function paint(st) {
      const cur = st.letter;
      const flags = (el, mine) => {
        el.classList.toggle('is-loaded', mine); el.classList.toggle('is-playing', mine && st.playing);
        el.classList.toggle('is-loading', mine && st.loading); el.classList.toggle('is-error', mine && !!st.error);
        el.setAttribute('aria-pressed', String(mine && st.playing));
      };
      root.querySelectorAll('[data-play]').forEach((b) => flags(b, !!cur && String(cur.no) === b.dataset.play));
      flags(np.btn, !!cur);
      const here = ctx.page.letter;
      root.dataset.np = !cur ? 'off' : here === cur ? 'same' : 'on';
      if (cur) {
        np.title.textContent = st.error ? `《${cur.song.title}》放不出来，再点一次试试` : cur.song.title;
        np.title.href = cur.url;
        np.sub.textContent = `№ ${cur.no} ${cur.title}`;
      }
      if (strip) {
        strip.el.classList.toggle('is-loaded', cur === strip.letter);
        strip.note.textContent = cur === strip.letter && st.error ? '放不出来，再点一次试试' : cur === strip.letter && st.loading ? '正在取歌…' : '这封信的歌';
      }
      tick(st);
    }
    player.on('change', paint);
    player.on('time', tick);

    // ───────────────────────── 蓝晒 / 原色 ─────────────────────────
    let colour = false;
    try { colour = localStorage.getItem('f221:orbit:colour') === '1'; } catch { /* 存不了就不记 */ }
    function setColour(on) {
      colour = on;
      root.classList.toggle('in-colour', on);
      root.querySelectorAll('.cap-toggle').forEach((b) => { b.textContent = on ? '蓝晒' : '原色'; b.setAttribute('aria-pressed', String(on)); });
      try { localStorage.setItem('f221:orbit:colour', on ? '1' : '0'); } catch { /* 同上 */ }
    }
    const flip = (e) => { e.preventDefault(); setColour(!colour); };
    const capToggle = () => h('button', { type: 'button', class: 'cap-toggle', 'aria-pressed': String(colour), 'aria-label': '照片：蓝晒 / 原色', onclick: flip }, colour ? '蓝晒' : '原色');
    /** 封面缩略图，蓝晒 */
    const thumb = (letter, sizes, widths) => h('span', { class: 'cy' }, ctx.img(letter.cover, { sizes, widths }));

    /** 信里的照片（核心已经把它们整理成 <figure class="letter-figure">）：装进和封面一样的版框，
     *  默认蓝晒，带图注和「原色」。可以对同一个节点反复执行。 */
    function dress(el, letter) {
      let n = 0;
      el.querySelectorAll('figure.letter-figure').forEach((fig) => {
        const img = fig.querySelector('img');
        if (!img) return;
        n++;
        if (fig.classList.contains('o-fig')) return;
        fig.classList.add('o-fig');
        const w = Number(img.getAttribute('width')), ht = Number(img.getAttribute('height'));
        if (w && ht) fig.style.setProperty('--ar', f1(w / ht));
        const cy = h('span', { class: 'cy', onclick: flip });
        img.replaceWith(cy); cy.append(img);
        fig.append(h('figcaption', { class: 'o-cap' }, h('span', {}, h('b', {}, `图 ${letter.no}·${n}`), fig.classList.contains('is-gif') ? '动图' : null), capToggle()));
      });
      // 卡片背面那张手写的照片：同样的版框。点卡片是翻面，所以原色只放在图注里的那个钮上
      el.querySelectorAll('.flip-card-back img').forEach((img) => {
        n++;
        if (img.parentElement.classList.contains('cy')) return;
        const cy = h('span', { class: 'cy' });
        img.replaceWith(cy); cy.append(img);
        cy.after(h('div', { class: 'o-cap' }, h('span', {}, h('b', {}, `图 ${letter.no}·${n}`), '手写的那一面'), capToggle()));
      });
      // 整段都是西文的段落交给拉丁字体（引号、撇号才不会占一个汉字宽）
      el.querySelectorAll('p, li, blockquote, h3, h4, h5').forEach((p) => {
        const t = p.textContent.trim();
        if (t.length > 3 && !p.lang && !p.querySelector('p, img') && t.replace(/[\x00-ɏ‐-›]/g, '').length === 0) p.lang = 'en';
      });
    }

    // ───────────────────────── 外壳 ─────────────────────────
    const main = h('main', { class: 'view', tabindex: '-1' });
    const hunger = ui.hunger();
    const foot = h('footer', { class: 'colophon' },
      h('p', { class: 'hunger', 'data-level': hunger.level }, hunger.text),
      ui.switcher(),
      h('p', { class: 'credit' }, '© 2016 – 2026 Fan & Wan'));
    root.replaceChildren(main, foot, np.el);
    root.classList.toggle('still', still);
    root.classList.toggle('in-colour', colour);
    root.dataset.np = 'off';

    // ───────────────────────── 首页 ─────────────────────────
    let home = null;
    function buildHome() {
      const chartHost = h('div', { class: 'chart' }), readout = h('div', { class: 'readout', 'aria-live': 'polite' }), eph = h('div', { class: 'eph' });
      const sort = h('button', { type: 'button', class: 'sort', onclick: () => { desc = !desc; table(); } });
      let chart = null, sel = null, desc = true, touch = env.touch, intro = !still;
      const count = (role) => letters.filter((l) => roleOf(l) === role).length;
      const li = (svg, label, n) => h('li', {}, svg, label, n != null && h('b', {}, `${n} 封`));
      const legend = h('ul', { class: 'legend' },
        li(icon(12, 12, GLYPH.him, 'g'), '他 Pikajay', count('him')),
        li(icon(12, 12, GLYPH.her, 'g'), '她 Pikachi', count('her')),
        count('both') ? li(icon(12, 12, GLYPH.both, 'g'), '合写', count('both')) : null,
        count('guest') ? li(icon(12, 12, GLYPH.guest, 'g'), '访客', count('guest')) : null,
        li(icon(14, 14, '<circle cx="7" cy="7" r="4.6" class="s"/><path d="M2.4 7h9.2M7 2.4v9.2" class="s"/>', 'g'), '今日'),
        li(icon(14, 14, '<path d="M7 3.2L10.8 7 7 10.8 3.2 7z" class="s"/>', 'g'), '认识 · 在一起 · 结婚'),
        li(icon(14, 14, '<path d="M0 7h14" class="s" stroke-dasharray="1.2 3"/>', 'g'), '每年都会经过的五个日子'),
        li(icon(14, 14, '<path d="M1 9.5A7 7 0 0 1 13 9.5" class="s"/>', 'g sunny'), '自上一封走过的弧'));
      const tilt = letters.byNo(29) && /绕日/.test(letters.byNo(29).title) ? letters.byNo(29) : null;
      const el = h('div', { class: 'home' },
        h('section', { class: 'chartcol', 'aria-label': '绕日图' }, h('div', { class: 'chartwrap' },
          h('header', { class: 'masthead' },
            h('h1', { lang: 'en' }, site.title),
            h('p', { class: 'plate-title' }, '绕日图'),
            h('p', { class: 'plate-no' }, '图版 I'),
            h('p', { class: 'plate-desc' }, `${letters.length} 封信的日心轨道`, h('br'), h('span', {}, `${Y0} – ${Y1}`))),
          chartHost,
          h('p', { class: 'chartnote' }, h('span', {}, '自黄道北极俯视，逆时针前进。'), h('span', {}, '冬至在正上，1 月 1 日在其左约 11°。'), h('span', {}, `年环由外向内：${Y0} → ${Y1}。`)),
          tilt && h('figure', { class: 'tilt' },
            icon(64, 64, '<path d="M4 32h56M32 5v54" class="h2" stroke-dasharray="1 3"/><circle cx="32" cy="32" r="13" class="h1"/><path d="M21.2 56.8L42.8 7.2M32 13A19 19 0 0 1 39.6 14.6" class="h1"/><ellipse cx="32" cy="32" rx="13" ry="3.4" class="h2" transform="rotate(-23.5 32 32)"/>'),
            h('figcaption', {}, h('b', {}, '23.5°'), '地球自转倾角，', h('br'), '“撞出了春夏秋冬”。', h('a', { href: tilt.url }, `№ ${tilt.no}`)))),
          legend,
          readout),
        h('section', { class: 'tablecol', 'aria-label': '星历表' },
          h('header', { class: 'eph-head' }, h('h2', {}, '星历表'), h('p', {}, `一行一封。T+ 为自认识那天（${dots(site.met)}）起的整日数。`), sort),
          eph));

      function today() {
        const last = letters.latest, lp = lapOf(TODAY), d = site.today.date, away = Math.round((TODAY - geo[last.index].ms) / DAY);
        readout.replaceChildren(h('div', { class: 'ro ro-today' },
          h('p', { class: 'ro-kicker' }, h('strong', {}, '今日读数'), h('span', {}, `${dots(d)} ${fmt.date(d, 'weekday')}`),
            h('span', { class: 'ro-tip' }, touch ? '点图上任何地方，会落到最近的一封信上。' : '把指针移到图上的点或右表的行，在此读出那封信。')),
          h('dl', { class: 'strip' },
            cell('自认识', [h('span', { class: 'tp' }, 'T+'), String(site.today.days.met), h('i', {}, 'd')], `${dots(site.met)} 起`),
            lp && cell('圈次', `第 ${lp.n} 圈`, `本圈已走 ${lp.deg}°`),
            seasonCell(d),
            h('div', { class: 'ro-new' }, h('dt', {}, '距上一封信'), h('dd', {}, String(away), h('i', {}, 'd')),
              h('small', {}, h('a', { href: last.url }, `№ ${last.no} ${last.title} `, icon(16, 10, ARROW)))))));
      }
      function letterCard(l) {
        const stepper = (dir, to) => h('button', { type: 'button', class: 'step', 'aria-label': dir < 0 ? '上一封' : '下一封', disabled: !to, onclick: () => to && setSel(to.no) },
          icon(10, 16, `<path d="${dir < 0 ? 'M8 2L2 8l6 6' : 'M2 2l6 6-6 6'}" fill="none" stroke="currentColor" stroke-width="1.2"/>`));
        readout.replaceChildren(h('div', { class: 'ro ro-letter' + (l.cover ? '' : ' no-thumb') },
          l.cover && h('a', { class: 'ro-thumb', href: l.url, tabindex: '-1', 'aria-hidden': 'true' }, thumb(l, '140px', [480])),
          h('div', { class: 'ro-main' },
            h('p', { class: 'ro-kicker' }, h('span', {}, `№ ${l.no}`), h('span', {}, dots(l.date)), h('span', {}, `T+${l.days.met} d`), h('i', { class: 'brk' }),
              h('span', {}, glyph(l), ' ', names(l)), season(l.date) && h('span', {}, season(l.date)),
              h('button', { type: 'button', class: 'ro-reset', onclick: () => setSel(null) }, '今日')),
            h('a', { class: 'ro-title', href: l.url, lang: latin(l.title) ? 'en' : null }, l.title),
            l.song && h('p', { class: 'ro-sl', lang: latin(l.song.title) ? 'en' : null }, h('em', { lang: 'zh' }, '曲'), l.song.title),
            l.quote && h('p', { class: 'ro-quote' }, `“${l.quote}”`)),
          h('div', { class: 'ro-actions' },
            stepper(-1, l.prev),
            l.song ? h('div', { class: 'ro-song' }, playButton(l), h('span', {}, h('em', {}, '曲'), l.song.title)) : h('div', { class: 'ro-song' }),
            h('a', { class: 'btn', href: l.url }, '读这封信 ', icon(16, 10, ARROW)),
            stepper(1, l.next))));
        paint(player.state);
      }
      function table() {
        const rows = [h('div', { class: 'row-h', 'aria-hidden': 'true' }, ...['年', '№', '月·日', 'T+', '', '题', '曲'].map((t) => h('span', {}, t)))];
        const years = []; for (let y = Y0; y <= letters.latest.year; y++) years.push(y);
        if (desc) years.reverse();
        years.forEach((y) => {
          const list = letters.filter((l) => l.year === y);
          if (desc) list.reverse();
          if (!list.length) return rows.push(h('div', { class: 'row-none' }, h('span', { class: 'c-y' }, y), h('em', {}, '没有信')));
          list.forEach((l, i) => {
            const a = h('a', { class: 'row' + (i ? '' : ' y1'), href: l.url, 'data-no': l.no, 'data-quiet': l.quiet || null },
              h('span', { class: 'c-y' }, i ? '' : y),
              h('span', { class: 'c-title', lang: latin(l.title) ? 'en' : null }, l.title),
              h('span', { class: 'c-a' }, glyph(l)),
              h('span', { class: 'c-meta' },
                h('span', { class: 'c-n' }, h('span', { class: 'lbl' }, '№ '), l.no),
                h('span', { class: 'c-d' }, md(l.date)),
                h('span', { class: 'c-t' }, h('span', { class: 'lbl' }, 'T+'), l.days.met),
                h('span', { class: 'c-song', lang: l.song && latin(l.song.title) ? 'en' : null }, l.song && h('span', { class: 'lbl' }, '曲 '), l.song ? l.song.title : '')));
            a.addEventListener('pointerenter', (e) => { router.prefetch(l.url); if (e.pointerType === 'mouse') setSel(l.no); });
            a.addEventListener('touchstart', () => router.prefetch(l.url), { passive: true });
            a.addEventListener('focus', () => setSel(l.no));
            rows.push(a);
          });
        });
        eph.replaceChildren(...rows);
        sort.replaceChildren(desc ? '由近及远' : '由远及近', icon(12, 14, `<path d="${desc ? 'M6 1v12M2 9l4 4 4-4' : 'M6 13V1M2 5l4-4 4 4'}" fill="none" stroke="currentColor"/>`));
        sort.setAttribute('aria-label', `排序：${desc ? '由近及远' : '由远及近'}，点一下反过来`);
        markRow();
      }
      const rowOf = (no) => eph.querySelector(`.row[data-no="${no}"]`);
      function markRow() { eph.querySelectorAll('.row.is-sel').forEach((r) => r.classList.remove('is-sel')); if (sel) { const r = rowOf(sel); if (r) r.classList.add('is-sel'); } }
      function setSel(no, animate = true) {
        no = no && letters.byNo(no) ? Number(no) : null;
        if (no === sel) return;
        sel = no;
        if (chart) chart.select(sel, animate);
        markRow();
        if (sel) letterCard(letters.byNo(sel)); else today();
      }
      function draw() {
        chart = makeChart(chartHost, { sel, intro });
        intro = false;
        if (!chart) return;
        const svg = chart.svg;
        svg.addEventListener('pointerdown', (e) => { touch = e.pointerType !== 'mouse'; });
        svg.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const hit = chart.nearest(e.clientX, e.clientY);
          svg.style.cursor = hit.dist < 15 ? 'pointer' : '';
          if (hit.dist < 15) setSel(hit.no);
        });
        svg.addEventListener('click', (e) => {
          const hit = chart.nearest(e.clientX, e.clientY);
          if (touch || chart.phone) { if (hit.inside) setSel(hit.no); }       // 手指点不准：落到最近的一封上
          else if (hit.dist < 15) router.go(letters.byNo(hit.no).url);
          else if (hit.today < 14) setSel(null);
        });
      }
      table(); today();
      return {
        el,
        /** 首页进了文档之后：画图，并把刚读过的那封信带到眼前 */
        enter(route) {
          keepDrawn(chartHost, draw);
          const last = router.lastRead, read = last && (last.no ? letters.byNo(last.no) : letters.byUrl(last.url || last));
          if (!read) return undefined;
          setSel(read.no, false);
          window.scrollTo(0, route.scrollY || 0);
          const row = rowOf(read.no), seen = (r) => r.bottom > 80 && r.top < window.innerHeight - 80;
          if (row && !seen(readout.getBoundingClientRect()) && !seen(row.getBoundingClientRect())) row.scrollIntoView({ block: 'center' });
          return false;                     // 滚动位置我们自己管好了
        },
        step(d) { const n = sel ? sel + d : d > 0 ? 1 : letters.length; if (letters.byNo(n)) setSel(n); },
        reset() { setSel(null); },
      };
    }

    // ───────────────────────── 信 ─────────────────────────
    function arcIcon(dir) {                 // 逆行 = 顺时针，顺行 = 逆时针
      return h('span', { class: 'arc' }, icon(40, 40, `<g${dir < 0 ? ' transform="translate(40 0) scale(-1 1)"' : ''}><path d="M31.26 26.5A13 13 0 1 0 8.4 25.9"/><path class="f" d="M10.9 30.4L11.1 23.3L4.9 26.9Z"/></g><circle cx="20" cy="20" r="1.8" class="f"/>`));
    }
    const backLink = (cls, ...kids) => h('a', { class: cls, href: '/', 'data-back': true, onclick: (e) => { if (router.home && !mod(e)) { e.preventDefault(); router.home(); } } }, ...kids);
    const TARGET = '<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3.5"/><circle cx="10" cy="10" r="1.1" class="f"/>';

    function letterView({ letter, contentEl }) {
      const g = geo[letter.index], lp = lapOf(g.ms), gap = gapOf(letter), prev = letter.prev, T = letter.days.met;
      const loc = h('div', { class: 'loc' });
      const cover = letter.cover && h('figure', { class: 'plate', style: letter.cover.w / letter.cover.h < 1.2 ? `--ar:${f1(letter.cover.w / letter.cover.h)}` : null },
        h('span', { class: 'cy', onclick: flip }, ctx.img(letter.cover, { sizes: '(min-width: 1200px) 400px, (min-width: 660px) 600px, 100vw', lazy: false, lqip: true, alt: `《${letter.title}》的封面` })),
        h('figcaption', { class: 'o-cap' }, h('span', {}, h('b', {}, `图 ${letter.no}`), '封面'), capToggle()));

      let song = null;
      if (letter.song) {
        const fill = h('span', { class: 'fill' }), knob = h('span', { class: 'knob' }), time = h('span', { class: 'song-time' }), note = h('span', { class: 'song-k' }, '这封信的歌');
        const track = h('div', { class: 'song-track', role: 'slider', tabindex: '0', 'aria-label': '播放进度', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, h('span', { class: 'ticks' }), fill, knob);
        const seekTo = (q) => { const st = player.state; if (st.letter === letter && st.duration) player.seek(Math.max(0, Math.min(1, q)) * st.duration); };
        track.addEventListener('click', (e) => { const rc = track.getBoundingClientRect(); seekTo((e.clientX - rc.left) / rc.width); });
        track.addEventListener('keydown', (e) => { const st = player.state, d = { ArrowRight: 5, ArrowLeft: -5 }[e.key]; if (d && st.letter === letter) { e.preventDefault(); player.seek(st.time + d); } });
        song = h('div', { class: 'song' }, playButton(letter),
          h('div', { class: 'song-meta' }, note, h('span', { class: 'song-t', lang: latin(letter.song.title) ? 'en' : null }, letter.song.title, letter.song.artist && h('small', {}, letter.song.artist))),
          track, time);
        strip = { letter, el: song, fill, knob, time, note, track };
      } else strip = null;

      function pn(q, dir) {
        const label = h('span', { class: 'dir' }, dir < 0 ? '逆行 · 上一封' : '顺行 · 下一封');
        if (!q) return h('span', { class: 'none' }, arcIcon(dir), label, h('span', { class: 'ttl' }, dir < 0 ? '这是第一封，再往前就是认识之前了。' : '下一封还没写。'));
        const days = Math.abs(Math.round((geo[q.index].ms - g.ms) / DAY));
        // 上一封 / 下一封替换当前这条历史记录，所以后退总是回到图上
        return h('a', { href: q.url, rel: dir < 0 ? 'prev' : 'next', onclick: (e) => { if (!mod(e)) { e.preventDefault(); router.go(q.url, { replace: true }); } } },
          arcIcon(dir), label, h('span', { class: 'ttl', lang: latin(q.title) ? 'en' : null }, q.title), h('span', { class: 'gap' }, `№ ${q.no}　${dots(q.date)}　${days} d ${dir < 0 ? '前' : '后'}`));
      }

      dress(contentEl, letter);
      // 正文是 Jekyll 渲染好的那个活节点：搬进来，不克隆。它的祖先都没有 transform / filter。
      const body = h('article', { class: 'letter-body prose' }, contentEl);
      ctx.widgets.init(contentEl);

      const el = h('div', { class: 'letter', 'data-role': roleOf(letter), 'data-quiet': letter.quiet || null },
        h('header', { class: 'topbar' }, backLink('brand', site.title), backLink('back', icon(20, 20, TARGET), '回到绕日图')),
        h('div', { class: 'l-grid' },
          h('div', { class: 'l-head' },
            h('p', { class: 'kicker' }, h('span', {}, `第 ${letter.no} 封`, h('span', { class: 'of' }, ` / ${letters.length}`)), h('span', { class: 'bar' }),
              h('span', {}, glyph(letter), ' ', byline(letter)), letter.place && h('span', {}, `于 ${letter.place}`)),
            h('h1', { class: 'l-title' + (letter.title.length > 11 ? ' long' : '') + (latin(letter.title) ? ' lat' : ''), lang: latin(letter.title) ? 'en' : null }, letter.title)),
          h('dl', { class: 'l-data' },
            cell('自认识', [h('span', { class: 'tp' }, 'T+'), String(T), h('i', {}, 'd')], `${dots(site.met)} 起`),
            cell('日期', dots(letter.date), fmt.date(letter.date, 'weekday')),
            seasonCell(letter.date),
            cell('圈次', lp ? `第 ${lp.n} 圈` : '入轨前', lp ? `本圈已走 ${lp.deg}°` : '尚未绕日'),
            cell(prev ? '距上一封' : '距认识', [String(gap), h('i', {}, 'd')], prev ? `№ ${prev.no} 之后` : '第一封')),
          h('aside', { class: 'l-side' },
            loc,
            h('p', { class: 'cap' }, h('b', {}, '位置'), `　${letter.year} 年环，日心黄经 ${Math.round(g.a)}°。`, h('br'), `琥珀色弧线是${prev ? `自 № ${prev.no} 以来` : '自认识那天起'}走过的 ${gap} 天。`),
            cover,
            letter.quote && h('blockquote', { class: 'margin-q' }, h('span', {}, '摘句'), letter.quote)),
          song,
          body,
          h('p', { class: 'end' }, `T+${T} d`),
          h('nav', { class: 'pn', 'aria-label': '上一封、下一封、回到绕日图' }, pn(prev, -1), pn(letter.next, 1),
            backLink('pn-home', icon(20, 20, TARGET), h('span', {}, '回到绕日图')))));
      return { el, enter() { let first = true; keepDrawn(loc, () => { const c = makeChart(loc, { mini: true }); if (c) c.select(letter.no, first); first = false; }); } };
    }

    function lostView() {
      const loc = h('div', { class: 'loc' });
      const el = h('div', { class: 'letter lost' },
        h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '/' }, site.title), h('a', { class: 'back', href: '/' }, icon(20, 20, TARGET), '回到绕日图')),
        h('div', { class: 'lost-body' }, loc,
          h('p', { class: 'kicker' }, '404 · 轨道之外'),
          h('h1', { class: 'l-title' }, '这个位置上没有信'),
          h('p', { class: 'lost-p' }, `图上一共 ${letters.length} 封，都在各自的那一天。`),
          h('a', { class: 'btn', href: '/' }, '回到绕日图 ', icon(16, 10, ARROW))));
      return { el, enter() { keepDrawn(loc, () => makeChart(loc, { mini: true })); } };
    }

    // ───────────────────────── 路由 ─────────────────────────
    let first = true;
    function show(route) {
      const view = route.type === 'letter' ? letterView(route) : route.type === 'home' ? (home ||= buildHome()) : lostView();
      if (route.type !== 'letter') strip = null;
      main.replaceChildren(view.el);
      root.dataset.view = route.type;
      const handled = view.enter(route);
      paint(player.state);
      if (!first) main.focus({ preventScroll: true });
      first = false;
      return handled;
    }
    document.addEventListener('keydown', (e) => {
      if (mod(e) || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.closest && e.target.closest('.song-track'))) return;
      const view = root.dataset.view;
      if (view === 'home' && home && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { home.step(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); }
      else if (e.key === 'Escape') { if (view === 'home' && home) home.reset(); else if (router.home) router.home(); else router.back('/'); }
    });

    show(router.current);
    return { show };
  },
};
