// One <audio> for the whole site. It belongs to the core, not to a theme and not to a view,
// so a song keeps playing while the reader moves between the list and a letter.
//
// Rules
//   - nothing is requested before the reader presses play: preload="none", and the src is only
//     set inside toggle(), which a theme calls from a click
//   - play() is never called without a user gesture
//   - when a song ends, nothing else starts: one letter, one song

import { emitter } from './util.js';

const TIME_EVENT_MS = 250;   // 'time' fires at most 4 times per second

/**
 * createPlayer(letters, site) → player
 *
 *   player.state            { letter, playing, time, duration, loading, error }   read-only, always the same object
 *                             letter    the letter whose song is loaded, or null
 *                             time      seconds played
 *                             duration  seconds; from the file once it is known, before that from the data
 *                             loading   true between asking for sound and getting it (show a spinner or nothing)
 *                             error     null | 'blocked' (the browser refused to play) | 'failed' (file missing / unreadable)
 *   player.toggle(letter)   play this letter's song; if it is the loaded one: pause / resume.
 *                           Without an argument: pause / resume whatever is loaded.
 *   player.play() / pause() resume / pause the loaded song
 *   player.seek(seconds)
 *   player.next() / prev()  the next / previous letter that has a song, and play it
 *   player.on('change', fn) letter, playing, loading, error or duration changed.   fn(state)
 *   player.on('time', fn)   the position moved (throttled).                        fn(state)
 *                           on() returns a function that removes the listener.
 */
export function createPlayer(letters, site) {
  const audio = new Audio();
  audio.preload = 'none';
  const events = emitter();
  const state = { letter: null, playing: false, time: 0, duration: 0, loading: false, error: null };
  const changed = () => { syncSession(); events.emit('change', state); };

  let lastTime = 0;
  const ticked = (force) => {
    const now = Date.now();
    if (!force && now - lastTime < TIME_EVENT_MS) return;
    lastTime = now;
    events.emit('time', state);
  };

  function load(letter) {
    state.letter = letter;
    state.time = 0;
    state.duration = (letter.song && letter.song.duration) || 0;
    state.error = null;
    audio.src = letter.song.src;      // with preload="none" this fetches nothing yet
    describe(letter);
  }

  function start() {
    state.loading = true;
    state.error = null;
    changed();
    const promise = audio.play();     // must stay synchronous inside the click handler (iOS)
    if (promise) {
      promise.catch((err) => {
        if (err && err.name === 'AbortError') return;          // paused or switched before it began
        state.loading = false;
        state.playing = false;
        state.error = err && err.name === 'NotAllowedError' ? 'blocked' : 'failed';
        changed();
      });
    }
  }

  audio.addEventListener('playing', () => { state.playing = true; state.loading = false; changed(); });
  audio.addEventListener('pause', () => { state.playing = false; state.loading = false; changed(); });
  audio.addEventListener('waiting', () => { if (!audio.paused) { state.loading = true; changed(); } });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) { state.duration = audio.duration; changed(); }
  });
  audio.addEventListener('timeupdate', () => { state.time = audio.currentTime; ticked(false); });
  audio.addEventListener('seeked', () => { state.time = audio.currentTime; ticked(true); });
  audio.addEventListener('ended', () => {
    state.playing = false;
    state.time = 0;                   // the next play starts from the top; nothing else starts by itself
    ticked(true);
    changed();
  });
  audio.addEventListener('error', () => {
    if (!state.letter) return;
    state.playing = false;
    state.loading = false;
    state.error = 'failed';
    changed();
  });

  const withSong = (letter, step) => {
    for (let l = letter && letter[step]; l; l = l[step]) if (l.song) return l;
    return null;
  };

  const player = {
    state,
    toggle(letter = state.letter) {
      if (!letter || !letter.song) return;
      if (letter !== state.letter) { load(letter); start(); }
      else if (audio.paused) start();
      else audio.pause();
    },
    play() { if (state.letter && audio.paused) start(); },
    pause() { audio.pause(); },
    seek(seconds) {
      if (!state.letter) return;
      const max = state.duration || Infinity;
      const t = Math.min(Math.max(0, Number(seconds) || 0), max);
      try { audio.currentTime = t; } catch { /* not seekable yet */ }
      state.time = t;
      ticked(true);
    },
    next() { const l = withSong(state.letter, 'next'); if (l) player.toggle(l); },
    prev() { const l = withSong(state.letter, 'prev'); if (l) player.toggle(l); },
    on: events.on,
  };
  Object.defineProperty(player, 'audio', { value: audio });   // for debugging and tests; themes leave it alone

  // ---- Media Session: lock screen, headphones, the browser's own media controls ----
  const session = navigator.mediaSession;

  function describe(letter) {
    if (!session || !window.MediaMetadata) return;
    const cover = letter.cover;
    const artwork = [];
    if (cover) {
      const w = (cover.widths || []).find((x) => x >= 480);
      const src = cover.base && w ? `${cover.base}-${w}.jpg` : cover.orig;
      const size = w && cover.w ? `${w}x${Math.round((w * cover.h) / cover.w)}` : undefined;
      artwork.push({ src: new URL(src, location.href).href, ...(size && { sizes: size }), ...(cover.base && w && { type: 'image/jpeg' }) });
    }
    try {
      session.metadata = new MediaMetadata({ title: letter.song.title, artist: site.title, album: letter.title, artwork });
    } catch { /* a browser that dislikes the artwork still plays the song */ }
  }

  function syncSession() {
    if (!session) return;
    try {
      session.playbackState = !state.letter ? 'none' : state.playing ? 'playing' : 'paused';
      if (state.letter && state.duration > 0 && session.setPositionState) {
        session.setPositionState({ duration: state.duration, position: Math.min(state.time, state.duration), playbackRate: 1 });
      }
    } catch { /* ignore */ }
  }

  if (session) {
    const handle = (action, fn) => { try { session.setActionHandler(action, fn); } catch { /* unsupported action */ } };
    handle('play', () => player.play());
    handle('pause', () => player.pause());
    handle('previoustrack', () => player.prev());
    handle('nexttrack', () => player.next());
    handle('seekto', (d) => { if (d && typeof d.seekTime === 'number') player.seek(d.seekTime); });
  }

  return player;
}
