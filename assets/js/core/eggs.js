// The site's own voice, and the small things hidden in it. Shared by every theme.
//
// The site has spoken once before, at the end of the 2021 letter 「两年不见，你还好吗」: it
// complained that after three happy years of being fed ("不停有人喂我吃东西") the two of them
// forgot it for two years, told 某万 off, and asked them to learn how to feed it.
// "Feeding" the site means publishing a new letter. Everything here is written in that voice:
// first person, cheeky, short, never sentimental.

import { daysBetween, dayStamp, el, pad } from './util.js';

// ------------------------------------------------------------------ hunger line

// How long since the newest letter → how hungry. The archive's own rhythm sets the scale:
// half of all gaps between letters are under 40 days, and the longest so far (2019-03-19 →
// 2021-07-04) is 838 days. The record is computed from the data, so a new one updates the text.
const HUNGER = [
  { upTo: 7, text: (n) => (n === 0 ? '今天刚吃过，嗝。说话好累，我去睡觉了。' : `${n} 天前刚吃过，嗝，还饱着。说话好累，我去睡觉了。`) },
  { upTo: 45, text: (n) => `上一顿是 ${n} 天前，还不饿。你们两个这次表现不错，哼。` },
  { upTo: 150, text: (n) => `已经 ${n} 天没吃东西了，肚子在叫。你们两个谁来喂一口？` },
  { upTo: Infinity, text: (n) => `${n} 天没人喂我，好气呀！再不喂我吃东西，我又要训人了。` },
];
const RECORD = (n, record) => `${n} 天！比上次那 ${record} 天还久，你们两个居然又把我忘了。哼，饿得不想说话。`;

/** The longest wait between two letters so far, in days. */
export function longestGap(letters) {
  let max = 0;
  for (let i = 1; i < letters.length; i++) max = Math.max(max, daysBetween(letters[i - 1].date, letters[i].date));
  return max;
}

/**
 * hunger(letters, today) → { days, level, text }
 *   days   whole days since the newest letter (0 on the day it was written)
 *   level  0 just fed · 1 not hungry · 2 getting hungry · 3 very hungry · 4 longer than ever before
 *   text   the line to show, already complete
 */
export function hunger(letters, today) {
  const latest = letters[letters.length - 1];
  if (!latest) return { days: 0, level: 0, text: '' };
  const days = Math.max(0, daysBetween(latest.date, today));
  const record = longestGap(letters);
  if (record > 0 && days > record) return { days, level: 4, text: RECORD(days, record) };
  const level = HUNGER.findIndex((h) => days <= h.upTo);
  return { days, level, text: HUNGER[level].text(days) };
}

// ------------------------------------------------------------------ formatters

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export const fmt = {
  /** date('2026-08-12', style):  'zh' 2026年8月12日 (default) · 'iso' 2026-08-12 · 'dot' 2026.08.12
   *                              'md' 8月12日 · 'weekday' 星期三 · 'year' 2026 */
  date(day, style = 'zh') {
    const [y, m, d] = String(day).slice(0, 10).split('-').map(Number);
    switch (style) {
      case 'iso': return `${y}-${pad(m)}-${pad(d)}`;
      case 'dot': return `${y}.${pad(m)}.${pad(d)}`;
      case 'md': return `${m}月${d}日`;
      case 'weekday': return WEEKDAYS[new Date(dayStamp(`${y}-${m}-${d}`)).getUTCDay()];
      case 'year': return String(y);
      default: return `${y}年${m}月${d}日`;
    }
  },
  /** season('2026-08-12') → '夏'. By the month, northern hemisphere, the way people speak of it:
   *  3–5 春 · 6–8 夏 · 9–11 秋 · 12–2 冬. Not the astronomical seasons: a letter written on 8 June
   *  that says 夏花烂漫 is a summer letter, although the solstice is two weeks away.
   *  Accepts 'YYYY-MM-DD' or a Date (its local month); anything else gives ''. */
  season(day) {
    const month = day instanceof Date ? day.getMonth() + 1 : Number(String(day).slice(5, 7));
    return month >= 1 && month <= 12 ? '冬冬春春春夏夏夏秋秋秋冬'[month - 1] : '';
  },
  /** days(4007) → '4007 天' the way the couple writes it (no thousands separator); days(null) → '' */
  days(n) { return n == null ? '' : `${n} 天`; },
  /** clock(241.6) → '4:01' */
  clock(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  },
};

// ------------------------------------------------------------------ switching themes

