const assert = require('assert');
const path = require('path');
const fs = require('fs');
// camera-math.js expõe-se em `window` no browser; em Node carregamo-lo num
// sandbox (funções puras, sem DOM) — o mesmo padrão de test-timeline.js.
const src = fs.readFileSync(path.join(__dirname, '../js/camera-math.js'), 'utf8');
const sandbox = {};
new Function('window', 'module', src)(sandbox, undefined);
const C = sandbox.CameraMath;

const W = 800, H = 600;
const ident = { scale: 1, tx: 0, ty: 0 };

// screenPoint: com câmara identidade, o ecrã É o conteúdo
assert.deepStrictEqual(C.screenPoint(ident, W, H, 100, 50), { x: 100, y: 50 });
// com escala 2 a partir do centro, um ponto no centro fica no centro…
assert.deepStrictEqual(C.screenPoint({ scale: 2, tx: 0, ty: 0 }, W, H, W / 2, H / 2), { x: W / 2, y: H / 2 });
// …e um ponto a 100px do centro fica a 200px
assert.deepStrictEqual(C.screenPoint({ scale: 2, tx: 0, ty: 0 }, W, H, W / 2 + 100, H / 2), { x: W / 2 + 200, y: H / 2 });

// zoomAt mantém a âncora FIXA: o conteúdo sob (px,py) não mexe
function contentUnder(cam, px, py) {
  // inverso de screenPoint: q = c + (p - c - T)/s
  return { x: W / 2 + (px - W / 2 - cam.tx) / cam.scale, y: H / 2 + (py - H / 2 - cam.ty) / cam.scale };
}
let cam = { scale: 1, tx: 40, ty: -20 };
const anchor = { x: 600, y: 120 };
const before = contentUnder(cam, anchor.x, anchor.y);
cam = C.zoomAt(cam, W, H, anchor.x, anchor.y, 1.5, 0.2, 3);
assert.strictEqual(cam.scale, 1.5);
const after = contentUnder(cam, anchor.x, anchor.y);
assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9, 'âncora fixa no zoom-in');
// zoom-out também
cam = C.zoomAt(cam, W, H, 200, 500, 0.5, 0.2, 3);
assert.strictEqual(cam.scale, 0.75);
// clamp: nunca sai de [minS, maxS]…
cam = C.zoomAt(cam, W, H, 400, 300, 0.01, 0.2, 3);
assert.strictEqual(cam.scale, 0.2);
cam = C.zoomAt(cam, W, H, 400, 300, 1000, 0.2, 3);
assert.strictEqual(cam.scale, 3);
// …e quando o clamp NÃO deixa mudar a escala, a câmara fica IGUAL (sem drift)
const stuck = C.zoomAt(cam, W, H, 123, 456, 2, 0.2, 3);
assert.deepStrictEqual(stuck, cam, 'clamp no teto: sem alteração nenhuma');
// zoom a partir de fit baixo (0.25): "−" tem de REDUZIR (bug antigo do clamp 0.5)
const fitted = C.zoomAt({ scale: 0.25, tx: 0, ty: 0 }, W, H, W / 2, H / 2, 0.8, 0.2, 3);
assert.ok(fitted.scale < 0.25, 'zoom-out abaixo de 0.25 possível');

// centerTarget: o conteúdo (qx,qy) fica exatamente no alvo do ecrã
const cam2 = { scale: 0.7, tx: 15, ty: -33 };
const t = C.centerTarget(cam2, W, H, 950, -40, 240, 180);
const p2 = C.screenPoint({ scale: cam2.scale, tx: t.tx, ty: t.ty }, W, H, 950, -40);
assert.ok(Math.abs(p2.x - 240) < 1e-9 && Math.abs(p2.y - 180) < 1e-9, 'centerTarget coloca no alvo');

console.log('ALL PASS');
