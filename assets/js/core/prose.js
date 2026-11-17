// ctx.prose.prepare(): one clean-up of a letter's body, shared by every new theme.
//
// A letter's body is the HTML that Jekyll rendered for the classic page. Parts of it only
// work with the classic stylesheet: photos placed as CSS backgrounds on empty <div>s whose
// height comes from a class, pictures without dimensions, inline heights. Every theme needs
// the same repairs, so they are made once, here, and themes never see an unprepared body:
// the core calls prepare() on the page's own body before mount(), and on every letter the
// router fetches. It is never called under the classic theme.
//
// What prepare(el, letter) does (in place, and only once per body):
//
//   1. <div class="img img--fullContainer img--NxLeading" style="background-image:url(…)">
//        → <figure class="letter-figure"><img src width height loading="lazy" decoding="async"></figure>
//   2. an <img> standing alone in a <p> or a <div align> gets the same <figure> around it;
//      every <img> gets width / height from the media data, decoding="async" and (outside the
//      gift box) loading="lazy". Pictures that have derivatives get a srcset and keep the
//      address of the original in data-orig.
//        figure classes: is-gif · is-portrait · is-small (narrower than 400px)
//        GIFs carry data-gif on the <img>, so a theme can decide what to do with moving pictures
//        --fig-w on the figure: a width the author wrote on the picture ("70%")
//   3. <blockquote>: `lyrics` when it is set line by line with <br> (mostly song lyrics);
//      a closing "- somebody" line is wrapped in <span class="quote-by">. `largeQuote` is the
//      letter's own class and stays as it is.
//   4. the flip card and the gift box are left alone, apart from their pictures' attributes
//      and one class: the card's closing lines (date and place) are <p class="letter-signoff">
//   5. inline heights (style="height: 800px") are removed; they belong to the classic line grid.
//      Inline <style> blocks, the gift box and anything with an id are not touched.
//   6. <b> opened again and again without being closed (kramdown nests them) is rewritten as
//      one <b> per line
//
// Nothing is dropped: every picture a letter had before is in it afterwards.
// Structure and default looks of the figures: assets/themes/shared/widgets.css.

