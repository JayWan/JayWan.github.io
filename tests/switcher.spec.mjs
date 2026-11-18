// Getting from one theme to another with something a reader can see.
//
// Every new theme places ctx.ui.switcher() itself. The classic page has no theme code, so the
// core places it there (eggs.classicSwitcher, styled by _scss/_theme-switcher.scss): a row of
// theme names at the foot of the home page, of every letter and of the 404 page, and the same
// row in the drawer the hamburger opens, which is on screen wherever the page has been scrolled
// to. These tests pin down both rows, the trip from classic to each theme and back, and what
// the address bar and the Back button do afterwards.

import { test, expect } from '@playwright/test';
import { themeIds, samplePages, otherSites, expectNoSidewaysScroll } from './helpers.mjs';

const NEW_THEMES = themeIds.filter((id) => id !== 'probe');          // the themes a reader can be given, besides classic
const KINDS = [['home', 'the home page'], ['letter', 'a letter'], ['lost', 'the 404 page']];
const FOOT = 'footer.section--footer nav.theme-switcher';          // the two rows of the classic page
const DRAWER = 'nav.sidebar nav.theme-switcher';

/** Open a page under classic and wait until the core has run. */
async function openClassic(page, path) {
  await otherSites(page);
  await page.goto(`${path}?theme=classic`);
  await page.waitForFunction(() => window.__theme && window.__theme.up === 1);
}

/** What a switcher lists: [id, name, href, current?] per link, in order. */
const listed = (nav) => nav.locator('a[data-theme-id]').evaluateAll((links) => links.map((a) => [a.dataset.themeId, a.textContent, a.getAttribute('href'), a.getAttribute('aria-current') === 'true']));

const search = (page) => new URL(page.url()).search;

for (const [kind, where] of KINDS) {
  test(`classic, ${where}: the themes are listed at the foot of the page`, async ({ page, request }) => {
    const pages = await samplePages(request);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await openClassic(page, pages[kind]);

    const nav = page.locator(FOOT);
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();
    expect((await nav.getAttribute('aria-label')).trim().length, 'it has an accessible name').toBeGreaterThan(0);

    // the list: every theme a visit can be given, by name, in the order of the registry
    const registry = await page.evaluate(() => window.__theme.themes.filter((t) => t[3]).map((t) => [t[0], t[1]]));
    expect(registry.map((t) => t[0])).toEqual(expect.arrayContaining(['classic', ...NEW_THEMES]));
    expect(registry.map((t) => t[0]), 'the reference theme is never offered').not.toContain('probe');
    expect(await listed(nav)).toEqual(registry.map(([id, name]) => [id, name, `?theme=${id}`, id === 'classic']));
    // names and nothing else: no sentence explaining what the row is for
    expect((await nav.innerText()).split('\n').map((s) => s.trim()).filter(Boolean)).toEqual(registry.map((t) => t[1]));

    // where: in the classic footer, the last thing on the page
    await expect(nav.locator('xpath=ancestor::footer[contains(@class, "section--footer")]')).toHaveCount(1);
    if (kind === 'letter') await expect(page.locator('.section--footer .container > div').first(), 'under the © line the page always had').toContainText('Fan & Wan');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    if (kind === 'letter') await expect(page.locator('.modal-toggle-group'), 'the heart button of a letter is showing').toHaveClass(/active/);
    const place = () => page.evaluate((FOOT) => {
      const nav = document.querySelector(FOOT);
      const row = nav.getBoundingClientRect();
      // what the page shows below the row (the buttons that float over the page are not part of its flow)
      const later = [...document.querySelectorAll('body *')].filter((el) => {
        if (nav.contains(el) || el.contains(nav) || el.closest('.sidebar, .sidebar-toggle-wrapper, .modal-toggle-group, .fullscreenModal')) return false;
        const box = el.getBoundingClientRect();
        return getComputedStyle(el).visibility !== 'hidden' && box.height > 0 && box.width > 0 && box.top >= row.bottom - 1;
      });
      return { onScreen: row.top >= 0 && row.bottom <= window.innerHeight, later: later.map((el) => el.className || el.tagName), toTheEnd: Math.round(document.documentElement.scrollHeight - window.scrollY - row.bottom) };
    }, FOOT);
    await expect.poll(async () => (await place()).onScreen, 'with the page scrolled to its end the row is on screen').toBe(true);
    const { later, toTheEnd } = await place();
    expect(later, 'nothing follows it').toEqual([]);
    expect(toTheEnd, 'it keeps clear of the bottom edge of the screen').toBeGreaterThanOrEqual(40);
    expect(toTheEnd, 'and is not lost below a screenful of nothing').toBeLessThan(200);

    // every name can be tapped: at least 44px high, inside the screen, nothing lying on top of it
    // (on a letter the heart button floats in the bottom right corner)
    const targets = await nav.locator('a[data-theme-id]').evaluateAll((links) => links.map((a) => {
      const box = a.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const heart = document.querySelector('.modal-toggle-group.active');
      const h = heart && heart.getBoundingClientRect();
      return { id: a.dataset.themeId, height: Math.round(box.height), inside: box.left >= 0 && box.right <= window.innerWidth, onTop: top === a || a.contains(top),
        underHeart: Boolean(h) && box.left < h.right && box.right > h.left && box.top < h.bottom && box.bottom > h.top };
    }));
    for (const target of targets) {
      expect(target.height, `${target.id}: tall enough for a finger`).toBeGreaterThanOrEqual(44);
      expect(target, target.id).toMatchObject({ inside: true, onTop: true, underHeart: false });
    }
    await expectNoSidewaysScroll(page);

    // in the classic theme's own type: the footer's face and size, the current theme in the text colour
    const type = await page.evaluate((FOOT) => {
      const css = (el) => { const s = getComputedStyle(el); return { family: s.fontFamily, size: s.fontSize, color: s.color }; };
      return { current: css(document.querySelector(`${FOOT} a[aria-current="true"]`)), other: css(document.querySelector(`${FOOT} a:not([aria-current])`)), footer: css(document.querySelector(FOOT).closest('footer')) };
    }, FOOT);
    expect(type.current.family).toBe(type.footer.family);
    expect(type.current.family).toContain('Roboto');
    expect(type.current.size).toBe(type.footer.size);
    expect(type.current.color, 'the current theme is in the colour of the text').toBe(type.footer.color);
    expect(type.other.color, 'the others are quieter').not.toBe(type.footer.color);
    expect(errors).toEqual([]);
  });
}

