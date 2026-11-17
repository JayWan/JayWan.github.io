// Which theme does a visit get? (ARCHITECTURE §4, _includes/theme-boot.html)
//
// These tests run the real boot script, taken from the built home page, on an otherwise empty
// page and with a fixed registry of five themes. That way they test the rules themselves and do
// not depend on which themes happen to exist in assets/themes/ today.

import { test, expect } from '@playwright/test';

const REGISTRY = {
  // [id, name, dark, drawable, fonts]
  t: [['classic', '旧版', 0, 1, []], ['drift', '夜航', 1, 1, []], ['folio', '笺', 0, 1, []], ['sides', 'Side A / Side B', 0, 1, []],
    ['orbit', '绕日', 1, 1, []], ['probe', '探针', 0, 0, []], ['resting', '停用的', 1, 0, []]],
  d: { '02-21': 'orbit', '11-28': 'drift', '02-06': 'sides', '07-04': 'sides', '08-12': 'folio', '09-15': 'classic' },
};
const DRAWN = ['classic', 'drift', 'folio', 'sides', 'orbit'];
const DARK = ['drift', 'orbit'];
const MIN = 60_000;

/** A local time in the test time zone (America/Los_Angeles, see playwright.config.js).
 *  -08:00 is right from November to early March; pass '-07:00' for summer dates. */
const la = (day, time = '10:00', offset = '-08:00') => new Date(`${day}T${time}:00${offset}`);

let bootPage;   // the synthetic page, built once per worker

