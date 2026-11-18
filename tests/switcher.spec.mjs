// Changing theme with something a reader can see, in the top right corner of every page.
//
// Every new theme places ctx.ui.switcher() itself: a button in the top right corner that shows
// the name of the theme being worn and, pressed, opens a list of the themes. The classic page has
// no theme code, and its top right corner has had a control that opens all along: the hamburger
// and its drawer. The core puts the names in that drawer (eggs.classicSwitcher, styled by
// _scss/_theme-switcher.scss). No page has a row of names at its foot any more.
//
// These tests pin down the control in every theme and on every kind of page, the trip from
// classic to each theme and back, and what the address bar and the Back button do afterwards.

import { test, expect } from '@playwright/test';
import { themeIds, samplePages, otherSites, expectNoSidewaysScroll, pickTheme, OWN_SWITCHER as OWN, DRAWER_SWITCHER as DRAWER } from './helpers.mjs';

const NEW_THEMES = themeIds.filter((id) => id !== 'probe');          // the themes a reader can be given, besides classic
const KINDS = [['home', 'the home page'], ['letter', 'a letter'], ['lost', 'the 404 page']];
const TOGGLE = `${OWN} .theme-switcher-toggle`;

/** Open a page under classic and wait until the core has run. */
async function openClassic(page, path) {
  await otherSites(page);
  await page.goto(`${path}?theme=classic`);
  await page.waitForFunction(() => window.__theme && window.__theme.up === 1);
}
/** Open a page under a new theme and wait until it has drawn. */
async function openTheme(page, path, theme) {
  await page.goto(`${path}?theme=${theme}`);
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
}

/** What a list of themes holds: [id, name, href, current?] per link, in order. */
const listed = (nav) => nav.locator('a[data-theme-id]').evaluateAll((links) => links.map((a) => [a.dataset.themeId, a.textContent, a.getAttribute('href'), a.getAttribute('aria-current') === 'true']));

/** Words a stylesheet puts around a list (generated content is not part of innerText). A mark
 *  drawn with an empty or a symbol-only ::before / ::after is not words. */
const generated = (nav) => nav.evaluate((row) => [row, ...row.querySelectorAll('*')]
  .flatMap((el) => ['::before', '::after'].map((pseudo) => getComputedStyle(el, pseudo).content))
  .filter((content) => content && !['none', 'normal'].includes(content) && /\p{L}/u.test(content)));

const search = (page) => new URL(page.url()).search;
/** The themes a list holds: the ones a visit can be given, plus the one being worn if it is a hidden one (the reference theme). */
const registryOf = (page) => page.evaluate(() => window.__theme.themes.filter((t) => t[3] || t[0] === window.__theme.id).map((t) => [t[0], t[1]]));

// ------------------------------------------------------------------ classic: the drawer

