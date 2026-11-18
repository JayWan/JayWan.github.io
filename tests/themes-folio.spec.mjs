// What the theme 「笺」 (folio) promises beyond the contract every theme is held to in
// themes.spec.mjs: what a column of the contents says, where the guest letter sits, how the
// reader moves between the contents and a letter, and that a letter is set on its ruled lines
// with its pictures as the couple made them.

import { test, expect } from '@playwright/test';
import { getIsland, open, watch, expectNoSidewaysScroll } from './helpers.mjs';

const THEME = 'folio';
const DIGITS = '〇一二三四五六七八九';
const yearZh = (year) => String(year).replace(/\d/g, (d) => DIGITS[d]);
const view = (page) => page.evaluate(() => document.getElementById('theme-root').dataset.view);
const isGuest = (l) => l.role === 'guest';
const authors = (l) => (l.authors && l.authors.length ? l.authors : [l.author]);
/** The letters as the theme sees them (ctx.letters: with role and the day counts the core works out). */
const lettersOf = (page) => page.evaluate(() => window.__theme.ctx.letters.map((l) => ({
  no: l.no, title: l.title, url: l.url, date: l.date, year: l.year, author: l.author, authors: l.authors, role: l.role,
  days: l.days, song: l.song && { title: l.song.title }, standalone: l.standalone,
})));

test.describe('theme "folio": the contents', () => {
  test('every letter is a column that names its title, writer, day count and song', async ({ page }) => {
    await open(page, '/', THEME);
    const letters = await lettersOf(page);
    for (const letter of letters) {
      const column = page.locator(`#theme-root .leaves .cell[data-no="${letter.no}"] a.col`);
      await expect(column, `letter ${letter.no} has one column in the leaves`).toHaveCount(1);
      expect(decodeURI(new URL(await column.getAttribute('href'), 'http://x').pathname)).toBe(decodeURI(letter.url));
      const label = await column.getAttribute('aria-label');
      expect(label).toContain(letter.title);
      for (const name of authors(letter)) expect(label, `letter ${letter.no} names ${name}`).toContain(name);
      // the same things are printed, not only spoken: writer and song in the note, the day count in the bottom band
      const text = (await column.innerText()).replace(/\s+/g, '');
      for (const name of authors(letter)) expect(text).toContain(name.replace(/\s+/g, ''));
      if (letter.song) {
        expect(label).toContain(letter.song.title);
        expect(text, `letter ${letter.no} prints its song`).toContain(letter.song.title.replace(/\s+/g, ''));
      }
      if (letter.days && letter.days.met != null) await expect(column.locator('.day')).toHaveText(String(letter.days.met));
    }
  });

  test('a year without letters says 「没有信」, and the guest letter is an afterword, not a row of its year', async ({ page }) => {
    await open(page, '/', THEME);
    const letters = await lettersOf(page);
    const first = letters[0].year;
    const last = Math.max(...letters.filter((l) => !isGuest(l)).map((l) => l.year));
    for (let year = first; year <= last; year++) {
      const leaf = page.locator(`#theme-root #y${year}`);
      await expect(leaf, `${year} has a leaf`).toHaveCount(1);
      await expect(leaf.locator('.yr-t')).toHaveText(yearZh(year));
      const own = letters.filter((l) => l.year === year && !isGuest(l));
      await expect(leaf.locator('.cell--letter')).toHaveCount(own.length);
      if (!own.length) await expect(leaf.locator('.yr-n')).toHaveText('没有信');
    }
    await expect(page.locator('#theme-root')).not.toContainText('无信');
    const guests = letters.filter(isGuest);
    test.skip(!guests.length, 'no guest letter in the archive');
    const afterword = page.locator('#theme-root #ba');
    await expect(afterword.locator('.yr-t')).toHaveText('跋');
    await expect(afterword.locator('.cell--letter')).toHaveCount(guests.length);
    await expectNoSidewaysScroll(page);
  });

  test('one quote is printed above every row of letters without anybody hovering', async ({ page }) => {
    await open(page, '/', THEME);
    const shown = await page.evaluate(() => [...document.querySelectorAll('#theme-root .leaf')].map((leaf) => ({
      letters: leaf.querySelectorAll('.cell--letter, .cell--latest').length,
      quotes: [...leaf.querySelectorAll('.mei')].filter((m) => getComputedStyle(m).visibility === 'visible' && m.textContent.trim()).length,
    })));
    for (const leaf of shown) if (leaf.letters) expect(leaf.quotes, 'a leaf with letters shows a quote').toBeGreaterThan(0);
  });
});

