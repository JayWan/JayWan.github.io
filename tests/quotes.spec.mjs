// The lines picked from the letters: several per letter (front matter `quotes:`), one of them
// shown per page load (_includes/letters-data.html, assets/js/core/data.js).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { getIsland, open, rewriteIsland, root } from './helpers.mjs';

/** Math.random gives `r` on every call from now on, in every page this browser page loads. */
const fixDice = (page, r) => page.addInitScript((value) => { Math.random = () => value; }, r);

/** The line the reference theme shows for each letter on the home page: { no: text }. */
const shownOnHome = (page) => page.locator('#theme-root li[data-no]').evaluateAll((rows) => Object.fromEntries(
  rows.map((li) => [li.dataset.no, (li.querySelector('q') || {}).textContent || null])));

test('the island lists every line of a letter, and its first one as before', async ({ request, browserName }) => {
  test.skip(browserName !== 'chromium', 'a check of the built page, run once');
  const { letters } = await getIsland(request);
  for (const letter of letters) {
    const where = `letter ${letter.no} (${letter.title})`;
    expect(Array.isArray(letter.quotes), where).toBe(true);
    for (const line of letter.quotes) expect(typeof line === 'string' && line.trim() !== '', `${where}: a line is a non-empty string`).toBe(true);
    expect(new Set(letter.quotes).size, `${where}: no line twice`).toBe(letter.quotes.length);
    expect(letter.quote, `${where}: quote is the first line, or null`).toBe(letter.quotes.length ? letter.quotes[0] : null);
  }
  expect(letters.filter((l) => l.quotes.length > 1).length, 'the letters of the two of them have several lines each').toBeGreaterThanOrEqual(31);
  // a letter may still say `quote: "…"` (one line) instead of `quotes:` (a list)
  expect(readFileSync(path.join(root, '_includes/letters-data.html'), 'utf8')).toContain('post.quotes | default: post.quote');
});

test('the core draws one line per letter with the dice it is given', async ({ page }) => {
  await open(page, '/', 'probe');
  const got = await page.evaluate(async () => {
    const { enrich, readIsland } = await import('/assets/js/core/data.js');
    const island = readIsland();
    const draw = (random, change) => {
      const copy = JSON.parse(JSON.stringify(island));
      if (change) change(copy.letters);
      return enrich(copy, new Date(), random).letters;
    };
    // the same number for every letter: the line at that fraction of its list
    const exact = [0, 0.2, 0.5, 0.999].every((r) => draw(() => r).every((l) => l.quote === (l.quotes.length ? l.quotes[Math.floor(r * l.quotes.length)] : null)));
    // sweep the dice from 0 to 1: every line of every letter turns up, and nothing else
    const seen = island.letters.map(() => new Set());
    for (let i = 0; i < 60; i++) draw(() => (i + 0.5) / 60).forEach((l, at) => seen[at].add(l.quote));
    const all = draw(() => 0).every((l, at) => seen[at].size === Math.max(1, l.quotes.length) && l.quotes.every((line) => seen[at].has(line)));
    // each letter throws for itself
    let n = 0;
    const apart = draw(() => (n++ % 5) / 5).filter((l) => l.quotes.length === 5).map((l) => l.quotes.indexOf(l.quote));
    // dice that are not dice: the first line
    const junk = [() => 1, () => -0.1, () => NaN, () => undefined, () => 'x'].every((random) => draw(random).every((l) => l.quote === (l.quotes[0] || null)));
    // one line, no line, a page from before there were several, and things that are not lines
    const edge = draw(() => 0.99, (letters) => {
      Object.assign(letters[0], { quotes: ['只有这一句'], quote: '只有这一句' });
      Object.assign(letters[1], { quotes: [], quote: null });
      delete letters[2].quotes; letters[2].quote = '从前只有一句';
      delete letters[3].quotes; letters[3].quote = null;
      Object.assign(letters[4], { quotes: ['', '  ', null, 7, '留下的'], quote: '' });
    }).slice(0, 5).map((l) => [l.quotes, l.quote]);
    return { exact, all, apart: new Set(apart).size, junk, edge };
  });
  expect(got.exact).toBe(true);
  expect(got.all, 'every line of every letter can be drawn').toBe(true);
  expect(got.apart, 'letters draw independently').toBeGreaterThan(1);
  expect(got.junk).toBe(true);
  expect(got.edge).toEqual([[['只有这一句'], '只有这一句'], [[], null], [['从前只有一句'], '从前只有一句'], [[], null], [['留下的'], '留下的']]);
});

