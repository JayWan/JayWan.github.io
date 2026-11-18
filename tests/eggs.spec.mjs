// The site's voice and the hidden things (ARCHITECTURE §7, assets/js/core/eggs.js).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { expectNoSidewaysScroll, getIsland, root, themeIds, themeOf } from './helpers.mjs';

const DAY = 864e5;
const noon = (day, plus = 0) => new Date(Date.parse(`${day}T12:00:00-08:00`) + plus * DAY);

test('the hunger line grows with the days since the newest letter', async ({ page, request }) => {
  const { letters } = await getIsland(request);
  const latest = letters[letters.length - 1].date;
  const stamps = letters.map((l) => Date.parse(l.date));
  const record = Math.max(...stamps.slice(1).map((t, i) => Math.round((t - stamps[i]) / DAY)));
  expect(record, 'the longest gap in the archive').toBeGreaterThanOrEqual(838);

  for (const [days, level, words] of [[0, 0, '今天刚吃过'], [3, 0, '3 天前刚吃过'], [30, 1, '还不饿'], [100, 2, '肚子在叫'], [400, 3, '好气呀'], [record, 3, '好气呀'], [record + 1, 4, `比上次那 ${record} 天还久`]]) {
    await page.clock.setFixedTime(noon(latest, days));
    await page.goto('/?theme=probe');
    await page.waitForSelector('html[data-theme-ready="probe"]');
    const hunger = await page.evaluate(() => window.__theme.ctx.ui.hunger());
    expect(hunger.days, `${days} days`).toBe(days);
    expect(hunger.level, `${days} days`).toBe(level);
    expect(hunger.text, `${days} days`).toContain(words);
    await expect(page.locator('#theme-root')).toContainText(hunger.text);       // the probe theme shows it in its footer
  }
});

test('day counts follow the couple\'s way of counting', async ({ page }) => {
  await page.clock.setFixedTime(noon('2024-11-19'));
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  const got = await page.evaluate(() => {
    const { site, letters } = window.__theme.ctx;
    const first = letters[0];
    const wanTian = letters.find((l) => l.date === '2024-11-19');
    return { today: site.today, first: { days: first.days, role: first.role, year: first.year, doy: first.doy }, wanTian: wanTian.days, her: letters.find((l) => l.author === 'Pikachi').role };
  });
  expect(got.today).toEqual({ date: '2024-11-19', days: { met: 3279, together: 3194, married: 1195 } });   // 认识第 3279 天
  expect(got.first).toEqual({ days: { met: 27, together: null, married: null }, role: 'him', year: 2015, doy: 359 });
  expect(got.wanTian.met).toBe(3279);
  expect(got.her).toBe('her');
});

test('what the core derives from the island: four roles, stated counts, the real day, numbering', async ({ page }) => {
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  const got = await page.evaluate(() => {
    const { letters } = window.__theme.ctx;
    const by = (title) => letters.find((l) => l.title === title);
    const brief = (l) => ({ role: l.role, authors: l.authors, author: l.author });
    const oneYear = by('One Year');
    return {
      roles: [...new Set(letters.map((l) => l.role))].sort(),
      both: brief(by('教小天使发布文章')),
      guest: brief(letters.latest),
      stated: [by('221 FOREVER').days, by('和小天使的三百天').days],
      computed: by('棍棍节').days,
      oneYear: { date: oneYear.date, time: oneYear.time, year: oneYear.year, doy: oneYear.doy, days: oneYear.days, url: oneYear.url },
      numbered: letters.every((l, i) => l.no === i + 1 && l.index === i && (!i || letters[i - 1].date <= l.date)),
      own: [letters[0].cover.own, letters.latest.cover.own],
    };
  });
  expect(got.roles).toEqual(['both', 'guest', 'her', 'him']);
  expect(got.both).toEqual({ role: 'both', authors: ['Pikajay', 'Pikachi'], author: 'Pikajay' });
  expect(got.guest).toEqual({ role: 'guest', authors: ['Claude'], author: 'Claude' });
  // the letter's own number where it states one (they count inclusively), the calendar's elsewhere
  expect(got.stated).toEqual([{ met: 295, together: 209, married: null }, { met: 384, together: 300, married: null }]);
  expect(got.computed).toEqual({ met: 349, together: 264, married: null });
  // 「One Year」 is one year after 2016-02-21, whatever its URL says
  expect(got.oneYear).toEqual({ date: '2017-02-21', time: null, year: 2017, doy: 52, days: { met: 451, together: 366, married: null }, url: '/story/2017/01/21/One-Year/' });
  expect(got.numbered).toBe(true);
  expect(got.own).toEqual([false, true]);
});

