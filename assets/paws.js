// paws.js - dog paw prints follow the mouse and fade away (login + sign up pages).
(function () {
  // Skip for people who turned animations off in their system
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }

  // One dog paw: a big pad + four toes
  var PAW = '<svg viewBox="0 0 64 64" width="26" height="26" fill="currentColor">' +
            '<ellipse cx="32" cy="42" rx="13" ry="11"/>' +
            '<ellipse cx="13" cy="28" rx="6" ry="8" transform="rotate(-20 13 28)"/>' +
            '<ellipse cx="25" cy="15" rx="6" ry="8.5" transform="rotate(-6 25 15)"/>' +
            '<ellipse cx="39" cy="15" rx="6" ry="8.5" transform="rotate(6 39 15)"/>' +
            '<ellipse cx="51" cy="28" rx="6" ry="8" transform="rotate(20 51 28)"/></svg>';

  var STEP = 48;          // distance (px) the mouse must move before the next paw appears
  var LIFE = 900;         // how long a paw lives (ms) - must match the CSS animation
  var lastX = null, lastY = null;
  var left = true;        // alternate left / right foot

  function stamp(x, y, angle) {
    // shift sideways a little so the prints look like left and right feet
    var side = left ? -9 : 9;
    left = !left;
    var px = x + Math.cos(angle + Math.PI / 2) * side;
    var py = y + Math.sin(angle + Math.PI / 2) * side;

    var paw = document.createElement('div');
    paw.className = 'paw-print';
    paw.innerHTML = PAW;
    paw.style.left = px + 'px';
    paw.style.top  = py + 'px';
    paw.style.setProperty('--r', (angle * 180 / Math.PI + 90) + 'deg');   // point the toes forward
    document.body.appendChild(paw);

    setTimeout(function () { paw.remove(); }, LIFE);                       // gone right away
  }

  document.addEventListener('pointermove', function (event) {
    if (lastX === null) { lastX = event.clientX; lastY = event.clientY; return; }

    var dx = event.clientX - lastX;
    var dy = event.clientY - lastY;
    if (Math.hypot(dx, dy) < STEP) { return; }

    stamp(event.clientX, event.clientY, Math.atan2(dy, dx));
    lastX = event.clientX;
    lastY = event.clientY;
  });
})();
