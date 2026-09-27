(function () {
  // Salto no hiperespaço — canvas de fundo com estrelas a cintilar sempre
  // visível, mais um rasto de streaks radiais disparado em cada transição
  // entre a linha do tempo e o interior de um acontecimento (ou diretamente
  // entre dois acontecimentos, via pesquisa ou "também aparece em"). Desde
  // a Ronda 14, o salto parte do ponto exato do clique e usa a cor própria
  // do acontecimento (`tint`), não um ponto fixo com uma única cor dourada.
  function createWarpTransition() {
    var canvas, ctx;
    var stars = [];
    var reduceMotion = false;
    var warpActive = false;
    var warpStart = 0;
    var WARP_DURATION = 700;
    var warpParticles = [];
    var warpTint = '#f0d060';

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function init(canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      resize();
      window.addEventListener('resize', resize);
      stars = [];
      for (var i = 0; i < 200; i++) {
        stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, o: Math.random() * 0.55 + 0.15, p: Math.random() * Math.PI * 2 });
      }
      requestAnimationFrame(drawFrame);
    }

    // originXFrac/originYFrac: 0-1, posição do clique relativa ao ecrã.
    // tint: cor hexadecimal do acontecimento (o clarão e os streaks usam-na).
    function trigger(originXFrac, originYFrac, tint) {
      if (reduceMotion) return;
      warpActive = true;
      warpStart = performance.now();
      warpTint = tint || '#f0d060';
      warpParticles = [];
      var cx = (originXFrac === undefined ? 0.5 : originXFrac) * canvas.width;
      var cy = (originYFrac === undefined ? 0.5 : originYFrac) * canvas.height;
      for (var i = 0; i < 140; i++) {
        warpParticles.push({ ox: cx, oy: cy, angle: Math.random() * Math.PI * 2, dist: Math.random() * 20, speed: 110 + Math.random() * 260 });
      }
    }

    function drawWarp(t) {
      var elapsed = t - warpStart;
      var progress = Math.min(1, elapsed / WARP_DURATION);
      if (progress >= 1) { warpActive = false; return; }
      var kick = 1 + progress * progress * 13;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      warpParticles.forEach(function (p) {
        var prevDist = p.dist;
        p.dist += p.speed * kick * 0.016;
        var x1 = p.ox + Math.cos(p.angle) * prevDist, y1 = p.oy + Math.sin(p.angle) * prevDist * 0.6;
        var x2 = p.ox + Math.cos(p.angle) * p.dist, y2 = p.oy + Math.sin(p.angle) * p.dist * 0.6;
        var fade = 1 - progress;
        ctx.strokeStyle = 'rgba(232,228,216,' + (0.55 * fade).toFixed(3) + ')';
        ctx.lineWidth = 1 + progress * 1.8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      var flash = Math.max(0, 1 - Math.abs(progress - 0.45) * 5);
      if (flash > 0 && warpParticles.length) {
        var grad = ctx.createRadialGradient(warpParticles[0].ox, warpParticles[0].oy, 0, warpParticles[0].ox, warpParticles[0].oy, Math.max(canvas.width, canvas.height) * 0.55);
        grad.addColorStop(0, warpTint + Math.round(flash * 55).toString(16).padStart(2, '0'));
        grad.addColorStop(1, warpTint + '00');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    }

    function drawFrame(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#d8d4f5';
      stars.forEach(function (s) {
        var tw = 0.6 + 0.4 * Math.sin(t / 900 + s.p);
        ctx.globalAlpha = s.o * tw;
        ctx.beginPath(); ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (warpActive) drawWarp(t);
      requestAnimationFrame(drawFrame);
    }

    return { init: init, trigger: trigger };
  }

  var WarpTransition = createWarpTransition();
  if (typeof module !== 'undefined' && module.exports) module.exports = WarpTransition;
  if (typeof window !== 'undefined') window.WarpTransition = WarpTransition;
})();
