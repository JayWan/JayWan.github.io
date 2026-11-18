// probe — the reference theme.
//
// Deliberately plain. Its job is to use every part of the contract once, in the simplest way
// that is still correct, so a theme author can copy the shape and replace the looks.
// It is never drawn for a visitor: open any page with ?theme=probe to see it.
//
// The whole contract is the `ctx` object passed to mount(). Nothing is imported from the core.

/** h('a', { href, class, onclick }, ...children) → element. Null children are skipped. */
function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const [name, value] of Object.entries(props)) if (name.startsWith('data-') || name.startsWith('aria-')) node.setAttribute(name, value);
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

export default {
  /** Render the page the visitor landed on into ctx.root; return { show } to get soft navigation. */
  mount(ctx) {
    const { site, letters, root, player, router, ui } = ctx;
    const { fmt } = ui;
    // role is him | her | both | guest. Authorship is said on every letter, never only on the exceptions.
    const byline = (letter) => ({ him: '他写的', her: '她写的', both: '两个人一起写的' })[letter.role] || `${letter.authors.join('、')} 写的`;

    // ---- the song control. Every element that starts a song carries data-play (the tests look for it). ----
    function playButton(letter) {
      if (!letter.song) return null;
      return h('button', {
        type: 'button', className: 'p-play', 'data-play': letter.no,
        'aria-label': `播放《${letter.song.title}》`, 'aria-pressed': 'false',
        onclick: () => player.toggle(letter),        // called from a click: the only way sound ever starts
      });
    }

    // ---- shell: header, the view, a mini player that follows the reader, footer ----
    const main = h('main', { className: 'p-main', tabIndex: -1 });
    const bar = {
      el: h('aside', { className: 'p-bar', hidden: true, 'aria-label': '正在播放' }),
      title: h('a', { className: 'p-bar-title' }),
      time: h('span', { className: 'p-bar-time' }),
      seek: h('input', { type: 'range', className: 'p-bar-seek', min: 0, step: 1, value: 0, 'aria-label': '进度', oninput: (e) => player.seek(Number(e.target.value)) }),
      // The bar is fixed to the bottom of the screen: on a phone, pause is under the thumb wherever
      // the reader is in the letter. It carries data-play like every control that can start a song.
      toggle: h('button', { type: 'button', className: 'p-play', 'data-play': '', 'aria-label': '播放 / 暂停', onclick: () => player.toggle() }),
    };
    bar.el.append(bar.toggle, bar.title, bar.seek, bar.time);

    const days = site.today.days;      // whole days since each date, counted the way the couple counts
    root.replaceChildren(
      h('header', { className: 'p-head' },
        h('a', { className: 'p-logo', href: '/' }, site.title),
        ui.switcher(),                                          // the control that changes theme: top right, opens a list (styled in theme.css)
        h('p', { className: 'p-days' }, `认识 ${fmt.days(days.met)} · 在一起 ${fmt.days(days.together)} · 结婚 ${fmt.days(days.married)}`)),
      main,
      h('footer', { className: 'p-foot' },
        h('p', { className: 'p-hunger' }, ui.hunger().text),   // the site's own voice; every theme shows it
        h('p', { className: 'p-fine' }, `${letters.length} 封信 · ${fmt.date(letters[0].date, 'year')} – ${fmt.date(site.today.date, 'year')}`)),
      bar.el,
    );
    // ctx.env is a snapshot of the reader's preferences: reducedMotion, touch, standaloneDisplay.
    if (!ctx.env.reducedMotion) root.classList.add('p-motion');

    // ---- player → UI. 'change' = anything but the position; 'time' = the position (at most 4×/s). ----
    function paint(state) {
      root.querySelectorAll('[data-play]').forEach((button) => {
        const on = state.playing && state.letter && String(state.letter.no) === button.dataset.play;
        button.setAttribute('aria-pressed', String(on));
      });
      bar.el.hidden = !state.letter;
      if (!state.letter) return;
      bar.toggle.setAttribute('aria-pressed', String(state.playing));
      bar.el.dataset.state = state.error ? 'error' : state.loading ? 'loading' : state.playing ? 'playing' : 'paused';
      bar.title.textContent = state.error ? `《${state.letter.song.title}》放不出来` : `${state.letter.song.title} — ${state.letter.title}`;
      bar.title.href = state.letter.url;
      bar.seek.max = Math.round(state.duration);
      tick(state);
    }
    function tick(state) {
      bar.seek.value = Math.round(state.time);
      bar.time.textContent = `${fmt.clock(state.time)} / ${fmt.clock(state.duration)}`;
    }
    player.on('change', paint);
    player.on('time', tick);

    // ---- views ----
    function homeView() {
      const card = (letter) => {
        const link = h('a', { className: 'p-card', href: letter.url },
          // Covers only through ctx.img(): derivatives, lazy, width/height, never the original file.
          ctx.img(letter.cover, { sizes: '96px', widths: [480], className: 'p-thumb' }),
          h('span', { className: 'p-card-text' },
            h('strong', {}, letter.title),
            // letter.date is the day the letter was really written; the same facts on every letter
            h('small', {}, `No. ${letter.no} · ${fmt.date(letter.date, 'dot')} · ${fmt.season(letter.date)} · ${byline(letter)}${letter.standalone ? ' · 整页打开' : ''}`),
            // letter.quote is one of the lines picked from the letter (letter.quotes), drawn anew on
            // every page load. Always read letter.quote: it is the same line everywhere on this page.
            letter.quote && h('q', {}, letter.quote)));
        // Warm the cache while the finger or the pointer is on its way down.
        link.addEventListener('pointerenter', () => router.prefetch(link.href));
        link.addEventListener('touchstart', () => router.prefetch(link.href), { passive: true });
        // A quiet letter (the miscarriage one) gets no playful motion around it.
        return h('li', { 'data-role': letter.role, 'data-no': letter.no, ...(letter.quiet && { 'data-quiet': '' }) }, link, playButton(letter));
      };
      // Newest first, so the newest letter is one tap away from the first screen. letters.years
      // also lists the years in which nobody wrote: say so in plain words (「这一年没有写信」 or
      // 「没有信」, never 「无信」, which also reads as "faithless").
      const rows = [...letters.years].reverse().flatMap(({ year, letters: ofYear }) => [
        h('li', { className: 'p-year' }, ofYear.length ? `${year} 年 · ${ofYear.length} 封` : `${year} 年 · 这一年没有写信`),
        ...[...ofYear].reverse().map(card),
      ]);
      // From the list a letter is opened with a new history entry (go() adds one here).
      const lucky = h('button', { type: 'button', className: 'p-lucky', onclick: () => router.go(letters[Math.floor(Math.random() * letters.length)].url) }, '随便读一封');
      return h('section', { className: 'p-home' }, lucky, h('ol', { className: 'p-list' }, rows));
    }

    /** Back on the list: mark the letter that was read last. The core has it in router.lastRead and,
     *  because show() leaves the scrolling to the core, also brings its link on screen. */
    function markLastRead(view) {
      const last = router.lastRead;
      view.querySelectorAll('li[data-no]').forEach((li) => li.classList.toggle('is-last-read', Boolean(last) && li.dataset.no === String(last.no)));
    }

    function letterView({ letter, contentEl }) {
      const { met, together, married } = letter.days;   // null = that day had not come yet
      const facts = [
        // time is null when the letter's real day is not the one in its address (「One Year」)
        `${fmt.date(letter.date)} ${fmt.date(letter.date, 'weekday')}${letter.time ? ' ' + letter.time : ''}`,
        fmt.season(letter.date),          // 春 夏 秋 冬 by the month; never an astronomical season
        letter.place,
        byline(letter),
        met != null && `认识第 ${met} 天`,
        together != null && `在一起第 ${together} 天`,
        married != null && `结婚第 ${married} 天`,
      ].filter(Boolean);
      // letter.days holds the letter's own number where it states one (「和小天使的三百天」 says 300).
      // Move the live node Jekyll rendered into our layout. Never clone it, never rebuild it from
      // HTML: the letter's own scripts have already run against this very node. The core has
      // already run ctx.prose.prepare() on it (figures, lyrics, sizes; see theme.css). The wrapper
      // is .letter-body, and nothing above it may have transform / filter / perspective.
      const body = h('div', { className: 'letter-body' }, contentEl);
      ctx.widgets.init(contentEl);                       // re-measure the flip card in its new width
      return h('article', { className: 'p-letter', 'data-role': letter.role, ...(letter.quiet && { 'data-quiet': '' }) },
        // data-back: if the reader came here from the list, this link is the Back button (they land
        // where they left the list, and no new history entry is made); otherwise it is a plain link.
        h('a', { className: 'p-back', href: '/', 'data-back': '' }, '← 所有的信'),
        // cover.own === false: a picture found online, not a photo of theirs. It is kept small.
        ctx.img(letter.cover, { sizes: '(max-width: 760px) 100vw, 720px', lazy: false, lqip: true, className: letter.cover && !letter.cover.own ? 'p-cover is-borrowed' : 'p-cover' }),
        h('h1', {}, letter.title),
        h('p', { className: 'p-facts' }, facts.join(' · ')),
        letter.quote && h('p', { className: 'p-quote' }, h('q', {}, letter.quote)),   // the line the list showed for it
        letter.song && h('p', { className: 'p-song' }, playButton(letter), h('span', {}, `${letter.song.title}${letter.song.artist ? ' — ' + letter.song.artist : ''}（${fmt.clock(letter.song.duration)}）`)),
        body,
        // Previous / next are ordinary links: from one letter to another the core replaces the
        // history entry instead of adding one, so Back from any letter leads to the list.
        // And a way back to the list at the END of the letter, not only at the top.
        h('nav', { className: 'p-near', 'aria-label': '前后的信' },
          letter.prev && h('a', { href: letter.prev.url, rel: 'prev' }, `← ${letter.prev.title}`),
          h('a', { className: 'p-home-link', href: '/', 'data-back': '' }, '回到所有的信'),
          letter.next && h('a', { href: letter.next.url, rel: 'next' }, `${letter.next.title} →`)));
    }

    const lostView = () => h('section', { className: 'p-lost' }, h('h1', {}, '这一页没有信'), h('p', {}, h('a', { href: '/' }, '回到所有的信')));

    // ---- one function draws any route; the router calls it again on every soft navigation ----
    let home = null;
    let first = true;
    function show(route) {
      const view = route.type === 'letter' ? letterView(route) : route.type === 'home' ? (home ||= homeView()) : lostView();
      if (route.type === 'home') markLastRead(view);
      main.replaceChildren(view);
      root.dataset.view = route.type;
      paint(player.state);                               // new buttons need the current state
      if (!first) main.focus({ preventScroll: true });   // keyboard and screen-reader users land in the new view
      first = false;
      // Returning nothing lets the core set the scroll position (top for a link, the old place for Back).
    }

    // Keys on a letter. Esc = "back to the list": router.home() is the Back button when the list is
    // the previous history entry, and a soft navigation to "/" otherwise. ← / → = the letter before
    // and after: go(url, { replace: true }) says out loud what the core does anyway between two
    // letters, it takes the place of the history entry instead of adding one.
    document.addEventListener('keydown', (event) => {
      const { type, letter } = router.current;
      if (type !== 'letter' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest && event.target.closest('input, textarea, select')) return;   // the seek bar uses the arrows itself
      if (event.key === 'Escape') router.home();
      else if (event.key === 'ArrowLeft' && letter.prev) router.go(letter.prev.url, { replace: true });
      else if (event.key === 'ArrowRight' && letter.next) router.go(letter.next.url, { replace: true });
    });

    show(router.current);       // the page we landed on: { type, letter, contentEl } just like a route
    return { show };
  },
};