/** Leave for another theme: load this page again with ?theme=<id> (the boot script takes it from
 *  there). replace(), not assign(): changing clothes should not add a step to the Back button. */
export function switchTheme(id) {
  location.replace(`${location.pathname}?theme=${encodeURIComponent(id)}${location.hash}`);
}

/** The list of themes a reader can change to: <ul> with one "?theme=<id>" link per theme. The
 *  links are real links (they can be opened in a new tab or copied). */
function themeList(T, props) {
  const list = el('ul', props);
  for (const [id, name, , canDraw] of T.themes) {   // rows of the boot script: [id, name, dark, drawable, fonts]
    if (!canDraw && id !== T.id) continue;        // hidden or disabled themes only list themselves
    list.append(el('li', null, el('a', { href: `?theme=${encodeURIComponent(id)}`, 'data-theme-id': id, 'aria-current': id === T.id ? 'true' : null }, name)));
  }
  return list;
}

/** A plain click on a name reloads the current page under that theme. */
function pick(event) {
  const a = event.target.closest && event.target.closest('a[data-theme-id]');
  if (!a || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;   // new-tab clicks stay ordinary links
  event.preventDefault();
  switchTheme(a.dataset.themeId);
}

// One switcher is open at a time. The listeners that close it are on the document and are added
// once, however many switchers a theme makes (some make a new one with every view they draw).
let openNav = null;
let switchers = 0;
function setOpen(nav, open, refocus) {
  if (openNav && openNav !== nav) setOpen(openNav, false);
  const toggle = nav.querySelector('.theme-switcher-toggle');
  const list = nav.querySelector('ul');
  nav.toggleAttribute('data-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  list.hidden = !open;
  openNav = open ? nav : null;
  if (!open && refocus && nav.contains(document.activeElement)) toggle.focus();
}
function closeFromOutside(event) {
  if (!openNav) return;
  if (!openNav.isConnected) { openNav = null; return; }
  if (event.type === 'keydown') {
    if (event.key !== 'Escape') return;
    // Esc closes the list and nothing else: themes give Esc a meaning of their own (close the
    // letter, go back to the list), and that is not what a reader with a list open is asking for.
    event.preventDefault();
    event.stopImmediatePropagation();
    setOpen(openNav, false, true);
    return;
  }
  if (!openNav.contains(event.target)) setOpen(openNav, false);      // a press or the focus somewhere else
}

/**
 * switcher(T) → the control that changes theme. A theme places it in the top right corner of
 * every view; pressed, it opens a list of the themes. Unstyled on purpose: the theme decides how
 * it looks (the list is a small panel under the control).
 *
 *   <nav class="theme-switcher" aria-label="换一种读法">
 *     <button type="button" class="theme-switcher-toggle" aria-expanded="false" aria-controls="theme-switcher-1">
 *       <span class="theme-switcher-name">夜航</span><i aria-hidden="true"></i>
 *     </button>
 *     <ul id="theme-switcher-1" hidden>
 *       <li><a href="?theme=classic" data-theme-id="classic">旧版</a></li>
 *       <li><a href="?theme=drift" data-theme-id="drift" aria-current="true">夜航</a></li> …
 *     </ul>
 *   </nav>
 *
 * The button shows the name of the theme being worn; the <i> is there for the theme to draw a
 * mark that says "this opens". While it is open the nav has the attribute data-open, the button
 * says aria-expanded="true" and the list is not hidden. It closes on a second press, on Esc (the
 * focus goes back to the button; while a list is open Esc does nothing else, whatever the theme
 * uses that key for), and when a press or the focus lands outside it. A plain click
 * on a name reloads the current page under that theme.
 */
export function switcher(T) {
  const id = `theme-switcher-${++switchers}`;
  const name = (T.themes.find((t) => t[0] === T.id) || [])[1] || T.id;
  const toggle = el('button', { type: 'button', class: 'theme-switcher-toggle', 'aria-expanded': 'false', 'aria-controls': id },
    el('span', { class: 'theme-switcher-name' }, name), el('i', { 'aria-hidden': 'true' }));
  const nav = el('nav', { class: 'theme-switcher', 'aria-label': '换一种读法' }, toggle, themeList(T, { id, hidden: true }));
  toggle.addEventListener('click', () => setOpen(nav, !nav.hasAttribute('data-open')));
  nav.addEventListener('click', pick);
  if (switchers === 1) {
    document.addEventListener('pointerdown', closeFromOutside, true);
    document.addEventListener('focusin', closeFromOutside, true);
    window.addEventListener('keydown', closeFromOutside, true);       // on the way down, before any theme hears the key
  }
  return nav;
}

/**
 * The classic page is plain HTML with no theme code of its own, so the core gives it the way to
 * the other themes. Its top right corner already has a control that opens: the three lines of the
 * hamburger, on screen wherever a classic page has been scrolled to, and the drawer they open
 * (nav.sidebar). The names of the themes go there, as one row under the drawer's logo. Styled by
 * _scss/_theme-switcher.scss. Nothing else of the classic page is touched.
 *
 * Nothing is added where there is nothing to switch to: a browser too old for the new themes
 * (by 'old'), a page they cannot draw (by 'page'), a registry in which classic is the only theme.
 */
export function classicSwitcher(T) {
  if (T.id !== 'classic' || T.by === 'old' || T.by === 'page' || document.querySelector('.theme-switcher')) return null;
  const logo = document.querySelector('nav.sidebar > .textLogo');
  const nav = el('nav', { class: 'theme-switcher', 'aria-label': '换一种读法' }, themeList(T));
  if (!logo || nav.querySelectorAll('a').length < 2) return null;
  nav.addEventListener('click', pick);
  logo.after(nav);

  // The hamburger is a <label> for a hidden checkbox: a pointer and a finger can press it, a
  // keyboard could not reach it. With the names of the themes behind it, it has to be reachable:
  // Tab stops on it, Enter or Space opens the drawer and puts the focus on the first name, Esc
  // closes the drawer again.
  const burger = document.querySelector('label.sidebar-toggle-wrapper');
  const box = document.getElementById('sidebar-checkbox');
  if (burger && box) {
    const sync = () => burger.setAttribute('aria-expanded', String(box.checked));
    burger.tabIndex = 0;
    burger.setAttribute('role', 'button');
    burger.setAttribute('aria-label', '菜单');
    sync();
    box.addEventListener('change', sync);
    burger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      box.checked = !box.checked;
      sync();
      // (the drawer fades in: for a frame or two it is still hidden and cannot take the focus)
      const first = nav.querySelector('a');
      const reach = (tries) => { if (!box.checked) return; first.focus(); if (document.activeElement !== first && tries > 0) requestAnimationFrame(() => reach(tries - 1)); };
      if (box.checked) reach(30);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !box.checked) return;
      box.checked = false;
      sync();
      burger.focus();
    });
  }
  return nav;
}