test.describe('theme "folio": from the contents to a letter and back', () => {
  test('one click opens a letter; next replaces it; 目录 at the end returns to the leaf of the letter just read', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const start = letters.find((l) => l.date === '2024-11-19') || letters[Math.max(0, letters.length - 8)];   // 万天万岁！
    const next = letters[start.no];                                                                            // the letter after it
    test.skip(!next || next.standalone || start.standalone, 'needs two ordinary letters in a row');
    const seen = watch(page, 'x');
    await open(page, '/', THEME);
    const column = page.locator(`#theme-root .leaves .cell[data-no="${start.no}"] a.col`);
    await column.scrollIntoViewIfNeeded();
    const length = await page.evaluate(() => history.length);
    await column.click();
    await expect.poll(() => view(page)).toBe('letter');
    await expect(page.locator('#theme-root .tiji-title')).toHaveAttribute('aria-label', start.title);
    expect(await page.evaluate(() => history.length), 'opening a letter adds one history entry').toBe(length + 1);

    await page.locator('#theme-root .feet a[rel="next"]').click();
    await expect(page.locator('#theme-root .tiji-title')).toHaveAttribute('aria-label', next.title);
    expect(await page.evaluate(() => history.length), 'the next letter takes the place of the entry').toBe(length + 1);
    expect(await page.evaluate(() => window.scrollY), 'the next letter starts at its top').toBe(0);

    const home = page.locator('#theme-root .feet .cell--home a');
    await home.scrollIntoViewIfNeeded();
    await home.click();
    await expect.poll(() => view(page)).toBe('home');
    const read = page.locator('#theme-root .leaves .cell.is-read');
    await expect(read, 'the column of the letter just read is marked').toHaveAttribute('data-no', String(next.no));
    await expect.poll(() => read.evaluate((cell) => {
      const box = cell.getBoundingClientRect();
      return box.top < window.innerHeight && box.bottom > 0;
    }), 'and it is on screen').toBe(true);
    await expect(read.locator('.mei'), 'with its own quote above it').toBeVisible();
    expect(await page.evaluate(() => history.length), 'the contents is the entry before the letter, not a new one').toBe(length + 1);
    expect(seen.errors).toEqual([]);
  });
});

