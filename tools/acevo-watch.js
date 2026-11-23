// Watches Assetto Corsa EVO's video.videosettings (a protobuf file) and prints every field that changes.
// Use: node tools\acevo-watch.js   then, in AC EVO, change ONE graphics option at a time and apply it / leave the menu.
// Fields are shown as paths: f19.1 = field 1 inside field 19. A field that disappears reads as "absent" (a value of 0 is not stored).
// Say what you changed (and to what) so each line can be matched to the menu. Log: tools\acevo-watch-output\acevo-changes.log
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const file = path.join(os.homedir(), 'Saved Games', 'ACE', 'video.videosettings');
const outDir = path.join(__dirname, 'acevo-watch-output'); fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'acevo-changes.log');
function log(s) { console.log(s); fs.appendFileSync(logFile, s + '\n'); }

function rv(b, p) { let v = 0, m = 1, x; do { if (p.i >= b.length) throw new Error('truncated'); x = b[p.i++]; v += (x & 127) * m; m *= 128; } while (x & 128); return v; }
function fields(b, from, to) {
  const p = { i: from }, out = [];
  while (p.i < to) {
    const tag = rv(b, p), f = { num: Math.floor(tag / 8), wire: tag % 8 };
    if (f.wire === 0) f.value = rv(b, p);
    else if (f.wire === 2) { const len = rv(b, p); f.pstart = p.i; f.pend = p.i + len; p.i += len; }
    else if (f.wire === 5) { f.value = b.readUInt32LE(p.i); f.float = b.readFloatLE(p.i); p.i += 4; }
    else if (f.wire === 1) { f.value = b.readBigUInt64LE(p.i).toString(); p.i += 8; }
    else throw new Error('unsupported wire type ' + f.wire);
    if (p.i > to) throw new Error('bad length');
    out.push(f);
  }
  return out;
}
// flatten: varints become numbers; a length-delimited field that parses cleanly as a message is expanded one level, otherwise shown as bytes
function flatten(b, from, to, prefix, depth, out) {
  const count = {};
  for (const f of fields(b, from, to)) {
    count[f.num] = (count[f.num] || 0) + 1;
    const key = prefix + 'f' + f.num + (count[f.num] > 1 ? '#' + count[f.num] : '');
    if (f.wire === 0) out[key] = String(f.value);
    else if (f.wire === 5) out[key] = f.value + ' (float ' + +f.float.toPrecision(7) + ')';
    else if (f.wire === 1) out[key] = f.value;
    else {
      let sub = null;
      if (depth < 3 && f.pend > f.pstart) { try { sub = {}; flatten(b, f.pstart, f.pend, key + '.', depth + 1, sub); } catch (e) { sub = null; } }
      if (sub && Object.keys(sub).length) Object.assign(out, sub);
      else out[key] = 'bytes[' + (f.pend - f.pstart) + ']' + (f.pend - f.pstart <= 24 ? ' ' + b.slice(f.pstart, f.pend).toString('hex') + ' "' + b.slice(f.pstart, f.pend).toString('latin1').replace(/[^\x20-\x7e]/g, '.') + '"' : '');
    }
  }
}
function read() {
  for (let i = 0; i < 6; i++) {
    try { const b = fs.readFileSync(file), out = {}; flatten(b, 0, b.length, '', 0, out); return out; } catch (e) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); }
  }
  return {};
}
if (!fs.existsSync(file)) { console.error('Cannot find ' + file + '. Start AC EVO once so it creates the file.'); process.exit(1); }
let prev = read(), last = fs.statSync(file).mtimeMs;
log('Watching ' + file + ' (' + Object.keys(prev).length + ' fields). Change one AC EVO option at a time. Ctrl+C to stop.');
setInterval(() => {
  let t; try { t = fs.statSync(file).mtimeMs; } catch (e) { return; }
  if (t === last) return;
  last = t;
  setTimeout(() => {
    const cur = read(), keys = new Set([...Object.keys(prev), ...Object.keys(cur)]), diffs = [];
    for (const k of [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
      if (prev[k] !== cur[k]) diffs.push('  ' + k + ': ' + (prev[k] === undefined ? 'absent' : prev[k]) + ' -> ' + (cur[k] === undefined ? 'absent' : cur[k]));
    const stamp = new Date().toTimeString().slice(0, 8);
    log(diffs.length ? '[' + stamp + '] changed:\n' + diffs.join('\n') : '[' + stamp + '] file saved, no field changed');
    prev = cur;
  }, 500);
}, 700);