const POSTS = /\/assets\/images\/posts\/([^/?#]+)(?:[?#].*)?$/;
const SIZES = '(max-width: 800px) 100vw, 800px';
const KEEP_OUT = '.gift-scene, .flip-card, canvas, svg, style, script';
const address = (path) => encodeURI(path).replace(/,/g, '%2C');   // a comma would end a srcset candidate

/**
 * createProse(pictures) → { prepare(el, letter) }
 *
 *   pictures   data.pictures: { 'file.jpg': { w, h, base, widths } }
 *   prepare    el: a letter's .content-body, live or still inside a parsed document.
 *              letter: the letter it belongs to (used for the pictures' alt text); optional.
 *              Returns el. Calling it again on the same body does nothing.
 */
export function createProse(pictures = {}) {
  /** What the media data knows about a picture address, or null. */
  function lookup(url) {
    const m = POSTS.exec(String(url || ''));
    if (!m) return null;
    let file = m[1];
    try { file = decodeURIComponent(file); } catch { /* keep it as written */ }
    return pictures[file] || null;
  }

  /** width / height, lazy loading, srcset: everything an <img> can know before it loads.
   *  `src` is the picture's address as the letter wrote it. It is set last: an <img> starts
   *  fetching the moment it has an address, and by then it must already be lazy and know its
   *  lighter copies, or the full-size original is on its way before anyone asked for it. */
  function dress(image, src, { lazy = true, sizes = SIZES } = {}) {
    const info = lookup(src);
    image.setAttribute('decoding', 'async');
    if (lazy) image.setAttribute('loading', 'lazy');
    if (/\.gif(?:[?#]|$)/i.test(src)) image.setAttribute('data-gif', '');
    if (info) {
      image.setAttribute('width', info.w);
      image.setAttribute('height', info.h);
    }
    if (info && info.base && info.widths.length) {
      image.setAttribute('data-orig', src);
      image.setAttribute('sizes', sizes);
      image.setAttribute('srcset', info.widths.map((w) => `${address(info.base)}-${w}.jpg ${w}w`).join(', '));
      image.setAttribute('src', `${address(info.base)}-${info.widths[0]}.jpg`);
    } else if (image.getAttribute('src') !== src) {
      image.setAttribute('src', src);
    }
    return info;
  }

  function figureFor(doc, info, isGif) {
    const figure = doc.createElement('figure');
    figure.className = 'letter-figure';
    if (isGif) figure.classList.add('is-gif');
    if (info) {
      if (info.h > info.w * 1.15) figure.classList.add('is-portrait');
      if (info.w < 400) figure.classList.add('is-small');
    }
    return figure;
  }

  // ---- 1 + 2. pictures, in the order they appear in the letter
  function pictures_(el, doc, alt) {
    for (const node of el.querySelectorAll('div.img, img')) {
      if (!el.contains(node)) continue;

      // a photo placed as a background on an empty <div>
      if (node.tagName === 'DIV') {
        if (node.closest(KEEP_OUT) || node.id || node.firstElementChild) continue;
        const m = /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(node.getAttribute('style') || '');
        if (!m || !m[2]) continue;
        const image = doc.createElement('img');
        image.setAttribute('alt', alt());
        const info = dress(image, m[2]);
        const figure = figureFor(doc, info, image.hasAttribute('data-gif'));
        node.replaceWith(figure);
        figure.append(image);
        continue;
      }

      // an <img> the letter already has
      if (node.closest('.letter-figure')) continue;
      const special = node.closest('.gift-scene, .flip-card');
      // The gift's picture waits behind display:none until the box is opened: it must be there
      // the moment it is shown, so it is not lazy. It is at most 320px wide.
      if (node.hasAttribute('data-orig') || !node.getAttribute('src')) continue;
      const info = dress(node, node.getAttribute('src'), special && special.matches('.gift-scene') ? { lazy: false, sizes: '320px' } : {});
      if (special || node.closest(KEEP_OUT)) continue;
      if (!node.getAttribute('alt')) node.setAttribute('alt', alt());

      // The author's own width ("width:70%") moves to the figure as --fig-w, where a theme can
      // honour or override it; the rest of the inline style was written for the classic page.
      const width = /(?:^|;)\s*width\s*:\s*([\d.]+%)/i.exec(node.getAttribute('style') || '');
      node.removeAttribute('style');

      // Standing alone in a <p> or a <div align="center">: that wrapper becomes the figure.
      const parent = node.parentElement;
      const alone = parent && parent !== el && /^(P|DIV)$/.test(parent.tagName) && !parent.id && !parent.className
        && parent.children.length === 1 && !parent.textContent.trim();
      if (!alone && parent !== el) continue;                                  // a picture in the middle of a sentence stays there
      const figure = figureFor(doc, info, node.hasAttribute('data-gif'));
      if (width) figure.style.setProperty('--fig-w', width[1]);
      (alone ? parent : node).replaceWith(figure);
      figure.append(node);
    }
  }

  // ---- 3. blockquotes
  function quotes(el, doc) {
    for (const quote of el.querySelectorAll('blockquote')) {
      if (quote.closest(KEEP_OUT)) continue;
      const host = quote.children.length === 1 && quote.firstElementChild.tagName === 'P' && !ownText(quote) ? quote.firstElementChild : quote;
      const breaks = [...host.childNodes].filter((n) => n.nodeName === 'BR');
      if (!breaks.length) continue;
      const last = breaks[breaks.length - 1];
      const tail = [];
      for (let n = last.nextSibling; n; n = n.nextSibling) tail.push(n);
      const said = tail.map((n) => n.textContent).join('').trim();
      if (/^[-–—─]+\s*\S/.test(said)) {                                       // "…" <br> - somebody
        const by = doc.createElement('span');
        by.className = 'quote-by';
        last.after(by);
        by.append(...tail);
        if (breaks.length < 2) continue;                                      // a quotation and who said it: not verse
      }
      if (!quote.classList.contains('largeQuote')) quote.classList.add('lyrics');
    }
  }
  const ownText = (node) => [...node.childNodes].some((n) => n.nodeType === 3 && n.data.trim());

  // ---- 4. the two letters that are objects
  function widgets(el) {
    for (const front of el.querySelectorAll('.flip-card-front')) {
      const paragraphs = [...front.children].filter((n) => n.tagName === 'P');
      const last = paragraphs[paragraphs.length - 1];
      if (last && paragraphs.length > 1 && last.querySelector('br')) last.classList.add('letter-signoff');
    }
  }

  // ---- 5. inline heights
  function heights(el) {
    for (const node of el.querySelectorAll('[style]')) {
      const owner = node.parentElement && node.parentElement.closest('[id]');
      if (node.id || node.closest(KEEP_OUT) || (owner && owner !== el && el.contains(owner))) continue;
      const kept = (node.getAttribute('style') || '').split(';').map((d) => d.trim())
        .filter((d) => d && !/^(?:min-)?height\s*:\s*[\d.]+[a-z]/i.test(d));
      if (kept.length) node.setAttribute('style', kept.join('; ')); else node.removeAttribute('style');
    }
  }

  // ---- 6. <b> inside <b> inside <b>
  function bolds(el, doc) {
    for (const outer of el.querySelectorAll('b')) {
      if (!outer.parentNode || !el.contains(outer) || outer.parentElement.closest('b') || !outer.querySelector('b') || outer.closest(KEEP_OUT)) continue;
      for (const inner of [...outer.querySelectorAll('b')]) inner.replaceWith(...inner.childNodes);
      const lines = doc.createDocumentFragment();
      let line = null;
      for (const node of [...outer.childNodes]) {
        if (node.nodeName === 'BR') { line = null; lines.append(node); continue; }
        if (!line && node.nodeType === 3 && !node.data.trim()) { lines.append(node); continue; }
        if (!line) { line = doc.createElement('b'); lines.append(line); }
        line.append(node);
      }
      outer.replaceWith(lines);
    }
  }

  function prepare(el, letter) {
    if (!el || !el.querySelectorAll || el.hasAttribute('data-prose')) return el;
    el.setAttribute('data-prose', '');
    const doc = el.ownerDocument;
    let count = 0;
    const alt = () => (letter && letter.title ? `「${letter.title}」里的图 ${++count}` : '');
    // One step failing must not cost the letter the others, and never the theme.
    for (const step of [pictures_, quotes, widgets, heights, bolds]) {
      try { step(el, doc, alt); } catch (err) { console.error(`[221] prose.prepare: ${step.name} failed`, err); }
    }
    return el;
  }

  return { prepare };
}
