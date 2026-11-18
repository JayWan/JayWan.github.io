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

/** The themes a visitor can be given: [id, name, dark, drawable, fonts] rows from the boot script. */
const drawable = (T) => T.themes.filter((t) => t[3]);

/** The id after the current one in the registry order (wraps around). */
export function nextTheme(T) {
  const ids = drawable(T).map((t) => t[0]);
  if (!ids.length) return 'classic';
  return ids[(ids.indexOf(T.id) + 1) % ids.length];
}

/** Leave for another theme: load this page again with ?theme=<id> (the boot script takes it from
 *  there). replace(), not assign(): changing clothes should not add a step to the Back button. */
export function switchTheme(id) {
  location.replace(`${location.pathname}?theme=${encodeURIComponent(id)}${location.hash}`);
}

/**
 * switcher(T) → <nav class="theme-switcher"> with one link per theme. Unstyled on purpose: the
 * theme decides how it looks. The links are real "?theme=<id>" links (they can be opened in a new
 * tab or copied); a plain click reloads the current page under that theme.
 *
 *   <nav class="theme-switcher" aria-label="换一种读法">
 *     <ul><li><a href="?theme=drift" data-theme-id="drift" aria-current="true">夜航</a></li> …</ul>
 *   </nav>
 */
export function switcher(T) {
  const list = el('ul');
  for (const [id, name, , canDraw] of T.themes) {
    if (!canDraw && id !== T.id) continue;        // hidden or disabled themes only list themselves
    list.append(el('li', null, el('a', { href: `?theme=${encodeURIComponent(id)}`, 'data-theme-id': id, 'aria-current': id === T.id ? 'true' : null }, name)));
  }
  const nav = el('nav', { class: 'theme-switcher', 'aria-label': '换一种读法' }, list);
  nav.addEventListener('click', (event) => {
    const a = event.target.closest('a[data-theme-id]');
    if (!a || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;   // new-tab clicks stay ordinary links
    event.preventDefault();
    switchTheme(a.dataset.themeId);
  });
  return nav;
}

/**
 * The classic page is plain HTML with no theme code of its own, so the core hangs the switcher on
 * it: the same <nav class="theme-switcher"> the other themes place themselves, at the foot of the
 * page, where a reader ends up. Styled by _scss/_theme-switcher.scss.
 *
 *   letter   inside the footer the page already has, under the © line
 *   home     in a footer of its own after the last card (the classic home page never had one)
 *   404      the same footer, resting on the bottom edge of the otherwise empty page
 *
 * Nothing is added where there is nothing to switch to: a browser too old for the new themes
 * (by 'old'), a page they cannot draw (by 'page'), a registry in which classic is the only theme.
 */
export function classicSwitcher(T) {
  if (T.id !== 'classic' || T.by === 'old' || T.by === 'page' || document.querySelector('.theme-switcher')) return null;
  const nav = switcher(T);
  if (nav.querySelectorAll('a').length < 2) return null;
  let foot = document.querySelector('footer.section--footer .container');
  if (!foot) {
    foot = el('div', { class: 'container container--content' });
    document.body.append(el('footer', { class: `section--footer section--footer--switcher${T.page === '404' ? ' section--footer--floor' : ''}` }, foot));
  }
  foot.append(nav);
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
    lines.push(`今天穿的是「${name}」。在页面上敲 221 给我换一身，敲 pi 看今天的 π。`);
    console.log(`%c221 FOREVER%c\n${lines.join('\n')}`, 'font: 700 16px/2 Georgia, serif; letter-spacing: .12em', 'font: 13px/1.7 system-ui, sans-serif');
  } catch { /* a greeting must never break anything */ }
}

// ------------------------------------------------------------------ key sequences

/**
 * Typing 221 anywhere (not in a form field) → the next theme.
 * Typing pi → today's digits of π, shown discreetly for a few seconds.
 * On a touch screen there is no keyboard, so under classic three quick taps on the big title of
 * the home page, or on the footer (around the switcher, not on it: a tap on a theme's name
 * already means that theme), do what 221 does. Nothing is visible until used.
 */
export function keys(T, data) {
  let typed = '';
  let timer = 0;
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || !event.key || event.key.length !== 1) return;
    const t = event.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    typed = (typed + event.key.toLowerCase()).slice(-3);
    clearTimeout(timer);
    timer = setTimeout(() => { typed = ''; }, 1500);
    if (typed === '221') { typed = ''; switchTheme(nextTheme(T)); }
    else if (typed.endsWith('pi')) { typed = ''; showPi(data); }
  });

  if (T.id === 'classic') {
    let taps = 0;
    let tapTimer = 0;
    document.addEventListener('click', (event) => {
      if (!event.target.closest || !event.target.closest('.textLogo--frontpage, .section--footer') || event.target.closest('.theme-switcher')) return;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { taps = 0; }, 900);
      if (++taps >= 3) { taps = 0; switchTheme(nextTheme(T)); }
    });
  }
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
