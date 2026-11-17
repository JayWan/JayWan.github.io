// The site's voice and the hidden things (ARCHITECTURE §7, assets/js/core/eggs.js).

import { test, expect } from '@playwright/test';
import { getIsland } from './helpers.mjs';

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

for (const theme of ['classic', 'probe']) {
  test(`${theme}: a greeting waits in the console`, async ({ page }) => {
    await page.route(/^https:\/\//, (route) => route.abort());
    const logs = [];
    page.on('console', (msg) => { if (msg.type() === 'log') logs.push(msg.text()); });
    await page.goto(`/?theme=${theme}`);
    await expect.poll(() => logs.join('\n')).toMatch(/221 FOREVER[\s\S]*封信[\s\S]*敲 221/);
  });
}

test('typing 221 moves on to the next theme', async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  const expected = await page.evaluate(() => window.__theme.themes.filter((t) => t[3])[0][0]);   // probe is not in the rotation: start over
  await page.keyboard.type('221');
  await page.waitForFunction((id) => document.documentElement.dataset.theme === id && window.__theme.by === 'url', expected);
  expect(page.url()).not.toContain('theme=');
});

test('typing 221 in a form field does nothing', async ({ page }) => {
  await page.goto('/?theme=probe');
  await page.waitForSelector('html[data-theme-ready="probe"]');
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'scratch'; document.getElementById('theme-root').append(input); input.focus(); });
  await page.keyboard.type('221 pi');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('probe');
  await expect(page.locator('#egg-pi')).toHaveCount(0);
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

for (const [where, path, selector] of [['the title of the home page', '/', '.textLogo--frontpage'], ['the footer line of a letter', null, '.section--footer']]) {
  test(`classic: three taps on ${where} do what 221 does`, async ({ page, request }) => {
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.goto(`${path || (await getIsland(request)).letters[0].url}?theme=classic`);
    await page.waitForFunction(() => window.__theme.up === 1);
    await page.evaluate(() => { window.__sameDocument = true; });
    const target = page.locator(selector);
    await target.click();
    await target.click();
    expect(await page.evaluate(() => window.__sameDocument), 'two taps: nothing').toBe(true);
    await target.click();
    await page.waitForFunction(() => window.__sameDocument === undefined && window.__theme && window.__theme.by === 'url');
  });
}
