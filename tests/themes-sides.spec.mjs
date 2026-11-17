// What the "sides" theme decides for itself (assets/themes/sides/README.md). The rules every
// theme shares are in themes.spec.mjs; these are the ones only this theme can break.

import { test, expect } from '@playwright/test';
import { getIsland, open, watch } from './helpers.mjs';

const theme = 'sides';
const ctx = (page, fn, arg) => page.evaluate(fn, arg);

test.describe('theme "sides": its own rules', () => {
  test('three inks: A, B, A/B and the bonus track, which takes no number', async ({ page }) => {
    await open(page, '/', theme);
    const rows = await ctx(page, () => {
      const { letters } = window.__theme.ctx;
      return [...document.querySelectorAll('#theme-root .sd-trk')].map((li) => {
        const letter = letters.byUrl(li.querySelector('a.sd-ttl'));
        return { role: letter.role, side: li.dataset.side, no: li.querySelector('.sd-no').textContent, chip: li.querySelector('.sd-chip').textContent };
      });
    });
    expect(rows.length).toBeGreaterThan(30);
    const want = { him: ['a', 'A'], her: ['b', 'B'], both: ['ab', 'AB'], guest: ['x', '附'] };
    for (const row of rows) expect([row.side, row.chip], `${row.no} (${row.role})`).toEqual(want[row.role]);
    // numbered tracks count up without a gap; a guest's letter does not take a number
    const numbered = rows.filter((row) => row.role !== 'guest');
    expect(numbered.map((row) => row.no)).toEqual(numbered.map((_, i) => String(i + 1).padStart(2, '0')));
    for (const row of rows.filter((r) => r.role === 'guest')) expect(row.no).toBe('+');
    await expect(page.locator('#theme-root .sd-cap-note')).toHaveText(`第 ${numbered.length + 1} 首还没写。`);
  });

  test('the letter two people wrote is in both filters, and a year counts what is shown', async ({ page }) => {
    await open(page, '/', theme);
    const both = await ctx(page, () => window.__theme.ctx.letters.filter((l) => l.role === 'both').map((l) => l.title));
    test.skip(!both.length, 'no letter with two writers');
    for (const filter of ['a', 'b']) {
      await page.locator(`#theme-root .sd-tab[data-filter="${filter}"]`).click();
      const shown = await page.locator('#theme-root .sd-trk:visible a.sd-ttl').allTextContents();
      expect(shown, `filter ${filter}`).toEqual(expect.arrayContaining(both));
      expect(shown.length, `the count on the tab is the number of rows`).toBe(Number(await page.locator(`#theme-root .sd-tab[data-filter="${filter}"] b`).textContent()));
      const years = await ctx(page, () => [...document.querySelectorAll('#theme-root .sd-yr:not([hidden])')].map((yr) => {
        let n = 0;
        for (let el = yr.nextElementSibling; el && !el.classList.contains('sd-yr'); el = el.nextElementSibling) if (!el.hidden) n++;
        return [String(parseInt(yr.lastElementChild.textContent, 10)), String(n)];          // 「2017」「1 封」
      }));
      for (const [said, real] of years) expect(said, 'a year row says how many of its letters are shown').toBe(real);
      await expect(page.locator('#theme-root .sd-yr--empty:visible'), 'empty years are not listed while filtering').toHaveCount(0);
    }
    await page.locator('#theme-root .sd-tab[data-filter="all"]').click();
    await expect(page.locator('#theme-root .sd-yr--empty:visible').first()).toContainText('这一年没有信');
  });

  test('the site\'s own line never fetches a font for itself', async ({ page, baseURL }) => {
    const fonts = [];
    page.on('request', (request) => { if (/\.woff2?(\?|$)/.test(request.url())) fonts.push(request.url().replace(baseURL, '')); });
    await open(page, '/', theme);
    await page.waitForLoadState('networkidle');
    const before = fonts.length;
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('#theme-root .sd-hunger')).toHaveText(await ctx(page, () => window.__theme.ctx.ui.hunger().text));
    await page.waitForTimeout(600);
    expect(fonts.slice(before), 'scrolling to the footer asks for no font').toEqual([]);
  });

  test('a quiet letter and a guest\'s letter get the paper band; the others their ink', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const seen = watch(page, new URL(page.url() || 'http://x').origin);
    for (const letter of [letters.find((l) => l.quiet), letters.find((l) => l.author !== 'Pikajay' && l.author !== 'Pikachi'), letters.find((l) => !l.quiet && !l.standalone && l.author === 'Pikajay')].filter(Boolean)) {
      await open(page, letter.url, theme);
      const plain = await page.locator('#theme-root .sd-letter').getAttribute('data-plain');
      const guest = letter.author !== 'Pikajay' && letter.author !== 'Pikachi';
      expect(plain !== null, letter.title).toBe(Boolean(letter.quiet || guest));
      const band = await ctx(page, () => getComputedStyle(document.querySelector('#theme-root .sd-band')).backgroundColor);
      const paper = await ctx(page, () => getComputedStyle(document.documentElement).backgroundColor);
      expect(band === paper, `${letter.title}: band is paper`).toBe(Boolean(letter.quiet || guest));
    }
    expect(seen.errors).toEqual([]);
  });

  test('in the player, a title with an ampersand stays on one line', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const letter = letters.find((l) => l.title.includes('&'));
    test.skip(!letter, 'no title with an ampersand');
    await page.setViewportSize({ width: 402, height: 874 });
    await open(page, letter.url, theme);
    const sub = page.locator('#theme-root .sd-ptxt > span');
    await expect(sub).toHaveText(letter.title);
    expect((await sub.boundingBox()).height, 'one line').toBeLessThan(24);
    expect(await ctx(page, () => getComputedStyle(document.querySelector('#theme-root .sd-ptxt .sd-amp')).fontFamily), 'the ampersand is drawn by the Chinese face').not.toMatch(/^"?F221 Grotesk/);
  });
});