test.describe('theme "folio": the order of the contents', () => {
  /** What the contents shows, in reading order (which is document order), and what the mark says. */
  const shown = (page) => page.evaluate(() => {
    const root = document.getElementById('theme-root');
    const mark = root.querySelector('.yidx button.sort');
    const text = (el) => el.textContent.trim();
    return {
      leaves: [...root.querySelectorAll('.leaves .leaf')].map((leaf) => leaf.id),
      columns: [...root.querySelectorAll('.leaves .cell--letter')].map((cell) => Number(cell.dataset.no)),
      index: [...root.querySelectorAll('.yidx a')].map(text),
      chart: [...root.querySelectorAll('.nb .nb-r .nb-y')].map(text),
      months: [...root.querySelectorAll('.nb .nb-m1, .nb .nb-m2')].map(text),
      pressed: mark.getAttribute('aria-pressed'),
      label: mark.getAttribute('aria-label'),
      stored: sessionStorage.getItem('f221:sort'),
    };
  });
  /** What both orders look like for this archive: the couple's letters one way or the other, the afterword last. */
  function expected(letters) {
    const own = letters.filter((l) => !isGuest(l)).map((l) => l.no);
    const guests = letters.filter(isGuest).map((l) => l.no);
    const years = [];
    for (let y = letters[0].year; y <= Math.max(...letters.filter((l) => !isGuest(l)).map((l) => l.year)); y++) years.push(y);
    const tail = guests.length ? ['跋'] : [];
    const side = (ys, list, step) => ({
      leaves: [...ys.map((y) => `y${y}`), ...(guests.length ? ['ba'] : [])],
      columns: [...list, ...guests],
      index: [...ys.map(String), ...tail],
      step,
    });
    return { newest: side([...years].reverse(), [...own].reverse(), -1), oldest: side(years, own, 1) };
  }
  const expectOrder = async (page, want, why) => {
    const now = await shown(page);
    for (const part of ['columns', 'leaves', 'index']) expect(now[part], `${why}: ${part}`).toEqual(want[part]);
    // the chart also has a row for this year when nothing has been written in it yet, so its rows are counted, not listed
    const rows = now.chart.filter((row) => row !== '跋').map(Number);
    expect(rows.length, `${why}: the chart has a row for every leaf`).toBeGreaterThanOrEqual(want.index.filter((y) => y !== '跋').length);
    expect(rows, `${why}: the chart's years run the same way`).toEqual(rows.map((_, i) => rows[0] + want.step * i));
    if (want.index.includes('跋')) expect(now.chart.at(-1), `${why}: the afterword is the chart's last row`).toBe('跋');
    return now;
  };

  test('the newest letter leads; one mark turns the book round, the afterword staying last', async ({ page }) => {
    await open(page, '/', THEME);
    const letters = await lettersOf(page);
    const { newest, oldest } = expected(letters);
    const first = await expectOrder(page, newest, 'a new visit');
    expect(first.pressed).toBe('false');
    expect(first.label, 'the mark has a name for readers who cannot see it').toMatch(/最新/);
    expect(first.months, 'the chart is drawn the way the leaves run: the end of the year on the right').toEqual(['十二月', '一月']);

    const mark = page.locator('#theme-root .yidx button.sort');
    await expect(mark, 'the mark is on the first screen').toBeInViewport({ ratio: 1 });
    const box = await mark.boundingBox();
    expect(Math.min(box.width, box.height), 'and big enough for a finger').toBeGreaterThanOrEqual(44);
    expect((await mark.innerText()).trim(), 'it is a drawing, not a word').toBe('');

    // by keyboard: the mark keeps the focus, and shows it
    await mark.focus();
    await page.keyboard.press('Enter');
    const turned = await expectOrder(page, oldest, 'after the mark is pressed');
    expect(turned.pressed).toBe('true');
    expect(turned.label).toMatch(/最早/);
    expect(turned.months).toEqual(['一月', '十二月']);
    expect(turned.stored, 'the choice is kept for the visit').toBe('old');
    const focus = await mark.evaluate((el) => ({ on: document.activeElement === el, ring: el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) > 0 }));
    expect(focus, 'the mark still has the focus, with a ring').toEqual({ on: true, ring: true });
    const glyph = (el) => getComputedStyle(el.querySelector('svg')).transform;
    expect(await mark.evaluate(glyph), 'the drawing itself is turned over').not.toBe('none');

    await mark.click();
    const again = await expectOrder(page, newest, 'pressed once more');
    expect(again.pressed).toBe('false');
    expect(again.stored).toBeNull();
    expect(await mark.evaluate(glyph)).toBe('none');
    await expectNoSidewaysScroll(page);
  });

  test('the chosen order lasts the visit; previous and next stay in the order the letters were written', async ({ page, browser, baseURL }) => {
    const seen = watch(page, 'x');
    await open(page, '/', THEME);
    const letters = await lettersOf(page);
    const { newest, oldest } = expected(letters);
    const start = letters.find((l) => l.date === '2024-11-19') || letters[Math.max(1, letters.length - 8)];   // 万天万岁！
    const before = letters[start.no - 2], after = letters[start.no];
    test.skip(!before || !after || [before, start, after].some((l) => l.standalone || isGuest(l)), 'needs three ordinary letters in a row');
    const path = (href) => decodeURI(new URL(href, 'http://x').pathname);

    for (const [name, want, press] of [['newest first', newest, false], ['oldest first', oldest, true]]) {
      if (press) await page.locator('#theme-root .yidx button.sort').click();
      await expectOrder(page, want, name);
      const column = page.locator(`#theme-root .leaves .cell[data-no="${start.no}"] a.col`);
      await column.scrollIntoViewIfNeeded();
      await column.click();
      await expect.poll(() => view(page)).toBe('letter');
      const feet = page.locator('#theme-root .feet');
      expect(path(await feet.locator('a[rel="prev"]').getAttribute('href')), `${name}: previous is the letter written before`).toBe(decodeURI(before.url));
      expect(path(await feet.locator('a[rel="next"]').getAttribute('href')), `${name}: next is the letter written after`).toBe(decodeURI(after.url));
      await expect(page.locator('#theme-root .bar-no b')).toHaveText(String(start.no));

      await feet.locator('a[rel="next"]').click();
      await expect(page.locator('#theme-root .tiji-title')).toHaveAttribute('aria-label', after.title);
      const home = page.locator('#theme-root .feet .cell--home a');
      await home.scrollIntoViewIfNeeded();
      await home.click();
      await expect.poll(() => view(page)).toBe('home');
      await expectOrder(page, want, `${name}, back from a letter`);
      const read = page.locator('#theme-root .leaves .cell.is-read');
      await expect(read, `${name}: the letter just read is marked`).toHaveAttribute('data-no', String(after.no));
      await expect.poll(() => read.evaluate((cell) => {
        const box = cell.getBoundingClientRect();
        return box.top < window.innerHeight && box.bottom > 0;
      }), `${name}: and it is on screen`).toBe(true);
    }

    await page.reload();
    await page.waitForSelector(`html[data-theme-ready="${THEME}"]`);
    const kept = await expectOrder(page, oldest, 'after a reload in the same tab');
    expect(kept.pressed).toBe('true');
    expect(seen.errors).toEqual([]);

    const context = await browser.newContext({ baseURL });
    const visit = await context.newPage();
    await open(visit, '/', THEME);
    const fresh = await expectOrder(visit, newest, 'a new visit starts from the newest letter again');
    expect(fresh.pressed).toBe('false');
    await context.close();
  });
});

