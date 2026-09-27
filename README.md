# Quem é Quem na Bíblia

Um mapa interativo e navegável das personagens da Bíblia, ordenado
cronologicamente (Génesis ao Apocalipse), pensado para catequese com crianças —
exploração livre, em português, com o cânone católico completo.

- **Linha do tempo** de acontecimentos (Criação → Apocalipse).
- Dentro de cada acontecimento, uma **árvore genealógica** das personagens
  (casais lado a lado, filhos por baixo) com um cartão "Sobre" (importância,
  mensagem, contexto histórico e passagens-chave).
- **Pesquisa** por nome e ligações entre personagens de acontecimentos diferentes.

## Correr localmente

Site **estático, sem build**. Só precisa de ser servido por `http://` (não abrir
por `file://` — o `fetch` do `data/personagens.json` falha por CORS). Qualquer
servidor estático serve, por exemplo:

```
npx serve .
# ou
python -m http.server 8000
```

E abrir `http://localhost:8000`.

## Editar o conteúdo

Todo o conteúdo vive num único ficheiro: **`data/personagens.json`**.
- `personagens[]` — cada personagem (`id`, `nome`, `tipo`, `retrato`, `resumo`,
  `contexto`, `relacoes`, `importancia`, `licao`, `citacao`, …).
- `edges[]` — ligações `[de, para, tipo, etiqueta?]` (`parent`/`spouse`/
  `sibling`/`descendant`/`affinity`).
- `acontecimentos[]` — os acontecimentos da linha do tempo, com o texto por
  acontecimento e as personagens que aparecem em cada um.

Os retratos são SVGs em `assets/retratos/` (um por personagem).

## Estrutura

- `index.html` / `style.css` — página e visual.
- `app.js` — orquestrador (estado, pesquisa, painéis, pan/zoom).
- `js/` — módulos do motor (linha do tempo, árvore de um acontecimento, etc.).
- `data/personagens.json` — **a fonte única de conteúdo**.
- `scripts/test-event-graph.js` — testes das funções puras do layout
  (`node scripts/test-event-graph.js`).

## Publicação

Estático → alojamento grátis (Cloudflare Pages / Netlify). Sem passo de build:
o *publish directory* é a raiz do repositório. Cada `push` para `main` publica.
