// An address that does not exist.
//
// GitHub Pages answers it with the file /404.html and status 404, whatever the address was, and
// tests/server.mjs does the same. So that file has to exist under exactly that name (404.html
// sets its own permalink; left to `permalink: pretty` it was built as /404/index.html and the
// live site showed GitHub's own "Page not found"), and it has to work from any depth: the
// address in the bar is the missing one, not "/404.html".

import { test, expect } from '@playwright/test';
import { themeIds, otherSites, expectNoSidewaysScroll } from './helpers.mjs';

const THEMES = ['classic', ...themeIds.filter((id) => id !== 'probe')];
const NOWHERE = ['/no-such-page', '/no/such/letter/', '/story/2020/02/21/nothing-here/', '/404/', '/a/b/c/d.html'];
const OWN = '#theme-root nav.theme-switcher';
const FOOT = 'footer.section--footer nav.theme-switcher';
const LOST = /404|四〇四/;                                           // how a theme writes it ("folio" counts in characters)

/** Open a missing address under a theme and wait until the page is drawn. */
async function openMissing(page, path, theme) {
  const response = await page.goto(`${path}?theme=${theme}`);
  await page.waitForFunction((id) => window.__theme && window.__theme.up === 1 && document.documentElement.dataset.theme === id, theme);
  if (theme !== 'classic') await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  return response;
}
const address = (page) => { const u = new URL(page.url()); return decodeURI(u.pathname) + u.search; };

