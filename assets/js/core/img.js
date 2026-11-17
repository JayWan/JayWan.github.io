// ctx.img(): the only way a theme should put a cover on the page.
// It never points at the full-size original (0.1 – 11 MB each) when derivatives exist.

/**
 * img(cover, options) → <picture> element (not yet in the document)
 *
 * cover     letter.cover from the data, or null (then you get an empty <picture class="is-empty">)
 * options   sizes      the `sizes` attribute, e.g. '(max-width: 600px) 100vw, 440px'. Default '100vw'.
 *                      Be honest here: it decides which file the browser downloads.
 *           alt        alt text. Default '' (covers are decoration next to a title).
 *           lazy       true → loading="lazy" (default). Pass false for what is in the first screen.
 *           className  class for the <picture>
 *           widths     only use these derivative widths, e.g. [480, 800] for thumbnails
 *           lqip       true → show the 16px blurred preview behind the image while it loads
 *
 * The <img> inside carries width / height (no layout shift), background-color = the cover's
 * average colour, and two custom properties, --fx and --fy: the safe crop centre as percentages.
 * A theme that crops covers writes:  picture img { object-fit: cover; object-position: var(--fx) var(--fy); }
 */
export function img(cover, { sizes = '100vw', alt = '', lazy = true, className, widths, lqip = false } = {}) {
  const picture = document.createElement('picture');
  if (className) picture.className = className;
  if (!cover) { picture.classList.add('is-empty'); return picture; }

  const image = document.createElement('img');
  image.alt = alt;
  image.decoding = 'async';
  image.loading = lazy ? 'lazy' : 'eager';          // set before src: some browsers decide on insertion
  if (cover.w && cover.h) { image.width = cover.w; image.height = cover.h; }
  if (cover.color) image.style.backgroundColor = cover.color;
  const [fx, fy] = Array.isArray(cover.focus) ? cover.focus : [0.5, 0.5];
  image.style.setProperty('--fx', `${Math.round(fx * 100)}%`);
  image.style.setProperty('--fy', `${Math.round(fy * 100)}%`);
  if (lqip && cover.lqip) {
    image.style.backgroundImage = `url("${cover.lqip}")`;
    image.style.backgroundSize = 'cover';
    image.style.backgroundPosition = 'var(--fx) var(--fy)';
  }

  // Order matters. An <img> starts choosing a file the moment it gets a src or srcset, even
  // before it is in the document. So the <source> and the <img> go into the <picture> first and
  // the URLs are set last: otherwise an eager image fetches the JPEG and then the AVIF as well.
  const list = pickWidths(cover.widths || [], widths);
  const derived = Boolean(cover.base && list.length);
  const set = (ext) => list.map((w) => `${cover.base}-${w}.${ext} ${w}w`).join(', ');
  if (derived) {
    const avif = document.createElement('source');
    avif.type = 'image/avif';
    avif.sizes = sizes;
    avif.srcset = set('avif');
    picture.append(avif);
  }
  picture.append(image);
  if (derived) {
    image.sizes = sizes;
    image.srcset = set('jpg');
    // src is only what a browser without srcset support would use: a middle size
    image.src = `${cover.base}-${list.find((w) => w >= 800) || list[list.length - 1]}.jpg`;
  } else {
    image.src = cover.orig;                          // no derivatives (media.json missing): the original
  }
  return picture;
}

/** The derivative widths to offer: those the theme asked for; if none of them exists for this
 *  cover (a small original), the largest one that is not bigger than what was asked for. */
function pickWidths(available, wanted) {
  if (!wanted || !wanted.length) return available;
  const exact = available.filter((w) => wanted.includes(w));
  if (exact.length) return exact;
  const max = Math.max(...wanted);
  const below = available.filter((w) => w <= max);
  return below.length ? [below[below.length - 1]] : available.slice(0, 1);
}
