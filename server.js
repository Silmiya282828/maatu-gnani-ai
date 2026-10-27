import http from 'node:http';
import express from 'express';
import multer from 'multer';
import { Server } from 'socket.io';
import { config, PUBLIC_DIR, AUDIO_DIR, TTS_CACHE_DIR } from './config.js';
import { LANGUAGES, isLanguage } from './languages.js';
import { translateVoiceMessage, translateTextMessage, providers, queueStats } from './pipeline.js';
import { budgetStats } from './budget.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
// Voice notes are small; keep them in memory instead of temp files.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(PUBLIC_DIR));
app.use('/v1/audio', express.static(AUDIO_DIR), express.static(TTS_CACHE_DIR));

// ---------------------------------------------------------------------------
// The product: the API a ride or delivery app calls from its own backend.
// ---------------------------------------------------------------------------

function requireClientKey(req, res, next) {
  if (req.get('x-api-key') !== config.clientApiKey) {
    return res.status(401).json({ error: 'Missing or wrong x-api-key header' });
  }
  next();
}

app.post('/v1/voice-messages', requireClientKey, upload.single('audio'), async (req, res) => {
  const { from_lang: fromLang, to_lang: toLang } = req.body;
  const problem = validate(req.file, fromLang, toLang);
  if (problem) return res.status(400).json({ error: problem });

  const result = await translateVoiceMessage({ audio: toAudio(req.file), fromLang, toLang });
  publishToMonitor(result, 'api');
  res.json(result);
});

app.post('/v1/text-messages', requireClientKey, express.json(), async (req, res) => {
  const { text, from_lang: fromLang, to_lang: toLang } = req.body ?? {};
  const problem = validateText(text, fromLang, toLang);
  if (problem) return res.status(400).json({ error: problem });

  const result = await translateTextMessage({ text: text.trim(), fromLang, toLang });
  publishToMonitor(result, 'api');
  res.json(result);
});

app.get('/v1/languages', (_req, res) => res.json(LANGUAGES));

app.get('/health', (_req, res) => {
  res.json({ ok: true, providers, queues: queueStats(), gnani_budget: budgetStats() });
});

// ---------------------------------------------------------------------------
// Demo only: a stand-in for the ride app's own chat backend, so the two
// phones in the demo can talk. A real app keeps its own chat and just calls
// POST /v1/voice-messages above.
// ---------------------------------------------------------------------------

const ROLES = ['customer', 'rider'];
const rides = new Map();

function getRide(rideId) {
  if (!rides.has(rideId)) {
    rides.set(rideId, { customer: { lang: 'kn-IN' }, rider: { lang: 'te-IN' } });
  }
  return rides.get(rideId);
}

io.on('connection', (socket) => {
  socket.on('join', ({ rideId, role, lang } = {}) => {
    if (typeof rideId !== 'string' || !ROLES.includes(role)) return;
    const ride = getRide(rideId);
    if (isLanguage(lang)) ride[role].lang = lang;
    socket.join(`ride:${rideId}`);
    io.to(`ride:${rideId}`).emit('ride', ride);
  });

  socket.on('monitor', () => {
    socket.join('monitor');
    socket.emit('mode', providers);
  });
});

app.post('/demo/rides/:rideId/messages', upload.single('audio'), async (req, res) => {
  const { role, client_id: clientId, text, text_lang: textLang } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'role must be customer or rider' });

  const ride = getRide(req.params.rideId);
  const toLang = ride[role === 'customer' ? 'rider' : 'customer'].lang;

  let result;
  if (req.file) {
    const fromLang = ride[role].lang;
    const problem = validate(req.file, fromLang, toLang);
    if (problem) return res.status(400).json({ error: problem });
    result = await translateVoiceMessage({ audio: toAudio(req.file), fromLang, toLang });
  } else {
    // Quick replies are written in the app's language (English), so they say
    // which language they're in; typed messages are in the sender's language.
    const fromLang = isLanguage(textLang) ? textLang : ride[role].lang;
    const problem = validateText(text, fromLang, toLang);
    if (problem) return res.status(400).json({ error: problem });
    result = await translateTextMessage({ text: text.trim(), fromLang, toLang });
  }
  const message = { ...result, from_role: role, client_id: clientId };
  io.to(`ride:${req.params.rideId}`).emit('message', message);
  publishToMonitor(result, role);
  res.json(message);
});

// ---------------------------------------------------------------------------

function validate(file, fromLang, toLang) {
  if (!file) return 'Send the voice message as a multipart field named "audio"';
  if (!isLanguage(fromLang)) return `Unsupported from_lang "${fromLang}"`;
  if (!isLanguage(toLang)) return `Unsupported to_lang "${toLang}"`;
  return null;
}

function validateText(text, fromLang, toLang) {
  if (typeof text !== 'string' || !text.trim()) return 'Send the message as a "text" field';
  if (text.length > 500) return 'Text messages are limited to 500 characters';
  if (!isLanguage(fromLang)) return `Unsupported from_lang "${fromLang}"`;
  if (!isLanguage(toLang)) return `Unsupported to_lang "${toLang}"`;
  return null;
}

function toAudio(file) {
  return { buffer: file.buffer, mimetype: file.mimetype, filename: file.originalname || 'message.wav' };
}

function publishToMonitor(result, source) {
  io.to('monitor').emit('log', { ...result, source, at: Date.now() });
}

server.listen(config.port, () => {
  console.log(`Maatu running on http://localhost:${config.port}`);
  console.log(`Providers: ${JSON.stringify(providers)}`);
  if (providers.stt === 'mock') console.log('Mock mode: no credits are being spent. Use "npm run live" for real calls.');
});
