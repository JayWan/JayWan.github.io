// Every theme that has files in assets/themes/ must pass these, on every kind of page, at
// desktop size in Chrome and at iPhone size in WebKit (ARCHITECTURE §8 and §9).
//
// What a theme has to provide for the tests to find their way (also in assets/themes/README.md):
//   - the letter's content sits inside an element with class "letter-body"
//   - every control that starts a song has the attribute data-play
//   - the home view links to letters with ordinary <a href="{letter.url}">

import { gzipSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import { themeIds, samplePages, getIsland, watch, open, themeOf, expectNoSidewaysScroll, firstLetterLink, rewriteIsland } from './helpers.mjs';

const state = (page) => page.evaluate(() => {
  const s = window.__theme.ctx.player.state;
  return { playing: s.playing, time: s.time, error: s.error, no: s.letter && s.letter.no };
});

for (const theme of themeIds) {
  test.describe(`theme "${theme}"`, () => {
    for (const kind of ['home', 'letter', 'quiet', 'flip', 'gift', 'lost']) {
      test(`${kind} page renders cleanly`, async ({ page, request, baseURL }) => {
        const pages = await samplePages(request);
        const seen = watch(page, baseURL);
        await open(page, pages[kind], theme);

        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
        expect((await page.locator('#theme-root').innerText()).trim().length, 'the theme rendered text').toBeGreaterThan(10);
        await expect(page.locator('body > :not(#theme-root):not(script):not(style):visible'), 'nothing of the classic page shows').toHaveCount(0);
        if (kind !== 'home' && kind !== 'lost') {
          const body = page.locator('#theme-root .letter-body .content-body');
          await expect(body, 'the letter body was moved into .letter-body').toHaveCount(1);
          expect((await body.innerText()).trim().length).toBeGreaterThan(50);
        }
        if (kind === 'home') {
          const line = await page.evaluate(() => window.__theme.ctx.ui.hunger().text);
          await expect(page.locator('#theme-root'), "the site's own line, ctx.ui.hunger().text, is on the home page, unchanged").toContainText(line);
          await expect(page.locator('#theme-root nav.theme-switcher a[data-theme-id]').first(), 'ctx.ui.switcher() is on the page').toBeAttached();
        }
        await expectNoSidewaysScroll(page);

        await page.waitForLoadState('networkidle');
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));   // wake lazy content
        await page.waitForTimeout(300);
        await expectNoSidewaysScroll(page);

        expect(seen.errors, 'no errors').toEqual([]);
        expect(seen.offSite(), 'nothing is requested from another origin').toEqual([]);
        expect(seen.audio(), 'no audio before the reader presses play').toEqual([]);
        expect(seen.originals(), 'covers only through ctx.img(), never the originals').toEqual([]);
      });
    }

    test('the first view of the home page weighs at most 700 KB', async ({ page, baseURL }) => {
      // ARCHITECTURE §8: HTML + CSS + JS + fonts + the images of the first screen, cold cache.
      // Counted the way GitHub Pages sends them: text gzipped, everything else as it is.
      const responses = [];
      page.on('response', (response) => responses.push((async () => {
        try {
          const body = await response.body();
          const text = /^(text\/|application\/(json|javascript|xml)|image\/svg)/.test(response.headers()['content-type'] || '');
          return { url: response.url().replace(baseURL, ''), bytes: text ? gzipSync(body).length : body.length };
        } catch { return null; }                                           // a redirect, or a request that was cancelled
      })()));
      await open(page, '/', theme);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const loaded = (await Promise.all(responses)).filter(Boolean).sort((x, y) => y.bytes - x.bytes);
      const total = loaded.reduce((sum, file) => sum + file.bytes, 0);
      const heaviest = loaded.slice(0, 6).map((file) => `${Math.round(file.bytes / 1024)} KB ${file.url}`).join('\n  ');
      expect(total, `the home page transfers ${Math.round(total / 1024)} KB in ${loaded.length} files; the heaviest:\n  ${heaviest}\n`).toBeLessThanOrEqual(700 * 1024);
    });

    test('the flip card turns over and back', async ({ page, request }) => {
      await open(page, (await samplePages(request)).flip, theme);
      const card = page.locator('#theme-root .flip-card');
      const height = () => card.locator('.flip-card-inner').evaluate((el) => el.getBoundingClientRect().height);
      await expect(card.locator('.flip-card-front')).toBeVisible();
      const frontHeight = await height();
      expect(frontHeight).toBeGreaterThan(100);

      await card.click({ position: { x: 20, y: 20 } });
      await expect(card).toHaveClass(/is-flipped/);
      await expect(card.locator('.flip-card-back img')).toBeVisible();
      await expect(card.locator('.flip-card-front')).toBeHidden();
      await expect.poll(height, 'the card takes the height of the photo side').not.toBe(frontHeight);
      await expectNoSidewaysScroll(page);

      await card.focus();
      await page.keyboard.press('Enter');                                 // and it works from the keyboard
      await expect(card).not.toHaveClass(/is-flipped/);
      await expect(card.locator('.flip-card-front')).toBeVisible();
    });

    test('the gift box opens, with confetti over the whole screen', async ({ page, request }) => {
      await open(page, (await samplePages(request)).gift, theme);
      const box = page.locator('#theme-root #gift-container');
      await box.scrollIntoViewIfNeeded();
      await box.click();
      const canvas = await page.evaluate(() => {
        const c = document.getElementById('confetti-canvas').getBoundingClientRect();
        return { left: c.left, top: c.top, width: c.width, height: c.height, vw: window.innerWidth, vh: window.innerHeight };
      });
      // position: fixed must mean the viewport: no ancestor of the letter may have a transform, filter or perspective
      expect(canvas.left).toBe(0);
      expect(canvas.top).toBe(0);
      expect(Math.abs(canvas.width - canvas.vw)).toBeLessThanOrEqual(1);
      expect(Math.abs(canvas.height - canvas.vh)).toBeLessThanOrEqual(1);
      await expect(page.locator('#theme-root #gift-reveal')).toBeVisible();
      await expect(box).toBeHidden();
      await expectNoSidewaysScroll(page);
    });

    test('soft navigation, Back, and a song that keeps playing', async ({ page, request, baseURL, browserName }) => {
      const seen = watch(page, baseURL);
      await open(page, '/', theme);
      if (!(await page.evaluate(() => window.__theme.ctx.router.soft))) test.skip(true, 'this theme does not return show(): links load pages normally');
      await page.evaluate(() => { window.__sameDocument = true; });
      const titleAtHome = await page.title();

      // home → a letter, without loading a page
      const { link, url } = await firstLetterLink(page, request, 8);
      await link.scrollIntoViewIfNeeded();
      const scrollAtHome = await page.evaluate(() => window.scrollY);
      await link.click();
      await expect(page).toHaveURL(new URL(url, baseURL).href);
      await expect(page.locator('#theme-root .letter-body .content-body')).toBeVisible();
      expect(await page.evaluate(() => window.__sameDocument), 'still the same document').toBe(true);
      const letter = (await getIsland(request)).letters.find((l) => l.url === url);
      expect(await page.title()).toContain(letter.title);
      await expectNoSidewaysScroll(page);

      // press play: this is the first moment audio may be requested
      expect(seen.audio(), 'no audio before play').toEqual([]);
      const play = page.locator('#theme-root [data-play]:visible').first();
      await expect(play, 'a song control marked with data-play').toBeVisible();
      await play.click();
      await expect.poll(() => seen.audio().length, 'the first visible [data-play] on a letter page starts a song when clicked').toBeGreaterThan(0);
      const audible = browserName === 'chromium';        // Playwright's WebKit on Linux cannot decode MP3
      if (audible) {
        await expect.poll(async () => (await state(page)).playing, 'the song plays').toBe(true);
        await expect.poll(async () => (await state(page)).time, 'and moves').toBeGreaterThan(0.3);
      }

      // Back: home again, same document, same place, song still going
      await page.goBack();
      await expect(page).toHaveURL(new URL('/', baseURL).href);
      expect(await page.evaluate(() => window.__sameDocument), 'Back did not reload').toBe(true);
      await expect(link).toBeVisible();
      expect(await page.title()).toBe(titleAtHome);
      await expect.poll(() => page.evaluate(() => window.scrollY), 'Back returns to where the reader was').toBeGreaterThanOrEqual(scrollAtHome - 80);
      expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(scrollAtHome + 80);
      if (audible) {
        const before = await state(page);
        expect(before.playing, 'the song survived the navigation').toBe(true);
        await expect.poll(async () => (await state(page)).time).toBeGreaterThan(before.time);
      }

      // Forward: the letter again, from the cache
      await page.goForward();
      await expect(page).toHaveURL(new URL(url, baseURL).href);
      await expect(page.locator('#theme-root .letter-body .content-body')).toBeVisible();
      expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
      expect(seen.errors).toEqual([]);
      expect(seen.offSite()).toEqual([]);
    });

    test('a letter that runs its own scripts is opened by a real page load', async ({ page, request, baseURL }) => {
      const { letters } = await getIsland(request);
      const standalone = letters.find((l) => l.standalone);
      test.skip(!standalone, 'no standalone letter');
      await open(page, '/', theme);
      await page.evaluate(() => { window.__sameDocument = true; });
      await page.evaluate((url) => window.__theme.ctx.router.go(url), standalone.url).catch(() => {});   // the navigation may cut the call short
      await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
      await expect(page).toHaveURL(new URL(standalone.url, baseURL).href);
      expect(await page.evaluate(() => window.__sameDocument), 'a new document').toBeUndefined();
      expect(await page.evaluate(() => typeof window.openGiftBox), 'its script ran').toBe('function');
    });

    test('a letter by a guest, and a letter with no song, cover, quote or place', async ({ page, request, baseURL }) => {
      // The archive has no such letters yet, but the next one may be either (the first guest letter
      // is on its way), and a theme that trips over one of them takes the whole site back to
      // classic. So the tests make them: the data island of every page is rewritten on its way to
      // the browser.
      const { letters } = await getIsland(request);
      const ordinary = letters.filter((l) => !l.standalone && !l.quiet);
      const guest = ordinary[ordinary.length - 1];                         // the newest one: it leads the home page
      const bare = ordinary[1];
      await rewriteIsland(page, baseURL, (data) => {
        for (const letter of data.letters) {
          if (letter.no === guest.no) letter.author = 'Claude';
          if (letter.no === bare.no) Object.assign(letter, { song: null, cover: null, quote: null, place: null });
        }
      });
      const seen = watch(page, baseURL);

      for (const path of ['/', guest.url, bare.url]) {
        await open(page, path, theme);
        await expect(page.locator('html'), `${path}: the theme is still the theme`).toHaveAttribute('data-theme', theme);
        expect(await page.evaluate(([g, b]) => {
          const { letters: all } = window.__theme.ctx;
          return [all.byNo(g).role, all.byNo(b).song, all.byNo(b).cover, all.byNo(b).quote];
        }, [guest.no, bare.no]), 'the page really has the rewritten letters').toEqual(['guest', null, null, null]);
        if (path !== '/') await expect(page.locator('#theme-root .letter-body .content-body')).toHaveCount(1);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expectNoSidewaysScroll(page);
      }

      // and by soft navigation, where the theme supports it
      await open(page, '/', theme);
      if (await page.evaluate(() => window.__theme.ctx.router.soft)) {
        for (const letter of [guest, bare]) {
          expect(await page.evaluate((url) => window.__theme.ctx.router.go(url), letter.url), `soft navigation to ${letter.title}`).toBe(true);
          await expect(page.locator('#theme-root .letter-body .content-body')).toBeVisible();
          expect(await page.evaluate(() => window.__theme.ctx.page.letter.no)).toBe(letter.no);
          await page.goBack();
          await expect(page).toHaveURL(new URL('/', baseURL).href);
        }
      }
      // the player skips a letter without a song instead of stopping at it
      expect(await page.evaluate((no) => {
        const { letters: all, player } = window.__theme.ctx;
        player.toggle(all.byNo(no));                                       // no song: nothing happens
        return player.state.letter;
      }, bare.no)).toBe(null);
      expect(seen.errors, 'no errors').toEqual([]);
      expect(await themeOf(page)).toBe(theme);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });

    test('phone width with reduced motion: every kind of page still fits', async ({ browser, request, baseURL }) => {
      // The same 402px check as the WebKit project, so it also runs where only Chrome is installed.
      const context = await browser.newContext({ baseURL, viewport: { width: 402, height: 700 }, reducedMotion: 'reduce', hasTouch: true });
      const page = await context.newPage();
      const pages = await samplePages(request);
      for (const kind of ['home', 'letter', 'quiet', 'flip', 'gift']) {
        await open(page, pages[kind], theme);
        await expectNoSidewaysScroll(page);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expectNoSidewaysScroll(page);
      }
      await context.close();
    });
  });
}
