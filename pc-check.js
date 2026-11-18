/* PC check: turns the facts the Windows app collects (memory speed, power plan, display refresh, graphics card link ...) into plain findings.
   Rules only, no AI. Each finding: { id, level, title, text, fix }.  level: "fix" (likely costing you performance), "check" (worth a look),
   "info" (good to know), "ok" (fine). All wording is in this file so it can be corrected with a page update. */
(function (root) {
  'use strict';

  var MEM_TYPE = { 24: 'DDR3', 26: 'DDR4', 34: 'DDR5' };
  var LEVEL_ORDER = { fix: 0, check: 1, info: 2, ok: 3 };
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function discrete(name) { return /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|\barc\b/i.test(name || '') && !/graphics\s*\d*$/i.test(name || ''); }
  function integrated(name) { return /intel.*(uhd|iris|hd graphics|graphics)|radeon\(tm\) graphics|radeon graphics/i.test(name || '') && !discrete(name); }

  function evaluate(f, opts) {
    var out = [], now = (opts && opts.now) || new Date();
    function add(id, level, title, text, fix) { out.push({ id: id, level: level, title: title, text: text, fix: fix || '' }); }

    // ---- memory speed (XMP / EXPO) ----
    var ram = (f.ram || []).filter(function (r) { return r.capGB > 0; });
    if (ram.length) {
      var type = MEM_TYPE[ram[0].type] || 'memory';
      var slow = ram.filter(function (r) { return r.rated && r.configured && r.configured <= r.rated * 0.9; });
      var speeds = ram.map(function (r) { return r.configured; });
      var running = Math.min.apply(null, speeds.filter(Boolean)), rated = Math.max.apply(null, ram.map(function (r) { return r.rated || 0; }));
      var total = ram.reduce(function (s, r) { return s + r.capGB; }, 0);
      var jedec = (ram[0].type === 26 && running && running <= 2666) || (ram[0].type === 34 && running && running <= 4800);
      if (slow.length) {
        add('ram-speed', 'fix', 'Your memory is running slower than it is rated for',
          'Your ' + type + ' is running at ' + running + ' MT/s, but the modules are rated for ' + rated + ' MT/s. This usually means XMP (Intel) or EXPO/DOCP (AMD) is switched off in the BIOS, so the memory runs at a slow default speed.',
          'Restart, open the BIOS, and turn on XMP, DOCP or EXPO (the name depends on your motherboard). Save and restart, then run this check again. If the PC will not start afterwards, reset the BIOS to defaults and try a lower profile.');
      } else if (jedec) {
        add('ram-speed', 'check', 'Your memory is running at a basic default speed',
          'Your ' + type + ' is running at ' + running + ' MT/s. That is the standard default, and most gaming kits are rated higher. If your memory is sold as a faster kit (the speed is usually printed on the sticks or the box), XMP or EXPO is probably off.',
          'Check the speed on the label or box. If it is higher than ' + running + ', turn on XMP, DOCP or EXPO in the BIOS.');
      } else {
        add('ram-speed', 'ok', 'Memory speed looks right', type + ' is running at ' + running + ' MT/s (rated ' + (rated || running) + ').');
      }

      // ---- channels ----
      if (ram.length === 1) {
        add('ram-channels', 'fix', 'Only one memory stick: single channel',
          'You have one memory module, so memory runs in single channel, which is much slower than two sticks working together.',
          'Add a second matching stick (or replace it with a matching pair), in the slots your motherboard manual names for dual channel.');
      } else {
        var chans = ram.map(function (r) { var m = /Channel\s*([A-D0-9])/i.exec(r.locator || ''); return m ? m[1].toUpperCase() : null; });
        var known = chans.filter(Boolean);
        if (ram.length === 2 && known.length === 2 && chans[0] === chans[1]) {
          add('ram-channels', 'fix', 'Both memory sticks are on the same channel',
            'Your two sticks appear to be in the same memory channel (' + ram.map(function (r) { return r.locator; }).join(' and ') + '), so they are not working as a dual channel pair.',
            'Move one stick so the two sit in the slots your motherboard manual names for dual channel (often slots 2 and 4, counting from the processor).');
        } else if (known.length === ram.length && new Set(known).size >= 2) {
          add('ram-channels', 'ok', 'Memory is in dual channel', plural(ram.length, 'stick', 'sticks') + ', ' + total + ' GB in total, spread across ' + new Set(known).size + ' channels.');
        } else {
          add('ram-channels', 'info', 'Memory channels could not be confirmed', plural(ram.length, 'stick', 'sticks') + ', ' + total + ' GB. Windows did not say which channel each one is in.');
        }
        var sizes = new Set(ram.map(function (r) { return r.capGB; })), cfg = new Set(speeds);
        if (sizes.size > 1 || cfg.size > 1) {
          add('ram-mixed', 'check', 'Your memory sticks do not match', 'The sticks differ in size or speed, which can force everything to run at the slowest settings or lose dual channel on part of the memory.', 'Use a matching kit where you can.');
        }
      }
    }

    // ---- power plan ----
    if (f.power && f.power.name) {
      var pn = f.power.name;
      if (/power saver/i.test(pn)) add('power', 'fix', 'Windows is on the Power saver plan', 'Power saver keeps your processor clocks low, which costs frame rate.', 'Settings, System, Power: set the power mode to Best performance (or use the High performance plan in Control Panel).');
      else if (/balanced/i.test(pn)) add('power', 'check', 'Windows is on the Balanced power plan', 'Balanced is fine for most PCs, but on some it lets processor clocks drop between demands, which can show up as stutter.', 'If you want to try it: Settings, System, Power, set the power mode to Best performance, then compare a capture.');
      else add('power', 'ok', 'Power plan is set for performance', 'Active plan: ' + pn + '.');
    }

    // ---- displays ----
    var disp = f.displays || [], gpus = f.gpus || [];
    disp.forEach(function (d) {
      if (!d.hz || !d.maxHz) return;
      if (d.hz < d.maxHz - 1) {
        var big = d.hz <= 60 && d.maxHz >= 100;
        add('hz-' + d.name, big ? 'fix' : 'check', d.name + ' is running at ' + d.hz + ' Hz but can do ' + d.maxHz + ' Hz',
          'Windows is using ' + d.hz + ' Hz at ' + d.width + 'x' + d.height + ' on this screen, but the screen supports up to ' + d.maxHz + ' Hz at that size.' + (big ? ' A lot of PCs are left at 60 Hz after a new monitor or a driver update.' : ''),
          'Settings, System, Display, Advanced display, pick this monitor, and choose the highest refresh rate. If it will not go higher, check the cable (use DisplayPort for high refresh) and the monitor\'s own menu.');
      }
    });
    if (disp.length) {
      var ok = disp.filter(function (d) { return d.hz && d.maxHz && d.hz >= d.maxHz - 1; });
      if (ok.length === disp.length) add('hz', 'ok', 'Every screen is at its highest refresh rate', disp.map(function (d) { return d.name + ': ' + d.hz + ' Hz'; }).join('. ') + '.');
    }
    var hasDiscrete = gpus.some(function (g) { return discrete(g.name); });
    if (hasDiscrete && disp.length) {
      var onIgpu = disp.filter(function (d) { return integrated(d.adapter); }), onDgpu = disp.filter(function (d) { return discrete(d.adapter); });
      if (onIgpu.length && !onDgpu.length) {
        add('igpu-all', 'fix', 'Your screens are plugged into the motherboard, not the graphics card',
          'Every screen is connected through the processor\'s built-in graphics (' + onIgpu[0].adapter + '), so your graphics card may not be doing the work.',
          'Turn the PC off and move the monitor cable from the motherboard video ports to the ports on your graphics card.');
      } else if (onIgpu.length) {
        add('igpu-some', 'info', onIgpu.map(function (d) { return d.name; }).join(', ') + ' is on the built-in graphics',
          'That screen is connected through ' + onIgpu[0].adapter + ', not your graphics card. That is fine for a spare screen (telemetry, chat), but the screen you race on should be on the graphics card. Running it at ' + onIgpu[0].hz + ' Hz is normal for a built-in port.');
      }
    }

    // ---- graphics driver age ----
    gpus.forEach(function (g) {
      if (!g.date || !discrete(g.name)) return;
      var days = Math.floor((now - new Date(g.date + 'T00:00:00Z')) / 86400000);
      if (days > 365) add('driver', 'check', 'Your graphics driver is over a year old', g.name + ' driver dated ' + g.date + '. Newer drivers often include fixes for newer game versions.', 'Download the current driver from the graphics card maker\'s website.');
      else add('driver', 'ok', 'Graphics driver is recent', g.name + ' driver dated ' + g.date + '.');
    });

    // ---- graphics card link and Resizable BAR (NVIDIA only) ----
    var nv = f.nvidia;
    if (nv) {
      var busy = (nv.utilPct || 0) >= 30 || (nv.clockMaxMHz && nv.clockMHz >= nv.clockMaxMHz * 0.6);
      if (nv.pcieWidthMax && nv.pcieWidth) {
        if (!busy) {
          add('pcie', 'info', 'Graphics card link: x' + nv.pcieWidth + ' now (up to x' + nv.pcieWidthMax + ')',
            'The graphics card was idle when this was read, and the link slows itself down when idle, so the reading is not reliable. Run this check again while iRacing or LMU is running a session.');
        } else if (nv.pcieWidth < nv.pcieWidthMax) {
          add('pcie', 'fix', 'Your graphics card is running at x' + nv.pcieWidth + ' instead of x' + nv.pcieWidthMax,
            'The card is connected with fewer lanes than it supports, which can limit it. Common causes are the wrong slot, dust or a loose card, or a second device (such as an extra drive) sharing the lanes.',
            'Check the card is in the top x16 slot and fully clicked in, and look in the motherboard manual for slots that share lanes.');
        } else if (nv.pcieGen < nv.pcieGenMax) {
          add('pcie', 'check', 'Graphics card link speed is PCIe ' + nv.pcieGen + ' (it supports ' + nv.pcieGenMax + ')', 'The link is running slower than the card supports. A PCIe BIOS setting set to "Gen 3", or an older motherboard slot, can cause this.', 'Check the PCIe speed setting in the BIOS is Auto or the highest generation.');
        } else add('pcie', 'ok', 'Graphics card link is full speed', 'PCIe ' + nv.pcieGen + ' x' + nv.pcieWidth + '.');
      }
      if (nv.rebar === false) add('rebar', 'check', 'Resizable BAR looks switched off', 'Resizable BAR lets the processor use all of the graphics card\'s memory at once. On many PCs it is worth a few percent in some games, and it is rarely harmful. Gains vary by game.', 'In the BIOS, turn on "Above 4G Decoding" and then "Resizable BAR" (or "Smart Access Memory" on AMD). Your graphics driver must support it.');
      else if (nv.rebar === true) add('rebar', 'ok', 'Resizable BAR is on', 'Your graphics card can reach all of its memory at once.');
    } else if (hasDiscrete) {
      add('nvidia', 'info', 'Graphics card link and Resizable BAR were not checked', 'These checks use the NVIDIA driver\'s own tool, which was not found on this PC, so they are skipped for other graphics cards.');
    }

    // ---- Windows gaming settings ----
    if (f.gameMode === 0) add('gamemode', 'check', 'Windows Game Mode is off', 'Game Mode asks Windows to prioritise a running game. It is on by default, and someone has switched it off here.', 'Settings, Gaming, Game Mode: turn it on and compare a capture.');
    if (f.appCapture === 1 || f.gameDvr === 1) add('gamedvr', 'check', 'Xbox game capture is on in the background', 'Windows can record your games in the background, which costs some frame rate and adds stutter on some PCs.', 'Settings, Gaming, Captures: turn off background recording.');
    else if (f.appCapture === 0 || f.gameDvr === 0) add('gamedvr', 'ok', 'Background game capture is off', '');
    if (f.vbs === 2 || f.hvci === 1) add('vbs', 'check', 'Memory integrity (virtualisation security) is on', 'This Windows security feature can cost a few percent of frame rate in some games. It protects against some attacks, so it is your call, not a fix.', 'Windows Security, Device security, Core isolation: Memory integrity. Turning it off lowers protection, so only do it if you accept that.');
    else if (f.vbs === 0 || f.hvci === 0) add('vbs', 'ok', 'Virtualisation security is not slowing games', 'Memory integrity is off.');
    if (f.hags === 2 || f.hags === 1) add('hags', 'info', 'Hardware-accelerated GPU scheduling is ' + (f.hags === 2 ? 'on' : 'off'),
      'Results vary between PCs and games. It is a setting to test, not a fix.', 'Settings, System, Display, Graphics, Default graphics settings.');

    // ---- storage ----
    var disks = (f.disks || []).filter(function (d) { return d.bus !== 'USB'; });
    if (disks.length) {
      var ssd = disks.filter(function (d) { return d.media === 'SSD' || d.bus === 'NVMe'; });
      var hdd = disks.filter(function (d) { return d.media === 'HDD'; });
      if (!ssd.length) add('storage', 'fix', 'No solid state drive found', 'Games on a hard disk load tracks slowly and can stutter when they stream scenery.', 'Install your sim on an SSD.');
      else if (hdd.length) add('storage', 'info', 'You have a hard disk as well as an SSD', 'Make sure your sim is installed on the SSD, not the hard disk.');
      else add('storage', 'ok', 'Your drives are all SSD', ssd.map(function (d) { return d.name + ' (' + d.gb + ' GB, ' + d.bus + ')'; }).join('; ') + '.');
    }

    // ---- Windows version ----
    if (f.os && f.os.build) {
      if (f.os.build < 19041) add('os', 'check', 'Your Windows version is old', f.os.caption + ' (build ' + f.os.build + ').', 'Update Windows.');
      else add('os', 'ok', 'Windows version', f.os.caption + ' (build ' + f.os.build + ').');
    }
    if (f.cpu) add('cpu', 'info', 'Processor', f.cpu.name + ': ' + f.cpu.cores + ' cores, ' + f.cpu.threads + ' threads.');

    if (f.errors && f.errors.length) add('errors', 'info', 'Some checks could not run', f.errors.join(' | '));
    out.sort(function (a, b) { return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]; });
    return out;
  }

  var LABEL = { fix: 'Fix this', check: 'Worth a look', info: 'Good to know', ok: 'Fine' };
  function asText(findings) {
    var lines = ['PC check (Dialed)'];
    findings.forEach(function (x) { lines.push('[' + LABEL[x.level] + '] ' + x.title + (x.text ? ': ' + x.text : '') + (x.fix && x.level !== 'ok' ? ' Fix: ' + x.fix : '')); });
    return lines.join('\n');
  }

  var api = { evaluate: evaluate, asText: asText, LABEL: LABEL };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---------- the screen ----------
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var last = [];
  function render(findings, raw) {
    last = findings;
    var counts = { fix: 0, check: 0 }; findings.forEach(function (x) { if (counts[x.level] !== undefined) counts[x.level]++; });
    $('pcSummary').textContent = counts.fix || counts.check
      ? (counts.fix ? plural(counts.fix, 'thing', 'things') + ' to fix' : '') + (counts.fix && counts.check ? ' and ' : '') + (counts.check ? plural(counts.check, 'thing', 'things') + ' worth a look' : '') + '.'
      : 'Nothing to fix. Your PC looks set up well.';
    $('pcList').innerHTML = findings.map(function (x) {
      return '<div class="pcf ' + x.level + '"><span class="pct">' + LABEL[x.level] + '</span><div><b>' + esc(x.title) + '</b>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') +
        (x.fix && x.level !== 'ok' ? '<p class="pcfix"><b>What to do:</b> ' + esc(x.fix) + '</p>' : '') + '</div></div>';
    }).join('');
    $('pcResults').hidden = false; $('pcCopy').hidden = false;
  }
  function run() {
    var btn = $('pcRun'), host = window.TunerHost;
    if (!host || !host.pcCheck) { $('pcSummary').textContent = 'The PC check needs the Windows app. It cannot read your PC from a web page.'; $('pcResults').hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Checking...'; $('pcSummary').textContent = 'Reading your PC settings. This takes a few seconds.'; $('pcResults').hidden = false; $('pcList').innerHTML = '';
    host.pcCheck().then(function (m) {
      btn.disabled = false; btn.textContent = 'Run PC check again';
      if (!m.ok) { $('pcSummary').textContent = 'The check could not run: ' + (m.message || 'unknown error') + '. Use Report a problem and the log will help.'; return; }
      render(evaluate(m.facts), m.facts);
    });
  }
  var b = $('pcRun'); if (b) b.addEventListener('click', run);
  var c = $('pcCopy');
  if (c) c.addEventListener('click', function () {
    var text = asText(last), done = function () { c.textContent = 'Copied'; setTimeout(function () { c.textContent = 'Copy as text'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { c.textContent = 'Could not copy'; });
  });
  root.TunerPc = { run: run, evaluate: evaluate };
})(typeof self !== 'undefined' ? self : this);
