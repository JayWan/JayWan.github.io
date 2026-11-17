// Soft navigation between the home page and the letters, so the page (and the song) survives.
//
// What gets intercepted: a plain left click on a same-origin <a> (HTML or SVG) whose path is "/"
// or a letter's URL, with no query string, no target, no download attribute and no modifier key.
// Everything else (other pages, ?theme= links, new-tab clicks, an #anchor on the page that is
// already showing) is left to the browser.
//
// What a soft navigation does: fetch the letter's page, take its `.content-body`, activate its
// widgets, pushState, set the title, call the theme's show(route), then set the scroll position.
// A `standalone` letter (it runs its own inline scripts) and any failure become a real
// navigation: the worst case is always "it behaves like a normal website".

import { normPath } from './util.js';

const FETCH_TIMEOUT = 8000;   // a letter that has not arrived by then is loaded as a normal page (the browser shows its own progress)
const SHOW_TIMEOUT = 2000;    // how long a new navigation waits for a show() that has not finished

/**
 * createRouter({ letters, site, page, prepare }) → router
 *
 *   letters, site   from data.js
 *   page            ctx.page: { type, url, letter, contentEl }. The router keeps it up to date, so
 *                   ctx.page always describes what is on screen.
 *   prepare(el)     called once on every letter body the first time it is about to be shown
 *                   (the core passes widgets.init)
 *
 *   router.start(view)    begin intercepting. `view` is what theme.mount() returned; without a
 *                         show() function the router stays passive and links load pages normally.
 *   router.go(url)        navigate as if a link had been clicked. Resolves true (soft) or false (the
 *                         browser is loading the page, or a newer navigation took over).
 *   router.back(url)      "back to the list": if `url` (default "/") is the page the reader came
 *                         from, this is the Back button, so they land where they left; otherwise
 *                         it is go(url). A link with the attribute data-back does the same.
 *   router.prefetch(url)  fetch a letter's HTML ahead of time (call it on pointerenter / touchstart).
 *                         Only the HTML: the letter's photos are not requested until it is shown.
 *   router.current        the route on screen (one object, updated in place)
 *   router.soft           whether soft navigation is active (the theme returned a show() function)
 *
 * A route is  { type: 'home', url, hash, scrollY }
 *         or  { type: 'letter', url, hash, letter, contentEl, scrollY }   (plus type '404' for the page you landed on)
 * scrollY is where the core will scroll once show() has finished: 0 for a link, the remembered
 * position for Back / Forward. hash is "" or "#id" when the link pointed at an anchor; the core
 * then scrolls to that element instead. If show() returns false (or resolves to false) the core
 * leaves the scroll position alone; use that when the theme moves the reader itself.
 *
 * show() calls never overlap: while one is still running (it returned a promise that has not
 * settled), the next navigation waits for it, at most SHOW_TIMEOUT. If the reader navigates
 * several times meanwhile, only the newest route is shown.
 *
 * While a letter is being fetched, <html> carries the attribute data-navigating, so a theme can
 * show that something is happening.
 */