test('the page for a missing address is built where GitHub Pages looks for it', async ({ request }) => {
  const own = await request.get('/404.html');
  expect(own.status()).toBe(200);
  const html = await own.text();
  expect(html, 'it knows what it is').toContain('"page":{"type":"404"');
  expect(html, 'and asks not to be listed by search engines').toContain('<meta name="robots" content="noindex">');
  for (const path of NOWHERE) {
    const answer = await request.get(path);
    expect(answer.status(), path).toBe(404);
    expect(await answer.text(), `${path} is answered with that page`).toBe(html);
  }
  // every address in its markup starts at the root: the page is shown under addresses of any depth
  // (the classic page is in there too, inside <noscript class="classic-only">; scripts are code, not markup)
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
  const links = [...markup.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
  expect(links.length, 'the classic page and its links are in the file').toBeGreaterThan(10);
  const relative = links.filter((u) => u && !/^(\/|#|\?|https?:|mailto:|data:)/.test(u));
  expect(relative, 'no address relative to the missing one').toEqual([]);
});

for (const theme of THEMES) {
  test(`"${theme}" draws its own page for a missing address, at any depth`, async ({ page }) => {
    await otherSites(page);
    const errors = [], broken = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    // (Every page of the site names a home-screen icon, /assets/apple-touch-icon-144-precomposed.png, that has
    // never been in the repository; Firefox asks for it. That is not about this page, so it is left out here.)
    page.on('response', (res) => { if (res.status() >= 400 && res.request().resourceType() !== 'document' && !res.url().includes('apple-touch-icon')) broken.push(`${res.status()} ${res.url()}`); });

    for (const path of ['/no/such/letter/', '/no-such-page']) {
      const response = await openMissing(page, path, theme);
      expect(response.status(), path).toBe(404);
      expect(address(page), 'the address stays the one that was asked for').toBe(path);
      expect(await page.evaluate(() => window.__theme.page)).toBe('404');

      if (theme === 'classic') {
        const lines = page.locator('.section--lost');
        await expect(lines).toBeVisible();
        await expect(lines).toContainText('没有信');
        // the logo at the top left, the way home on every classic page, is the black one: the page is white
        await expect(page.locator('a.brandLogo.brandLogo--black[href="/"]')).toBeVisible();
        await expect(page.locator('#theme-root')).toBeEmpty();
      } else {
        await expect(page.locator('#theme-root'), 'the theme says what happened').toContainText(LOST);
        await expect(page.locator('body > :not(#theme-root):not(script):not(style):visible'), 'nothing of the classic page shows').toHaveCount(0);
      }
      await page.waitForLoadState('networkidle');
      await expectNoSidewaysScroll(page);
    }
    expect(broken, 'everything the page asks for is found').toEqual([]);
    expect(errors, 'no errors').toEqual([]);
  });

  test(`"${theme}": from a missing address there is a way home, and Back returns to it`, async ({ page }) => {
    await otherSites(page);
    const path = '/story/2020/02/21/nothing-here/';
    await openMissing(page, path, theme);

    if (theme === 'classic') {
      await page.locator('.section--lost a[href="/"]').click();
      await page.waitForFunction(() => window.__theme && window.__theme.up === 1 && window.__theme.page === 'home');
    } else {
      // every theme's page for a missing address leads on by ordinary links: home, or straight to a letter
      const onward = page.locator('#theme-root a[href="/"], #theme-root a[href^="/story/"]').filter({ visible: true });
      expect(await onward.count(), 'a link leads on').toBeGreaterThanOrEqual(1);
      await page.evaluate(() => window.__theme.ctx.router.go('/'));
      await expect.poll(() => page.evaluate(() => window.__theme.ctx.page.type)).toBe('home');
    }
    expect(address(page)).toBe('/');
    expect(await page.evaluate(() => document.documentElement.dataset.theme), 'still the same theme').toBe(theme);

    // Back: the address is one the theme cannot draw from where it is, so the page is loaded again
    await page.goBack();
    await page.waitForFunction((id) => {
      const T = window.__theme;
      if (!T || T.up !== 1 || T.page !== '404' || document.documentElement.dataset.theme !== id || location.pathname === '/') return false;
      return id === 'classic' || Boolean(T.ctx && T.ctx.page.type === '404');
    }, theme);
    expect(address(page), 'Back shows the missing address again, and the same page for it').toBe(path);
    if (theme === 'classic') await expect(page.locator('.section--lost')).toBeVisible();
    else await expect(page.locator('#theme-root')).toContainText(LOST);
  });
}

test('changing theme on a missing address stays on that address', async ({ page }) => {
  await otherSites(page);
  const path = '/no/such/letter/';
  await openMissing(page, path, THEMES[0]);
  for (const next of [...THEMES.slice(1), THEMES[0]]) {
    const row = page.locator(`${OWN}, ${FOOT}`).filter({ visible: true }).first();
    const name = row.locator(`a[data-theme-id="${next}"]`);
    await name.scrollIntoViewIfNeeded();
    await name.click();
    await page.waitForFunction((id) => window.__theme && window.__theme.up === 1 && document.documentElement.dataset.theme === id, next);
    if (next !== 'classic') await page.waitForSelector(`html[data-theme-ready="${next}"]`);
    expect(address(page), `in "${next}"`).toBe(path);
    expect(await page.evaluate(() => window.__theme.page)).toBe('404');
  }
});

test('classic: the three lines and the row of themes never touch, also on a low screen', async ({ browser, baseURL }) => {
  for (const [width, height] of [[1440, 900], [402, 874], [874, 402], [700, 330], [320, 568]]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height } });
    const page = await context.newPage();
    await otherSites(page);
    await openMissing(page, '/no/such/letter/', 'classic');
    const box = (selector) => page.locator(selector).evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY }; });
    const lines = await box('.section--lost .container'), row = await box(FOOT), burger = await box('label.sidebar-toggle-wrapper');
    expect(row.top - lines.bottom, `${width}x${height}: the row is below the lines`).toBeGreaterThanOrEqual(24);
    expect(lines.top - burger.bottom, `${width}x${height}: the lines are below the menu button`).toBeGreaterThanOrEqual(8);
    if (height >= 600) expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), `${width}x${height}: one screen, nothing to scroll`).toBeLessThanOrEqual(1);
    await expectNoSidewaysScroll(page);
    await context.close();
  }
});
