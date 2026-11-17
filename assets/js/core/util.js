// Small helpers shared by the core modules. Nothing here touches the page on import.

export const DAY = 864e5;

/** 'YYYY-MM-DD' → timestamp of that calendar day at 00:00 UTC. Letter dates are days, not instants,
 *  so all day arithmetic is done in UTC and never moves with the visitor's time zone or DST. */
export function dayStamp(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from calendar day `a` to calendar day `b` (negative when b is earlier). */
export function daysBetween(a, b) {
  return Math.round((dayStamp(b) - dayStamp(a)) / DAY);
}

/** The visitor's local calendar day as 'YYYY-MM-DD'. */
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

/** A site path in one canonical spelling: decoded ("/story/2026/08/12/木婚快乐/"), with a trailing
 *  slash, without query or hash. Accepts a path, a full URL or anything with an href (a URL,
 *  location, an <a>, also an SVG <a>, whose href is an object). Returns null for something that
 *  is not a URL at all. */
export function normPath(url) {
  let path;
  let raw = url && url.href !== undefined ? url.href : url;
  if (raw && typeof raw === 'object' && 'baseVal' in raw) raw = raw.baseVal;
  try { path = new URL(String(raw), location.href).pathname; } catch { return null; }
  try { path = decodeURI(path); } catch { /* keep the encoded form */ }
  path = path.replace(/\/index\.html$/, '/');
  return path.endsWith('/') ? path : path + '/';
}

/** Minimal event emitter. on() returns a function that removes the listener. */
export function emitter() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type).delete(fn);
    },
    emit(type, arg) {
      for (const fn of [...(map.get(type) || [])]) {
        try { fn(arg); } catch (err) { console.error(err); }   // one broken listener must not stop the others
      }
    },
  };
}

/** document.createElement with attributes and children in one call:
 *  el('a', { href: '/', class: 'home', onclick: fn }, 'text', otherNode)
 *  `class`, `text`, `html`, `dataset` and on* are handled; everything else is set as an attribute.
 *  null / undefined / false children and attributes are skipped. */
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : String(child));
  }
  return node;
}
