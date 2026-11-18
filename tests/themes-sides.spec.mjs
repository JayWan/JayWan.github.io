// What the "sides" theme decides for itself (assets/themes/sides/README.md). The rules every
// theme shares are in themes.spec.mjs; these are the ones only this theme can break.

import { test, expect } from '@playwright/test';
import { expectNoSidewaysScroll, getIsland, open, watch } from './helpers.mjs';

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
    // numbered tracks have no gap (the list starts at the newest and counts down); a guest's letter does not take a number
    const numbered = rows.filter((row) => row.role !== 'guest');
    expect(numbered.map((row) => row.no)).toEqual(numbered.map((_, i) => String(numbered.length - i).padStart(2, '0')));
    for (const row of rows.filter((r) => r.role === 'guest')) expect(row.no).toBe('+');
    // the next track is not announced in words: the first empty cell of the mosaic carries its number
    await expect(page.locator('#theme-root .sd-mosaic .sd-slot').first()).toHaveText(String(numbered.length + 1));
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
    // the year is printed beside it, so the row says only 「没有信」 (the contract's wording, three characters)
    await expect(page.locator('#theme-root .sd-yr--empty:visible span').last()).toHaveText('没有信');
  });

  test('the sort mark turns the track list over; numbers, the bonus track and previous / next stay what they are', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL);
    await open(page, '/', theme);
    const all = await ctx(page, () => [...window.__theme.ctx.letters].map((l) => ({ url: l.url, title: l.title, year: String(l.year), guest: l.role === 'guest', hard: Boolean(l.standalone) })));
    const couple = all.filter((l) => !l.guest);
    const guests = all.filter((l) => l.guest);
    const pad = (n) => String(n).padStart(2, '0');
    /** The list as it is on screen: every row with its number and the year row it stands under. */
    const read = (tab = page) => tab.evaluate(() => {
      const { letters } = window.__theme.ctx;
      let year = '';
      const out = { rows: [], years: [], mark: [...document.querySelectorAll('#theme-root .sd-sort b')].map((b) => b.textContent), pressed: document.querySelector('#theme-root .sd-sort').getAttribute('aria-pressed') };
      for (const li of document.querySelectorAll('#theme-root .sd-list > li')) {
        if (li.matches('.sd-yr')) out.years.push(year = li.firstElementChild.textContent);
        else out.rows.push({ url: letters.byUrl(li.querySelector('a.sd-ttl')).url, no: li.querySelector('.sd-no').textContent, under: year });
      }
      return out;
    });
    const expectOrder = (got, oldestFirst, why) => {
      const turn = (list) => (oldestFirst ? list : [...list].reverse());
      expect(got.rows.map((row) => row.url), `${why}: the couple's letters in order, the guest's letter last`).toEqual([...turn(couple), ...guests].map((l) => l.url));
      expect(got.rows.map((row) => row.no), `${why}: a track keeps its number`).toEqual([...turn(couple.map((_, i) => pad(i + 1))), ...guests.map(() => '+')]);
      for (const row of got.rows) expect(row.under, `${why}: ${row.url} stands under its year`).toBe(guests.some((l) => l.url === row.url) ? 'Bonus track' : all.find((l) => l.url === row.url).year);
      const years = got.years.filter((label) => /^\d{4}$/.test(label)).map(Number);
      expect(years, `${why}: the years run the same way, the empty ones too`).toEqual([...years].sort((a, b) => (oldestFirst ? a - b : b - a)));
      expect(years.length).toBeGreaterThan(new Set(couple.map((l) => l.year)).size - 1);
      if (guests.length) expect(got.years[got.years.length - 1]).toBe('Bonus track');
      expect(got.mark, `${why}: the mark shows the first and the last number of the list as it stands`).toEqual(turn([pad(1), pad(couple.length)]));
      expect(got.pressed).toBe(String(oldestFirst));
    };
    const sort = page.locator('#theme-root .sd-sort');

    // newest first unless the reader says otherwise; the mark is there to tap at both sizes
    expectOrder(await read(), false, 'first visit');
    expect(await sort.getAttribute('aria-label')).toBeTruthy();
    expect((await sort.innerText()).replace(/\s/g, ''), 'the mark is two numbers and an arrow, not a sentence').toMatch(/^\d+$/);
    const size = page.viewportSize();
    for (const view of [{ width: 402, height: 874 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(view);
      await sort.scrollIntoViewIfNeeded();
      await expect(sort).toBeInViewport({ ratio: 1 });
      const box = await sort.boundingBox();
      expect(Math.round(box.height), `${view.width}px: tall enough to tap`).toBeGreaterThanOrEqual(44);
      expect(Math.round(box.width), `${view.width}px: wide enough to tap`).toBeGreaterThanOrEqual(44);
      await expectNoSidewaysScroll(page);
    }
    await page.setViewportSize(size);

    // a letter opened from the list: previous is the earlier one, next the later one, and Back lands on the letter just read
    const at = couple.findIndex((l, i) => i > 9 && !l.hard && couple[i + 1] && !couple[i + 1].hard && couple[i - 1]);
    await page.locator(`#theme-root .sd-trk a.sd-ttl[href="${couple[at].url}"]`).click();
    await expect(page.locator('#theme-root .sd-h1')).toHaveText(couple[at].title);
    await expect(page.locator('#theme-root .sd-pn a[rel="prev"]')).toHaveAttribute('href', couple[at - 1].url);
    await expect(page.locator('#theme-root .sd-pn a[rel="next"]')).toHaveAttribute('href', couple[at + 1].url);
    await page.locator('#theme-root .sd-pn a[rel="next"]').click();
    await expect(page.locator('#theme-root .sd-h1')).toHaveText(couple[at + 1].title);
    await page.goBack();
    const last = page.locator('#theme-root .sd-trk.is-last');
    await expect(last.locator('a.sd-ttl')).toHaveText(couple[at + 1].title);
    await expect(last).toBeInViewport({ ratio: 1 });
    expectOrder(await read(), false, 'back from a letter');

    // the keyboard reaches the mark, the focus shows, and Enter turns the list over
    await page.evaluate(() => window.scrollTo(0, 0));
    await sort.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(sort).toBeFocused();
    expect(await sort.evaluate((button) => button.matches(':focus-visible') && getComputedStyle(button).outlineStyle !== 'none' && parseFloat(getComputedStyle(button).outlineWidth) >= 2), 'a visible focus ring').toBe(true);
    await page.keyboard.press('Enter');
    expectOrder(await read(), true, 'turned over');

    // the choice lasts for the visit: a letter and Back, then a reload; a new tab is a new visit
    await page.locator(`#theme-root .sd-trk a.sd-ttl[href="${couple[at].url}"]`).click();
    await expect(page.locator('#theme-root .sd-pn a[rel="prev"]')).toHaveAttribute('href', couple[at - 1].url);
    await page.locator('#theme-root .sd-pn a[rel="prev"]').click();
    await expect(page.locator('#theme-root .sd-h1')).toHaveText(couple[at - 1].title);
    await page.goBack();
    await expect(last.locator('a.sd-ttl')).toHaveText(couple[at - 1].title);
    await expect(last).toBeInViewport({ ratio: 1 });
    expectOrder(await read(), true, 'turned over, back from a letter');
    await page.reload();
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    expectOrder(await read(), true, 'turned over, after a reload');
    const tab = await page.context().newPage();
    await open(tab, '/', theme);
    expectOrder(await read(tab), false, 'a new tab');
    await tab.close();
    await sort.click();
    expectOrder(await read(), false, 'turned back');
    await page.reload();
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    expectOrder(await read(), false, 'turned back, after a reload');
    expect(seen.errors).toEqual([]);
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

  test('the way to another theme is the last cell of the strip at the top, on every band and down to a 320px phone', async ({ page, isMobile }) => {
    await open(page, '/', theme);
    const urls = await ctx(page, () => {
      const { letters } = window.__theme.ctx;
      const pick = (test) => letters.find(test);
      return ['/', '/404.html', ...[pick((l) => l.role === 'him' && !l.quiet && !l.standalone), pick((l) => l.role === 'her' && !l.quiet), pick((l) => l.role === 'both'), pick((l) => l.quiet), pick((l) => l.role === 'guest')].filter(Boolean).map((l) => l.url)];
    });
    expect(urls.length, 'the home page, the 404 page and a letter of every band').toBeGreaterThanOrEqual(6);
    for (const size of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      for (const url of urls) {
        await open(page, url, theme);
        const toggle = page.locator('#theme-root .theme-switcher-toggle');
        await expect(toggle, `${url}: one control`).toHaveCount(1);
        await (isMobile ? toggle.tap() : toggle.click());
        await expect(page.locator('#theme-root .theme-switcher[data-open] ul')).toBeVisible();
        const at = await ctx(page, () => {
          const nav = document.querySelector('#theme-root .theme-switcher'), button = nav.querySelector('button'), list = nav.querySelector('ul');
          const strip = nav.closest('.sd-cat, .sd-nav'), own = nav.previousElementSibling, worn = list.querySelector('[aria-current]');
          const box = (el) => el.getBoundingClientRect(), middle = (el) => box(el).top + box(el).height / 2;
          const left = (el) => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect().left; };
          return {
            strip: [box(strip).right, box(strip).bottom], button: box(button).toJSON(), list: box(list).toJSON(), screen: window.innerWidth,
            ink: [getComputedStyle(button).color, getComputedStyle(strip).color], paper: [getComputedStyle(list).backgroundColor, getComputedStyle(document.documentElement).backgroundColor],
            // the page's own small print (a letter's place in the list, 404) stands before it on the same line; the home page has none
            own: nav.parentElement.matches('.sd-navr') ? [own.textContent.trim().length, Math.abs(middle(own) - middle(button)), box(own).right - box(button).left] : null,
            names: [...list.querySelectorAll('a')].map((a) => [Math.round(box(a).height), box(a).left >= 0 && box(a).right <= window.innerWidth, Math.abs(left(a) - left(button.firstChild))]),
            worn: [getComputedStyle(worn).fontWeight, getComputedStyle(worn, '::before').borderTopWidth],
            foot: [document.querySelectorAll('#theme-root .sd-foot a[data-theme-id]').length, document.querySelector('#theme-root .sd-foot-row').textContent],
          };
        });
        const where = `${url} at ${size.width}px`;
        expect(at.button.top, `${where}: at the top of the page`).toBe(0);
        expect(at.button.height, `${where}: a finger high`).toBeGreaterThanOrEqual(44);
        expect(at.button.right, `${where}: inside the screen`).toBeLessThanOrEqual(at.screen);
        expect(at.ink[0], `${where}: in the ink of its strip (paper on a band of colour)`).toBe(at.ink[1]);
        if (url === '/') expect(at.own, 'the home page: the control stands alone').toBeNull();
        else {
          expect(at.own[0], `${where}: the page's own small print`).toBeGreaterThan(0);
          expect(at.own[2], `${where}: stands before the control`).toBeLessThan(0.5);
          expect(at.own[1], `${where}: on one line with it`).toBeLessThan(2);
        }
        // the list hangs from the rule under the strip, flush with its right end, on paper
        expect(Math.abs(at.list.top - (at.strip[1] - 1)), `${where}: the list hangs from the rule`).toBeLessThan(0.6);
        expect(Math.abs(at.list.right - at.strip[0]), `${where}: flush with the right end of the strip`).toBeLessThan(0.6);
        expect(at.paper[0], `${where}: on paper`).toBe(at.paper[1]);
        for (const [height, inside, shift] of at.names) {
          expect(height, `${where}: a name is a finger high`).toBeGreaterThanOrEqual(44);
          expect(inside, `${where}: inside the screen`).toBe(true);
          expect(shift, `${where}: the names stand under the name on the button`).toBeLessThan(1.5);
        }
        expect(at.worn, `${where}: the theme being worn is bold and has a square before it`).toEqual(['700', '3px']);
        expect(at.foot[0], `${where}: no names in the footer`).toBe(0);
        expect(at.foot[1], `${where}: the footer ends with the small print of a sleeve`).toMatch(/^©.*STEREO · 双声道$/);
        await expectNoSidewaysScroll(page);
      }
    }
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

  test('a cover shown whole: a drawing on white sits on paper, a photograph on ink', async ({ page }) => {
    await open(page, '/', theme);
    const sleeves = await ctx(page, () => {
      const { letters } = window.__theme.ctx;
      return [...document.querySelectorAll('#theme-root .sd-mosaic a')].map((a) => {
        const { cover, title } = letters.byUrl(a);
        const n = parseInt(cover.color.slice(1), 16);
        return { title, fit: a.querySelector('.sd-slv').dataset.fit || null, light: 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 190 };
      });
    });
    const whole = sleeves.filter((sleeve) => sleeve.fit);
    test.skip(!whole.length, 'no cover is shown whole');
    for (const sleeve of whole) expect(sleeve.fit, sleeve.title).toBe(sleeve.light ? 'paper' : 'ink');
  });

  test('回到曲目表 with the list ahead instead of behind: the letter just read is on screen', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const letter = letters.filter((l) => !l.standalone && !l.quiet)[12];
    test.skip(!letter, 'not enough letters');
    const seen = watch(page, new URL(page.url() || 'http://x').origin);
    for (const size of [{ width: 402, height: 874 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await open(page, letter.url, theme);                                       // opened directly: no list behind it
      await page.locator('#theme-root .sd-pn-back').click();
      const row = page.locator('#theme-root .sd-trk.is-last');
      await expect(row.locator('a.sd-ttl')).toHaveText(letter.title);
      await expect(row, 'the list was added: the row is brought into view').toBeInViewport({ ratio: 1 });
      await page.goBack();                                                       // the letter again; the list is now ahead
      await expect(page.locator('#theme-root .sd-h1')).toHaveText(letter.title);
      await page.locator('#theme-root .sd-nav a[data-back]').click();
      await expect(row.locator('a.sd-ttl')).toHaveText(letter.title);
      await expect(row, `${size.width}px: back to the list a second time`).toBeInViewport({ ratio: 1 });
      const brand = page.locator('#theme-root .sd-nav a.sd-brand');
      await page.goBack();
      await expect(page.locator('#theme-root .sd-h1')).toHaveText(letter.title);
      if (await brand.isVisible()) {                                             // the site's name is an ordinary link: the top of the list
        await brand.click();
        await expect(page.locator('#theme-root .sd-home')).toBeVisible();
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      }
    }
    expect(seen.errors).toEqual([]);
  });
});