test.describe('theme "folio": the year index', () => {
  test('a year brings its leaf to the top; Back returns to where the reader was, Forward to the leaf', async ({ page }) => {
    await open(page, '/', THEME);
    await page.evaluate(() => document.fonts.ready);
    const years = await page.evaluate(() => window.__theme.ctx.letters.years.filter((y) => y.letters.length).map((y) => y.year));
    const year = years[Math.floor(years.length / 2)];
    await page.evaluate(() => window.scrollTo(0, 120));
    const link = page.locator(`#theme-root .yidx a[href="#y${year}"]`);
    await link.click();
    const top = () => page.evaluate((y) => Math.round(document.getElementById(`y${y}`).getBoundingClientRect().top), year);
    await expect.poll(top, `the ${year} leaf is at the top of the screen`).toBeLessThan(40);
    const at = await page.evaluate(() => Math.round(window.scrollY));
    await page.goBack();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), 'Back returns to where the jump started').toBe(120);
    expect(await view(page)).toBe('home');
    await page.goForward();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), 'Forward returns to the leaf').toBe(at);
  });
});

test.describe('theme "folio": a letter', () => {
  test('text sits on the ruled lines and pictures keep their colours and proportions', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const letter = letters.find((l) => l.date === '2016-06-08') || letters[0];      // Hang Zhou: five pictures
    await open(page, letter.url, THEME);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    const pictures = page.locator('#theme-root .letter-body .content-body img');
    const count = await pictures.count();
    for (let i = 0; i < count; i++) {
      await pictures.nth(i).scrollIntoViewIfNeeded();
      await expect.poll(() => pictures.nth(i).evaluate((img) => img.complete && img.naturalWidth > 0), `picture ${i + 1} loads`).toBe(true);
    }
    const report = await page.evaluate(() => {
      const body = document.querySelector('#theme-root .letter-body');
      const content = body.querySelector('.content-body');
      const line = parseFloat(getComputedStyle(body).lineHeight);
      const top = content.getBoundingClientRect().top;
      let off = 0;
      for (const el of content.querySelectorAll('p, li, blockquote, h3, h5')) {
        if (el.closest('.flip-card, .gift-scene, figure')) continue;
        const box = el.getBoundingClientRect();
        if (!box.height) continue;
        const d = ((box.top - top) % line + line) % line;
        off = Math.max(off, Math.min(d, line - d));
      }
      const images = [...content.querySelectorAll('img')].map((img) => {
        const style = getComputedStyle(img);
        const box = img.getBoundingClientRect();
        const frame = 2 * (parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth));
        return { filter: style.filter, shape: (box.width - frame) / (box.height - frame), natural: img.naturalWidth / img.naturalHeight };
      });
      return { line, off, images, height: document.documentElement.scrollHeight };
    });
    expect(report.off, `paragraphs start on a rule (line height ${report.line}px)`).toBeLessThan(1);
    expect(report.images.length).toBe(count);
    for (const image of report.images) {
      expect(image.filter, 'pictures inside a letter are not printed in grey').toBe('none');
      expect(Math.abs(image.shape - image.natural), 'and keep their proportions').toBeLessThan(0.05);
    }
    expect(Math.abs(report.height - before), 'the letter does not jump while its pictures arrive').toBeLessThanOrEqual(2);
    await expectNoSidewaysScroll(page);
  });

  test('at desktop width the lines of a paragraph reach the right margin of the sheet', async ({ browser, request, baseURL }) => {
    // WebKit's text-wrap: pretty broke every line of a justified Chinese paragraph three or four characters early.
    // The WebKit project is a phone, so this opens its own desktop-sized window in whatever engine is running.
    const { letters } = await getIsland(request);
    const letter = letters.find((l) => l.date === '2024-11-19') || letters[letters.length - 1];
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await open(page, letter.url, THEME);
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const body = document.querySelector('#theme-root .letter-body');
      const style = getComputedStyle(body);
      const edge = body.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      let worst = 0, lines = 0;
      for (const p of body.querySelectorAll('.content-body > p:not(.fo-sign):not(.fo-voice)')) {
        const range = document.createRange();
        range.selectNodeContents(p);
        const ends = new Map();                                   // one entry per line: where its last character ends
        for (const box of range.getClientRects()) if (box.width >= 1) ends.set(Math.round(box.top / 4), Math.max(ends.get(Math.round(box.top / 4)) || 0, box.right));
        const rows = [...ends.keys()].sort((a, b) => a - b);
        rows.pop();                                               // the last line of a paragraph is allowed to be short
        for (const row of rows) { lines++; worst = Math.max(worst, edge - ends.get(row)); }
      }
      return { worst, lines, size: parseFloat(style.fontSize) };
    });
    expect(report.lines, 'the letter has paragraphs of more than one line').toBeGreaterThan(5);
    expect(report.worst, `no line stops more than three characters short of the margin (font size ${report.size}px)`).toBeLessThan(report.size * 3);
    await context.close();
  });

  test('a sign-off framed by long runs of dashes keeps its words and stays on one line each', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const letter = letters.find((l) => l.date === '2017-02-21');                    // One Year: 「------ 2月20日 小雨 下午六点半 ------」
    test.skip(!letter, 'that letter is not in the archive');
    await open(page, letter.url, THEME);
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const body = document.querySelector('#theme-root .letter-body');
      const line = parseFloat(getComputedStyle(body).lineHeight);
      return [...body.querySelectorAll('p.fo-sign')].filter((p) => p.querySelector('.fo-rule')).map((p) => ({
        text: p.textContent, rules: p.querySelectorAll('.fo-rule').length, lines: Math.round(p.getBoundingClientRect().height / line),
      }));
    });
    expect(report.length, 'the two closing lines are set as sign-offs').toBe(2);
    expect(report[0].text, 'the words are the letter\'s own, dashes included').toMatch(/^[-–—]{4,}\s*2月20日 小雨 下午六点半\s*[-–—]{4,}$/);
    for (const row of report) {
      expect(row.rules, 'a rule on either side').toBe(2);
      expect(row.lines, `「${row.text.replace(/[-–—]/g, '').trim()}」 fits on one line`).toBe(1);
    }
    await expectNoSidewaysScroll(page);
  });

  test('the co-written letter names both writers, and the flip card turns without a transition', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const both = letters.find((l) => (l.authors || []).length > 1);
    if (both) {
      await open(page, both.url, THEME);
      for (const name of both.authors) await expect(page.locator('#theme-root .counts')).toContainText(name);
    }
    const card = letters.find((l) => l.date === '2026-08-12');
    test.skip(!card, 'no flip card in the archive');
    await open(page, card.url, THEME);
    const inner = page.locator('#theme-root .letter-body .flip-card-inner');
    expect(await inner.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration)), 'this theme does not move').toBe(0);
  });
});
