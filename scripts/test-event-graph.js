const assert = require('assert');
// js/event-graph.js expõe-se em `window` no browser; em Node, carregamo-lo
// manualmente para o testar isoladamente (sem depender de nenhum DOM real —
// `deriveFamily` e `layoutEvent` são puras, não tocam em nada visual).
const path = require('path');
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '../js/event-graph.js'), 'utf8');
const sandbox = {};
new Function('window', 'module', src)(sandbox, undefined);
const EventGraph = sandbox.EventGraph;

// --- Caso 1: união formal entre cônjuges, filhos ligam-se à união ---
(function () {
  const edges = [['adao', 'eva', 'spouse'], ['adao', 'caim', 'parent'], ['eva', 'caim', 'parent'], ['caim', 'abel', 'sibling']];
  const family = EventGraph.deriveFamily(['adao', 'eva', 'caim', 'abel'], edges);
  assert.strictEqual(family.casais.length, 1, 'devia sintetizar 1 união');
  assert.deepStrictEqual(family.casais[0].slice().sort(), ['adao', 'eva']);
  assert.strictEqual(family.filhos.length, 1, 'abel não tem progenitores nas arestas, só caim');
  assert.deepStrictEqual(family.filhos[0].pais.slice().sort(), ['adao', 'eva']);
  console.log('ok: união formal, filho ligado à união');
})();

// --- Caso 2: dois progenitores conhecidos sem aresta "spouse" formal
// sintetizam uma união implícita (caso Agar) ---
(function () {
  const edges = [['abraao', 'ismael', 'parent'], ['agar', 'ismael', 'parent']];
  const family = EventGraph.deriveFamily(['abraao', 'agar', 'ismael'], edges);
  assert.strictEqual(family.casais.length, 1, 'devia sintetizar união implícita mesmo sem aresta spouse');
  assert.strictEqual(family.filhos.length, 1);
  console.log('ok: união implícita sem aresta spouse formal (caso Agar)');
})();

// --- Caso 3: progenitor único conhecido dentro do acontecimento — linha
// direta, sem união ---
(function () {
  const edges = [['jacob', 'jose', 'parent'], ['jose', 'efraim', 'parent']];
  const family = EventGraph.deriveFamily(['jacob', 'jose', 'efraim'], edges);
  assert.strictEqual(family.casais.length, 0, 'só um progenitor conhecido em cada caso — sem união');
  assert.strictEqual(family.filhos.length, 2);
  assert.deepStrictEqual(family.filhos.find(f => f.filho === 'jose').pais, ['jacob']);
  console.log('ok: progenitor único revela diretamente, sem união');
})();

// --- Caso 4: um progenitor com dois cônjuges no mesmo acontecimento gera
// duas uniões distintas (caso Abraão/Sara/Agar; Saul/David com Mical e
// Abigail) ---
(function () {
  const edges = [
    ['abraao', 'sara', 'spouse'], ['abraao', 'agar', 'spouse'],
    ['abraao', 'sara', 'parent'], ['sara', 'isaac', 'parent'],
    ['agar', 'ismael', 'parent']
  ];
  // nota: a aresta "abraao","sara","parent" acima é só ruído de teste — o
  // que importa é isaac ter [abraao? não] — corrige-se abaixo
  const edges2 = [
    ['abraao', 'sara', 'spouse'], ['abraao', 'agar', 'spouse'],
    ['abraao', 'isaac', 'parent'], ['sara', 'isaac', 'parent'],
    ['abraao', 'ismael', 'parent'], ['agar', 'ismael', 'parent']
  ];
  const family = EventGraph.deriveFamily(['abraao', 'sara', 'agar', 'isaac', 'ismael'], edges2);
  assert.strictEqual(family.casais.length, 2, 'Abraão tem duas uniões distintas neste acontecimento');
  console.log('ok: um progenitor com dois cônjuges gera duas uniões distintas');
})();

// --- Caso 5: sibling/descendant/affinity tornam-se linhas fracas com a
// etiqueta real da aresta, nunca com um "irmão/irmã" genérico quando há
// etiqueta própria ---
(function () {
  const edges = [['noemi', 'rute', 'affinity', 'sogra e nora'], ['uzias', 'acaz', 'descendant', '2 gerações, via Jotão']];
  const family = EventGraph.deriveFamily(['noemi', 'rute', 'uzias', 'acaz'], edges);
  assert.strictEqual(family.irmaos.length, 2);
  assert.ok(family.irmaos.some(w => w[2] === 'sogra e nora'));
  assert.ok(family.irmaos.some(w => w[2] === '2 gerações, via Jotão'));
  console.log('ok: affinity/descendant mantêm a sua etiqueta real, não um genérico "irmão/irmã"');
})();