for (const [index, [kind, where]] of KINDS.entries()) {
  test(`classic, ${where}: the names are in the drawer the hamburger opens, and nowhere else`, async ({ page, request, isMobile }) => {
    const pages = await samplePages(request);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await openClassic(page, pages[kind]);
    const path = new URL(page.url()).pathname;
    const steps = await page.evaluate(() => history.length);
    const press = (target) => (isMobile ? target.tap() : target.click());

    // one list on the page, in the drawer; nothing at the foot of the page
    await expect(page.locator('.theme-switcher')).toHaveCount(1);
    await expect(page.locator('footer .theme-switcher, .section--footer--switcher'), 'no row at the foot of the page').toHaveCount(0);
    // closed, the drawer shows nothing of it (and so is no stop for the Tab key)
    const nav = page.locator(DRAWER);
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeHidden();
    await expectNoSidewaysScroll(page);

    // the hamburger is in the top right corner and stays there however far the page has been scrolled
    await page.evaluate(() => window.scrollTo(0, Math.floor((document.documentElement.scrollHeight - window.innerHeight) / 2)));
    const burger = page.locator('label.sidebar-toggle-wrapper');
    await expect(burger).toBeInViewport({ ratio: 1 });
    const corner = await burger.evaluate((el) => { const box = el.getBoundingClientRect(); return { fromRight: window.innerWidth - box.right, top: box.top }; });
    expect(corner.fromRight, 'at the right edge').toBeLessThan(80);
    expect(corner.top, 'at the top').toBeLessThan(80);
    await press(burger);
    await expect(nav).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.innerWidth - document.querySelector('nav.sidebar').getBoundingClientRect().right)), 'the drawer has slid in').toBe(0);

    // the list: every theme a visit can be given, by name, in the order of the registry; names and nothing else
    const registry = await registryOf(page);
    expect(registry.map((t) => t[0])).toEqual(expect.arrayContaining(['classic', ...NEW_THEMES]));
    expect(registry.map((t) => t[0]), 'the reference theme is never offered').not.toContain('probe');
    expect(await listed(nav)).toEqual(registry.map(([id, name]) => [id, name, `?theme=${id}`, id === 'classic']));
    expect((await nav.getAttribute('aria-label')).trim().length, 'it has an accessible name').toBeGreaterThan(0);
    expect((await nav.innerText()).split('\n').map((s) => s.trim()).filter(Boolean)).toEqual(registry.map((t) => t[1]));
    expect(await generated(nav)).toEqual([]);

    // where: one line under the drawer's logo, above its first letter, inside the drawer
    const box = await page.evaluate((DRAWER) => {
      const row = document.querySelector(DRAWER);
      const drawer = row.closest('nav.sidebar');
      const edge = drawer.getBoundingClientRect();
      const css = (el) => { const s = getComputedStyle(el); return { family: s.fontFamily, color: s.color }; };
      return {
        tops: [...new Set([...row.querySelectorAll('a')].map((a) => Math.round(a.getBoundingClientRect().top)))],
        row: row.getBoundingClientRect().toJSON(),
        logoBottom: drawer.querySelector('.textLogo').getBoundingClientRect().bottom,
        firstLetterTop: drawer.querySelector('.sidebar-recentPosts li').getBoundingClientRect().top,
        drawer: { left: edge.left, right: edge.left + drawer.clientLeft + drawer.clientWidth },
        targets: [...row.querySelectorAll('a')].map((a) => {
          const r = a.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { id: a.dataset.themeId, width: Math.round(r.width), height: Math.round(r.height), left: r.left, right: r.right, onTop: top === a || a.contains(top) };
        }),
        current: css(row.querySelector('a[aria-current="true"]')), other: css(row.querySelector('a:not([aria-current])')), drawerType: css(drawer),
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

    // a name pressed there changes theme: the same page, a clean address, no step added to Back
    const theme = NEW_THEMES[index % NEW_THEMES.length];
    await press(nav.locator(`a[data-theme-id="${theme}"]`));
    await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
    expect(new URL(page.url()).pathname, 'the same page').toBe(path);
    expect(search(page), 'nothing is left in the address').toBe('');
    expect(await page.evaluate(() => history.length), 'changing clothes adds no step to Back').toBe(steps);
    expect(errors).toEqual([]);
  });
}

for (const width of [375, 360, 320]) {
  test(`classic: on a phone ${width}px wide the names in the drawer stay on one line`, async ({ page, request, isMobile }) => {
    const pages = await samplePages(request);
    await page.setViewportSize({ width, height: 640 });
    await openClassic(page, pages.letter);
    const burger = page.locator('label.sidebar-toggle-wrapper');
    await (isMobile ? burger.tap() : burger.click());
    await expect(page.locator(DRAWER)).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.innerWidth - document.querySelector('nav.sidebar').getBoundingClientRect().right)), 'the drawer has slid in').toBe(0);
    const lines = await page.locator(`${DRAWER} a[data-theme-id]`).evaluateAll((links) => ({
      tops: [...new Set(links.map((a) => Math.round(a.getBoundingClientRect().top)))].length,
      small: links.filter((a) => { const box = a.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map((a) => a.dataset.themeId),
      outside: links.filter((a) => { const box = a.getBoundingClientRect(); return box.left < 0 || box.right > window.innerWidth; }).map((a) => a.dataset.themeId),
    }));
    expect(lines).toEqual({ tops: 1, small: [], outside: [] });
    await expectNoSidewaysScroll(page);
  });
}

