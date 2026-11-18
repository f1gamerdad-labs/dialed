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

  // The speed a kit is sold at is often written in its part number (F4-3600C16D, CMK32GX4M2D3600C18, KF436C17BB, "3600 Series" ...).
  // Returns { mt, strong } or null. "strong" means a maker's pattern matched; the plain-number fallback is a weaker clue.
  var PART_PATTERNS = [[/DDR[345][-_ ]?(\d{4,5})/i, 1], [/\bF[345]-(\d{4,5})/i, 1], [/[A-Z](\d{4,5})C\d{2}/, 1], [/KF[345](\d{2})C\d{2}/i, 100], [/BL\d+G(\d{2})C\d{2}/i, 100],
    [/PV[A-Z]\d+G(\d{3})C\d/i, 10], [/(\d{4,5})\s*series/i, 1]];
  var STD_SPEEDS = '2133|2400|2666|2933|3000|3200|3466|3600|3733|3800|4000|4133|4266|4400|4800|5200|5600|6000|6400|6800|7200|7600|8000';
  function partSpeed(part) {
    part = String(part || '');
    for (var i = 0; i < PART_PATTERNS.length; i++) {
      var m = PART_PATTERNS[i][0].exec(part);
      if (m) { var mt = parseInt(m[1], 10) * PART_PATTERNS[i][1]; if (mt >= 1600 && mt <= 9000) return { mt: mt, strong: true }; }
    }
    var g = new RegExp('(?<!\\d)(' + STD_SPEEDS + ')(?!\\d)').exec(part);
    return g ? { mt: parseInt(g[1], 10), strong: false } : null;
  }

  // Windows' own screen numbers (DISPLAY3 ...) do not match the numbers in Settings, so screens are named by their model, and identical
  // screens are told apart by where they sit, left to right.
  function labelScreens(disp) {
    var order = disp.slice().sort(function (a, b) { return (a.x || 0) - (b.x || 0); });
    var count = {}; order.forEach(function (d) { var k = d.monitor || d.name; count[k] = (count[k] || 0) + 1; });
    var seen = {}, WORDS = ['left', 'middle', 'right'];
    order.forEach(function (d) {
      var k = d.monitor || d.name; seen[k] = (seen[k] || 0) + 1;
      var base = d.monitor ? d.monitor : 'A screen';
      var place = count[k] > 1 ? (count[k] === 3 ? WORDS[seen[k] - 1] : 'number ' + seen[k] + ' from the left') : '';
      d.label = base + (place ? ' (' + place + ' screen)' : '') + (d.monitor ? '' : ' (' + d.name + ')');
    });
  }

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
      var named = null;
      ram.forEach(function (r) { var p = partSpeed(r.part); if (p && (!named || p.mt > named.mt)) named = { mt: p.mt, strong: p.strong, part: r.part }; });
      var jedec = (ram[0].type === 26 && running && running <= 2666) || (ram[0].type === 34 && running && running <= 4800);
      if (slow.length) {
        add('ram-speed', 'fix', 'Your memory is running slower than it is rated for',
          'Your ' + type + ' is running at ' + running + ' MT/s, but the modules are rated for ' + rated + ' MT/s. This usually means XMP (Intel) or EXPO/DOCP (AMD) is switched off in the BIOS, so the memory runs at a slow default speed.',
          'Restart, open the BIOS, and turn on XMP, DOCP or EXPO (the name depends on your motherboard). Save and restart, then run this check again. If the PC will not start afterwards, reset the BIOS to defaults and try a lower profile.');
      } else if (named && running && running < named.mt * 0.9) {
        add('ram-speed', named.strong ? 'fix' : 'check', 'Your memory is running slower than its part number suggests',
          'Your ' + type + ' is running at ' + running + ' MT/s, but the part number ("' + named.part + '") suggests a ' + named.mt + ' MT/s kit. This usually means XMP (Intel) or EXPO/DOCP (AMD) is switched off in the BIOS. This is worked out from the name on the sticks, so check the label to be sure.',
          'Check the speed printed on the sticks or the box. If it matches ' + named.mt + ', restart, open the BIOS, and turn on XMP, DOCP or EXPO. Save and restart, then run this check again.');
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
    // Plans are recognised by their fixed Windows id first, so this works on every Windows language; the name is only a fallback for custom plans.
    if (f.power && (f.power.name || f.power.guid)) {
      var pn = f.power.name || f.power.guid, pg = String(f.power.guid || '').toLowerCase(), kind = null;
      if (pg.indexOf('a1841308-3541-4fab-bc81-f71556f20b4a') === 0) kind = 'saver';
      else if (pg.indexOf('381b4222-f694-41f0-9685-ff5bb260df2e') === 0) kind = 'balanced';
      else if (pg.indexOf('8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c') === 0 || pg.indexOf('e9a42b02-d5df-448d-aa00-03f14749eb61') === 0) kind = 'performance';
      else if (/power saver/i.test(pn)) kind = 'saver'; else if (/balanced/i.test(pn)) kind = 'balanced'; else if (/high performance|ultimate performance/i.test(pn)) kind = 'performance';
      if (kind === 'saver') add('power', 'fix', 'Windows is on the Power saver plan', 'Power saver keeps your processor clocks low, which costs frame rate.', 'Settings, System, Power: set the power mode to Best performance (or use the High performance plan in Control Panel).');
      else if (kind === 'balanced') add('power', 'check', 'Windows is on the Balanced power plan', 'Balanced is fine for most PCs, but on some it lets processor clocks drop between demands, which can show up as stutter.', 'If you want to try it: Settings, System, Power, set the power mode to Best performance, then compare a capture.');
      else if (kind === 'performance') add('power', 'ok', 'Power plan is set for performance', 'Active plan: ' + pn + '.');
      else add('power', 'info', 'Power plan: ' + pn, 'This is a custom plan, so Dialed cannot tell if it holds your processor speed back. If you are unsure, the Best performance plan is the safe choice for racing.');
    }

    // ---- displays ----
    var disp = f.displays || [], gpus = f.gpus || [];
    labelScreens(disp);
    disp.forEach(function (d) {
      if (!d.hz || !d.maxHz) return;
      if (d.hz < d.maxHz - 1) {
        var big = d.hz <= 60 && d.maxHz >= 100;
        add('hz-' + d.name, big ? 'fix' : 'check', d.label + ' is running at ' + d.hz + ' Hz but can do ' + d.maxHz + ' Hz',
          'Windows is using ' + d.hz + ' Hz at ' + d.width + 'x' + d.height + ' on this screen, but the screen supports up to ' + d.maxHz + ' Hz at that size.' + (big ? ' A lot of PCs are left at 60 Hz after a new monitor or a driver update.' : ''),
          'Settings, System, Display, Advanced display, pick this monitor, and choose the highest refresh rate. If it will not go higher, check the cable (use DisplayPort for high refresh) and the monitor\'s own menu.');
      }
    });
    if (disp.length) {
      var ok = disp.filter(function (d) { return d.hz && d.maxHz && d.hz >= d.maxHz - 1; });
      if (ok.length === disp.length) add('hz', 'ok', 'Every screen is at its highest refresh rate', disp.map(function (d) { return d.label + ': ' + d.hz + ' Hz'; }).join('. ') + '.');
    }
    var hasDiscrete = gpus.some(function (g) { return discrete(g.name); });
    if (hasDiscrete && disp.length) {
      var onIgpu = disp.filter(function (d) { return integrated(d.adapter); }), onDgpu = disp.filter(function (d) { return discrete(d.adapter); });
      if (onIgpu.length && !onDgpu.length) {
        add('igpu-all', 'fix', 'Your screens are plugged into the motherboard, not the graphics card',
          'Every screen is connected through the processor\'s built-in graphics (' + onIgpu[0].adapter + '), so your graphics card may not be doing the work.',
          'Turn the PC off and move the monitor cable from the motherboard video ports to the ports on your graphics card.');
      } else if (onIgpu.length) {
        add('igpu-some', 'info', onIgpu.map(function (d) { return d.label; }).join(', ') + ' is on the built-in graphics',
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
          add('pcie', 'info', 'Graphics card connection not checked (the card was idle)',
            'Your graphics card plugs into the motherboard with a number of data lanes (x16 is the full width). A card that is not working turns some of them off to save power, so it cannot be judged while idle. To check it, run this again while iRacing or LMU is running a session.');
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

    // ---- programs running right now ----
    if (Array.isArray(f.busy)) {
      if (f.busy.length) add('busy', 'check', 'Other programs are running: ' + f.busy.join(', '),
        'Browsers, streaming software, overlays and chat apps use processor and graphics card time and are the most common cause of stutter.', 'Close them (including the ones in the system tray, near the clock) before you race or capture.');
      else add('busy', 'ok', 'No known frame rate hogs are running', 'No browsers, streaming software or overlays were found running.');
    }

    // ---- Windows version ----
    if (f.os && f.os.build) {
      if (f.os.build < 19041) add('os', 'check', 'Your Windows version is old', f.os.caption + ' (build ' + f.os.build + ').', 'Update Windows.');
      else add('os', 'ok', 'Windows version', f.os.caption + ' (build ' + f.os.build + ').');
    }
    if (f.errors && f.errors.length) add('errors', 'info', 'Some checks could not run', f.errors.join(' | '));
    out.sort(function (a, b) { return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]; });
    // one line describing the PC, for the top of the results and for pasting into a chat
    var parts = [];
    if (f.cpu && f.cpu.name) parts.push(f.cpu.name.replace(/\(R\)|\(TM\)|\s+@.*$/g, '').replace(/\s+/g, ' ').trim() + ' (' + f.cpu.cores + ' cores, ' + f.cpu.threads + ' threads)');
    if (ram.length) parts.push(ram.reduce(function (s, r) { return s + r.capGB; }, 0) + ' GB ' + (MEM_TYPE[ram[0].type] || 'memory') + ' at ' + Math.min.apply(null, ram.map(function (r) { return r.configured || 0; }).filter(Boolean)) + ' MT/s');
    var dg = gpus.filter(function (g) { return discrete(g.name); })[0] || gpus[0]; if (dg) parts.push(dg.name);
    if (f.os && f.os.caption) parts.push(f.os.caption.replace(/^Microsoft\s+/, ''));
    out.system = parts.join(', ');
    out.ready = !out.some(function (x) { return x.level === 'fix' || x.level === 'check'; });   // "Ready to race"
    return out;
  }

  var LABEL = { fix: 'Fix this', check: 'Worth a look', info: 'Good to know', ok: 'Fine' };
  function asText(findings) {
    var lines = ['PC check (Dialed)']; if (findings.system) lines.push('Your PC: ' + findings.system);
    findings.forEach(function (x) { lines.push('[' + LABEL[x.level] + '] ' + x.title + (x.text ? ': ' + x.text : '') + (x.fix && x.level !== 'ok' ? ' Fix: ' + x.fix : '')); });
    return lines.join('\n');
  }

  var api = { evaluate: evaluate, asText: asText, partSpeed: partSpeed, LABEL: LABEL };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (typeof document === 'undefined') return;

  // ---------- the screen ----------
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var last = [], lastFacts = null;
  function render(findings, raw) {
    last = findings;
    var counts = { fix: 0, check: 0 }; findings.forEach(function (x) { if (counts[x.level] !== undefined) counts[x.level]++; });
    $('pcSummary').textContent = counts.fix || counts.check
      ? 'Not quite race ready: ' + (counts.fix ? plural(counts.fix, 'thing', 'things') + ' to fix' : '') + (counts.fix && counts.check ? ' and ' : '') + (counts.check ? plural(counts.check, 'thing', 'things') + ' worth a look' : '') + '.'
      : 'Race ready. Nothing to fix, and your PC looks set up well.';
    $('pcSummary').className = 'pcsum ' + (counts.fix ? 'bad' : counts.check ? 'warn' : 'good');
    $('pcSystem').textContent = findings.system ? 'Your PC: ' + findings.system : '';
    // Three groups: things to act on (cards), things to know (compact rows), and everything that is fine (one line each).
    var attn = findings.filter(function (x) { return x.level === 'fix' || x.level === 'check'; });
    var know = findings.filter(function (x) { return x.level === 'info'; });
    var fine = findings.filter(function (x) { return x.level === 'ok'; });
    function row(x) { return '<li><b>' + esc(x.title) + '</b>' + (x.text ? '<span>' + esc(x.text) + '</span>' : '') + '</li>'; }
    var h = '';
    if (attn.length) h += '<div class="pcgroup"><h3>' + (attn.some(function (x) { return x.level === 'fix'; }) ? 'Needs attention' : 'Worth a look') + '</h3>' + attn.map(function (x) {
      return '<div class="pcard pc-' + x.level + '"><div class="pchead"><span class="pcbadge">' + LABEL[x.level] + '</span><b>' + esc(x.title) + '</b></div>' +
        (x.text ? '<p>' + esc(x.text) + '</p>' : '') + (x.fix ? '<p class="pcwhat"><b>What to do</b>' + esc(x.fix) + '</p>' : '') + '</div>';
    }).join('') + '</div>';
    if (know.length) h += '<div class="pcgroup"><h3>Good to know</h3><ul class="pclist">' + know.map(row).join('') + '</ul></div>';
    if (fine.length) h += '<div class="pcgroup"><h3>All fine</h3><ul class="pclist pctick">' + fine.map(row).join('') + '</ul></div>';
    $('pcList').innerHTML = h;
    $('pcResults').hidden = false; $('pcCopy').hidden = false;
    if (root.TunerBadges) root.TunerBadges.event('pc', { ready: !!findings.ready });
  }
  function run() {
    var btn = $('pcRun'), host = window.TunerHost;
    if (!host || !host.pcCheck) { $('pcSummary').textContent = 'The PC check needs the Windows app. It cannot read your PC from a web page.'; $('pcResults').hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Checking...'; $('pcSummary').textContent = 'Reading your PC settings. This takes a few seconds.'; $('pcResults').hidden = false; $('pcList').innerHTML = '';
    host.pcCheck().then(function (m) {
      btn.disabled = false; btn.textContent = 'Run PC check again';
      if (!m.ok) { $('pcSummary').textContent = 'The check could not run: ' + (m.message || 'unknown error') + '. Use Report a problem and the log will help.'; return; }
      lastFacts = m.facts; render(evaluate(m.facts), m.facts);
    });
  }
  var b = $('pcRun'); if (b) b.addEventListener('click', run);
  var c = $('pcCopy');
  if (c) c.addEventListener('click', function () {
    var text = asText(last), done = function () { c.textContent = 'Copied'; setTimeout(function () { c.textContent = 'Copy as text'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { c.textContent = 'Could not copy'; });
  });
  // A short, anonymous description of the PC for "Share my result": model names and sizes only, and only once the PC check has been run.
  function hardware() {
    var f = lastFacts; if (!f) return null;
    var ram = (f.ram || []).filter(function (r) { return r.capGB > 0; }), gpu = (f.gpus || []).filter(function (g) { return discrete(g.name); })[0] || (f.gpus || [])[0];
    var prim = (f.displays || [])[0];
    return { cpu: f.cpu ? f.cpu.name.replace(/\(R\)|\(TM\)|\s+@.*$/g, '').replace(/\s+/g, ' ').trim() : null, gpu: gpu ? gpu.name : null,
      ram: ram.length ? ram.reduce(function (s, r) { return s + r.capGB; }, 0) + ' GB ' + (MEM_TYPE[ram[0].type] || '') + ' ' + Math.min.apply(null, ram.map(function (r) { return r.configured || 0; }).filter(Boolean)) + ' MT/s' : null,
      screens: (f.displays || []).length || null, refreshHz: prim ? prim.hz : null };
  }
  root.TunerPc = { run: run, evaluate: evaluate, hardware: hardware };
})(typeof self !== 'undefined' ? self : this);