for (const [index, [kind, where]] of KINDS.entries()) {
  test(`classic, ${where}: the same names are in the drawer, one tap from anywhere on the page`, async ({ page, request, isMobile }) => {
    const pages = await samplePages(request);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await openClassic(page, pages[kind]);
    const path = new URL(page.url()).pathname;
    const steps = await page.evaluate(() => history.length);
    const press = (target) => (isMobile ? target.tap() : target.click());

    // closed, the drawer shows nothing of it (and so is no stop for the Tab key)
    const nav = page.locator(DRAWER);
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeHidden();
    await expectNoSidewaysScroll(page);

    // the hamburger stays on screen however far the page has been scrolled; the foot of the page does not
    await page.evaluate(() => window.scrollTo(0, Math.floor((document.documentElement.scrollHeight - window.innerHeight) / 2)));
    const burger = page.locator('label.sidebar-toggle-wrapper');
    await expect(burger).toBeInViewport({ ratio: 1 });
    await press(burger);
    await expect(nav).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.innerWidth - document.querySelector('nav.sidebar').getBoundingClientRect().right)), 'the drawer has slid in').toBe(0);

    // the same list as at the foot of the page, names and nothing else
    const registry = await page.evaluate(() => window.__theme.themes.filter((t) => t[3]).map((t) => [t[0], t[1]]));
    expect(await listed(nav)).toEqual(registry.map(([id, name]) => [id, name, `?theme=${id}`, id === 'classic']));
    expect(await listed(nav)).toEqual(await listed(page.locator(FOOT)));
    expect((await nav.innerText()).split('\n').map((s) => s.trim()).filter(Boolean)).toEqual(registry.map((t) => t[1]));

    // where: one line under the drawer's logo, above its first letter, inside the drawer
    const box = await page.evaluate((DRAWER) => {
      const nav = document.querySelector(DRAWER);
      const drawer = nav.closest('nav.sidebar');
      const edge = drawer.getBoundingClientRect();
      const css = (el) => { const s = getComputedStyle(el); return { family: s.fontFamily, color: s.color }; };
      return {
        tops: [...new Set([...nav.querySelectorAll('a')].map((a) => Math.round(a.getBoundingClientRect().top)))],
        row: nav.getBoundingClientRect().toJSON(),
        logoBottom: drawer.querySelector('.textLogo').getBoundingClientRect().bottom,
        firstLetterTop: drawer.querySelector('.sidebar-recentPosts li').getBoundingClientRect().top,
        drawer: { left: edge.left, right: edge.left + drawer.clientLeft + drawer.clientWidth },
        targets: [...nav.querySelectorAll('a')].map((a) => {
          const r = a.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { id: a.dataset.themeId, width: Math.round(r.width), height: Math.round(r.height), left: r.left, right: r.right, onTop: top === a || a.contains(top) };
        }),
        current: css(nav.querySelector('a[aria-current="true"]')), other: css(nav.querySelector('a:not([aria-current])')), drawerType: css(drawer),
      };
    }, DRAWER);
    expect(box.tops, 'the names are on one line').toHaveLength(1);
    expect(box.row.top, 'under the logo').toBeGreaterThanOrEqual(box.logoBottom);
    expect(box.row.bottom, 'above the first letter').toBeLessThanOrEqual(box.firstLetterTop);
    expect(box.row.top, 'on the first screen of the drawer').toBeLessThan(200);
    for (const target of box.targets) {
      expect(target.height, `${target.id}: tall enough for a finger`).toBeGreaterThanOrEqual(44);
      expect(target.width, `${target.id}: wide enough for a finger`).toBeGreaterThanOrEqual(44);
      expect(target.left, `${target.id}: inside the drawer`).toBeGreaterThanOrEqual(box.drawer.left);
      expect(target.right, `${target.id}: inside the drawer`).toBeLessThanOrEqual(box.drawer.right + 0.5);
      expect(target.onTop, `${target.id}: nothing lies on top of it`).toBe(true);
    }
    expect(box.current.family, 'in the face of the drawer').toBe(box.drawerType.family);
    expect(box.current.color, 'the current theme stands out from the others').not.toBe(box.other.color);
    await expectNoSidewaysScroll(page);

    // a name pressed there does what a name at the foot does
    const theme = NEW_THEMES[index % NEW_THEMES.length];
    await press(nav.locator(`a[data-theme-id="${theme}"]`));
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    expect(new URL(page.url()).pathname, 'the same page').toBe(path);
    expect(search(page), 'nothing is left in the address').toBe('');
    expect(await page.evaluate(() => history.length), 'changing clothes adds no step to Back').toBe(steps);
    expect(errors).toEqual([]);
  });
}