test('classic: the hamburger and the names behind it can be reached and used with the keyboard', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'a phone has no Tab key');
  const pages = await samplePages(request);
  await openClassic(page, pages.lost);                                 // the page with the fewest stops on the way
  const onBurger = () => page.evaluate(() => Boolean(document.activeElement && document.activeElement.matches('label.sidebar-toggle-wrapper')));
  const onName = () => page.evaluate((DRAWER) => { const a = document.activeElement; return a && a.closest(DRAWER) ? a.dataset.themeId : null; }, DRAWER);
  for (let i = 0; i < 12 && !(await onBurger()); i++) await page.keyboard.press('Tab');
  expect(await onBurger(), 'Tab arrives at the hamburger').toBe(true);
  const ring = () => page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
  expect(await ring(), 'the focus can be seen').toEqual({ style: 'solid', width: 2 });
  await expect(page.locator('label.sidebar-toggle-wrapper')).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');                                  // opens the drawer; the focus goes to the first name
  await expect(page.locator(DRAWER)).toBeVisible();
  await expect(page.locator('label.sidebar-toggle-wrapper')).toHaveAttribute('aria-expanded', 'true');
  expect(await onName()).toBe('classic');
  expect((await ring()).style, 'the focus can be seen in the drawer').toBe('solid');

  await page.keyboard.press('Escape');                                 // closes it; the focus is back on the hamburger
  await expect(page.locator(DRAWER)).toBeHidden();
  expect(await onBurger()).toBe(true);

  await page.keyboard.press('Space');
  await expect(page.locator(DRAWER)).toBeVisible();
  await page.keyboard.press('Tab');
  const next = await onName();
  expect(next, 'Tab moves on to the next name').toBe(await page.evaluate(() => window.__theme.themes.filter((t) => t[3])[1][0]));
  await page.keyboard.press('Enter');
  await page.waitForSelector(`html[data-theme-ready="${next}"]`);
  expect(search(page)).toBe('');
});

test('classic: a name in the drawer opened in a new tab is an ordinary link to that theme', async ({ page, request, context, isMobile }) => {
  test.skip(isMobile, 'no modifier keys on a phone');
  const pages = await samplePages(request);
  const theme = NEW_THEMES[NEW_THEMES.length - 1];
  await openClassic(page, pages.home);
  await page.locator('label.sidebar-toggle-wrapper').click();
  await expect(page.locator(DRAWER)).toBeVisible();
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    page.locator(`${DRAWER} a[data-theme-id="${theme}"]`).click({ modifiers: ['ControlOrMeta'] }),
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
    await expect(page.locator('.theme-switcher'), kind).toHaveCount(0);
    await expect(page.locator('a[href*="theme="]'), kind).toHaveCount(0);
    await expect(page.locator('label.sidebar-toggle-wrapper[tabindex]'), `${kind}: the hamburger is as it always was`).toHaveCount(0);
  }
  await context.close();
});

test('where there is nothing to switch to, nothing is offered', async ({ page, request }) => {
  // a browser too old for the new themes always gets classic: a list of names would only reload the page
  const pages = await samplePages(request);
  await page.addInitScript(() => { CSS.supports = () => false; });
  await otherSites(page);
  for (const [kind] of KINDS) {
    await page.goto(pages[kind]);
    await page.waitForFunction(() => window.__theme && window.__theme.up === 1);
    expect(await page.evaluate(() => [document.documentElement.dataset.theme, window.__theme.by]), kind).toEqual(['classic', 'old']);
    await expect(page.locator('.theme-switcher'), kind).toHaveCount(0);
  }
});

