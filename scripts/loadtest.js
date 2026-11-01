// Fires many voice messages at the API at once and reports throughput and
// latency, to show how the service behaves under ride-app traffic.
//
// It refuses to run against a server in live mode, so it can never spend
// Gnani credits. Mock providers take about as long as the real APIs.
//
//   npm run loadtest -- --total 500 --concurrency 50
import { silence } from '../src/wav.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const url = args.url ?? 'http://localhost:4620';
const total = Number(args.total ?? 300);
const concurrency = Number(args.concurrency ?? 30);
const key = args.key ?? process.env.CLIENT_API_KEY ?? 'demo-key';

const health = await fetch(`${url}/health`).then((r) => r.json());
if (health.providers.stt !== 'mock' || health.providers.tts !== 'mock') {
  console.error('Server is in live mode. Load test refused so no credits are spent. Restart with "npm run dev".');
  process.exit(1);
}

const audio = new Blob([silence(2)], { type: 'audio/wav' });
const pairs = [['kn-IN', 'te-IN'], ['te-IN', 'kn-IN'], ['hi-IN', 'ta-IN'], ['ta-IN', 'hi-IN']];
const latencies = [];
let sent = 0;
let fallbacks = 0;
let cacheHits = 0;
let errors = 0;

async function worker() {
  while (sent < total) {
    const [from, to] = pairs[sent++ % pairs.length];
    const form = new FormData();
    form.append('audio', audio, 'load.wav');
    form.append('from_lang', from);
    form.append('to_lang', to);
    const t0 = performance.now();
    try {
      const res = await fetch(`${url}/v1/voice-messages`, { method: 'POST', headers: { 'x-api-key': key }, body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      latencies.push(performance.now() - t0);
      if (body.fallback) fallbacks++;
      if (body.cached.tts) cacheHits++;
    } catch {
      errors++;
    }
  }
}

console.log(`Sending ${total} voice messages, ${concurrency} at a time, to ${url} …`);
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const seconds = (performance.now() - started) / 1000;

latencies.sort((a, b) => a - b);
const pct = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] ?? 0);
const perSecond = latencies.length / seconds;

console.table({
  'messages delivered': latencies.length,
  'errors': errors,
  'delivered untranslated (fallback)': fallbacks,
  'speech served from cache': cacheHits,
  'throughput (msg/s)': Number(perSecond.toFixed(1)),
  'p50 latency (ms)': pct(50),
  'p95 latency (ms)': pct(95),
  'max latency (ms)': Math.round(latencies.at(-1) ?? 0),
});
console.log(`At this rate one server instance handles ~${Math.round(perSecond * 86400).toLocaleString('en-IN')} messages a day.`);