test.beforeEach(async ({ context, request }) => {
  if (!bootPage) {
    const html = await (await request.get('/')).text();
    const boot = /<script>(\(function\(w,d,C\)\{[\s\S]*?)<\/script>/.exec(html)[1];
    const cut = boot.lastIndexOf('})(window,document,');
    const config = JSON.parse(boot.slice(cut + '})(window,document,'.length, boot.lastIndexOf(');')));
    const script = `${boot.slice(0, cut)}})(window,document,${JSON.stringify({ ...config, ...REGISTRY, page: 'home' })});`;
    bootPage = `<!doctype html><html data-theme="classic"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
      <noscript id="classic-head"></noscript><script>${script}</script><script>window.__theme.up = 1</script></head><body>boot test</body></html>`;
  }
  await serveBootPage(context);
});

async function serveBootPage(context) {
  await context.route('**/__boot/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: bootPage }));
  await context.route(/\/assets\/(themes|fonts|js)\//, (route) => route.fulfill({ contentType: 'text/css', body: '' }));   // the fake themes have no files
}

const read = (page) => page.evaluate(() => ({ id: document.documentElement.dataset.theme, by: window.__theme.by }));

/** One visit in a fresh tab: open, read the theme, close. */
async function visit(context, when, url = '/__boot/') {
  if (when) await context.clock.setFixedTime(when);
  const page = await context.newPage();
  await page.goto(url);
  const result = await read(page);
  await page.close({ runBeforeUnload: false });
  return result;
}

test.describe('choosing a theme', () => {
  test('?theme=<id> wins, lasts for the visit and leaves the address bar clean', async ({ page, context }) => {
    await context.clock.setFixedTime(la('2026-01-05'));
    await page.goto('/__boot/?theme=folio&x=1#top');
    expect(await read(page)).toEqual({ id: 'folio', by: 'url' });
    expect(new URL(page.url()).search).toBe('?x=1');
    expect(new URL(page.url()).hash).toBe('#top');
    await page.goto('/__boot/other');                                      // an ordinary link inside the visit
    expect(await read(page)).toEqual({ id: 'folio', by: 'visit' });
    expect(await visit(context)).toEqual({ id: 'folio', by: 'visit' });    // and a new tab of the same visit
  });

  test('a hidden or disabled theme can still be forced, an unknown one cannot', async ({ page, context }) => {
    await context.clock.setFixedTime(la('2026-01-05'));
    await page.goto('/__boot/?theme=probe');
    expect((await read(page)).id).toBe('probe');
    await page.goto('/__boot/?theme=resting');
    expect((await read(page)).id).toBe('resting');
    await page.goto('/__boot/?theme=%3Cscript%3Ealert(1)%3C/script%3E');
    expect(await read(page)).toEqual({ id: 'resting', by: 'visit' });      // ignored: the visit goes on
    expect(page.url()).not.toContain('theme=');
  });

  test('?theme=random draws again, away from the current theme', async ({ page, context }) => {
    await context.clock.setFixedTime(la('2026-01-05'));
    await page.goto('/__boot/?theme=sides');
    await page.goto('/__boot/?theme=random');
    const next = await read(page);
    expect(next.by).toBe('bag');
    expect(next.id).not.toBe('sides');
  });

  test('a visit: reload, Back and new tabs keep the theme; 30 minutes away ends it', async ({ page, context }) => {
    const t0 = la('2026-01-05').getTime();
    await context.clock.setFixedTime(t0);
    await page.goto('/__boot/');
    const first = await read(page);
    expect(first.by).toBe('bag');

    await context.clock.setFixedTime(t0 + 3 * 60 * MIN);                  // three hours of reading, same tab
    await page.reload();
    expect(await read(page), 'reload').toEqual({ id: first.id, by: 'visit' });
    await page.goto('/__boot/next');
    expect(await read(page), 'link').toEqual({ id: first.id, by: 'visit' });
    await page.goBack();
    expect((await read(page)).id, 'Back').toBe(first.id);
    await page.close();                                                    // last on screen: t0 + 3 h

    expect(await visit(context, t0 + 3 * 60 * MIN + 29 * MIN), 'new tab 29 min later').toEqual({ id: first.id, by: 'visit' });
    const later = await visit(context, t0 + 3 * 60 * MIN + 29 * MIN + 31 * MIN);
    expect(later.by, 'new tab 31 min after that').toBe('bag');
    expect(later.id).not.toBe(first.id);
  });

  test('a page that stays on screen keeps the visit alive for new tabs', async ({ page, context }) => {
    const t0 = la('2026-01-05').getTime();
    await context.clock.install({ time: t0 });
    await page.goto('/__boot/');
    const first = await read(page);
    await context.clock.runFor(48 * MIN);                                  // a long read in this tab, never hidden
    const other = await context.newPage();                                 // then a link opened in a new tab
    await other.goto('/__boot/next');
    expect(await read(other)).toEqual({ id: first.id, by: 'visit' });
  });

  for (const [day, offset, theme] of [['2027-02-21', '-08:00', 'orbit'], ['2026-11-28', '-08:00', 'drift'], ['2027-02-06', '-08:00', 'sides'],
    ['2027-07-04', '-07:00', 'sides'], ['2027-08-12', '-07:00', 'folio'], ['2027-09-15', '-07:00', 'classic']]) {
    test(`${day.slice(5)} is ${theme}'s day`, async ({ browser, baseURL }) => {
      for (const time of ['00:00', '12:00', '23:59']) {               // all day long, even at night; a new visitor each time
        const visitor = await browser.newContext({ baseURL, timezoneId: 'America/Los_Angeles' });
        await serveBootPage(visitor);
        expect(await visit(visitor, la(day, time, offset)), time).toEqual({ id: theme, by: 'date' });
        await visitor.close();
      }
    });
  }

  test('special dates follow the visitor\'s calendar, not UTC', async ({ context }) => {
    // 2027-02-21 03:00 UTC is still the evening of the 20th in Los Angeles
    expect((await visit(context, new Date('2027-02-21T03:00:00Z'))).by).not.toBe('date');
  });

  test('a special date does not interrupt a visit that is under way', async ({ context }) => {
    const before = await visit(context, la('2027-02-20', '23:50'));
    expect(await visit(context, la('2027-02-21', '00:05'))).toEqual({ id: before.id, by: 'visit' });
  });

  test('at night only dark themes are drawn', async ({ context }) => {
    const seen = [];
    for (let night = 0; night < 12; night++) {
      const day = `2026-01-${String(5 + night).padStart(2, '0')}`;
      const time = ['23:00', '23:30', '02:00', '05:59'][night % 4];
      const got = await visit(context, la(day, time));
      expect(got.by, `${day} ${time}`).toBe('night');
      expect(DARK, `${day} ${time}`).toContain(got.id);
      seen.push(got.id);
    }
    seen.forEach((id, i) => { if (i) expect(id, 'never the same theme twice in a row').not.toBe(seen[i - 1]); });
    expect((await visit(context, la('2026-01-20', '22:59'))).by, '22:59').toBe('bag');
    expect((await visit(context, la('2026-01-21', '06:00'))).by, '06:00').toBe('bag');
  });

  test('200 visits: never the same theme twice in a row, every theme equally often', async ({ context }) => {
    test.setTimeout(120_000);
    const seen = [];
    for (let i = 0; i < 200; i++) {
      // 20 visits a day between 07:00 and 21:15, 45 minutes apart, on days without a special date
      const when = la(`2026-01-${String(5 + Math.floor(i / 20)).padStart(2, '0')}`, '07:00').getTime() + (i % 20) * 45 * MIN;
      const got = await visit(context, when);
      expect(got.by).toBe('bag');
      seen.push(got.id);
    }
    const repeats = seen.filter((id, i) => i && id === seen[i - 1]).length;
    expect(repeats, 'same theme twice in a row').toBe(0);
    const count = Object.fromEntries(DRAWN.map((id) => [id, seen.filter((x) => x === id).length]));
    expect(count).toEqual({ classic: 40, drift: 40, folio: 40, sides: 40, orbit: 40 });
    for (let round = 0; round < 40; round++) {                           // and every theme once per round of five
      expect(new Set(seen.slice(round * 5, round * 5 + 5)).size, `round ${round}`).toBe(5);
    }
  });

  test('storage unavailable (private mode, cookies blocked): no error, a valid theme, the same on the next page', async ({ context }) => {
    await context.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, name, { get() { throw new DOMException('denied', 'SecurityError'); } });
      }
    });
    await context.clock.setFixedTime(la('2026-01-05'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto('/__boot/');
    const first = await read(page);
    expect(first.by).toBe('clock');
    expect(DRAWN).toContain(first.id);
    await page.goto('/__boot/next');
    expect(await read(page)).toEqual(first);
    await page.goto('/__boot/?theme=orbit');                               // forcing still works
    expect((await read(page)).id).toBe('orbit');
    await context.clock.setFixedTime(la('2026-01-05', '23:30'));
    await page.goto('/__boot/');
    expect(DARK, 'night rule without storage').toContain((await read(page)).id);
    expect(errors).toEqual([]);
  });

  test('only localStorage is broken: the tab still keeps its theme', async ({ context }) => {
    await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
    await context.clock.setFixedTime(la('2026-01-05'));
    const page = await context.newPage();
    await page.goto('/__boot/');
    const first = await read(page);
    expect(DRAWN).toContain(first.id);
    await page.reload();
    expect(await read(page)).toEqual({ id: first.id, by: 'visit' });
  });

  test('a clock that jumped back does not pin the theme', async ({ context }) => {
    const first = await visit(context, la('2026-01-05', '10:00'));          // recorded while the clock was a day ahead
    const next = await visit(context, la('2026-01-04', '10:00'));
    expect(next.by).toBe('bag');
    expect(next.id).not.toBe(first.id);
  });

  test('a browser older than the baseline always gets classic', async ({ context }) => {
    await context.addInitScript(() => { CSS.supports = () => false; });
    expect(await visit(context, la('2026-01-05'), '/__boot/?theme=drift')).toEqual({ id: 'classic', by: 'old' });
  });

  test('going Back to a page kept in memory after switching theme shows the new theme', async ({ page, context }) => {
    await context.clock.setFixedTime(la('2026-01-05'));
    await page.goto('/__boot/?theme=folio');
    await page.goto('/__boot/second?theme=drift');
    await page.goBack();
    await expect.poll(async () => (await read(page)).id).toBe('drift');
  });
});
