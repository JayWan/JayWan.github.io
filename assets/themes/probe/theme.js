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
    const byline = (letter) => ({ him: '他写的', her: '她写的' })[letter.role] || `${letter.author} 写的`;   // role: him | her | guest

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
      toggle: h('button', { type: 'button', className: 'p-play', 'aria-label': '播放 / 暂停', onclick: () => player.toggle() }),
    };
    bar.el.append(bar.toggle, bar.title, bar.seek, bar.time);

    const days = site.today.days;      // whole days since each date, counted the way the couple counts
    root.replaceChildren(
      h('header', { className: 'p-head' },
        h('a', { className: 'p-logo', href: '/' }, site.title),
        h('p', { className: 'p-days' }, `认识 ${fmt.days(days.met)} · 在一起 ${fmt.days(days.together)} · 结婚 ${fmt.days(days.married)}`)),
      main,
      h('footer', { className: 'p-foot' },
        h('p', { className: 'p-hunger' }, ui.hunger().text),   // the site's own voice; every theme shows it
        ui.switcher(),                                          // <nav class="theme-switcher">, styled in theme.css
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
      const items = [...letters].reverse().map((letter) => {
        const link = h('a', { className: 'p-card', href: letter.url },
          // Covers only through ctx.img(): derivatives, lazy, width/height, never the original file.
          ctx.img(letter.cover, { sizes: '96px', widths: [480], className: 'p-thumb' }),
          h('span', { className: 'p-card-text' },
            h('strong', {}, letter.title),
            h('small', {}, `No. ${letter.no} · ${fmt.date(letter.date, 'dot')} · ${byline(letter)}${letter.standalone ? ' · 整页打开' : ''}`),
            letter.quote && h('q', {}, letter.quote)));
        // Warm the cache while the finger or the pointer is on its way down.
        link.addEventListener('pointerenter', () => router.prefetch(link.href));
        link.addEventListener('touchstart', () => router.prefetch(link.href), { passive: true });
        // A quiet letter (the miscarriage one) gets no playful motion around it.
        return h('li', { 'data-role': letter.role, ...(letter.quiet && { 'data-quiet': '' }) }, link, playButton(letter));
      });
      const lucky = h('button', { type: 'button', className: 'p-lucky', onclick: () => router.go(letters[Math.floor(Math.random() * letters.length)].url) }, '随便读一封');
      return h('section', { className: 'p-home' }, lucky, h('ol', { className: 'p-list', reversed: true }, items));
    }

    function letterView({ letter, contentEl }) {
      const { met, together, married } = letter.days;   // null = that day had not come yet
      const facts = [
        `${fmt.date(letter.date)} ${fmt.date(letter.date, 'weekday')}`,
        letter.place,
        byline(letter),
        met != null && `认识第 ${met} 天`,
        together != null && `在一起第 ${together} 天`,
        married != null && `结婚第 ${married} 天`,
      ].filter(Boolean);
      // Move the live node Jekyll rendered into our layout. Never clone it, never rebuild it from
      // HTML: the letter's own scripts have already run against this very node. The wrapper is
      // .letter-body, and nothing above it may have transform / filter / perspective.
      const body = h('div', { className: 'letter-body' }, contentEl);
      ctx.widgets.init(contentEl);                       // re-measure the flip card in its new width
      return h('article', { className: 'p-letter', 'data-role': letter.role, ...(letter.quiet && { 'data-quiet': '' }) },
        h('a', { className: 'p-back', href: '/' }, '← 所有的信'),
        ctx.img(letter.cover, { sizes: '(max-width: 760px) 100vw, 720px', lazy: false, lqip: true, className: 'p-cover' }),
        h('h1', {}, letter.title),
        h('p', { className: 'p-facts' }, facts.join(' · ')),
        letter.song && h('p', { className: 'p-song' }, playButton(letter), h('span', {}, `${letter.song.title}${letter.song.artist ? ' — ' + letter.song.artist : ''}（${fmt.clock(letter.song.duration)}）`)),
        body,
        h('nav', { className: 'p-near', 'aria-label': '前后的信' },
          letter.prev && h('a', { href: letter.prev.url, rel: 'prev' }, `← ${letter.prev.title}`),
          letter.next && h('a', { href: letter.next.url, rel: 'next' }, `${letter.next.title} →`)));
    }

    const lostView = () => h('section', { className: 'p-lost' }, h('h1', {}, '这一页没有信'), h('p', {}, h('a', { href: '/' }, '回到所有的信')));

    // ---- one function draws any route; the router calls it again on every soft navigation ----
    let home = null;
    let first = true;
    function show(route) {
      const view = route.type === 'letter' ? letterView(route) : route.type === 'home' ? (home ||= homeView()) : lostView();
      main.replaceChildren(view);
      root.dataset.view = route.type;
      paint(player.state);                               // new buttons need the current state
      if (!first) main.focus({ preventScroll: true });   // keyboard and screen-reader users land in the new view
      first = false;
      // Returning nothing lets the core set the scroll position (top for a link, the old place for Back).
    }

    show(router.current);       // the page we landed on: { type, letter, contentEl } just like a route
    return { show };
  },
};