export function createRouter({ letters, site, page, prepare = () => {} }) {
  const bodies = new Map();     // normalised path → the live .content-body of that letter (in this document)
  const inert = new Map();      // normalised path → a fetched .content-body still inside its own parsed document
  const pending = new Map();    // normalised path → Promise of the fetch in flight
  const scrolls = new Map();    // history entry key → last scroll position seen on that entry
  const html = document.documentElement;
  let view = null;
  let key = '';                 // key of the history entry we are on
  let serial = 0;               // counts navigations: a slow one must not overwrite a newer one
  let showing = null;           // settles when the show() now running has finished; null when none is
  let waiting = 0;              // navigations waiting for the network (drives data-navigating)
  let seq = 0;

  // Unique even when the clock stands still (tests freeze it) and across reloads of the same tab.
  const newKey = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // Scroll positions outlive the document in sessionStorage, so a reload, or Back to a page that
  // was left by a real page load, finds the reader's place again. They cannot be written into
  // history.state while the page is being left: Chrome drops a replaceState made during a
  // reload, and in WebKit one made during pagehide wipes the entry's state altogether (the page
  // then comes back with history.state === null). So: never call replaceState from pagehide.
  const STORE = 'f221:scroll';
  function recall() {
    try { for (const [k, y] of Object.entries(JSON.parse(sessionStorage.getItem(STORE)) || {})) scrolls.set(k, y); } catch { /* storage unavailable */ }
  }
  function remember() {
    scrolls.set(key, window.scrollY);
    try { sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries([...scrolls].slice(-40)))); } catch { /* storage unavailable */ }
  }

  const here = () => normPath(location.href);
  const current = { type: page.type, url: page.url, hash: '', letter: page.letter || null, contentEl: page.contentEl || null, scrollY: 0 };
  let currentPath = here();
  if (page.type === 'letter' && page.contentEl) bodies.set(currentPath, page.contentEl);

  /** What a URL points at: { type: 'home' } | { type: 'letter', letter } | null (not ours). */
  function match(url) {
    let u;
    try { u = new URL(String(url), location.href); } catch { return null; }
    if (u.origin !== location.origin || u.search) return null;
    const path = normPath(u);
    if (path === '/') return { type: 'home', url: '/', path, hash: u.hash };
    const letter = letters.byUrl(path);
    return letter ? { type: 'letter', url: letter.url, letter, path, hash: u.hash } : null;
  }

  /** Fetch a letter's page and keep its body where it was parsed: in a document of its own, where
   *  scripts never run and images do not load. prefetch() stops here, so warming the cache costs
   *  one HTML request and none of the letter's photos (some are several megabytes). */
  function fetchInert(target) {
    if (inert.has(target.path)) return Promise.resolve(inert.get(target.path));
    if (!pending.has(target.path)) {
      const abort = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => abort && abort.abort(), FETCH_TIMEOUT);
      const job = fetch(target.url, { credentials: 'same-origin', ...(abort && { signal: abort.signal }) })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
        .then((text) => {
          const source = new DOMParser().parseFromString(text, 'text/html').querySelector('.content-body');
          if (!source) throw new Error('no .content-body in ' + target.url);
          inert.set(target.path, source);
          return source;
        })
        .finally(() => { clearTimeout(timer); pending.delete(target.path); });
      pending.set(target.path, job);
    }
    return pending.get(target.path);
  }

  /** The live body of a letter. Bringing it into this document is what starts its images. */
  async function liveBody(target) {
    if (bodies.has(target.path)) return bodies.get(target.path);
    if (target.letter.standalone) throw new Error('standalone letter');
    const source = await fetchInert(target);
    if (bodies.has(target.path)) return bodies.get(target.path);     // another navigation got here first
    const body = document.importNode(source, true);
    inert.delete(target.path);
    prepare(body);
    bodies.set(target.path, body);
    return body;
  }

  async function build(target) {
    if (target.type === 'home') return { type: 'home', url: '/', hash: target.hash };
    if (bodies.has(target.path)) return { type: 'letter', url: target.url, hash: target.hash, letter: target.letter, contentEl: bodies.get(target.path) };
    html.setAttribute('data-navigating', '');
    waiting++;
    try {
      return { type: 'letter', url: target.url, hash: target.hash, letter: target.letter, contentEl: await liveBody(target) };
    } finally {
      if (--waiting === 0) html.removeAttribute('data-navigating');
    }
  }

  const titleOf = (route) => (route.type === 'letter' ? `${route.letter.title} · ${site.title}` : `${site.name} · ${site.title}`);

  /** Resolves when no show() is running any more. A show() that never settles is given up on
   *  after SHOW_TIMEOUT: a theme's mistake must not freeze every link on the page. */
  async function idle() {
    while (showing) {
      const running = showing;
      await Promise.race([running, new Promise((resolve) => setTimeout(resolve, SHOW_TIMEOUT))]);
      if (showing === running) showing = null;
    }
  }

  function anchor(hash) {
    if (!hash || hash.length < 2) return null;
    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* keep it as written */ }
    return document.getElementById(id);
  }

  /** Show `route`. The caller has made sure no other show() is running and that it is still the
   *  newest navigation (`mine === serial`). */
  async function render(route, scrollY, path, mine) {
    route.scrollY = scrollY;
    Object.assign(current, { letter: null, contentEl: null, hash: '' }, route);
    currentPath = path;
    Object.assign(page, { type: route.type, url: route.url, letter: route.letter || null, contentEl: route.contentEl || null });
    document.title = titleOf(route);

    let finished;
    const running = new Promise((resolve) => { finished = resolve; });
    showing = running;
    try {
      const moved = await view.show(route);
      if (moved === false || mine !== serial) return;                  // the theme scrolls itself, or a newer navigation is about to
      const target = scrollY === 0 ? anchor(route.hash) : null;
      if (target) { target.scrollIntoView(); return; }
      window.scrollTo(0, scrollY);
      // The view may still be growing (images, fonts); try once more when it has had a frame.
      if (scrollY > 0) requestAnimationFrame(() => { if (mine === serial && Math.abs(window.scrollY - scrollY) > 2) window.scrollTo(0, scrollY); });
    } finally {
      if (showing === running) showing = null;
      finished();
    }
  }

  const stamp = (extra) => ({ ...(history.state || {}), f221: key, ...extra });

  async function go(url) {
    const target = view ? match(url) : null;
    if (!target) { location.assign(url); return false; }
    if (target.path === currentPath) {
      serial++;                                                        // whatever was on its way is no longer wanted
      if (target.hash) location.assign(target.url + target.hash);      // an anchor on this page: a fragment navigation, no reload
      else window.scrollTo(0, 0);
      return true;
    }
    const mine = ++serial;
    let route;
    try { route = await build(target); } catch { if (mine === serial) location.assign(url); return false; }
    if (mine !== serial) return false;                                 // the reader clicked something else meanwhile
    await idle();
    if (mine !== serial) return false;
    try {
      history.replaceState(stamp({ scroll: window.scrollY }), '');     // remember where we were on the page we leave
      scrolls.set(key, window.scrollY);
      const from = currentPath;
      key = newKey();
      history.pushState({ f221: key, from }, '', target.url + target.hash);
      await render(route, 0, target.path, mine);
      return true;
    } catch (err) {
      console.error('[221] soft navigation failed, loading the page instead:', err);
      location.assign(url);
      return false;
    }
  }

  /** "Back to the list". See the header. */
  function back(url = '/') {
    const target = view ? match(url) : null;
    const from = (history.state || {}).from;
    if (target && from && from === target.path && target.path !== currentPath && history.length > 1) {
      history.back();
      return Promise.resolve(true);
    }
    return go(url);
  }

  /** href / target of an <a>. On an SVG <a> these properties are SVGAnimatedString objects. */
  const prop = (a, name) => { const v = a[name]; return v && typeof v === 'object' ? v.baseVal : v; };

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest && event.target.closest('a');
    if (!a || a.hasAttribute('download')) return;
    const href = prop(a, 'href');
    const frame = prop(a, 'target');
    if (!href || (frame && frame !== '_self')) return;
    let url;
    try { url = new URL(href, a.baseURI).href; } catch { return; }
    const target = match(url);
    if (!target) return;
    if (target.path === currentPath && target.hash) return;            // an anchor on this page: the browser's job
    event.preventDefault();
    if (a.hasAttribute('data-back')) back(url); else go(url);
  }

  async function onPop(event) {
    const path = here();
    if (path === currentPath) return;                                  // only the #hash (or a theme's own state) changed
    const target = match(location.href);
    const mine = ++serial;
    const state = event.state || {};
    key = state.f221 || newKey();
    const scrollY = scrolls.has(key) ? scrolls.get(key) : state.scroll || 0;
    try {
      if (!target) throw new Error('not a page the theme can draw');
      const route = await build(target);
      if (mine !== serial) return;
      await idle();
      if (mine !== serial) return;
      await render(route, scrollY, path, mine);
    } catch {
      if (mine === serial) location.reload();                          // the address bar already shows the right URL
    }
  }

  /** The path of the page this document was reached from, when that is certain: a same-site
   *  link (or location.assign) in this very tab. Then Back leads there. */
  function cameFrom() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav || nav.type !== 'navigate' || history.length < 2 || !document.referrer) return null;
      const ref = new URL(document.referrer);
      const path = ref.origin === location.origin ? normPath(ref) : null;
      return path && path !== currentPath ? path : null;
    } catch { return null; }
  }

  function start(mounted) {
    view = mounted && typeof mounted.show === 'function' ? mounted : null;
    if (!view) return;
    const state = history.state || {};
    key = state.f221 || newKey();
    const from = state.from === undefined ? cameFrom() : null;
    history.replaceState(stamp(from ? { from } : null), '');
    // We restore scroll ourselves: the browser cannot know how tall a view the theme is about to draw.
    history.scrollRestoration = 'manual';
    recall();
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const scrollY = scrolls.has(key) ? scrolls.get(key) : state.scroll || 0;
    if (scrollY && nav && nav.type !== 'navigate') {                   // came back to this page by Back or reload
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    window.addEventListener('scroll', () => scrolls.set(key, window.scrollY), { passive: true });
    window.addEventListener('pagehide', remember);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') remember(); });   // iOS often skips pagehide
  }

  return {
    start,
    go,
    back,
    prefetch(url) {
      const target = view ? match(url) : null;
      if (target && target.type === 'letter' && !target.letter.standalone && !bodies.has(target.path)) fetchInert(target).catch(() => {});
    },
    get current() { return current; },
    /** true once start() was given a view with show(): links are being handled without page loads */
    get soft() { return Boolean(view); },
  };
}