test('the season of a letter goes by the month, and a year without letters is still a year', async ({ page }) => {
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  const got = await page.evaluate(() => {
    const { ui: { fmt }, letters } = window.__theme.ctx;
    return {
      months: Array.from({ length: 12 }, (_, m) => fmt.season(`2026-${String(m + 1).padStart(2, '0')}-15`)).join(''),
      june: fmt.season('2016-06-08'),                                      // 「Hang Zhou」: 夏花烂漫, two weeks before the solstice
      edges: [fmt.season('2026-02-28'), fmt.season('2026-03-01'), fmt.season('2026-11-30'), fmt.season('2026-12-01'), fmt.season(new Date(2026, 7, 12)), fmt.season(''), fmt.season(null)],
      years: letters.years.map((y) => [y.year, y.letters.length]),
      sum: letters.years.reduce((n, y) => n + y.letters.length, 0),
      oneYear: letters.years.find((y) => y.year === 2017).letters.some((l) => l.title === 'One Year'),
    };
  });
  expect(got.months).toBe('冬冬春春春夏夏夏秋秋秋冬');
  expect(got.june).toBe('夏');
  expect(got.edges).toEqual(['冬', '春', '秋', '冬', '夏', '', '']);
  expect(got.years.map((y) => y[0])).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  expect(got.years.filter((y) => y[1] === 0).map((y) => y[0]), 'the years in which nobody wrote').toEqual([2020, 2022]);
  expect(got.sum).toBeGreaterThanOrEqual(32);
  expect(got.oneYear).toBe(true);

  // the reference theme says it in plain words; 「无信」 would also read as "faithless"
  await expect(page.locator('#theme-root .p-year', { hasText: '2020' })).toHaveText('2020 年 · 这一年没有写信');
  await expect(page.locator('#theme-root')).not.toContainText('无信');
});

for (const theme of ['classic', 'probe']) {
  test(`${theme}: a greeting waits in the console`, async ({ page }) => {
    await page.route(/^https:\/\//, (route) => route.abort());
    const logs = [];
    page.on('console', (msg) => { if (msg.type() === 'log') logs.push(msg.text()); });
    await page.goto(`/?theme=${theme}`);
    await expect.poll(() => logs.join('\n')).toMatch(/221 FOREVER[\s\S]*封信[\s\S]*敲 pi/);
    expect(logs.join('\n'), 'what 221 does is not given away').not.toMatch(/敲\s*221/);
  });
}

// ------------------------------------------------------------------ 221: the hidden sheet

/** Open `path` under `theme` and wait until the core is listening to the keyboard. */
async function arrive(page, theme, path = '/') {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto(`${path}?theme=${theme}`);
  if (theme === 'classic') await page.waitForFunction(() => window.__theme.up === 1);
  else await page.waitForSelector(`html[data-theme-ready="${theme}"]`);
}
const HOST = '#egg-221-sheet';
const sheet = (page) => page.locator(`${HOST} dialog`);
const paper = (page) => page.locator(`${HOST} .paper`);
/** The sheet rises a few pixels as it appears: measure it once it has arrived. */
const settled = (page) => paper(page).evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)).then(() => true));
/** What the owner has written so far: the template every page carries. */
const fill = (page, html) => page.evaluate((text) => { document.getElementById('egg-221').innerHTML = text; }, html);

