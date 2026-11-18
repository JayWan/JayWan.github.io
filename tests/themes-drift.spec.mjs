// 夜航 (drift): what this theme promises beyond the contract every theme is tested for in
// themes.spec.mjs. Each test is one of the defects the mockup was sent back for.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, open, root } from './helpers.mjs';

const present = ['theme.js', 'theme.css'].every((file) => existsSync(path.join(root, 'assets/themes/drift', file)));

/** The river as it is laid out: one row per print, newest first. offsetTop / offsetHeight are layout
 *  values, so the idle drift and the scroll parallax (transforms) do not blur the measurement. */
const river = (page) => page.evaluate(() => {
  const order = [...window.__theme.ctx.letters].reverse();
  const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
  const rows = [...document.querySelectorAll('#theme-root .prints .item')].map((a, i) => {
    const letter = order[i];
    const frame = a.querySelector('.frame');
    return {
      no: letter.no,
      date: letter.date,
      names: letter.authors && letter.authors.length ? letter.authors : [letter.author],
      found: Boolean(letter.cover) && letter.cover.own === false,
      guest: letter.role === 'guest',
      layer: Number(/\bz(\d)\b/.exec(a.className)[1]),
      width: frame.offsetWidth,
      paper: getComputedStyle(frame).backgroundColor,
      top: a.offsetTop,
      bottom: a.offsetTop + a.offsetHeight,
      caption: a.querySelector('.cap').textContent,
      line: (a.querySelector('.cap-quote, .blank-q') || {}).textContent || null,
      lines: letter.quotes || [],
    };
  });
  const silences = [];
  for (let i = 1; i < rows.length; i++) {
    const length = days(rows[i - 1].date, rows[i].date);
    if (length <= 180) continue;
    const above = Math.max(...rows.slice(0, i).map((row) => row.bottom));
    const below = Math.min(...rows.slice(i).map((row) => row.top));
    silences.push({ days: length, band: below - above });
  }
  return { rows, silences, labels: [...document.querySelectorAll('#theme-root .note.gap')].map((n) => n.textContent), viewport: window.innerHeight };
});

const phone = async (browser, baseURL) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 402, height: 874 }, hasTouch: true });
  return { context, page: await context.newPage() };
};
const pathOf = (page) => page.evaluate(() => decodeURIComponent(location.pathname));
const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));
/** Where a letter's print is on screen (top of its frame), or null when it is not drawn. */
const printTop = (page, no) => page.evaluate((n) => {
  const { letters } = window.__theme.ctx;
  const a = [...document.querySelectorAll('#theme-root .prints .item')][letters.length - n];
  return Math.round(a.querySelector('.frame').getBoundingClientRect().top);
}, no);
/** Bring a letter's print near the top of the screen and click it. */
async function openFromRiver(page, no) {
  await page.evaluate((n) => {
    const { letters } = window.__theme.ctx;
    const a = [...document.querySelectorAll('#theme-root .prints .item')][letters.length - n];
    window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY - 200);
  }, no);
  const url = await page.evaluate((n) => window.__theme.ctx.letters.byNo(n).url, no);
  await page.locator(`#theme-root .prints .item[href="${url}"]`).click({ position: { x: 60, y: 60 } });
  await expect.poll(() => pathOf(page)).toBe(url);
  await expect(page.locator('#theme-root .sheet .letter-body .content-body')).toBeVisible();
  // the sheet has arrived at the top of the screen and the page has stopped moving
  await page.waitForFunction(() => {
    const top = Math.round(document.querySelector('#theme-root .sheet').getBoundingClientRect().top);
    const still = window.__sheetTop === top;
    window.__sheetTop = top;
    return still && top <= 40;
  }, null, { polling: 120 });
  return url;
}
/** A synthetic touch on the time ruler (the handlers only read pointer events). */
const touchRuler = (page, steps) => page.evaluate((list) => {
  const track = document.querySelector('#theme-root .ruler-track');
  const box = track.getBoundingClientRect();
  for (const [type, fx, dy = 0] of list) {
    track.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: box.left + box.width * fx, clientY: box.top + box.height / 2 + dy, bubbles: true, cancelable: true }));
  }
}, steps);

/** The controls that change theme and can be seen right now, by the bar each one lives in. */
const controls = (page) => page.evaluate(() => [...document.querySelectorAll('#theme-root nav.theme-switcher')]
  .filter((nav) => nav.getClientRects().length && getComputedStyle(nav).visibility !== 'hidden')
  .map((nav) => (nav.closest('.sheet-bar') ? 'sheet bar' : nav.closest('.bar') ? 'bar' : 'elsewhere')));
