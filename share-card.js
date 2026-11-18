/* Share image: a 1200 x 630 before/after card for Discord and YouTube comments, drawn on a canvas from the last round's numbers.
   Nothing is uploaded. The player can copy the image or save it into Documents\Dialed\Share cards. */
(function (root) {
  'use strict';

  // ---- wording (pure, tested) ----
  function headline(d) {
    var gain = Math.round(d.after.low1) - Math.round(d.before.low1), pct = d.before.low1 > 0 ? Math.round(gain / d.before.low1 * 100) : 0;
    if (d.verdict === 'better') return { big: '+' + gain + ' FPS', small: 'on my 1% lows (' + (pct >= 0 ? '+' : '') + pct + '%)', mood: 'win' };
    if (d.verdict === 'worse') return { big: gain + ' FPS', small: 'on my 1% lows. Time to get it back.', mood: 'loss' };
    return { big: 'Holding steady', small: 'my 1% lows barely moved', mood: 'same' };
  }
  function tiles(d) {
    function t(label, b, a, digits, higherBetter) {
      var delta = a - b, good = higherBetter ? delta > 0 : delta < 0;
      return { label: label, from: b.toFixed(digits), to: a.toFixed(digits), delta: (delta > 0 ? '+' : '') + delta.toFixed(digits), tone: Math.abs(delta) < (digits ? 0.05 : 0.5) ? 'flat' : good ? 'good' : 'bad' };
    }
    return [t('1% low FPS', d.before.low1, d.after.low1, 0, true), t('Average FPS', d.before.avgFps, d.after.avgFps, 0, true), t('Stutters per minute', d.before.spikesPerMin, d.after.spikesPerMin, 1, false)];
  }
  function changeLines(applied) {
    return (applied || []).slice(0, 4).map(function (c) { return c.name + ': ' + c.fromLabel + ' to ' + c.toLabel; });
  }
  function fileName(d) { return 'Dialed-' + String(d.simName || 'sim').replace(/[^A-Za-z0-9]+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.png'; }
  var api = { headline: headline, tiles: tiles, changeLines: changeLines, fileName: fileName };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---- drawing ----
  var W = 1200, H = 630, TONE = { good: '#4fdca0', bad: '#ff6b8a', flat: '#b6a6d9' };
  function load(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fit(ctx, text, maxW) { while (ctx.measureText(text).width > maxW && text.length > 4) text = text.slice(0, -2); return text; }

  function draw(canvas, d) {
    var ctx = canvas.getContext('2d'), h = headline(d), tl = tiles(d), lines = changeLines(d.applied);
    canvas.width = W; canvas.height = H;
    var bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2a1255'); bg.addColorStop(1, '#0d0720'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W * 0.82, H * 0.2, 20, W * 0.82, H * 0.2, 520); glow.addColorStop(0, h.mood === 'loss' ? 'rgba(255,138,42,.22)' : 'rgba(255,46,147,.30)'); glow.addColorStop(1, 'rgba(255,46,147,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    var grad = ctx.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#ff8a2a'); grad.addColorStop(0.55, '#ff2e93'); grad.addColorStop(1, '#9b4dff');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 8);

    ctx.textBaseline = 'alphabetic';
    ctx.font = '400 40px "Russo One", Arial Black, sans-serif'; var gl = ctx.createLinearGradient(56, 0, 200, 0); gl.addColorStop(0, '#ff8a2a'); gl.addColorStop(0.55, '#ff2e93'); gl.addColorStop(1, '#9b4dff'); ctx.fillStyle = gl; ctx.fillText('Dialed', 56, 84);
    ctx.font = '700 17px Lato, Arial, sans-serif'; ctx.fillStyle = '#b6a6d9'; ctx.fillText('SIM GRAPHICS OPTIMISER  |  ' + String(d.simName || '').toUpperCase(), 56, 112);

    ctx.font = '400 104px "Russo One", Arial Black, sans-serif'; ctx.fillStyle = h.mood === 'loss' ? '#ff9a6b' : '#ffffff'; ctx.fillText(h.big, 56, 238);
    ctx.font = '700 30px Lato, Arial, sans-serif'; ctx.fillStyle = '#e2d6ff'; ctx.fillText(fit(ctx, h.small, 700), 60, 284);

    tl.forEach(function (t, i) {
      var x = 56 + i * 222, y = 322, w = 206, hh = 150;
      round(ctx, x, y, w, hh, 16); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '900 14px Lato, Arial, sans-serif'; ctx.fillStyle = '#b6a6d9'; ctx.fillText(t.label.toUpperCase(), x + 16, y + 30);
      ctx.font = '400 38px "Russo One", Arial Black, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(t.from + ' > ' + t.to, x + 16, y + 82);
      ctx.font = '900 26px Lato, Arial, sans-serif'; ctx.fillStyle = TONE[t.tone]; ctx.fillText(t.delta, x + 16, y + 122);
    });

    ctx.font = '900 15px Lato, Arial, sans-serif'; ctx.fillStyle = '#b6a6d9'; ctx.fillText('WHAT I CHANGED', 56, 520);
    ctx.font = '700 22px Lato, Arial, sans-serif'; ctx.fillStyle = '#ffffff';
    lines.slice(0, 3).forEach(function (l, i) { ctx.fillText(fit(ctx, l, 640), 56, 552 + i * 30); });

    ctx.font = '700 16px Lato, Arial, sans-serif'; ctx.fillStyle = '#b6a6d9'; ctx.textAlign = 'right';
    ctx.fillText('Free from f1gamerdad-labs.github.io/dialed', W - 40, H - 24); ctx.textAlign = 'left';
    return load(h.mood === 'loss' ? 'assets/celebrate-setback.png' : h.mood === 'win' ? 'assets/celebrate-win.png' : 'assets/f1gd-logo.png').then(function (img) {
      if (!img) return canvas;
      var ih = h.mood === 'same' ? 200 : 470, iw = img.width * ih / img.height, x = W - iw - 44, y = H - ih - 40;
      ctx.drawImage(img, x, y, iw, ih); return canvas;
    });
  }

  // ---- the preview window ----
  var $ = function (id) { return document.getElementById(id); }, current = null;
  function dataUrl() { return $('shareCanvas').toDataURL('image/png'); }
  function open(d) {
    current = d; $('shareStatus').textContent = ''; $('share').hidden = false;
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { return draw($('shareCanvas'), d); });
  }
  function close() { $('share').hidden = true; }
  function save() {
    var url = dataUrl(), wv = root.chrome && root.chrome.webview;
    if (wv) { wv.postMessage({ type: 'saveImage', name: fileName(current), data: url.split(',')[1] }); $('shareStatus').textContent = 'Saving...'; }
    else { var a = document.createElement('a'); a.href = url; a.download = fileName(current); a.click(); }
  }
  function copy() {
    $('shareCanvas').toBlob(function (blob) {
      if (!blob || !navigator.clipboard || !window.ClipboardItem) { $('shareStatus').textContent = 'Copy is not available here. Use Save image.'; return; }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () { $('shareStatus').textContent = 'Copied. Paste it into Discord or a comment.'; },
        function () { $('shareStatus').textContent = 'Could not copy. Use Save image.'; });
    }, 'image/png');
  }
  function saved(m) { if ($('shareStatus')) $('shareStatus').textContent = m.ok ? 'Saved to ' + m.path : 'Could not save: ' + (m.message || 'unknown error'); }
  if ($('share')) {
    $('shareClose').addEventListener('click', close); $('shareSave').addEventListener('click', save); $('shareCopy').addEventListener('click', copy);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('share').hidden) close(); });
  }
  root.TunerShare = { open: open, saved: saved };
})(typeof self !== 'undefined' ? self : this);
