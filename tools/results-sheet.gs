/* Dialed results summary (Google Apps Script). For Sean's "Dialed shared results" Google Sheet only; it is not part of the app.
   Setup: open the Form's linked Sheet, Extensions > Apps Script, paste this, Save, run summarise() once (approve the permission prompt),
   then Triggers > Add trigger > summarise > time-driven > every day (or on form submit). It never changes the Form responses.
   It reads the JSON column, writes one tidy row per changed setting to "Parsed", and averages them in "Summary" by sim, setting, change,
   what limited the PC and the confidence given. Read the Summary only once a row has 15+ results behind it. */
function summarise() {
  var ss = SpreadsheetApp.getActive();
  var src = ss.getSheets().filter(function (s) { return /^Form responses/i.test(s.getName()); })[0];
  if (!src) throw new Error('No "Form responses" sheet found');
  var rows = src.getDataRange().getValues().slice(1), out = [];
  rows.forEach(function (r) {
    var p; try { p = JSON.parse(r[1]); } catch (e) { return; }               // column A is the timestamp, B the result
    if (!p || !p.changes) return;
    var hw = p.hardware || {}, gain = p.before && p.before.low1 > 0 ? Math.round((p.after.low1 - p.before.low1) / p.before.low1 * 1000) / 10 : '';
    p.changes.forEach(function (c) {
      out.push([r[0], p.v, p.app, p.sim, p.mode, p.verdict, p.limiter || '', p.runs || '', p.changes.length, c.setting, c.from, c.to, c.confidence || '', c.kept === null ? '' : c.kept,
        p.before.low1, p.after.low1, gain, p.before.avg, p.after.avg, p.before.stuttersPerMin, p.after.stuttersPerMin, hw.cpu || '', hw.gpu || '', hw.ram || '', hw.screens || '']);
    });
  });
  var head = ['time', 'format', 'app', 'sim', 'mode', 'verdict', 'limiter', 'runs', 'changes in round', 'setting', 'from', 'to', 'confidence', 'kept',
    '1% low before', '1% low after', '1% low gain %', 'avg before', 'avg after', 'stutters/min before', 'stutters/min after', 'cpu', 'gpu', 'ram', 'screens'];
  var parsed = ss.getSheetByName('Parsed') || ss.insertSheet('Parsed');
  parsed.clear(); parsed.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (out.length) parsed.getRange(2, 1, out.length, head.length).setValues(out);
  // Rounds with a single changed setting are the cleanest evidence, so the summary lists those separately from rounds with several changes.
  var g = {};
  out.forEach(function (o) {
    var k = [o[3], o[9], o[10], o[11], o[6], o[8] === 1 ? 'one change' : 'several'].join('|'), a = g[k] || (g[k] = { n: 0, gain: 0, better: 0, worse: 0, kept: 0 });
    a.n++; a.gain += +o[16] || 0; if (o[5] === 'better') a.better++; if (o[5] === 'worse') a.worse++; if (o[13] === true) a.kept++;
  });
  var sum = Object.keys(g).map(function (k) { var a = g[k], p = k.split('|');
    return p.concat([a.n, Math.round(a.gain / a.n * 10) / 10, Math.round(a.better / a.n * 100), Math.round(a.worse / a.n * 100), Math.round(a.kept / a.n * 100)]); })
    .sort(function (x, y) { return y[6] - x[6]; });
  var sh = ['sim', 'setting', 'from', 'to', 'limiter', 'round type', 'results', 'avg 1% low gain %', '% better', '% worse', '% kept'];
  var s = ss.getSheetByName('Summary') || ss.insertSheet('Summary');
  s.clear(); s.getRange(1, 1, 1, sh.length).setValues([sh]).setFontWeight('bold');
  if (sum.length) s.getRange(2, 1, sum.length, sh.length).setValues(sum);
  s.setFrozenRows(1);
}
