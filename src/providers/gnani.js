import { config } from '../config.js';
import { LANGUAGES } from '../languages.js';
import { spendGnaniCall } from '../budget.js';
import { fixWavLengths } from '../wav.js';

// Docs: https://docs.gnani.ai/api/introduction/introduction.md
const BASE = 'https://api.vachana.ai';
const TIMEOUT_MS = 15000;

// Prisma v2.5 speech-to-text. REST takes clips up to 30 s, which covers any
// chat voice note, so we don't need the streaming WebSocket version.
export async function transcribe(audio, lang) {
  spendGnaniCall('prisma-stt');
  const form = new FormData();
  form.append('audio_file', new Blob([audio.buffer], { type: audio.mimetype }), audio.filename);
  form.append('language_code', lang);
  // "transcribe" turns spoken numbers into digits ("do minute" -> "2 minute"),
  // which the translator and the other person both handle more reliably.
  form.append('format', 'transcribe');

  // No Content-Type header on purpose: fetch sets the multipart boundary itself.
  const res = await fetch(`${BASE}/stt/v3`, {
    method: 'POST',
    headers: { 'X-API-Key-ID': config.gnaniApiKey },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success || typeof body.transcript !== 'string') {
    throw new Error(`Prisma STT failed (${res.status}): ${JSON.stringify(body.error ?? body)}`);
  }
  return body.transcript;
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
