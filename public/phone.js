import { createRecorder } from './recorder.js';
import { QUICK_CHAT, iconSvg } from './quick-chat.js';

const params = new URLSearchParams(location.search);
const role = params.get('role') === 'rider' ? 'rider' : 'customer';
const peerRole = role === 'customer' ? 'rider' : 'customer';
const rideId = params.get('ride') || 'demo';
const MAX_SECONDS = 28; // Prisma's REST limit is 30 s

// Made-up people for the demo screens.
const PEOPLE = {
  customer: { name: 'Priya', meta: 'Pickup · Indiranagar Metro, Gate 2' },
  rider: { name: 'Ravi Kumar', meta: 'KA 05 HX 4417' },
};

const $ = (id) => document.getElementById(id);
const chat = $('chat');
const talk = $('talk');
const composer = $('composer');
const textInput = $('text');
const langSelect = $('lang');

let languages = {};
let ride = null;
const recorder = createRecorder();
const player = new Audio();
let playingButton = null;

document.body.dataset.role = role;
$('peerName').textContent = PEOPLE[peerRole].name;
$('peerMeta').textContent = PEOPLE[peerRole].meta;
textInput.placeholder = `Type here to chat with ${role === 'customer' ? 'captain' : 'customer'}`;
const firstName = PEOPLE[peerRole].name.split(' ')[0];

languages = await fetch('/v1/languages').then((r) => r.json());
for (const [code, lang] of Object.entries(languages)) {
  langSelect.add(new Option(`${lang.native} · ${lang.name}`, code));
}

// Connect only after the language list has loaded: connecting first meant a
// fast 'connect' event could fire before its handler existed, leaving the
// phone stuck on "Connecting…".
const socket = io();
socket.on('connect', () => socket.emit('join', { rideId, role, lang: params.get('lang') ?? phoneLanguage() }));
socket.on('ride', (state) => {
  ride = state;
  langSelect.value = ride[role].lang;
  const peerLang = languages[ride[peerRole].lang];
  $('banner').innerHTML = '';
  $('banner').append(
    `${firstName} hears you in `,
    Object.assign(document.createElement('b'), { textContent: peerLang.name }),
  );
});
socket.on('message', renderMessage);

langSelect.addEventListener('change', () => socket.emit('join', { rideId, role, lang: langSelect.value }));

// ---- Hold to talk ----------------------------------------------------------

let starting = null;
let timer = null;

// One round button, like WhatsApp: with an empty box it records while held,
// once something is typed it sends the text.
const hasText = () => textInput.value.trim() !== '';
textInput.addEventListener('input', () => {
  composer.classList.toggle('has-text', hasText());
  talk.setAttribute('aria-label', hasText() ? 'Send message' : 'Hold to record a voice message');
});
talk.addEventListener('click', () => {
  if (hasText()) $('textForm').requestSubmit();
});
$('textForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!hasText()) return;
  sendText(textInput.value.trim());
  textInput.value = '';
  textInput.dispatchEvent(new Event('input'));
});

talk.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || hasText()) return;
  talk.setPointerCapture(e.pointerId);
  composer.classList.add('recording');
  $('talkLabel').textContent = 'Listening… 0s';
  starting = recorder.start().catch((err) => {
    showNotice(micErrorText(err));
    throw err;
  });
  timer = setInterval(() => {
    const s = recorder.elapsed();
    $('talkLabel').textContent = `Listening… ${Math.floor(s)}s · let go to send`;
    if (s >= MAX_SECONDS) finishRecording();
  }, 250);
});
talk.addEventListener('pointerup', finishRecording);
talk.addEventListener('pointercancel', finishRecording);
talk.addEventListener('contextmenu', (e) => e.preventDefault());

async function finishRecording() {
  if (!starting) return;
  const pending = starting;
  starting = null;
  clearInterval(timer);
  composer.classList.remove('recording');
  try {
    await pending;
  } catch {
    return; // mic error already shown
  }
  const wav = await recorder.stop();
  if (!wav) return showNotice('Hold the mic while you speak.');
  send(wav, 'message.wav');
}

$('attach').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', () => {
  const file = $('file').files[0];
  if (file) send(file, file.name);
  $('file').value = '';
});

// ---- Quick chat ---------------------------------------------------------------

for (const item of QUICK_CHAT[role]) {
  const button = el('button', '', '');
  button.type = 'button';
  button.append(el('span', '', item.label));
  if (item.icon) button.insertAdjacentHTML('beforeend', iconSvg(item.icon, 17, 'qicon'));
  button.insertAdjacentHTML('beforeend', '<svg class="arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>');
  // Quick chats are written in English, whatever language this phone speaks.
  button.addEventListener('click', () => sendText(item.text, 'en-IN'));
  const li = document.createElement('li');
  li.append(button);
  $('quickList').append(li);
}

$('quickToggle').addEventListener('click', () => {
  const open = $('quickToggle').getAttribute('aria-expanded') !== 'true';
  $('quickToggle').setAttribute('aria-expanded', String(open));
  $('quickList').hidden = !open;
});

// ---- Sending & receiving -------------------------------------------------------

function send(blob, filename) {
  const form = new FormData();
  form.append('audio', blob, filename);
  post(form, null);
}

