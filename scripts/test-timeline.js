const assert = require('assert');
const path = require('path');
const fs = require('fs');
// timeline.js expõe-se em `window` no browser; em Node carregamo-lo num
// sandbox (as funções de navegação são puras, não tocam no DOM).
const src = fs.readFileSync(path.join(__dirname, '../js/timeline.js'), 'utf8');
const sandbox = {};
new Function('window', 'module', src)(sandbox, undefined);
const T = sandbox.Timeline;
const S = T.SPACING;

assert.strictEqual(S, 340, 'SPACING esperado = 340');

// boundsFor: primeiro acontecimento em 0, último em -(n-1)*SPACING
assert.deepStrictEqual(T.boundsFor(40), { min: -39 * S, max: 0 });
assert.deepStrictEqual(T.boundsFor(1), { min: 0, max: 0 });

// nearestIndex: arredonda e prende a [0, n-1]
assert.strictEqual(T.nearestIndex(0, 40), 0);
assert.strictEqual(T.nearestIndex(-S, 40), 1);
assert.strictEqual(T.nearestIndex(-S * 1.4, 40), 1);
assert.strictEqual(T.nearestIndex(-S * 1.6, 40), 2);
assert.strictEqual(T.nearestIndex(50, 40), 0, 'offset positivo prende ao primeiro');
assert.strictEqual(T.nearestIndex(-99999, 40), 39, 'muito além prende ao último');

// snapTarget: o offset que centra o índice mais próximo
assert.strictEqual(T.snapTarget(-S * 1.4, 40), -S);
assert.strictEqual(T.snapTarget(-S * 1.6, 40), -2 * S);

// clampHard: nunca sai dos limites
assert.strictEqual(T.clampHard(100, 40), 0);
assert.strictEqual(T.clampHard(-1e9, 40), -39 * S);
assert.strictEqual(T.clampHard(-S, 40), -S);

// clampElastic: dentro devolve igual; além comprime o excesso a 1/3
assert.strictEqual(T.clampElastic(-S, 40), -S);
assert.strictEqual(T.clampElastic(300, 40), 100, 'excesso acima do max/3');
assert.strictEqual(T.clampElastic(-39 * S - 300, 40), -39 * S - 100, 'excesso abaixo do min/3');

console.log('ALL PASS');
