import { config } from '../config.js';

// Bhashini, the Government of India's language platform (models from AI4Bharat
// and IITs). Docs: https://dibd-bhashini.gitbook.io/bhashini-apis
//
// It takes two calls. First a "config" call asks which model serves a language
// pair and returns where to send the work plus a key for it. Then the
// "compute" call does the translation. The config answer is kept per language
// pair, so each message normally costs one call.
const CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const TIMEOUT_MS = 15000;
const CONFIG_TTL_MS = 60 * 60 * 1000; // ask again after an hour, in case keys rotate

// Bhashini uses plain language codes: "kn", not "kn-IN".
const short = (lang) => lang.split('-')[0];

const pipelines = new Map(); // "kn>te" -> { url, keyName, keyValue, serviceId, at }

async function pipelineFor(source, target) {
  const pair = `${source}>${target}`;
  const saved = pipelines.get(pair);
  if (saved && Date.now() - saved.at < CONFIG_TTL_MS) return saved;

  const res = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      userID: config.bhashiniUserId,
      ulcaApiKey: config.bhashiniApiKey,
    },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: source, targetLanguage: target } } }],
      pipelineRequestConfig: { pipelineId: config.bhashiniPipelineId },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  const endpoint = body.pipelineInferenceAPIEndPoint;
  const serviceId = body.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  if (!res.ok || !endpoint?.callbackUrl || !serviceId) {
    throw new Error(`Bhashini config failed (${res.status}): ${JSON.stringify(body.message ?? body)}`);
  }
  const found = {
    url: endpoint.callbackUrl,
    keyName: endpoint.inferenceApiKey.name,
    keyValue: endpoint.inferenceApiKey.value,
    serviceId,
    at: Date.now(),
  };
  pipelines.set(pair, found);
  return found;
}

export async function translate(text, fromLang, toLang) {
  const source = short(fromLang);
  const target = short(toLang);
  const pipeline = await pipelineFor(source, target);

  const res = await fetch(pipeline.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [pipeline.keyName]: pipeline.keyValue },
    body: JSON.stringify({
      pipelineTasks: [{
        taskType: 'translation',
        config: { language: { sourceLanguage: source, targetLanguage: target }, serviceId: pipeline.serviceId },
      }],
      inputData: { input: [{ source: text }] },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  const out = body.pipelineResponse?.[0]?.output?.[0]?.target?.trim();
  if (!res.ok || !out) {
    // A stale key: forget it so the next message asks for a fresh one.
    if (res.status === 401 || res.status === 403) pipelines.delete(`${source}>${target}`);
    throw new Error(`Bhashini translation failed (${res.status}): ${JSON.stringify(body.detail ?? body.message ?? body)}`);
  }
  return out;
}
