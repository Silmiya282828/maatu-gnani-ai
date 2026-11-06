import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { config, live, AUDIO_DIR, TTS_CACHE_DIR } from './config.js';
import { createLimiter } from './limiter.js';
import { LruCache } from './cache.js';
import * as gnani from './providers/gnani.js';
import * as gemini from './providers/gemini.js';
import * as bhashini from './providers/bhashini.js';
import * as sarvam from './providers/sarvam.js';
import * as mock from './providers/mock.js';
import { censor } from './profanity.js';

const stt = live.gnani ? gnani : mock;
const tts = live.gnani ? gnani : mock;
const translator = { sarvam, bhashini, gemini }[live.translate] ?? mock;

export const providers = {
  stt: live.gnani ? 'gnani-prisma' : 'mock',
  translate: { sarvam: 'sarvam-mayura', bhashini: 'bhashini', gemini: `gemini (${config.geminiModel})` }[live.translate] ?? 'mock',
  tts: live.gnani ? `gnani-${config.ttsModel}` : 'mock',
};

// One queue per outside service: each has its own rate limit.
const queues = {
  stt: createLimiter('stt', config.maxConcurrent, config.maxQueue),
  translate: createLimiter('translate', config.maxConcurrent, config.maxQueue),
  tts: createLimiter('tts', config.maxConcurrent, config.maxQueue),
};
export const queueStats = () => Object.values(queues).map((q) => q.stats());

const translations = new LruCache(5000);

await mkdir(AUDIO_DIR, { recursive: true });
await mkdir(TTS_CACHE_DIR, { recursive: true });

// The whole product in one function: a voice message in one language goes in,
// the same message comes out as text + speech in the other person's language.
//
// It never loses a message. Each step that fails is skipped and the receiver
// gets the best we have: translated speech, else translated text with the
// original voice, else just the original voice.
export async function translateVoiceMessage({ audio, fromLang, toLang }) {
  const id = randomUUID();
  const originalFile = `${id}-original${extensionOf(audio)}`;
  await writeFile(path.join(AUDIO_DIR, originalFile), audio.buffer);

  return deliver({
    id,
    kind: 'voice',
    fromLang,
    toLang,
    originalAudioUrl: `/v1/audio/${originalFile}`,
    getText: () => queues.stt(() => stt.transcribe(audio, fromLang)),
  });
}

// Typed messages and quick replies ("Are you coming?") skip speech-to-text but
// still arrive as speech, so a rider on a bike never has to read anything.
// Quick replies repeat a lot, so after the first time they come straight from
// the caches and cost nothing.
export async function translateTextMessage({ text, fromLang, toLang }) {
  return deliver({ id: randomUUID(), kind: 'text', fromLang, toLang, originalAudioUrl: null, getText: async () => text });
}

async function deliver({ id, kind, fromLang, toLang, originalAudioUrl, getText }) {
  const startedAt = performance.now();
  const timings = {};
  const cached = { translate: false, tts: false };

  const result = {
    id,
    kind,
    from_lang: fromLang,
    to_lang: toLang,
    original_text: null,
    translated_text: null,
    audio_url: originalAudioUrl,
    original_audio_url: originalAudioUrl,
    fallback: true,
    censored: false,
    error: null,
    cached,
    timings_ms: timings,
  };

  try {
    let text;
    if (kind === 'voice') {
      // Speech-to-text also says which language was spoken, which can differ
      // from the one the sender picked (a Kannada speaker sending English).
      const heard = await timed(timings, 'stt', getText);
      text = heard.text;
      result.from_lang = fromLang = heard.lang;
    } else {
      text = await getText();
    }

    // Curse words are starred in the text and never translated or spoken.
    const said = censor(text);
    result.original_text = said.shown;
    result.censored = said.hits > 0;

    let toSay;
    if (fromLang === toLang) {
      result.translated_text = said.shown;
      toSay = said.spoken;
    } else {
      const key = `${fromLang}|${toLang}|${said.spoken}`;
      const hit = translations.get(key);
      cached.translate = hit !== undefined;
      const translated =
        hit ??
        (said.spoken
          ? await timed(timings, 'translate', () =>
              queues.translate(() => translator.translate(said.spoken, fromLang, toLang)),
            )
          : '');
      translations.set(key, translated);
      // Checked again in case the translation brought one back.
      const heard = censor(translated);
      result.translated_text = heard.shown || said.shown;
      result.censored ||= heard.hits > 0;
      toSay = heard.spoken;
    }

    // Same language on both sides: their own voice is better than a synthetic
    // one, unless it has a curse word in it. Text has no voice of its own, so
    // it always gets spoken. Nothing left to say means no sound at all.
    if (fromLang !== toLang || !originalAudioUrl || result.censored) {
      if (toSay) {
        const speech = await timed(timings, 'tts', () => speakCached(toSay, toLang, cached));
        result.audio_url = `/v1/audio/${speech}`;
      } else {
        result.audio_url = null;
      }
    }
    result.fallback = false;
  } catch (err) {
    result.error = err.message;
    // Never fall back to a voice note we know has a curse word in it.
    if (result.censored) result.audio_url = null;
    console.warn(`[pipeline] ${id} fell back: ${err.message}`);
  }

  timings.total = Math.round(performance.now() - startedAt);
  return result;
}

// Speech is cached on disk by a hash of (model, language, text), so a phrase
// is only ever paid for once, even across restarts.
async function speakCached(text, lang, cached) {
  const hash = createHash('sha1').update(`${providers.tts}|${lang}|${text}`).digest('hex');
  const file = `${hash}.wav`;
  const filePath = path.join(TTS_CACHE_DIR, file);
  try {
    await access(filePath);
    cached.tts = true;
    return file;
  } catch {
    const wav = await queues.tts(() => tts.speak(text, lang));
    await writeFile(filePath, wav);
    return file;
  }
}

async function timed(timings, step, fn) {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    timings[step] = Math.round(performance.now() - t0);
  }
}

const EXTENSIONS = { 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/aac': '.aac', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a' };

function extensionOf(audio) {
  const fromName = path.extname(audio.filename || '').toLowerCase();
  if (/^\.(wav|mp3|ogg|flac|aac|m4a)$/.test(fromName)) return fromName;
  return EXTENSIONS[audio.mimetype] ?? '.wav';
}