// ------------------------------------------------------------------ the new themes: a control in the top right corner

/** The switcher controls of a new theme that are showing right now (a theme may keep one per bar; one shows at a time). */
const showing = async (page) => {
  const all = [];
  for (const toggle of await page.locator(TOGGLE).elementHandles()) if (await toggle.isVisible()) all.push(toggle);
  return all;
};

for (const theme of themeIds) {                                       // the reference theme too: it is what a new theme is copied from
  for (const [kind, where] of KINDS) {
    test(`"${theme}", ${where}: one control in the top right corner opens the list of themes`, async ({ page, request, isMobile }) => {
      const pages = await samplePages(request);
      const errors = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      await openTheme(page, pages[kind], theme);
      const path = decodeURI(new URL(page.url()).pathname);
      const steps = await page.evaluate(() => history.length);
      const registry = await registryOf(page);
      const name = registry.find((t) => t[0] === theme)[1];

      // one control, on the screen the reader arrives at, in its top right corner
      const toggles = await showing(page);
      expect(toggles.length, 'one control is showing').toBe(1);
      const toggle = toggles[0];
      const at = await toggle.evaluate((button) => {
        const box = button.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          tag: button.tagName, expanded: button.getAttribute('aria-expanded'), text: button.innerText.trim(),
          top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height, x, y,
          screen: [window.innerWidth, window.innerHeight],
          covered: !(hit && (hit === button || button.contains(hit))),
          listShowing: Boolean(button.closest('nav').querySelector('ul').getClientRects().length),
        };
      });
      expect(at.tag).toBe('BUTTON');
      expect(at.expanded, 'closed until it is pressed').toBe('false');
      expect(at.listShowing, 'the list is not showing yet').toBe(false);
      expect(at.text, 'it shows the name of the theme being worn, and no other words').toBe(name);
      expect(at.top, 'on the screen without scrolling').toBeGreaterThanOrEqual(0);
      expect(at.top, 'at the top of the screen').toBeLessThan(160);
      expect(at.x, 'in the right half of the screen').toBeGreaterThan(at.screen[0] * 0.55);
      expect(at.right, 'inside the screen').toBeLessThanOrEqual(at.screen[0] + 0.5);
      expect(at.height, 'tall enough for a finger').toBeGreaterThanOrEqual(44);
      expect(at.width, 'wide enough for a finger').toBeGreaterThanOrEqual(44);
      expect(at.covered, 'nothing lies on top of it').toBe(false);
      await expectNoSidewaysScroll(page);

      // pressed, it opens: every theme a visit can be given, by name, in the order of the registry
      await (isMobile ? toggle.tap() : toggle.click());
      const nav = page.locator(`${OWN}[data-open]`);
      await expect(nav).toHaveCount(1);
      await expect(nav.locator('.theme-switcher-toggle')).toHaveAttribute('aria-expanded', 'true');
      const list = nav.locator('ul');
      await expect(list).toBeVisible();
      expect(await listed(nav)).toEqual(registry.map(([id, n]) => [id, n, `?theme=${id}`, id === theme]));
      expect((await nav.getAttribute('aria-label')).trim().length, 'it has an accessible name').toBeGreaterThan(0);
      expect((await list.innerText()).split('\n').map((s) => s.trim()).filter(Boolean), 'names and nothing else').toEqual(registry.map((t) => t[1]));
      expect(await generated(nav), 'no words added by the stylesheet').toEqual([]);

      // the open list: inside the screen, on top of everything, a finger can press every name, the theme being worn is marked
      await page.waitForTimeout(350);                                    // a theme may let it unfold
      const names = await list.locator('a[data-theme-id]').evaluateAll((links) => links.map((a) => {
        const style = getComputedStyle(a), after = getComputedStyle(a, '::after'), before = getComputedStyle(a, '::before'), box = a.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const mark = (pseudo) => (pseudo.content !== 'none' && pseudo.content !== 'normal' ? `${pseudo.content} ${pseudo.width} ${pseudo.height} ${pseudo.borderTopWidth} ${pseudo.backgroundColor}` : '');
        return {
          id: a.dataset.themeId,
          current: a.getAttribute('aria-current') === 'true',
          look: [style.color, style.textDecorationLine, style.fontWeight, style.backgroundColor, mark(before), mark(after)].join(' | '),
          height: Math.round(box.height),
          inside: box.left >= -0.5 && box.right <= window.innerWidth + 0.5 && box.top >= -0.5 && box.bottom <= window.innerHeight + 0.5,
          covered: !(hit && (hit === a || a.contains(hit))),
        };
      }));
      const worn = names.filter((n) => n.current);
      expect(worn.map((n) => n.id), 'one name is marked for assistive technology').toEqual([theme]);
      const others = new Set(names.filter((n) => !n.current).map((n) => n.look));
      expect(others.size, 'the other names look alike').toBe(1);
      expect(others.has(worn[0].look), `the theme being worn looks different from the others (${worn[0].look})`).toBe(false);
      expect(names.filter((n) => n.height < 44).map((n) => n.id), 'every name is at least 44px high').toEqual([]);
      expect(names.filter((n) => !n.inside).map((n) => n.id), 'the whole list is inside the screen').toEqual([]);
      expect(names.filter((n) => n.covered).map((n) => n.id), 'nothing lies on top of a name').toEqual([]);
      await expectNoSidewaysScroll(page);

      // it closes on Esc, and when something else is pressed
      await page.keyboard.press('Escape');
      await expect(list).toBeHidden();
      expect(await toggle.getAttribute('aria-expanded')).toBe('false');
      await (isMobile ? toggle.tap() : toggle.click());
      await expect(list).toBeVisible();
      await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      await expect(list).toBeHidden();
      expect(decodeURI(new URL(page.url()).pathname), 'opening and closing it changes nothing else').toBe(path);

      // a name pressed changes theme: the same page, a clean address, no step added to Back
      const next = registry[(registry.findIndex((t) => t[0] === theme) + 1) % registry.length][0];
      await (isMobile ? toggle.tap() : toggle.click());
      const link = list.locator(`a[data-theme-id="${next}"]`);
      await (isMobile ? link.tap() : link.click());
      await page.waitForFunction((id) => window.__theme && window.__theme.up === 1 && document.documentElement.dataset.theme === id, next);
      expect(decodeURI(new URL(page.url()).pathname), 'the reader stays on the page they were reading').toBe(path);
      expect(search(page), 'nothing is left in the address').toBe('');
      expect(await page.evaluate(() => history.length), 'changing clothes adds no step to Back').toBe(steps);
      expect(errors).toEqual([]);
    });
  }

  test(`"${theme}": no row of names is left at the foot of a page, and the control is never doubled`, async ({ page, request }) => {
    const pages = await samplePages(request);
    for (const from of [pages.home, pages.letter]) {
      await openTheme(page, from, theme);
      for (const part of [0, 0.5, 1]) {
        await page.evaluate((p) => window.scrollTo(0, Math.round((document.documentElement.scrollHeight - window.innerHeight) * p)), part);
        await page.waitForTimeout(250);
        expect((await showing(page)).length, `${from} at ${part * 100}%: at most one control on screen`).toBeLessThanOrEqual(1);
        // names are only ever seen inside an open control
        const loose = await page.locator(`${OWN} a[data-theme-id]`).evaluateAll((links) => links.filter((a) => a.getClientRects().length && !a.closest('nav[data-open]')).length);
        expect(loose, `${from} at ${part * 100}%: no names outside an open control`).toBe(0);
      }
    }
  });

  test(`"${theme}": the control and its list work from the keyboard`, async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'a phone has no Tab key');
    const pages = await samplePages(request);
    for (const from of [pages.lost, pages.letter]) {                       // the page with the fewest stops, and a letter
      await openTheme(page, from, theme);
      const onToggle = () => page.evaluate(() => Boolean(document.activeElement && document.activeElement.matches('.theme-switcher-toggle')));
      for (let i = 0; i < 60 && !(await onToggle()); i++) await page.keyboard.press('Tab');
      expect(await onToggle(), `${from}: Tab arrives at the control`).toBe(true);
      const ring = () => page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1; });
      expect(await ring(), `${from}: the focus can be seen`).toBe(true);
      await page.keyboard.press('Enter');
      const list = page.locator(`${OWN}[data-open] ul`);
      await expect(list).toBeVisible();
      await page.keyboard.press('Tab');
      const first = await page.evaluate((OWN) => { const a = document.activeElement; return a && a.closest(`${OWN}[data-open] ul`) ? a.dataset.themeId : null; }, OWN);
      expect(first, `${from}: Tab moves into the list`).toBe((await registryOf(page))[0][0]);
      expect(await ring(), `${from}: the focus can be seen in the list`).toBe(true);
      await page.keyboard.press('Escape');
      await expect(list).toBeHidden();
      expect(await onToggle(), `${from}: Esc gives the focus back to the control`).toBe(true);
      expect(decodeURI(new URL(page.url()).pathname), 'and the page has not moved').toBe(from);
    }
  });
}