// --- Caso 6: arestas fora do acontecimento (ambas ou uma ponta) são
// ignoradas — a família nunca "vaza" para personagens de outro acontecimento ---
(function () {
  const edges = [['joaquim', 'zorobabel', 'descendant', '3 gerações'], ['joaquim', 'sedequias', 'sibling']];
  const family = EventGraph.deriveFamily(['zorobabel', 'esdras'], edges); // joaquim/sedequias não estão aqui
  assert.strictEqual(family.irmaos.length, 0, 'nenhuma das duas arestas tem as duas pontas no acontecimento');
  console.log('ok: arestas com uma ponta fora do acontecimento são ignoradas');
})();

// --- Caso 7: deriveGroups agrupa arestas fracas em componentes ligados,
// excluindo pares que já partilham progenitor no acontecimento ---
(function () {
  // Pedro-André-Tiago ligados por arestas fracas (companheiros) → 1 grupo de 3.
  const family = {
    casais: [], filhos: [],
    irmaos: [['pedro', 'andre', 'apóstolos'], ['andre', 'tiago', 'apóstolos']]
  };
  const groups = EventGraph.deriveGroups(family);
  assert.strictEqual(groups.length, 1, 'devia haver 1 grupo');
  assert.deepStrictEqual(groups[0].ids.slice().sort(), ['andre', 'pedro', 'tiago']);
  assert.strictEqual(groups[0].label, 'apóstolos', 'usa a etiqueta da aresta');
  console.log('ok: deriveGroups une componentes ligados com a etiqueta da aresta');
})();

// --- Caso 8: irmãos que já partilham progenitor no acontecimento NÃO formam
// grupo (a árvore já os põe lado a lado sob o mesmo pai) ---
(function () {
  const family = {
    casais: [['adao', 'eva']],
    filhos: [{ pais: ['adao', 'eva'], filho: 'caim' }, { pais: ['adao', 'eva'], filho: 'abel' }],
    irmaos: [['caim', 'abel', 'irmão/irmã']]
  };
  const groups = EventGraph.deriveGroups(family);
  assert.strictEqual(groups.length, 0, 'caim e abel já partilham pais → sem grupo/chaveta');
  console.log('ok: deriveGroups exclui irmãos que já partilham progenitor no evento');
})();

// --- Caso 9: afinidade sem progenitor comum forma grupo com a sua etiqueta ---
(function () {
  const family = { casais: [], filhos: [], irmaos: [['noemi', 'rute', 'sogra e nora']] };
  const groups = EventGraph.deriveGroups(family);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].label, 'sogra e nora');
  console.log('ok: deriveGroups agrupa afinidade com a etiqueta real');
})();

// --- Caso 11: numa componente com etiquetas diferentes, ganha a etiqueta
// da PRIMEIRA aresta em ordem de entrada ---
(function () {
  const family = { casais: [], filhos: [], irmaos: [['a', 'b', 'primeira'], ['b', 'c', 'segunda']] };
  const groups = EventGraph.deriveGroups(family);
  assert.strictEqual(groups.length, 1);
  assert.deepStrictEqual(groups[0].ids.slice().sort(), ['a', 'b', 'c']);
  assert.strictEqual(groups[0].label, 'primeira', 'a etiqueta da primeira aresta da componente ganha');
  console.log('ok: deriveGroups usa a etiqueta da primeira aresta em ordem de entrada');
})();

// --- Caso 10: membros de um grupo fraco ficam em slots consecutivos ---
(function () {
  const ids = ['pedro', 'x', 'andre', 'tiago']; // x é ruído no meio da ordem
  const edges = [['pedro', 'andre', 'sibling', 'apóstolos'], ['andre', 'tiago', 'sibling', 'apóstolos']];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  const groupSlots = ['pedro', 'andre', 'tiago'].map(function (id) { return layout.slot[id]; }).sort(function (a, b) { return a - b; });
  assert.strictEqual(groupSlots[2] - groupSlots[0], 2, 'os 3 membros do grupo ocupam 3 slots contíguos');
  console.log('ok: layoutEvent mantém os membros de um grupo fraco consecutivos');
})();

