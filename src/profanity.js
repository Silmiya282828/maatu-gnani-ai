// Curse words never reach the other person.
//
// What they read shows the word as "f***" (or "***" in Indian scripts), so it's
// clear something was said. What they hear leaves it out entirely: Timbre
// is never asked to say it, and a message that was only curse words arrives
// with no sound at all.
//
// It's a plain word list, checked one word at a time. A list can't catch
// everything (new spellings, words split by spaces), but it never blocks a
// whole message by mistake, which matters more when someone is trying to
// find their ride.

// A word matches if it STARTS with one of these, so "fucking" and
// "ಸೂಳೆಮಗ" are caught by "fuck" and "ಸೂಳೆ".
const STEMS = [
  // English
  'fuck', 'motherfuck', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'cunt', 'whore', 'slut',
  'wank', 'twat', 'dickhead', 'pussy', 'fagg', 'retard',
  // Hindi / Hinglish, in Latin letters and Devanagari
  'chutiy', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'benchod', 'bhosd', 'gandu', 'gaandu',
  'haramkhor', 'bhadw', 'zavady', 'zhavady',
  'चूतिय', 'चुतिय', 'मादरचोद', 'बहनचोद','भेनचोद', 'भोसड़', 'भोसड', 'गांडू', 'गान्डू', 'रंडी',
  'हरामी', 'हरामखोर', 'भड़व', 'भडव', 'झवाड',
  // Kannada
  'ಸೂಳೆ', 'ಬೋಳಿಮಗ', 'ತುಣ್ಣೆ', 'ಗಾಂಡು', 'soolemag', 'sulemag', 'bolimag',
  // Telugu
  'లంజ', 'దెంగ', 'మొడ్డ', 'పూకు', 'lanja', 'dengu', 'modda',
  // Tamil
  'ஓத்த', 'தேவடியா', 'தேவிடியா', 'புண்டை', 'கூதி', 'சுன்னி', 'thevidiy', 'thevdiy', 'koothi', 'pundai',
  // Malayalam
  'മൈര', 'കുണ്ണ', 'പൂറ',
  // Bengali
  'খানকি', 'বোকাচোদ', 'বাঞ্চোদ', 'khanki', 'bokachod', 'banchod',
  // Gujarati
  'ભોસડ',
];

// These only match as the whole word, because as a start they'd catch
// innocent words ("cock" → "cockroach", "dick" → "dickens").
const WORDS = new Set([
  'ass', 'arse', 'dick', 'cock', 'prick', 'nigger', 'niggers', 'nigga', 'niggas',
  'lund', 'lauda', 'lavda', 'loda', 'lodu', 'gaand', 'randi', 'harami', 'bsdk', 'bkl', 'mkc',
  'लंड', 'लौड़ा', 'लौडा', 'गांड', 'soole', 'sule', 'tunne', 'myre', 'mairu', 'myru',
]);

// A word is a run of letters, combining marks (the vowel signs of Indian
// scripts) and digits. Everything else (spaces, punctuation) stays as it is.
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

function isCurse(word) {
  const w = word.toLowerCase();
  return WORDS.has(w) || STEMS.some((stem) => w.startsWith(stem));
}

// Returns what to show, what to say out loud, and how many words were caught.
export function censor(text) {
  if (!text) return { shown: text, spoken: text, hits: 0 };
  let hits = 0;
  const shown = text.normalize('NFC').replace(WORD, (word) => {
    if (!isCurse(word)) return word;
    hits++;
    return /^[a-z]/i.test(word) ? `${word[0]}***` : '***';
  });
  if (!hits) return { shown: text, spoken: text, hits };
  // Drop the starred words from speech, then tidy the gaps they leave.
  const spoken = shown
    .replace(/\p{L}?\*\*\*/gu, '')
    .replace(/\s+([,.!?।])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.!?।]+/, '')
    .trim();
  return { shown, spoken, hits };
}
