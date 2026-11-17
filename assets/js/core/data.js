// Reads the data island that Jekyll writes into every page (_includes/letters-data.html)
// and adds the fields that are easier to compute here than in Liquid.

import { daysBetween, dayStamp, localDay, normPath, DAY } from './util.js';

const MILESTONES = ['met', 'together', 'married'];

/** Parse <script type="application/json" id="letters-data">. Throws if it is missing or broken. */
export function readIsland(doc = document) {
  const node = doc.getElementById('letters-data');
  if (!node) throw new Error('data island #letters-data not found');
  return JSON.parse(node.textContent);
}

/** Whole days since each milestone on calendar day `date`; null before the milestone happened.
 *  This is how the couple counts: 2024-11-19 is 认识第 3279 天, the day they met is day 0. */
function daysSince(site, date) {
  const days = {};
  for (const key of MILESTONES) {
    const n = site[key] ? daysBetween(site[key], date) : null;
    days[key] = n !== null && n >= 0 ? n : null;
  }
  return days;
}

const ROLES = { Pikajay: 'him', Pikachi: 'her' };

/** Everyone who wrote the letter, first author first. The island's `authors` is `author` plus
 *  the `coauthor` of the front matter; a letter without it has one author. */
function authorsOf(raw) {
  return Array.isArray(raw.authors) && raw.authors.length && raw.authors[0] === raw.author ? [...raw.authors] : [raw.author];
}

/** him | her | both | guest. `both` = the two of them wrote it together (教小天使发布文章);
 *  otherwise the first author decides, and anyone who is not one of the two is a guest. */
function roleOf(authors) {
  const roles = authors.map((name) => ROLES[name] || 'guest');
  return roles.includes('him') && roles.includes('her') ? 'both' : roles[0] || 'guest';
}

/** The island's compact picture map ({ file: [w, h] | [w, h, base, widths] }) as objects. */
function picturesOf(map) {
  const out = {};
  for (const [file, value] of Object.entries(map || {})) {
    if (!Array.isArray(value) || !(value[0] > 0) || !(value[1] > 0)) continue;
    const [w, h, base = null, widths = []] = value;
    out[file] = { w, h, base, widths: Array.isArray(widths) ? widths : [] };
  }
  return out;
}

/**
 * island → { site, letters, page, pictures }
 *
 * site      the island's site object + today: { date: 'YYYY-MM-DD' (visitor's local day), days: { met, together, married } }
 * letters   the island's letters, oldest first by the day they were really written, each with
 *             no      1, 2, 3 … in that order
 *             index   position in the array (no - 1)
 *             date    the real day (the island already carries `written_on` here when a letter has one;
 *                     such a letter has time: null)
 *             year    2026
 *             doy     day of the year, 1 – 366
 *             authors ['Pikajay'] | ['Pikajay', 'Pikachi'] | ['Claude'] …
 *             role    'him' (Pikajay) | 'her' (Pikachi) | 'both' (the two of them) | 'guest' (anyone else)
 *             days    { met, together, married } on the day the letter was written (null = not yet).
 *                     A count the letter states about itself wins over the computed one: the couple
 *                     sometimes counts inclusively (「和小天使的三百天」 says 300, the calendar says 299).
 *             prev / next   the neighbouring letters or null (not enumerable, so JSON.stringify stays flat)
 *           and on the array itself: byUrl(url), byNo(no), latest, years
 * page      { type, url } as written by Jekyll
 * pictures  every picture used inside a letter: { 'file.jpg': { w, h, base, widths } } (base is null
 *           and widths is [] when the picture has no derivatives)
 */
export function enrich(island, now = new Date()) {
  const site = { ...island.site };
  const today = localDay(now);
  site.today = { date: today, days: daysSince(site, today) };

  // The island is already in this order; sorting again (stable) only matters if it ever is not.
  const letters = [...island.letters].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((raw, index) => {
    const year = Number(raw.date.slice(0, 4));
    const authors = authorsOf(raw);
    const days = daysSince(site, raw.date);
    for (const key of MILESTONES) if (raw.days && Number.isFinite(raw.days[key])) days[key] = raw.days[key];
    return {
      ...raw,
      no: index + 1,
      index,
      year,
      doy: Math.round((dayStamp(raw.date) - Date.UTC(year, 0, 1)) / DAY) + 1,
      authors,
      role: roleOf(authors),
      days,
      cover: raw.cover ? { ...raw.cover, own: raw.cover.own !== false } : null,
    };
  });

  const byPath = new Map();
  letters.forEach((letter, i) => {
    Object.defineProperties(letter, {
      prev: { value: letters[i - 1] || null },
      next: { value: letters[i + 1] || null },
    });
    byPath.set(normPath(letter.url), letter);
  });

  // Every year from the first letter's to the newest one's, also the years in which nobody wrote
  // (2020 and 2022 so far): a theme that lays the letters out by year must not skip those.
  const years = [];
  if (letters.length) {
    for (let year = letters[0].year; year <= letters[letters.length - 1].year; year++) years.push({ year, letters: letters.filter((l) => l.year === year) });
  }

  // Helpers live on the array as non-enumerable properties: for…of, map and length stay those of a plain array.
  Object.defineProperties(letters, {
    /** The letter at this URL or path (encoded or not, absolute or not), or null. */
    byUrl: { value: (url) => byPath.get(normPath(url)) || null },
    byNo: { value: (no) => letters[Number(no) - 1] || null },
    latest: { value: letters[letters.length - 1] || null },
    /** [{ year, letters }] oldest first, with an entry (letters: []) for every year without a letter. */
    years: { value: years },
  });

  return { site, letters, page: { ...island.page }, pictures: picturesOf(island.pictures) };
}
