// Gera as páginas estáticas indexáveis a partir de data/personagens.json:
//   p/<id>.html            — uma por personagem (154)
//   a/<id>.html            — uma por acontecimento (41)
//   personagens.html       — índice de personagens (hub, linkado no rodapé)
//   acontecimentos.html    — índice de acontecimentos (hub)
//   sitemap.xml            — tudo o que é indexável
//
// Porquê: o mapa interativo carrega o conteúdo por JS e os deep-links são
// #hash — um motor de busca não vê nada. Estas páginas são a versão
// indexável/partilhável do MESMO conteúdo (o JSON continua a única fonte).
//
// Correr sempre que o data/personagens.json mudar:
//   node scripts/gen-paginas.js
// Quando o domínio próprio ligar, trocar BASE_URL e regenerar.
//
// Sem dependências; só Node. Inclui um verificador de links internos no fim.

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://quemequemnabiblia.github.io/quemequemnabiblia';
const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'personagens.json'), 'utf8'));

const byId = {};
data.personagens.forEach((p) => { byId[p.id] = p; });

// primeiro acontecimento em que cada personagem aparece (para o link "abrir no mapa")
const firstEventOf = {};
const eventsOf = {};
data.acontecimentos.forEach((ev) => {
  ev.personagens.forEach((id) => {
    if (!firstEventOf[id]) firstEventOf[id] = ev;
    (eventsOf[id] = eventsOf[id] || []).push(ev);
  });
});

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// para meta/JSON-LD: texto plano curto
function resumoCurto(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

const REL_LABEL = {
  parent: null, // direcional — tratado à parte
  spouse: 'cônjuge',
  sibling: 'irmão/irmã',
  descendant: 'descendência',
  affinity: 'parentesco'
};

// relações de uma personagem a partir das arestas (todas, não só por evento)
function relacoesDe(id) {
  const rel = [];
  data.edges.forEach((e) => {
    const [a, b, tipo, label] = e;
    if (a !== id && b !== id) return;
    const outro = a === id ? b : a;
    if (!byId[outro]) return;
    let etiqueta;
    if (tipo === 'parent') etiqueta = a === id ? 'filho(a)' : 'pai/mãe';
    else etiqueta = label || REL_LABEL[tipo] || tipo;
    rel.push({ id: outro, nome: byId[outro].nome, etiqueta });
  });
  return rel;
}

function head(titulo, descricao, canonicalPath, ogType, rel) {
  const canon = BASE_URL + '/' + canonicalPath;
  rel = rel || '';
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="${ogType || 'article'}">
<meta property="og:site_name" content="Quem é Quem na Bíblia">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${BASE_URL}/assets/og.png">
<meta property="og:locale" content="pt_PT">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel}assets/apple-touch-icon.png">
<meta name="theme-color" content="#0d1024">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${rel}paginas.css">
</head>
<body>`;
}

function topo(rel) {
  return `<div class="pagina"><nav class="topo"><a href="${rel}index.html">← Mapa interativo</a><span class="marca">Quem é Quem na Bíblia</span></nav>`;
}
function rodape(rel) {
  return `<footer class="rodape"><a href="${rel}index.html">Início</a><a href="${rel}personagens.html">Personagens</a><a href="${rel}acontecimentos.html">Acontecimentos</a><a href="${rel}privacidade.html">Privacidade</a></footer></div></body></html>`;
}
function jsonld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

fs.mkdirSync(path.join(ROOT, 'p'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'a'), { recursive: true });

// ---------- páginas de personagem ----------
data.personagens.forEach((p) => {
  const evs = eventsOf[p.id] || [];
  const primeiro = firstEventOf[p.id];
  const rels = relacoesDe(p.id);
  const desc = resumoCurto(p.resumo, 160);
  const titulo = `${p.nome} — Quem é Quem na Bíblia`;
  let html = head(titulo, desc, 'p/' + p.id + '.html', 'article', '../');
  html += jsonld({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: `${p.nome} — quem foi na Bíblia`,
    description: desc,
    inLanguage: 'pt-PT',
    image: BASE_URL + '/' + p.retrato,
    mainEntityOfPage: BASE_URL + '/p/' + p.id + '.html'
  });
  html += topo('../');
  html += `<div class="retrato"><img src="../${esc(p.retrato)}" alt="Retrato de ${esc(p.nome)}" width="128" height="128"></div>`;
  if (p.era) html += `<span class="era-tag">${esc(p.era)}</span>`;
  html += `<h1>${esc(p.nome)}</h1>`;
  if (p.refs) html += `<p class="refs">${esc(p.refs)}</p>`;
  html += `<p class="resumo">${esc(p.resumo)}</p>`;
  if (p.licao) html += `<div class="destaque"><h2 style="margin-top:0">O que aprendemos</h2><p>${esc(p.licao)}</p></div>`;
  if (p.citacao) html += `<blockquote>${esc(p.citacao)}</blockquote>`;
  if (p.importancia) html += `<h2>Porque é importante</h2><p>${esc(p.importancia)}</p>`;
  if (p.relacoes) html += `<h2>Família e relações</h2><p>${esc(p.relacoes)}</p>`;
  if (rels.length) {
    html += `<ul class="chips">` + rels.map((r) =>
      `<li><a href="${esc(r.id)}.html">${esc(r.nome)}<span class="rel">${esc(r.etiqueta)}</span></a></li>`).join('') + `</ul>`;
  }
  if (p.contexto) html += `<h2>Contexto histórico</h2><p>${esc(p.contexto)}</p>`;
  if (evs.length) {
    html += `<h2>Aparece em</h2><ul class="chips">` + evs.map((ev) =>
      `<li><a href="../a/${esc(ev.id)}.html">${esc(ev.nome)}</a></li>`).join('') + `</ul>`;
  }
  const alvo = primeiro ? '../index.html#' + primeiro.id : '../index.html';
  html += `<a class="cta" href="${alvo}">Explorar no mapa interativo →</a>`;
  html += rodape('../');
  fs.writeFileSync(path.join(ROOT, 'p', p.id + '.html'), html);
});

// ---------- páginas de acontecimento ----------
data.acontecimentos.forEach((ev) => {
  const desc = resumoCurto(ev.desc, 160);
  const titulo = `${ev.nome} — Quem é Quem na Bíblia`;
  let html = head(titulo, desc, 'a/' + ev.id + '.html', 'article', '../');
  html += jsonld({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: ev.nome, description: desc, inLanguage: 'pt-PT',
    mainEntityOfPage: BASE_URL + '/a/' + ev.id + '.html'
  });
  html += topo('../');
  if (ev.era) html += `<span class="era-tag">${esc(ev.era)}</span>`;
  html += `<h1>${esc(ev.nome)}</h1>`;
  html += `<p class="resumo">${esc(ev.desc)}</p>`;
  if (ev.mensagem) html += `<div class="destaque"><h2 style="margin-top:0">Mensagem principal</h2><p>${esc(ev.mensagem)}</p></div>`;
  if (ev.importancia) html += `<h2>Importância</h2><p>${esc(ev.importancia)}</p>`;
  if (ev.contexto) html += `<h2>Contexto histórico</h2><p>${esc(ev.contexto)}</p>`;
  if (ev.passagens && ev.passagens.length) {
    html += `<h2>Passagens-chave</h2><ul>` + ev.passagens.map((x) => `<li>${esc(x)}</li>`).join('') + `</ul>`;
  }
  if (ev.personagens.length) {
    html += `<h2>Personagens</h2><ul class="chips">` + ev.personagens.map((id) =>
      `<li><a href="../p/${esc(id)}.html">${esc(byId[id] ? byId[id].nome : id)}</a></li>`).join('') + `</ul>`;
  }
  html += `<a class="cta" href="../index.html#${esc(ev.id)}">Abrir no mapa interativo →</a>`;
  html += rodape('../');
  fs.writeFileSync(path.join(ROOT, 'a', ev.id + '.html'), html);
});

// ---------- índices (hubs) ----------
{
  const desc = 'Todas as personagens da Bíblia no Quem é Quem na Bíblia — de Adão ao Apocalipse, com resumo, família e contexto histórico, para catequese.';
  let html = head('Personagens da Bíblia — Quem é Quem na Bíblia', desc, 'personagens.html', 'website', '');
  html += topo('');
  html += `<h1>Personagens da Bíblia</h1><p class="resumo" style="text-align:center">${data.personagens.length} personagens, do Génesis ao Apocalipse.</p>`;
  html += `<ul class="lista">` + data.personagens.map((p) =>
    `<li><a href="p/${esc(p.id)}.html">${esc(p.nome)}<span class="sub">${esc(p.era || '')}</span></a></li>`).join('') + `</ul>`;
  html += rodape('');
  fs.writeFileSync(path.join(ROOT, 'personagens.html'), html);
}
{
  const desc = 'Os grandes acontecimentos da Bíblia por ordem cronológica — da Criação ao Apocalipse — com personagens, mensagem e contexto histórico.';
  let html = head('Acontecimentos da Bíblia — Quem é Quem na Bíblia', desc, 'acontecimentos.html', 'website', '');
  html += topo('');
  html += `<h1>Acontecimentos da Bíblia</h1><p class="resumo" style="text-align:center">${data.acontecimentos.length} acontecimentos, da Criação ao Apocalipse, por ordem cronológica.</p>`;
  html += `<ul class="lista">` + data.acontecimentos.map((ev) =>
    `<li><a href="a/${esc(ev.id)}.html">${esc(ev.nome)}<span class="sub">${esc(ev.era || '')}</span></a></li>`).join('') + `</ul>`;
  html += rodape('');
  fs.writeFileSync(path.join(ROOT, 'acontecimentos.html'), html);
}

// ---------- sitemap ----------
{
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = ['', 'personagens.html', 'acontecimentos.html', 'privacidade.html']
    .concat(data.personagens.map((p) => 'p/' + p.id + '.html'))
    .concat(data.acontecimentos.map((ev) => 'a/' + ev.id + '.html'));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${BASE_URL}/${u}</loc><lastmod>${hoje}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

// ---------- verificação: nenhum link interno quebrado ----------
let quebrados = 0, verificados = 0;
function verificaLinks(file, htmlDir) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (/^(https?:|#|mailto:)/.test(u)) continue;
    const alvoPath = u.split('#')[0];
    if (!alvoPath) continue;
    const alvo = path.resolve(htmlDir, alvoPath);
    verificados++;
    if (!fs.existsSync(alvo)) { console.error('LINK QUEBRADO em ' + path.relative(ROOT, file) + ' -> ' + u); quebrados++; }
  }
}
[]
  .concat(fs.readdirSync(path.join(ROOT, 'p')).map((f) => path.join(ROOT, 'p', f)))
  .concat(fs.readdirSync(path.join(ROOT, 'a')).map((f) => path.join(ROOT, 'a', f)))
  .concat([path.join(ROOT, 'personagens.html'), path.join(ROOT, 'acontecimentos.html')])
  .forEach((f) => verificaLinks(f, path.dirname(f)));

console.log(`geradas: ${data.personagens.length} personagens + ${data.acontecimentos.length} acontecimentos + 2 índices + sitemap.xml`);
console.log(`links internos verificados: ${verificados}; quebrados: ${quebrados}`);
if (quebrados > 0) process.exit(1);
