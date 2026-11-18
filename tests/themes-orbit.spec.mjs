// 「绕日」 orbit: what this theme promises beyond the shared contract (tests/themes.spec.mjs).
// Each test is one of the defects the mockup was sent back for; see assets/themes/orbit/README.md.

import { test, expect, firefox } from '@playwright/test';
import { getIsland, open, watch, expectNoSidewaysScroll } from './helpers.mjs';

const THEME = 'orbit';
const urlOf = async (request, find) => (await getIsland(request)).letters.find(find).url;
const wide = (page) => page.viewportSize().width >= 1200;

test.describe('theme "orbit", its own promises', () => {
  test('the ephemeris lists every letter and every year, truncates nothing, and says 没有信', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    await open(page, '/', THEME);
    const rows = page.locator('#theme-root .eph a.row');
    await expect(rows).toHaveCount(letters.length);
    const years = new Set(letters.map((l) => Number(l.date.slice(0, 4))));
    const empty = [];
    for (let y = Math.min(...years); y <= Math.max(...years); y++) if (!years.has(y)) empty.push(y);
    await expect(page.locator('#theme-root .eph .row-none')).toHaveCount(empty.length);
    for (const row of await page.locator('#theme-root .eph .row-none').all()) await expect(row).toContainText('没有信');
    // every title and every song is there in full: no ellipsis, nothing cut
    const cut = await page.evaluate(() => [...document.querySelectorAll('#theme-root .eph .c-title, #theme-root .eph .c-song')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis').map((el) => el.textContent));
    expect(cut, 'titles and songs shown in full').toEqual([]);
    for (const l of letters) if (l.song) await expect(rows.filter({ hasText: l.title }).first()).toContainText(l.song.title);
    await expectNoSidewaysScroll(page);
  });

  test('every glyph is explained: him, her, both, guest', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    await open(page, '/', THEME);
    const legend = page.locator('#theme-root .legend');
    const count = (name) => letters.filter((l) => (l.authors || [l.author]).join('+') === name).length;
    await expect(legend).toContainText(`他 Pikajay${count('Pikajay')} 封`);
    await expect(legend).toContainText(`她 Pikachi${count('Pikachi')} 封`);
    await expect(legend).toContainText(`合写${count('Pikajay+Pikachi')} 封`);
    await expect(legend).toContainText('访客');
    // the letter two people wrote says so, and names both
    await open(page, await urlOf(request, (l) => (l.authors || []).length > 1), THEME);
    await expect(page.locator('#theme-root .kicker')).toContainText('Pikajay 起头 · Pikachi 写');
  });

  test('the chart orients by drawing: arrows for the direction, years on the rings, no sentence telling how to read it', async ({ page, request }) => {
    const { letters, site } = await getIsland(request);
    await open(page, '/', THEME);
    await expect(page.locator('#theme-root .chart svg .ah'), 'two arrowheads on the outer ring').toHaveCount(2);
    const years = await page.locator('#theme-root .chart svg .t-year').allTextContents();
    expect(years[0], 'the outermost ring is the year they met, written in full').toBe(site.met.slice(0, 4));
    expect(years.every((y) => /^\d{4}$/.test(y)) && years.join() === [...years].sort().join(), 'years in full, growing inwards').toBe(true);
    await expect(page.locator('#theme-root .readout .ro-today'), 'at rest the readout is the reading of the day').toBeVisible();
    const text = await page.locator('#theme-root').innerText();
    for (const gone of ['逆时针', '年环由外向内', '一行一封', '把指针移到', '点图上哪里', '日心轨道']) expect(text, `「${gone}」 is drawn, not written`).not.toContain(gone);
    // the two ends of the archive are the chart's own marks, not sentences
    await open(page, letters[0].url, THEME);
    await expect(page.locator('#theme-root .pn .none')).toContainText('认识');
    await open(page, letters[letters.length - 1].url, THEME);
    await expect(page.locator('#theme-root .pn .none')).toContainText('今日');
  });

  test('a selected letter turns amber and draws the arc since the letter before it', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const silent = letters.find((l) => l.date === '2021-07-04');           // 838 days after the letter before it: more than two laps
    await open(page, '/', THEME);
    const arc = () => page.evaluate(() => { const p = document.querySelector('#theme-root .chart .sel-trace'); return p ? p.getTotalLength() : 0; });
    const today = await arc();
    await page.locator(`#theme-root .eph a.row[data-no="${silent.no}"]`).focus();   // keyboard focus selects, like hover and tap do
    await expect(page.locator('#theme-root .eph a.row.is-sel')).toHaveAttribute('data-no', String(silent.no));
    await expect(page.locator('#theme-root .readout .ro-title')).toHaveText(silent.title);
    const geometry = await page.evaluate(() => {
      const svg = document.querySelector('#theme-root .chart svg');
      const ring = svg.querySelector('circle.la');                        // the outer edge of the calendar ruler
      return { length: svg.querySelector('.sel-trace').getTotalLength(), outer: 2 * Math.PI * ring.r.baseVal.value };
    });
    expect(geometry.length, 'the arc is far longer than the one that led to today').toBeGreaterThan(today + 200);
    expect(geometry.length, 'two laps and more, on rings well inside the ruler').toBeGreaterThan(geometry.outer * 0.9);
    // and 今日 brings the day's readout back
    await page.locator('#theme-root .ro-reset').click();
    await expect(page.locator('#theme-root .ro-today')).toBeVisible();
    await expect(page.locator('#theme-root .eph a.row.is-sel')).toHaveCount(0);
  });

  test('a letter shows its real day, its calendar season and its lap', async ({ page, request }) => {
    const { letters } = await getIsland(request);
    const oneYear = letters.find((l) => l.title === 'One Year');
    await open(page, oneYear.url, THEME);
    const data = page.locator('#theme-root .l-data');
    await expect(data).toContainText('2017·02·21');                        // not the 01·21 of its address
    await expect(data).toContainText('第 2 圈');
    await expect(data).toContainText('T+451');                            // 2015·11·28 → 2017·02·21
    const june = letters.find((l) => l.date === '2016-06-08');             // 「夏花烂漫」: summer, although the solstice is 13 days off
    await open(page, june.url, THEME);
    await expect(page.locator('#theme-root .l-data')).toContainText('季节夏');
    await expect(page.locator('#theme-root .l-data')).toContainText('夏至前 13 d');
    await open(page, letters[0].url, THEME);                               // written before 2016·2·21
    await expect(page.locator('#theme-root .l-data')).toContainText('入轨前');
  });

  test('pictures inside a letter are plates: framed, numbered, cyanotype until the reader asks for colour', async ({ page, request, baseURL }) => {
    const seen = watch(page, baseURL);
    const june = await urlOf(request, (l) => l.date === '2016-06-08');     // Hang Zhou: five pictures
    await open(page, june, THEME);
    const figures = page.locator('#theme-root .letter-body figure.o-fig');
    await expect(figures).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const figure = figures.nth(i);
      await figure.scrollIntoViewIfNeeded();
      await expect(figure.locator('figcaption')).toContainText(`·${i + 1}`);
      await expect.poll(() => figure.locator('img').evaluate((img) => img.naturalWidth), `picture ${i + 1} loads`).toBeGreaterThan(0);
      expect(await figure.locator('img').evaluate((img) => getComputedStyle(img).filter)).toContain('grayscale');
    }
    await expectNoSidewaysScroll(page);
    // one tap on 原色: every picture on the page is in its own colours, and the choice is kept
    await figures.first().locator('.cap-toggle').click();
    await expect(page.locator('#theme-root')).toHaveClass(/in-colour/);
    expect(await figures.nth(2).locator('img').evaluate((img) => getComputedStyle(img).filter)).toBe('none');
    await page.reload();
    await page.waitForSelector(`html[data-theme-ready="${THEME}"]`);
    await expect(page.locator('#theme-root')).toHaveClass(/in-colour/);
    await page.locator('#theme-root .plate .cap-toggle').click();
    await expect(page.locator('#theme-root')).not.toHaveClass(/in-colour/);
    expect(seen.errors).toEqual([]);
  });

  test('the card draws its two faces instead of saying 点一下; the gift box says nothing', async ({ page, request }) => {
    const after = (selector) => page.evaluate((s) => getComputedStyle(document.querySelector(s), '::after').content, selector);
    await open(page, await urlOf(request, (l) => l.date === '2026-08-12'), THEME);
    const card = page.locator('#theme-root .letter-body .flip-card');
    const cue = card.locator('svg.cue');
    await expect(cue, 'one pictogram under the card: the written side, the photo side').toHaveCount(1);
    await expect(cue, 'a screen reader still hears what the picture means').toHaveAttribute('aria-label', '点一下，换一面');
    expect(await after('#theme-root .flip-card'), 'no generated sentence under the card').toMatch(/^(none|normal)$/);
    const lit = () => cue.evaluate((svg) => ['a', 'b'].map((face) => getComputedStyle(svg.querySelector('.' + face)).stroke));
    const [front, back] = await lit();
    expect(front, 'the face that is up is the brighter one').not.toBe(back);
    await card.click({ position: { x: 20, y: 20 } });
    await expect(card).toHaveClass(/is-flipped/);
    expect(await lit(), 'turned over, the other face lights up').toEqual([back, front]);
    await open(page, await urlOf(request, (l) => l.standalone), THEME);
    await expect(page.locator('#theme-root #gift-container')).toBeVisible();
    expect(await after('#theme-root #gift-container'), 'no generated sentence under the box').toMatch(/^(none|normal)$/);
  });

  test('the letter itself is on the first screen of a desktop', async ({ page, request }) => {
    test.skip(!wide(page), 'the two-column letter page is the desktop layout');
    for (const find of [(l) => l.date === '2024-11-19', (l) => l.quiet, (l) => l.title.length > 12]) {
      await open(page, await urlOf(request, find), THEME);
      const top = await page.evaluate(() => document.querySelector('#theme-root .letter-body .content-body > *').getBoundingClientRect().top);
      expect(top, 'the first line of the letter starts well above the fold').toBeLessThan(600);
    }
  });

  test('the page for an address without a letter is one centred column, with a way back', async ({ page }) => {
    await open(page, '/404.html', THEME);
    const lost = page.locator('#theme-root .lost-body');
    await expect(lost).toContainText('没有信');
    await expect(lost.locator('.loc svg .sel-halo'), 'an empty ring off the orbits stands for the missing letter').toHaveCount(1);
    await expect(lost.locator('a[href="/"]')).toBeVisible();
    const off = await page.evaluate(() => [...document.querySelectorAll('#theme-root .lost-body > *')].map((el) => {
      const box = el.getBoundingClientRect();
      return Math.abs((box.left + box.right) / 2 - window.innerWidth / 2);
    }));
    expect(Math.max(...off), 'everything sits on the centre line').toBeLessThan(8);
    await expectNoSidewaysScroll(page);
  });

  test('the readout card shows every title and song name in full, inside the plate', async ({ page, request }) => {
    test.skip(!wide(page), 'the fixed-height readout card is the desktop layout');
    const { letters } = await getIsland(request);
    const byLength = (text) => [...letters].filter((l) => text(l)).sort((a, b) => text(b).length - text(a).length)[0];
    const picks = [byLength((l) => l.title), byLength((l) => l.song && l.song.title), letters.find((l) => (l.authors || []).length > 1)];
    for (const size of [{ width: 1280, height: 720 }, { width: 1400, height: 900 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      await open(page, '/', THEME);
      for (const letter of picks) {
        await page.locator(`#theme-root .eph a.row[data-no="${letter.no}"]`).focus();
        await expect(page.locator('#theme-root .readout .ro-title')).toHaveText(letter.title);
        const found = await page.evaluate(() => {
          const readout = document.querySelector('#theme-root .readout'), box = readout.getBoundingClientRect();
          const cut = [...readout.querySelectorAll('.ro-title, .ro-song span')]
            .filter((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis').map((el) => el.textContent);
          const spilt = [...readout.querySelectorAll('.ro-main > *, .ro-actions > *')].filter((el) => {
            const b = el.getBoundingClientRect();
            return b.height > 0 && (b.bottom > box.bottom - 2 || b.top < box.top);
          }).map((el) => el.className);
          return { cut, spilt };
        });
        expect(found, `${size.width}px, № ${letter.no}`).toEqual({ cut: [], spilt: [] });
      }
    }
  });

  test('back on the chart the letter just read stays selected, whatever the pointer happens to rest on', async ({ page, request }) => {
    test.skip(!wide(page), 'needs a mouse over the table next to the chart');
    const { letters } = await getIsland(request);
    const read = letters.find((l) => l.date === '2024-11-19'), other = letters.find((l) => l.date === '2017-08-04');
    await open(page, '/', THEME);
    const at = await page.locator(`#theme-root .eph a.row[data-no="${other.no}"]`).boundingBox();
    const x = at.x + at.width / 2, y = at.y + at.height / 2;
    await page.locator(`#theme-root .eph a.row[data-no="${read.no}"]`).click();
    await expect(page.locator('#theme-root .letter-body')).toBeVisible();
    await page.mouse.move(x, y);                                           // parked where another row is about to appear
    await page.keyboard.press('Escape');
    await expect(page.locator('#theme-root .eph')).toBeVisible();
    await page.waitForTimeout(400);                                        // browsers send their own pointerenter once the page has settled
    await expect(page.locator('#theme-root .eph a.row.is-sel')).toHaveAttribute('data-no', String(read.no));
    await expect(page.locator('#theme-root .readout .ro-title')).toHaveText(read.title);
    await page.mouse.move(x + 4, y + 2);                                   // a pointer that really moves is followed again
    await expect(page.locator('#theme-root .eph a.row.is-sel')).toHaveAttribute('data-no', String(other.no));
  });

  test('keyboard: Enter opens the focused row, Esc returns, and no focus ring frames the whole view', async ({ page }) => {
    await open(page, '/', THEME);
    const ring = () => page.evaluate(() => getComputedStyle(document.querySelector('#theme-root main.view')).outlineStyle);
    const row = page.locator('#theme-root .eph a.row').nth(3);
    await row.focus();
    expect(await row.evaluate((el) => getComputedStyle(el).outlineStyle), 'the row itself shows where the focus is').toBe('solid');
    await page.keyboard.press('Enter');
    await expect(page.locator('#theme-root .letter-body')).toBeVisible();
    await expect(page.locator('#theme-root main.view')).toBeFocused();
    expect(await ring()).toBe('none');
    await page.keyboard.press('Escape');
    await expect(page.locator('#theme-root .eph')).toBeVisible();
    expect(await ring()).toBe('none');
  });

  test('the control that changes theme is part of the plate: the head of the ephemeris on a desktop, beside the name on a phone, the list hanging from the rule', async ({ page }) => {
    const TOGGLE = '#theme-root .theme-switcher-toggle';
    const measure = () => page.evaluate((TOGGLE) => {
      const box = (el) => el.getBoundingClientRect().toJSON();
      const toggle = [...document.querySelectorAll(TOGGLE)].find((b) => b.getClientRects().length);
      const nav = toggle.closest('nav'), list = nav.querySelector('ul');
      const head = toggle.closest('.eph-head, .topbar, .masthead');
      return {
        home: head.className, toggle: box(toggle), name: box(toggle.querySelector('.theme-switcher-name')), list: box(list),
        names: [...list.querySelectorAll('a')].map((a) => { const r = document.createRange(); r.selectNodeContents(a); return r.getBoundingClientRect().left; }),
        mark: getComputedStyle(list.querySelector('a[aria-current]'), '::before').borderTopStyle,
        sort: head.querySelector('.sort') && box(head.querySelector('.sort')),
        title: head.querySelector('h1') && box(head.querySelector('h1')),
        rule: head.matches('.eph-head') ? document.querySelector('#theme-root .row-h').getBoundingClientRect().top : head.matches('.topbar') ? head.getBoundingClientRect().bottom - 1 : null,
      };
    }, TOGGLE);
    const hangs = (at) => {
      expect(Math.abs(at.list.right - at.toggle.right), 'the list ends where the control ends').toBeLessThanOrEqual(1);
      for (const left of at.names) expect(Math.abs(left - at.name.left), 'every name starts under the name on the control').toBeLessThanOrEqual(1);
      expect(at.mark, 'the theme being worn has a dot in front of it').toBe('solid');
      if (at.rule != null) expect(Math.abs(at.list.top - at.rule), 'the list hangs from the rule under the head').toBeLessThanOrEqual(1);
    };

    await open(page, '/', THEME);
    await expect(page.locator(`${TOGGLE}:visible`)).toHaveCount(1);
    await page.locator(`${TOGGLE}:visible`).click();
    const home = await measure();
    if (wide(page)) {
      expect(home.home).toBe('eph-head');
      expect(home.toggle.left, 'after the sort control, on its line').toBeGreaterThanOrEqual(home.sort.right);
      expect(Math.abs((home.toggle.top + home.toggle.bottom) - (home.sort.top + home.sort.bottom)) / 2).toBeLessThanOrEqual(2);
    } else {
      expect(home.home).toBe('masthead');
      expect(home.toggle.left, 'beside the name, not on it').toBeGreaterThan(home.title.right);
      expect(home.title.height, 'the name stays on one line').toBeLessThan(40);
    }
    hangs(home);
    await page.keyboard.press('Escape');

    // the header of a letter and of the 404 view: the name, the way back and the control share one line down to the narrowest phone
    const height = page.viewportSize().height;
    for (const width of [402, 375, 360, 320]) {
      await page.setViewportSize({ width, height });
      await open(page, '/404.html', THEME);
      const bar = await page.evaluate(() => ['.brand', '.back', '.theme-switcher-toggle'].map((s) => {
        const el = document.querySelector(`#theme-root .topbar ${s}`), r = el.getBoundingClientRect(), text = document.createRange();
        text.selectNodeContents(el);
        return { left: r.left, right: r.right, middle: (r.top + r.bottom) / 2, lines: new Set([...text.getClientRects()].map((line) => Math.round(line.top))).size, cut: el.scrollWidth > el.clientWidth + 1 };
      }));
      const [brand, back, toggle] = bar;
      expect(brand.right, `${width}px: the name ends before the way back`).toBeLessThanOrEqual(back.left);
      expect(back.right, `${width}px: the way back ends before the control`).toBeLessThanOrEqual(toggle.left);
      expect(toggle.right, `${width}px: the control is inside the screen`).toBeLessThanOrEqual(width);
      expect(brand.lines, `${width}px: the name is on one line`).toBe(1);
      expect(bar.filter((b) => b.cut || Math.abs(b.middle - toggle.middle) > 1).length, `${width}px: one line, nothing cut`).toBe(0);
      await expect(page.locator('#theme-root .topbar .back')).toHaveText('回到绕日图');
      await page.locator(`${TOGGLE}:visible`).click();
      hangs(await measure());
      await expectNoSidewaysScroll(page);
    }
  });

  test('with the text half as large again, the head of a page still holds: the name folds at its space or takes a line of its own, the way back and the control stay together at the right end', async ({ browserName, baseURL }) => {
    test.skip(browserName !== 'firefox', 'only Firefox can be told to enlarge the text alone');
    const big = await firefox.launch({ firefoxUserPrefs: { 'ui.textScaleFactor': 150, 'browser.display.os-zoom-behavior': 2 } });
    const page = await big.newPage({ baseURL, viewport: { width: 402, height: 800 }, locale: 'zh-CN', timezoneId: 'America/Los_Angeles' });
    // each word of a name: on how many lines it lies (a word broken in two lies on two), and where it ends
    const words = (selector) => page.evaluate((selector) => {
      const el = [...document.querySelectorAll(`#theme-root ${selector}`)].find((e) => e.getClientRects().length);
      const text = [...el.childNodes].find((n) => n.nodeType === 3);
      let at = 0;
      return text.data.split(' ').map((word) => {
        const range = document.createRange();
        range.setStart(text, at); range.setEnd(text, at + word.length); at += word.length + 1;
        const rects = [...range.getClientRects()];
        return { word, lines: new Set(rects.map((r) => Math.round(r.top))).size, right: Math.max(...rects.map((r) => r.right)) };
      });
    }, selector);
    try {
      for (const width of [402, 375, 360, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await open(page, '/404.html', THEME);
        await page.locator('#theme-root .topbar .theme-switcher-toggle').click();
        const at = await page.evaluate(() => {
          const box = (s) => document.querySelector(`#theme-root .topbar ${s}`).getBoundingClientRect().toJSON();
          return { bar: box(''), brand: box('.brand'), back: box('.back'), toggle: box('.theme-switcher-toggle'), list: box('.theme-switcher ul'), screen: [window.innerWidth, window.innerHeight] };
        });
        const name = await words('.topbar .brand');
        const mid = (b) => (b.top + b.bottom) / 2;
        expect(name.filter((w) => w.lines > 1).map((w) => w.word), `${width}px: no word of the name is broken`).toEqual([]);
        expect(at.brand.top, `${width}px: the name is inside the head`).toBeGreaterThanOrEqual(Math.max(0, at.bar.top) - 0.5);
        expect(at.brand.bottom, `${width}px: the name is inside the head`).toBeLessThanOrEqual(at.bar.bottom + 0.5);
        expect(at.brand.right <= at.back.left || at.brand.bottom <= at.back.top, `${width}px: the name keeps clear of the way back`).toBe(true);
        expect(Math.abs(mid(at.back) - mid(at.toggle)), `${width}px: the way back and the control on one line`).toBeLessThanOrEqual(1);
        expect(at.back.right, `${width}px: the way back before the control`).toBeLessThanOrEqual(at.toggle.left);
        expect(at.toggle.right, `${width}px: the control at the right end, inside the screen`).toBeLessThanOrEqual(at.screen[0]);
        expect(Math.abs(at.list.top - (at.bar.bottom - 1)), `${width}px: the list hangs from the rule under the head`).toBeLessThanOrEqual(1);
        expect(Math.abs(at.list.right - at.toggle.right), `${width}px: the list ends where the control ends`).toBeLessThanOrEqual(1);
        expect(at.list.bottom, `${width}px: the list is inside the screen`).toBeLessThanOrEqual(at.screen[1]);
        await expect(page.locator('#theme-root .topbar .back')).toHaveText('回到绕日图');
        await expectNoSidewaysScroll(page);

        // the home page: the name beside the control folds at its space instead of running under it
        await open(page, '/', THEME);
        const toggle = await page.locator('#theme-root .theme-switcher-toggle:visible').evaluate((b) => b.getBoundingClientRect().left);
        const title = await words('.masthead h1');
        expect(title.filter((w) => w.lines > 1).map((w) => w.word), `${width}px: no word of the name is broken`).toEqual([]);
        expect(Math.max(...title.map((w) => w.right)), `${width}px: the name ends before the control`).toBeLessThanOrEqual(toggle);
      }
    } finally {
      await big.close();
    }
  });

  test('a list of themes left open does not come back open: the home page is kept while a letter is read, and has a control for each width', async ({ page, request, isMobile }) => {
    const letter = await urlOf(request, (l) => !l.standalone);
    const press = (loc) => (isMobile ? loc.tap() : loc.click());
    const toggle = page.locator('#theme-root .theme-switcher-toggle:visible');
    const opened = page.locator('#theme-root nav.theme-switcher[data-open]');
    const view = (type) => expect(page.locator('#theme-root')).toHaveAttribute('data-view', type);

    // left open the way the browser's own Back and Forward leave a page: nothing on the page is pressed or focused
    await open(page, '/', THEME);
    await press(toggle);
    await expect(opened).toHaveCount(1);
    await page.evaluate((url) => window.__theme.ctx.router.go(url), letter);
    await view('letter');
    await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));      // a press somewhere on the letter
    await page.goBack();
    await view('home');
    await expect(opened, 'back on the plate, the list is closed').toHaveCount(0);
    await expect(page.locator('#theme-root .theme-switcher ul:visible')).toHaveCount(0);

    await press(toggle);
    await page.goForward();
    await view('letter');
    await page.goBack();
    await view('home');
    await expect(opened, 'and again after Forward and Back').toHaveCount(0);

    // the width changes across 1200px: the control that was open is hidden, the one that shows is closed, and stays closed coming back
    if (!isMobile) {
      const { width, height } = page.viewportSize();
      await press(toggle);
      await page.setViewportSize({ width: wide(page) ? 900 : 1300, height });
      await expect(opened).toHaveCount(0);
      await page.setViewportSize({ width, height });
      await expect(opened).toHaveCount(0);
      await expect(toggle).toHaveCount(1);
    }
  });

  test('nothing moves under prefers-reduced-motion', async ({ browser, baseURL, request }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 402, height: 874 } });
    const page = await context.newPage();
    for (const path of ['/', await urlOf(request, (l) => l.quiet)]) {
      await open(page, path, THEME);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length), `${path}: running animations`).toBe(0);
    }
    await context.close();
  });
});
