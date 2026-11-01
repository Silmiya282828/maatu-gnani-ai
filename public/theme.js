// ?theme=light forces light mode whatever the device is set to, handy when
// recording the demo. The phones are iframes, so they also check the page
// that contains them. The CSS only switches to dark when this isn't "light".
// Loaded as a plain script in <head> so the page never flashes the wrong theme.
(() => {
  const read = (win) => new URLSearchParams(win.location.search).get('theme');
  let theme = read(window);
  try {
    if (!theme && window.parent !== window) theme = read(window.parent);
  } catch {
    // Embedded somewhere else: just follow the device.
  }
  if (theme === 'light') document.documentElement.dataset.theme = 'light';})();