// --- Caso 12: grupo fraco cujos DOIS membros têm cônjuge presente — os
// membros ficam contíguos (para a chaveta) e cada cônjuge fica-lhes ao lado,
// por fora do intervalo do grupo (caso Maria/Isabel + José/Zacarias) ---
(function () {
  const ids = ['a', 'sA', 'b', 'sB']; // cônjuges intercalados de propósito
  const edges = [['a', 'b', 'affinity', 'primas'], ['sA', 'a', 'spouse'], ['sB', 'b', 'spouse']];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  const s = id => layout.slot[id];
  assert.strictEqual(Math.abs(s('a') - s('b')), 1, 'os membros do grupo ficam contíguos');
  assert.strictEqual(Math.abs(s('a') - s('sA')), 1, 'a e o seu cônjuge ficam adjacentes');
  assert.strictEqual(Math.abs(s('b') - s('sB')), 1, 'b e o seu cônjuge ficam adjacentes');
  const lo = Math.min(s('a'), s('b')), hi = Math.max(s('a'), s('b'));
  assert.ok(s('sA') < lo || s('sA') > hi, 'o cônjuge de a fica FORA do intervalo do grupo (chaveta)');
  assert.ok(s('sB') < lo || s('sB') > hi, 'o cônjuge de b fica FORA do intervalo do grupo (chaveta)');
  console.log('ok: grupo com ambos os cônjuges presentes — membros no meio, cônjuges por fora');
})();

// --- Caso 13: filhos colocados por baixo dos pais (ordem dos pais), não pela
// ordem dos dados — evita a barra de descendência a atravessar o ecrã
// (caso Jesus/João Batista no Nascimento) ---
(function () {
  // dois casais no topo; nos dados o filho do casal DA DIREITA vem primeiro
  const ids = ['pa', 'ma', 'pb', 'mb', 'filho_b', 'filho_a'];
  const edges = [
    ['pa', 'ma', 'spouse'], ['pb', 'mb', 'spouse'],
    ['pa', 'filho_a', 'parent'], ['ma', 'filho_a', 'parent'],
    ['pb', 'filho_b', 'parent'], ['mb', 'filho_b', 'parent']
  ];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  assert.ok(layout.slot['pa'] < layout.slot['pb'], 'casal A à esquerda de casal B');
  assert.ok(layout.slot['filho_a'] < layout.slot['filho_b'], 'o filho segue a posição dos pais, não a ordem dos dados');
  console.log('ok: filhos colocados por baixo dos pais (ordem dos pais, não dos dados)');
})();

// --- Caso 14: a colocação do grupo é INDEPENDENTE da ordem dos dados — mesmo
// que o cônjuge de um membro venha ANTES no array, o grupo mantém-se contíguo
// e os cônjuges ficam por fora (regressão: antes partia a chaveta) ---
(function () {
  const ids = ['sA', 'a', 'b', 'sB']; // cônjuge de 'a' vem PRIMEIRO nos dados
  const edges = [['a', 'b', 'affinity', 'primas'], ['sA', 'a', 'spouse'], ['sB', 'b', 'spouse']];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  const s = id => layout.slot[id];
  assert.strictEqual(Math.abs(s('a') - s('b')), 1, 'membros do grupo contíguos, seja qual for a ordem dos dados');
  const lo = Math.min(s('a'), s('b')), hi = Math.max(s('a'), s('b'));
  assert.ok(s('sA') < lo || s('sA') > hi, 'cônjuge de a fica fora do intervalo do grupo');
  assert.ok(s('sB') < lo || s('sB') > hi, 'cônjuge de b fica fora do intervalo do grupo');
  console.log('ok: colocação de grupo independente da ordem dos dados (cônjuge antes do membro)');
})();

// --- Caso 15: um filho casado com alguém já colocado à esquerda é ordenado
// para o lado desse cônjuge (fica adjacente), em vez de ter um irmão no meio ---
(function () {
  const ids = ['jesse', 'saul', 'david', 'jonatas', 'mical'];
  const edges = [
    ['jesse', 'david', 'parent'],
    ['saul', 'jonatas', 'parent'], ['saul', 'mical', 'parent'],
    ['david', 'mical', 'spouse']
  ];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  assert.strictEqual(Math.abs(layout.slot['david'] - layout.slot['mical']), 1,
    'Mical (casada com David) fica adjacente ao David, não com o Jónatas no meio');
  console.log('ok: filhos ordenados para aproximar o cônjuge já colocado');
})();

