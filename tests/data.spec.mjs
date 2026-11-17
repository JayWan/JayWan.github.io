// The built files themselves: the data island on every page, and the size of what is inline.
// No browser needed; these run once, in the chrome project.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { root, themeIds } from './helpers.mjs';

const site = process.env.SITE_DIR ? path.resolve(process.env.SITE_DIR) : path.join(root, 'tests/.site');

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'assets' ? [] : htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}
const islandOf = (html) => /<script type="application\/json" id="letters-data">([\s\S]*?)<\/script>/.exec(html);

test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', 'file checks run once'));

test('every page carries one valid data island, the same letters everywhere', () => {
  const files = htmlFiles(site);
  expect(files.length).toBeGreaterThan(30);
  const home = JSON.parse(islandOf(readFileSync(path.join(site, 'index.html'), 'utf8'))[1]);

  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const name = path.relative(site, file);
    expect(html.split('id="letters-data"').length - 1, name).toBe(1);
    const text = islandOf(html)[1];
    expect(text, `${name}: no "<" inside the island, so nothing can close the <script> early`).not.toContain('<');
    const data = JSON.parse(text);
    expect(data.letters, `${name}: identical letters on every page`).toEqual(home.letters);
    expect(data.site).toEqual(home.site);
    const type = name === 'index.html' ? 'home' : name.startsWith('404') ? '404' : 'letter';
    expect(data.page.type, name).toBe(type);
    if (type === 'letter') expect(home.letters.some((l) => l.url === data.page.url), `${name}: page.url is a letter's url`).toBe(true);
  }
});

test('letters are oldest first and every field has the documented shape', () => {
  const { site: info, letters } = JSON.parse(islandOf(readFileSync(path.join(site, 'index.html'), 'utf8'))[1]);
  for (const key of ['met', 'together', 'married', 'born']) expect(info[key], key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(info.built).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  letters.forEach((letter, i) => {
    const where = `letter ${i + 1} (${letter.title})`;
    expect(letter.no, where).toBe(i + 1);
    expect(letter.date, where).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(letter.time, where).toMatch(/^\d{2}:\d{2}$/);
    if (i) expect(letter.date >= letters[i - 1].date, `${where}: oldest first`).toBe(true);
    expect(typeof letter.author, where).toBe('string');
    expect(letter.url, where).toMatch(/^\/story\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/);
    expect(existsSync(path.join(site, letter.url, 'index.html')), `${where}: url points at a built page`).toBe(true);
    expect(letter.chars, where).toBeGreaterThan(50);
    expect(typeof letter.standalone, where).toBe('boolean');
    expect(typeof letter.quiet, where).toBe('boolean');

    if (letter.song) {
      expect(letter.song.src, `${where}: song.src is percent-encoded`).toMatch(/^\/assets\/bgm\/[A-Za-z0-9%._~()'!*-]+\.mp3$/);
      expect(existsSync(path.join(site, decodeURIComponent(letter.song.src))), `${where}: the song file exists`).toBe(true);
      expect(letter.song.title.endsWith('.mp3'), where).toBe(false);
      expect(letter.song.duration, where).toBeGreaterThan(30);
    }
    if (letter.cover) {
      const { cover } = letter;
      expect(existsSync(path.join(site, decodeURIComponent(cover.orig))), `${where}: the cover exists`).toBe(true);
      expect(cover.w > 0 && cover.h > 0, where).toBe(true);
      expect(cover.color, where).toMatch(/^#[0-9a-f]{6}$/);
      expect(cover.lqip.startsWith('data:image/'), where).toBe(true);
      expect(cover.focus.length, where).toBe(2);
      expect(cover.widths.length, where).toBeGreaterThan(0);
      for (const w of cover.widths) {
        expect(w, where).toBeLessThanOrEqual(cover.w);
        for (const ext of ['avif', 'jpg']) expect(existsSync(path.join(site, `${cover.base}-${w}.${ext}`)), `${where}: ${cover.base}-${w}.${ext}`).toBe(true);
      }
    }
  });
  expect(letters.filter((l) => l.quiet).length, 'the quiet letter is marked').toBeGreaterThan(0);
  expect(letters.filter((l) => l.standalone).length, 'the standalone letter is marked').toBeGreaterThan(0);
});

test('the inline boot script stays small and knows exactly the themes that have files', () => {
  const html = readFileSync(path.join(site, 'index.html'), 'utf8');
  const boot = /<script>(\(function\(w,d,C\)\{[\s\S]*?)<\/script>/.exec(html)[1];
  // Inline on every page, before anything else. About 3.6 KB of code plus the registry.
  expect(Buffer.byteLength(boot), 'boot script bytes').toBeLessThan(5 * 1024);
  expect(() => new Function(boot), 'the squeezed script still parses').not.toThrow();

  const cut = boot.lastIndexOf('})(window,document,');
  const config = JSON.parse(boot.slice(cut + '})(window,document,'.length, boot.lastIndexOf(');')));
  const ids = config.t.map((t) => t[0]);
  expect(ids).toContain('classic');
  expect(ids.filter((id) => id !== 'classic').sort()).toEqual([...themeIds].sort());
  expect(config.t.find((t) => t[0] === 'probe')[3], 'probe is never drawn').toBe(0);
  for (const id of Object.values(config.d)) expect(config.t.find((t) => t[0] === id)[3], `${id} has a day, so it must be drawable`).toBe(1);
  for (const [id, , , , fonts] of config.t) {
    if (id === 'classic') continue;
    expect(existsSync(path.join(site, 'assets/themes', id, 'theme.css')), `${id}/theme.css`).toBe(true);
    for (const font of fonts) expect(existsSync(path.join(site, 'assets/fonts', `${font}.css`)), `${id}: assets/fonts/${font}.css`).toBe(true);
  }
});

test('theme files stay within their budgets', () => {
  for (const id of themeIds) {
    const dir = path.join(root, 'assets/themes', id);
    expect(statSync(path.join(dir, 'theme.css')).size, `${id}/theme.css ≤ 40 KB`).toBeLessThanOrEqual(40 * 1024);
    expect(statSync(path.join(dir, 'theme.js')).size, `${id}/theme.js ≤ 60 KB`).toBeLessThanOrEqual(60 * 1024);
  }
});