test('classic: the row leaves room for the home indicator of a phone', async ({ request }) => {
  // env(safe-area-inset-bottom) is 0 in every test browser; what can be checked is that the rule asks for it.
  const css = await (await request.get('/assets/css/main.css')).text();
  expect(css).toMatch(/\.theme-switcher\s*\{[^}]*env\(safe-area-inset-bottom/);
});

for (const [index, theme] of NEW_THEMES.entries()) {
  test(`from classic to "${theme}" and back`, async ({ page, request }) => {
    const pages = await samplePages(request);
    const start = [pages.letter, pages.home, pages.lost][index % 3];        // each kind of page takes its turn as the way out
    await openClassic(page, start);
    const path = new URL(page.url()).pathname;
    const steps = await page.evaluate(() => history.length);

    await page.locator(`${FOOT} a[data-theme-id="${theme}"]`).click();
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    expect(new URL(page.url()).pathname, 'the same page').toBe(path);
    expect(search(page), 'nothing is left in the address').toBe('');
    expect(await page.evaluate(() => window.__theme.by)).toBe('url');
    expect(await page.evaluate(() => history.length), 'changing clothes adds no step to Back').toBe(steps);

    // ... for the rest of the visit: a reload, another page
    await page.reload();
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    expect(await page.evaluate(() => window.__theme.by)).toBe('visit');
    await page.goto(pages.home);
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    await page.goto(pages.letter);
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);

    // ... and back, from a letter and from the home page, with what the theme itself shows: its
    // switcher is on the page, marks itself, and its link to classic can be scrolled to and pressed
    for (const from of [pages.letter, pages.home]) {
      if (from !== pages.letter) {
        await page.goto(`${from}?theme=${theme}`);
        await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
      }
      const own = page.locator('#theme-root nav.theme-switcher');
      await expect(own, `"${theme}" has the switcher on ${from}`).toHaveCount(1);
      await expect(own.locator('a[aria-current="true"]')).toHaveAttribute('data-theme-id', theme);
      const back = own.locator('a[data-theme-id="classic"]');
      await back.scrollIntoViewIfNeeded();
      await expect(back).toBeVisible();
      expect((await back.boundingBox()).height, 'tall enough for a finger').toBeGreaterThanOrEqual(44);
      // The reader stays on the page the name was pressed on. That is not always the page that was
      // opened: "drift" keeps its switcher at the foot of the river, and a letter that has been
      // scrolled away to get there closes, so by then the address is "/".
      await page.evaluate(() => document.addEventListener('click', () => sessionStorage.setItem('test:pressed-on', location.pathname), true));
      await back.click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'classic' && window.__theme.up === 1);
      expect(search(page)).toBe('');
      expect(new URL(page.url()).pathname).toBe(await page.evaluate(() => sessionStorage.getItem('test:pressed-on')));
      await expect(page.locator(`${FOOT} a[aria-current="true"]`)).toHaveAttribute('data-theme-id', 'classic');
      await expect(page.locator('#theme-root')).toBeEmpty();
    }
  });
}

