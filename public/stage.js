import { iconSvg } from './quick-chat.js';

const log = document.getElementById('log');
for (const end of document.querySelectorAll('.route .end')) {
  end.innerHTML = iconSvg(end.dataset.icon, end.dataset.icon === 'auto' ? 30 : 26);
}

document.documentElement.classList.add('js');

// On a laptop the browser window is often only ~600px tall, too short for two
// 720px phones. Instead of making people zoom out by hand, shrink the demo
// until it fits under the top bar, like a slide. The top bar and the hero keep
// their size. Narrow screens keep the stacked, scrolling layout. Below half
// size it stops shrinking, so text stays legible.
const wide = matchMedia('(min-width: 1201px)');
const stage = document.getElementById('stage');
const topbar = document.querySelector('.topbar');
const STAGE_MIN_WIDTH = 1200; // two phones, the middle column, gaps, padding
function fitToScreen() {
  stage.style.zoom = '';
  stage.style.width = '';
  if (!wide.matches) return;
  const room = stage.parentElement.clientWidth;
  const scale = Math.max(0.5, Math.min(1, room / STAGE_MIN_WIDTH, (innerHeight - topbar.offsetHeight) / stage.offsetHeight));
  if (scale < 1) {
    stage.style.zoom = String(scale);
    // Zoom shrinks the width too, so widen it to still fill the screen.
    stage.style.width = `${room / scale}px`;
  }
}
fitToScreen();
addEventListener('resize', () => requestAnimationFrame(fitToScreen));

// Bring the phones in the first time the demo appears.
const demo = document.getElementById('demo');
const arrival = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  demo.classList.add('seen');
  arrival.disconnect();
}, { threshold: 0.5 });
arrival.observe(demo);

// On wide screens the page moves in whole steps: one flick of the wheel goes
// from the hero to the demo or back, however small the flick. Scrolling inside
// a phone or an open fold-out still scrolls that, not the page.
const stops = [document.getElementById('home'), demo];
// A trackpad flick is a stream of wheel events; a pause this long ends it.
const FLICK_GAP_MS = 200;
let lastWheel = -Infinity;
let spent = false; // this flick has already moved the page
let moving = false; // the page is still sliding to the next stop
addEventListener('wheel', (event) => {
  if (!wide.matches || event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
  if (event.timeStamp - lastWheel > FLICK_GAP_MS) spent = false;
  lastWheel = event.timeStamp;
  if (spent || moving) return event.preventDefault();
  const down = event.deltaY > 0;
  const inner = event.target.closest?.('.fold');
  if (inner && (down ? inner.scrollTop + inner.clientHeight < inner.scrollHeight - 1 : inner.scrollTop > 0)) return;
  const tops = stops.map((el) => el.getBoundingClientRect().top + scrollY);
  const distances = tops.map((top) => Math.abs(top - scrollY));
  const current = distances.indexOf(Math.min(...distances));
  const next = current + (down ? 1 : -1);
  if (next < 0 || next >= stops.length) return;
  event.preventDefault();
  spent = true;
  moving = true;
  scrollTo({ top: tops[next], behavior: 'smooth' });
  const done = () => { moving = false; };
  addEventListener('scrollend', done, { once: true });
  setTimeout(done, 1500);
}, { passive: false });

const languages = await fetch('/v1/languages').then((r) => r.json());
const STEPS = [
  ['stt', 'Prisma · speech → text'],
  ['translate', 'Translate'],
  ['tts', 'Timbre · text → speech'],
];
const SCALE_MS = 1500; // a full bar

// ---- Phones: one phone at a time --------------------------------------------
// Only one of the two fits on a phone, so when a message reaches the other
// person their phone slides up, as if it just buzzed in their pocket.

const narrow = matchMedia('(max-width: 800px)');
const HANDOVER_MS = 700; // let the sender see their message go first
const tabs = document.querySelectorAll('.switch button');
const phones = { cust: stage.querySelector('.device.cust'), rider: stage.querySelector('.device.rider') };
let onScreen = 'cust';
function showPhone(which) {
  onScreen = which;
  stage.classList.toggle('on-rider', which === 'rider');
  for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.show === which));
  // The hidden phone can't be reached with the keyboard either.
  phones.cust.inert = narrow.matches && which !== 'cust';
  phones.rider.inert = narrow.matches && which !== 'rider';
}
for (const tab of tabs) tab.addEventListener('click', () => showPhone(tab.dataset.show));
narrow.addEventListener('change', () => showPhone(onScreen));
showPhone('cust');