test('over many loads every line of every letter is shown', async ({ page, request }) => {
  test.slow();
  const { letters } = await getIsland(request);
  const most = Math.max(...letters.map((l) => l.quotes.length));
  const loads = most * 2;                                   // dice at (i + ½) / loads reach every line of a list up to `most` long
  const seen = new Map(letters.map((l) => [String(l.no), new Set()]));
  for (let i = 0; i < loads; i++) {
    await fixDice(page, (i + 0.5) / loads);                 // (the newest script wins: it is added last and runs last)
    await open(page, '/', 'probe');
    for (const [no, line] of Object.entries(await shownOnHome(page))) seen.get(no).add(line);
  }
  for (const letter of letters) {
    expect([...seen.get(String(letter.no))].sort(), `letter ${letter.no} (${letter.title})`).toEqual((letter.quotes.length ? [...letter.quotes] : [null]).sort());
  }
});

test('one page load shows one line per letter: the list and the letter agree, also after going back and forth', async ({ page, request }) => {
  const { letters } = await getIsland(request);
  const several = letters.filter((l) => l.quotes.length > 1 && !l.standalone);
  const a = several[several.length - 1];
  const b = several[several.length - 2];
  await open(page, '/', 'probe');                           // the real dice
  const home = await shownOnHome(page);
  for (const letter of letters) {
    if (letter.quotes.length) expect(letter.quotes, `letter ${letter.no}`).toContain(home[letter.no]);
    else expect(home[letter.no]).toBeNull();
  }
  const held = () => page.evaluate(() => Object.fromEntries(window.__theme.ctx.letters.map((l) => [l.no, l.quote])));
  expect(await held()).toEqual(home);

  const onLetter = page.locator('#theme-root .p-letter .p-quote q');
  await page.evaluate(() => { window.__sameDocument = true; });
  for (const letter of [a, b, a]) {
    await page.evaluate((url) => window.__theme.ctx.router.go(url), letter.url);
    await expect(onLetter, `${letter.title}: the line the list showed`).toHaveText(home[letter.no]);
    await page.evaluate(() => window.__theme.ctx.router.go('/'));
    await expect(page.locator('#theme-root li[data-no]').first()).toBeVisible();
    expect(await shownOnHome(page)).toEqual(home);
  }
  expect(await held()).toEqual(home);
  expect(await page.evaluate(() => window.__sameDocument), 'all of it without loading the page again').toBe(true);

  // opened directly, a letter shows one of its own lines too
  await open(page, a.url, 'probe');
  expect(a.quotes).toContain(await onLetter.textContent());
});

test('a letter with one line shows it on every load, a letter with none shows none', async ({ page, request, baseURL }) => {
  const { letters } = await getIsland(request);
  const ordinary = letters.filter((l) => !l.standalone && !l.quiet);
  const [one, none, old] = [ordinary[2], ordinary[3], ordinary[4]];
  await rewriteIsland(page, baseURL, (data) => {
    for (const letter of data.letters) {
      if (letter.no === one.no) Object.assign(letter, { quotes: ['只有这一句'], quote: '只有这一句' });
      if (letter.no === none.no) Object.assign(letter, { quotes: [], quote: null });
      if (letter.no === old.no) { delete letter.quotes; letter.quote = '从前只有一句'; }
    }
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  for (const r of [0, 0.5, 0.99]) {
    await fixDice(page, r);
    await open(page, '/', 'probe');
    const home = await shownOnHome(page);
    expect([home[one.no], home[none.no], home[old.no]], `dice at ${r}`).toEqual(['只有这一句', null, '从前只有一句']);
  }
  await open(page, none.url, 'probe');
  await expect(page.locator('#theme-root .p-letter h1')).toHaveText(none.title);
  await expect(page.locator('#theme-root .p-letter .p-quote')).toHaveCount(0);
  await open(page, one.url, 'probe');
  await expect(page.locator('#theme-root .p-letter .p-quote q')).toHaveText('只有这一句');
  expect(errors).toEqual([]);
});