// textLang is only set for quick chats; typed text is in this phone's language.
function sendText(text, textLang) {
  const form = new FormData();
  form.append('text', text);
  if (textLang) form.append('text_lang', textLang);
  post(form, text);
}

async function post(form, pendingText) {
  const clientId = crypto.randomUUID();
  const bubble = addBubble({ mine: true, clientId });
  if (pendingText) bubble.append(el('p', 'main', pendingText));
  bubble.append(thinking());
  bubble.classList.add('pending');

  form.append('role', role);
  form.append('client_id', clientId);
  try {
    const res = await fetch(`/demo/rides/${encodeURIComponent(rideId)}/messages`, { method: 'POST', body: form });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  } catch (err) {
    bubble.classList.remove('pending');
    bubble.classList.add('failed');
    bubble.replaceChildren(el('p', 'main', `Not sent: ${err.message}`));
  }
}

function renderMessage(msg) {
  const mine = msg.from_role === role;
  const bubble =
    (mine && chat.querySelector(`[data-client-id="${CSS.escape(msg.client_id ?? '')}"]`)) ||
    addBubble({ mine, clientId: msg.client_id });
  bubble.classList.remove('pending');
  bubble.innerHTML = '';

  const fromName = languages[msg.from_lang]?.name;
  const toName = languages[msg.to_lang]?.name;
  const sameLang = msg.from_lang === msg.to_lang;

  // What this person reads first: their own words if they sent it, otherwise
  // the message in their language.
  const mainText = mine ? msg.original_text : msg.translated_text ?? msg.original_text;
  bubble.append(el('p', 'main', mainText ?? 'Voice message'));

  if (!sameLang && msg.translated_text && msg.original_text) {
    bubble.append(
      el('p', 'sub', mine ? `${firstName} hears (${toName}): ${msg.translated_text}` : `Said in ${fromName}: ${msg.original_text}`),
    );
  }

  // A message can only be silent if speaking it failed and it was typed.
  if (!msg.audio_url) {
    if (msg.fallback) bubble.append(el('p', 'warn', `Sent untranslated${msg.error ? ` · ${msg.error}` : ''}`));
    return scrollDown();
  }

  const row = el('div', 'row');
  const play = el('button', 'play', '');
  play.type = 'button';
  play.setAttribute('aria-label', mine ? 'Play what they hear' : 'Play message');
  play.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z"/></svg>';
  play.addEventListener('click', () => playAudio(msg.audio_url, play));
  row.append(play, el('span', 'wave', ''), el('span', 'tag', mine ? `${toName} voice` : toName));
  bubble.append(row);

  if (msg.fallback) bubble.append(el('p', 'warn', `Sent untranslated${msg.error ? ` · ${msg.error}` : ''}`));

  scrollDown();
  // The rider is on the bike and can't look at the screen, so their messages
  // play by themselves. The customer taps to listen, like any chat app.
  if (!mine && role === 'rider') playAudio(msg.audio_url, play);
}

function addBubble({ mine, clientId }) {
  $('empty')?.remove();
  const bubble = el('div', `bubble ${mine ? 'mine' : 'theirs'}`);
  if (clientId) bubble.dataset.clientId = clientId;
  chat.append(bubble);
  scrollDown();
  return bubble;
}

// ---- Helpers -----------------------------------------------------------------

// A real ride app already knows each user's language from their app settings.
// Here we use the phone's language list as the stand-in, e.g. "kn-IN" or "te".
// English is skipped because most Indian phones are set to English anyway.
function phoneLanguage() {
  for (const tag of navigator.languages ?? []) {
    const base = tag.split('-')[0].toLowerCase();
    const match = Object.keys(languages).find((code) => code.startsWith(`${base}-`));
    if (match && match !== 'en-IN') return match;
  }
  return undefined;
}

function playAudio(url, button) {
  playingButton?.classList.remove('playing');
  player.src = url;
  playingButton = button;
  button.classList.add('playing');
  player.onended = () => button.classList.remove('playing');
  // Browsers may block sound until the person has tapped the page once.
  player.play().catch(() => {
    button.classList.remove('playing');
    button.classList.add('nudge');
  });
}

// Gnani's own loading look: soft orange / blue / purple orbs, shown for the
// second it takes to translate. renderMessage() replaces it with the result.
function thinking() {
  const row = el('div', 'thinking');
  const orbs = el('span', 'orbs');
  orbs.setAttribute('aria-hidden', 'true');
  orbs.append(el('i'), el('i'), el('i'));
  const peerLang = ride && languages[ride[peerRole].lang]?.name;
  row.append(orbs, el('span', '', peerLang ? `Translating to ${peerLang}…` : 'Translating…'));
  return row;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function scrollDown() {
  chat.scrollTop = chat.scrollHeight;
}

function showNotice(text) {
  const n = el('div', 'notice', text);
  document.body.append(n);
  setTimeout(() => n.remove(), 2600);
}

function micErrorText(err) {
  if (!window.isSecureContext) return 'The mic only works on https:// or localhost.';
  if (err?.name === 'NotAllowedError') return 'Allow microphone access to send voice messages.';
  return `Microphone problem: ${err?.message ?? err}`;
}