test('after switching, Back and Forward stay in the new theme and the address stays clean', async ({ page, request }) => {
  const pages = await samplePages(request);
  const theme = NEW_THEMES[0];
  await openClassic(page, pages.home);
  expect(search(page)).toBe('');
  await page.locator(`.blockGroup-list a[href="${encodeURI(pages.letter)}"]`).first().click();        // read a letter, still in classic
  await page.waitForFunction(() => window.__theme && window.__theme.up === 1 && window.__theme.page === 'letter');
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, window.__theme.by])).toEqual(['classic', 'visit']);

  await page.locator(`${FOOT} a[data-theme-id="${theme}"]`).click();                                  // change there
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(search(page)).toBe('');

  await page.goBack();                                                                                 // the home page was last seen in classic
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(search(page)).toBe('');
  await expect(page.locator('body > footer.section--footer--switcher'), 'nothing of the classic page is left').toHaveCount(0);

  await page.goForward();
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(decodeURI(new URL(page.url()).pathname)).toBe(pages.letter);
  expect(search(page)).toBe('');
});

test('classic: the row can be reached and used with the keyboard', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'a phone has no Tab key');
  const pages = await samplePages(request);
  await openClassic(page, pages.lost);                                 // the page with the fewest stops on the way
  // (the row in the drawer is no stop on the way: a closed drawer is not there for the keyboard either)
  const focused = () => page.evaluate((FOOT) => { const a = document.activeElement; return a && a.closest(FOOT) ? a.dataset.themeId : null; }, FOOT);
  for (let i = 0; i < 12 && !(await focused()); i++) await page.keyboard.press('Tab');
  expect(await focused(), 'Tab arrives at the first name').toBe('classic');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
  expect(ring.style, 'focus can be seen').toBe('solid');
  expect(ring.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Tab');
  const next = await focused();
  expect(next, 'Tab moves on to the next name').toBe(await page.evaluate(() => window.__theme.themes.filter((t) => t[3])[1][0]));
  await page.keyboard.press('Enter');
  await page.waitForSelector(`html[data-theme-ready="${next}"]`);
  expect(search(page)).toBe('');
});

test('classic: a link of the row opened in a new tab is an ordinary link to that theme', async ({ page, request, context, isMobile }) => {
  test.skip(isMobile, 'no modifier keys on a phone');
  const pages = await samplePages(request);
  const theme = NEW_THEMES[NEW_THEMES.length - 1];
  await openClassic(page, pages.home);
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    page.locator(`${FOOT} a[data-theme-id="${theme}"]`).click({ modifiers: ['ControlOrMeta'] }),
  ]);
  await tab.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(search(tab)).toBe('');
  expect(await page.evaluate(() => document.documentElement.dataset.theme), 'the page it was opened from has not moved').toBe('classic');
});

test('without JavaScript there is no switcher: classic is the only theme then', async ({ browser, baseURL, request }) => {
  const pages = await samplePages(request);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route(/^https:\/\//, (route) => route.abort());
  for (const [kind] of KINDS) {
    await page.goto(pages[kind]);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'classic');
    await expect(page.locator('.theme-switcher, .section--footer--switcher'), kind).toHaveCount(0);
    await expect(page.locator('a[href*="theme="]'), kind).toHaveCount(0);
  }
  await context.close();
});

test('where there is nothing to switch to, nothing is offered', async ({ page, request }) => {
  // a browser too old for the new themes always gets classic: a row of names would only reload the page
  const pages = await samplePages(request);
  await page.addInitScript(() => { CSS.supports = () => false; });
  await otherSites(page);
  for (const [kind] of KINDS) {
    await page.goto(pages[kind]);
    await page.waitForFunction(() => window.__theme && window.__theme.up === 1);
    expect(await page.evaluate(() => [document.documentElement.dataset.theme, window.__theme.by]), kind).toEqual(['classic', 'old']);
    await expect(page.locator('.theme-switcher, .section--footer--switcher'), kind).toHaveCount(0);
  }
});

test('classic: a tap on a name is not one of the three taps of the hidden egg', async ({ page, request }) => {
  // Three quick taps on the footer move on to the next theme (tests/eggs.spec.mjs). The row of
  // names lives in that footer: a name pressed twice more by an impatient finger while the page
  // is loading must still lead to that theme, not to the one after classic.
  const pages = await samplePages(request);
  await openClassic(page, pages.letter);
  const [next, wanted] = await page.evaluate(() => { const ids = window.__theme.themes.filter((t) => t[3]).map((t) => t[0]); return [ids[(ids.indexOf('classic') + 1) % ids.length], ids[ids.length - 1]]; });
  expect(wanted).not.toBe(next);
  await page.evaluate(([FOOT, id]) => {
    const a = document.querySelector(`${FOOT} a[data-theme-id="${id}"]`);
    for (let i = 0; i < 3; i++) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  }, [FOOT, wanted]);
  await page.waitForSelector('html[data-theme-ready]');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(wanted);
});
