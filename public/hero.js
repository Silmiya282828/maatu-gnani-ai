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

// Each script's font has letters of a different height and sits at a different
// height in its line, so at one font size the words jump up and down. Instead
// every word gets its own size, so all their letters are the same height, and
// is nudged so the top of its first letter lands on the same line.
const ink = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
let sizes = []; // per person: { size, top } in px, top = letter top above the baseline
let headLine = 0; // where every letter top lands, in px below the top of .giant

// The top and bottom of a word's first letter, in em above the baseline, and
// the word's width in em. Found by drawing the letter and taking the first and
// last rows that are mostly ink, so a thin mark on top (Kannada's tick, a
// Hindi vowel sign) sticks out above the line instead of counting as the top.
function shape(p) {
  const px = 200;
  ink.canvas.width = ink.canvas.height = px * 2; // also clears it
  ink.font = `700 ${px}px '${p.font}'`;
  ink.fillText(p.hello[0], 0, px * 1.5);
  const span = ink.measureText(p.hello[0]).width * 0.35;
  const { width, height, data } = ink.getImageData(0, 0, px * 2, px * 2);
  const rows = [];
  for (let y = 0; y < height; y++) {
    let filled = 0;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 128) filled++;
    if (filled > span) rows.push(y);
  }
  return {
    top: (px * 1.5 - rows[0]) / px,
    bottom: (px * 1.5 - rows.at(-1)) / px,
    width: ink.measureText(p.hello).width / px,
  };
}

function measure() {
  const base = parseFloat(getComputedStyle(giant).fontSize);
  // On wide screens it stays a little wider than the person.
  const room = wide.matches ? Math.min(visual.clientWidth * 0.387, 609) : visual.clientWidth;
  const m = PEOPLE.map(shape);
  const tall = (x) => x.top - x.bottom;
  // The usual letter height, unless the widest word would then not fit.
  const height = Math.min((base * m.reduce((sum, x) => sum + tall(x), 0)) / n, ...m.map((x) => (room * tall(x)) / x.width));
  sizes = m.map((x) => ({ size: height / tall(x), top: (x.top * height) / tall(x) }));
  headLine = base * 0.3;
}

function place(el, i) {
  el.style.fontSize = `${sizes[i].size}px`;
  // A zero-size box sitting on the text's baseline shows where the baseline is.
  const mark = document.createElement('i');
  mark.className = 'baseline';
  el.append(mark);
  const baseline = mark.getBoundingClientRect().bottom - giant.getBoundingClientRect().top;
  mark.remove();
  const current = parseFloat(el.style.translate.split(' ')[1]) || 0;
  el.style.translate = `0 ${Math.round(headLine - (baseline - current - sizes[i].top))}px`;
}

// f goes from 0 (not there) to 1 (fully there).
const melt = (arriving) => Array.from({ length: 11 }, (_, k) => {
  const f = arriving ? k / 10 : 1 - k / 10;
  return { filter: `blur(${Math.min(8 / f - 8, 100)}px)`, opacity: f ** 0.4 };
});

function morph(i, instant) {
  const p = PEOPLE[i];
  const next = document.createElement('span');
  next.className = 'word';
  next.style.fontFamily = `'${p.font}', 'Noto Sans', sans-serif`;
  next.textContent = p.hello;
  giant.append(next);
  place(next, i);
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
  morph(i, shown === -1);
  visual.setAttribute('aria-label', `${p.name}, ${p.role.toLowerCase()}, hears every message in ${p.lang}.`);
  shown = i;
}

// ---- Taking turns ----------------------------------------------------------------

(async function loop() {
  // A script's font only downloads once something uses it, so ask for all five
  // before measuring them.
  await document.fonts.ready;
  await Promise.all(PEOPLE.map((p) => document.fonts.load(`700 100px '${p.font}'`, p.hello)));
  measure();
  show(0);
  for (;;) {
    await wait(SHOW_MS);
    show((shown + 1) % n);
  }
})();

function refit() {
  if (!word) return;
  measure();
  place(word, shown);
}
addEventListener('resize', refit);
// If a font arrives after the first measuring, measure again with it.
document.fonts.addEventListener('loadingdone', refit);
