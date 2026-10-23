/* ============================================================
   Proyectovisión · historia.js — sección "Nosotros" (#nosotros)
   - La línea de tiempo se dibuja con ScrollTrigger (scrub): solo transform.
   - Cada hito se enciende (nodo + tarjeta) cuando la luz pasa por su nodo.
   - Un pulso viaja en la punta de la luz.
   - Foto con parallax (scrub) y titular partido por palabras (SplitText).
   - Si no hay GSAP o PV.reduced: todo encendido y quieto.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.historia = {
  init: function (PV) {
    var sec = PV.$('#nosotros');
    if (!sec) return;
    var hitosCaja = PV.$('.historia__hitos', sec);
    var hitos = PV.$$('.historia__hito', sec);
    var nodos = hitos.map(function (h) { return PV.$('.historia__nodo', h); });
    var riel = PV.$('.historia__riel', sec);
    var luz = PV.$('.historia__riel-luz', sec);
    var pulso = PV.$('.historia__pulso', sec);
    var cierreNodo = PV.$('.historia__cierre-nodo', sec); // nodo «Hoy» del cierre: en vertical, el riel base sigue hasta él
    var img = PV.$('.historia__img', sec);
    var marco = PV.$('.historia__foto-marco', sec);
    var h2 = PV.$('.historia__titulo', sec);

    function encenderTodo() {
      hitos.forEach(function (h) { h.classList.add('is-on'); });
      if (luz) luz.style.transform = 'none';
      if (pulso) pulso.style.opacity = '0';
    }

    // sin GSAP/ScrollTrigger o con movimiento reducido: se ve todo, nada se mueve
    if (PV.reduced || !PV.hayST() || !hitosCaja || !riel || !luz || !nodos.length) { encenderTodo(); return; }

    /* ---------- titular partido por palabras (solo con las fuentes cargadas: así SplitText mide bien y no avisa) ---------- */
    function partirTitulo() {
      if (!h2 || !window.SplitText || h2.classList.contains('is-in')) return; // si el revelado normal ya lo mostró, no se anima dos veces
      var partes = PV.partir(h2, 'lines,words');
      if (partes && partes.words && partes.words.length) {
        h2.removeAttribute('data-reveal');
        gsap.from(partes.words, { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.07, scrollTrigger: { trigger: h2, start: 'top 88%', once: true } });
      }
    }
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(partirTitulo); else partirTitulo();

    /* ---------- parallax de la foto ---------- */
    if (img && marco) {
      gsap.fromTo(img, { yPercent: -7, scale: 1.14 }, { yPercent: 7, scale: 1.14, ease: 'none', scrollTrigger: { trigger: marco, start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    /* ---------- línea de tiempo ---------- */
    var horizontal = true;
    var largo = 1;            // px de riel entre el primer y el último nodo
    var umbrales = [0, 0.33, 0.66, 1];
    var encendidos = hitos.map(function () { return false; });
    var estado = { p: 0 };

    function topDoc(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
    function medir() {
      var caja = hitosCaja.getBoundingClientRect();
      var centros = nodos.map(function (n) {
        var r = n.getBoundingClientRect();
        return horizontal ? (r.left + r.width / 2 - caja.left) : (r.top + r.height / 2 - caja.top);
      });
      var inicio = centros[0], fin = centros[centros.length - 1];
      largo = Math.max(1, fin - inicio);
      umbrales = centros.map(function (c) { return (c - inicio) / largo; });
      var r0 = nodos[0].getBoundingClientRect();
      if (horizontal) {
        riel.style.left = inicio + 'px'; riel.style.width = largo + 'px'; riel.style.right = 'auto';
        riel.style.top = (r0.top + r0.height / 2 - caja.top - 1) + 'px'; riel.style.height = '2px'; riel.style.bottom = 'auto';
      } else {
        riel.style.top = inicio + 'px'; riel.style.height = largo + 'px'; riel.style.bottom = 'auto';
        riel.style.left = (r0.left + r0.width / 2 - caja.left - 1) + 'px'; riel.style.width = '2px'; riel.style.right = 'auto';
        if (cierreNodo) {
          // con offsetTop (y no getBoundingClientRect) para ignorar el translateY del revelado del cierre
          var ultimo = nodos[nodos.length - 1];
          riel.style.setProperty('--riel-extra', Math.max(48, Math.round(topDoc(cierreNodo) + cierreNodo.offsetHeight / 2 - (topDoc(ultimo) + ultimo.offsetHeight / 2))) + 'px');
        }
      }
      pintar(estado.p);
    }

    function pintar(p) {
      p = PV.clamp(p, 0, 1);
      gsap.set(luz, { scaleX: horizontal ? p : 1, scaleY: horizontal ? 1 : p });
      var d = p * largo;
      // la luz viajera se apaga al llegar a un nodo (a menos de 28 px, con 24 px de fundido): el hito no parece tener dos marcadores
      var dist = Infinity;
      for (var k = 0; k < umbrales.length; k++) dist = Math.min(dist, Math.abs(d - umbrales[k] * largo));
      gsap.set(pulso, { x: horizontal ? d : 0, y: horizontal ? 0 : d, opacity: PV.clamp((dist - 28) / 24, 0, 1) });
      for (var i = 0; i < hitos.length; i++) {
        var on = d >= umbrales[i] * largo - 28; // se enciende justo cuando el pulso entra en su zona de 28 px
        if (on !== encendidos[i]) { encendidos[i] = on; hitos[i].classList.toggle('is-on', on); }
      }
    }

    var tween = null;
    function montar() {
      if (tween) { if (tween.scrollTrigger) tween.scrollTrigger.kill(); tween.kill(); tween = null; }
      estado.p = 0;
      medir();
      tween = gsap.to(estado, {
        p: 1, ease: 'none',
        scrollTrigger: {
          trigger: hitosCaja,
          start: horizontal ? 'top 78%' : 'top 72%',
          end: horizontal ? 'top 28%' : 'bottom 62%',
          scrub: window.PV && window.PV.lenis ? true : 0.6, // Lenis ya suaviza: un scrub con retardo encima era un doble suavizado
          invalidateOnRefresh: true,
          onRefresh: function () { medir(); }
        },
        onUpdate: function () { pintar(estado.p); }
      });
    }

    if (gsap.matchMedia) {
      var mm = gsap.matchMedia();
      mm.add({ escritorio: '(min-width: 1081px)', movil: '(max-width: 1080px)' }, function (ctx) {
        horizontal = !!ctx.conditions.escritorio;
        montar();
        return function () { if (tween) { if (tween.scrollTrigger) tween.scrollTrigger.kill(); tween.kill(); tween = null; } };
      });
    } else {
      horizontal = window.matchMedia('(min-width: 1081px)').matches;
      montar();
    }

    // si cambia el alto de las tarjetas (fuentes, imagen), se vuelve a medir el riel
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { medir(); });
      ro.observe(hitosCaja);
    }
    if (img && !img.complete) img.addEventListener('load', function () { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, { once: true });
  }
};