// The phone shrinks as one piece, screen and all, to fit under the top bar
// and the switch, instead of being squashed to the screen's height.
const PHONE_W = 360;
const PHONE_H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--phone-h'));
function fitPhones() {
  if (!narrow.matches) return stage.style.removeProperty('--s');
  const css = getComputedStyle(stage);
  const width = stage.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  const switchBox = document.querySelector('.switch').offsetHeight;
  const height = innerHeight - topbar.offsetHeight - switchBox - parseFloat(css.paddingTop) - 2 * parseFloat(css.rowGap);
  stage.style.setProperty('--s', Math.min(1, width / PHONE_W, height / PHONE_H).toFixed(3));
}
fitPhones();
addEventListener('resize', () => requestAnimationFrame(fitPhones));

function handOver(source) {
  if (!narrow.matches || (source !== 'customer' && source !== 'rider')) return;
  setTimeout(() => showPhone(source === 'customer' ? 'rider' : 'cust'), HANDOVER_MS);
}

// Send the orb along the route in the direction the message went.
const traveller = document.getElementById('traveller');
function travel(source) {
  if (source !== 'customer' && source !== 'rider') return;
  traveller.className = 'traveller';
  void traveller.offsetWidth; // restart the animation
  traveller.classList.add(source === 'customer' ? 'go-right' : 'go-left');
}

const socket = io();
socket.on('connect', () => socket.emit('monitor'));

socket.on('mode', (providers) => {
  const mock = providers.stt === 'mock';
  const pill = document.getElementById('mode');
  pill.textContent = mock ? 'mock mode · no credits used' : 'live · Gnani Prisma + Timbre';
  pill.classList.toggle('live', !mock);
});

// ---- Pipeline log ---------------------------------------------------------------
// Every delivered message is kept (up to 100) and shown 3 to a page, newest
// first, so the panel never grows the page.

const PAGE_SIZE = 3;
const entries = [];
let page = 0;

socket.on('log', (entry) => {
  travel(entry.source);
  handOver(entry.source);
  document.getElementById('logEmpty')?.remove();
  entries.unshift(entry);
  entries.length = Math.min(entries.length, 100);
  renderLog();
});

document.getElementById('newer').addEventListener('click', () => { page = Math.max(0, page - 1); renderLog(); });
document.getElementById('older').addEventListener('click', () => { page = Math.min(pageCount() - 1, page + 1); renderLog(); });
// Opening or closing a fold-out changes the page's height, so fit it to the
// screen again.
for (const fold of document.querySelectorAll('.fold')) fold.addEventListener('toggle', fitToScreen);

function pageCount() {
  return Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
}

function renderLog() {
  const start = page * PAGE_SIZE;
  const shown = entries.slice(start, start + PAGE_SIZE);
  log.replaceChildren(...shown.map(logItem));

  document.getElementById('pager').hidden = entries.length <= PAGE_SIZE;
  document.getElementById('pageLabel').textContent = `${page + 1} / ${pageCount()}`;
  document.getElementById('newer').disabled = page === 0;
  document.getElementById('older').disabled = page >= pageCount() - 1;
  fitToScreen();
}

function heading(entry) {
  const who = entry.source === 'api' ? 'API call' : entry.source === 'customer' ? 'Customer → Rider' : 'Rider → Customer';
  const typed = entry.kind === 'text' ? ' · typed' : '';
  return `${who}${typed} · ${languages[entry.from_lang]?.name} → ${languages[entry.to_lang]?.name}`;
}

function logItem(entry) {
  const li = document.createElement('li');
  li.className = `from-${entry.source}`;
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = heading(entry);
  li.append(title, ...stepRows(entry), totalLine(entry));
  return li;
}

function stepRows(entry) {
  const rows = [];
  for (const [key, label] of STEPS) {
    const ms = entry.timings_ms[key];
    const cached = entry.cached?.[key];
    if (ms === undefined && !cached) continue;
    const row = document.createElement('div');
    row.className = 'step';
    const name = document.createElement('span');
    name.textContent = label;
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.min(100, ((ms ?? 0) / SCALE_MS) * 100)}%`;
    bar.append(fill);
    const value = document.createElement('span');
    value.className = 'ms';
    value.textContent = cached ? 'cached' : `${ms} ms`;
    row.append(name, bar, value);
    rows.push(row);
  }
  return rows;
}

function totalLine(entry) {
  const total = document.createElement('div');
  total.className = entry.fallback ? 'total warn' : 'total';
  total.textContent = entry.fallback
    ? `Delivered untranslated · ${entry.error}`
    : `Delivered in ${entry.timings_ms.total} ms`;
  return total;
}
