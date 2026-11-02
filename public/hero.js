// The hero: one person at a time, standing in front of "hello" written huge
// in their own script. The page itself never changes; only the person does.
//
// Everything changes in place, as if it were one person: the people fade
// into each other and the word melts from one script into the next. They
// take turns on a timer, on every screen, whatever the visitor does.
//
// Each person's picture lives at /people/<key>.webp, background cut out.
// If one is missing, a placeholder frame stands in with the person's role.

const PEOPLE = [
  { key: 'customer', name: 'Priya', role: 'Customer', lang: 'Kannada', hello: 'ನಮಸ್ಕಾರ', font: 'Noto Sans Kannada' },
  { key: 'auto-driver', name: 'Ravi', role: 'Auto driver', lang: 'Telugu', hello: 'నమస్కారం', font: 'Noto Sans Telugu' },
  { key: 'delivery', name: 'Arjun', role: 'Delivery boy', lang: 'Hindi', hello: 'नमस्ते', font: 'Noto Sans Devanagari' },
  { key: 'student', name: 'Meena', role: 'Student', lang: 'Tamil', hello: 'வணக்கம்', font: 'Noto Sans Tamil' },
  { key: 'elder', name: 'Gopal', role: 'Elder', lang: 'Bengali', hello: 'নমস্কার', font: 'Noto Sans Bengali' },
];
const n = PEOPLE.length;

const SHOW_MS = 1000; // how long each person stays
const MORPH_MS = 500; // how long the word takes to melt into the next

const visual = document.getElementById('heroVisual');
const giant = document.getElementById('giant');
const person = document.getElementById('person');

const wide = matchMedia('(min-width: 1101px)');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let shown = -1; // who is showing

// ---- The people -------------------------------------------------------------------
// All five stand in the same spot; the one showing has .on, and the CSS fades
// between them.

function placeholder(p) {
  const frame = document.createElement('span');
  frame.className = 'placeholder';
  frame.innerHTML = `<b>${p.role}</b><small>picture goes here</small>`;
  return frame;
}
const figures = PEOPLE.map((p, i) => {
  const img = new Image();
  img.alt = '';
  img.src = `/people/${p.key}.webp`;
  img.className = 'figure';
  img.onerror = () => {
    const frame = placeholder(p);
    frame.classList.add('figure');
    frame.classList.toggle('on', i === shown);
    img.replaceWith(frame);
    figures[i] = frame;
  };
  person.append(img);
  return img;
});

// ---- The giant word ---------------------------------------------------------------
// The old word blurs away while the new one sharpens out of it, on top of each
// other; a threshold filter on the pair (see #melt in index.html) turns the
// two blurs into one shape that flows from one script into the next.

let word = null; // the word showing, or arriving

function fit(el) {
  el.style.fontSize = '';
  // On wide screens it stays a little wider than the person.
  const room = wide.matches ? Math.min(visual.clientWidth * 0.32, 504) : visual.clientWidth;
  const natural = el.offsetWidth;
  if (natural > room) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${Math.floor(size * (room / natural))}px`;
  }
}

// f goes from 0 (not there) to 1 (fully there).
const melt = (arriving) => Array.from({ length: 11 }, (_, k) => {
  const f = arriving ? k / 10 : 1 - k / 10;
  return { filter: `blur(${Math.min(8 / f - 8, 100)}px)`, opacity: f ** 0.4 };
});

function morph(p, instant) {
  const next = document.createElement('span');
  next.className = 'word';
  next.style.fontFamily = `'${p.font}', 'Noto Sans', sans-serif`;
  next.textContent = p.hello;
  giant.append(next);
  fit(next);
  const old = word;
  word = next;
  // A word still on its way out from an earlier change just goes.
  for (const el of [...giant.children]) if (el !== old && el !== next) el.remove();
  if (!old || instant || still) {
    old?.remove();
    return;
  }
  old.getAnimations().forEach((a) => a.cancel());
  giant.classList.add('morphing');
  const timing = { duration: MORPH_MS, easing: 'ease-in-out', fill: 'forwards' };
  next.animate(melt(true), timing);
  old.animate(melt(false), timing).finished.then(() => {
    old.remove();
    if (giant.children.length === 1) giant.classList.remove('morphing');
  });
}

// ---- Bringing someone in ----------------------------------------------------------

function show(i) {
  if (i === shown) return;
  const p = PEOPLE[i];
  figures.forEach((el, k) => el.classList.toggle('on', k === i));
  morph(p, shown === -1);
  visual.setAttribute('aria-label', `${p.name}, ${p.role.toLowerCase()}, hears every message in ${p.lang}.`);
  shown = i;
}

// ---- Taking turns ----------------------------------------------------------------

(async function loop() {
  await document.fonts.ready;
  show(0);
  for (;;) {
    await wait(SHOW_MS);
    show((shown + 1) % n);
  }
})();

addEventListener('resize', () => word && fit(word));