// ------------------------------------------------------------------ console greeting

/** A few lines for whoever opens DevTools. Runs under every theme, classic included. */
export function greet(T, data) {
  try {
    const name = (T.themes.find((t) => t[0] === T.id) || [])[1] || T.id;
    const lines = ['诶，你居然翻到这里来了。'];
    if (data) {
      const born = data.site.born ? fmt.date(data.site.born, 'zh').replace(/\d+日$/, '') : '2016年9月';
      lines.push(`我是这个网站。${born}某万把我带到这个世界上，到今天一共吃了 ${data.letters.length} 封信。`);
      lines.push(hunger(data.letters, data.site.today.date).text);
    }
    lines.push(`今天穿的是「${name}」。在页面上敲 pi 看今天的 π。`);
    console.log(`%c221 FOREVER%c\n${lines.join('\n')}`, 'font: 700 16px/2 Georgia, serif; letter-spacing: .12em', 'font: 13px/1.7 system-ui, sans-serif');
  } catch { /* a greeting must never break anything */ }
}

// ------------------------------------------------------------------ key sequences

/**
 * Typing 221 anywhere (not in a form field) → the hidden sheet (below).
 * Typing pi → today's digits of π, shown discreetly for a few seconds.
 * Under every theme, classic included. Nothing is visible until used, and neither changes the theme:
 * that is what the row of names is for.
 */
export function keys(data) {
  let typed = '';
  let timer = 0;
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || !event.key || event.key.length !== 1) return;
    const t = event.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    typed = (typed + event.key.toLowerCase()).slice(-3);
    clearTimeout(timer);
    timer = setTimeout(() => { typed = ''; }, 1500);
    if (typed === '221') { typed = ''; openSheet(); }
    else if (typed.endsWith('pi')) { typed = ''; showPi(data); }
  });
}

// ------------------------------------------------------------------ the hidden sheet (221)

