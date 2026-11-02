import { config } from '../config.js';

// Sarvam AI (Bengaluru), Mayura translation model. It covers all ten of our
// languages and takes the same codes we use ("kn-IN"), so nothing to map.
// Docs: https://docs.sarvam.ai/api-reference-docs/text/translate
const URL = 'https://api.sarvam.ai/translate';
const TIMEOUT_MS = 15000;

export async function translate(text, fromLang, toLang) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'api-subscription-key': config.sarvamApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: text,
      source_language_code: fromLang,
      target_language_code: toLang,
      model: 'mayura:v1',
      // Everyday spoken style, the way a customer and a driver really talk,
      // instead of the default formal one.
      mode: 'modern-colloquial',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  const out = body.translated_text?.trim();
  if (!res.ok || !out) {
    throw new Error(`Sarvam translation failed (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return out;
}
