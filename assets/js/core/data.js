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

/**
 * island → { site, letters, page }
 *
 * site     the island's site object + today: { date: 'YYYY-MM-DD' (visitor's local day), days: { met, together, married } }
 * letters  the island's letters, oldest first, each with
 *            index   position in the array (no - 1)
 *            year    2026
 *            doy     day of the year, 1 – 366
 *            role    'him' (Pikajay) | 'her' (Pikachi) | 'guest' (anyone else)
 *            days    { met, together, married } on the day the letter was written (null = not yet)
 *            prev / next   the neighbouring letters or null (not enumerable, so JSON.stringify stays flat)
 *          and on the array itself: byUrl(url), byNo(no), latest
 * page     { type, url } as written by Jekyll
 */
export function enrich(island, now = new Date()) {
  const site = { ...island.site };
  const today = localDay(now);
  site.today = { date: today, days: daysSince(site, today) };

  const letters = island.letters.map((raw, index) => {
    const year = Number(raw.date.slice(0, 4));
    return {
      ...raw,
      index,
      year,
      doy: Math.round((dayStamp(raw.date) - Date.UTC(year, 0, 1)) / DAY) + 1,
      role: ROLES[raw.author] || 'guest',
      days: daysSince(site, raw.date),
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

  // Helpers live on the array as non-enumerable properties: for…of, map and length stay those of a plain array.
  Object.defineProperties(letters, {
    /** The letter at this URL or path (encoded or not, absolute or not), or null. */
    byUrl: { value: (url) => byPath.get(normPath(url)) || null },
    byNo: { value: (no) => letters[Number(no) - 1] || null },
    latest: { value: letters[letters.length - 1] || null },
  });

  return { site, letters, page: { ...island.page } };
}
