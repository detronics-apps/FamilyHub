// Loaded before main.js as a plain script (D-132): it used to sit inline in index.html, which the
// Content Security Policy now blocks.
//
// Just after an update, a browser can still hold some of the old files for up to ten minutes, and
// old and new do not fit together - the module script then fails to load. Say so, rather than show
// a blank page. Load errors do not bubble, so this listens on window in the capture phase.
(function () {
  var shown = false;
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (shown || !t || t.tagName !== 'SCRIPT' || !/\/js\/main\.js(\?|$)/.test(t.src || '')) return;
    shown = true;
    var make = function (tag, text) { var n = document.createElement(tag); if (text) n.textContent = text; return n; };
    var box = make('div');
    box.setAttribute('role', 'alert');
    box.className = 'load-failed';
    box.appendChild(make('h1', 'Family Hub was just updated'));
    box.appendChild(make('p', 'Your browser still has part of the previous version. Your family’s data is safe. Please wait a minute, then reload the page.'));
    var b = make('button', 'Reload');
    b.type = 'button';
    b.addEventListener('click', function () { location.reload(); });
    box.appendChild(b);
    document.body.appendChild(box);
  }, true);
}());
