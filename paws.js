// paws.js - dog paw prints follow the mouse and fade away (login + sign up pages).

(function () {
  // Skip this effect for people who turned animations off in their system
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }

  // One dog paw drawn with SVG: a big pad + four toes
  const PAW = '<svg viewBox="0 0 64 64" width="26" height="26" fill="currentColor">' +
              '<ellipse cx="32" cy="42" rx="13" ry="11"/>' +
              '<ellipse cx="13" cy="28" rx="6" ry="8" transform="rotate(-20 13 28)"/>' +
              '<ellipse cx="25" cy="15" rx="6" ry="8.5" transform="rotate(-6 25 15)"/>' +
              '<ellipse cx="39" cy="15" rx="6" ry="8.5" transform="rotate(6 39 15)"/>' +
              '<ellipse cx="51" cy="28" rx="6" ry="8" transform="rotate(20 51 28)"/></svg>';

  const STEP = 48;    // how far (px) the mouse must move before the next paw appears
  const LIFE = 900;   // how long a paw lives (ms). Must match "pawfade .9s" in style.css

  let lastX = null;   // where the last paw was placed
  let lastY = null;
  let leftFoot = true;   // switches between left and right foot

  // Put one paw on the screen
  function stamp(x, y, angle) {
    // move a little to the side so the prints look like left and right feet
    const side = leftFoot ? -9 : 9;
    leftFoot = !leftFoot;
    const pawX = x + Math.cos(angle + Math.PI / 2) * side;
    const pawY = y + Math.sin(angle + Math.PI / 2) * side;

    const paw = document.createElement('div');
    paw.className = 'paw-print';
    paw.innerHTML = PAW;
    paw.style.left = pawX + 'px';
    paw.style.top  = pawY + 'px';
    paw.style.setProperty('--r', (angle * 180 / Math.PI + 90) + 'deg');   // point the toes forward
    document.body.appendChild(paw);

    setTimeout(function () { paw.remove(); }, LIFE);   // remove it after it faded
  }

  document.addEventListener('pointermove', function (event) {
    // first move: just remember the position
    if (lastX === null) {
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const distance = Math.hypot(dx, dy);
    if (distance < STEP) { return; }   // not far enough yet

    stamp(event.clientX, event.clientY, Math.atan2(dy, dx));
    lastX = event.clientX;
    lastY = event.clientY;
  });
})();
