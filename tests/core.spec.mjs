// The core's own behaviour, exercised through the reference theme `probe`:
// the player (ARCHITECTURE §5.3), the router's corner cases (§5.2) and ctx.img().

import { test, expect } from '@playwright/test';
import { getIsland, samplePages, watch, firstLetterLink } from './helpers.mjs';

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

    // switching songs: the new one is loading, and is not "playing" until it makes a sound
    expect(await ctx(page, (c) => { c.player.toggle(c.letters[3]); const { letter, playing, loading, time } = c.player.state; return [letter.no, playing, loading, time]; })).toEqual([letters[3].no, false, true, 0]);
    await expect.poll(async () => (await playerState(page)).playing).toBe(true);
    await page.locator(`#theme-root [data-play="${second.no}"]`).click();
    await expect.poll(async () => { const now = await playerState(page); return [now.no, now.playing]; }).toEqual([second.no, true]);

    // a letter without a song, and toggle() with nothing to toggle, are ignored
    await ctx(page, (c) => { c.player.toggle({ no: 99, song: null }); });
    expect((await playerState(page)).no).toBe(second.no);

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

  test('a song that failed is loaded again on the next try', async ({ page }) => {
    let broken = true;
    await page.route('**/*.mp3', (route) => (broken ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }) : route.continue()));
    await openProbe(page);
    const play = page.locator('#theme-root [data-play]').first();
    await play.click();
    await expect.poll(async () => (await playerState(page)).error).toBe('failed');
    broken = false;                                                        // the network is back
    await play.click();
    await expect.poll(async () => { const now = await playerState(page); return [now.playing, now.error]; }).toEqual([true, null]);
    await ctx(page, (c) => c.player.pause());
    await expect.poll(async () => (await playerState(page)).playing).toBe(false);
  });

  test('seeking before the song has loaded sets where it will start', async ({ page }) => {
    await openProbe(page);
    await ctx(page, (c) => c.player.seek(30));                             // nothing loaded: ignored
    expect((await playerState(page)).time).toBe(0);
    await page.locator('#theme-root [data-play]').first().click();
    await ctx(page, (c) => c.player.seek(30));                             // right after the click, long before any audio has arrived
    await expect.poll(async () => (await playerState(page)).playing).toBe(true);
    const now = await playerState(page);
    expect(now.time).toBeGreaterThanOrEqual(30);
    expect(now.time).toBeLessThan(40);
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
    expect(seen.requests.filter((u) => u === new URL(letters[5].url, baseURL).href).length, 'a letter is fetched once').toBe(1);
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

// A theme for the tests below: its show() takes a while (an exit animation, say), and can be told
// never to finish. It records when each show() starts and ends.
const SLOW_THEME = `
export default { mount(ctx) {
  const main = document.createElement('main');
  ctx.root.append(main);
  const log = (window.__shows = []);
  let running = 0;
  const name = (route) => route.type + (route.letter ? ':' + route.letter.no : '');
  function draw(route) {
    const view = document.createElement('div');
    view.dataset.view = name(route);
    if (route.type === 'letter') { const body = document.createElement('div'); body.className = 'letter-body'; body.append(route.contentEl); view.append(body); }
    else for (const l of ctx.letters) { const a = document.createElement('a'); a.href = l.url; a.textContent = l.title; a.dataset.no = l.no; a.style.cssText = 'display:block;height:120px'; view.append(a); }
    main.replaceChildren(view);
  }
  draw(ctx.router.current);
  return { async show(route) {
    log.push(['start', name(route), running]);
    running++;
    if (window.__stuck) { draw(route); await new Promise(() => {}); }
    await new Promise((done) => setTimeout(done, 300));
    draw(route);
    running--;
    log.push(['end', name(route), running]);
  } };
} };`;

async function openSlowTheme(page, path = '/') {
  await page.route('**/assets/themes/probe/theme.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: SLOW_THEME }));
  await openProbe(page, path);
}

test.describe('router: the corners', () => {
  test('an #anchor on the page being read is the browser\'s; an #anchor on another letter is scrolled to', async ({ page, request, baseURL }) => {
    const { letter } = await samplePages(request);                       // Hang Zhou has a heading with an id
    const seen = watch(page, baseURL);
    await openProbe(page, letter);
    const id = await page.evaluate(() => { window.__sameDocument = true; return document.querySelector('#theme-root .letter-body [id]').id; });
    await page.evaluate((anchor) => { const a = document.createElement('a'); a.href = `#${anchor}`; a.id = 'jump'; a.textContent = 'jump'; document.querySelector('#theme-root .letter-body').append(a); }, id);
    await page.locator('#jump').click();
    await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toBe(`#${id}`);
    const top = () => page.evaluate((anchor) => Math.round(document.getElementById(anchor).getBoundingClientRect().top), id);
    await expect.poll(top, 'the browser scrolled to the anchor').toBeLessThan(5);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);

    // from the home page: a link to that letter's anchor
    await ctx(page, (c) => c.router.go('/'));
    await expect(page.locator('#theme-root .p-list')).toBeVisible();
    expect(await ctx(page, (c, url) => c.router.go(url), `${letter}#${encodeURIComponent(id)}`)).toBe(true);
    await expect.poll(top, 'the core scrolled to the anchor').toBeLessThan(5);
    expect(await ctx(page, (c) => [c.router.current.hash.length > 1, c.page.type])).toEqual([true, 'letter']);
    expect(new URL(page.url()).hash.length).toBeGreaterThan(1);
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
    expect(seen.errors).toEqual([]);
  });

  test('a letter is found under every spelling of its address', async ({ page, request, baseURL }) => {
    const { gift } = await samplePages(request);                         // "/story/2026/07/04/29,-28,-π/": a comma and a Greek letter
    await openProbe(page);
    const spellings = [gift, encodeURI(gift), gift.replace(/,/g, '%2C'), encodeURI(gift).replace(/,/g, '%2C'), new URL(gift, baseURL).href, `${gift}index.html`, gift.slice(0, -1), `${gift}?x=1#top`];
    expect(await ctx(page, (c, urls) => urls.map((url) => (c.letters.byUrl(url) || {}).url), spellings)).toEqual(spellings.map(() => gift));
    expect(await ctx(page, (c) => [c.letters.byUrl('/'), c.letters.byUrl('/story/nowhere/'), c.letters.byUrl('/%E0%A4%A/'), c.letters.byUrl(null)])).toEqual([null, null, null, null]);
  });

  test('a link inside an SVG is a link too', async ({ page, request, baseURL }) => {
    const { letter } = await samplePages(request);
    await openProbe(page);
    await page.evaluate((url) => {
      window.__sameDocument = true;
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '120'); svg.setAttribute('height', '60');
      const a = document.createElementNS(NS, 'a');
      a.setAttribute('href', url); a.id = 'svg-link';
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('width', '120'); rect.setAttribute('height', '60');
      a.append(rect); svg.append(a);
      document.getElementById('theme-root').prepend(svg);
    }, letter);
    expect(await ctx(page, (c) => c.letters.byUrl(document.getElementById('svg-link')).date), 'letters.byUrl accepts the element').toBe('2016-06-08');
    await page.locator('#svg-link rect').click();
    await expect(page).toHaveURL(new URL(letter, baseURL).href);
    await expect(page.locator('#theme-root .letter-body .content-body')).toBeVisible();
    expect(await page.evaluate(() => window.__sameDocument), 'soft navigation').toBe(true);
  });

  test('prefetch fetches the letter, not its photos', async ({ page, request, baseURL }) => {
    const { flip } = await samplePages(request);                         // its photo is several megabytes
    const seen = watch(page, baseURL);
    await openProbe(page);
    await page.waitForLoadState('networkidle');
    const before = seen.requests.length;
    await ctx(page, (c, url) => { c.router.prefetch(url); c.router.prefetch(url); }, flip);
    await expect.poll(() => seen.requests.slice(before)).toEqual([new URL(flip, baseURL).href]);
    await page.waitForTimeout(500);
    expect(seen.requests.slice(before), 'only the HTML, once').toEqual([new URL(flip, baseURL).href]);

    expect(await ctx(page, (c, url) => c.router.go(url), flip)).toBe(true);
    await expect.poll(() => seen.requests.slice(before).filter((u) => u.includes('/assets/images/posts/')).length, 'the photo is requested when the letter is shown').toBeGreaterThan(0);
    expect(seen.requests.slice(before).filter((u) => u === new URL(flip, baseURL).href).length, 'and the HTML is not fetched again').toBe(1);
  });

  test('while a letter is on its way <html> carries data-navigating', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    const target = letters[3];
    await openProbe(page);
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route(`**${new URL(target.url, baseURL).pathname}`, async (route) => { await held; await route.continue(); });
    await ctx(page, (c, url) => { c.router.go(url); }, target.url);
    await expect(page.locator('html')).toHaveAttribute('data-navigating', '');
    release();
    await expect(page.locator('#theme-root h1')).toHaveText(target.title);
    await expect(page.locator('html[data-navigating]')).toHaveCount(0);
  });

  test('a letter that takes too long to arrive is loaded as a normal page', async ({ page, request, baseURL }) => {
    test.setTimeout(40_000);
    const { letters } = await getIsland(request);
    const target = letters[6];
    await openProbe(page);
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.route(`**${new URL(target.url, baseURL).pathname}`, (route) => (route.request().resourceType() === 'fetch' ? undefined : route.continue()));   // the fetch never gets an answer
    await ctx(page, (c, url) => { c.router.go(url); }, target.url);
    await page.waitForFunction(() => window.__sameDocument === undefined && document.documentElement.getAttribute('data-theme-ready') === 'probe', null, { timeout: 20_000 });
    await expect(page.locator('#theme-root h1')).toHaveText(target.title);
  });

  test('show() calls never overlap, and a show() that was overtaken does not move the reader', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    const [first, second] = [letters[20], letters[3]];
    const seen = watch(page, baseURL);
    await openSlowTheme(page);
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.locator(`#theme-root a[data-no="${first.no}"]`).click();
    await expect(page.locator(`#theme-root [data-view="letter:${first.no}"]`)).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // Back (its show() will want to scroll to 2000 when it is done) and, before that has finished, another letter
    await page.evaluate((url) => { history.back(); setTimeout(() => window.__theme.ctx.router.go(url), 100); }, second.url);
    await expect(page.locator(`#theme-root [data-view="letter:${second.no}"]`)).toBeVisible();
    await expect(page).toHaveURL(new URL(second.url, baseURL).href);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY), 'the reader is at the top of the letter').toBe(0);
    expect(await ctx(page, (c) => [c.page.letter.no, c.router.current.letter.no])).toEqual([second.no, second.no]);

    const log = await page.evaluate(() => window.__shows);
    expect(log.filter((entry) => entry[0] === 'start').map((entry) => entry[2]), 'no show() started while another was running').toEqual(log.filter((entry) => entry[0] === 'start').map(() => 0));
    expect(log.map((entry) => entry[0]).join(' ')).toMatch(/^(start end ?)+$/);
    expect(log[log.length - 1]).toEqual(['end', `letter:${second.no}`, 0]);

    // three quick clicks: only the last letter is shown, and only one history entry is added
    const length = await page.evaluate(() => history.length);
    const results = await page.evaluate((urls) => Promise.all(urls.map((url) => window.__theme.ctx.router.go(url))), [letters[7].url, letters[8].url, letters[9].url]);
    expect(results).toEqual([false, false, true]);
    await expect(page.locator(`#theme-root [data-view="letter:${letters[9].no}"]`)).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
    expect(seen.errors).toEqual([]);
  });

  test('a show() that never finishes does not freeze the links', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    await openSlowTheme(page);
    await page.evaluate(() => { window.__stuck = true; window.__sameDocument = true; });
    await page.locator(`#theme-root a[data-no="${letters[2].no}"]`).click();
    await expect(page.locator(`#theme-root [data-view="letter:${letters[2].no}"]`)).toBeVisible();
    await page.goBack();                                                  // has to wait for the stuck show(), but not forever
    await expect(page.locator('#theme-root [data-view="home"]')).toBeVisible();
    await page.locator(`#theme-root a[data-no="${letters[5].no}"]`).click();
    await expect(page.locator(`#theme-root [data-view="letter:${letters[5].no}"]`)).toBeVisible();
    await expect(page).toHaveURL(new URL(letters[5].url, baseURL).href);
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
  });

  test('"back to the list": data-back is the Back button when the reader came from there', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    await openProbe(page);
    await page.evaluate(() => { window.__sameDocument = true; });
    const { link, url } = await firstLetterLink(page, request, 12);
    await link.scrollIntoViewIfNeeded();
    const scrollAtHome = await page.evaluate(() => window.scrollY);
    expect(scrollAtHome).toBeGreaterThan(200);
    await link.click();
    await expect(page).toHaveURL(new URL(url, baseURL).href);
    const length = await page.evaluate(() => history.length);

    await page.locator('#theme-root a[data-back]').click();               // "← 所有的信"
    await expect(page).toHaveURL(new URL('/', baseURL).href);
    await expect(page.locator('#theme-root .p-list')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY), 'the list is where the reader left it').toBeGreaterThanOrEqual(scrollAtHome - 80);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(scrollAtHome + 80);
    expect(await page.evaluate(() => history.length), 'no new history entry').toBe(length);
    await page.goForward();                                               // so Forward still leads to the letter
    await expect(page).toHaveURL(new URL(url, baseURL).href);

    // from one letter to the next and then "back to the list": the list is not where the reader came from
    await expect(page.locator('#theme-root .letter-body .content-body')).toBeVisible();
    const before = await ctx(page, (c) => c.page.letter.prev.title);
    await page.locator('#theme-root a[rel="prev"]').click();
    await expect(page.locator('#theme-root h1')).toHaveText(before);
    const deeper = await page.evaluate(() => history.length);
    expect(await ctx(page, (c) => c.router.back('/'))).toBe(true);
    await expect(page.locator('#theme-root .p-list')).toBeVisible();
    expect(await page.evaluate(() => [history.length, window.scrollY])).toEqual([deeper + 1, 0]);
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);

    // a letter opened directly: there is no list to go back to, so the link is an ordinary link
    const fresh = await page.context().newPage();
    await openProbe(fresh, letters[4].url);
    await fresh.locator('#theme-root a[data-back]').click();
    await expect(fresh).toHaveURL(new URL('/', baseURL).href);
    await expect(fresh.locator('#theme-root .p-list')).toBeVisible();
    await fresh.goBack();
    await expect(fresh.locator('#theme-root h1')).toHaveText(letters[4].title);
    await fresh.close();
  });

  test('a reload keeps the reader\'s place', async ({ page, request, baseURL }) => {
    const { letters } = await getIsland(request);
    await openProbe(page);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.reload();
    await page.waitForSelector('html[data-theme-ready="probe"]');
    await expect.poll(() => page.evaluate(() => window.scrollY), 'the list, reloaded').toBe(900);

    await ctx(page, (c, url) => c.router.go(url), letters[5].url);       // a letter reached without a page load
    await expect(page.locator('#theme-root h1')).toHaveText(letters[5].title);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.reload();
    await page.waitForSelector('html[data-theme-ready="probe"]');
    await expect.poll(() => page.evaluate(() => window.scrollY), 'the letter, reloaded').toBe(400);
    await page.goBack();                                                  // and the list is still where it was
    await expect(page.locator('#theme-root .p-list')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY), 'Back after the reload').toBe(900);
    await page.goForward();
    await expect(page.locator('#theme-root h1')).toHaveText(letters[5].title);
    await expect.poll(() => page.evaluate(() => window.scrollY), 'Forward').toBe(400);

    await page.goto(new URL(letters[2].url, baseURL).href);              // a fresh visit to a page starts at its top
    await page.waitForSelector('html[data-theme-ready="probe"]');
    await page.goto('/');
    await page.waitForSelector('html[data-theme-ready="probe"]');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('"back to the list" after a real page load: the standalone letter', async ({ page, request, baseURL }) => {
    const { gift } = await samplePages(request);
    await openProbe(page);
    const link = page.locator(`#theme-root .p-list a[href="${gift}"]`);
    await page.evaluate(() => window.scrollTo(0, 150));                   // the link is near the top of the list: still on screen
    const scrollAtHome = await page.evaluate(() => window.scrollY);
    expect(scrollAtHome).toBe(150);
    await link.click();                                                   // a full page load
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme-ready') === 'probe' && window.__theme.ctx.page.type === 'letter');
    expect(await page.evaluate(() => history.state.from)).toBe('/');
    await page.locator('#theme-root a[data-back]').click();
    await expect(page).toHaveURL(new URL('/', baseURL).href);
    await expect(page.locator('#theme-root .p-list')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY), 'the list is where the reader left it').toBe(scrollAtHome);
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
