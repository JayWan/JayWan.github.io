// The core's own behaviour, exercised through the reference theme `probe`:
// the player (ARCHITECTURE §5.3), the router's corner cases (§5.2) and ctx.img().

import { test, expect } from '@playwright/test';
import { getIsland, samplePages, watch } from './helpers.mjs';

const ctx = (page, fn, arg) => page.evaluate(`(${fn})(window.__theme.ctx, ${JSON.stringify(arg ?? null)})`);
const playerState = (page) => ctx(page, (c) => { const s = c.player.state; return { no: s.letter && s.letter.no, playing: s.playing, time: s.time, duration: s.duration, loading: s.loading, error: s.error }; });

async function openProbe(page, path = '/') {
  await page.goto(`${path}?theme=probe`);
  await page.waitForSelector('html[data-theme-ready="probe"]');
}

test.describe('player', () => {
  test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', "Playwright's WebKit on Linux cannot decode MP3"));

  test('toggle, pause, seek, next, prev; and nothing starts by itself when a song ends', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    const seen = watch(page, baseURL);
    await openProbe(page);
    expect(await playerState(page)).toEqual({ no: null, playing: false, time: 0, duration: 0, loading: false, error: null });
    await ctx(page, (c) => { window.__events = []; c.player.on('change', (s) => window.__events.push(['change', s.playing])); c.player.on('time', () => window.__events.push(['time', performance.now()])); });

    // a click on a control marked data-play starts that letter's song
    const second = letters[letters.length - 2];
    await page.locator(`#theme-root [data-play="${second.no}"]`).click();
    await expect.poll(async () => (await playerState(page)).playing).toBe(true);
    let s = await playerState(page);
    expect(s.no).toBe(second.no);
    expect(Math.abs(s.duration - second.song.duration), 'duration comes from the file').toBeLessThan(2);
    expect(seen.audio().length).toBeGreaterThan(0);

    // pause / resume through toggle() without an argument
    await ctx(page, (c) => c.player.toggle());
    await expect.poll(async () => (await playerState(page)).playing).toBe(false);
    await ctx(page, (c) => c.player.toggle());
    await expect.poll(async () => (await playerState(page)).playing).toBe(true);

    // seek
    await ctx(page, (c) => c.player.seek(60));
    await expect.poll(async () => (await playerState(page)).time).toBeGreaterThan(59);
    expect((await playerState(page)).time).toBeLessThan(70);

    // next / prev walk the letters that have a song
    await ctx(page, (c) => c.player.next());
    await expect.poll(async () => (await playerState(page)).no).toBe(letters[letters.length - 1].no);
    await ctx(page, (c) => c.player.next());                               // already at the newest: stays
    expect((await playerState(page)).no).toBe(letters[letters.length - 1].no);
    await ctx(page, (c) => c.player.prev());
    await expect.poll(async () => (await playerState(page)).no).toBe(second.no);
    await expect.poll(async () => (await playerState(page)).playing).toBe(true);

    // 'time' fires at most four times a second
    await page.waitForTimeout(1200);
    const times = (await page.evaluate(() => window.__events)).filter((e) => e[0] === 'time').map((e) => e[1]);
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g < 2000);
    expect(Math.min(...gaps), 'time events are throttled').toBeGreaterThanOrEqual(200);

    // the end of a song is the end: one letter, one song
    await ctx(page, (c) => c.player.seek(c.player.state.duration - 1.5));
    await expect.poll(async () => { const now = await playerState(page); return !now.playing && now.time === 0; }, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(800);
    s = await playerState(page);
    expect([s.no, s.playing], 'still the same letter, not playing').toEqual([second.no, false]);
    expect(seen.errors).toEqual([]);
  });

  test('a missing song file is reported as an error, not as an exception', async ({ page }) => {
    await page.route('**/*.mp3', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }));
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await openProbe(page);
    await page.locator('#theme-root [data-play]').first().click();
    await expect.poll(async () => (await playerState(page)).error).toBe('failed');
    expect((await playerState(page)).playing).toBe(false);
    await expect(page.locator('#theme-root .p-bar-title')).toContainText('放不出来');
    expect(errors).toEqual([]);
  });

  test('the lock screen knows what is playing (Media Session)', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    await openProbe(page);
    await page.locator('#theme-root [data-play]').first().click();
    await expect.poll(async () => (await playerState(page)).playing).toBe(true);
    const meta = await page.evaluate(() => { const m = navigator.mediaSession.metadata; return m && { title: m.title, artist: m.artist, album: m.album, artwork: m.artwork.map((a) => a.src) }; });
    const newest = letters[letters.length - 1];
    expect(meta.title).toBe(newest.song.title);
    expect(meta.artist).toBe('221 FOREVER');
    expect(meta.album).toBe(newest.title);
    expect(meta.artwork[0]).toMatch(/\/assets\/m\/hero\/.+-\d+\.jpg$/);
  });
});

