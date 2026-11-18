// What the theme 「笺」 (folio) promises beyond the contract every theme is held to in
// themes.spec.mjs: what a column of the contents says, where the guest letter sits, how the
// reader moves between the contents and a letter, and that a letter is set on its ruled lines
// with its pictures as the couple made them.

import { existsSync } from 'node:fs';
import { test, expect, firefox } from '@playwright/test';
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

// A reader's browser can enlarge the text and nothing else (Firefox "zoom text only", a system
// text-size setting): every font is drawn larger, a line-height given in px grows with it, boxes
// and margins keep their size. The theme is built on pixel measures that hold a given number of
// characters, so it measures how much larger a character really is and scales those measures
// (assets/themes/folio/README.md, 「文字被浏览器放大」).
test.describe('theme "folio": text enlarged by the browser', () => {
  /** The contents: where the red lines above the columns are, and whether what a column holds stays in it. */
  const contents = (page) => page.evaluate(() => {
    const root = document.getElementById('theme-root');
    const box = (el) => el.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const years = [...root.querySelectorAll('.yidx a, .yidx button')].map(box);
    const report = { notes: 0, aboveMargin: [], onYearRow: [], offPage: [], outOfLeaf: [], outOfColumn: [], text: '' };
    for (const note of root.querySelectorAll('.mei')) {            // every one of them: those that only show on hover as well
      const b = box(note), cell = box(note.parentNode), leaf = box(note.closest('.leaf'));
      if (!b.width) continue;
      report.notes++;
      report.text += note.textContent.replace(/\s+/g, '');
      const margin = parseFloat(getComputedStyle(note.closest('.leaf')).paddingTop);   // the row above (or the year row) ends where the margin starts
      const q = note.dataset.q.slice(0, 10);
      if (cell.top - b.top > margin + 0.6) report.aboveMargin.push(`${q} (${Math.round(b.height)}px in a margin of ${Math.round(margin)}px)`);
      if (b.left < leaf.left - 0.5 || b.right > leaf.right + 0.5) report.outOfLeaf.push(`${q} (${Math.round(b.width)}px wide, its leaf ${Math.round(leaf.width)}px)`);   // two leaves side by side: not into the other one
      if (years.some((y) => hit(b, y))) report.onYearRow.push(q);
      if (b.top + window.scrollY < 0 || b.left < 0 || b.right > window.innerWidth) report.offPage.push(q);
    }
    for (const part of root.querySelectorAll('.cell > .col > *, .cell--name .name, .cell--sub > *')) {
      const b = box(part), cell = box(part.closest('.cell'));
      if (b.width && (b.left < cell.left - 1 || b.right > cell.right + 1 || b.top < cell.top - 1 || b.bottom > cell.bottom + 1)) report.outOfColumn.push(`${part.className}: ${part.textContent.trim().slice(0, 10)}`);
    }
    report.columns = getComputedStyle(root.querySelector('.leaf--title .cols')).gridTemplateColumns.split(' ').length;
    report.designed = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--n'), 10);   // as many as the stylesheet gives this width
    report.scale = root.style.getPropertyValue('--ts');
    return report;
  });
  /** A letter: how far apart its lines really are, how far apart the rules are drawn, and where the lines sit on them. */
  const paper = (page) => page.evaluate(() => {
    const body = document.querySelector('#theme-root .letter-body');
    const content = body.querySelector('.content-body');
    const sheet = (el) => {                                         // a ruled surface: the paper, or the front of the card
      const style = getComputedStyle(el);
      return { rules: parseFloat(style.backgroundSize.split(' ').pop()), top: el.getBoundingClientRect().top + parseFloat(style.borderTopWidth) };
    };
    const main = sheet(body);
    // the real distance between two lines: the tops of the lines of the longest paragraph
    const longest = [...content.querySelectorAll('p')].filter((p) => !p.closest('.flip-card-back')).sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    const range = document.createRange();
    range.selectNodeContents(longest);
    const tops = [...new Set([...range.getClientRects()].filter((r) => r.width > 4).map((r) => Math.round(r.top * 100) / 100))].sort((a, b) => a - b);
    const gaps = tops.slice(1).map((t, i) => t - tops[i]).filter((gap) => gap > 4);
    const designed = parseFloat(getComputedStyle(body.closest('.letter')).getPropertyValue('--lh'));   // the line pitch at normal text size
    const report = { rules: main.rules, designed, lines: gaps.length + 1, pitch: gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length, offRule: 0, offHeight: 0, card: null };
    for (const el of content.querySelectorAll('p, li, blockquote, h3, h5')) {
      if (el.closest('.flip-card, .gift-scene, figure')) continue;
      const b = el.getBoundingClientRect();
      if (!b.height) continue;
      const d = ((b.top - main.top) % main.rules + main.rules) % main.rules, tall = b.height % main.rules;
      report.offRule = Math.max(report.offRule, Math.min(d, main.rules - d));
      report.offHeight = Math.max(report.offHeight, Math.min(tall, main.rules - tall));
    }
    const front = content.querySelector('.flip-card-front');
    if (front) {                                                    // the card is a small sheet with rules of its own; its lines start one pixel (its border) above a rule
      const card = sheet(front);
      report.card = { rules: card.rules, off: 0 };
      for (const p of front.querySelectorAll('p')) {
        const d = ((p.getBoundingClientRect().top + 1 - card.top) % card.rules + card.rules) % card.rules;
        report.card.off = Math.max(report.card.off, Math.min(d, card.rules - d));
      }
    }
    return report;
  });

  // The desktop the owner reads on (1344 wide) at two sizes, and a phone, where a tenth more is already enough to need fewer columns.
  for (const [percent, width, height] of [[120, 1344, 760], [150, 1344, 760], [110, 402, 874]]) {
    test(`at ${percent} % text size, ${width} wide, the red lines keep clear of the year row and a letter stays on its rules`, async ({ baseURL, request }, testInfo) => {
      // Only Firefox can be told to enlarge text alone, and only when it is started: the test starts its own, once.
      test.skip(testInfo.project.name !== 'firefox', 'starts its own Firefox; once is enough');
      test.skip(!existsSync(firefox.executablePath()), 'Playwright\'s Firefox is not installed');
      const { letters } = await getIsland(request);
      const browser = await firefox.launch({ firefoxUserPrefs: { 'ui.textScaleFactor': percent, 'browser.display.os-zoom-behavior': 2, 'network.prefetch-next': false } });
      try {
        const context = await browser.newContext({ baseURL, viewport: { width, height }, hasTouch: width < 720, locale: 'zh-CN', timezoneId: 'America/Los_Angeles' });
        const page = await context.newPage();
        const seen = watch(page, baseURL);
        await open(page, '/', THEME);
        await page.evaluate(() => document.fonts.ready);
        const drawn = await page.evaluate(() => {                    // the text really is larger, the boxes are not
          const probe = document.getElementById('theme-root').appendChild(document.createElement('div'));
          probe.style.cssText = 'position:absolute;font:100px/1 serif;width:100px';
          probe.textContent = '日';
          const b = probe.getBoundingClientRect();
          probe.remove();
          return { height: b.height, width: b.width };
        });
        expect(drawn, 'this Firefox enlarges text and nothing else').toEqual({ height: percent, width: 100 });

        const home = await contents(page);
        expect(Number(home.scale), 'the theme measured the scale').toBeCloseTo(percent / 100, 2);
        expect(home.notes, 'the contents has its red lines').toBeGreaterThan(10);
        expect(home.onYearRow, 'no red line touches the row of years').toEqual([]);
        expect(home.aboveMargin, 'every red line stays inside the top margin of its row').toEqual([]);
        expect(home.offPage, 'and on the page').toEqual([]);
        expect(home.outOfLeaf, 'and inside its own leaf').toEqual([]);
        expect(home.outOfColumn, 'titles, notes, day numbers and the name of the book stay inside their columns').toEqual([]);
        expect(home.columns, 'larger type, fewer columns to a leaf').toBeLessThan(home.designed);
        await expectNoSidewaysScroll(page);

        for (const date of ['2016-06-08', '2026-08-12']) {           // Hang Zhou: long, five pictures; 木婚快乐: the card
          const letter = letters.find((l) => l.date === date);
          if (!letter) continue;
          await open(page, letter.url, THEME);
          await page.waitForLoadState('networkidle');
          await page.evaluate(() => document.fonts.ready);
          const pictures = page.locator('#theme-root .letter-body .content-body figure img');
          for (let i = 0; i < await pictures.count(); i++) {
            await pictures.nth(i).scrollIntoViewIfNeeded();
            await expect.poll(() => pictures.nth(i).evaluate((img) => img.complete && img.naturalWidth > 0), `picture ${i + 1} loads`).toBe(true);
          }
          await expect.poll(async () => (await paper(page)).offRule, `${date}: every paragraph starts on a rule`).toBeLessThan(0.5);
          const sheet = await paper(page);
          expect(sheet.lines, `${date}: the longest paragraph has several lines`).toBeGreaterThan(2);
          expect(Math.abs(sheet.pitch - sheet.rules), `${date}: the rules are as far apart as the lines (${sheet.pitch}px, rules every ${sheet.rules}px)`).toBeLessThan(0.02);
          expect(sheet.rules, `${date}: and further apart than at normal text size`).toBeGreaterThan(sheet.designed * percent / 100 - 1);
          expect(sheet.rules % 1, `${date}: a whole number of pixels: a fractional pitch is drawn with rules missing or drifting`).toBe(0);
          expect(sheet.offHeight, `${date}: paragraphs are whole lines tall`).toBeLessThan(0.5);
          if (sheet.card) {
            expect(sheet.card.rules, `${date}: the card is ruled like the paper`).toBe(sheet.rules);
            expect(sheet.card.off, `${date}: and its lines sit on its rules`).toBeLessThan(0.5);
          }
          await expectNoSidewaysScroll(page);
        }
        expect(seen.errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }

  test('a red line too tall for its margin is set with fewer characters to a line', async ({ page }) => {
    // No engine but Firefox can be made to enlarge text alone, but the fitting does not depend on why the type
    // is too large: here the type of the red lines is made a quarter larger than the margin was drawn for
    // (what a minimum font size does, or a scale the theme could not measure), and the page is laid out again.
    await open(page, '/', THEME);
    await page.evaluate(() => document.fonts.ready);
    const before = await contents(page);
    expect(before.scale, 'at normal text size the theme scales nothing').toBe('');
    expect(before.aboveMargin, 'as designed, ten characters to a line fit the margin').toEqual([]);
    const size = await page.locator('#theme-root .mei').first().evaluate((note) => parseFloat(getComputedStyle(note).fontSize));
    await page.addStyleTag({ content: `#theme-root .mei{font-size:${size * 1.25}px !important}` });
    expect((await contents(page)).aboveMargin.length, 'larger type: lines of ten characters no longer fit').toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));       // the theme lays the contents out again
    await expect.poll(async () => (await contents(page)).aboveMargin, 'the lines are set again, shorter, until they fit').toEqual([]);
    const after = await contents(page);
    expect(after.onYearRow, 'none of them touches the row of years').toEqual([]);
    expect(after.text, 'and not a character is lost').toBe(before.text);
    expect(after.columns, 'the leaves themselves are left alone').toBe(before.columns);
    await expectNoSidewaysScroll(page);
  });

  test('a red line wider than its leaf has its lines set closer, not pushed into the next leaf', async ({ page }) => {
    // Years with few letters share a spread, each on half a leaf; at 150 % text on a phone a red line of six lines
    // is wider than such a half leaf. Here the lines of every red line are set twelve characters apart instead, so
    // that many are wider than their leaf, and the contents is laid out again.
    await open(page, '/', THEME);
    await page.evaluate(() => document.fonts.ready);
    const before = await contents(page);
    expect(before.outOfLeaf, 'as designed, every red line lies within its leaf').toEqual([]);
    await page.addStyleTag({ content: '#theme-root .leaf .mei{line-height:12}' });
    expect((await contents(page)).outOfLeaf.length, 'lines far apart: wider than their leaf').toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect.poll(async () => (await contents(page)).outOfLeaf, 'the lines are set closer until each fits its leaf').toEqual([]);
    const after = await contents(page);
    expect(after.aboveMargin, 'and stay inside the top margin').toEqual([]);
    expect(after.onYearRow, 'clear of the row of years').toEqual([]);
    expect(after.text, 'with every character').toBe(before.text);
    await expectNoSidewaysScroll(page);
  });

  test('at normal text size a letter is left exactly as the stylesheet sets it', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    await open(page, (letters.find((l) => l.date === '2026-08-12') || letters[0]).url, THEME);
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const root = document.getElementById('theme-root'), letter = root.querySelector('.letter'), body = root.querySelector('.letter-body');
      const style = getComputedStyle(body), nominal = getComputedStyle(letter).getPropertyValue('--lh').trim();
      return { scale: root.style.getPropertyValue('--ts'), marked: root.hasAttribute('data-ts'), inline: letter.getAttribute('style') || '', nominal, lineHeight: style.lineHeight, rules: style.backgroundSize.split(' ').pop() };
    });
    expect(report.scale + report.inline, 'nothing is written on the page or on the letter').toBe('');
    expect(report.marked).toBe(false);
    expect(report.lineHeight, 'the line height is the designed one').toBe(report.nominal);
    expect(report.rules, 'and so is the distance between the rules').toBe(report.nominal);
  });
});
