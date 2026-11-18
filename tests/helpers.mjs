// Shared by the spec files.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The site's public address. The pages name it in <link rel="canonical | next | prev">, and
// Firefox prefetches rel="next"; on the real site that is a request to itself, not to someone else.
const HOME = `https://${readFileSync(path.join(root, 'CNAME'), 'utf8').trim()}/`;

/** Every theme that has its two files in assets/themes/<id>/ (the reference theme `probe` included). */
export const themeIds = readdirSync(path.join(root, 'assets/themes'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && ['theme.js', 'theme.css'].every((file) => existsSync(path.join(root, 'assets/themes', d.name, file))))
  .map((d) => d.name)
  .sort((a, b) => (a === 'probe') - (b === 'probe') || a.localeCompare(b));

let island;
/** The data island of the home page, parsed (cached per worker). */
export async function getIsland(request) {
  if (!island) {
    const html = await (await request.get('/?theme=classic')).text();
    island = JSON.parse(/<script type="application\/json" id="letters-data">([\s\S]*?)<\/script>/.exec(html)[1]);
  }
  return island;
}

/** The pages every theme is checked on. */
export async function samplePages(request) {
  const { letters } = await getIsland(request);
  const pick = (test) => letters.find(test) || letters[0];
  return {
    home: '/',
    letter: pick((l) => l.date === '2016-06-08').url,          // Hang Zhou: long, with photos of both kinds
    quiet: pick((l) => l.quiet).url,                            // 世界赠予我们的
    flip: pick((l) => l.date === '2026-08-12').url,             // 木婚快乐: the flip card
    gift: pick((l) => l.standalone).url,                        // 29, 28, π: the gift box, its own scripts
    lost: '/404.html',                                          // the page GitHub Pages sends for an address that does not exist (tests/lost.spec.mjs opens it that way)
  };
}

// The classic theme takes jQuery and its fonts from other sites. The tests answer for them, so
// they pass without a network and say nothing about somebody else's server.
const JQUERY = readFileSync(path.join(root, 'assets/javascripts/jquery-3.7.1.min.js'), 'utf8');
export async function otherSites(page, { jquery = true } = {}) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://code.jquery.com/**', (route) => (jquery ? route.fulfill({ contentType: 'text/javascript', body: JQUERY }) : route.abort()));
}

/** Collect what must stay empty: uncaught errors, console errors, requests that leave the site. */
export function watch(page, baseURL) {
  const seen = { errors: [], requests: [] };
  page.on('pageerror', (err) => seen.errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') seen.errors.push(`console: ${msg.text()}`); });
  page.on('request', (req) => seen.requests.push(req.url()));
  seen.offSite = () => seen.requests.filter((u) => /^https?:/.test(u) && !u.startsWith(baseURL) && !u.startsWith(HOME));
  seen.audio = () => seen.requests.filter((u) => /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(u));
  seen.originals = () => seen.requests.filter((u) => /\/assets\/images\/(hero|thumbnail)\//.test(u));
  return seen;
}

/** Open `path` under a theme and wait until its mount() has finished. */
export async function open(page, path, theme) {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}theme=${theme}`);
  if (theme !== 'classic') await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
}

export const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);

const ISLAND = /(<script type="application\/json" id="letters-data">)([\s\S]*?)(<\/script>)/;

/** From now on every page this browser page loads or fetches carries a changed data island:
 *  `change(data)` edits the parsed island in place. For testing letters the archive does not
 *  have yet (a guest's letter, a letter without a song). */
export async function rewriteIsland(page, baseURL, change) {
  // Pages only (no file extension), and only this site's: Firefox prefetches <link rel="next">,
  // which names the public address, and that request is none of our business.
  await page.route((url) => url.href.startsWith(baseURL) && !/\.[a-z0-9]+$/i.test(url.pathname), async (route) => {
    const response = await route.fetch();
    if (!(response.headers()['content-type'] || '').includes('text/html')) return route.fulfill({ response });
    const body = (await response.text()).replace(ISLAND, (whole, open, json, close) => {
      const data = JSON.parse(json);
      change(data);
      return open + JSON.stringify(data).replace(/</g, '\\u003c') + close;
    });
    return route.fulfill({ response, body });
  });
}

export async function expectNoSidewaysScroll(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, 'the page must not scroll sideways').toBeLessThanOrEqual(innerWidth + 1);
}

/** A visible link inside the theme to an ordinary (soft-navigable) letter: the `skip`-th one if
 *  there are that many (so the test usually has to scroll to it), otherwise the last one found. */
export async function firstLetterLink(page, request, skip = 0) {
  const { letters } = await getIsland(request);
  const soft = new Set(letters.filter((l) => !l.standalone).map((l) => l.url));
  const links = page.locator('#theme-root a[href]');
  const count = await links.count();
  let found = null;
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const href = decodeURI(new URL(await link.getAttribute('href'), 'http://x').pathname);
    if (!soft.has(href) || !(await link.isVisible())) continue;
    found = { link, url: href };
    if (skip-- <= 0) break;
  }
  if (!found) throw new Error('the home view has no visible <a href> to a letter');
  return found;
}