// ------------------------------------------------------------------ from one theme to another

for (const [index, theme] of NEW_THEMES.entries()) {
  test(`from classic to "${theme}" and back`, async ({ page, request, isMobile }) => {
    const pages = await samplePages(request);
    const start = [pages.letter, pages.home, pages.lost][index % 3];        // each kind of page takes its turn as the way out
    await openClassic(page, start);
    const path = new URL(page.url()).pathname;
    const steps = await page.evaluate(() => history.length);

    await pickTheme(page, theme, { isMobile });
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

    // ... and back, from a letter and from the home page, with the theme's own control
    for (const from of [pages.letter, pages.home]) {
      if (from !== pages.letter) await openTheme(page, from, theme);
      await pickTheme(page, 'classic', { isMobile });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'classic' && window.__theme.up === 1);
      expect(search(page)).toBe('');
      expect(decodeURI(new URL(page.url()).pathname), 'the reader stays on the page they were reading, a letter included').toBe(from);
      await expect(page.locator(`${DRAWER} a[aria-current="true"]`)).toHaveAttribute('data-theme-id', 'classic');
      await expect(page.locator('#theme-root')).toBeEmpty();
    }
  });
}

test('after switching, Back and Forward stay in the new theme and the address stays clean', async ({ page, request, isMobile }) => {
  const pages = await samplePages(request);
  const theme = NEW_THEMES[0];
  await openClassic(page, pages.home);
  expect(search(page)).toBe('');
  await page.locator(`.blockGroup-list a[href="${encodeURI(pages.letter)}"]`).first().click();        // read a letter, still in classic
  await page.waitForFunction(() => window.__theme && window.__theme.up === 1 && window.__theme.page === 'letter');
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, window.__theme.by])).toEqual(['classic', 'visit']);

  await pickTheme(page, theme, { isMobile });                                                          // change there
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(search(page)).toBe('');

  await page.goBack();                                                                                 // the home page was last seen in classic
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(search(page)).toBe('');
  await expect(page.locator('nav.sidebar'), 'nothing of the classic page is left').toHaveCount(0);

  await page.goForward();
  await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
  expect(decodeURI(new URL(page.url()).pathname)).toBe(pages.letter);
  expect(search(page)).toBe('');
});
