// When a theme cannot do its job, the reader gets the classic site (ARCHITECTURE §5).
// The reference theme `probe` is broken on purpose, one way at a time, by answering its files
// with something else.

import { test, expect } from '@playwright/test';
import { samplePages } from './helpers.mjs';

const js = (body) => (route) => route.fulfill({ contentType: 'text/javascript', body });
const missing = (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });

const BROKEN = {
  'theme.js throws while it loads': ['**/assets/themes/probe/theme.js*', js('throw new Error("boom");')],
  'theme.js has a syntax error': ['**/assets/themes/probe/theme.js*', js('export default { mount( }')],
  'theme.js has no mount()': ['**/assets/themes/probe/theme.js*', js('export default {};')],
  'mount() throws': ['**/assets/themes/probe/theme.js*', js('export default { mount() { throw new Error("boom"); } };')],
  'mount() rejects': ['**/assets/themes/probe/theme.js*', js('export default { async mount() { throw new Error("boom"); } };')],
  'mount() renders nothing': ['**/assets/themes/probe/theme.js*', js('export default { mount() {} };')],
  'mount() never finishes and renders nothing (5 s)': ['**/assets/themes/probe/theme.js*', js('export default { mount() { return new Promise(() => {}); } };')],
  'theme.js is missing': ['**/assets/themes/probe/theme.js*', missing],
  'theme.css is missing': ['**/assets/themes/probe/theme.css*', missing],
  'the core does not load': ['**/assets/js/core/main.js*', missing],
  'a core module does not load': ['**/assets/js/core/router.js', missing],
};

// The classic page asks other sites for jQuery and fonts. Cut them off, so these tests pass
// without a network; jQuery then comes from the copy on this site (see classic.spec.mjs).
const standInForOtherSites = (page) => page.route(/^https:\/\//, (route) => route.abort());

for (const [name, [pattern, handler]] of Object.entries(BROKEN)) {
  test(`fallback to classic: ${name}`, async ({ page, request, baseURL }) => {
    const { letter } = await samplePages(request);
    await standInForOtherSites(page);
    await page.route(pattern, handler);
    await page.goto(`${letter}?theme=probe`);

    // one reload later the page is the classic page
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'classic' && window.__theme.by === 'url', null, { timeout: 12_000 });
    await page.waitForLoadState('load');
    expect(page.url(), 'the address is the plain address').toBe(new URL(letter, baseURL).href);
    await expect(page.locator('article.postWrapper .content-body')).toBeVisible();
    await expect(page.locator('#theme-root')).toBeHidden();
    await expect(page.locator('link[rel="stylesheet"][href="/assets/css/main.css"]')).toHaveCount(1);
    await expect(page.locator('audio')).toHaveCount(1);                       // the classic player exists again
    expect(await page.evaluate(() => typeof window.jQuery)).toBe('function');
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('f221:now')).id)).toBe('classic');

    // and the rest of the visit stays classic: the broken theme is not tried again
    await page.goto('/');
    expect(await page.evaluate(() => [document.documentElement.dataset.theme, window.__theme.by])).toEqual(['classic', 'visit']);
  });
}

test('the reason for a fallback is reported on the classic page', async ({ page, request }) => {
  const { letter } = await samplePages(request);
  await standInForOtherSites(page);
  await page.route('**/assets/themes/probe/theme.js*', js('export default { mount() { throw new Error("boom"); } };'));
  const warnings = [];
  page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
  await page.goto(`${letter}?theme=probe`);
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'classic');
  await expect.poll(() => warnings.join('\n')).toMatch(/fell back to the classic theme.*probe.*boom/);
});

test('a healthy theme is left alone by the watchdog', async ({ page }) => {
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  await page.waitForTimeout(5600);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('probe');
});
