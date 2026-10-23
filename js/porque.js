/* ============================================================
   Proyectovisión · porque.js — sección "Tecnologías" (página Hogar)
   Movimiento: titular por líneas (SplitText), iconos que se dibujan,
   barras (si las hay) que crecen con ScrollTrigger, escáner y pulsos de luz
   en el marco (solo mientras la sección está en pantalla).
   Sin GSAP o con movimiento reducido, todo queda visible y quieto.
   ============================================================ */
window.PV = window.PV || {};
PV.sections = PV.sections || {};
PV.sections.porque = {
  init: function (PV) {
    var sec = document.getElementById('porque');
    if (!sec) return;
    var hayGsap = !!window.gsap;
    var hayST = !!(window.gsap && window.ScrollTrigger);
    var mover = hayGsap && !PV.reduced;
    var $$ = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };
    var conST = function (vars, trigger, start) {
      if (hayST) vars.scrollTrigger = { trigger: trigger, start: start || 'top 88%', once: true };
      return vars;
    };
    if (!mover) return;

    // 1. titular: entra línea por línea (se parte cuando las fuentes ya cargaron)
    var h2 = sec.querySelector('.porque__titulo');
    if (h2 && window.SplitText) {
      var partirTitulo = function () {
        var split = null;
        try { split = new SplitText(h2, { type: 'lines', linesClass: 'porque__linea-titulo' }); } catch (e) { split = null; }
        if (!split || !split.lines || !split.lines.length) return;
        h2.removeAttribute('data-reveal');
        h2.classList.remove('is-in');
        gsap.from(split.lines, conST({
          yPercent: 70, autoAlpha: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1,
          onComplete: function () { try { split.revert(); } catch (e) {} }
        }, h2, 'top 90%'));
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(partirTitulo); else partirTitulo();
    }

    // 2. iconos: cada trazo se dibuja al entrar la tarjeta (pathLength="1" en el SVG)
    $$('.porque__tarjeta').forEach(function (t, i) {
      var trazos = $$('.icono svg [pathLength]', t);
      if (!trazos.length) return;
      gsap.set(trazos, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.to(trazos, conST({ strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', stagger: 0.12, delay: 0.3 + i * 0.1 }, t));
    });

    // 3. comparación: las barras crecen (clip-path, no cambia el diseño); la de fibra remata con una punta de luz. Sin cifras: la comparación es cualitativa
    $$('.porque__metrica').forEach(function (m) {
      var rellenos = $$('.porque__relleno', m);
      if (!rellenos.length) return;
      gsap.set(rellenos, { clipPath: 'inset(-20px 100% -20px -20px round 999px)' });
      var tl = gsap.timeline(conST({}, m, 'top 85%'));
      rellenos.forEach(function (r, i) {
        var fila = r.closest('.porque__fila');
        tl.to(r, { clipPath: 'inset(-20px 0% -20px -20px round 999px)', duration: 1.4, ease: 'power3.out', clearProps: 'clipPath' }, i * 0.16);
        var punta = fila ? fila.querySelector('.porque__punta') : null;
        if (punta) {
          gsap.set(punta, { autoAlpha: 0, scale: 0.3 });
          tl.to(punta, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2.5)' }, i * 0.16 + 0.95);
        }
      });
    });

    // 4. bucles de luz: escáner que baja por la foto, pulsos en los bordes y destello en las barras de fibra
    var bucles = [];
    var escaner = sec.querySelector('.porque__escaner');
    if (escaner) bucles.push(gsap.fromTo(escaner, { yPercent: -22 }, { yPercent: 100, duration: 5.5, ease: 'sine.inOut', repeat: -1, repeatDelay: 1.4, paused: true }));
    $$('.porque__pulso').forEach(function (p, i) {
      bucles.push(gsap.fromTo(p, { xPercent: -100 }, { xPercent: 480, duration: 3.2, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.1, delay: i * 1.7, paused: true }));
    });
    $$('.porque__destello').forEach(function (d, i) {
      bucles.push(gsap.fromTo(d, { xPercent: -120 }, { xPercent: 420, duration: 2.4, ease: 'power2.inOut', repeat: -1, repeatDelay: 1.6, delay: 1.2 + i * 0.6, paused: true }));
    });
    var controlar = function (activo) { bucles.forEach(function (t) { activo ? t.play() : t.pause(); }); };
    if (hayST) ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: function (self) { controlar(self.isActive); } });
    else controlar(true);
  }
};
