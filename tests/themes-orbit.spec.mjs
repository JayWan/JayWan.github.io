// 「绕日」 orbit: what this theme promises beyond the shared contract (tests/themes.spec.mjs).
// Each test is one of the defects the mockup was sent back for; see assets/themes/orbit/README.md.

import { test, expect } from '@playwright/test';
import { getIsland, open, watch, expectNoSidewaysScroll } from './helpers.mjs';

const THEME = 'orbit';
const urlOf = async (request, find) => (await getIsland(request)).letters.find(find).url;
const wide = (page) => page.viewportSize().width >= 1200;

test.describe('theme "orbit", its own promises', () => {
  test('the ephemeris lists every letter and every year, truncates nothing, and says 没有信', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    await open(page, '/', THEME);
    const rows = page.locator('#theme-root .eph a.row');
    await expect(rows).toHaveCount(letters.length);
    const years = new Set(letters.map((l) => Number(l.date.slice(0, 4))));
    const empty = [];
    for (let y = Math.min(...years); y <= Math.max(...years); y++) if (!years.has(y)) empty.push(y);
    await expect(page.locator('#theme-root .eph .row-none')).toHaveCount(empty.length);
    for (const row of await page.locator('#theme-root .eph .row-none').all()) await expect(row).toContainText('没有信');
    // every title and every song is there in full: no ellipsis, nothing cut
    const cut = await page.evaluate(() => [...document.querySelectorAll('#theme-root .eph .c-title, #theme-root .eph .c-song')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis').map((el) => el.textContent));
    expect(cut, 'titles and songs shown in full').toEqual([]);
    for (const l of letters) if (l.song) await expect(rows.filter({ hasText: l.title }).first()).toContainText(l.song.title);
    await expectNoSidewaysScroll(page);
  });

  test('every glyph is explained: him, her, both, guest', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    await open(page, '/', THEME);
    const legend = page.locator('#theme-root .legend');
    const count = (name) => letters.filter((l) => (l.authors || [l.author]).join('+') === name).length;
    await expect(legend).toContainText(`他 Pikajay${count('Pikajay')} 封`);
    await expect(legend).toContainText(`她 Pikachi${count('Pikachi')} 封`);
    await expect(legend).toContainText(`合写${count('Pikajay+Pikachi')} 封`);
    await expect(legend).toContainText('访客');
    // the letter two people wrote says so, and names both
    await open(page, await urlOf(request, (l) => (l.authors || []).length > 1), THEME);
    await expect(page.locator('#theme-root .kicker')).toContainText('Pikajay 起头 · Pikachi 写');
  });

  test('a selected letter turns amber and draws the arc since the letter before it', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const silent = letters.find((l) => l.date === '2021-07-04');           // 838 days after the letter before it: more than two laps
    await open(page, '/', THEME);
    const arc = () => page.evaluate(() => { const p = document.querySelector('#theme-root .chart .sel-trace'); return p ? p.getTotalLength() : 0; });
    const today = await arc();
    await page.locator(`#theme-root .eph a.row[data-no="${silent.no}"]`).focus();   // keyboard focus selects, like hover and tap do
    await expect(page.locator('#theme-root .eph a.row.is-sel')).toHaveAttribute('data-no', String(silent.no));
    await expect(page.locator('#theme-root .readout .ro-title')).toHaveText(silent.title);
    const geometry = await page.evaluate(() => {
      const svg = document.querySelector('#theme-root .chart svg');
      const ring = svg.querySelector('circle.la');                        // the outer edge of the calendar ruler
      return { length: svg.querySelector('.sel-trace').getTotalLength(), outer: 2 * Math.PI * ring.r.baseVal.value };
    });
    expect(geometry.length, 'the arc is far longer than the one that led to today').toBeGreaterThan(today + 200);
    expect(geometry.length, 'two laps and more, on rings well inside the ruler').toBeGreaterThan(geometry.outer * 0.9);
    // and 今日 brings the day's readout back
    await page.locator('#theme-root .ro-reset').click();
    await expect(page.locator('#theme-root .ro-today')).toBeVisible();
    await expect(page.locator('#theme-root .eph a.row.is-sel')).toHaveCount(0);
  });

  test('a letter shows its real day, its calendar season and its lap', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const oneYear = letters.find((l) => l.title === 'One Year');
    await open(page, oneYear.url, THEME);
    const data = page.locator('#theme-root .l-data');
    await expect(data).toContainText('2017·02·21');                        // not the 01·21 of its address
    await expect(data).toContainText('第 2 圈');
    await expect(data).toContainText('T+451');                            // 2015·11·28 → 2017·02·21
    const june = letters.find((l) => l.date === '2016-06-08');             // 「夏花烂漫」: summer, although the solstice is 13 days off
    await open(page, june.url, THEME);
    await expect(page.locator('#theme-root .l-data')).toContainText('季节夏');
    await expect(page.locator('#theme-root .l-data')).toContainText('夏至前 13 d');
    await open(page, letters[0].url, THEME);                               // written before 2016·2·21
    await expect(page.locator('#theme-root .l-data')).toContainText('入轨前');
  });

  test('pictures inside a letter are plates: framed, numbered, cyanotype until the reader asks for colour', async ({ page, request, baseURL }) => {
    const seen = watch(page, baseURL);
    const june = await urlOf(request, (l) => l.date === '2016-06-08');     // Hang Zhou: five pictures
    await open(page, june, THEME);
    const figures = page.locator('#theme-root .letter-body figure.o-fig');
    await expect(figures).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const figure = figures.nth(i);
      await figure.scrollIntoViewIfNeeded();
      await expect(figure.locator('figcaption')).toContainText(`·${i + 1}`);
      await expect.poll(() => figure.locator('img').evaluate((img) => img.naturalWidth), `picture ${i + 1} loads`).toBeGreaterThan(0);
      expect(await figure.locator('img').evaluate((img) => getComputedStyle(img).filter)).toContain('grayscale');
    }
    await expectNoSidewaysScroll(page);
    // one tap on 原色: every picture on the page is in its own colours, and the choice is kept
    await figures.first().locator('.cap-toggle').click();
    await expect(page.locator('#theme-root')).toHaveClass(/in-colour/);
    expect(await figures.nth(2).locator('img').evaluate((img) => getComputedStyle(img).filter)).toBe('none');
    await page.reload();
    await page.waitForSelector(`html[data-theme-ready="${THEME}"]`);
    await expect(page.locator('#theme-root')).toHaveClass(/in-colour/);
    await page.locator('#theme-root .plate .cap-toggle').click();
    await expect(page.locator('#theme-root')).not.toHaveClass(/in-colour/);
    expect(seen.errors).toEqual([]);
  });

  test('the letter itself is on the first screen of a desktop', async ({ page, request }) => {
    test.skip(!wide(page), 'the two-column letter page is the desktop layout');
    for (const find of [(l) => l.date === '2024-11-19', (l) => l.quiet, (l) => l.title.length > 12]) {
      await open(page, await urlOf(request, find), THEME);
      const top = await page.evaluate(() => document.querySelector('#theme-root .letter-body .content-body > *').getBoundingClientRect().top);
      expect(top, 'the first line of the letter starts well above the fold').toBeLessThan(600);
    }
  });

  test('the page for an address without a letter is one centred column, with a way back', async ({ page }) => {
    await open(page, '/404/', THEME);
    const lost = page.locator('#theme-root .lost-body');
    await expect(lost).toContainText('这个位置上没有信');
    await expect(lost.locator('a[href="/"]')).toBeVisible();
    const off = await page.evaluate(() => [...document.querySelectorAll('#theme-root .lost-body > *')].map((el) => {
      const box = el.getBoundingClientRect();
      return Math.abs((box.left + box.right) / 2 - window.innerWidth / 2);
    }));
    expect(Math.max(...off), 'everything sits on the centre line').toBeLessThan(8);
    await expectNoSidewaysScroll(page);
  });

  test('nothing moves under prefers-reduced-motion', async ({ browser, baseURL, request }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 402, height: 874 } });
    const page = await context.newPage();
    for (const path of ['/', await urlOf(request, (l) => l.quiet)]) {
      await open(page, path, THEME);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length), `${path}: running animations`).toBe(0);
    }
    await context.close();
  });
});
