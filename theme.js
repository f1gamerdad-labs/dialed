/* Appearance: dark or light theme (or follow Windows), colour-blind friendly colours, and high contrast buttons.
   The choices are remembered in the page's storage and applied to <html> as data-theme / data-cb / data-contrast, which the stylesheet reads.
   A tiny script in the <head> applies them before the first paint so the page never flashes the wrong theme. resolve() is tested in test\theme.js. */
(function (root) {
  'use strict';

  // setting: 'dark' | 'light' | 'system'. prefersLight: what Windows says right now.
  function resolve(setting, prefersLight) {
    if (setting === 'light') return 'light';
    if (setting === 'system') return prefersLight ? 'light' : 'dark';
    return 'dark';
  }
  var api = { resolve: resolve };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  var K_THEME = 'dialed.theme', K_CB = 'dialed.cb', K_HC = 'dialed.contrast', $ = function (id) { return document.getElementById(id); };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* just not remembered */ } }
  var mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: light)') : null;
  function setting() { var s = get(K_THEME); return s === 'light' || s === 'system' ? s : 'dark'; }

  function apply() {
    var h = document.documentElement, t = resolve(setting(), !!(mq && mq.matches));
    h.dataset.theme = t;
    if (get(K_CB) === '1') h.dataset.cb = 'on'; else delete h.dataset.cb;
    if (get(K_HC) === 'high') h.dataset.contrast = 'high'; else delete h.dataset.contrast;
    var b = $('themeBtn');
    if (b) {
      var toLight = t === 'dark';
      b.setAttribute('aria-label', toLight ? 'Switch to the light theme' : 'Switch to the dark theme');
      b.title = toLight ? 'Switch to the light theme' : 'Switch to the dark theme';
      $('themeBtnText').textContent = toLight ? 'Light' : 'Dark';
      $('themeIconSun').style.display = toLight ? '' : 'none'; $('themeIconMoon').style.display = toLight ? 'none' : '';
    }
    if ($('themeSel')) $('themeSel').value = setting();
    if ($('cbMode')) $('cbMode').checked = get(K_CB) === '1';
    if ($('hiContrast')) $('hiContrast').checked = get(K_HC) === 'high';
  }

  if ($('themeBtn')) $('themeBtn').addEventListener('click', function () { set(K_THEME, document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); apply(); });
  if ($('themeSel')) $('themeSel').addEventListener('change', function () { set(K_THEME, $('themeSel').value); apply(); });
  if ($('cbMode')) $('cbMode').addEventListener('change', function () { set(K_CB, $('cbMode').checked ? '1' : '0'); apply(); });
  if ($('hiContrast')) $('hiContrast').addEventListener('change', function () { set(K_HC, $('hiContrast').checked ? 'high' : 'normal'); apply(); });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (setting() === 'system') apply(); });
  apply();
  root.TunerTheme = { apply: apply };
})(typeof self !== 'undefined' ? self : this);
