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
    await page.keyboard.press('Shift+Tab');
    expect(await where()).toEqual({ inSheet: true, open: true });
    await page.keyboard.press('Escape');
    await expect.poll(() => pathOf(page)).toBe('/');
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'))).toBe(url);
  });

  test('the names of the themes stand at the end of an open letter, in ink; pressed there, the reader stays on the letter', async ({ page }) => {
    // The row at the foot of the river is a dozen screens below the end of a letter, and walking
    // there closes the letter. So an open letter carries a row of its own, after 「合上」.
    await open(page, '/', 'drift');
    const showing = () => page.evaluate(() => [...document.querySelectorAll('#theme-root nav.theme-switcher')].filter((nav) => nav.getClientRects().length)
      .map((nav) => (nav.closest('.sheet') ? 'letter' : nav.closest('.foot') ? 'river' : 'elsewhere')));
    expect(await showing(), 'no letter open: the one at the foot of the river').toEqual(['river']);

    const url = await page.evaluate(() => window.__theme.ctx.letters.byNo(31).url);
    await open(page, url, 'drift');
    expect(await showing()).toEqual(['letter', 'river']);
    const row = page.locator('#theme-root .sheet-foot nav.theme-switcher');
    await row.scrollIntoViewIfNeeded();
    const seen = await row.evaluate((nav) => {
      const lum = (colour) => { const [r, g, b] = colour.match(/[\d.]+/g).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const box = nav.getBoundingClientRect(), sheet = nav.closest('.sheet').getBoundingClientRect(), close = nav.closest('.sheet-foot').querySelector('.sheet-close2').getBoundingClientRect();
      const names = [...nav.querySelectorAll('a')];
      return {
        inside: box.left >= sheet.left && box.right <= sheet.right && box.bottom <= sheet.bottom,
        afterClose: box.top >= close.bottom,
        oneLine: new Set(names.map((a) => Math.round(a.getBoundingClientRect().top))).size,
        paper: lum(getComputedStyle(nav.closest('.sheet').querySelector('.sheet-body')).backgroundColor),
        ink: names.map((a) => Math.round(lum(getComputedStyle(a).color))),
        worn: Math.round(lum(getComputedStyle(nav.querySelector('a[aria-current="true"]')).color)),
      };
    });
    expect(seen.inside, 'the row is on the sheet').toBe(true);
    expect(seen.afterClose, 'after the word that closes the letter').toBe(true);
    expect(seen.oneLine, 'on one line').toBe(1);
    expect(Math.max(...seen.ink), 'dark names on light paper, not the river\'s light names').toBeLessThan(seen.paper - 100);
    expect(seen.worn, 'the theme being worn is the darkest').toBe(Math.min(...seen.ink));
    expect(await pathOf(page), 'the letter is still open').toBe(url);

    await row.locator('a[data-theme-id="folio"]').click();
    await page.waitForSelector('html[data-theme-ready="folio"]');
    expect(await pathOf(page), 'the same letter, in the theme that was pressed').toBe(url);

    // read on past the end: the letter closes and takes its row with it
    await open(page, url, 'drift');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => pathOf(page)).toBe('/');
    expect(await showing()).toEqual(['river']);
  });

  test('on a narrow phone both rows of names stay on one line, each name a finger wide', async ({ browser, baseURL }) => {
    for (const width of [375, 360, 320]) {
      const context = await browser.newContext({ baseURL, viewport: { width, height: 640 }, hasTouch: true });
      const page = await context.newPage();
      await open(page, '/', 'drift');
      const url = await page.evaluate(() => window.__theme.ctx.letters.byNo(31).url);
      await open(page, url, 'drift');
      const rows = await page.evaluate(() => [...document.querySelectorAll('#theme-root nav.theme-switcher')].filter((nav) => nav.getClientRects().length).map((nav) => {
        const names = [...nav.querySelectorAll('a')].map((a) => a.getBoundingClientRect()), box = nav.getBoundingClientRect();
        return {
          lines: new Set(names.map((r) => Math.round(r.top))).size,
          small: names.filter((r) => r.width < 43.5 || r.height < 43.5).length,
          inside: box.left >= 0 && box.right <= window.innerWidth && names.every((r) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5),
        };
      }));
      expect(rows, `${width}px wide: the row in the letter, the row at the foot of the river`).toEqual([{ lines: 1, small: 0, inside: true }, { lines: 1, small: 0, inside: true }]);
      await expectNoSidewaysScroll(page);
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
