# Maatu, powered by Gnani

*Maatu (ಮಾತು) is Kannada for "talk". In Telugu it's maata (మాట). Same word, two languages.*

A ride-app customer speaks Kannada and the rider speaks Telugu. They send each other voice messages, and each message arrives **as speech and text in the listener's own language**. Riders hear the message instead of reading it while riding.

This is a **service other companies plug into their apps**, not an app of its own. A ride or delivery app keeps its own chat and calls one endpoint. The two phones in the demo stand in for that app.

Built for the Great Indian AI Internship Challenge on **Gnani Prisma v2.5** (speech → text) and **Gnani Timbre v2.5** (text → speech).

## Run it

```bash
npm install
npm run dev        # mock mode: free, no keys needed
```

Then open http://localhost:4620.

Live mode makes real API calls and **spends credits**:

```bash
cp .env.example .env   # then add GNANI_API_KEY (and GEMINI_API_KEY for translation)
npm run live
```

Each service goes live only when its key is set, so you can test Gnani before you have a translation key. `MAX_LIVE_CALLS` (default 40) caps the number of paid Gnani calls per run.

## The API

```
POST /v1/voice-messages
x-api-key: <client key>
multipart: audio (wav/mp3/ogg/flac/aac/m4a, ≤ 60 s), from_lang, to_lang
```

```json
{
  "original_text": "ನಾನು ಗೇಟ್ ನಂಬರ್ 2 ಹತ್ತಿರ ನಿಂತಿದ್ದೀನಿ",
  "translated_text": "నేను గేట్ నంబర్ 2 దగ్గర నిలబడి ఉన్నాను",
  "audio_url": "/v1/audio/<hash>.wav",
  "fallback": false,
  "cached": { "translate": false, "tts": false },
  "timings_ms": { "stt": 212, "translate": 380, "tts": 301, "total": 897 }
}
```

Typed messages and quick chats ("Are you coming?") skip speech-to-text but still arrive as speech:

```
POST /v1/text-messages
x-api-key: <client key>
JSON: { "text": "Are you coming?", "from_lang": "en-IN", "to_lang": "te-IN" }
```

Language codes: `hi-IN kn-IN te-IN ta-IN ml-IN mr-IN bn-IN gu-IN pa-IN en-IN` (`GET /v1/languages`).

## How a message flows

```
voice note ─► Prisma (speech → text) ─► translate ─► Timbre (text → speech) ─► listener
                  │                         │                │
               queue                  queue + cache     queue + disk cache
```

## Built for scale

| Decision | Why |
|---|---|
| **Stateless endpoint** | No memory between requests, so you can run 10 copies behind a load balancer when traffic grows. |
| **A queue per outside service** (`src/limiter.js`) | Spikes wait in line instead of flooding Gnani with requests and hitting rate limits. When the line is too long, new work is refused early. |
| **Phrase cache** (`src/cache.js`, disk cache for speech) | "2 minutes" or "I'm at the gate" gets translated and spoken once, then reused instantly and for free. |
| **Never lose a message** (`src/pipeline.js`) | If a step fails, the listener still gets the best version available: translated text with the original voice, or just the original voice. |
| **Load test** (`npm run loadtest`) | Measures throughput and latency against mock providers that take as long as the real APIs. Refuses to run in live mode. |

In production you'd also move audio to object storage (S3 or similar), share the cache across instances (Redis), and delete audio after the ride for privacy (DPDP Act).

## Files

```
src/server.js         API routes + the demo chat relay
src/pipeline.js       speech → text → translation → speech, with fallbacks
src/providers/        gnani.js (Prisma, Timbre), gemini.js (translation), mock.js
src/limiter.js        per-service queue
src/cache.js          LRU cache
public/index.html     two-phone demo stage + live pipeline timings
public/phone.html     one phone (open /phone.html?role=rider&lang=te-IN on a real phone)
public/recorder.js    mic → 16 kHz WAV in the browser
scripts/loadtest.js   load test (mock mode only)
```