for (const theme of ['classic', ...themeIds]) {
  test(`${theme}: typing 221 opens a sheet of paper; Esc, a click beside it and its mark close it; the theme stays`, async ({ page }) => {
    await arrive(page, theme);
    const before = await page.evaluate(() => {
      window.__sameDocument = true;
      // somewhere for the focus to be, and to come back to
      const button = Object.assign(document.createElement('button'), { id: 'scratch', textContent: '·' });
      (document.documentElement.dataset.theme === 'classic' ? document.body : document.getElementById('theme-root')).append(button);
      button.focus({ preventScroll: true });
      return { url: location.href, overflow: [document.documentElement.style.overflow, document.body.style.overflow], y: window.scrollY };
    });
    await expect(page.locator(HOST), 'nothing of it exists until it is asked for').toHaveCount(0);

    for (const way of ['Esc', 'a click beside it', 'its mark']) {
      await page.keyboard.type('221');
      await expect(sheet(page), way).toBeVisible();
      await expect(sheet(page)).toHaveJSProperty('open', true);
      expect(await sheet(page).evaluate((dialog) => dialog.matches(':modal')), 'opened with showModal()').toBe(true);

      // a sheet in the middle of the screen, clear of its edges
      await settled(page);
      const view = page.viewportSize();
      const box = await paper(page).boundingBox();
      expect(box.x, 'left margin').toBeGreaterThanOrEqual(16);
      expect(view.width - box.x - box.width, 'right margin').toBeGreaterThanOrEqual(16);
      expect(box.y, 'top margin').toBeGreaterThanOrEqual(24);
      expect(view.height - box.y - box.height, 'bottom margin').toBeGreaterThanOrEqual(24);
      expect(Math.abs(box.x + box.width / 2 - view.width / 2), 'centred').toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height / 2 - view.height / 2), 'centred').toBeLessThanOrEqual(1);
      expect(box.width, 'no wider than a page').toBeLessThanOrEqual(36 * 17 + 1);
      expect(box.height, 'a sheet, not a strip').toBeGreaterThan(box.width);

      // the page behind is locked and out of reach
      const during = await page.evaluate(() => ({
        locked: [document.documentElement.style.overflow, document.body.style.overflow].includes('hidden'),
        inside: document.activeElement.id === 'egg-221-sheet',
        y: window.scrollY,
      }));
      expect(during, way).toEqual({ locked: true, inside: true, y: before.y });
      await page.keyboard.type('221');                        // typing it again does not stack a second sheet
      await expect(page.locator(`${HOST} dialog`)).toHaveCount(1);

      if (way === 'Esc') await page.keyboard.press('Escape');
      else if (way === 'its mark') await page.getByRole('button', { name: '关闭' }).click();
      else await page.mouse.click(6, 6);
      await expect(page.locator(HOST), `${way} closes it and leaves nothing behind`).toHaveCount(0);

      const after = await page.evaluate(() => ({
        overflow: [document.documentElement.style.overflow, document.body.style.overflow],
        focus: document.activeElement.id,
        same: window.__sameDocument,
        url: location.href,
        y: window.scrollY,
      }));
      expect(after, way).toEqual({ overflow: before.overflow, focus: 'scratch', same: true, url: before.url, y: before.y });
      expect(await themeOf(page), 'nothing was switched').toBe(theme);
    }
  });
}

