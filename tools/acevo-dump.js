// Prints every field of AC EVO's video.videosettings as "path = value" (same field paths as acevo-watch.js).
// Use: node tools\acevo-dump.js [file]   (default: Saved Games\ACE\video.videosettings)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const file = process.argv[2] || path.join(os.homedir(), 'Saved Games', 'ACE', 'video.videosettings');
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
    out.push(f);
  }
  return out;
}
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
      else out[key] = f.pend > f.pstart ? 'bytes[' + (f.pend - f.pstart) + '] "' + b.slice(f.pstart, f.pend).toString('latin1').replace(/[^\x20-\x7e]/g, '.') + '"' : '(empty)';
    }
  }
}
const b = fs.readFileSync(file), out = {}; flatten(b, 0, b.length, '', 0, out);
Object.keys(out).sort((a, c) => a.localeCompare(c, undefined, { numeric: true })).forEach(k => console.log(k + ' = ' + out[k]));
