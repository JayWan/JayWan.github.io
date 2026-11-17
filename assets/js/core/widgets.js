// The interactive pieces some letters carry in their own HTML.
//
//   .flip-card   (木婚快乐) front = text, back = a photo; a tap turns it over.
//                Under the classic theme the classic footer script does this; under a new theme
//                that script never runs, so the core activates the card here.
//   gift box     (29, 28, π) is driven by the letter's own inline <script>. That letter is
//                `standalone`, always reached by a full page load, so its script has already
//                run; the core only makes the box reachable from the keyboard.
//
// Structure and default looks: assets/themes/shared/widgets.css.

const cards = new WeakMap();   // .flip-card → function that re-measures it
const boxes = new WeakSet();   // gift boxes that already answer to the keyboard

/**
 * Activate every widget inside `root`. Safe to call again on the same content (for example
 * after moving it into another container): cards that are already active are only re-measured.
 */
export function init(root) {
  if (!root || !root.querySelectorAll) return;
  for (const card of root.querySelectorAll('.flip-card')) {
    if (cards.has(card)) cards.get(card)();
    else activate(card);
  }
  for (const box of root.querySelectorAll('#gift-container')) {
    if (boxes.has(box)) continue;
    boxes.add(box);
    box.tabIndex = 0;
    box.setAttribute('role', 'button');
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      box.click();               // runs the letter's own onclick="openGiftBox()"
    });
  }
}

function activate(card) {
  const inner = card.querySelector('.flip-card-inner');
  const front = card.querySelector('.flip-card-front');
  const back = card.querySelector('.flip-card-back');
  if (!inner || !front || !back) return;

  // Both faces are absolutely positioned on top of each other, so the card has no height of
  // its own: it borrows the height of whichever face is showing.
  const measure = () => {
    const flipped = card.classList.contains('is-flipped');
    const height = (flipped ? back : front).offsetHeight;
    if (height) inner.style.height = `${height}px`;
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
  };
  cards.set(card, measure);

  const flip = () => { card.classList.toggle('is-flipped'); measure(); };

  card.addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, audio, video')) return;      // let controls be controls
    if (String(window.getSelection && window.getSelection()) !== '') return; // the reader is selecting text
    flip();
  });
  // Reachable and operable without a pointer.
  if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
  card.addEventListener('keydown', (event) => {
    if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    flip();
  });

  // Fonts arriving, the photo loading, the window resizing, the theme moving the letter into
  // its own layout: anything that changes a face's height re-measures the card.
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(front);
    observer.observe(back);
  } else {
    window.addEventListener('resize', measure);
    back.querySelectorAll('img').forEach((image) => image.addEventListener('load', measure));
  }
  measure();
}
