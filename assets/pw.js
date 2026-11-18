// pw.js - adds a show / hide (eye) button to every password box.

// The two icons (eye = "show", crossed eye = "hide")
const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Do the same steps for every password box on the page
document.querySelectorAll('input[type="password"]').forEach(function (input) {

  // 1. Put the input inside a <div class="pw"> so the eye can sit inside the box
  const wrap = document.createElement('div');
  wrap.className = 'pw';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  // 2. Create the eye button
  const button = document.createElement('button');
  button.type = 'button';                       // "button" so it does not submit the form
  button.className = 'eye';
  button.setAttribute('aria-label', 'Show password');
  button.innerHTML = EYE;
  wrap.appendChild(button);

  // 3. When clicked, switch between hidden (password) and visible (text)
  button.onclick = function () {
    const showIt = (input.type === 'password');
    input.type = showIt ? 'text' : 'password';
    button.innerHTML = showIt ? EYE_OFF : EYE;
    button.classList.toggle('on', showIt);
    button.setAttribute('aria-label', showIt ? 'Hide password' : 'Show password');
  };
});
