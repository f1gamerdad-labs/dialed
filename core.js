/* Sim Racing Graphics Optimiser - core logic (no AI, no network).
   Works in the browser (window.TunerCore) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TunerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- PresentMon capture parsing ----------
  var ALIASES = {
    ft: ['msbetweenpresents', 'frametime'],
    cpuBusy: ['mscpubusy', 'cpubusy'],
    gpuBusy: ['msgpubusy', 'gpubusy', 'msgpuactive'],
    gpuUtil: ['gpuutilization'],
    vramSize: ['gpumemorysize'],
    vramUsed: ['gpumemorysizeused'],
    frameType: ['frametype'],
    app: ['application']
  };

  function num(v) {
    if (v === undefined || v === '' || v === 'NA') return NaN;
    var n = parseFloat(v);
    return isFinite(n) ? n : NaN;
  }

  function parseCapture(text, name) {
    var lines = text.split(/\r?\n/);
    var header = (lines[0] || '').replace(/^﻿/, '').split(',').map(function (h) { return h.trim().toLowerCase(); });
    var col = {};
    Object.keys(ALIASES).forEach(function (k) {
      col[k] = -1;
      for (var i = 0; i < ALIASES[k].length && col[k] < 0; i++) col[k] = header.indexOf(ALIASES[k][i]);
    });
    if (col.ft < 0) throw new Error('"' + name + '" does not look like a PresentMon capture (no frame time column).');

    var cap = { name: name, app: '', ft: [], cpuBusy: [], gpuBusy: [], gpuUtil: [], vramSize: NaN, vramUsedMax: NaN };
    for (var r = 1; r < lines.length; r++) {
      if (!lines[r]) continue;
      var c = lines[r].split(',');
      if (col.frameType >= 0 && c[col.frameType] && c[col.frameType] !== 'Application') continue;
      var ft = num(c[col.ft]);
      if (!(ft > 0)) continue;
      cap.ft.push(ft);
      cap.cpuBusy.push(col.cpuBusy >= 0 ? num(c[col.cpuBusy]) : NaN);
      cap.gpuBusy.push(col.gpuBusy >= 0 ? num(c[col.gpuBusy]) : NaN);
      cap.gpuUtil.push(col.gpuUtil >= 0 ? num(c[col.gpuUtil]) : NaN);
      if (!cap.app && col.app >= 0) cap.app = c[col.app];
      if (col.vramSize >= 0) { var s = num(c[col.vramSize]); if (s > 0) cap.vramSize = s; }
      if (col.vramUsed >= 0) { var u = num(c[col.vramUsed]); if (u > 0 && !(u <= cap.vramUsedMax)) cap.vramUsedMax = u; }
    }
    if (cap.ft.length < 300) throw new Error('"' + name + '" has too few frames (' + cap.ft.length + '). Capture at least 30 seconds on track.');
    return cap;
  }

  // ---------- statistics ----------
  function sorted(a) { return a.filter(isFinite).sort(function (x, y) { return x - y; }); }
  function pct(s, p) { // s is sorted
    if (!s.length) return NaN;
    var i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  }
  function mean(a) { var f = a.filter(isFinite); return f.length ? f.reduce(function (x, y) { return x + y; }, 0) / f.length : NaN; }

  function summarise(caps) {
    if (!Array.isArray(caps)) caps = [caps];
    var ft = [], cpu = [], gpu = [], util = [], vramSize = NaN, vramUsed = NaN;
    caps.forEach(function (c) {
      ft = ft.concat(c.ft); cpu = cpu.concat(c.cpuBusy); gpu = gpu.concat(c.gpuBusy); util = util.concat(c.gpuUtil);
      if (c.vramSize > 0) vramSize = c.vramSize;
      if (c.vramUsedMax > 0 && !(c.vramUsedMax <= vramUsed)) vramUsed = c.vramUsedMax;
    });
    var n = ft.length, total = ft.reduce(function (x, y) { return x + y; }, 0);
    // How much do separate captures disagree about the 1% low? Large spread means a noisy comparison.
    var lows = caps.map(function (c) { return 1000 / pct(sorted(c.ft), 0.99); });
    var lowSpread = lows.length > 1 ? (Math.max.apply(null, lows) - Math.min.apply(null, lows)) / mean(lows) : 0;
    var sft = sorted(ft), med = pct(sft, 0.5);
    var medCpu = pct(sorted(cpu), 0.5), medGpu = pct(sorted(gpu), 0.5);

    var gpuRatio = [], i;
    for (i = 0; i < n; i++) if (isFinite(gpu[i])) gpuRatio.push(Math.min(1, gpu[i] / ft[i]));

    // Stutters: frames far longer than normal, and which side caused them.
    var spikeAt = Math.max(med * 2, med + 4), spikes = 0, spikeCpu = 0, spikeGpu = 0;
    // Slowest 5% of frames: which side is holding them back?
    var slowAt = pct(sft, 0.95), slow = 0, slowGpu = 0;
    for (i = 0; i < n; i++) {
      if (ft[i] > spikeAt) {
        spikes++;
        var dc = cpu[i] - medCpu, dg = gpu[i] - medGpu;
        if (isFinite(dg) && dg > dc) spikeGpu++; else if (isFinite(dc)) spikeCpu++;
      }
      if (ft[i] >= slowAt && isFinite(gpu[i])) { slow++; if (gpu[i] / ft[i] >= 0.9) slowGpu++; }
    }

    return {
      frames: n,
      captureCount: caps.length,
      lowSpread: lowSpread,
      seconds: total / 1000,
      avgFps: 1000 * n / total,
      low1: 1000 / pct(sft, 0.99),
      low01: 1000 / pct(sft, 0.999),
      medianMs: med,
      hasGpu: gpuRatio.length > n * 0.5,
      gpuLoad: pct(sorted(gpuRatio), 0.5),          // share of each frame the GPU was busy
      gpuUtil: mean(util),
      spikes: spikes,
      spikesPerMin: spikes / (total / 60000),
      spikeSide: spikes ? (spikeGpu > spikeCpu ? 'gpu' : 'cpu') : null,
      slowSide: slow ? (slowGpu / slow > 0.5 ? 'gpu' : 'cpu') : null,
      vramSizeMB: vramSize / 1048576,
      vramUsedMB: vramUsed / 1048576,
      vramPct: vramUsed / vramSize
    };
  }

  // ---------- iRacing .ini parsing ----------
  function parseIni(text) {
    var out = {}, sec = '';
    text.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*\[(.+?)\]\s*$/);
      if (m) { sec = m[1]; out[sec] = out[sec] || {}; return; }
      m = line.match(/^\s*([^=;\s][^=;]*?)\s*=\s*([^;\t]*?)\s*(;.*)?$/);
      if (m && sec) out[sec][m[1]] = m[2];
    });
    return out;
  }

  function iniNum(ini, sec, key) { return ini && ini[sec] && ini[sec][key] !== undefined ? parseFloat(ini[sec][key]) : NaN; }

  // ---------- diagnosis ----------
  var GOALS = {
    smooth:   { label: 'Smoothness',  floor: 0.95, raise: 0 },
    balanced: { label: 'Balanced',    floor: 0.80, raise: 3 },
    eyecandy: { label: 'Eye candy',   floor: 0.65, raise: 6 }
  };

  // Each sim says where its frame cap and refresh rate live. These are iRacing's.
  function iracingCapInfo(ini) {
    var g = 'Graphics Options', cap = NaN;
    if (iniNum(ini, g, 'LimitFrameRate') === 1) cap = iniNum(ini, g, 'DesiredFPSLimit');
    var refresh = iniNum(ini, 'Display', 'RefreshRate');
    if (iniNum(ini, g, 'VerticalSync') === 1 && refresh > 0) cap = isFinite(cap) ? Math.min(cap, refresh) : refresh;
    return { cap: cap, refresh: refresh };
  }

  function diagnose(m, ini, opts) {
    var info = (opts.capInfo || iracingCapInfo)(ini), cap = info.cap, refresh = info.refresh;

    var target = opts.target > 0 ? opts.target : (isFinite(cap) ? cap : (refresh > 0 ? refresh : 60));
    var goal = GOALS[opts.goal] || GOALS.balanced;
    var floorFps = target * goal.floor;

    var capped = isFinite(cap) && m.avgFps >= cap * 0.97;
    var gpuBound = m.hasGpu ? m.gpuLoad >= 0.9 : m.gpuUtil >= 92;
    var known = m.hasGpu || isFinite(m.gpuUtil);
    var limiter = capped ? 'cap' : !known ? 'unknown' : gpuBound ? 'gpu' : 'cpu';
    // Which part to relieve when frame rate needs to come up.
    var relieve = limiter === 'cap' ? (m.slowSide || 'cpu') : limiter === 'unknown' ? 'gpu' : limiter;

    return {
      cap: cap, capped: capped, target: target, goal: goal, floorFps: floorFps,
      limiter: limiter, relieve: relieve,
      deficit: floorFps / m.low1 - 1,            // > 0 means 1% lows are below the goal's floor
      gpuHeadroom: known && (m.hasGpu ? m.gpuLoad < 0.8 : m.gpuUtil < 80),
      vram: !(m.vramPct > 0) ? 'unknown' : m.vramPct >= 0.9 ? 'pressure' : m.vramPct >= 0.85 ? 'watch' : 'ok',
      stutter: m.spikesPerMin >= 6 ? 'bad' : m.spikesPerMin >= 2 ? 'some' : 'ok'
    };
  }

  // ---------- recommendations ----------
  function levelIndex(s, v) { // index of the highest level <= current value
    var idx = -1;
    for (var i = 0; i < s.levels.length; i++) {
      if (s.inverted ? s.levels[i] === v : s.levels[i] <= v) idx = i;
    }
    return idx;
  }
  function label(s, v) {
    var i = s.levels.indexOf(v);
    return s.labels && i >= 0 ? s.labels[i] + ' (' + v + ')' : String(v);
  }
  function active(s, opt) { // setting only matters when its parent setting is on
    if (!s.requires) return true;
    return Object.keys(s.requires).every(function (k) { return parseFloat(opt[k]) === s.requires[k]; });
  }

  // What earlier rounds tell us: what was reverted, what was skipped, and what demonstrably helped.
  function readHistory(hist) {
    var mem = { reverted: {}, skips: {}, ev: {} };
    hist.forEach(function (r, idx) {
      var recent = idx >= hist.length - 3;
      var changesMade = r.applied.filter(function (c) { return c.dir !== 'revert'; }).length;
      r.applied.forEach(function (c) {
        if (c.dir === 'revert') { if (recent) mem.reverted[c.key] = c.name; return; }
        if (!r.result || changesMade > 2) return; // an outcome can only be credited when few changes were made together
        var e = mem.ev[c.key] = mem.ev[c.key] || { helped: 0, noEffect: 0, hurt: 0 };
        if (r.result.verdict === 'better') e.helped++; else if (r.result.verdict === 'same') e.noEffect++; else e.hurt++;
      });
      (r.skipped || []).forEach(function (k) { mem.skips[k] = (mem.skips[k] || 0) + 1; });
    });
    return mem;
  }
  function histWeight(mem, key) {
    var w = 1, e = mem.ev[key];
    // A step that did nothing is demoted hard: a further step on the same setting is unlikely to be the lever.
    if (e) w *= (1 + 0.3 * e.helped) / ((1 + 2 * e.noEffect) * (1 + 0.6 * e.hurt));
    return w * Math.pow(0.8, mem.skips[key] || 0);
  }
  var TIER_ORDER = { first: 0, worth: 1, last: 2, spare: 3 };

  // section: 'Graphics Options' (driving) or 'Replay Graphics' (replays). Memory and cap settings always live in Graphics Options.
  // ctx.history: earlier rounds for this section, used to rank (not just to filter) the new suggestions.
  function recommend(m, d, ini, table, section, ctx) {
    var opt = (ini && ini[section || 'Graphics Options']) || {};
    var gopt = (ini && ini['Graphics Options']) || {};
    var changes = [], notes = [], used = {};
    var mem = readHistory((ctx && ctx.history) || []);
    var power = d.goal === GOALS.eyecandy ? 2 : 1; // eye candy protects high-impact visuals harder

    // How far can we trust the diagnosis this round?
    var issues = [];
    if (d.limiter === 'unknown') issues.push('the limiting part could not be identified');
    if (m.captureCount < 2) issues.push('there is only one capture');
    else if (m.lowSpread >= 0.12) issues.push('your captures disagree with each other');
    if (m.seconds / Math.max(1, m.captureCount) < 45) issues.push('the captures are short');
    var diagGood = issues.length === 0;

    function benefit(s, part) { // cost is squared so one heavy setting outranks several light ones
      return s[part] * s[part] / Math.pow(s.visual + 0.5, power) * histWeight(mem, s.key);
    }
    // A setting can live in a different file section from the default (LMU keeps video and graphics settings apart).
    function optOf(s) { return (ini && ini[s.section || section || 'Graphics Options']) || {}; }
    function add(s, toIdx, dir, why, part, forceTier) {
      if (used[s.key]) return;
      used[s.key] = true;
      var from = parseFloat(optOf(s)[s.key]), to = s.levels[toIdx];
      var relief = part ? s[part] : 0, ev = mem.ev[s.key];
      var tier = forceTier || (dir === 'up' ? 'spare' : relief >= 2 && s.visual <= 1 ? 'first' : s.visual >= 3 ? 'last' : 'worth');
      var conf, confWhy;
      if (s.unverified && !(ev && ev.helped > 0)) { conf = 'low'; confWhy = 'How this setting behaves in this sim is not confirmed yet, so treat it as a good guess.'; }
      else if (ev && ev.noEffect > 0 && !ev.helped) { conf = 'low'; confWhy = 'This showed no effect on your PC earlier.'; }
      else if (ev && ev.helped > 0 && !ev.hurt && diagGood) { conf = 'high'; confWhy = 'This helped on your PC in an earlier round.'; }
      else if (diagGood && relief >= 2) { conf = 'medium'; confWhy = 'Heavy on the part limiting you. The size of the gain is an estimate until you test it.'; }
      else { conf = 'low'; confWhy = issues.length ? 'Less certain because ' + issues.join(' and ') + '.' : 'Only a light effect on the part limiting you.'; }
      changes.push({ key: s.key, name: s.name, scope: s.scope, section: s.section || section || 'Graphics Options', from: from, to: to,
        fromLabel: label(s, from), toLabel: label(s, to), dir: dir, why: why, cpu: s.cpu, gpu: s.gpu, vram: s.vram, visual: s.visual,
        relief: relief, tier: tier, confidence: conf, confWhy: confWhy,
        score: dir === 'up' ? s.visual / (s.cpu + s.gpu + 0.5) * histWeight(mem, s.key) : part ? benefit(s, part) : 0 });
    }
    function candidates(dir) {
      return table.settings.map(function (s) {
        var o = optOf(s);
        if (o[s.key] === undefined || !active(s, o) || mem.reverted[s.key]) return null;
        var i = levelIndex(s, parseFloat(o[s.key]));
        if (i < 0) return null;
        var j = i + dir;
        if (j < 0 || j >= s.levels.length) return null;
        if (dir < 0 && s.min !== undefined && !s.inverted && s.levels[j] < s.min) return null;
        if (dir < 0 && s.minIndex !== undefined && j < s.minIndex) return null;
        if (dir > 0 && s.noRaise) return null;
        return { s: s, to: j };
      }).filter(Boolean);
    }
    var PART = { cpu: 'processor (CPU)', gpu: 'graphics card (GPU)', vram: 'graphics memory (VRAM)' };

    // 1. Graphics memory pressure is fixed first: it causes stutter whatever the frame rate.
    if (d.vram === 'pressure') {
      candidates(-1).filter(function (c) { return c.s.vram >= 2; })
        .sort(function (a, b) { return benefit(b.s, 'vram') - benefit(a.s, 'vram'); })
        .slice(0, 3).forEach(function (c) {
          add(c.s, c.to, 'down', 'Frees graphics memory, which is ' + Math.round(m.vramPct * 100) + '% full.', 'vram', 'first');
        });
    }

    // 2. Below the goal's frame-rate floor: cut what loads the limiting part, cheapest-looking first.
    if (d.deficit > 0) {
      var r = d.relieve, count = d.deficit < 0.10 ? 3 : d.deficit < 0.25 ? 6 : 10;
      candidates(-1).filter(function (c) { return c.s[r] > 0; })
        .sort(function (a, b) { return benefit(b.s, r) - benefit(a.s, r); })
        .slice(0, count).forEach(function (c) {
          add(c.s, c.to, 'down', 'Takes ' + ['', 'a little', 'a fair amount of', 'a lot of'][c.s[r]] + ' load off the ' + PART[r] +
            ' for ' + ['no', 'a small', 'a moderate', 'a big'][c.s.visual] + ' visual cost.', r);
        });
    }

    // 3. Comfortably above the floor: spend spare capacity on visuals (not for the smoothness goal).
    if (d.deficit <= -0.10 && d.goal.raise > 0 && d.vram !== 'pressure') {
      var spare = d.limiter === 'cap' ? (d.gpuHeadroom ? 'gpu' : null) : d.limiter === 'gpu' ? 'cpu' : d.limiter === 'cpu' ? 'gpu' : null;
      if (spare) {
        var other = spare === 'gpu' ? 'cpu' : 'gpu';
        candidates(+1).filter(function (c) {
          return c.s.visual > 0 && c.s[spare] > 0 && c.s[other] <= 1 && (d.vram === 'ok' || !c.s.vram);
        })
          .sort(function (a, b) {
            return b.s.visual / (b.s.cpu + b.s.gpu + 0.5) * histWeight(mem, b.s.key) - a.s.visual / (a.s.cpu + a.s.gpu + 0.5) * histWeight(mem, a.s.key);
          })
          .slice(0, d.goal.raise).forEach(function (c) {
            add(c.s, c.to, 'up', 'Your ' + PART[spare] + ' has spare capacity, and this mostly uses that.', spare);
          });
      } else if (d.limiter === 'cap') {
        notes.push('You are holding your frame cap, but the graphics card is already working hard, so there is no clear room to add visuals.');
      }
    }

    if (d.deficit >= 0.25)
      notes.push('Your 1% lows (' + Math.round(m.low1) + ' FPS) are a long way below the ' + Math.round(d.floorFps) +
        ' FPS this goal needs at a ' + Math.round(d.target) + ' FPS target. These changes may not close the gap on their own. ' +
        'A lower target or frame cap of about ' + Math.round(m.low1) + ' FPS would feel steadier on this hardware.');

    // 4. Checks that apply whatever the goal.
    var vid = parseFloat(gopt.VidMemToUseMB);
    if (vid > 0 && m.vramSizeMB > 0 && vid > m.vramSizeMB * 0.95)
      notes.push('The video memory slider (' + vid + ' MB) is set above what your card has (' + Math.round(m.vramSizeMB) + ' MB). Lower it to about ' + Math.round(m.vramSizeMB * 0.8) + ' MB.');
    if (parseFloat(gopt.CompressTexturesCars) === 0 && d.vram !== 'ok')
      notes.push('Car textures are uncompressed, which uses a lot of graphics memory.');
    if (d.stutter !== 'ok' && m.spikeSide === 'cpu')
      notes.push('Most stutters start on the processor side. Before changing settings, close browsers, overlays and dashboard apps and capture again, because background programs are a common cause.');
    if (d.stutter !== 'ok' && m.spikeSide === 'gpu')
      notes.push('Most stutters start on the graphics card side. Graphics memory pressure and shader or texture loading are the usual causes.');
    if (!isFinite(d.cap))
      notes.push('No frame rate limit is set. Capping a few FPS below your refresh rate usually gives steadier frame times.');
    if (d.limiter === 'unknown')
      notes.push('This capture has no graphics card timing columns, so the tool cannot tell which part is the limit. Capture with PresentMon 2.x for a full diagnosis.');

    var held = Object.keys(mem.reverted).filter(function (k) {
      return table.settings.some(function (s) { return s.key === k && optOf(s)[k] !== undefined; });
    });
    if (held.length)
      notes.push('Leaving alone because you reverted them recently: ' + held.map(function (k) { return mem.reverted[k]; }).join(', ') + '.');
    if (changes.length && !diagGood)
      notes.push('Confidence is lower this round because ' + issues.join(' and ') + '. Capture two or three full 60 second runs for firmer advice.');

    // Priority order: fix first, then worth trying, then only-if-needed, then spending spare capacity; best score first within each.
    changes.sort(function (a, b) { return TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.score - a.score; });
    changes.forEach(function (c, i) { c.priority = i + 1; });

    return { changes: changes, notes: notes };
  }

  // ---------- rounds: what was changed, and how it worked ----------
  function snapshot(m, names) {
    return { avgFps: m.avgFps, low1: m.low1, low01: m.low01, gpuLoad: m.gpuLoad, spikesPerMin: m.spikesPerMin,
      vramPct: isFinite(m.vramPct) ? m.vramPct : null, captureNames: names.slice().sort() };
  }

  // Compare new captures with the baseline of the last applied round and
  // check the .ini to see what actually got changed.
  function assessRound(prev, m, d, ini, table, names) {
    var b = prev.baseline;
    var sameCaptures = names.slice().sort().join('|') === b.captureNames.join('|');
    var out = { sameCaptures: sameCaptures, verdict: null, delta: null, verify: [], reverts: [], notes: [] };

    out.verify = prev.applied.map(function (c) {
      var actual = parseFloat(((ini && ini[c.section || prev.section || 'Graphics Options']) || {})[c.key]);
      return { key: c.key, name: c.name, from: c.from, to: c.to, actual: actual,
        status: actual === c.to ? 'applied' : actual === c.from ? 'notApplied' : 'other' };
    });
    if (sameCaptures) {
      out.notes.push('These are the same captures you analysed before the changes, so there is nothing to compare yet. Apply the changes, then capture again.');
      return out;
    }

    out.delta = { avgFps: m.avgFps - b.avgFps, low1: m.low1 - b.low1, low01: m.low01 - b.low01,
      spikesPerMin: m.spikesPerMin - b.spikesPerMin, vramPct: (b.vramPct !== null && isFinite(m.vramPct)) ? m.vramPct - b.vramPct : null };
    if (m.seconds < 45) out.notes.push('This capture is only ' + Math.round(m.seconds) +
      ' seconds long, so the stutter count and 0.1% lows are unreliable. Capture 60 seconds for a fair comparison.');
    var rel = out.delta.low1 / b.low1;
    out.verdict = rel <= -0.03 ? 'worse' : rel >= 0.03 ? 'better' : 'same';

    var inPlace = out.verify.filter(function (v) { return v.status === 'applied'; });
    var notApplied = out.verify.filter(function (v) { return v.status === 'notApplied'; });
    var other = out.verify.filter(function (v) { return v.status === 'other'; });
    if (notApplied.length) out.notes.push(notApplied.length + ' of the changes are not in your .ini file (' +
      notApplied.map(function (v) { return v.name; }).join(', ') + '). Results below only reflect the ones that went in.');
    if (other.length) out.notes.push(other.length + ' setting(s) were changed to something different from what was recommended (' +
      other.map(function (v) { return v.name; }).join(', ') + ').');

    function find(key) { for (var i = 0; i < table.settings.length; i++) if (table.settings[i].key === key) return table.settings[i]; }
    function revertOf(v, c, why, def) {
      var s = find(v.key);
      return { key: v.key, name: v.name, section: c.section || prev.section, from: v.actual, to: v.from, dir: 'revert',
        fromLabel: s ? label(s, v.actual) : String(v.actual), toLabel: s ? label(s, v.from) : String(v.from),
        why: why, visual: c.visual, defaultChecked: def };
    }
    var byKey = {};
    prev.applied.forEach(function (c) { byKey[c.key] = c; });

    if (out.verdict === 'worse') {
      inPlace.forEach(function (v) {
        out.reverts.push(revertOf(v, byKey[v.key], 'Your 1% lows went from ' + Math.round(b.low1) + ' to ' + Math.round(m.low1) +
          ' FPS after this round, so putting this back is the safe move.', true));
      });
    } else if (inPlace.length) {
      var smooth = d.goal === GOALS.smooth;
      var room = smooth ? d.deficit <= -0.15 : d.deficit <= -0.10;
      if (room) {
        inPlace.filter(function (v) { return byKey[v.key].visual >= (smooth ? 3 : 2); })
          .sort(function (x, y) { return byKey[y.key].visual - byKey[x.key].visual; })
          .slice(0, smooth ? 1 : 2).forEach(function (v) {
            out.reverts.push(revertOf(v, byKey[v.key], 'You are now ' + Math.round(-d.deficit * 100) + '% above what this goal needs, ' +
              'and this change cost visible quality. You can probably afford to give it back.', false));
          });
      }
    }
    // No measurable gain: a change that cost some looks bought nothing, so offer to put those looks back (never ticked by default).
    if (!out.reverts.length && out.verdict === 'same') {
      inPlace.filter(function (v) { return byKey[v.key].visual >= 1; })
        .sort(function (x, y) { return byKey[y.key].visual - byKey[x.key].visual; })
        .slice(0, 2).forEach(function (v) {
          out.reverts.push(revertOf(v, byKey[v.key], 'No measurable gain from this change, so you can put the looks back without losing any frame rate.', false));
        });
    }
    if (inPlace.length > 1) out.notes.push('The changes went in together, so the tool cannot tell which one helped most. ' +
      'Apply fewer changes per round if you want to learn what each one does on your PC.');
    return out;
  }

  // ---------- write the changes back into the .ini text ----------
  function patchIni(text, changes, section) {
    var want = {}, sec = '', target = section || 'Graphics Options';
    changes.forEach(function (c) { want[c.key] = String(c.to); });
    return text.split(/(\r?\n)/).map(function (line) {
      var m = line.match(/^\s*\[(.+?)\]\s*$/);
      if (m) { sec = m[1]; return line; }
      if (sec !== target) return line;
      m = line.match(/^([^=;\s]+)=(\S*)(\s*)(;.*)?$/);
      if (!m || want[m[1]] === undefined) return line;
      var head = m[1] + '=' + want[m[1]];
      var tabAt = m[3].indexOf('\t');
      var spaces = tabAt >= 0 ? m[3].slice(0, tabAt) : m[3], rest = tabAt >= 0 ? m[3].slice(tabAt) : '';
      var width = (m[1] + '=' + m[2]).length + spaces.length;
      var pad = Math.max(width - head.length, m[4] ? 1 : 0);
      return head + new Array(pad + 1).join(' ') + rest + (m[4] || '');
    }).join('');
  }

  // ---------- Le Mans Ultimate: two files ----------
  // Config_DX11.ini: "Key=value // comment" lines under [COMPONENTS].
  function parseLmuIni(text) {
    var out = {}, sec = '';
    text.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*\[(.+?)\]\s*$/);
      if (m) { sec = m[1]; out[sec] = out[sec] || {}; return; }
      m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*(\/\/.*)?$/);
      if (m && sec) out[sec][m[1]] = m[2];
    });
    return out;
  }
  function decimalsOf(token) { var m = String(token).match(/\.(\d+)/); return m ? m[1].length : 0; }
  function patchLmuIni(text, changes, section) {
    var want = {};
    changes.forEach(function (c) { want[c.key] = c; });
    var sec = '';
    return text.split(/(\r?\n)/).map(function (line) {
      var m = line.match(/^\s*\[(.+?)\]\s*$/);
      if (m) { sec = m[1]; return line; }
      if (sec !== section) return line;
      m = line.match(/^(\s*)([A-Za-z0-9_]+)(\s*=\s*)([^\/\r\n]*?)(\s*(?:\/\/.*)?)$/);
      if (!m || !want[m[2]]) return line;
      var to = want[m[2]].to, d = decimalsOf(m[4]);
      return m[1] + m[2] + m[3] + (d ? to.toFixed(d) : String(to)) + m[5];
    }).join('');
  }

  // Settings.JSON: strict JSON; each setting has a "Key#" comment entry beside it. Booleans become 1/0 so they use the same levels as everything else.
  function parseLmuJson(text) {
    var data = JSON.parse(text.replace(/^﻿/, '')), out = {};
    Object.keys(data).forEach(function (sec) {
      if (!data[sec] || typeof data[sec] !== 'object') return;
      out[sec] = {};
      Object.keys(data[sec]).forEach(function (k) {
        if (/#$/.test(k)) return;
        var v = data[sec][k];
        out[sec][k] = v === true ? '1' : v === false ? '0' : String(v);
      });
    });
    return out;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Edits only the matching "Key": value lines inside the named section; everything else is left exactly as the game wrote it.
  function patchLmuJson(text, changes, section) {
    var want = {};
    changes.forEach(function (c) { want[c.key] = c; });
    var parts = text.split(/(\r?\n)/), inSec = false, indent = '';
    var head = new RegExp('^(\\s*)"' + escRe(section) + '"\\s*:\\s*\\{\\s*$');
    return parts.map(function (line) {
      var m;
      if (!inSec) { if ((m = line.match(head))) { inSec = true; indent = m[1]; } return line; }
      if (line.match(new RegExp('^' + indent + '\\},?\\s*$'))) { inSec = false; return line; }
      m = line.match(/^(\s*)"((?:[^"\\]|\\.)*)"(\s*:\s*)(.*?)(,?)\s*$/);
      if (!m || !want[m[2]]) return line;
      var old = m[4], to = want[m[2]].to, val;
      if (old === 'true' || old === 'false') val = to ? 'true' : 'false';
      else if (/^-?\d+\.\d+$/.test(old)) val = Number.isInteger(to) ? to.toFixed(1) : String(to);
      else val = String(to);
      return m[1] + '"' + m[2] + '"' + m[3] + val + m[5];
    }).join('');
  }

  return { parseCapture: parseCapture, summarise: summarise, parseIni: parseIni, diagnose: diagnose,
    recommend: recommend, patchIni: patchIni, snapshot: snapshot, assessRound: assessRound, GOALS: GOALS,
    parseLmuIni: parseLmuIni, patchLmuIni: patchLmuIni, parseLmuJson: parseLmuJson, patchLmuJson: patchLmuJson };
});