test.describe('router', () => {
  test('letter → letter → Back → Back, starting from a letter page that was loaded directly', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    const start = letters[4];
    const seen = watch(page, baseURL);
    await openProbe(page, start.url);
    await page.evaluate(() => { window.__sameDocument = true; document.querySelector('.content-body').dataset.mark = 'landed'; });

    await page.locator('#theme-root a[rel="next"]').click();              // the next letter, fetched
    await expect(page).toHaveURL(new URL(letters[5].url, baseURL).href);
    await expect(page.locator('#theme-root h1')).toHaveText(letters[5].title);
    expect(await page.evaluate(() => window.scrollY), 'a link lands at the top').toBe(0);
    expect(await ctx(page, (c) => [c.page.type, c.page.letter.no, c.router.current.letter.no])).toEqual(['letter', letters[5].no, letters[5].no]);

    await page.locator('#theme-root a.p-logo').click();                   // home
    await expect(page).toHaveURL(new URL('/', baseURL).href);
    await expect(page.locator('#theme-root .p-list')).toBeVisible();

    await page.goBack();
    await expect(page.locator('#theme-root h1')).toHaveText(letters[5].title);
    await page.goBack();                                                   // the page we landed on: the very same node again
    await expect(page.locator('#theme-root h1')).toHaveText(start.title);
    expect(await page.evaluate(() => document.querySelector('#theme-root .letter-body .content-body').dataset.mark)).toBe('landed');
    expect(await page.evaluate(() => window.__sameDocument), 'never reloaded').toBe(true);
    expect(seen.requests.filter((u) => u.endsWith(new URL(letters[5].url, baseURL).pathname)).length, 'a letter is fetched once').toBe(1);
    expect(seen.errors).toEqual([]);
  });

  test('a letter reached by soft navigation has working widgets', async ({ page, request }) => {
    const { flip } = await samplePages(request);
    await openProbe(page);
    expect(await ctx(page, (c, url) => c.router.go(url), flip), 'soft navigation').toBe(true);
    const card = page.locator('#theme-root .flip-card');
    await expect(card.locator('.flip-card-front')).toBeVisible();
    await card.click({ position: { x: 20, y: 20 } });
    await expect(card).toHaveClass(/is-flipped/);
    await expect(card.locator('.flip-card-back img')).toBeVisible();
  });

  test('links that are not letters, and modified clicks, are left to the browser', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    await openProbe(page);
    await page.evaluate(() => { window.__sameDocument = true; });
    const link = page.locator(`#theme-root a[href="${letters[letters.length - 1].url}"]`).first();
    const [popup] = await Promise.all([page.context().waitForEvent('page'), link.click({ modifiers: ['ControlOrMeta'] })]);   // new tab
    await popup.close();
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
    expect(page.url()).toBe(new URL('/', baseURL).href);

    await page.evaluate(() => { const a = document.createElement('a'); a.href = '/feed.xml'; a.id = 'feed'; a.textContent = 'feed'; document.getElementById('theme-root').prepend(a); });
    await page.locator('#feed').click();
    await page.waitForURL('**/feed.xml');
  });

  test('a letter that cannot be fetched becomes a normal page load', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    const target = letters[2];
    await openProbe(page);
    await page.evaluate(() => { window.__sameDocument = true; });
    let failed = false;
    await page.route(`**${new URL(target.url, baseURL).pathname}`, (route) => {
      if (route.request().resourceType() === 'fetch' && !failed) { failed = true; return route.abort(); }
      return route.continue();
    });
    await ctx(page, (c, url) => { c.router.go(url); }, target.url);
    await page.waitForFunction(() => window.__sameDocument === undefined && document.documentElement.getAttribute('data-theme-ready') === 'probe');
    await expect(page.locator('#theme-root h1')).toHaveText(target.title);
    expect(failed).toBe(true);
  });
});

test.describe('ctx.img', () => {
  test('one request per cover, in a modern format, never the original', async ({ page, request, baseURL }) => {
    const { letter } = await samplePages(request);
    const seen = watch(page, baseURL);
    await openProbe(page, letter);
    await page.waitForLoadState('networkidle');
    const covers = seen.requests.filter((u) => u.includes('/assets/m/hero/'));
    expect(covers.length, 'the eager cover is fetched exactly once').toBe(1);
    expect(covers[0]).toMatch(/\.avif$/);
    const img = await page.evaluate(() => {
      const el = document.querySelector('#theme-root picture.p-cover img');
      return { width: el.getAttribute('width'), height: el.getAttribute('height'), loading: el.loading, alt: el.alt, bg: el.style.backgroundColor, fx: el.style.getPropertyValue('--fx'), fy: el.style.getPropertyValue('--fy'), sources: el.parentElement.querySelectorAll('source[type="image/avif"]').length };
    });
    expect(Number(img.width) > 0 && Number(img.height) > 0).toBe(true);
    expect(img.loading).toBe('eager');
    expect(img.bg).not.toBe('');
    expect(img.fx).toMatch(/^\d+%$/);
    expect(img.fy).toMatch(/^\d+%$/);
    expect(img.sources).toBe(1);
  });

  test('covers on the home page are lazy and small', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL);
    await openProbe(page);
    await page.waitForLoadState('networkidle');
    const covers = seen.requests.filter((u) => u.includes('/assets/m/hero/'));
    const total = await page.locator('#theme-root .p-thumb img').count();
    expect(covers.length, 'only the covers near the screen are fetched').toBeLessThan(total);
    for (const url of covers) expect(url).toMatch(/-480\.(avif|jpg)$/);
    expect(await ctx(page, (c) => c.img(null, { className: 'x' }).className), 'no cover: an empty placeholder').toBe('x is-empty');
  });
});
