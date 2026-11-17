// Soft navigation between the home page and the letters, so the page (and the song) survives.
//
// What gets intercepted: a plain left click on a same-origin <a> whose path is "/" or a letter's
// URL, with no query string, no target, no download attribute and no modifier key.
// Everything else (other pages, ?theme= links, new-tab clicks) is an ordinary navigation.
//
// What a soft navigation does: fetch the letter's page, take its `.content-body`, activate its
// widgets, pushState, set the title, call the theme's show(route), then set the scroll position.
// A `standalone` letter (it runs its own inline scripts) and any failure become a real
// navigation: the worst case is always "it behaves like a normal website".

import { normPath } from './util.js';

/**
 * createRouter({ letters, site, page, prepare }) → router
 *
 *   letters, site   from data.js
 *   page            ctx.page: { type, url, letter, contentEl }. The router keeps it up to date, so
 *                   ctx.page always describes what is on screen.
 *   prepare(el)     called once on every freshly fetched letter body (the core passes widgets.init)
 *
 *   router.start(view)    begin intercepting. `view` is what theme.mount() returned; without a
 *                         show() function the router stays passive and links load pages normally.
 *   router.go(url)        navigate as if a link had been clicked. Resolves true (soft) or false (the
 *                         browser is loading the page).
 *   router.prefetch(url)  fetch a letter ahead of time (call it on pointerenter / touchstart)
 *   router.current        the route on screen
 *   router.soft           whether soft navigation is active (the theme returned a show() function)
 *
 * A route is  { type: 'home', url, scrollY }
 *         or  { type: 'letter', url, letter, contentEl, scrollY }      (plus type '404' for the page you landed on)
 * scrollY is where the core will scroll once show() has finished: 0 for a link, the remembered
 * position for Back / Forward. If show() returns false (or resolves to false) the core leaves
 * the scroll position alone; use that when the theme moves the reader itself.
 */
export function createRouter({ letters, site, page, prepare = () => {} }) {
  const bodies = new Map();     // normalised path → the live .content-body of that letter
  const pending = new Map();    // normalised path → Promise of the fetch in flight
  const scrolls = new Map();    // history entry key → last scroll position seen on that entry
  let view = null;
  let key = 0;                  // key of the history entry we are on
  let serial = 0;               // counts navigations: a slow one must not overwrite a newer one

  const here = () => normPath(location.href);
  const current = { type: page.type, url: page.url, letter: page.letter || null, contentEl: page.contentEl || null, scrollY: 0 };
  let currentPath = here();
  if (page.type === 'letter' && page.contentEl) bodies.set(currentPath, page.contentEl);

  /** What a URL points at: { type: 'home' } | { type: 'letter', letter } | null (not ours). */
  function match(url) {
    let u;
    try { u = new URL(String(url), location.href); } catch { return null; }
    if (u.origin !== location.origin || u.search) return null;
    const path = normPath(u);
    if (path === '/') return { type: 'home', url: '/', path };
    const letter = letters.byUrl(path);
    return letter ? { type: 'letter', url: letter.url, letter, path } : null;
  }

  function fetchBody(target) {
    if (bodies.has(target.path)) return Promise.resolve(bodies.get(target.path));
    if (target.letter.standalone) return Promise.reject(new Error('standalone letter'));
    if (!pending.has(target.path)) {
      const job = fetch(target.url, { credentials: 'same-origin' })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
        .then((html) => {
          // DOMParser documents are inert: their scripts never run and their images do not load.
          const source = new DOMParser().parseFromString(html, 'text/html').querySelector('.content-body');
          if (!source) throw new Error('no .content-body in ' + target.url);
          const body = document.importNode(source, true);
          prepare(body);
          bodies.set(target.path, body);
          return body;
        })
        .finally(() => pending.delete(target.path));
      pending.set(target.path, job);
    }
    return pending.get(target.path);
  }

  async function build(target) {
    if (target.type === 'home') return { type: 'home', url: '/' };
    return { type: 'letter', url: target.url, letter: target.letter, contentEl: await fetchBody(target) };
  }

  const titleOf = (route) => (route.type === 'letter' ? `${route.letter.title} · ${site.title}` : `${site.name} · ${site.title}`);

  async function render(route, scrollY, path) {
    route.scrollY = scrollY;
    Object.assign(current, { letter: null, contentEl: null }, route);
    currentPath = path;
    Object.assign(page, { type: route.type, url: route.url, letter: route.letter || null, contentEl: route.contentEl || null });
    document.title = titleOf(route);
    const moved = await view.show(route);
    if (moved === false) return;
    window.scrollTo(0, scrollY);
    // The view may still be growing (images, fonts); try once more when it has had a frame.
    if (scrollY > 0) requestAnimationFrame(() => { if (Math.abs(window.scrollY - scrollY) > 2) window.scrollTo(0, scrollY); });
  }

  const stamp = (extra) => ({ ...(history.state || {}), f221: key, ...extra });

  async function go(url) {
    const target = view && view.show ? match(url) : null;
    if (!target) { location.assign(url); return false; }
    if (target.path === currentPath) { window.scrollTo(0, 0); return true; }
    const mine = ++serial;
    let route;
    try { route = await build(target); } catch { location.assign(url); return false; }
    if (mine !== serial) return false;                               // the reader clicked something else meanwhile
    try {
      history.replaceState(stamp({ scroll: window.scrollY }), '');   // remember where we were on the page we leave
      scrolls.set(key, window.scrollY);
      key = Date.now();
      history.pushState({ f221: key }, '', target.url);
      await render(route, 0, target.path);
      return true;
    } catch (err) {
      console.error('[221] soft navigation failed, loading the page instead:', err);
      location.assign(url);
      return false;
    }
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest && event.target.closest('a[href]');
    if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
    if (!match(a.href)) return;
    event.preventDefault();
    go(a.href);
  }

  async function onPop(event) {
    const path = here();
    if (path === currentPath) return;                                // only the #hash changed
    const target = match(location.href);
    const mine = ++serial;
    const state = event.state || {};
    key = state.f221 || 0;
    const scrollY = scrolls.has(key) ? scrolls.get(key) : state.scroll || 0;
    try {
      if (!target) throw new Error('not a page the theme can draw');
      const route = await build(target);
      if (mine !== serial) return;
      await render(route, scrollY, path);
    } catch {
      location.reload();                                             // the address bar already shows the right URL
    }
  }

  function start(mounted) {
    view = mounted || null;
    if (!view || typeof view.show !== 'function') { view = null; return; }
    const state = history.state || {};
    key = state.f221 || Date.now();
    history.replaceState(stamp(), '');
    // We restore scroll ourselves: the browser cannot know how tall a view the theme is about to draw.
    history.scrollRestoration = 'manual';
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (state.scroll && nav && nav.type !== 'navigate') {            // came back to this page by Back or reload
      window.scrollTo(0, state.scroll);
      requestAnimationFrame(() => window.scrollTo(0, state.scroll));
    }
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    window.addEventListener('scroll', () => scrolls.set(key, window.scrollY), { passive: true });
    window.addEventListener('pagehide', () => { try { history.replaceState(stamp({ scroll: window.scrollY }), ''); } catch { /* ignore */ } });
  }

  return {
    start,
    go,
    prefetch(url) {
      const target = view ? match(url) : null;
      if (target && target.type === 'letter') fetchBody(target).catch(() => {});
    },
    get current() { return current; },
    /** true once start() was given a view with show(): links are being handled without page loads */
    get soft() { return Boolean(view); },
  };
}