// --- Caso 16: árvore genealógica — um cônjuge "raiz" e um cônjuge que é filho
// no evento partilham o mesmo nível e ficam adjacentes (o casamento entre
// gerações deixa de ser uma linha diagonal comprida); o pai fica um nível acima ---
(function () {
  const ids = ['jesse', 'david', 'abigail'];
  const edges = [['jesse', 'david', 'parent'], ['david', 'abigail', 'spouse']];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  assert.strictEqual(layout.gen['david'], layout.gen['abigail'], 'os cônjuges partilham nível');
  assert.strictEqual(Math.abs(layout.slot['david'] - layout.slot['abigail']), 1, 'os cônjuges ficam adjacentes');
  assert.ok(layout.gen['jesse'] < layout.gen['david'], 'o pai fica um nível acima do filho');
  console.log('ok: casamento entre gerações partilha nível e fica adjacente');
})();

// --- Caso 17: dois filhos ligados por chaveta (parentes) ficam cada um por
// baixo dos SEUS pais — bug real da auditoria de 2026-09-27: na Anunciação,
// João Batista aparecia por baixo de José+Maria e Jesus por baixo de
// Isabel+Zacarias ---
(function () {
  // ordem exata de data/personagens.json (a ordem importa para reproduzir)
  const ids = ['maria', 'sao_jose', 'santa_isabel', 'zacarias_sacerdote', 'joao_batista', 'jesus', 'herodes_grande'];
  const edges = [
    ['sao_jose', 'maria', 'spouse'], ['maria', 'jesus', 'parent'], ['sao_jose', 'jesus', 'parent'],
    ['zacarias_sacerdote', 'santa_isabel', 'spouse'],
    ['zacarias_sacerdote', 'joao_batista', 'parent'], ['santa_isabel', 'joao_batista', 'parent'],
    ['maria', 'santa_isabel', 'affinity', 'parentes'], ['jesus', 'joao_batista', 'affinity', 'parentes']
  ];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  const s = id => layout.slot[id];
  const mid = (a, b) => (s(a) + s(b)) / 2;
  assert.ok(Math.abs(s('jesus') - mid('sao_jose', 'maria')) < Math.abs(s('jesus') - mid('santa_isabel', 'zacarias_sacerdote')),
    'Jesus fica mais perto de José+Maria do que de Isabel+Zacarias');
  assert.ok(Math.abs(s('joao_batista') - mid('santa_isabel', 'zacarias_sacerdote')) < Math.abs(s('joao_batista') - mid('sao_jose', 'maria')),
    'João Batista fica mais perto de Isabel+Zacarias do que de José+Maria');
  console.log('ok: filhos de uma chaveta ficam por baixo dos próprios pais');
})();

// --- Caso 18: no nível de topo, cada progenitor fica por cima dos seus filhos
// — bug real da auditoria: em "Saul e David", Jessé ficava por cima de
// Jónatas e Saul por cima de David ---
(function () {
  const ids = ['jesse', 'saul', 'golias', 'jonatas', 'mical', 'david', 'abigail', 'nabal'];
  const edges = [
    ['saul', 'jonatas', 'parent'], ['saul', 'mical', 'parent'], ['jonatas', 'mical', 'sibling'],
    ['jesse', 'david', 'parent'],
    ['david', 'mical', 'spouse'], ['david', 'abigail', 'spouse'], ['abigail', 'nabal', 'spouse']
  ];
  const family = EventGraph.deriveFamily(ids, edges);
  const layout = EventGraph.layoutEvent(ids, family);
  const s = id => layout.slot[id];
  const side = (a, b) => Math.sign(s(a) - s(b));
  assert.strictEqual(side('saul', 'jesse'), side('mical', 'david'), 'Saul fica do lado de Mical, Jessé do lado de David');
  assert.strictEqual(side('saul', 'jesse'), side('jonatas', 'david'), 'Saul fica do lado de Jónatas');
  console.log('ok: progenitores do nível de topo por cima dos próprios filhos');
})();

