/* ============================================================
   Proyectovisión · planes.js — sección "Planes y precios" (#planes)
   - Pestañas de municipio con indicador deslizante (GSAP) y teclado.
   - Cambio de municipio: salida/entrada escalonada de tarjetas (solo
     opacidad y desplazamiento, sin escala: evita la costura al pintar),
     las megas "suben" al entrar, guarda localStorage['pv-municipio'] y
     dispara "pv:municipio" {detail:{clave}}.
   - Escucha "pv:municipio" (otras secciones) y la recomendación de la
     calculadora de "velocidad": evento "pv:plan" {detail:{megas}} (también
     "pv:recomendado") y, al arrancar, localStorage['pv-plan']; mueve
     .is-recomendada a la tarjeta de esos megas (o la primera que los cubra).
     Si no hay dato, recomienda el plan más chico, igual que la calculadora.
   - Sin GSAP o con PV.reduced: todo cambia al instante y se ve entero.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.planes = {
  init: function (PV) {
    var sec = PV.$('#planes');
    if (!sec) return;
    var tablist = PV.$('.planes__tabs', sec);
    var tabs = PV.$$('.planes__tab', sec);
    var ind = PV.$('.planes__indicador', sec);
    var paneles = PV.$$('.planes__panel', sec);
    var contenedorPaneles = PV.$('.planes__paneles', sec);
    var sedeTexto = PV.$('.planes__sede-texto', sec);
    var sedeNombre = PV.$('.planes__sede-nombre', sec);
    var sedeDir = PV.$('.planes__sede-dir', sec);
    if (!tabs.length || !paneles.length) return;

    var claves = tabs.map(function (t) { return t.getAttribute('data-clave'); });
    var gs = (PV.hayGsap() && !PV.reduced) ? window.gsap : null; // solo anima si hay GSAP y no se pidió calma
    var activa = null, tl = null, entrada = null;

    function panelDe(c) { for (var i = 0; i < paneles.length; i++) if (paneles[i].getAttribute('data-clave') === c) return paneles[i]; return null; }
    function tabDe(c) { for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('data-clave') === c) return tabs[i]; return null; }
    function piezas(panel) { return PV.$$('.planes__tarjeta, .planes__medida, .planes__tv, .planes__cotiza, .planes__oficina', panel); }
    function cerca() { var r = sec.getBoundingClientRect(); return r.top < window.innerHeight * 1.2 && r.bottom > -window.innerHeight * 0.2; }
    function refrescar() { if (window.ScrollTrigger) ScrollTrigger.refresh(); }

    // ---- indicador deslizante ----
    function moverIndicador(animar) {
      var t = tabDe(activa);
      if (!t || !ind) return;
      var p = { x: t.offsetLeft, y: t.offsetTop, width: t.offsetWidth, height: t.offsetHeight };
      if (gs && animar) gsap.to(ind, { x: p.x, y: p.y, width: p.width, height: p.height, duration: 0.55, ease: 'power3.out', overwrite: true });
      else if (window.gsap) gsap.set(ind, { x: p.x, y: p.y, width: p.width, height: p.height });
      else { ind.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; ind.style.width = p.width + 'px'; ind.style.height = p.height + 'px'; }
      ind.classList.add('is-lista');
    }

    function pintarTabs() {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-clave') === activa;
        t.classList.toggle('is-activa', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
    }
    function pintarSede(panel) {
      if (!panel) return;
      if (sedeNombre) sedeNombre.textContent = 'Oficina ' + (panel.getAttribute('data-nombre') || '');
      if (sedeDir) sedeDir.textContent = panel.getAttribute('data-direccion') || '';
    }

    // las megas suben de 0 al valor cuando la tarjeta entra (cifras que suben = datos que llegan)
    function subirMegas(panel) {
      if (!gs) return;
      PV.$$('.planes__tarjeta', panel).forEach(function (card, i) {
        var el = PV.$('.planes__megas-n', card);
        var fin = parseInt(card.getAttribute('data-megas'), 10);
        if (!el || !fin) return;
        var o = { v: 0 };
        gsap.to(o, { v: fin, duration: 0.8, delay: i * 0.06, ease: 'power2.out', overwrite: true, onUpdate: function () { el.textContent = Math.round(o.v); }, onComplete: function () { el.textContent = fin; } });
      });
    }

    // ---- mostrar sin animación (arranque y calma) ----
    function mostrar(clave) {
      activa = clave;
      paneles.forEach(function (p) {
        var on = p.getAttribute('data-clave') === clave;
        p.hidden = !on;
        if (on && window.gsap) gsap.set(piezas(p), { clearProps: 'opacity,transform,willChange' });
      });
      pintarTabs();
      pintarSede(panelDe(clave));
      moverIndicador(false);
    }

    function emitir(clave) {
      try { localStorage.setItem('pv-municipio', clave); } catch (e) {}
      try { document.dispatchEvent(new CustomEvent('pv:municipio', { bubbles: true, detail: { clave: clave, origen: 'planes' } })); } catch (e) {}
    }

    // ---- cambio de municipio ----
    function cambiar(clave, op) {
      op = op || {};
      if (claves.indexOf(clave) < 0 || clave === activa) return;
      var anterior = activa;
      var viejo = panelDe(anterior), nuevo = panelDe(clave);
      activa = clave;
      pintarTabs();
      moverIndicador(op.animar !== false);
      if (op.emitir !== false) emitir(clave);
      if (entrada) { entrada.kill(); entrada = null; }
      if (tl) { tl.kill(); tl = null; }
      paneles.forEach(function (p) { if (p !== viejo && p !== nuevo) p.hidden = true; });

      if (!gs || op.animar === false || !cerca()) {
        if (viejo) viejo.hidden = true;
        nuevo.hidden = false;
        if (window.gsap) gsap.set(piezas(nuevo), { clearProps: 'opacity,transform,willChange' });
        pintarSede(nuevo);
        refrescar();
        return;
      }

      // solo opacidad + desplazamiento (sin scale) y con will-change mientras dura: la tarjeta se rasteriza una vez y
      // luego solo se compone; sin eso se vuelve a pintar por mosaicos en cada cuadro y se ve partida a media altura
      var salen = viejo ? piezas(viejo) : [], entran = piezas(nuevo);
      tl = gsap.timeline({ onComplete: function () { tl = null; refrescar(); } });
      if (salen.length) tl.to(salen, { opacity: 0, y: -18, willChange: 'transform, opacity', duration: 0.28, ease: 'power2.in', stagger: { each: 0.035 }, overwrite: true }, 0);
      if (sedeTexto) tl.to(sedeTexto, { opacity: 0, y: -6, duration: 0.2, overwrite: true }, 0);
      tl.add(function () {
        if (viejo) { viejo.hidden = true; gsap.set(salen, { clearProps: 'willChange' }); }
        nuevo.hidden = false;
        pintarSede(nuevo);
        subirMegas(nuevo);
      });
      tl.fromTo(entran, { opacity: 0, y: 36, willChange: 'transform, opacity' }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,willChange', overwrite: true });
      if (sedeTexto) tl.fromTo(sedeTexto, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, clearProps: 'all' }, '<');
    }

    // ---- recomendación desde "velocidad" ----
    // megas: el plan que la calculadora eligió en su municipio; en los demás, la tarjeta exacta o la primera que los cubra.
    function recomendar(megas, op) {
      op = op || {};
      megas = parseInt(megas, 10);
      if (!megas) return;
      var cambio = false;
      paneles.forEach(function (p) {
        var cards = PV.$$('.planes__tarjeta', p), el = null;
        cards.forEach(function (c) { if (parseInt(c.getAttribute('data-megas'), 10) === megas) el = c; });
        if (!el) cards.forEach(function (c) { if (!el && parseInt(c.getAttribute('data-megas'), 10) >= megas) el = c; });
        if (!el) el = cards[cards.length - 1];
        cards.forEach(function (c) {
          var on = c === el;
          if (on && !c.classList.contains('is-recomendada')) cambio = true;
          c.classList.toggle('is-recomendada', on);
        });
      });
      // latido corto en la tarjeta visible cuando la recomendación cambia (no al arrancar ni durante una transición)
      if (gs && cambio && !tl && !entrada && !op.silencio) {
        var vis = PV.$('.planes__panel:not([hidden]) .planes__tarjeta.is-recomendada', sec);
        if (vis) gsap.fromTo(vis, { opacity: 0.55 }, { opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto', clearProps: 'opacity' });
      }
      refrescar();
    }
    function recomendarInicial() {
      var v = null;
      try { v = parseInt(localStorage.getItem('pv-plan'), 10); } catch (e) { v = null; }
      if (v) { recomendar(v, { silencio: true }); return; }
      // sin dato de la calculadora: el plan de 100 megas (o, si el municipio no lo tiene, el del medio de su lista)
      paneles.forEach(function (p) {
        var tarjetas = PV.$$('.planes__tarjeta', p);
        var idx = tarjetas.findIndex(function (c) { return parseInt(c.getAttribute('data-megas'), 10) === 100; });
        if (idx < 0) idx = Math.floor((tarjetas.length - 1) / 2);
        tarjetas.forEach(function (c, i) { c.classList.toggle('is-recomendada', i === idx); });
      });
    }

    // ---- eventos ----
    tablist.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.planes__tab') : null;
      if (!t) return;
      cambiar(t.getAttribute('data-clave'));
    });
    tablist.addEventListener('keydown', function (e) {
      var i = claves.indexOf(activa), j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % claves.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + claves.length) % claves.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = claves.length - 1;
      if (j < 0) return;
      e.preventDefault();
      cambiar(claves[j]);
      var t = tabDe(claves[j]); if (t) t.focus();
    });

    function alMunicipio(e) {
      var d = e && e.detail;
      if (!d || !d.clave || d.origen === 'planes') return;
      cambiar(d.clave, { emitir: false });
    }
    function alPlan(e) { var d = e && e.detail; if (d && d.megas) recomendar(d.megas); }
    document.addEventListener('pv:municipio', alMunicipio);
    window.addEventListener('pv:municipio', alMunicipio);
    document.addEventListener('pv:plan', alPlan);          // lo que emite velocidad.js
    document.addEventListener('pv:recomendado', alPlan);   // nombre antiguo, por compatibilidad
    window.addEventListener('storage', function (e) { if (e.key === 'pv-plan' && e.newValue) recomendar(e.newValue, { silencio: true }); });

    var tResize = 0;
    window.addEventListener('resize', function () { clearTimeout(tResize); tResize = setTimeout(function () { moverIndicador(false); }, 120); }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moverIndicador(false); });

    // ---- arranque: municipio guardado o el primero; recomendación guardada o el plan más chico ----
    var guardado = null;
    try { guardado = localStorage.getItem('pv-municipio'); } catch (e) {}
    mostrar(claves.indexOf(guardado) >= 0 ? guardado : claves[0]);
    recomendarInicial();

    // entrada escalonada del panel visible al llegar a la sección
    if (gs && PV.hayST()) {
      gsap.set(piezas(panelDe(activa)), { opacity: 0, y: 44, willChange: 'transform, opacity' });
      entrada = ScrollTrigger.create({
        trigger: contenedorPaneles, start: 'top 85%', once: true,
        onEnter: function () {
          entrada = null;
          var p = panelDe(activa);
          gsap.to(piezas(p), { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, clearProps: 'transform,willChange', overwrite: 'auto' });
          subirMegas(p);
        }
      });
    }
  }
};