for (const theme of ['classic', 'probe']) {
  test(`${theme}: an empty sheet is empty, a written one is set like a page and scrolls inside itself`, async ({ page, isMobile }) => {
    await arrive(page, theme);

    // What the owner has written so far is in _includes/egg-221.md. While that is nothing but its
    // comment, the built page carries an empty template.
    const written = readFileSync(path.join(root, '_includes/egg-221.md'), 'utf8').replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').trim();
    const built = (await page.evaluate(() => document.getElementById('egg-221').innerHTML)).trim();
    expect(built === '', 'the template is empty exactly when the file is').toBe(written === '');

    await fill(page, '');
    await page.keyboard.type('221');
    await expect(sheet(page)).toBeVisible();
    expect((await sheet(page).evaluate((dialog) => dialog.innerText)).trim(), 'no placeholder, no caption: a blank sheet').toBe('');
    await expect(page.locator(`${HOST} .text > *`)).toHaveCount(0);
    await settled(page);
    const blank = await paper(page).boundingBox();
    expect(blank.height, 'blank, but still a sheet').toBeGreaterThan(Math.min(400, blank.width));
    await page.keyboard.press('Escape');
    await expect(page.locator(HOST)).toHaveCount(0);

    const picture = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1200"><rect width="2400" height="1200" fill="#888"/></svg>')}`;
    await fill(page, `<h2 id="t">写给翻到这里的人</h2>${'<p>时间好快，快到我觉得还没来得及学会怎么去爱你，你我就已同绕日十度春秋。</p>'.repeat(40)}`
      + `<p><img id="pic" src="${picture}" alt=""></p><p>https://221forever.us/${'a-very-long-address-'.repeat(12)}</p><pre>${'no line breaks in here '.repeat(20)}</pre>`
      + '<blockquote><p>此去经年</p></blockquote><ul><li>一</li><li>二</li></ul><p id="end">完</p>');
    await page.keyboard.type('221');
    await expect(page.locator(`${HOST} h2`)).toHaveText('写给翻到这里的人');
    await expect(page.locator(`${HOST} #pic`)).toHaveJSProperty('complete', true);

    const got = await page.locator(`${HOST} .text`).evaluate((text) => {
      const p = getComputedStyle(text.querySelector('p'));
      const pic = text.querySelector('#pic').getBoundingClientRect();
      const inner = text.clientWidth - parseFloat(getComputedStyle(text).paddingLeft) - parseFloat(getComputedStyle(text).paddingRight);
      return {
        fontSize: parseFloat(p.fontSize),
        leading: parseFloat(p.lineHeight) / parseFloat(p.fontSize),
        measure: inner / parseFloat(p.fontSize),                              // characters to a line
        scrolls: text.scrollHeight > text.clientHeight + 200,
        sideways: text.scrollWidth - text.clientWidth,
        picture: [pic.width, pic.height, inner],
        motion: getComputedStyle(text.parentElement).animationName,
      };
    });
    expect(got.fontSize, 'its own type, whatever the page behind uses').toBe(17);
    expect(got.leading, 'room between the lines').toBeGreaterThanOrEqual(1.7);
    expect(got.measure, 'a line is neither a ribbon nor a banner').toBeGreaterThan(15);
    expect(got.measure).toBeLessThan(36);
    expect(got.scrolls, 'a long text scrolls inside the sheet').toBe(true);
    expect(got.sideways, 'and never sideways').toBeLessThanOrEqual(0);
    expect(Math.abs(got.picture[0] - got.picture[2]), 'a large picture is scaled down to the column').toBeLessThanOrEqual(1);
    expect(Math.abs(got.picture[1] - got.picture[0] / 2), 'and keeps its shape').toBeLessThanOrEqual(1);
    expect(got.motion).toBe('sheet-in');

    await settled(page);
    const view = page.viewportSize();
    const box = await paper(page).boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(24);
    expect(box.y + box.height, 'the sheet stays on the screen').toBeLessThanOrEqual(view.height - 24);
    await expectNoSidewaysScroll(page);

    // read to the end: the mark is still in its corner, and the page behind has not moved
    const y = await page.evaluate(() => window.scrollY);
    await page.locator(`${HOST} #end`).scrollIntoViewIfNeeded();
    await expect(page.locator(`${HOST} #end`)).toBeInViewport();
    await expect(page.getByRole('button', { name: '关闭' })).toBeInViewport();
    if (!isMobile) {                                                          // (no mouse wheel on a phone)
      await page.mouse.move(view.width / 2, view.height / 2);
      await page.mouse.wheel(0, 900);
      await page.mouse.move(6, view.height / 2);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(300);
    }
    expect(await page.evaluate(() => window.scrollY), 'the page behind stays where it was').toBe(y);
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.locator(HOST)).toHaveCount(0);
  });
}

