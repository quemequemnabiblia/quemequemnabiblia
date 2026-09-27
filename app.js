(function () {
  fetch("data/personagens.json")
    .then(function (res) { return res.json(); })
    .then(init)
    .catch(function (err) {
      document.getElementById("panelBody").innerHTML =
        '<p class="panel-empty">Não foi possível carregar os dados (' + err.message + '). Se abriste o ficheiro diretamente no browser, é preciso servir a pasta por http:// — usa a skill run.</p>';
    });

  function normalize(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function init(data) {
    var byId = {};
    data.personagens.forEach(function (p) { byId[p.id] = p; });
    var events = data.acontecimentos;

    // A que acontecimento pertence cada personagem, para saltos (pesquisa e
    // "também aparece em") — usa sempre o primeiro em que aparece, quando
    // uma personagem participa em mais do que um (ex: David em 3).
    var firstEventOf = {};
    events.forEach(function (ev) {
      ev.personagens.forEach(function (id) {
        if (!firstEventOf[id]) firstEventOf[id] = ev;
      });
    });

    var bgStars = document.getElementById('bgStars');
    WarpTransition.init(bgStars);

    var timelineView = document.getElementById('timelineView');
    var eventView = document.getElementById('eventView');
    var eventAmbient = document.getElementById('eventAmbient');
    var eventIcon = document.getElementById('eventIcon');
    var eventTitle = document.getElementById('eventTitle');
    var eventEra = document.getElementById('eventEra');
    var eventDesc = document.getElementById('eventDesc');
    var eventImportancia = document.getElementById('eventImportancia');
    var eventMensagem = document.getElementById('eventMensagem');
    var eventContexto = document.getElementById('eventContexto');
    var eventPassagens = document.getElementById('eventPassagens');
    var eventInfo = document.getElementById('eventInfo');
    var charButtons = document.getElementById('charButtons');
    var charLines = document.getElementById('charLines');
    var camLayer = document.getElementById('camLayer');
    var charField = document.getElementById('charField');
    var panel = document.getElementById('panel');
    var panelBody = document.getElementById('panelBody');
    var panelEmptyHtml = panelBody.innerHTML;
    var backBtn = document.getElementById('backBtn');
    var scrollHintText = document.getElementById('scrollHintText');
    var panelClose = document.getElementById('panelClose');
    // Barra de app do interior (só visível em mobile via CSS): voltar + título
    // + segmento Árvore/Sobre.
    var appbarBack = document.getElementById('appbarBack');
    var appbarTitle = document.getElementById('appbarTitle');
    var segArvore = document.getElementById('segArvore');
    var segSobre = document.getElementById('segSobre');
    // Alterna o separador mobile Árvore/Sobre (no desktop as classes existem mas
    // o CSS ignora-as — o layout de duas colunas mantém-se).
    function setEventTab(tab) {
      var arvore = tab !== 'sobre';
      eventView.classList.toggle('tab-arvore', arvore);
      eventView.classList.toggle('tab-sobre', !arvore);
      segArvore.classList.toggle('active', arvore);
      segArvore.setAttribute('aria-selected', arvore ? 'true' : 'false');
      segSobre.classList.toggle('active', !arvore);
      segSobre.setAttribute('aria-selected', !arvore ? 'true' : 'false');
      if (arvore) {
        // o campo esteve display:none enquanto na tab Sobre (dimensões 0), por
        // isso ao voltar à Árvore reajusta-se a vista quando já é mensurável.
        requestAnimationFrame(function () { if (charField.clientWidth) fitEventView(); });
      } else {
        eventInfo.scrollTop = 0;
      }
    }
    segArvore.addEventListener('click', function () { setEventTab('arvore'); });
    segSobre.addEventListener('click', function () { setEventTab('sobre'); });
    appbarBack.addEventListener('click', function () { history.back(); });

    panelClose.addEventListener('click', function () {
      panel.classList.remove('open');
      clearFocusedChars(); // hoisted — declarado no bloco da câmara abaixo
    });

    // --- câmara (zoom/pan) dentro de um acontecimento — sem física, só
    // estado de transformação, tal como o protótipo validado ---
    var camScale = 1, camTx = 0, camTy = 0;
    function applyCam() { camLayer.style.transform = 'translate(' + camTx + 'px,' + camTy + 'px) scale(' + camScale + ')'; }
    function resetCam() { camScale = 1; camTx = 0; camTy = 0; applyCam(); }
    // Ajusta o zoom/posição para caber TODAS as personagens do acontecimento
    // no ecrã — sem isto, um acontecimento largo (ex: Saul e a Ascensão de
    // David) deixa personagens fora do ecrã e as linhas de família parecem
    // "partidas" por ligarem a nós invisíveis. camLayer tem transform-origin
    // 50% 50% e preenche o char-field, por isso a fórmula de centragem usa
    // o centro do campo.
    function fitEventView() {
      var chars = charButtons.querySelectorAll('.char');
      var w = charField.clientWidth, h = charField.clientHeight;
      if (!chars.length || !w || !h) { resetCam(); return; }
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      Array.prototype.forEach.call(chars, function (c) {
        var x = parseFloat(c.style.left), y = parseFloat(c.style.top);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
      // margens (em % do campo) para medalhões e nomes não ficarem colados às bordas
      minX -= 10; maxX += 10; minY -= 14; maxY += 16;
      var spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
      var scale = Math.max(0.25, Math.min(1, Math.min(100 / spanX, 100 / spanY)));
      camScale = scale;
      var cx = (minX + maxX) / 2 / 100 * w, cy = (minY + maxY) / 2 / 100 * h;
      camTx = (w / 2 - cx) * scale;
      camTy = (h / 2 - cy) * scale;
      applyCam();
    }
    // Limites de escala partilhados por todos os caminhos de zoom. O mínimo
    // tem de ficar ABAIXO do piso do fitEventView (0.25) — senão, num
    // acontecimento largo ajustado a 0.25, carregar em "−" (clamp antigo a
    // 0.5) AUMENTAVA o zoom em vez de o reduzir.
    var MIN_SCALE = 0.2, MAX_SCALE = 3;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var camAnimRAF = null;
    function cancelCamAnim() { if (camAnimRAF) { cancelAnimationFrame(camAnimRAF); camAnimRAF = null; } }
    // Zoom ancorado: o ponto (px,py) do campo mostra o mesmo conteúdo antes e
    // depois — pinch (ponto médio dos dedos), wheel (cursor) e botões (centro).
    function zoomAtPoint(px, py, factor) {
      var next = CameraMath.zoomAt({ scale: camScale, tx: camTx, ty: camTy },
        charField.clientWidth, charField.clientHeight, px, py, factor, MIN_SCALE, MAX_SCALE);
      camScale = next.scale; camTx = next.tx; camTy = next.ty;
      applyCam();
    }
    function zoomBy(factor) { cancelCamAnim(); zoomAtPoint(charField.clientWidth / 2, charField.clientHeight / 2, factor); }
    function animateCamTo(tx, ty) {
      cancelCamAnim();
      if (reduceMotion) { camTx = tx; camTy = ty; applyCam(); return; }
      var fx = camTx, fy = camTy, start = performance.now();
      function stepA(now) {
        var t = Math.min(1, (now - start) / 400);
        var k = 1 - Math.pow(1 - t, 3); // easeOutCubic
        camTx = fx + (tx - fx) * k; camTy = fy + (ty - fy) * k;
        applyCam();
        camAnimRAF = t < 1 ? requestAnimationFrame(stepA) : null;
      }
      camAnimRAF = requestAnimationFrame(stepA);
    }
    // Traz o orbe focado para a zona visível do campo. Desktop: a zona à
    // esquerda do painel (o painel cobre a direita); mobile: o campo todo —
    // o bottom sheet é temporário, e centrar no campo garante que ao fechar
    // o sheet o orbe está à vista. Se já estiver visível, não mexe (não
    // desorientar quem tocou diretamente no orbe).
    function ensureCharVisible(charId) {
      var el = charButtons.querySelector('.char[data-char-id="' + charId + '"]');
      if (!el) return;
      var w = charField.clientWidth, h = charField.clientHeight;
      if (!w || !h) return;
      var qx = parseFloat(el.style.left) / 100 * w;
      var qy = parseFloat(el.style.top) / 100 * h;
      var cam = { scale: camScale, tx: camTx, ty: camTy };
      var p = CameraMath.screenPoint(cam, w, h, qx, qy);
      var isMobile = window.matchMedia('(max-width: 720px)').matches;
      var visRight = isMobile ? w : Math.max(120, w - panel.offsetWidth - 48);
      // Zona visível vertical: em mobile o bottom sheet cobre a parte de baixo,
      // por isso o alvo é o terço superior (mais provável de ficar acima do
      // sheet quando se navega por chip com a ficha aberta); em desktop, o meio.
      var targetY = isMobile ? h * 0.35 : h / 2;
      var visBottom = isMobile ? h * 0.7 : h; // não considerar "visível" o que fica sob o sheet
      var M = 48; // margem: um orbe "visível" mas colado à borda também centra
      if (p.x > M && p.x < visRight - M && p.y > M && p.y < visBottom - M) return;
      var t = CameraMath.centerTarget(cam, w, h, qx, qy, visRight / 2, targetY);
      animateCamTo(t.tx, t.ty);
    }
    document.getElementById('zoomIn').addEventListener('click', function () { zoomBy(1.25); });
    document.getElementById('zoomOut').addEventListener('click', function () { zoomBy(0.8); });
    document.getElementById('zoomReset').addEventListener('click', function () { cancelCamAnim(); fitEventView(); });
    charField.addEventListener('wheel', function (e) {
      e.preventDefault();
      cancelCamAnim();
      var r = charField.getBoundingClientRect();
      zoomAtPoint(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });
    var panningChars = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;
    var panMoved = false;         // houve arrasto real? (distingue arrasto de toque/clique)
    var pinching = false, pinchLastDist = 0, pinchLastMid = null;
    function clearFocusedChars() {
      document.querySelectorAll('.char.focused').forEach(function (el) { el.classList.remove('focused'); });
    }
    function pinchInfo(touches) {
      var r = charField.getBoundingClientRect();
      var a = touches[0], b = touches[1];
      return {
        dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        mid: { x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top }
      };
    }
    charField.addEventListener('mousedown', function (e) {
      if (e.target.closest('.char')) return;
      cancelCamAnim();
      panningChars = true; panMoved = false;
      panStartX = e.clientX; panStartY = e.clientY; panStartTx = camTx; panStartTy = camTy;
      charField.classList.add('panning');
    });
    window.addEventListener('mousemove', function (e) {
      if (!panningChars) return;
      if (Math.abs(e.clientX - panStartX) + Math.abs(e.clientY - panStartY) > 6) panMoved = true;
      camTx = panStartTx + (e.clientX - panStartX); camTy = panStartTy + (e.clientY - panStartY);
      applyCam();
    });
    window.addEventListener('mouseup', function () { panningChars = false; charField.classList.remove('panning'); });
    // Toque: 1 dedo arrasta a câmara (Ronda 18); 2 dedos fazem pinch-zoom
    // ancorado no ponto médio (e pan pelo deslocamento do ponto médio).
    charField.addEventListener('touchstart', function (e) {
      cancelCamAnim();
      if (e.touches.length === 2) {
        // dois dedos = gesto de câmara, mesmo que um tenha começado num orbe
        panningChars = false; pinching = true; panMoved = true;
        var info = pinchInfo(e.touches);
        pinchLastDist = info.dist; pinchLastMid = info.mid;
        charField.classList.add('panning');
        return;
      }
      if (pinching || e.touches.length !== 1 || e.target.closest('.char')) return;
      panningChars = true; panMoved = false;
      panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
      panStartTx = camTx; panStartTy = camTy;
      charField.classList.add('panning');
    }, { passive: true });
    charField.addEventListener('touchmove', function (e) {
      if (pinching && e.touches.length >= 2) {
        e.preventDefault();
        var info = pinchInfo(e.touches);
        if (pinchLastDist > 0) {
          zoomAtPoint(info.mid.x, info.mid.y, info.dist / pinchLastDist);
          camTx += info.mid.x - pinchLastMid.x;
          camTy += info.mid.y - pinchLastMid.y;
          applyCam();
        }
        pinchLastDist = info.dist; pinchLastMid = info.mid;
        return;
      }
      if (!panningChars) return;
      e.preventDefault();
      if (Math.abs(e.touches[0].clientX - panStartX) + Math.abs(e.touches[0].clientY - panStartY) > 6) panMoved = true;
      camTx = panStartTx + (e.touches[0].clientX - panStartX); camTy = panStartTy + (e.touches[0].clientY - panStartY);
      applyCam();
    }, { passive: false });
    charField.addEventListener('touchend', function (e) {
      if (pinching && e.touches.length === 1) {
        // 2→1 dedos: re-basear como arrasto simples para a cena não saltar
        pinching = false;
        panningChars = true;
        panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
        panStartTx = camTx; panStartTy = camTy;
      }
    });
    window.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) { panningChars = false; pinching = false; charField.classList.remove('panning'); }
    });
    window.addEventListener('touchcancel', function () { panningChars = false; pinching = false; charField.classList.remove('panning'); });
    // Tocar/clicar no fundo do campo (sem arrastar) fecha a ficha e desfoca —
    // o gesto clássico de "desselecionar". O clique num orbe não passa por
    // aqui (closest('.char')); os botões de zoom também não.
    charField.addEventListener('click', function (e) {
      if (panMoved) { panMoved = false; return; }
      if (e.target.closest('.char') || e.target.closest('.zoom-controls')) return;
      panel.classList.remove('open');
      clearFocusedChars();
    });

    // --- mapa de acontecimentos (linha do tempo) ---
    var timelineApi = Timeline.init({
      view: timelineView,
      rail: document.getElementById('timelineRail'),
      railPath: document.getElementById('railPath'),
      railSvg: document.getElementById('railSvg'),
      progressDots: document.getElementById('progressDots'),
      scrollLeftBtn: document.getElementById('scrollLeft'),
      scrollRightBtn: document.getElementById('scrollRight'),
      events: events,
      defs: byId,
      isSuspended: function () { return document.body.classList.contains('in-event'); },
      onEnter: function (ev, x, y) { enterEvent(ev, x, y); },
      onCenter: function (tint) {
        var neb = document.querySelector('.nebula.n1');
        if (neb && tint) neb.style.background = 'radial-gradient(circle, ' + tint + ', transparent 68%)';
      }
    });

    var currentEvent = null;

    function enterEvent(ev, clickX, clickY, fromHistory) {
      cancelCamAnim(); // travar qualquer centragem de câmara pendente do acontecimento anterior
      eventView.classList.remove('leaving'); // repor a entrada suave
      var wasInEvent = !!currentEvent;
      var stageEl = document.querySelector('.stage');
      var rect = stageEl.getBoundingClientRect();
      var originXFrac = (clickX - rect.left) / rect.width, originYFrac = (clickY - rect.top) / rect.height;
      var originPct = (originXFrac * 100).toFixed(1) + '% ' + (originYFrac * 100).toFixed(1) + '%';
      timelineView.style.transformOrigin = originPct;
      eventView.style.transformOrigin = originPct;
      WarpTransition.trigger(originXFrac, originYFrac, ev.tint);

      timelineView.classList.add('diving');
      document.body.classList.add('in-event');
      scrollHintText.textContent = 'usa as setas para o acontecimento anterior/seguinte';
      eventInfo.scrollTop = 0;
      resetCam();
      currentEvent = ev;
      timelineApi.jumpTo(events.indexOf(ev));
      eventTitle.textContent = ev.nome;
      appbarTitle.textContent = ev.nome;
      setEventTab('arvore'); // cada acontecimento abre no separador da árvore
      eventEra.textContent = ev.era;
      eventDesc.textContent = ev.desc;
      eventImportancia.textContent = ev.importancia;
      eventMensagem.textContent = ev.mensagem;
      eventContexto.textContent = ev.contexto || '';
      eventPassagens.innerHTML = ev.passagens.map(function (p) { return '<li>' + p + '</li>'; }).join('');
      eventIcon.innerHTML = window.EVENT_ICONS[ev.id] || '';
      eventAmbient.style.setProperty('--tint', ev.tint);
      eventView.style.setProperty('--tint', ev.tint);
      EventGraph.render(charLines, charButtons, ev.personagens, byId, data.edges, function (id) { focusChar(id); });
      fitEventView();
      panelBody.innerHTML = panelEmptyHtml;
      panel.classList.remove('open');
      document.getElementById('eventScroll').scrollTop = 0;
      requestAnimationFrame(function () { eventView.classList.add('shown'); });
      if (!fromHistory) {
        try {
          if (wasInEvent) history.replaceState({ ev: ev.id }, '', '#' + ev.id);
          else history.pushState({ ev: ev.id }, '', '#' + ev.id);
        } catch (e) {}
      }
    }

    // Parte visual da saída — sem tocar no histórico. `fx`/`fy` são frações
    // (0..1) da stage; por omissão o centro (usado quando a saída vem do
    // teclado ou do `popstate`, que não têm coordenadas de clique).
    function exitVisual(fx, fy) {
      if (typeof fx !== 'number') fx = 0.5;
      if (typeof fy !== 'number') fy = 0.5;
      var originPct = (fx * 100).toFixed(1) + '% ' + (fy * 100).toFixed(1) + '%';
      timelineView.style.transformOrigin = originPct;
      eventView.style.transformOrigin = originPct;
      WarpTransition.trigger(fx, fy, currentEvent ? currentEvent.tint : '#f0d060');
      // fecha primeiro a ficha (se aberta) para não sair a desvanecer por cima;
      // `leaving` faz o acontecimento desaparecer quase de imediato (mobile),
      // sem ficar por cima da timeline a entrar.
      panel.classList.remove('open');
      eventView.classList.add('leaving');
      eventView.classList.remove('shown');
      timelineView.classList.remove('diving');
      document.body.classList.remove('in-event');
      scrollHintText.textContent = 'arrasta a linha do tempo';
      currentEvent = null;
    }
    // O botão "voltar" da app recua no histórico; o `popstate` faz a saída
    // visual — assim o botão "voltar" do telemóvel e o da app são o mesmo.
    backBtn.addEventListener('click', function () { history.back(); });

    function enterEventCentered(ev, fromHistory) {
      var rect = document.querySelector('.stage').getBoundingClientRect();
      enterEvent(ev, rect.left + rect.width / 2, rect.top + rect.height / 2, fromHistory);
    }
    function eventById(id) {
      for (var i = 0; i < events.length; i++) if (events[i].id === id) return events[i];
      return null;
    }
    window.addEventListener('popstate', function () {
      var id = location.hash ? location.hash.slice(1) : '';
      if (!id) {
        if (currentEvent) exitVisual();
        return;
      }
      var ev = eventById(id);
      if (ev && (!currentEvent || currentEvent.id !== ev.id)) enterEventCentered(ev, true);
    });

    // Teclado: Escape fecha a ficha e, num segundo Escape, sai do
    // acontecimento (via history.back(), coerente com o botão voltar);
    // ←/→ percorrem o tempo — na linha do tempo deslizam a calha, dentro de
    // um acontecimento saltam para o anterior/seguinte.
    document.addEventListener('keydown', function (e) {
      var el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        if (panel.classList.contains('open')) {
          panel.classList.remove('open');
          clearFocusedChars();
        } else if (currentEvent) {
          history.back();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        var delta = e.key === 'ArrowLeft' ? -1 : 1;
        if (currentEvent) {
          var next = events[events.indexOf(currentEvent) + delta];
          if (next) { e.preventDefault(); enterEventCentered(next, false); }
        } else {
          e.preventDefault();
          timelineApi.stepEvent(delta);
        }
      }
    });

    // Bottom sheet (mobile): arrastar para baixo fecha a ficha. Começa na
    // pega (sempre) ou no conteúdo (só com o scroll interno no topo e gesto
    // descendente — senão o dedo está a fazer scroll do texto, não do sheet).
    var sheetArmed = false, sheetDragging = false, sheetFromHandle = false;
    var sheetStartY = 0, sheetDelta = 0, sheetLastY = 0, sheetLastT = 0, sheetVel = 0;
    function sheetIsMobile() { return window.matchMedia('(max-width: 720px)').matches; }
    panel.addEventListener('touchstart', function (e) {
      if (!sheetIsMobile() || !panel.classList.contains('open')) return;
      sheetFromHandle = !!e.target.closest('.sheet-handle');
      sheetArmed = true; sheetDragging = false; sheetDelta = 0;
      sheetStartY = sheetLastY = e.touches[0].clientY;
      sheetLastT = performance.now(); sheetVel = 0;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (!sheetArmed) return;
      var y = e.touches[0].clientY, dy = y - sheetStartY;
      if (!sheetDragging) {
        if (sheetFromHandle && Math.abs(dy) > 4) sheetDragging = true;
        else if (dy > 8 && panel.scrollTop <= 0) sheetDragging = true;
        else if (dy < -8) { sheetArmed = false; return; } // é scroll interno
        else return;
      }
      e.preventDefault();
      sheetDelta = Math.max(0, dy);
      panel.style.transition = 'none';
      panel.style.transform = 'translateY(' + sheetDelta + 'px)';
      var now = performance.now(), dt = now - sheetLastT;
      if (dt > 0) sheetVel = (y - sheetLastY) / dt;
      sheetLastY = y; sheetLastT = now;
    }, { passive: false });
    function endSheetDrag(cancelled) {
      if (!sheetDragging) { sheetArmed = false; return; }
      sheetArmed = false; sheetDragging = false;
      var hPanel = panel.getBoundingClientRect().height || 1;
      var shouldClose = !cancelled && (sheetDelta > hPanel * 0.3 || sheetVel > 0.55);
      panel.style.transition = '';
      panel.style.transform = '';
      if (shouldClose) { panel.classList.remove('open'); clearFocusedChars(); }
    }
    panel.addEventListener('touchend', function () { endSheetDrag(false); });
    panel.addEventListener('touchcancel', function () { endSheetDrag(true); });

    // Backdrop do sheet (mobile): o bottom sheet a 62dvh cobre o campo todo,
    // por isso "tocar fora" precisa de uma superfície própria atrás da ficha.
    // Um observador sincroniza-o com a classe .open do painel — assim reage a
    // TODOS os caminhos de fecho (X, swipe, Escape, popstate, trocar de
    // acontecimento) sem os ter de tocar um a um.
    var sheetBackdrop = document.getElementById('sheetBackdrop');
    new MutationObserver(function () {
      var show = panel.classList.contains('open') && sheetIsMobile();
      sheetBackdrop.classList.toggle('show', show);
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
    sheetBackdrop.addEventListener('click', function () { panel.classList.remove('open'); clearFocusedChars(); });

    // O menu inferior (setas + pontos de progresso) é partilhado com a
    // linha do tempo, mas dentro de um acontecimento passa a navegar
    // diretamente para o acontecimento anterior/seguinte (ou o escolhido),
    // em vez de só deslocar a calha invisível por trás — antes não fazia
    // nada de visível, a pedido da Isabel. `Timeline.init`'s próprios
    // handlers ignoram-se a si mesmos enquanto `isSuspended()` (in-event).
    function gotoAdjacentEvent(delta, e) {
      if (!currentEvent) return;
      var next = events[events.indexOf(currentEvent) + delta];
      if (!next) return;
      enterEvent(next, e.clientX, e.clientY);
    }
    document.getElementById('scrollLeft').addEventListener('click', function (e) {
      if (document.body.classList.contains('in-event')) gotoAdjacentEvent(-1, e);
    });
    document.getElementById('scrollRight').addEventListener('click', function (e) {
      if (document.body.classList.contains('in-event')) gotoAdjacentEvent(1, e);
    });
    document.getElementById('progressDots').addEventListener('click', function (e) {
      if (!document.body.classList.contains('in-event')) return;
      var dot = e.target.closest('.progress-dot');
      if (!dot) return;
      var target = events[parseInt(dot.getAttribute('data-idx'), 10)];
      if (target && target.id !== currentEvent.id) enterEvent(target, e.clientX, e.clientY);
    });

    // --- cartão de detalhe ---
    function familyOf(charId) {
      var family = EventGraph.deriveFamily(currentEvent.personagens, data.edges);
      var rel = [];
      family.casais.forEach(function (pair) {
        if (pair[0] === charId) rel.push({ id: pair[1], label: 'cônjuge' });
        else if (pair[1] === charId) rel.push({ id: pair[0], label: 'cônjuge' });
      });
      family.filhos.forEach(function (f) {
        if (f.filho === charId) f.pais.forEach(function (pid) { rel.push({ id: pid, label: 'progenitor' }); });
        else if (f.pais.indexOf(charId) !== -1) rel.push({ id: f.filho, label: 'filho(a)' });
      });
      family.irmaos.forEach(function (pair) {
        var label = pair[2] || 'irmão/irmã';
        if (pair[0] === charId) rel.push({ id: pair[1], label: label });
        else if (pair[1] === charId) rel.push({ id: pair[0], label: label });
      });
      return rel;
    }

    function crossEventRefsHtml(id) {
      var refs = [];
      var roster = currentEvent.personagens;
      data.edges.forEach(function (e) {
        if (e[0] !== id && e[1] !== id) return;
        var otherId = e[0] === id ? e[1] : e[0];
        if (roster.indexOf(otherId) !== -1) return;
        var other = byId[otherId];
        var otherEvent = firstEventOf[otherId];
        if (!other || !otherEvent || otherEvent.id === currentEvent.id) return;
        var typeLabel = { parent: 'Família', spouse: 'Casamento', sibling: 'Irmão/irmã', descendant: e[3] || 'Descendência', affinity: e[3] || 'Parentesco' }[e[2]] || e[2];
        refs.push('<span class="cross-event-ref" data-goto-id="' + escapeAttr(otherId) + '" tabindex="0" role="button" aria-label="Ir para ' + escapeAttr(other.nome) + '">' + other.nome + ' (' + typeLabel + ' · ' + otherEvent.nome + ')</span>');
      });
      return refs.length ? '<p class="card-section-title">Também aparece em</p><p>' + refs.join(', ') + '</p>' : '';
    }

    function focusChar(charId) {
      document.querySelectorAll('.char').forEach(function (el) { el.classList.toggle('focused', el.getAttribute('data-char-id') === charId); });
      // Uma personagem que aparece em vários acontecimentos (ex: Jesus em 9,
      // David em 3) tem texto próprio para cada aparição — `notas` do
      // acontecimento atual têm sempre prioridade sobre o registo global,
      // para nunca mostrar, por exemplo, a descrição do Jesus glorificado
      // do Apocalipse dentro do acontecimento do Nascimento.
      var base = byId[charId];
      var overrides = (currentEvent.notas && currentEvent.notas[charId]) || {};
      var d = Object.assign({}, base, overrides);
      var tint = (currentEvent && currentEvent.tint) || '#f0d060';
      var family = familyOf(charId);
      var familyHtml = family.length
        ? '<div class="family-chips">' + family.map(function (f) {
            var other = byId[f.id];
            return '<button class="family-chip" data-goto="' + escapeAttr(f.id) + '">' + (other ? other.nome : f.id) + '<span class="rel">' + f.label + '</span></button>';
          }).join('') + '</div>'
        : '<p class="no-family">Sem relações de família registadas neste acontecimento.</p>';
      var portrait = d.retrato
        ? '<div class="card-portrait" style="border-color:' + tint + '; box-shadow:0 0 26px ' + tint + '66"><img src="' + d.retrato + '" alt="Retrato de ' + escapeAttr(d.nome) + '"></div>'
        : '<div class="card-portrait" style="border-color:' + tint + '"></div>';
      panelBody.style.opacity = '0';
      panelBody.innerHTML =
        portrait +
        '<span class="card-era" style="color:' + tint + '">' + currentEvent.nome + '</span>' +
        '<h2 class="card-name">' + d.nome + '</h2>' +
        '<p class="card-refs">' + (d.refs || '') + '</p>' +
        '<p class="card-summary">' + d.resumo + '</p>' +
        (d.licao ? '<div class="card-highlight" style="--accent:' + tint + '"><span class="card-highlight-label">O que aprendemos</span><p>' + d.licao + '</p></div>' : '') +
        (d.citacao ? '<blockquote class="card-quote" style="border-color:' + tint + '">' + d.citacao + '</blockquote>' : '') +
        (d.importancia ? '<p class="card-section-title">Porque é importante</p><p class="card-body">' + d.importancia + '</p>' : '') +
        '<p class="card-section-title">Família (neste acontecimento)</p>' +
        familyHtml +
        crossEventRefsHtml(charId) +
        (d.contexto ? '<button class="card-context-toggle" type="button"><span class="arrow">&#9654;</span> Contexto histórico</button><div class="card-context-body" hidden><p class="card-body">' + d.contexto + '</p></div>' : '');
      panelBody.querySelectorAll('.family-chip').forEach(function (chip) {
        chip.addEventListener('click', function () { focusChar(chip.getAttribute('data-goto')); });
      });
      panelBody.querySelectorAll('.cross-event-ref').forEach(function (span) {
        span.addEventListener('click', function () { jumpToPersonagem(span.getAttribute('data-goto-id')); });
        span.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); jumpToPersonagem(span.getAttribute('data-goto-id')); }
        });
      });
      var ctxToggle = panelBody.querySelector('.card-context-toggle');
      if (ctxToggle) ctxToggle.addEventListener('click', function () {
        var body = panelBody.querySelector('.card-context-body');
        var open = body.hasAttribute('hidden');
        if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
        ctxToggle.classList.toggle('open', open);
      });
      // fade-in do conteúdo novo (o antigo é substituído já invisível)
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panelBody.style.opacity = ''; });
      });
      panel.scrollTop = 0; // ficha nova começa sempre no topo (chips/pesquisa)
      ensureCharVisible(charId);
      panel.classList.add('open');
    }

    // Salta para uma personagem, mudando de acontecimento se for preciso —
    // usado pela pesquisa e por "também aparece em".
    function jumpToPersonagem(id) {
      var targetEvent = firstEventOf[id];
      if (!targetEvent) return;
      if (!currentEvent || targetEvent.id !== currentEvent.id) {
        var stageEl = document.querySelector('.stage');
        var rect = stageEl.getBoundingClientRect();
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        enterEvent(targetEvent, cx, cy);
      }
      setTimeout(function () { focusChar(id); }, currentEvent && currentEvent.id === targetEvent.id ? 0 : 700);
    }

    // --- pesquisa ---
    var searchBox = document.getElementById('searchBox');
    var searchResults = document.getElementById('searchResults');
    var searchablePeople = Object.keys(byId).filter(function (id) {
      return ['major', 'standard', 'minor'].indexOf(byId[id].tier) !== -1;
    });
    searchBox.addEventListener('input', function () {
      var q = normalize(searchBox.value.trim());
      if (!q) { searchResults.hidden = true; searchResults.innerHTML = ''; return; }
      var matches = searchablePeople.filter(function (id) { return normalize(byId[id].nome).indexOf(q) !== -1; }).slice(0, 8);
      if (!matches.length) { searchResults.hidden = true; searchResults.innerHTML = ''; return; }
      searchResults.innerHTML = matches.map(function (id) {
        return '<div class="search-result" data-id="' + escapeAttr(id) + '" tabindex="0" role="button" aria-label="' + escapeAttr(byId[id].nome) + '">' + byId[id].nome + '<span class="sr-era">' + (firstEventOf[id] ? firstEventOf[id].nome : '') + '</span></div>';
      }).join('');
      searchResults.hidden = false;
    });
    function activateSearchResult(row) {
      searchResults.hidden = true;
      searchBox.value = byId[row.getAttribute('data-id')].nome;
      jumpToPersonagem(row.getAttribute('data-id'));
    }
    searchResults.addEventListener('click', function (ev) {
      var row = ev.target.closest('.search-result');
      if (row) activateSearchResult(row);
    });
    searchResults.addEventListener('keydown', function (ev) {
      var row = ev.target.closest('.search-result');
      if (!row) return;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activateSearchResult(row); }
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.search-wrap')) searchResults.hidden = true;
    });

    // O espaçamento das colunas dentro de um acontecimento é calculado a
    // partir da largura real dos nomes (canvas measureText) — se a fonte
    // Cormorant Garamond ainda não tiver carregado nesse momento, a medição
    // usa a serif de recurso e pode ficar ligeiramente errada. Assim que a
    // fonte carrega a sério, volta a desenhar o acontecimento aberto (se
    // algum) com a medição correta.
    // Base de linha do tempo no histórico, para o "voltar" nunca sair do
    // site — mesmo quando se entra por deep-link (#id) já dentro de um
    // acontecimento. A hash tem de ser lida ANTES do replaceState, que a apaga.
    var initHash = location.hash ? location.hash.slice(1) : '';
    try { history.replaceState({}, '', location.pathname + location.search); } catch (e) {}
    if (initHash) {
      var initEv = eventById(initHash);
      if (initEv) enterEventCentered(initEv, false);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (currentEvent) { EventGraph.render(charLines, charButtons, currentEvent.personagens, byId, data.edges, function (id) { focusChar(id); }); fitEventView(); }
      });
    }
  }
})();
