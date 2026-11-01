// One-tap messages, like the quick chat in ride apps. They're written in
// English (the app's language) and arrive spoken in the other person's
// language. `text` is what gets translated; `label` is the button.
// The mock translator knows these exact sentences (src/providers/mock.js).
// `icon` names one of the small drawings in ICONS below.
export const QUICK_CHAT = {
  customer: [
    { label: 'Are you coming?', icon: 'question', text: 'Are you coming?' },
    { label: 'Waiting at pickup', icon: 'pin', text: "I'm waiting at the pickup point." },
    { label: 'My location is as per map', icon: 'map', text: 'My location is the same as on the map.' },
    { label: 'Message when reached', icon: '', text: 'Message me when you reach.' },
  ],
  rider: [
    { label: 'On my way', icon: 'auto', text: "I'm on my way." },
    { label: 'Reached pickup', icon: 'pin', text: "I've reached the pickup point." },
    { label: 'Come to the main road', icon: '', text: 'Please come to the main road.' },
    { label: 'Stuck in traffic, 5 min', icon: 'traffic', text: 'Stuck in traffic, 5 more minutes.' },
  ],
};

// Small coloured drawings in the spirit of the emoji they replace. Drawn in
// SVG so they look the same on every phone (emoji differ between Android,
// iPhone and Windows). Used by the quick chats and the demo's route line.
export const ICONS = {
  question: {
    viewBox: '0 0 24 24',
    body: '<path d="M8.2 8.6a3.8 3.8 0 1 1 5.6 3.4c-1.1.6-1.8 1.3-1.8 2.6v.6" fill="none" stroke="#e5484d" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="19.6" r="1.9" fill="#e5484d"/>',
  },
  pin: {
    viewBox: '0 0 24 24',
    body: '<path d="M12 12.5v9" stroke="#8b9099" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="5.6" fill="#e5484d"/><circle cx="10.1" cy="6.2" r="1.7" fill="#fff" opacity="0.6"/>',
  },
  map: {
    viewBox: '0 0 24 24',
    body: '<path d="M2.5 5.5 8.5 3.5l7 2 6-2v15l-6 2-7-2-6 2Z" fill="#a9dcf7"/><path d="M8.5 3.5v15l7 2v-15Z" fill="#cdebfb"/><path d="M5 9.5c1.6-1.4 3.4-.6 4.2.6.9 1.4 2.6 1.6 3.8.7 1.3-1 2.9-.5 3.6.9.6 1.2.1 2.6-1.2 3.2-1.7.8-3.4 1.6-5.4 1-1.6-.5-2.4-1.6-3.8-1.6-1.3 0-2.2-.6-2.2-1.6 0-.9.4-1.7 1-2.2Z" fill="#6cc070"/><path d="M2.5 5.5 8.5 3.5l7 2 6-2v15l-6 2-7-2-6 2Z" fill="none" stroke="#3f88c5" stroke-width="1.3" stroke-linejoin="round"/>',
  },
  // An Indian auto-rickshaw from the side: yellow canopy over an open
  // passenger seat, green body tapering to a narrow nose, small front wheel.
  auto: {
    viewBox: '0 0 32 24',
    body: '<path d="M3.5 13V7.5C3.5 4.8 5.2 3 8 3h10.5c2.9 0 5.1 1.8 6.3 5l1.6 4.5Z" fill="#f9c933"/><rect x="6" y="5.5" width="12.5" height="7.5" rx="1" fill="#fff4cc"/><rect x="7" y="8.6" width="6.5" height="4.4" rx="1.2" fill="#3a3f47"/><path d="M20 6h2.5c1 0 1.7 1 2.1 2.5l1.1 4.5H20Z" fill="#bfe3f5"/><path d="M3.5 12.5H24c2.6 0 4.6 1.1 5.6 3.6l.5 1.4H2.5V13.5c0-.6.4-1 1-1Z" fill="#2e9e5b"/><path d="M2.5 12.5H25.5" stroke="#1f2937" stroke-width="1.1"/><circle cx="7" cy="18.6" r="3.2" fill="#222"/><circle cx="7" cy="18.6" r="1.2" fill="#c8c8c8"/><circle cx="26" cy="19" r="2.6" fill="#222"/><circle cx="26" cy="19" r="1" fill="#c8c8c8"/><circle cx="29.4" cy="15.4" r="0.9" fill="#fff2a8"/>',
  },
  traffic: {
    viewBox: '0 0 24 24',
    body: '<rect x="7.5" y="1.5" width="9" height="21" rx="3" fill="#3a3f47"/><circle cx="12" cy="6.5" r="2.1" fill="#ef4444"/><circle cx="12" cy="12" r="2.1" fill="#f5b301"/><circle cx="12" cy="17.5" r="2.1" fill="#22c55e"/>',
  },
};

// The whole <svg> for one icon, sized by its height.
export function iconSvg(name, height, className = '') {
  const icon = ICONS[name];
  if (!icon) return '';
  const [, , w, h] = icon.viewBox.split(' ').map(Number);
  const width = Math.round((height * w) / h);
  return `<svg class="${className}" viewBox="${icon.viewBox}" width="${width}" height="${height}" aria-hidden="true">${icon.body}</svg>`;
}
