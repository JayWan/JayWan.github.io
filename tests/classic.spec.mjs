// The classic theme must stay the site it has always been. The pixel-level proof is the parity
// checker (outside this repository); these tests pin down the mechanics that make it possible:
// under classic the boot script writes exactly the old tags, and the classic markup that is
// kept out of the way for the new themes is written back into the page.

import { test, expect } from '@playwright/test';
import { otherSites, samplePages, watch } from './helpers.mjs';

// (The one thing the classic page has gained, the row of theme names at its foot and in its
// drawer, has its own file: tests/switcher.spec.mjs.)

test('classic home page: the old tags, the old markup, no new theme showing', async ({ page, baseURL }) => {
  await otherSites(page);
  const seen = watch(page, baseURL);
  await page.goto('/?theme=classic');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'classic');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-us');
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1');

  const head = await page.evaluate(() => [...document.head.querySelectorAll('link[rel="stylesheet"], script[src]')].map((el) => el.getAttribute('href') || el.getAttribute('src')));
  expect(head).toEqual([
    '/assets/css/main.css',
    'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,700;1,400&family=Noto+Serif+SC:wght@400;700&display=swap',
    'https://fonts.googleapis.com/css?family=Roboto:100,300',
    'https://fonts.googleapis.com/css?family=PT+Sans:700',
    'https://code.jquery.com/jquery-3.7.1.min.js',
  ]);

  await expect(page.locator('#theme-root')).toBeHidden();
  await expect(page.locator('#theme-root')).toBeEmpty();
  await expect(page.locator('.section--frontpage')).toBeVisible();
  expect(await page.locator('.blockGroup-list .block').count()).toBeGreaterThan(30);
  await expect(page.locator('audio[autoplay][src="/assets/bgm/Get Up.mp3"]')).toHaveCount(1);
  await expect(page.locator('html[data-theme-ready]')).toHaveCount(0);
  expect(await page.evaluate(() => window.jQuery.fn.jquery)).toBe('3.7.1');
  expect(seen.requests.filter((u) => u.includes('/assets/javascripts/jquery')), 'the local copy of jQuery is only a safety net').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('classic letter page: cover, player, sidebar and scripts are back in place', async ({ page, request, baseURL }) => {
  await otherSites(page);
  const seen = watch(page, baseURL);
  const { flip } = await samplePages(request);
  await page.goto(`${flip}?theme=classic`);
  const order = await page.evaluate(() => [...document.querySelectorAll('.sidebar-checkbox, nav.sidebar, nav.menuWrapper, article.postWrapper, .section--first, .section--last, .content-body, .postFooter, .sidebar-toggle-wrapper, .section--footer')]
    .map((el) => el.className.split(' ')[0]));
  expect(order).toEqual(['sidebar-checkbox', 'sidebar', 'menuWrapper', 'postWrapper', 'section--first', 'section--last', 'content-body', 'postFooter', 'section--footer', 'sidebar-toggle-wrapper']);
  await expect(page.locator('.section--first img.post-featuredImage')).toHaveCount(1);
  await expect(page.locator('.section--last audio[autoplay] source')).toHaveCount(1);
  await expect(page.locator('script[src="/assets/javascripts/imagesloaded.pkgd.min.js"]')).toHaveCount(1);
  expect(await page.locator('nav.sidebar img').count()).toBeGreaterThan(10);

  // the classic scripts ran, in their old order: jQuery, imagesLoaded, then the inline script
  await expect(page.locator('.section--first img.post-featuredImage').first()).toHaveClass(/is-loaded/);
  const card = page.locator('.flip-card');
  await card.click({ position: { x: 20, y: 20 } });
  await expect(card).toHaveClass(/is-flipped/);          // flipped once: the core did not add a second listener
  expect(seen.errors).toEqual([]);
});

test('classic survives without code.jquery.com: jQuery then comes from this site', async ({ page, request, baseURL }) => {
  await otherSites(page, { jquery: false });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const { letter } = await samplePages(request);
  await page.goto(`${letter}?theme=classic`);
  expect(await page.evaluate(() => window.jQuery.fn.jquery)).toBe('3.7.1');
  await expect(page.locator('script[src="/assets/javascripts/jquery-3.7.1.min.js"]')).toHaveCount(1);
  await expect(page.locator('.section--first img.post-featuredImage').first()).toHaveClass(/is-loaded/);
  expect(errors).toEqual([]);
});

test('without JavaScript the page is the classic page', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'classic');
  await expect(page.locator('head link[rel="stylesheet"][href="/assets/css/main.css"]')).toHaveCount(1);
  await expect(page.locator('.section--frontpage')).toBeVisible();
  await expect(page.locator('.blockGroup-list .block').first()).toBeVisible();
  await context.close();
});

test('a new theme asks nothing of other sites and loads none of the classic resources', async ({ page, request, baseURL }) => {
  const { letter } = await samplePages(request);
  for (const path of ['/', letter]) {
    const seen = watch(page, baseURL);
    await page.goto(`${path}?theme=probe`);
    await page.waitForSelector('html[data-theme-ready="probe"]');
    await page.waitForLoadState('networkidle');
    expect(seen.offSite(), path).toEqual([]);
    expect(seen.requests.filter((u) => /main\.css|imagesloaded|jquery/.test(u)), path).toEqual([]);
    expect(seen.originals(), path).toEqual([]);
    expect(seen.audio(), path).toEqual([]);
    expect(await page.locator('audio').count(), 'no <audio> element in the page').toBe(0);
  }
});