/** A bar and the pieces it has to hold, left to right. What comes back equals HOLDS when every piece is
 *  there, whole (its words inside its own box), inside the screen, on the same line as the others and
 *  clear of its neighbours, and everything to press is at least a finger wide and high. */
const HOLDS = { lines: 1, missing: [], cut: [], outside: [], overlapping: [], small: [] };
const oneLine = (page, bar, pieces) => page.evaluate(([bar, pieces]) => {
  const seen = { lines: 0, missing: [], cut: [], outside: [], overlapping: [], small: [] };
  const middles = new Set();
  let edge = -Infinity;
  for (const piece of pieces) {
    const el = document.querySelector(`${bar} ${piece}`);
    if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') { seen.missing.push(piece); continue; }
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const words = range.getBoundingClientRect();
    if (words.left < box.left - 1 || words.right > box.right + 1 || words.top < box.top - 4 || words.bottom > box.bottom + 4) seen.cut.push(piece);
    if (box.left < 0 || box.right > window.innerWidth + 0.5) seen.outside.push(piece);
    if (box.left < edge - 0.5) seen.overlapping.push(piece);
    if (el.matches('a[href], button') && !el.matches('.brand') && (box.width < 43.5 || box.height < 43.5)) seen.small.push(piece);
    middles.add(Math.round((box.top + box.bottom) / 4));          // (two pixels of tolerance)
    edge = box.right;
  }
  seen.lines = middles.size;
  return seen;
}, [bar, pieces]);
/** The list of the control that is open: inside the screen, every name a finger high, nothing on top of a name. */
const listInside = (page) => page.evaluate(() => {
  const ul = document.querySelector('#theme-root .theme-switcher[data-open] ul');
  if (!ul) return null;
  const box = ul.getBoundingClientRect(), names = [...ul.querySelectorAll('a')];
  return {
    inside: box.left >= 0 && box.right <= window.innerWidth + 0.5 && box.top >= 0 && box.bottom <= window.innerHeight + 0.5,
    low: names.filter((a) => a.getBoundingClientRect().height < 43.5).map((a) => a.dataset.themeId),
    covered: names.filter((a) => { const r = a.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(top && a.contains(top)); }).map((a) => a.dataset.themeId),
  };
});

