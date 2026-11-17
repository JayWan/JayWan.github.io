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

test('the island template escapes "<", so no title or quote can end the <script> early', () => {
  // No letter contains "<" today, so the built pages cannot prove this: check the template itself.
  const escape = `${String.fromCharCode(92)}u003c`;                    // backslash, u003c
  const template = readFileSync(path.join(root, '_includes/letters-data.html'), 'utf8');
  expect(template).toContain(`{{ island | replace: "<", "${escape}" }}`);
  expect(JSON.parse(`"${escape}/script>"`)).toBe('</script>');          // and that escape is valid JSON for "<"
});

test('letters are oldest first and every field has the documented shape', () => {
  const { site: info, letters } = JSON.parse(islandOf(readFileSync(path.join(site, 'index.html'), 'utf8'))[1]);
  for (const key of ['met', 'together', 'married', 'born']) expect(info[key], key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(info.built).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  letters.forEach((letter, i) => {
    const where = `letter ${i + 1} (${letter.title})`;
    expect(letter.no, where).toBe(i + 1);
    expect(letter.date, where).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // a letter whose real day is not its `date` (written_on) carries no time
    if (letter.time !== null) expect(letter.time, where).toMatch(/^\d{2}:\d{2}$/);
    if (i) expect(letter.date >= letters[i - 1].date, `${where}: oldest first`).toBe(true);
    expect(typeof letter.author, where).toBe('string');
    expect(letter.authors[0], `${where}: authors starts with the author`).toBe(letter.author);
    expect(letter.days === null || Object.values(letter.days).every((n) => Number.isInteger(n) && n > 0), `${where}: days is null or stated counts`).toBe(true);
    expect(letter.url, where).toMatch(/^\/(?:[^/]+\/)*\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/);
    expect(existsSync(path.join(site, letter.url, 'index.html')), `${where}: url points at a built page`).toBe(true);
    expect(letter.chars, `${where}: the letter has text`).toBeGreaterThan(10);   // the shortest so far is one line
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
      expect(typeof cover.own, `${where}: cover.own`).toBe('boolean');
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

test('the island carries what the front matter says: the real day, stated counts, co-author, borrowed covers, the guest', () => {
  const { letters } = JSON.parse(islandOf(readFileSync(path.join(site, 'index.html'), 'utf8'))[1]);
  const by = (title) => letters.find((l) => l.title === title);

  // 「One Year」 was written on 2017-02-21; the typo in its `date` lives on in its URL only
  const oneYear = by('One Year');
  expect([oneYear.date, oneYear.time, oneYear.url]).toEqual(['2017-02-21', null, '/story/2017/01/21/One-Year/']);
  expect(letters[oneYear.no - 2].date <= oneYear.date && oneYear.date <= letters[oneYear.no].date, 'it is numbered by its real day').toBe(true);

  // letters that state their own count (they count inclusively)
  expect(by('221 FOREVER').days).toEqual({ met: 295 });
  expect(by('和小天使的三百天').days).toEqual({ together: 300 });
  expect(letters.filter((l) => l.days).length).toBe(2);

  // one letter was written by the two of them, and one by a guest
  expect(by('教小天使发布文章').authors).toEqual(['Pikajay', 'Pikachi']);
  expect(letters.filter((l) => l.authors.length > 1).length).toBe(1);
  expect(letters[letters.length - 1].authors).toEqual(['Claude']);

  // covers that are pictures found online
  const borrowed = letters.filter((l) => l.cover && l.cover.own === false).map((l) => l.no);
  expect(borrowed).toContain(1);
  expect(borrowed.length).toBeGreaterThan(5);
  expect(borrowed.length).toBeLessThan(letters.length / 2);
});

test('the island knows the size of every picture used inside a letter', () => {
  const { pictures } = JSON.parse(islandOf(readFileSync(path.join(site, 'index.html'), 'utf8'))[1]);
  const used = new Set();
  for (const file of htmlFiles(site)) {
    const body = readFileSync(file, 'utf8').split('class="content-body"')[1] || '';
    for (const m of body.matchAll(/\/assets\/images\/posts\/([^"')\s]+?\.(?:jpe?g|png|gif|webp))/gi)) used.add(decodeURIComponent(m[1]));
  }
  expect(used.size, 'letters use pictures').toBeGreaterThan(20);
  for (const name of used) {
    const entry = pictures[name];
    expect(entry, `pictures["${name}"]`).toBeTruthy();
    expect(entry[0] > 0 && entry[1] > 0, `${name}: width and height`).toBe(true);
    if (entry.length > 2) {
      expect(entry[3].length, `${name}: derivative widths`).toBeGreaterThan(0);
      for (const w of entry[3]) for (const ext of ['avif', 'jpg']) expect(existsSync(path.join(site, `${entry[2]}-${w}.${ext}`)), `${name}: ${entry[2]}-${w}.${ext}`).toBe(true);
    }
  }
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

test('the fonts named in _data/themes.yml exist', () => {
  // The boot script leaves out a font whose stylesheet is missing (the theme then shows its
  // fallback fonts), so a misspelt name would go unnoticed on the page. It is noticed here.
  // Skipped in a checkout that has no fonts at all yet.
  const fontsDir = path.join(root, 'assets/fonts');
  test.skip(!existsSync(fontsDir), 'assets/fonts is not in this checkout yet');
  const registry = readFileSync(path.join(root, '_data/themes.yml'), 'utf8');
  const entries = registry.split(/^\s*- id:\s*/m).slice(1);
  expect(entries.length).toBeGreaterThan(4);
  for (const entry of entries) {
    const id = entry.split('\n')[0].trim();
    const fonts = (/^\s*fonts:\s*\[(.*)\]/m.exec(entry) || [])[1];
    expect(fonts, `${id}: fonts is written as a [list] on one line`).not.toBeUndefined();
    for (const font of fonts.split(',').map((name) => name.trim()).filter(Boolean)) {
      expect(existsSync(path.join(fontsDir, `${font}.css`)), `${id}: assets/fonts/${font}.css`).toBe(true);
    }
  }
});

test('theme files stay within their budgets', () => {
  for (const id of themeIds) {
    const dir = path.join(root, 'assets/themes', id);
    expect(statSync(path.join(dir, 'theme.css')).size, `${id}/theme.css ≤ 40 KB`).toBeLessThanOrEqual(40 * 1024);
    expect(statSync(path.join(dir, 'theme.js')).size, `${id}/theme.js ≤ 60 KB`).toBeLessThanOrEqual(60 * 1024);
  }
});