// A sheet of paper, the same under every theme. Nothing here comes from a theme and nothing of a
// theme gets in: these rules live in the sheet's own shadow root.
const SHEET_CSS = `
:host { all: initial; display: contents; }
dialog {
  position: fixed; inset: 0; box-sizing: border-box; width: auto; height: auto; max-width: none; max-height: none;
  margin: 0; border: 0; overflow: hidden; background: none; color: #2c2a26; color-scheme: light;
  padding: max(24px, 5vh, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(24px, 5vh, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  font: 17px/1.9 "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "Source Han Serif CN", STSong, "PingFang SC", "Microsoft YaHei", serif;
  -webkit-text-size-adjust: 100%; text-size-adjust: 100%;
}
dialog[open] { display: flex; align-items: center; justify-content: center; }
dialog::backdrop { background: rgba(22, 21, 19, .64); }
.paper {
  --w: min(100vw - 32px, 36em);
  box-sizing: border-box; display: flex; flex-direction: column;
  width: var(--w); max-width: 100%; min-height: min(100%, var(--w) * 1.414); max-height: 100%;
  background: #fbfaf6; border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .05), 0 1px 3px rgba(0, 0, 0, .18), 0 24px 60px rgba(0, 0, 0, .34);
}
.close {
  flex: none; align-self: flex-end; display: grid; place-items: center; box-sizing: border-box; width: 44px; height: 44px;
  margin: 0; padding: 0; border: 0; border-radius: 50%; background: none; color: #857f73; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.close svg { fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; }
.close:focus-visible { outline: 2px solid currentColor; outline-offset: -9px; color: #2c2a26; }
@media (hover: hover) { .close:hover { color: #2c2a26; } }
.text {
  flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  padding: .4em clamp(1.25em, 7vw, 3.4em) 3.2em; outline: 0; overflow-wrap: break-word; line-break: strict;
}
.text > :first-child { margin-top: 0; }
.text > :last-child { margin-bottom: 0; }
p, ul, ol, blockquote, pre, table, figure { margin: 0 0 1.15em; }
h1, h2, h3, h4, h5, h6 { margin: 1.8em 0 .7em; font-size: 1em; font-weight: 700; line-height: 1.45; }
h1 { font-size: 1.5em; }
h2 { font-size: 1.3em; }
h3 { font-size: 1.12em; }
ul, ol { padding-left: 1.6em; }
blockquote { padding-left: 1.1em; border-left: 2px solid #dcd7ca; color: #5d584e; }
blockquote > :last-child { margin-bottom: 0; }
a { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: .22em; }
img, video, iframe, .text svg { max-width: 100%; height: auto; }
hr { height: 0; margin: 2em 0; border: 0; border-top: 1px solid #dcd7ca; }
code, pre { font: .88em/1.6 ui-monospace, Menlo, Consolas, monospace; }
pre { overflow-x: auto; padding: .8em 1em; background: #f2efe7; }
table { display: block; overflow-x: auto; border-collapse: collapse; }
th, td { padding: .3em .7em; border-bottom: 1px solid #dcd7ca; text-align: left; }
@media (prefers-reduced-motion: no-preference) {
  dialog[open] .paper { animation: sheet-in .32s cubic-bezier(.2, .7, .2, 1) both; }
  dialog[open]::backdrop { animation: dim-in .32s ease-out both; }
}
@keyframes sheet-in { from { opacity: 0; transform: translateY(12px); } }
@keyframes dim-in { from { opacity: 0; } }
`;

/** While the sheet is open the page behind it stays where it is. The viewport takes its overflow
 *  from <html>, or from <body> when <html> leaves it at `visible`: the lock goes on whichever of
 *  the two it is, so nothing else about the page's layout changes. Returns the way to undo it. */
function lockScroll() {
  const html = document.documentElement;
  const style = getComputedStyle(html);
  const holder = document.body && style.overflowX === 'visible' && style.overflowY === 'visible' ? document.body : html;
  const before = [holder.style.overflow, html.style.scrollbarGutter];
  if (window.innerWidth > html.clientWidth) html.style.scrollbarGutter = 'stable';   // a scrollbar that takes room: keep its room
  holder.style.overflow = 'hidden';
  return () => { holder.style.overflow = before[0]; html.style.scrollbarGutter = before[1]; };
}

