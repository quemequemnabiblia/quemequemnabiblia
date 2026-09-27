(function () {
  // Matemática pura da câmara do interior de um acontecimento (#camLayer):
  // transform: translate(tx,ty) scale(s) com transform-origin no centro do
  // campo → um ponto de conteúdo q aparece no ecrã em p = c + T + s*(q - c),
  // com c = (w/2, h/2). Sem DOM — testado em scripts/test-camera.js.

  function screenPoint(cam, w, h, qx, qy) {
    return {
      x: w / 2 + cam.tx + cam.scale * (qx - w / 2),
      y: h / 2 + cam.ty + cam.scale * (qy - h / 2)
    };
  }

  // Zoom com âncora: o ponto do ecrã (px,py) mostra o mesmo conteúdo antes e
  // depois. Se o clamp não deixar a escala mudar, devolve a câmara igual —
  // senão o utilizador via a cena a "escorregar" ao insistir no limite.
  function zoomAt(cam, w, h, px, py, factor, minS, maxS) {
    var s2 = Math.max(minS, Math.min(maxS, cam.scale * factor));
    if (s2 === cam.scale) return { scale: cam.scale, tx: cam.tx, ty: cam.ty };
    var r = s2 / cam.scale;
    return {
      scale: s2,
      tx: px - w / 2 - r * (px - w / 2 - cam.tx),
      ty: py - h / 2 - r * (py - h / 2 - cam.ty)
    };
  }

  // Translação que coloca o conteúdo (qx,qy) no ponto do ecrã (targetX,
  // targetY), mantendo a escala.
  function centerTarget(cam, w, h, qx, qy, targetX, targetY) {
    return {
      tx: targetX - w / 2 - cam.scale * (qx - w / 2),
      ty: targetY - h / 2 - cam.scale * (qy - h / 2)
    };
  }

  var CameraMath = { screenPoint: screenPoint, zoomAt: zoomAt, centerTarget: centerTarget };
  if (typeof module !== 'undefined' && module.exports) module.exports = CameraMath;
  if (typeof window !== 'undefined') window.CameraMath = CameraMath;
})();