// --- Caso 19: o caso 17 não pode depender de onde o bloco calha na fila —
// com três pessoas sem família à frente, cada filho continua por baixo dos
// seus pais (a 1.ª versão da correção comparava posições absolutas) ---
(function () {
  const ids = ['x1', 'x2', 'herodes_grande', 'maria', 'sao_jose', 'santa_isabel', 'zacarias_sacerdote', 'joao_batista', 'jesus'];
  const edges = [
    ['sao_jose', 'maria', 'spouse'], ['maria', 'jesus', 'parent'], ['sao_jose', 'jesus', 'parent'],
    ['zacarias_sacerdote', 'santa_isabel', 'spouse'],
    ['zacarias_sacerdote', 'joao_batista', 'parent'], ['santa_isabel', 'joao_batista', 'parent'],
    ['maria', 'santa_isabel', 'affinity', 'parentes'], ['jesus', 'joao_batista', 'affinity', 'parentes']
  ];
  const layout = EventGraph.layoutEvent(ids, EventGraph.deriveFamily(ids, edges));
  const s = id => layout.slot[id];
  const mid = (a, b) => (s(a) + s(b)) / 2;
  assert.ok(Math.abs(s('jesus') - mid('sao_jose', 'maria')) < Math.abs(s('jesus') - mid('santa_isabel', 'zacarias_sacerdote')), 'Jesus perto de José+Maria');
  assert.ok(Math.abs(s('joao_batista') - mid('santa_isabel', 'zacarias_sacerdote')) < Math.abs(s('joao_batista') - mid('sao_jose', 'maria')), 'João Batista perto de Isabel+Zacarias');
  console.log('ok: filhos por baixo dos pais, seja qual for a posição do bloco');
})();

// --- Caso 20: alguém com 3+ cônjuges (Jacob). Nenhum slot infinito/NaN
// (antes, um primeiro membro sem filhos ficava em -Infinity e a cena ficava
// em branco), nenhuma sobreposição na mesma fila, cada mãe "simples" por cima
// dos seus filhos — em várias ordens dos dados e com blocos vizinhos ---
(function () {
  const edges = [
    ['jacob', 'raquel', 'spouse'], ['jacob', 'lia', 'spouse'], ['jacob', 'bila', 'spouse'], ['jacob', 'zilpa', 'spouse'],
    ['jacob', 'jose', 'parent'], ['raquel', 'jose', 'parent'],
    ['jacob', 'ruben', 'parent'], ['lia', 'ruben', 'parent'], ['jacob', 'levi', 'parent'], ['lia', 'levi', 'parent'],
    ['jacob', 'dan', 'parent'], ['bila', 'dan', 'parent'],
    ['jacob', 'gad', 'parent'], ['zilpa', 'gad', 'parent'],
    ['p1', 'p2', 'spouse'], ['p2', 'p3', 'spouse'], ['p3', 'p4', 'spouse'], ['p4', 'p5', 'spouse'], ['p1', 'k1', 'parent']
  ];
  const orders = [
    ['jacob', 'raquel', 'lia', 'bila', 'zilpa', 'jose', 'ruben', 'levi', 'dan', 'gad'],
    ['lia', 'jacob', 'raquel', 'bila', 'zilpa', 'jose'],
    ['solo', 'zilpa', 'bila', 'lia', 'raquel', 'jacob', 'gad', 'dan', 'levi', 'ruben', 'jose'],
    ['jacob', 'raquel', 'lia', 'bila', 'zilpa', 'jose', 'ruben', 'levi', 'dan', 'gad', 'p1', 'p2', 'p3', 'p4', 'p5', 'k1']
  ];
  orders.forEach(function (ids, n) {
    const layout = EventGraph.layoutEvent(ids, EventGraph.deriveFamily(ids, edges));
    const byGen = {};
    ids.forEach(function (id) {
      assert.ok(Number.isFinite(layout.slot[id]), 'ordem ' + n + ': slot finito para ' + id);
      (byGen[layout.gen[id]] = byGen[layout.gen[id]] || []).push(layout.slot[id]);
    });
    Object.keys(byGen).forEach(function (g) {
      const xs = byGen[g].slice().sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 0.999, 'ordem ' + n + ': sem sobreposição na geração ' + g);
    });
    const has = id => ids.indexOf(id) !== -1;
    [['raquel', ['jose']], ['bila', ['dan']], ['zilpa', ['gad']]].forEach(function (pair) {
      const mom = pair[0], kids = pair[1].filter(has);
      if (!has(mom) || !kids.length) return;
      const avg = kids.reduce((t, k) => t + layout.slot[k], 0) / kids.length;
      const others = ['raquel', 'lia', 'bila', 'zilpa'].filter(m => m !== mom && has(m));
      others.forEach(function (o) {
        assert.ok(Math.abs(layout.slot[mom] - avg) <= Math.abs(layout.slot[o] - avg), 'ordem ' + n + ': ' + mom + ' é a mãe mais perto dos seus filhos');
      });
    });
  });
  console.log('ok: 3+ cônjuges — slots finitos, sem sobreposições, cada mãe por cima dos seus filhos');
})();

console.log('\nALL PASS');
