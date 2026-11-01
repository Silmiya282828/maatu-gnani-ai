import { config } from '../config.js';
import { LANGUAGES } from '../languages.js';

// Gnani has no hosted translation model yet (Evon is weights-only), so this
// step is swappable: anything that exports translate(text, from, to) works,
// e.g. a self-hosted Evon or Bhashini later.
export async function translate(text, fromLang, toLang) {
  const from = LANGUAGES[fromLang].name;
  const to = LANGUAGES[toLang].name;
  const prompt = [
    `You translate short voice messages between a ride-app customer and their driver in India.`,
    `Translate this message from ${from} to ${to}.`,
    `Rules:`,
    `- Reply with the translation only.`,
    `- Keep it natural and spoken, the way people really talk, not formal.`,
    `- Keep names, shop names, landmarks, numbers and vehicle numbers, but write them in ${to} script so they can be read aloud.`,
    `- Everyday English words people actually use (gate, signal, metro, OK) can stay as they are.`,
    ``,
    `Message: """${text}"""`,
  ].join('\n');

  const generationConfig = { temperature: 0 };
  // 2.5 models "think" before answering by default; a one-line translation
  // doesn't need it and it adds latency.
  if (config.geminiModel.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': config.geminiApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const body = await res.json().catch(() => ({}));
  const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!res.ok || !out) {
    throw new Error(`Translation failed (${res.status}): ${body.error?.message ?? 'empty response'}`);
  }
  return out.replace(/^"+|"+$/g, '');
}
