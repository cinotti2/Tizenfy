/* Tizenfy - avvio: scarica a ogni apertura la versione di sviluppo (dev.js) dal fork cinotti2/Tizenfy.
   Per aggiornare basta caricare un nuovo dev.js su GitHub e riaprire Tizenfy: niente release. */
(function () {
  if (window.top !== window || window.__tzBoot) return;
  window.__tzBoot = 1;
  var urls = [
    'https://raw.githubusercontent.com/cinotti2/Tizenfy/main/dev.js?t=' + Date.now(),
    'https://cdn.jsdelivr.net/gh/cinotti2/Tizenfy@main/dev.js'
  ];
  var errors = [];
  function show(msg) {
    var add = function () {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#000;color:#fff;' +
        'font:15px monospace;padding:10px;border:3px solid #e22134;white-space:pre-wrap;pointer-events:none;';
      d.textContent = msg;
      document.body.appendChild(d);
    };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  }
  function next(i) {
    if (i >= urls.length) { show('TIZENFY: impossibile scaricare dev.js\n' + errors.join('\n')); return; }
    fetch(urls[i], { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (code) { window.__tzSource = urls[i].split('?')[0]; (0, eval)(code + '\n//# sourceURL=tizenfy-dev.js'); })
      .catch(function (e) { errors.push(urls[i].split('/')[2] + ': ' + (e && e.message)); next(i + 1); });
  }
  next(0);
})();
