// ctx.prose.prepare() (assets/js/core/prose.js): the one clean-up of a letter's body that every
// new theme gets from the core. Exercised through the reference theme `probe`.

import { test, expect } from '@playwright/test';
import { getIsland, watch, expectNoSidewaysScroll } from './helpers.mjs';

const BODY = '#theme-root .letter-body .content-body';

async function openProbe(page, path = '/') {
  await page.goto(`${path}?theme=probe`);
  await page.waitForSelector('html[data-theme-ready="probe"]');
}
const letterBy = async (request, test_) => (await getIsland(request)).letters.find(test_);

test('photos placed as backgrounds become figures with real dimensions, and the originals stay at home', async ({ page, request, baseURL }) => {
  const hangZhou = await letterBy(request, (l) => l.date === '2016-06-08');
  const seen = watch(page, baseURL);
  await openProbe(page, hangZhou.url);
  const body = page.locator(BODY);
  await expect(body).toHaveAttribute('data-prose', '');
  await expect(body.locator('div.img'), 'no background photo is left').toHaveCount(0);
  await expect(body.locator('figure.letter-figure > img')).toHaveCount(5);

  const pictures = await body.locator('figure.letter-figure > img').evaluateAll((imgs) => imgs.map((i) => ({
    file: decodeURIComponent((i.dataset.orig || i.getAttribute('src')).split('/').pop()),
    width: Number(i.getAttribute('width')), height: Number(i.getAttribute('height')),
    loading: i.getAttribute('loading'), decoding: i.getAttribute('decoding'), alt: i.getAttribute('alt'),
    src: i.getAttribute('src'), srcset: i.getAttribute('srcset'), sizes: i.getAttribute('sizes'),
    portrait: i.parentElement.classList.contains('is-portrait'),
  })));
  expect(pictures.map((p) => p.file)).toEqual(['6_0.jpg', '6_1.jpg', '6_2.jpg', '6_3.jpg', '6_4.jpg']);   // in the letter's order
  for (const p of pictures) {
    expect(p.width > 0 && p.height > 0, `${p.file}: width and height`).toBe(true);
    expect([p.loading, p.decoding], p.file).toEqual(['lazy', 'async']);
    expect(p.alt, `${p.file}: alt names the letter`).toContain(hangZhou.title);
  }
  expect(pictures[0]).toMatchObject({ width: 592, height: 1049, portrait: true, srcset: null });           // a small original: used as it is
  expect(pictures[1]).toMatchObject({ width: 1280, height: 960, portrait: false, src: '/assets/m/posts/6_1-jpg-800.jpg', srcset: '/assets/m/posts/6_1-jpg-800.jpg 800w, /assets/m/posts/6_1-jpg-1280.jpg 1280w' });
  expect(pictures[1].sizes).toBeTruthy();

  // walk the letter: every picture loads, none of them overflows, and no large original was fetched
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
  await expect.poll(() => body.locator('img').evaluateAll((imgs) => imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length), 'every picture loaded').toBe(0);
  await expectNoSidewaysScroll(page);
  expect(seen.requests.filter((u) => /\/assets\/images\/posts\/6_[1-4]\.jpg/.test(u)), 'pictures with derivatives are never fetched in full').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('moving pictures are marked, an author\'s width is kept as --fig-w, a fixed height is dropped', async ({ page, request }) => {
  const { letters } = await getIsland(request);
  const by = (title) => letters.find((l) => l.title === title);

  await openProbe(page, by('圣诞快乐').url);
  const gifs = page.locator(`${BODY} figure.letter-figure.is-gif > img[data-gif]`);
  await expect(gifs).toHaveCount(4);
  expect((await gifs.evaluateAll((imgs) => imgs.map((i) => [i.getAttribute('src'), i.getAttribute('width'), i.getAttribute('height')])))[0]).toEqual(['/assets/images/posts/19_1.gif', '800', '600']);

  await openProbe(page, letters.find((l) => l.quiet).url);                 // 世界赠予我们的: <p style="text-align:center"><img style="width:70%; …">
  const figures = await page.locator(`${BODY} figure.letter-figure`).evaluateAll((all) => all.map((f) => ({
    w: f.style.getPropertyValue('--fig-w'), parent: f.parentElement.className, img: f.firstElementChild.getAttribute('style'), alt: f.firstElementChild.alt,
    shown: Math.round(100 * f.firstElementChild.getBoundingClientRect().width / f.getBoundingClientRect().width),
  })));
  expect(figures).toEqual([
    { w: '100%', parent: 'content-body', img: null, alt: 'My plot', shown: 100 },
    { w: '70%', parent: 'content-body', img: null, alt: 'My plot', shown: 70 },
  ]);
  await expect(page.locator(`${BODY} p:has(img)`), 'the <p> around a lone picture became the figure').toHaveCount(0);

  await openProbe(page, by('七夕&一点九周年快乐').url);                     // style="background-image: …; height: 800px"
  const tall = page.locator(`${BODY} figure.letter-figure > img`);
  await expect(tall).toHaveCount(1);
  await tall.scrollIntoViewIfNeeded();
  await expect.poll(() => tall.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  const box = await tall.evaluate((i) => { const r = i.getBoundingClientRect(); return { ratio: r.width / r.height, style: i.parentElement.getAttribute('style'), vh: window.innerHeight, h: r.height }; });
  expect(Math.abs(box.ratio - 616 / 876), 'the picture keeps its proportions').toBeLessThan(0.02);
  expect(box.style).toBe(null);
  expect(box.h, 'a portrait picture fits in one screen').toBeLessThanOrEqual(box.vh);
});

test('blockquotes: verse is `lyrics`, a quotation names who said it, largeQuote stays as it is', async ({ page, request }) => {
  const { letters } = await getIsland(request);
  const by = (title) => letters.find((l) => l.title === title);
  const quotes = () => page.locator(`${BODY} blockquote`).evaluateAll((all) => all.map((q) => ({ cls: q.className, by: (q.querySelector('.quote-by') || {}).textContent || null })));

  await openProbe(page, by('万天万岁！').url);
  expect(await quotes()).toEqual([{ cls: 'lyrics', by: null }, { cls: 'lyrics', by: null }]);

  await openProbe(page, by('The Very Step').url);                         // “…” <br> - I still carry on
  const veryStep = await quotes();
  expect(veryStep.map((q) => q.cls)).toEqual(['u--startsWithDoubleQuote', 'u--startsWithDoubleQuote', 'u--startsWithDoubleQuote', 'largeQuote']);
  expect(veryStep.map((q) => q.by.trim())).toEqual(['- I still carry on', '- I still carry on', '- I still carry on', '- Wan_NJ']);

  await openProbe(page, by('Hang Zhou').url);
  expect((await quotes()).map((q) => q.cls)).toEqual(['u--startsWithDoubleQuote lyrics', 'largeQuote', 'u--startsWithDoubleQuote', 'u--startsWithDoubleQuote']);

  await openProbe(page, by('两年不见，你还好吗').url);                      // the site's own words
  expect(await quotes()).toEqual([{ cls: 'largeQuote', by: null }]);
});

test('<b> opened seventeen times and closed three times: one <b> per line, nothing else turns bold', async ({ page, request }) => {
  const letter = await letterBy(request, (l) => l.title === '教小天使发布文章');
  const raw = await (await request.get(letter.url)).text();
  expect(raw.split('<b>').length - 1, 'the letter as Jekyll wrote it').toBe(17);

  await openProbe(page, letter.url);
  const got = await page.locator(BODY).evaluate((body) => {
    const paragraphs = [...body.querySelectorAll('p')];
    const last = paragraphs[paragraphs.length - 1];
    const weight = (node) => Number(getComputedStyle(node).fontWeight);
    return {
      nested: body.querySelectorAll('b b').length,
      perParagraph: paragraphs.map((p) => p.querySelectorAll('b').length),
      lines: [...last.childNodes].filter((n) => n.nodeName === 'BR').length,
      boldLines: [...last.children].filter((n) => n.tagName === 'B' && !n.querySelector('br')).length,
      weights: [...new Set([...last.querySelectorAll('b')].map(weight))],
      plain: weight(paragraphs[2]),
      text: last.textContent.replace(/\s+/g, '').length,
    };
  });
  expect(got.nested).toBe(0);
  expect(got.perParagraph).toEqual([1, 2, 0, 14]);
  expect([got.lines, got.boldLines]).toEqual([14, 14]);
  expect(got.weights, 'every line is bold once, not bolder and bolder').toEqual([700]);
  expect(got.plain).toBe(400);
  expect(got.text).toBeGreaterThan(300);
});

test('prepare() is part of ctx, works on any piece of letter HTML, and does nothing the second time', async ({ page }) => {
  await openProbe(page);
  const got = await page.evaluate(() => {
    const { prose, letters } = window.__theme.ctx;
    const el = document.createElement('div');
    el.innerHTML = '<p>甲</p>'
      + '<div class="img img--fullContainer img--14xLeading" style="background-image: url(\'/assets/images/posts/2_2.jpg\'); height: 300px"></div>'
      + '<div class="img" style="background-image:url(/assets/images/posts/not-in-the-data.png)"></div>'
      + '<p style="height: 40px; color: red">乙</p>'
      + '<p><b>一<br><b>二<br><i>三</i><br></b></b></p>'
      + '<div id="own" style="height: 10px">丙</div>'
      + '<style>.x { height: 1px }</style>'
      + '<p>句子里的<img src="/assets/images/posts/10_1.png">图</p>';
    const before = el.querySelectorAll('div.img, img').length;
    const same = prose.prepare(el, letters[0]) === el;
    const once = el.innerHTML;
    prose.prepare(el, letters[0]);
    return {
      same, again: el.innerHTML === once, before, after: el.querySelectorAll('img').length,
      figures: [...el.querySelectorAll('figure.letter-figure > img')].map((i) => [i.getAttribute('src'), i.getAttribute('width'), i.getAttribute('loading')]),
      red: el.querySelector('p[style]').getAttribute('style'),
      bold: el.querySelector('p > b').parentElement.innerHTML,
      own: el.querySelector('#own').getAttribute('style'),
      css: el.querySelector('style').textContent,
      inline: el.querySelector('p > img').getAttribute('width'),
    };
  });
  expect(got).toEqual({
    same: true, again: true, before: 3, after: 3,
    figures: [['/assets/images/posts/2_2.jpg', '852', 'lazy'], ['/assets/images/posts/not-in-the-data.png', null, 'lazy']],
    red: 'color: red',                                                    // the height went, the rest stayed
    bold: '<b>一</b><br><b>二</b><br><b><i>三</i></b><br>',
    own: 'height: 10px',                                                  // anything with an id is the letter's own machinery
    css: '.x { height: 1px }',
    inline: '1000',                                                       // a picture inside a sentence is sized but stays where it is
  });
});

test('every letter keeps every picture, fits the screen and is as bold as it was written', async ({ page, request, baseURL }) => {
  test.setTimeout(120_000);
  const { letters } = await getIsland(request);
  const seen = watch(page, baseURL);
  await openProbe(page);
  let total = 0;

  for (const letter of letters) {
    // the letter as the classic page has it
    const before = await page.evaluate(async (url) => {
      const text = (await (await fetch(url)).text()).replace(/<noscript class="classic-only">[\s\S]*?<\/noscript>/g, '');
      const body = new DOMParser().parseFromString(text, 'text/html').querySelector('.content-body');
      const file = (u) => decodeURIComponent(u.split('/').pop());
      const pictures = [...body.querySelectorAll('div.img, img')].map((n) => (n.tagName === 'IMG' ? n.getAttribute('src') : (/url\(\s*['"]?(.*?)['"]?\s*\)/.exec(n.getAttribute('style') || '') || [])[1])).filter(Boolean).map(file);
      const bold = [...body.querySelectorAll('b, strong')].filter((b) => !b.parentElement.closest('b, strong')).map((b) => b.textContent).join('').replace(/\s+/g, '').length;
      return { pictures, bold, text: body.textContent.replace(/\s+/g, '').length };
    }, letter.url);

    // the letter as a theme gets it: by soft navigation, or a page load for the one that needs it
    if (letter.standalone) await openProbe(page, letter.url);
    else expect(await page.evaluate((url) => window.__theme.ctx.router.go(url), letter.url), `${letter.title}: soft navigation`).toBe(true);
    await expect(page.locator('#theme-root h1')).toHaveText(letter.title);

    const after = await page.locator(BODY).evaluate(async (body) => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      const shown = [...body.querySelectorAll('img')].filter((i) => !i.closest('#gift-reveal'));   // the gift's picture is checked where the box is opened
      await Promise.all(shown.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); }))));
      const file = (i) => decodeURIComponent((i.dataset.orig || i.getAttribute('src')).split('/').pop());
      return {
        pictures: [...body.querySelectorAll('img')].map(file),
        broken: shown.filter((i) => !(i.naturalWidth > 0)).map(file),
        unsized: [...body.querySelectorAll('img')].filter((i) => !i.hasAttribute('width') && !/\.svg$/.test(i.getAttribute('src'))).map(file),
        backgrounds: body.querySelectorAll('div.img').length,
        nested: body.querySelectorAll('b b').length,
        bold: [...body.querySelectorAll('b, strong')].filter((b) => !b.parentElement.closest('b, strong')).map((b) => b.textContent).join('').replace(/\s+/g, '').length,
        text: body.textContent.replace(/\s+/g, '').length,
        sideways: document.documentElement.scrollWidth - window.innerWidth,
        tooWide: [...body.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > body.getBoundingClientRect().width + 1).map(file),
      };
    });
    const where = `no. ${letter.no} ${letter.title}`;
    expect(after.pictures, `${where}: the same pictures in the same order`).toEqual(before.pictures);
    expect(after.broken, `${where}: every picture loads`).toEqual([]);
    expect(after.unsized, `${where}: every picture has width and height`).toEqual([]);
    expect([after.backgrounds, after.nested], `${where}: no background photos, no nested <b>`).toEqual([0, 0]);
    expect([after.bold, after.text], `${where}: the same words, the same words in bold`).toEqual([before.bold, before.text]);
    expect(after.sideways, `${where}: no sideways scroll`).toBeLessThanOrEqual(1);
    expect(after.tooWide, `${where}: no picture wider than the text`).toEqual([]);
    total += after.pictures.length;
  }
  expect(total, 'pictures inside letters').toBeGreaterThanOrEqual(28);
  expect(seen.errors).toEqual([]);
});

test('the classic theme never prepares a letter', async ({ page, request }) => {
  const hangZhou = await letterBy(request, (l) => l.date === '2016-06-08');
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto(`${hangZhou.url}?theme=classic`);
  await page.waitForFunction(() => window.__theme && window.__theme.up === 1);
  const body = page.locator('.content-body');
  await expect(body).not.toHaveAttribute('data-prose', '');
  await expect(body.locator('div.img')).toHaveCount(4);
  await expect(body.locator('figure')).toHaveCount(0);
  expect(await page.evaluate(() => window.__theme.ctx)).toBeUndefined();
});