test('the sheet arrives without motion for a reader who asked for none', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await arrive(page, 'probe');
  await page.keyboard.type('221');
  await expect(sheet(page)).toBeVisible();
  expect(await paper(page).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await sheet(page).evaluate((el) => getComputedStyle(el, '::backdrop').animationName)).toBe('none');
});

test('while the sheet is open the page behind does not hear the keyboard', async ({ page, request }) => {
  // The reference theme listens for Esc (back to the list) and the arrow keys (the letter before
  // and after) on a letter. None of that may happen underneath an open sheet.
  const { letters } = await getIsland(request);
  const letter = letters.find((l) => !l.standalone && l.no > 3);
  await arrive(page, 'probe', letter.url);
  const where = () => page.evaluate(() => [window.__theme.ctx.router.current.type, decodeURI(location.pathname)]);
  await page.keyboard.type('221');
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('pi');
  await page.waitForTimeout(300);
  expect(await where()).toEqual(['letter', letter.url]);
  await expect(page.locator('#egg-pi')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator(HOST)).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await where(), 'Esc closed the sheet and nothing else').toEqual(['letter', letter.url]);
  await page.keyboard.press('Escape');                          // and now the keyboard is the page's again
  await expect.poll(where).toEqual(['home', '/']);
});

test('typing 221 in a form field does nothing', async ({ page }) => {
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'scratch'; document.getElementById('theme-root').append(input); input.focus(); });
  await page.keyboard.type('221 pi');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('probe');
  await expect(page.locator('#egg-pi')).toHaveCount(0);
  await expect(page.locator(HOST)).toHaveCount(0);
});

for (const theme of ['classic', 'probe']) {
  test(`${theme}: typing pi shows the day's digits of π`, async ({ page }) => {
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.clock.setFixedTime(noon('2026-11-17'));           // 在一起第 3922 天
    await page.goto(`/?theme=${theme}`);
    if (theme !== 'classic') await page.waitForSelector('html[data-theme-ready]');
    else await page.waitForFunction(() => window.__theme.up === 1);
    await expect(page.locator('#egg-pi')).toHaveCount(0);        // invisible until asked for
    await page.keyboard.type('pi');
    await expect(page.locator('#egg-pi')).toBeVisible();
    await expect(page.locator('#egg-pi')).toHaveText('在一起第 3922 天 · π 的小数点后第 3922 位起：1 8 9 3 0 3 9 6 8 6');
    await page.locator('#egg-pi').click();
    await expect(page.locator('#egg-pi')).toHaveCount(0);
  });
}

// 221 used to change the theme, and under classic three quick taps on the big title or on the
// footer line did the same. Both are gone: every theme has its row of names (tests/switcher.spec.mjs).
for (const [where, path, selector] of [['the title of the home page', '/', '.textLogo--frontpage'], ['the footer line of a letter', null, '.section--footer .container > div']]) {
  test(`classic: three taps on ${where} change nothing`, async ({ page, request }) => {
    await arrive(page, 'classic', path || (await getIsland(request)).letters[0].url);
    await page.evaluate(() => { window.__sameDocument = true; });
    const target = page.locator(selector);
    for (let i = 0; i < 3; i++) await target.click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => [window.__sameDocument, document.documentElement.dataset.theme])).toEqual([true, 'classic']);
    await expect(page.locator(HOST)).toHaveCount(0);
  });
}
