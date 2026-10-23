/* ============================================================
   Proyectovisión · preguntas.js — acordeón <details> animado con GSAP.
   - Abre y cierra midiendo la altura real del contenido (no max-height en CSS).
   - Una sola pregunta abierta a la vez; la primera viene abierta desde el HTML.
   - El pulso del riel (escritorio) viaja hasta la pregunta abierta.
   - Sin GSAP o con PV.reduced: el <details> funciona de forma nativa.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.preguntas = {
  init: function (PV) {
    var sec = PV.$('#preguntas');
    if (!sec) return;
    var lista = PV.$('.preguntas__lista', sec);
    var items = PV.$$('.preguntas__item', sec);
    var pulso = PV.$('.preguntas__pulso', sec);
    var rielLinea = PV.$('.preguntas__rielLinea', sec);
    if (!lista || !items.length) return;

    var animar = PV.hayGsap() && !PV.reduced;
    var refrescoPendiente = 0;

    function partes(d) {
      return { c: PV.$('.preguntas__cuerpo', d), r: PV.$('.preguntas__respuesta', d), s: PV.$('summary', d) };
    }
    function estaAbierta(d) { return d.classList.contains('is-abierta'); }
    function marcar(d, abierta) { d.classList.toggle('is-abierta', abierta); }

    // ScrollTrigger necesita saber que la página cambió de alto; se agrupa para no refrescar dos veces
    function refrescar() {
      if (!window.ScrollTrigger) return;
      clearTimeout(refrescoPendiente);
      refrescoPendiente = setTimeout(function () { ScrollTrigger.refresh(); }, 60);
    }

    function abrir(d) {
      var p = partes(d);
      marcar(d, true);
      if (!animar || !p.c) { d.open = true; return; }
      gsap.killTweensOf([p.c, p.r]);
      // si venía cerrándose, continúa desde la altura actual; si estaba cerrada, desde 0
      var desde = d.open ? p.c.getBoundingClientRect().height : 0;
      d.open = true;
      gsap.set(p.c, { height: desde });
      var hasta = p.c.scrollHeight;
      gsap.to(p.c, {
        height: hasta, duration: 0.65, ease: 'power3.out',
        onComplete: function () { gsap.set(p.c, { clearProps: 'height' }); refrescar(); moverPulso(false); }
      });
      gsap.fromTo(p.r, { y: 18, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.6, delay: 0.08, ease: 'power3.out',
        onComplete: function () { gsap.set(p.r, { clearProps: 'transform,opacity' }); }
      });
    }

    function cerrar(d) {
      var p = partes(d);
      marcar(d, false);
      if (!animar || !p.c) { d.open = false; return; }
      gsap.killTweensOf([p.c, p.r]);
      gsap.set(p.c, { height: p.c.getBoundingClientRect().height });
      gsap.to(p.r, { y: -10, opacity: 0, duration: 0.28, ease: 'power2.in' });
      gsap.to(p.c, {
        height: 0, duration: 0.45, ease: 'power3.inOut',
        onComplete: function () {
          d.open = false;
          gsap.set(p.c, { clearProps: 'height' });
          gsap.set(p.r, { clearProps: 'transform,opacity' });
          refrescar();
        }
      });
    }

    function cerrarOtras(d) {
      items.forEach(function (o) { if (o !== d && estaAbierta(o)) cerrar(o); });
    }

    // ----- pulso del riel: se calcula con las alturas finales (las demás cerradas) -----
    var ultimaY = -1;
    function posicionPulso() {
      var y = 0;
      for (var i = 0; i < items.length; i++) {
        var d = items[i], p = partes(d);
        if (!p.s) continue;
        var cs = getComputedStyle(d);
        var cerrada = p.s.offsetHeight + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
        if (i) y += parseFloat(getComputedStyle(d.parentElement).marginTop) || 0;
        if (estaAbierta(d)) return y + cerrada / 2;
        y += cerrada;
      }
      return -1;
    }
    function moverPulso(inmediato) {
      if (!pulso) return;
      var y = posicionPulso();
      if (y < 0) {
        if (animar) gsap.to(pulso, { opacity: 0, duration: 0.3 }); else pulso.style.opacity = '0';
        return;
      }
      if (!animar) { pulso.style.opacity = '1'; pulso.style.transform = 'translateY(' + y + 'px)'; ultimaY = y; return; }
      if (inmediato || ultimaY < 0) { gsap.set(pulso, { y: y, opacity: 1 }); ultimaY = y; return; }
      if (Math.abs(y - ultimaY) < 1) return;
      pulso.classList.toggle('is-sube', y < ultimaY);
      pulso.classList.add('is-viajando');
      gsap.to(pulso, {
        y: y, opacity: 1, duration: 0.7, ease: 'power3.inOut', overwrite: true,
        onComplete: function () { pulso.classList.remove('is-viajando'); }
      });
      ultimaY = y;
    }

    // ----- eventos -----
    items.forEach(function (d) {
      var s = PV.$('summary', d);
      if (!s) return;
      s.addEventListener('click', function (e) {
        if (!animar) return; // sin GSAP el navegador abre y cierra; el evento toggle sincroniza el estado
        e.preventDefault();
        if (estaAbierta(d)) cerrar(d);
        else { cerrarOtras(d); abrir(d); }
        moverPulso(false);
      });
      // toggle nativo (sin GSAP, con movimiento reducido o cuando el navegador abre un <details> al buscar en la página)
      d.addEventListener('toggle', function () {
        if (d.open && !estaAbierta(d)) { marcar(d, true); items.forEach(function (o) { if (o !== d && o.open) { marcar(o, false); o.open = false; } }); moverPulso(!animar); }
        else if (!d.open && estaAbierta(d)) { marcar(d, false); moverPulso(!animar); }
      });
      marcar(d, d.open);
    });

    // borde luminoso que sigue al puntero (solo con puntero fino)
    if (!PV.touch) {
      lista.addEventListener('pointermove', function (e) {
        var d = e.target.closest ? e.target.closest('.preguntas__item') : null;
        if (!d) return;
        var r = d.getBoundingClientRect();
        d.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        d.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    }

    // el riel se dibuja al entrar la lista en pantalla
    if (animar && PV.hayST() && rielLinea) {
      gsap.fromTo(rielLinea, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: lista, start: 'top 85%', end: 'bottom 75%', scrub: 0.6 }
      });
    }

    // posición inicial del pulso (y cuando cargan las fuentes o cambia el ancho)
    moverPulso(true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moverPulso(true); });
    var tResize = 0;
    window.addEventListener('resize', function () { clearTimeout(tResize); tResize = setTimeout(function () { moverPulso(true); }, 120); }, { passive: true });
  }
};