test.describe('夜航 (drift)', () => {
  test.skip(!present, 'the drift theme is not in this checkout');

  for (const size of ['desktop', 'phone']) {
    test(`the river on a ${size}: depth, found pictures, who wrote it, silences to scale`, async ({ browser, baseURL }) => {
      const context = await browser.newContext(size === 'phone'
        ? { baseURL, viewport: { width: 402, height: 874 }, hasTouch: true, reducedMotion: 'reduce' }
        : { baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await open(page, '/', 'drift');
      await page.evaluate(() => document.fonts.ready);
      const { rows, silences, labels, viewport } = await river(page);

      // authorship is stated on every print, the same way for everyone
      for (const row of rows) for (const name of row.names) expect(row.caption, `no. ${row.no} names ${name}`).toContain(name);
      // and every print carries one line of its letter, near or far (not only the prints in front)
      const bare = (text) => text.replace(/\s+/g, '');
      for (const row of rows.filter((r) => r.lines.length)) expect(row.lines.map(bare), `no. ${row.no} shows one of its lines`).toContain(bare(row.line || ''));
      expect(rows.filter((r) => r.line).length, 'on all three layers').toBe(rows.filter((r) => r.lines.length).length);
      for (const layer of [0, 1, 2]) expect(rows.filter((r) => r.layer === layer && r.line).length, `layer ${layer} has prints with a line`).toBeGreaterThan(0);
      // pictures found online are never framed as the couple's prints: far layer, no paper border
      for (const row of rows.filter((r) => r.found)) {
        expect(row.layer, `no. ${row.no}: a found picture stays on the far layer`).toBe(0);
        expect(row.paper, `no. ${row.no}: a found picture has no paper border`).toBe('rgba(0, 0, 0, 0)');
      }
      for (const row of rows.filter((r) => r.guest)) expect(row.layer, 'a guest letter is a far print').toBe(0);
      const widest = (layer) => Math.max(...rows.filter((r) => r.layer === layer).map((r) => r.width));
      if (size === 'desktop') expect(widest(2) / widest(0), 'near prints are at least 2.2 times the far ones').toBeGreaterThanOrEqual(2.2);
      else expect(widest(2), 'on a phone depth is width').toBeGreaterThan(widest(0));

      // silence is to scale: the longer the gap, the longer the empty stretch, and the 838 days are the longest on the page
      const byDays = [...silences].sort((a, b) => a.days - b.days);
      for (let i = 1; i < byDays.length; i++) expect(byDays[i].band, `${byDays[i].days} days are emptier than ${byDays[i - 1].days}`).toBeGreaterThan(byDays[i - 1].band);
      const longest = byDays[byDays.length - 1];
      expect(longest.days).toBe(838);
      expect(longest.band, 'the longest silence is most of a screen of nothing').toBeGreaterThanOrEqual(viewport * 0.6);
      expect(labels.find((text) => text.startsWith('838')), 'it is labelled plainly').toContain('没有信');
      await context.close();
    });
  }

  test('the time ruler: nothing moves on touch-down, a tap jumps and can be undone, a drag along it scrubs', async ({ browser, baseURL }) => {
    const { context, page } = await phone(browser, baseURL);
    await open(page, '/', 'drift');
    await page.evaluate(() => window.scrollTo(0, 5000));
    const start = await scrollY(page);

    await touchRuler(page, [['pointerdown', 0.8]]);
    expect(await scrollY(page), 'touch-down alone').toBe(start);
    await touchRuler(page, [['pointercancel', 0.8]]);
    expect(await scrollY(page), 'a touch the browser took for a swipe').toBe(start);
    await touchRuler(page, [['pointerdown', 0.8], ['pointermove', 0.8, -8], ['pointermove', 0.8, -20], ['pointermove', 0.8, -40], ['pointerup', 0.8, -40]]);
    expect(await scrollY(page), 'a vertical swipe that starts on the ruler').toBe(start);

    await touchRuler(page, [['pointerdown', 0.3], ['pointerup', 0.3]]);
    await expect.poll(() => scrollY(page), 'a tap jumps to the nearest letter').not.toBe(start);
    const undo = page.locator('#theme-root .ruler-undo');
    await expect(undo, 'and offers the way back').toBeVisible();
    expect((await undo.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await undo.click();
    await expect.poll(() => scrollY(page)).toBe(start);

    await touchRuler(page, [['pointerdown', 0.8], ['pointermove', 0.77, 1], ['pointermove', 0.7, 1], ['pointermove', 0.6, 1]]);
    await expect.poll(() => scrollY(page), 'a deliberate drag along the ruler scrubs').not.toBe(start);
    await touchRuler(page, [['pointerup', 0.6, 1]]);
    await context.close();
  });

  test('reading on past the end of a letter closes it: no dimmed dead zone, nothing jumps', async ({ browser, baseURL }) => {
    const { context, page } = await phone(browser, baseURL);
    await open(page, '/', 'drift');
    await openFromRiver(page, 22);
    // one screen past the foot of the sheet
    await page.evaluate(() => {
      const sheet = document.querySelector('#theme-root .sheet').getBoundingClientRect();
      window.scrollTo(0, sheet.bottom + window.scrollY + 60);
    });
    const before = await page.evaluate(() => {
      const a = [...document.querySelectorAll('#theme-root .prints .item:not(.is-open)')].find((item) => { const box = item.getBoundingClientRect(); return box.top > 60 && box.top < window.innerHeight; });
      return a ? { href: a.getAttribute('href'), top: Math.round(a.getBoundingClientRect().top) } : null;
    });
    expect(before, 'the river is under the letter').not.toBeNull();
    await expect.poll(() => pathOf(page), 'the letter closes itself').toBe('/');
    await expect(page.locator('#theme-root .sheet')).toBeHidden();
    const look = () => page.evaluate((href) => {
      const a = [...document.querySelectorAll('#theme-root .prints .item')].find((item) => item.getAttribute('href') === href);
      return { top: Math.round(a.getBoundingClientRect().top), opacity: getComputedStyle(a).opacity, open: document.getElementById('theme-root').classList.contains('has-open') };
    }, before.href);
    const after = await look();
    expect(Math.abs(after.top - before.top), 'what the reader was looking at stays where it was').toBeLessThanOrEqual(3);
    expect(after.open).toBe(false);
    await expect.poll(async () => (await look()).opacity, 'the river is at full strength again').toBe('1');
    await context.close();
  });

  test('closing lands on the print of the letter just read, wherever the reader came from', async ({ browser, baseURL }) => {
    const { context, page } = await phone(browser, baseURL);
    await open(page, '/', 'drift');
    // 「最新一封」 on the first screen, then 「合上」 in the dock: not back to the masthead
    const latest = await page.evaluate(() => { const { letters } = window.__theme.ctx; return { no: letters.latest.no, url: letters.latest.url, standalone: letters.latest.standalone }; });
    test.skip(latest.standalone, 'the newest letter loads its own page');
    await page.locator('#theme-root .bar-link').click();
    await expect.poll(() => pathOf(page)).toBe(latest.url);
    await page.locator('#theme-root .dock-close').click();
    await expect.poll(() => pathOf(page)).toBe('/');
    await expect.poll(() => printTop(page, latest.no), 'its print is in the upper part of the screen').toBeGreaterThanOrEqual(0);
    expect(await printTop(page, latest.no)).toBeLessThan(874 * 0.6);

    // from a letter far down the river, the foot of the sheet has the way back too
    await openFromRiver(page, 9);
    const close = page.locator('#theme-root .sheet-close2');
    await close.scrollIntoViewIfNeeded();
    expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect.poll(() => pathOf(page)).toBe('/');
    await expect.poll(() => printTop(page, 9)).toBeGreaterThanOrEqual(0);
    expect(await printTop(page, 9)).toBeLessThan(874 * 0.6);
    await context.close();
  });

  test('previous and next keep one step between the letter and the river', async ({ page }) => {
    await open(page, '/', 'drift');
    test.skip(!(await page.evaluate(() => typeof window.__theme.ctx.router.home === 'function')), 'the core has no router.home() yet');
    await openFromRiver(page, 26);
    const next = page.locator('#theme-root .sheet-nav .sn-next');
    await next.scrollIntoViewIfNeeded();
    await next.click();
    const second = await page.evaluate(() => window.__theme.ctx.letters.byNo(27).url);
    await expect.poll(() => pathOf(page)).toBe(second);
    await expect.poll(() => page.evaluate(() => Math.round(document.querySelector('#theme-root .sheet').getBoundingClientRect().top)), 'the next letter starts at its top').toBeLessThanOrEqual(40);
    await page.goBack();
    await expect.poll(() => pathOf(page), 'one Back leaves for the river').toBe('/');
    const vh = await page.evaluate(() => window.innerHeight);
    await expect.poll(() => printTop(page, 27), 'at the letter just read').toBeGreaterThan(-200);
    expect(await printTop(page, 27)).toBeLessThan(vh);
  });

  test('an opened letter: the first lines are on screen one, Home stays inside the letter', async ({ page }) => {
    const width = await page.evaluate(() => window.innerWidth);
    for (const no of [26, 25, 6]) {           // a wide cover, a tall one, a found one
      const url = await (async () => { await open(page, '/', 'drift'); return page.evaluate((n) => window.__theme.ctx.letters.byNo(n).url, no); })();
      await open(page, url, 'drift');
      const first = await page.evaluate(() => {
        const body = document.querySelector('#theme-root .letter-body .content-body');
        const block = [...body.children].find((el) => el.getBoundingClientRect().height > 0);
        return Math.round(block.getBoundingClientRect().top);
      });
      if (width >= 1100) expect(first, `no. ${no}: where the body begins`).toBeLessThan(await page.evaluate(() => window.innerHeight) - 36);
    }
    // Home is the top of the letter, not the top of the river
    const top = () => page.evaluate(() => Math.round(document.querySelector('#theme-root .sheet').getBoundingClientRect().top));
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.locator('#theme-root .sheet').focus();
    await page.keyboard.press('Home');
    await expect.poll(top).toBeGreaterThanOrEqual(0);
    expect(await top()).toBeLessThanOrEqual(40);
    await expect(page.locator('#theme-root .sheet .letter-body .content-body')).toBeVisible();
  });

  test('an open letter keeps the keyboard focus: Tab walks its own controls, Esc returns to its print', async ({ page }) => {
    await open(page, '/', 'drift');
    const url = await page.evaluate(() => window.__theme.ctx.letters.byNo(26).url);
    await open(page, url, 'drift');                      // a hard load: the focus starts on the page, not in the letter
    const where = () => page.evaluate(() => {
      const el = document.activeElement;
      return { inSheet: Boolean(el && el.closest('#theme-root .sheet')), open: !document.querySelector('#theme-root .sheet').hidden };
    });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await where(), `Tab no. ${i + 1} stays in the letter, and the letter stays open`).toEqual({ inSheet: true, open: true });
    }
    // back round to the control that changes theme, in the bar of the sheet: closed, it leaves Esc to the letter
    const onControl = () => page.evaluate(() => document.activeElement.matches('#theme-root .sheet-bar .theme-switcher-toggle'));
    for (let i = 0; i < 12 && !(await onControl()); i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await where()).toEqual({ inSheet: true, open: true });
    }
    expect(await onControl(), 'Shift+Tab walks back to the control').toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => pathOf(page)).toBe('/');
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'))).toBe(url);
  });

  test('the control that changes theme is the last thing in the bar; an open letter carries it in its own bar, before 合上', async ({ page, isMobile }) => {
    // The river's bar is put away while a letter is open, so the control cannot only live there:
    // the sheet's own bar has one too. One of the two shows at a time, and no names are left at
    // the foot of the river or at the end of a letter.
    await open(page, '/', 'drift');
    expect(await controls(page), 'on the river: one control, in the bar').toEqual(['bar']);
    await expect(page.locator('#theme-root .foot nav.theme-switcher, #theme-root .sheet-foot nav.theme-switcher'), 'none at the foot of the river, none at the end of a letter').toHaveCount(0);
    const river = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const toggle = box('#theme-root .bar .theme-switcher-toggle');
      return { afterTheRest: toggle.left - box('#theme-root .bar-toggle').right, fromTheEdge: window.innerWidth - toggle.right };
    });
    expect(river.afterTheRest, 'after 最新一封 and 漂浮').toBeGreaterThanOrEqual(0);
    expect(river.fromTheEdge, 'at the right end of the bar').toBeLessThan(40);

    const url = await page.evaluate(() => window.__theme.ctx.letters.byNo(31).url);
    await open(page, url, 'drift');
    expect(await controls(page), 'a letter open: one control, in the bar of the sheet').toEqual(['sheet bar']);
    const placed = () => page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const toggle = box('#theme-root .sheet-bar .theme-switcher-toggle'), close = box('#theme-root .sb-close'), bar = box('#theme-root .sheet-bar');
      return {
        top: Math.round(toggle.top),
        inTheBar: toggle.top >= bar.top - 0.5 && toggle.bottom <= bar.bottom + 0.5,
        beforeClose: close.left - toggle.right,
        closeFromTheEnd: Math.round(bar.right - close.right),
      };
    });
    const check = async (when) => {
      const at = await placed();
      expect(at.top, `${when}: on screen, at the top`).toBeGreaterThanOrEqual(0);
      expect(at.top, `${when}: on screen, at the top`).toBeLessThan(100);
      expect(at.inTheBar, `${when}: inside the bar of the sheet`).toBe(true);
      expect(at.beforeClose, `${when}: it does not touch 合上`).toBeGreaterThanOrEqual(8);
      expect(at.closeFromTheEnd, `${when}: 合上 keeps the corner`).toBeLessThanOrEqual(10);
    };
    await check('where the reader lands');
    await page.evaluate(() => window.scrollBy(0, 1200));          // further into the letter: the bar of the sheet stays, and the control with it
    await page.waitForTimeout(200);
    await check('further into the letter');

    // open: a dark slip hangs from the bar, its right edge on the control's; the paper stays under it
    const toggle = page.locator('#theme-root .sheet-bar .theme-switcher-toggle');
    const list = page.locator('#theme-root .sheet-bar .theme-switcher ul');
    await toggle.click();
    await expect(list).toBeVisible();
    const slip = await page.evaluate(() => {
      const lum = (colour) => { const [r, g, b] = colour.match(/[\d.]+/g).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const nav = document.querySelector('#theme-root .sheet-bar .theme-switcher'), ul = nav.querySelector('ul');
      const box = ul.getBoundingClientRect(), button = nav.querySelector('button').getBoundingClientRect(), bar = nav.closest('.sheet-bar').getBoundingClientRect();
      const lamp = getComputedStyle(ul.querySelector('a[aria-current="true"]'), '::before'), ring = getComputedStyle(ul.querySelector('a:not([aria-current])'), '::before');
      return {
        underTheBar: box.top - bar.bottom, rightEdges: box.right - button.right,
        night: lum(getComputedStyle(ul).backgroundColor), paper: lum(getComputedStyle(nav.closest('.sheet').querySelector('.sheet-body')).backgroundColor),
        lamp: parseFloat(lamp.borderTopWidth) >= 3 && lum(lamp.backgroundColor) > 200, ring: parseFloat(ring.borderTopWidth) <= 1 && lum(ring.backgroundColor) < 60,
      };
    });
    expect(Math.abs(slip.underTheBar), 'it hangs from the bar').toBeLessThanOrEqual(1.5);
    expect(Math.abs(slip.rightEdges), 'its right edge is the control\'s').toBeLessThanOrEqual(1);
    expect(slip.night, 'the list is a piece of the night, on the paper too').toBeLessThan(slip.paper - 150);
    expect(slip, 'a lamp (solid) on the theme being worn, a ring on the others').toMatchObject({ lamp: true, ring: true });

    // Esc closes a letter in this theme. With the list open it closes the list and nothing else.
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await page.waitForTimeout(300);
    expect(await pathOf(page), 'the letter is still open').toBe(url);
    await expect(page.locator('#theme-root .sheet')).toBeVisible();

    if (!isMobile) {                                                // (a phone has no Tab key)
      // an open letter keeps the focus inside the sheet: the control is one of its stops, and so are the names once it is open
      const focus = () => page.evaluate(() => {
        const el = document.activeElement;
        return { on: el.matches('.theme-switcher-toggle') ? 'control' : el.dataset.themeId || el.className, inSheet: Boolean(el.closest('#theme-root .sheet')) };
      });
      await page.locator('#theme-root .sheet').focus();
      let at = await focus();
      for (let i = 0; i < 3 && at.on !== 'control'; i++) {          // (this far into the letter the small play key comes first)
        await page.keyboard.press('Tab');
        at = await focus();
      }
      expect(at, 'Tab reaches the control without leaving the letter').toEqual({ on: 'control', inSheet: true });
      await page.keyboard.press('Enter');
      await expect(list).toBeVisible();
      const names = await list.locator('a').evaluateAll((links) => links.map((a) => a.dataset.themeId));
      for (const id of names) {
        await page.keyboard.press('Tab');
        expect(await focus(), 'Tab walks the names').toEqual({ on: id, inSheet: true });
      }
      await page.keyboard.press('ArrowRight');                      // (← and → turn to the neighbouring letter, but not from inside the list)
      expect(await pathOf(page)).toBe(url);
      // Home and End keep their meaning from inside the list: the head and the end of this letter, not the top
      // or the foot of the river (going there would close the letter)
      const sheetAt = () => page.evaluate(() => { const r = document.querySelector('#theme-root .sheet').getBoundingClientRect(); return { top: Math.round(r.top), endOnScreen: r.bottom > 0 && r.bottom <= innerHeight }; });
      await page.keyboard.press('End');
      await expect.poll(sheetAt, 'End: the end of the letter').toMatchObject({ endOnScreen: true });
      await page.keyboard.press('Home');
      await expect.poll(async () => { const { top } = await sheetAt(); return top >= 0 && top < 100; }, 'Home: the head of the letter').toBe(true);
      expect(await pathOf(page), 'the letter is still open').toBe(url);
      await page.keyboard.press('Tab');                             // past the last name: on to 合上, and the list closes behind
      expect(await focus()).toEqual({ on: 'sb-close', inSheet: true });
      await expect(list).toBeHidden();
      expect(await pathOf(page), 'and the letter is still open').toBe(url);
    }

    // read on past the end: the letter closes, and the control is the one in the river's bar again
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => pathOf(page)).toBe('/');
    expect(await controls(page)).toEqual(['bar']);

    // pressed in the bar of the sheet, a name changes theme and the reader stays on the letter
    await open(page, url, 'drift');
    await toggle.click();
    await list.locator('a[data-theme-id="folio"]').click();
    await page.waitForSelector('html[data-theme-ready="folio"]');
    expect(await pathOf(page), 'the same letter, in the theme that was pressed').toBe(url);
  });

  for (const width of [402, 375, 360, 320]) {
    test(`on a phone ${width}px wide the bar and the bar of the sheet each hold everything on one line, and the list of themes is inside the screen`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ baseURL, viewport: { width, height: 640 }, hasTouch: true });
      const page = await context.newPage();
      await open(page, '/', 'drift');
      await page.evaluate(() => document.fonts.ready);
      // the river's bar: the name of the site (it joins the bar once the masthead has scrolled away), 最新一封, 漂浮, the control
      await page.evaluate(() => window.scrollTo(0, 900));
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#theme-root .brand')).opacity)).toBe('1');
      expect(await oneLine(page, '#theme-root .bar', ['.brand', '.bar-link', '.bar-toggle', '.theme-switcher-toggle']), 'the bar of the river').toEqual(HOLDS);
      await page.locator('#theme-root .bar .theme-switcher-toggle').tap();
      expect(await listInside(page), 'its list').toEqual({ inside: true, low: [], covered: [] });
      await expectNoSidewaysScroll(page);

      // the bar of an open letter: its number, the control, 合上
      const url = await page.evaluate(() => window.__theme.ctx.letters.byNo(31).url);
      await open(page, url, 'drift');
      await page.evaluate(() => document.fonts.ready);
      expect(await oneLine(page, '#theme-root .sheet-bar', ['.sb-no', '.theme-switcher-toggle', '.sb-close']), 'the bar of the sheet').toEqual(HOLDS);
      await page.locator('#theme-root .sheet-bar .theme-switcher-toggle').tap();
      expect(await listInside(page), 'its list').toEqual({ inside: true, low: [], covered: [] });
      await expectNoSidewaysScroll(page);
      await context.close();
    });
  }

  test('where the bar has no room for the name of the site, the name leaves whole and the rest holds', async ({ browser, baseURL }) => {
    // Larger text or a screen narrower than any phone: the name is the piece that gives way. It is
    // not cut and nothing runs into it: it wraps out of sight (the masthead and the foot still say it).
    const context = await browser.newContext({ baseURL, viewport: { width: 300, height: 640 }, hasTouch: true });
    const page = await context.newPage();
    await open(page, '/', 'drift');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#theme-root .brand')).opacity)).toBe('1');
    const name = await page.evaluate(() => {
      const brand = document.querySelector('#theme-root .brand'), box = brand.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(brand);
      const text = range.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + 30, box.top + box.height / 2);
      return { wrappedOut: (text.top + text.bottom) / 2 > box.bottom, clips: getComputedStyle(brand).overflowY, nothingInItsPlace: hit === brand };
    });
    expect(name, 'the name is out of sight, whole: its line lies below the box that would have shown it').toEqual({ wrappedOut: true, clips: 'hidden', nothingInItsPlace: true });
    expect(await oneLine(page, '#theme-root .bar', ['.bar-link', '.bar-toggle', '.theme-switcher-toggle']), 'the rest of the bar').toEqual(HOLDS);
    await expectNoSidewaysScroll(page);
    await context.close();
  });

  test('with a letter open the masthead above the river is dimmed, not taken away: no empty screen above the newest letter', async ({ browser, baseURL }) => {
    // The newest letter is the first print under the masthead. Scrolling back up from it used to
    // show a screen of nothing where the masthead had been hidden. Beside the river (1100px and
    // wider) the sheet lies across the masthead, and there it still makes room.
    for (const [width, height, beside] of [[402, 874, false], [1024, 768, false], [1440, 900, true]]) {
      const context = await browser.newContext({ baseURL, viewport: { width, height }, hasTouch: width < 760 });
      const page = await context.newPage();
      await open(page, '/', 'drift');
      const url = await page.evaluate(() => window.__theme.ctx.letters.latest.url);
      await open(page, url, 'drift');
      const seen = () => page.evaluate(() => {
        const hero = document.querySelector('#theme-root .hero'), sheet = document.querySelector('#theme-root .sheet');
        const style = getComputedStyle(hero), h = hero.getBoundingClientRect(), s = sheet.getBoundingClientRect();
        return {
          open: !sheet.hidden,
          shown: style.visibility === 'visible' && h.height > 100 && hero.innerText.trim().length > 10,
          opacity: Number(style.opacity),
          apart: h.bottom <= s.top || h.right <= s.left || h.left >= s.right,
        };
      });
      expect((await seen()).open, `${width}px: the letter is open`).toBe(true);
      if (beside) expect((await seen()).shown, `${width}px: beside the river the masthead makes room for the sheet`).toBe(false);
      else {
        // (it fades over half a second, like the prints: wait for where it comes to rest)
        await expect.poll(async () => (await seen()).opacity, `${width}px: dimmed like the river behind an open letter`).toBeLessThanOrEqual(0.5);
        const now = await seen();
        expect(now.opacity, `${width}px: dimmed, not gone`).toBeGreaterThanOrEqual(0.2);
        expect(now.shown, `${width}px: the masthead is still there`).toBe(true);
        expect(now.apart, `${width}px: and the sheet does not lie across it`).toBe(true);
      }
      await context.close();
    }
  });

  test('pictures in a letter keep their place before they load; the progress line takes a finger', async ({ page, baseURL }) => {
    await open(page, '/', 'drift');
    const url = await page.evaluate(() => window.__theme.ctx.letters.find((l) => l.date === '2016-06-08').url);   // Hang Zhou: five pictures
    // the pictures are on their way for as long as this test looks at them
    let arrive;
    const held = new Promise((resolve) => { arrive = resolve; });
    await page.route((u) => u.href.startsWith(baseURL) && /\/assets\/(m|images)\/posts\//.test(u.pathname), async (route) => { await held; await route.abort().catch(() => {}); });
    await page.goto(`${url}?theme=drift`, { waitUntil: 'domcontentloaded' });      // the load event would wait for them
    await page.waitForSelector('html[data-theme-ready="drift"]');
    const figures = await page.evaluate(() => [...document.querySelectorAll('#theme-root .letter-body .letter-figure > img')].map((img) => {
      const box = img.getBoundingClientRect();
      return { loaded: img.complete && img.naturalWidth > 0, width: Math.round(box.width), height: Math.round(box.height), ratio: Number(img.getAttribute('width')) / Number(img.getAttribute('height')) };
    }));
    expect(figures.length, 'the letter has its pictures').toBeGreaterThanOrEqual(5);
    for (const figure of figures) {
      expect(figure.loaded).toBe(false);
      expect(figure.height, 'a picture that has not arrived is as tall as it will be').toBeGreaterThan(60);
      expect(Math.abs(figure.width / figure.height - figure.ratio), 'and has its own proportions').toBeLessThan(0.03);
    }
    // the whole height of the progress line belongs to it (its lower half used to lie under the letter's body)
    const hit = await page.evaluate(() => {
      const line = document.querySelector('#theme-root .track-line');
      const box = line.getBoundingClientRect();
      const at = (y) => document.elementFromPoint(box.left + box.width / 2, y);
      return { height: Math.round(box.height), upper: line.contains(at(box.top + 6)), lower: line.contains(at(box.bottom - 6)) };
    });
    expect(hit.height).toBeGreaterThanOrEqual(44);
    expect(hit, 'a tap just above and just below the hairline both reach it').toMatchObject({ upper: true, lower: true });
    arrive();
  });

  test('titles break after their own comma; a guest signs with the date alone', async ({ browser, baseURL }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 402, height: 874 }]) {
      const context = await browser.newContext({ baseURL, viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await open(page, '/', 'drift');
      await page.evaluate(() => document.fonts.ready);
      const guest = await page.evaluate(() => { const l = window.__theme.ctx.letters.find((x) => x.role === 'guest'); return l ? { url: l.url, standalone: l.standalone } : null; });
      // every phrase of every title on the river sits on one line (「装修好了，／钥匙在门垫下面」, never 「钥／匙」)
      const broken = await page.evaluate(() => [...document.querySelectorAll('#theme-root .cap-title .nb')]
        .filter((span) => span.getBoundingClientRect().height > parseFloat(getComputedStyle(span).lineHeight) * 1.5)
        .map((span) => span.textContent));
      expect(broken, `at ${viewport.width}px`).toEqual([]);
      if (guest && !guest.standalone) {
        await open(page, guest.url, 'drift');
        const sign = await page.locator('#theme-root .sheet-sign').textContent();
        expect(sign, 'the count of days is the couple\'s, not the guest\'s').not.toContain('认识的第');
        expect(await page.locator('#theme-root .sh-title').textContent()).toBe(await page.evaluate(() => window.__theme.ctx.page.letter.title));
      }
      await context.close();
    }
  });

  test('Forward into a letter that closed itself opens it at its top', async ({ page }) => {
    await open(page, '/', 'drift');
    const url = await openFromRiver(page, 22);
    await page.evaluate(() => {
      const sheet = document.querySelector('#theme-root .sheet').getBoundingClientRect();
      window.scrollTo(0, sheet.bottom + window.scrollY + 60);
    });
    await expect.poll(() => pathOf(page), 'walked past its end, the letter closes itself').toBe('/');
    await page.goForward();
    await expect.poll(() => pathOf(page)).toBe(url);
    const top = () => page.evaluate(() => Math.round(document.querySelector('#theme-root .sheet').getBoundingClientRect().top));
    await expect.poll(top, 'the reader is at the top of the letter, not beyond its end').toBeGreaterThanOrEqual(0);
    expect(await top()).toBeLessThanOrEqual(40);
    await page.waitForTimeout(1500);                     // and it stays open (it used to close itself again at once)
    expect(await pathOf(page)).toBe(url);
    await expect(page.locator('#theme-root .sheet')).toBeVisible();
  });
});
