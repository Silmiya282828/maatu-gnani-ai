import { config } from '../config.js';
import { LANGUAGES, isLanguage } from '../languages.js';
import { spendGnaniCall } from '../budget.js';
import { fixWavLengths } from '../wav.js';

// Docs: https://docs.gnani.ai/api/introduction/introduction.md
const BASE = 'https://api.vachana.ai';
const TIMEOUT_MS = 15000;

// Prisma speech-to-text. REST takes clips up to 30 s, which covers any chat
// voice note, so we don't need the streaming WebSocket version.
//
// v3.0 first: from some servers (it happened on Render) v2.5 answers 504, a
// timeout on Gnani's side, while v3.0 on the same endpoint still works, and
// v3.0's transcripts were cleaner too. A server error or timeout gets one
// more try on v2.5.
const STT_MODELS = ['prisma-v3.0', null]; // null: the endpoint's default, v2.5

// Returns { text, lang }. v3.0 hears which language was actually spoken, so a
// Kannada customer who switches to English still gets translated from English.
// v2.5 doesn't say, so we keep the language the person picked.
export async function transcribe(audio, lang) {
  for (const [i, model] of STT_MODELS.entries()) {
    const last = i === STT_MODELS.length - 1;
    try {
      return await transcribeWith(model, audio, lang);
    } catch (err) {
      if (last || !err.retry) throw err;
      console.warn(`[gnani] ${err.message}; trying ${STT_MODELS[i + 1] ?? 'v2.5'}`);
    }
  }
}

async function transcribeWith(model, audio, lang) {
  spendGnaniCall('prisma-stt');
  const form = new FormData();
  form.append('audio_file', new Blob([audio.buffer], { type: audio.mimetype }), audio.filename);
  form.append('language_code', lang);
  // "transcribe" turns spoken numbers into digits ("do minute" -> "2 minute"),
  // which the translator and the other person both handle more reliably.
  form.append('format', 'transcribe');
  if (model) form.append('model', model);

  // No Content-Type header on purpose: fetch sets the multipart boundary itself.
  let res;
  try {
    res = await fetch(`${BASE}/stt/v3`, {
      method: 'POST',
      headers: { 'X-API-Key-ID': config.gnaniApiKey },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw Object.assign(new Error(`Prisma STT (${model ?? 'v2.5'}) didn't answer: ${err.message}`), { retry: true });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success || typeof body.transcript !== 'string') {
    const err = new Error(`Prisma STT (${model ?? 'v2.5'}) failed (${res.status}): ${JSON.stringify(body.error ?? body)}`);
    throw Object.assign(err, { retry: res.status >= 500 });
  }
  return { text: body.transcript, lang: spokenLanguage(body.detected_language_code) ?? lang };
}

// "en-IN" or "en" -> "en-IN"; anything we don't support -> null.
function spokenLanguage(code) {
  if (typeof code !== 'string') return null;
  const full = code.includes('-') ? code : `${code}-IN`;
  return isLanguage(full) ? full : null;
}

// Timbre speech: returns the raw WAV bytes.
export async function speak(text, lang) {
  spendGnaniCall('timbre-tts');
  const res = await fetch(`${BASE}/api/v1/tts/inference`, {
    method: 'POST',
    headers: { 'X-API-Key-ID': config.gnaniApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model: config.ttsModel,
      voice: voiceFor(lang),
      language: lang,
      audio_config: { sample_rate: 24000, encoding: 'linear_pcm', container: 'wav' },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Timbre TTS failed (${res.status}): ${JSON.stringify(body.error ?? body)}`);
  }
  return fixWavLengths(Buffer.from(await res.arrayBuffer()));
}

// v2.5 voices each speak one language; v3.0 voices speak all ten.
export function voiceFor(lang) {
  return config.ttsModel === 'timbre-v3.0' ? config.ttsV3Voice : LANGUAGES[lang].voice;
}
