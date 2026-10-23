/* ============================================================
   ticker.js — la cinta ya corre sola en CSS. Con GSAP, además:
   · el tween sustituye a la animación CSS (sección .is-gsap),
   · la velocidad del scroll empuja la cinta (hasta 3,5×) y la inclina un poco,
   · el puntero la frena con suavidad en vez de congelarla de golpe,
   · fuera de pantalla no se mueve nada.
   Con PV.reduced o sin GSAP no se toca nada: el CSS (o la calma) manda.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.ticker = {
  init: function (PV) {
    var sec = PV.$('#ticker');
    if (!sec || PV.reduced || !PV.hayGsap()) return;
    var cintas = PV.$$('.ticker__cinta', sec);
    if (!cintas.length) return;

    var piezas = [];
    cintas.forEach(function (cinta) {
      var pista = PV.$('.ticker__pista', cinta);
      if (!pista) return;
      var inv = cinta.hasAttribute('data-invertida');
      var dur = parseFloat(cinta.getAttribute('data-duracion')) || 30;
      var tw = gsap.fromTo(pista,
        { xPercent: inv ? -50 : 0, skewX: 0 },
        { xPercent: inv ? 0 : -50, duration: dur, ease: 'none', repeat: -1, paused: true });
      var pieza = { pista: pista, tw: tw, inv: inv, quieta: false, skew: 0 };
      if (!PV.touch) {
        cinta.addEventListener('pointerenter', function () { pieza.quieta = true; });
        cinta.addEventListener('pointerleave', function () { pieza.quieta = false; });
      }
      piezas.push(pieza);
    });
    if (!piezas.length) return;
    sec.classList.add('is-gsap');

    // solo corre mientras la sección está en pantalla
    var visible = false;
    function alternar(v) {
      visible = v;
      piezas.forEach(function (p) { v ? p.tw.play() : p.tw.pause(); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { alternar(en[0].isIntersecting); }, { threshold: 0 }).observe(sec);
    } else alternar(true);

    // la velocidad del scroll empuja la cinta y la inclina; el puntero la frena
    var ultimoY = window.scrollY || 0, vel = 0, inclin = 0;
    PV.bucleVisible(sec, function (ts, dt) {
      if (!visible) return;
      dt = PV.clamp(dt || 16, 1, 100);
      var y = window.scrollY || 0;
      var v = (y - ultimoY) / dt * 1000;
      ultimoY = y;
      vel += (v - vel) * 0.18;
      if (Math.abs(vel) < 2) vel = 0;
      var empuje = Math.min(Math.abs(vel) / 900, 2.5);
      var objInclin = PV.clamp(vel / 320, -5, 5);
      inclin += (objInclin - inclin) * 0.12;
      if (Math.abs(inclin) < 0.01) inclin = 0;
      piezas.forEach(function (p) {
        var obj = p.quieta ? 0 : 1 + empuje;
        var e = p.tw.timeScale();
        var n = e + (obj - e) * 0.1;
        if (Math.abs(n - e) > 0.0005) p.tw.timeScale(n);
        var s = p.inv ? inclin : -inclin;
        if (Math.abs(s - p.skew) > 0.02) { p.skew = s; gsap.set(p.pista, { skewX: s }); }
      });
    });
  }
};
