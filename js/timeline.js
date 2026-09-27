(function () {
  // Linha do tempo horizontal — mapa de acontecimentos, substitui o mapa de
  // galáxias da Ronda 12. Só lê `events` (nunca os muda) e reporta a
  // intenção de mergulhar num acontecimento via `onEnter`.

  var SPACING = 340;
  var WAVE_AMP = 30;

  function boundsFor(n) { return { min: (n > 1 ? -(n - 1) * SPACING : 0), max: 0 }; }
  function nearestIndex(offset, n) {
    return Math.max(0, Math.min(n - 1, Math.round(-offset / SPACING)));
  }
  function snapTarget(offset, n) { return -nearestIndex(offset, n) * SPACING; }
  function clampHard(raw, n) {
    var b = boundsFor(n);
    return Math.max(b.min, Math.min(b.max, raw));
  }
  function clampElastic(raw, n) {
    var b = boundsFor(n);
    if (raw > b.max) return b.max + (raw - b.max) / 3;
    if (raw < b.min) return b.min + (raw - b.min) / 3;
    return raw;
  }

  function markerY(i) { return Math.sin(i * 0.8) * WAVE_AMP; }

  function init(opts) {
    // opts: { view, rail, railPath, railSvg, progressDots, scrollLeftBtn,
    //         scrollRightBtn, events, onEnter }
    var view = opts.view, rail = opts.rail, railPath = opts.railPath, railSvg = opts.railSvg;
    var progressDots = opts.progressDots;
    var events = opts.events;
    var onEnter = opts.onEnter;
    var railOffset = 0;
    var lastCenterIdx = -1;

    function render() {
      var totalWidth = (events.length - 1) * SPACING;
      rail.style.width = totalWidth + 'px';

      var buttonsHtml = '';
      events.forEach(function (ev, i) {
        var y = markerY(i);
        var avatarsHtml = ev.personagens.slice(0, 4).map(function (id) {
          var d = opts.defs[id];
          return '<span class="event-avatar">' + (d && d.retrato ? '<img src="' + d.retrato + '" alt="" draggable="false">' : '') + '</span>';
        }).join('');
        buttonsHtml += '<button class="event-marker" data-idx="' + i + '" style="left:' + (i * SPACING) + 'px; top:' + y + 'px; --tint:' + ev.tint + '">' +
          '<div class="event-avatars">' + avatarsHtml + '</div>' +
          '<div class="event-dot-wrap"><span class="event-dot-ring"></span><span class="event-dot"></span></div>' +
          '<span class="event-label">' + ev.nome + '<span class="event-era">' + ev.era + '</span></span>' +
          '</button>';
      });
      rail.insertAdjacentHTML('beforeend', buttonsHtml);
      Array.prototype.forEach.call(rail.querySelectorAll('.event-marker'), function (btn) {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        btn.addEventListener('click', function (e) { onEnter(events[idx], e.clientX, e.clientY); });
      });

      var pts = events.map(function (ev, i) { return { x: i * SPACING, y: 140 + markerY(i) }; });
      var d = 'M ' + pts[0].x + ' ' + pts[0].y;
      for (var i = 0; i < pts.length - 1; i++) {
        var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        d += ' Q ' + pts[i].x + ' ' + pts[i].y + ' ' + mx + ' ' + my;
      }
      d += ' T ' + pts[pts.length - 1].x + ' ' + pts[pts.length - 1].y;
      railPath.setAttribute('d', d);
      railSvg.setAttribute('width', totalWidth + 200);
      railSvg.setAttribute('height', '320');
      railSvg.style.left = '-100px';
      railPath.setAttribute('transform', 'translate(100,0)');

      // Colorir a calha pelas cores das eras (o gradiente flui pelo tint de
      // cada acontecimento, distribuído ao longo do seu comprimento).
      var grad = railSvg.querySelector('#railGrad');
      if (grad) {
        grad.innerHTML = '';
        events.forEach(function (ev, i) {
          var stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          stop.setAttribute('offset', (events.length > 1 ? (i / (events.length - 1)) * 100 : 0) + '%');
          stop.setAttribute('stop-color', ev.tint || '#4a4580');
          stop.setAttribute('stop-opacity', '.9');
          grad.appendChild(stop);
        });
      }

      renderProgressDots();
      applyOffset();
    }

    function renderProgressDots() {
      progressDots.innerHTML = events.map(function (ev, i) {
        return '<button class="progress-dot" data-idx="' + i + '" title="' + ev.nome + '"></button>';
      }).join('');
      Array.prototype.forEach.call(progressDots.querySelectorAll('.progress-dot'), function (dot) {
        dot.addEventListener('click', function () {
          if (opts.isSuspended && opts.isSuspended()) return;
          animateTo(-parseInt(dot.getAttribute('data-idx'), 10) * SPACING);
        });
      });
    }

    function applyOffset() {
      var stageWidth = view.parentElement.clientWidth;
      rail.style.transform = 'translateX(' + (stageWidth / 2 + railOffset) + 'px)';
      var nearest = Math.max(0, Math.min(events.length - 1, Math.round(-railOffset / SPACING)));
      Array.prototype.forEach.call(progressDots.querySelectorAll('.progress-dot'), function (dot, i) {
        dot.classList.toggle('active', i === nearest);
      });
      updateArrowState();
      if (nearest !== lastCenterIdx) {
        lastCenterIdx = nearest;
        if (opts.onCenter && events[nearest]) opts.onCenter(events[nearest].tint, nearest);
      }
    }

    function updateArrowState() {
      var idx = nearestIndex(railOffset, events.length);
      if (opts.scrollLeftBtn) opts.scrollLeftBtn.disabled = (idx <= 0);
      if (opts.scrollRightBtn) opts.scrollRightBtn.disabled = (idx >= events.length - 1);
    }
    function stepEvent(delta) {
      var idx = nearestIndex(railOffset, events.length);
      var target = Math.max(0, Math.min(events.length - 1, idx + delta));
      animateTo(-target * SPACING);
    }

    var dragging = false, dragStartX = 0, dragStartOffset = 0;
    var lastX = 0, lastT = 0, velocity = 0, momentumRAF = null;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function cancelMomentum() { if (momentumRAF) { cancelAnimationFrame(momentumRAF); momentumRAF = null; } }

    function animateTo(to, dur) {
      cancelMomentum();
      if (reduceMotion) { railOffset = to; applyOffset(); return; }
      var from = railOffset, start = performance.now();
      dur = dur || 320;
      function anim(now) {
        var t = Math.min(1, (now - start) / dur);
        var e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        railOffset = from + (to - from) * e;
        applyOffset();
        if (t < 1) momentumRAF = requestAnimationFrame(anim); else momentumRAF = null;
      }
      momentumRAF = requestAnimationFrame(anim);
    }

    function settleFromVelocity() {
      cancelMomentum();
      var b = boundsFor(events.length);
      if (reduceMotion) { animateTo(snapTarget(railOffset, events.length)); return; }
      var v = velocity * 16; // px por frame (~16ms)
      function step() {
        v *= 0.94;
        railOffset += v;
        if (railOffset > b.max) { railOffset += (b.max - railOffset) * 0.2; v *= 0.5; }
        else if (railOffset < b.min) { railOffset += (b.min - railOffset) * 0.2; v *= 0.5; }
        applyOffset();
        var outOfBounds = railOffset > b.max + 0.5 || railOffset < b.min - 0.5;
        if (Math.abs(v) > 0.4 || outOfBounds) {
          momentumRAF = requestAnimationFrame(step);
        } else {
          animateTo(snapTarget(railOffset, events.length)); // encaixe final
        }
      }
      momentumRAF = requestAnimationFrame(step);
    }

    view.addEventListener('mousedown', function (e) {
      if (e.target.closest('.event-marker')) return;
      dragging = true; dragStartX = e.clientX; dragStartOffset = railOffset;
      view.classList.add('dragging');
      cancelMomentum();
      lastX = e.clientX; lastT = performance.now(); velocity = 0;
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      railOffset = clampElastic(dragStartOffset + (e.clientX - dragStartX), events.length);
      var nowT = performance.now(), dt = nowT - lastT;
      if (dt > 0) velocity = (e.clientX - lastX) / dt;
      lastX = e.clientX; lastT = nowT;
      applyOffset();
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false; view.classList.remove('dragging');
      settleFromVelocity();
    });
    // Arrastar com o dedo — o toque nunca dispara `mousedown`/`mousemove`,
    // por isso sem isto a linha do tempo era completamente impossível de
    // percorrer por arrasto num telemóvel real (só as setas funcionavam).
    view.addEventListener('touchstart', function (e) {
      if (e.target.closest('.event-marker') || e.touches.length !== 1) return;
      dragging = true; dragStartX = e.touches[0].clientX; dragStartOffset = railOffset;
      view.classList.add('dragging');
      cancelMomentum();
      lastX = e.touches[0].clientX; lastT = performance.now(); velocity = 0;
    }, { passive: true });
    view.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      e.preventDefault();
      railOffset = clampElastic(dragStartOffset + (e.touches[0].clientX - dragStartX), events.length);
      var nowT2 = performance.now(), dt2 = nowT2 - lastT;
      if (dt2 > 0) velocity = (e.touches[0].clientX - lastX) / dt2;
      lastX = e.touches[0].clientX; lastT = nowT2;
      applyOffset();
    }, { passive: false });
    window.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false; view.classList.remove('dragging');
      settleFromVelocity();
    });
    window.addEventListener('touchcancel', function () { dragging = false; view.classList.remove('dragging'); });
    view.addEventListener('wheel', function (e) {
      e.preventDefault();
      cancelMomentum();
      railOffset = clampHard(railOffset - (e.deltaY || e.deltaX), events.length);
      applyOffset();
    }, { passive: false });
    if (opts.scrollLeftBtn) opts.scrollLeftBtn.addEventListener('click', function () {
      if (opts.isSuspended && opts.isSuspended()) return;
      stepEvent(-1);
    });
    if (opts.scrollRightBtn) opts.scrollRightBtn.addEventListener('click', function () {
      if (opts.isSuspended && opts.isSuspended()) return;
      stepEvent(1);
    });
    window.addEventListener('resize', applyOffset);

    // Sincroniza os pontos de progresso e a posição da calha com um
    // acontecimento entrado por qualquer outro caminho (marcador, pesquisa,
    // "também aparece em", ou as setas do menu inferior enquanto já se está
    // dentro de um acontecimento) — sem disparar `onEnter` de novo.
    function jumpTo(idx) {
      cancelMomentum();
      railOffset = clampHard(-idx * SPACING, events.length);
      applyOffset();
    }

    render();
    return { applyOffset: applyOffset, jumpTo: jumpTo, stepEvent: stepEvent };
  }

  var Timeline = {
    init: init,
    SPACING: SPACING,
    boundsFor: boundsFor,
    nearestIndex: nearestIndex,
    snapTarget: snapTarget,
    clampHard: clampHard,
    clampElastic: clampElastic
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Timeline;
  if (typeof window !== 'undefined') window.Timeline = Timeline;
})();
