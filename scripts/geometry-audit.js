// Geometry-fingerprint distinctness audit for assets/retratos/*.svg
// Compares SHAPE data (path d=, ellipse/circle rx/ry/cx/cy etc), ignoring fill/stroke color,
// to flag pairs of portraits that share suspiciously similar underlying geometry.
//
// Usage: node scripts/geometry-audit.js assets/retratos
//
// IMPORTANT: this script produces false positives. Generic shared elements (e.g. the
// neck rectangle, or a commonly-reused eye/nose shape) count toward the overlap score.
// Every flagged pair needs manual visual confirmation — it is a lead, not a verdict.

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/geometry-audit.js <path-to-retratos-dir>');
  process.exit(1);
}
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort();

function extractShapeTokens(svgText) {
  const elRe = /<(ellipse|circle|path|rect|polygon|line)\b([^>]*)\/?>/g;
  const tokens = [];
  let m;
  while ((m = elRe.exec(svgText))) {
    const tag = m[1];
    const attrs = m[2];
    const geomAttrs = {};
    const attrRe = /([\w-]+)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(attrs))) {
      const key = am[1];
      if (['fill', 'stroke', 'class', 'id', 'stroke-width', 'opacity', 'clip-path'].includes(key)) continue;
      geomAttrs[key] = am[2];
    }
    if (tag === 'path' && geomAttrs.d) {
      const norm = geomAttrs.d.replace(/-?\d+(\.\d+)?/g, (n) => Math.round(parseFloat(n) / 2) * 2);
      tokens.push('path:' + norm);
    } else {
      const norm = Object.keys(geomAttrs).sort().map(k => k + '=' + Math.round(parseFloat(geomAttrs[k]) / 2) * 2).join(',');
      tokens.push(tag + ':' + norm);
    }
  }
  return tokens;
}

const sigs = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  sigs[f] = extractShapeTokens(text);
}

function overlap(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  const denom = Math.min(setA.size, setB.size) || 1;
  return shared / denom;
}

const flagged = [];
for (let i = 0; i < files.length; i++) {
  for (let j = i + 1; j < files.length; j++) {
    const o = overlap(sigs[files[i]], sigs[files[j]]);
    if (o >= 0.6) flagged.push({ a: files[i], b: files[j], overlap: (o * 100).toFixed(0) + '%' });
  }
}

flagged.sort((x, y) => parseFloat(y.overlap) - parseFloat(x.overlap));
console.log('Files scanned:', files.length);
console.log('Pairs flagged (>=60% shape-token overlap):', flagged.length);
flagged.forEach(f => console.log(' ', f.a, 'vs', f.b, '->', f.overlap));
