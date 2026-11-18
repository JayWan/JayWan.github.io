// Entry point of the theme runtime. Loaded as a module at the end of <body> on every page.
//
// The inline boot script (_includes/theme-boot.html) has already chosen the theme and loaded its
// stylesheet before this runs. What is left to do here:
//
//   classic theme   the page is already there. Only the row of theme names is added, at its
//                   foot and in its drawer (eggs.classicSwitcher), and the eggs that are
//                   invisible until used.
//   any other       build ctx, import /assets/themes/<id>/theme.js, call its mount(ctx),
//                   then hand the returned view to the router.
//
// If the theme cannot be loaded, throws, or has rendered nothing after 5 seconds, the page falls
// back to the classic theme: window.__theme.fail() remembers "classic" for this visit and
// reloads the page once. A reload is used (instead of rebuilding the classic page in place)
// because the classic page relies on parser-inserted, order-dependent scripts; loading it the
// normal way is the only version of it that is guaranteed to be the real thing.
//
// Contract for theme authors: assets/themes/README.md

import { readIsland, enrich } from './data.js';
import * as eggs from './eggs.js';

const TIMEOUT = 5000;
const T = window.__theme;       // { id, by, v, page, themes, fail() } from the boot script
T.up = 1;                       // the boot script's watchdog falls back to classic if this never happens

let data = null;
try {
  data = enrich(readIsland());
} catch (err) {
  console.error('[221] the data island is missing or broken:', err);
}

eggs.greet(T, data);
eggs.keys(T, data);
try { eggs.classicSwitcher(T); } catch (err) { console.error('[221] the switcher could not be added:', err); }
reportLastFallback();

if (T.id !== 'classic') start().catch(fail);

// ------------------------------------------------------------------------------------------

async function start() {
  const root = document.getElementById('theme-root');
  if (!data || !root) throw new Error('page is missing its data island or #theme-root');

  let mounted = false;
  const watchdog = setTimeout(() => {
    if (!mounted && !root.firstElementChild) fail(new Error(`rendered nothing in ${TIMEOUT / 1000} s`));
  }, TIMEOUT);

  if (!(await stylesheetLoaded())) throw new Error('theme.css did not load');

  const [{ createRouter }, { createPlayer }, { img }, widgets, { createProse }, themeModule] = await Promise.all([
    import('./router.js'),
    import('./player.js'),
    import('./img.js'),
    import('./widgets.js'),
    import('./prose.js'),
    import(`/assets/themes/${T.id}/theme.js?v=${T.v}`),
  ]);
  const theme = themeModule.default;
  if (!theme || typeof theme.mount !== 'function') throw new Error('theme.js must `export default { mount(ctx) }`');

  const { site, letters } = data;
  const prose = createProse(data.pictures);
  const page = { type: data.page.type, url: data.page.url, letter: null, contentEl: null };
  if (page.type === 'letter') {
    page.letter = letters.byUrl(page.url);
    page.contentEl = document.querySelector('.content-body');
    if (!page.letter || !page.contentEl) throw new Error('letter page without its letter or .content-body');
    prose.prepare(page.contentEl, page.letter);   // themes never see a letter's body as the classic page wrote it
    widgets.init(page.contentEl);      // under classic the classic script does this; here nobody else will
  }

  const query = (q) => window.matchMedia(q).matches;
  const ctx = {
    site,
    letters,
    page,
    root,
    env: {
      reducedMotion: query('(prefers-reduced-motion: reduce)'),
      touch: query('(hover: none), (pointer: coarse)'),
      standaloneDisplay: query('(display-mode: standalone)') || navigator.standalone === true,
    },
    player: createPlayer(letters, site),
    router: createRouter({ letters, site, page, root, normalise: prose.prepare, prepare: widgets.init }),
    img,
    ui: {
      hunger: () => eggs.hunger(letters, site.today.date),
      switcher: () => eggs.switcher(T),
      fmt: eggs.fmt,
    },
    widgets: { init: widgets.init },
    prose: { prepare: prose.prepare },
  };
  T.ctx = ctx;                         // for the console and for tests; not part of the contract

  document.documentElement.lang = 'zh-Hans';
  const view = await theme.mount(ctx);
  if (T.dead) return;                  // the watchdog already gave up on this theme
  mounted = true;
  clearTimeout(watchdog);
  if (!root.firstElementChild) throw new Error('mount() finished without rendering anything into ctx.root');

  ctx.router.start(view);
  paintBrowserChrome();
  document.documentElement.setAttribute('data-theme-ready', T.id);   // CSS and tests can wait for this
}

/** The theme's stylesheet is render-blocking, so by now it has either loaded or failed.
 *  A theme without its CSS would be a page of unstyled text: treat that as a failed theme.
 *  Chrome and Safari give a failed <link> an empty sheet rather than none, so "loaded" means
 *  "has rules"; a browser that gives it no sheet at all gets a moment to report the error. */
function stylesheetLoaded() {
  const link = document.getElementById('theme-css');
  const hasRules = () => { try { return link.sheet.cssRules.length > 0; } catch { return false; } };
  if (!link) return Promise.resolve(false);
  if (hasRules()) return Promise.resolve(true);
  if (link.sheet) return Promise.resolve(false);
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(hasRules()));
    link.addEventListener('error', () => resolve(false));
    setTimeout(() => resolve(hasRules()), 1500);
  });
}

/** Android Chrome tints its toolbar with theme-color; use whatever the theme painted on <html>. */
function paintBrowserChrome() {
  const color = getComputedStyle(document.documentElement).backgroundColor;
  if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  meta.content = color;
}

function fail(err) {
  console.error(`[221] theme "${T.id}" failed, falling back to classic:`, err);
  T.fail(String((err && err.message) || err));
}

/** After a fallback the page was reloaded, which wiped the console. Say what happened. */
function reportLastFallback() {
  try {
    const why = sessionStorage.getItem('f221:err');
    if (!why) return;
    sessionStorage.removeItem('f221:err');
    console.warn(`[221] fell back to the classic theme because a theme failed: ${JSON.parse(why)}`);
  } catch { /* storage unavailable */ }
}