/**
 * What typing 221 opens: a sheet of paper in the middle of the dimmed page, holding whatever is
 * written in _includes/egg-221.md. Jekyll renders that file into <template id="egg-221"> on every
 * page; while the file is empty the sheet is empty.
 *
 * It must look the same under five themes and disturb none of them, so it keeps to itself:
 *   - a native modal <dialog> inside a shadow root: no stylesheet of the page reaches in, and
 *     SHEET_CSS does not leak out
 *   - hung on <html>, beside <body>: under a new theme everything in <body> except #theme-root
 *     is hidden, and what is inside #theme-root belongs to the theme
 *   - made when asked for, removed when closed: a page on which nobody typed 221 has none of it
 *
 * Closes with Esc, a click on the dimmed page, or the mark in its corner. While it is open the
 * page behind neither scrolls nor hears the keyboard (a theme's own Esc and arrow keys would act
 * on the page underneath); afterwards the focus is back where it was.
 * Returns the <dialog>, or null when it is already open or the browser cannot show one.
 */
export function openSheet() {
  const source = document.getElementById('egg-221');
  const host = el('div', { id: 'egg-221-sheet' });
  const text = el('article', { class: 'text', tabindex: '-1' });
  const close = el('button', {
    class: 'close', type: 'button', 'aria-label': '关闭',
    html: '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13"/></svg>',
  });
  const dialog = el('dialog', { lang: 'zh-Hans', 'aria-label': '221' }, el('div', { class: 'paper' }, close, text));
  if (!source || !source.content || !host.attachShadow || typeof dialog.showModal !== 'function' || document.getElementById(host.id)) return null;
  text.append(document.importNode(source.content, true));
  host.attachShadow({ mode: 'open' }).append(el('style', { text: SHEET_CSS }), dialog);

  const focused = document.activeElement;
  const unlock = lockScroll();
  const hush = (event) => event.stopPropagation();
  window.addEventListener('keydown', hush, true);
  const shut = () => { if (dialog.open) dialog.close(); };
  // A click on the dimmed page lands on the <dialog> itself, which covers the screen. It has to
  // begin there too: selecting text and letting go outside the sheet is not a click outside.
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (event) => { pressedOutside = event.target === dialog; });
  dialog.addEventListener('click', (event) => { if (event.target === dialog && pressedOutside) shut(); });
  close.addEventListener('click', shut);
  dialog.addEventListener('close', () => {
    window.removeEventListener('keydown', hush, true);
    unlock();
    host.remove();
    if (focused && focused !== document.body && focused.isConnected && typeof focused.focus === 'function') focused.focus({ preventScroll: true });
  });

  try {
    document.documentElement.append(host);
    dialog.showModal();
    text.focus({ preventScroll: true });   // the reader's arrow keys and space bar scroll the sheet; Tab goes to the mark
  } catch (err) {                          // whatever went wrong, the page must not stay locked and deaf
    window.removeEventListener('keydown', hush, true);
    unlock();
    host.remove();
    return null;
  }
  return dialog;
}

// ------------------------------------------------------------------ π

/**
 * `count` decimal digits of π starting at the `from`-th digit after the point (1-based).
 * Machin's formula on BigInt: a few milliseconds for the first few thousand digits.
 */
export function piDigits(from, count) {
  const B = BigInt;                                           // BigInt() calls, not 10n literals: old browsers can still parse this file
  const scale = B(10) ** B(from + count + 10);                // 10 guard digits
  const arctanInv = (x) => {                                  // arctan(1/x) · scale
    const x2 = B(x * x);
    let term = scale / B(x);
    let sum = B(0);
    for (let k = B(1), sign = B(1); term > B(0); k += B(2), sign = -sign) { sum += sign * (term / k); term /= x2; }
    return sum;
  };
  const pi = B(4) * (B(4) * arctanInv(5) - arctanInv(239));   // "3" followed by the decimals
  return pi.toString().slice(from, from + count);
}

/** The baby is 派派. Day N of being together gets the ten digits of π that start at decimal N. */
function showPi(data) {
  try {
    const n = data && data.site.today.days.together;
    if (!n) return;
    const digits = piDigits(n, 10).split('').join(' ');
    const host = document.documentElement.dataset.theme === 'classic' ? document.body : document.getElementById('theme-root');
    document.getElementById('egg-pi')?.remove();
    const note = el('div', {
      id: 'egg-pi', role: 'status',
      style: 'position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:2147483000;'
        + 'max-width:calc(100vw - 24px);box-sizing:border-box;padding:6px 10px;border:1px solid GrayText;border-radius:3px;'
        + 'font:12px/1.6 ui-monospace,Menlo,Consolas,monospace;color:CanvasText;background:Canvas;cursor:pointer',
    }, `在一起第 ${n} 天 · π 的小数点后第 ${n} 位起：${digits}`);
    note.addEventListener('click', () => note.remove());
    host.append(note);
    setTimeout(() => note.remove(), 9000);
  } catch { /* no BigInt, no π */ }
}
