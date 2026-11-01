// The hero: words typing themselves out, to show two people talking through
// Maatu without any pictures. Three ideas, picked with ?hero= (temporary):
//   pair  Priya's Kannada line stays; under it a driver hears it in their
//         language, and the driver changes each time.
//   chat  A real exchange: Priya speaks, Ravi hears; Ravi replies, Priya hears.
//   line  One line, with "Priya says it in Kannada → Ravi hears it in Telugu".

// "I'm waiting at the pickup point." and "I'll be there in 2 minutes." (the
// same sentences as src/providers/mock.js).
const PRIYA = { name: 'Priya', lang: 'Kannada', text: 'ನಾನು ಪಿಕಪ್ ಪಾಯಿಂಟ್‌ನಲ್ಲಿ ಕಾಯ್ತಿದ್ದೀನಿ.' };
const DRIVERS = [
  ['Ravi', 'Telugu', 'నేను పికప్ పాయింట్ దగ్గర వెయిట్ చేస్తున్నాను.'],
  ['Arjun', 'Hindi', 'मैं पिकअप पॉइंट पर इंतज़ार कर रही हूँ।'],
  ['Karthik', 'Tamil', 'நான் பிக்கப் பாயிண்ட்ல வெயிட் பண்றேன்.'],
  ['Anoop', 'Malayalam', 'ഞാൻ പിക്കപ്പ് പോയിന്റിൽ കാത്തുനിൽക്കുകയാണ്.'],
  ['Sourav', 'Bengali', 'আমি পিকআপ পয়েন্টে অপেক্ষা করছি।'],
];
const REPLY = { te: 'నేను 2 నిమిషాల్లో వస్తాను.', kn: 'ನಾನು 2 ನಿಮಿಷದಲ್ಲಿ ಬರ್ತೀನಿ.' };

const TYPE_MS = 50;
const DELETE_MS = 20;
const HOLD_MS = 2200;

const visual = document.getElementById('heroVisual');
const mode = new URLSearchParams(location.search).get('hero') || 'pair';
visual.dataset.mode = mode;
for (const link of document.querySelectorAll('.variant-switch a')) {
  link.classList.toggle('on', link.getAttribute('href') === `?hero=${mode}`);
}

// Indian scripts join several code points into one letter (a consonant plus
// its vowel sign), so type whole letters, never half of one.
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const letters = (s) => [...segmenter.segment(s)].map((part) => part.segment);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// One blinking cursor, moved to whichever line is being typed.
const caret = document.createElement('i');
caret.className = 'caret';

async function typeInto(el, sentence) {
  el.after(caret);
  if (still) { el.textContent = sentence; return; }
  const parts = letters(sentence);
  for (let i = 1; i <= parts.length; i++) {
    el.textContent = parts.slice(0, i).join('');
    await wait(TYPE_MS);
  }
}

async function erase(el) {
  el.after(caret);
  if (still) { el.textContent = ''; return; }
  const parts = letters(el.textContent);
  for (let i = parts.length - 1; i >= 0; i--) {
    el.textContent = parts.slice(0, i).join('');
    await wait(DELETE_MS);
  }
}

const $ = (selector) => visual.querySelector(selector);

// ---- A: says / hears ------------------------------------------------------------

async function pair() {
  visual.innerHTML = `
    <div class="say">
      <p class="who">${PRIYA.name} says · ${PRIYA.lang}</p>
      <p class="line said">${PRIYA.text}</p>
    </div>
    <div class="say">
      <p class="who"><span data-name></span> hears · <b data-lang></b></p>
      <p class="line"><span data-text></span></p>
    </div>`;
  const name = $('[data-name]');
  const lang = $('[data-lang]');
  const text = $('[data-text]');
  for (let i = 0; ; i = (i + 1) % DRIVERS.length) {
    [name.textContent, lang.textContent] = DRIVERS[i];
    await typeInto(text, DRIVERS[i][2]);
    await wait(HOLD_MS);
    await erase(text);
    await wait(250);
  }
}

// ---- B: a back-and-forth chat ----------------------------------------------------

async function chat() {
  visual.innerHTML = `
    <div class="msg">
      <p class="who">Priya · Kannada</p>
      <p class="line"><span data-t="0"></span></p>
      <p class="heard"><span class="who">Ravi hears, in Telugu</span><span data-t="1"></span></p>
    </div>
    <div class="msg right">
      <p class="who">Ravi · Telugu</p>
      <p class="line"><span data-t="2"></span></p>
      <p class="heard"><span class="who">Priya hears, in Kannada</span><span data-t="3"></span></p>
    </div>`;
  const parts = [0, 1, 2, 3].map((n) => $(`[data-t="${n}"]`));
  const sentences = [PRIYA.text, DRIVERS[0][2], REPLY.te, REPLY.kn];
  const rows = visual.querySelectorAll('.line, .heard');
  for (;;) {
    for (let n = 0; n < 4; n++) {
      rows[n].classList.add('shown');
      rows[n].closest('.msg').classList.add('shown');
      await typeInto(parts[n], sentences[n]);
      await wait(n % 2 ? 1400 : 600);
    }
    await wait(HOLD_MS);
    for (const part of parts) part.textContent = '';
    for (const row of visual.querySelectorAll('.shown')) row.classList.remove('shown');
    await wait(500);
  }
}

// ---- C: one line, naming both people ---------------------------------------------

async function line() {
  visual.innerHTML = `
    <p class="who big">${PRIYA.name} says it in ${PRIYA.lang}<br>→ <span data-name></span> hears it in <b data-lang></b></p>
    <p class="line typed"><span data-text></span></p>`;
  const name = $('[data-name]');
  const lang = $('[data-lang]');
  const text = $('[data-text]');
  for (let i = 0; ; i = (i + 1) % DRIVERS.length) {
    [name.textContent, lang.textContent] = DRIVERS[i];
    await typeInto(text, DRIVERS[i][2]);
    await wait(HOLD_MS);
    await erase(text);
    await wait(250);
  }
}

({ pair, chat, line }[mode] ?? pair)();
