import { fileURLToPath } from 'node:url';
import path from 'node:path';

const env = process.env;

// Live mode has to be switched on explicitly (npm run live), so a normal
// restart while building never spends Gnani credits.
const LIVE = process.argv.includes('--live');

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const AUDIO_DIR = path.join(ROOT, 'data', 'audio');
export const TTS_CACHE_DIR = path.join(ROOT, 'data', 'tts-cache');

export const config = {
  port: Number(env.PORT) || 4620,
  clientApiKey: env.CLIENT_API_KEY || 'demo-key',
  gnaniApiKey: env.GNANI_API_KEY || '',
  geminiApiKey: env.GEMINI_API_KEY || '',
  geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
  ttsModel: env.TTS_MODEL || 'timbre-v2.5',
  ttsV3Voice: env.TTS_V3_VOICE || 'Avinash',
  maxConcurrent: Number(env.MAX_CONCURRENT) || 8,
  maxQueue: Number(env.MAX_QUEUE) || 200,
  maxLiveCalls: Number(env.MAX_LIVE_CALLS) || 40,
};

// Each service goes live only if live mode is on AND its key is present,
// so Gnani can be tested before a translation key exists.
export const live = {
  gnani: LIVE && Boolean(config.gnaniApiKey),
  translate: LIVE && Boolean(config.geminiApiKey),
};
