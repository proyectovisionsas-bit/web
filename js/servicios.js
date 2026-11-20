/* ============================================================
   Proyectovisión · servicios.js — "Lo que hacemos".
   Escritorio (≥ 761 px, sin movimiento reducido): escena fijada con ScrollTrigger y los cinco
   paneles en scroll horizontal (scrub), parallax de cada foto, revelado del contenido al entrar
   cada panel, barra de progreso con luz y contador, chips que saltan al panel; al soltar la rueda
   el panel más cercano se alinea entero en la ventana (snap). Mientras la escena está fijada,
   html.servicios-fijo apaga el botón flotante «subir» del pie (servicios.css) para que no tape
   el chip «05 Energía».
   Celular: pila de tarjetas; solo un parallax vertical suave de la foto.
   Sin GSAP o con PV.reduced: no se mueve nada y todo queda visible (modo apilado).
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.servicios = {
  init: function (PV) {
    var seccion = PV.$('#servicios');
    if (!seccion) return;
    var escena = PV.$('.servicios__escena', seccion);
    var carril = PV.$('.servicios__carril', seccion);
    var paneles = PV.$$('.servicios__panel', seccion);
    var titulo = PV.$('.servicios__titulo', seccion);
    var barra = PV.$('.servicios__barra', seccion);
    var progreso = PV.$('.servicios__progreso', seccion);
    var relleno = PV.$('.servicios__progreso__relleno', seccion);
    var luz = PV.$('.servicios__progreso__luz', seccion);
    var actual = PV.$('.servicios__contador__actual', seccion);
    var guia = PV.$('.servicios__guia', seccion);
    var chips = PV.$$('.servicios__chip', seccion);
    var fotos = PV.$$('.servicios__foto', seccion);
    var n = paneles.length;
    if (!n || !PV.hayST()) return; // sin GSAP: tarjetas apiladas, todo visible

    // las fotos son lazy (están bajo el pliegue); al acercarse la sección se piden todas de una vez.
    // Son las versiones de assets/gen (640 / 1000 / 1600 px con srcset): el navegador baja una sola por panel.
    var precargado = false;
    function precargar() {
      if (precargado) return;
      precargado = true;
      fotos.forEach(function (img) { if (img.loading === 'lazy') img.loading = 'eager'; });
    }
    ScrollTrigger.create({ trigger: seccion, start: 'top 160%', once: true, onEnter: precargar });

    // titular por palabras (SplitText) cuando la escena entra; sin SplitText, un fundido simple
    function animarTitulo() {
      if (PV.reduced || !titulo) return;
      var split = PV.partir(titulo, 'lines,words');
      var objetivo = split && split.words && split.words.length ? split.words : titulo;
      gsap.from(objetivo, {
        yPercent: objetivo === titulo ? 0 : 110, y: objetivo === titulo ? 30 : 0, opacity: 0,
        stagger: 0.07, duration: 1.1, ease: 'power4.out',
        scrollTrigger: { trigger: escena, start: 'top 78%', once: true }
      });
    }
    // se parte el titular solo con las fuentes ya cargadas (si no, SplitText mide mal las líneas)
    function cuandoFuentes(cb) {
      if (!document.fonts || !document.fonts.load) { cb(); return; }
      var pedidos = ['600 1em "Clash Display"', '700 1em "Clash Display"', '400 1em Satoshi', '500 1em Satoshi', '700 1em Satoshi']
        .map(function (f) { return document.fonts.load(f).catch(function () {}); });
      var intentos = 0;
      function listo() {
        if (document.fonts.status === 'loading' && intentos++ < 8) { setTimeout(function () { document.fonts.ready.then(listo, cb); }, 100); return; }
        cb();
      }
      Promise.all(pedidos).then(function () { return document.fonts.ready; }).then(listo, cb);
    }
    cuandoFuentes(animarTitulo);

    // ---------- escritorio: pin + scroll horizontal ----------
    function horizontal() {
      seccion.classList.add('is-horizontal');
      // en este modo el revelado lo hace GSAP por piezas; se quita el revelado genérico de las tarjetas.
      // .tema-oscuro (base.css): la foto ocupa todo el panel con la letra encima, así que los paneles siguen oscuros
      // también en modo diurno (con un velo claro, las fotos oscuras quedaban grises y la letra se leía mal)
      paneles.forEach(function (p) { p.removeAttribute('data-reveal'); p.classList.remove('is-in'); p.classList.add('tema-oscuro'); });

      var html = document.documentElement;
      var dist = 0, pad0 = 0, paso = 0, ancho = 0, vw = 0, anchoProgreso = 0, activo = -1;
      var ultimo = paneles[n - 1];
      function medir() {
        pad0 = parseFloat(getComputedStyle(carril).paddingLeft) || 0;
        ancho = paneles[0].offsetWidth;
        paso = n > 1 ? paneles[1].offsetLeft - paneles[0].offsetLeft : ancho;
        vw = carril.clientWidth;
        // distancia real: el último panel queda con el mismo margen a la derecha que el primero a la izquierda
        dist = Math.max(0, ultimo.offsetLeft + ultimo.offsetWidth + pad0 - vw);
        anchoProgreso = progreso ? progreso.offsetWidth : 0;
        return dist;
      }
      medir();

      // ---------- que nada se monte sobre el título ----------
      // Con poco alto (o un título de dos líneas) el número grande de arriba o el rótulo de la esquina podían quedar
      // encima del título. Se mide con posiciones de diseño (offset*, sin los transform del revelado): primero se achica
      // el número, y si aún no cabe se quita (el «02 / 05» y los botones de abajo ya dicen en qué panel va); el rótulo,
      // si choca, se quita. Se repite en cada refresh de ScrollTrigger (cambio de tamaño) y al cargar las fuentes.
      function caja(el, pnl) {
        if (!el || !el.getClientRects().length) return null;
        var t = 0, l = 0, x = el;
        while (x && x !== pnl) { t += x.offsetTop; l += x.offsetLeft; x = x.offsetParent; }
        return { t: t, b: t + el.offsetHeight, l: l, r: l + el.offsetWidth };
      }
      function choca(a, b) { return a && b && a.l < b.r && b.l < a.r && a.t < b.b + 12 && b.t < a.b + 12; }
      function ajustarPaneles() {
        paneles.forEach(function (p) {
          p.classList.remove('is-num-chico', 'is-sin-num', 'is-sin-dato');
          var tit = PV.$('.servicios__nombre', p), num = PV.$('.servicios__num', p), dato = PV.$('.servicios__dato', p);
          if (!tit) return;
          if (choca(caja(num, p), caja(tit, p))) {
            p.classList.add('is-num-chico');
            if (choca(caja(num, p), caja(tit, p))) { p.classList.remove('is-num-chico'); p.classList.add('is-sin-num'); }
          }
          if (choca(caja(dato, p), caja(tit, p))) p.classList.add('is-sin-dato');
        });
      }
      ajustarPaneles();
      ScrollTrigger.addEventListener('refresh', ajustarPaneles);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarPaneles);

      // progreso en el que cada panel queda alineado a la izquierda (el último, alineado a la derecha: 1)
      function puntos() {
        return paneles.map(function (p) { return dist ? PV.clamp((p.offsetLeft - pad0) / dist, 0, 1) : 0; });
      }
      function masCercano(v) {
        var ps = puntos(), mejor = ps[0];
        for (var i = 1; i < ps.length; i++) { if (Math.abs(ps[i] - v) < Math.abs(mejor - v)) mejor = ps[i]; }
        return mejor;
      }

      var ponerRelleno = relleno ? gsap.quickSetter(relleno, 'scaleX') : function () {};
      var ponerLuz = luz ? gsap.quickSetter(luz, 'x', 'px') : function () {};
      var guiaVisible = true;
      function mostrarGuia(ver) {
        if (!guia || ver === guiaVisible) return;
        guiaVisible = ver;
        gsap.to(guia, { opacity: ver ? 1 : 0, duration: 0.4, overwrite: true });
      }

      function activar(i) {
        if (i === activo) return;
        activo = i;
        if (actual) actual.textContent = (i < 9 ? '0' : '') + (i + 1);
        paneles.forEach(function (p, k) { p.classList.toggle('is-activa', k === i); });
        chips.forEach(function (ch, k) {
          ch.classList.toggle('is-activa', k === i);
          if (k === i) ch.setAttribute('aria-current', 'true'); else ch.removeAttribute('aria-current');
        });
      }

      var tween = gsap.to(carril, {
        x: function () { return -medir(); },
        ease: 'none',
        scrollTrigger: {
          trigger: escena,
          pin: true,
          // Lenis ya suaviza el scroll (lerp 0,09); un scrub con retardo encima era un doble suavizado y los paneles
          // iban medio segundo por detrás de la rueda. Sin Lenis (fallo de carga) queda un scrub corto.
          scrub: PV.lenis ? true : 0.4,
          start: 'top top',
          end: function () { return '+=' + medir(); },
          invalidateOnRefresh: true,
          anticipatePin: 1,
          // al soltar, el panel más cercano se alinea entero en la ventana: ninguno queda cortado a medias
          snap: { snapTo: function (v) { return masCercano(v); }, duration: { min: 0.25, max: 0.7 }, delay: 0.12, ease: 'power2.inOut', inertia: false },
          onUpdate: function (self) {
            var p = self.progress;
            ponerRelleno(Math.max(p, 0.004));
            ponerLuz(p * anchoProgreso);
            mostrarGuia(p < 0.02);
            var x = p * dist;
            var k = Math.round((vw / 2 - pad0 - ancho / 2 + x) / (paso || 1));
            activar(PV.clamp(k, 0, n - 1));
          }
        }
      });
      activar(0);

      // html.servicios-fijo desde que la barra con los chips asoma por abajo hasta que, al soltarse la escena, la barra
      // pasa por encima de la esquina del botón flotante «subir» (abajo a la derecha, 28 + 56 px): servicios.css lo apaga
      function altoBarra() { return barra ? barra.offsetHeight : 0; }
      function fondoBarra() { return barra ? Math.max(0, escena.offsetHeight - barra.offsetTop - barra.offsetHeight) : 0; }
      ScrollTrigger.create({
        trigger: escena,
        start: function () { return 'top top+=' + (fondoBarra() + altoBarra()); },
        end: function () { return '+=' + (fondoBarra() + altoBarra() + medir() + Math.max(0, 104 - fondoBarra())); },
        invalidateOnRefresh: true,
        onToggle: function (self) { html.classList.toggle('servicios-fijo', self.isActive); }
      });

      // cada panel: la foto se desliza en contra (parallax) y el contenido entra escalonado
      paneles.forEach(function (p, i) {
        var num = PV.$('.servicios__num', p);
        var dato = PV.$('.servicios__dato', p);
        var media = PV.$('.servicios__media', p);
        var piezas = PV.$$('.servicios__nombre, .servicios__texto, .servicios__para', p);
        var disparo = i === 0
          ? { trigger: escena, start: 'top 70%', toggleActions: 'play none none none' }
          : { trigger: p, containerAnimation: tween, start: 'left 82%', toggleActions: 'play none none reverse' };
        var tl = gsap.timeline({ scrollTrigger: disparo });
        if (num) tl.from(num, { yPercent: 35, opacity: 0, duration: 1.1, ease: 'power4.out' }, 0);
        if (dato) tl.from(dato, { y: -14, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.2);
        tl.from(piezas, { y: 36, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'power3.out' }, 0.1);
        if (media) gsap.fromTo(media, { xPercent: -5 }, {
          xPercent: 5, ease: 'none',
          scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
        });
      });

      // chips: saltar al panel dentro de la escena fijada
      function alChip(e) {
        var a = e.target.closest ? e.target.closest('.servicios__chip') : null;
        if (!a) return;
        var st = tween.scrollTrigger;
        if (!st) return;
        e.preventDefault();
        e.stopPropagation();
        var i = PV.clamp(parseInt(a.getAttribute('data-indice'), 10) || 0, 0, n - 1);
        var x = Math.min(dist, Math.max(0, paneles[i].offsetLeft - pad0));
        var destino = st.start + (dist ? x / dist : 0) * (st.end - st.start);
        if (PV.lenis) PV.lenis.scrollTo(destino, { duration: 1.2 });
        else window.scrollTo({ top: destino, behavior: 'smooth' });
      }
      seccion.addEventListener('click', alChip);

      return function () {
        seccion.removeEventListener('click', alChip);
        seccion.classList.remove('is-horizontal');
        html.classList.remove('servicios-fijo');
        ScrollTrigger.removeEventListener('refresh', ajustarPaneles);
        paneles.forEach(function (p) { p.classList.remove('is-activa', 'tema-oscuro', 'is-num-chico', 'is-sin-num', 'is-sin-dato'); });
      };
    }

    // ---------- celular: pila de tarjetas con parallax vertical de la foto ----------
    function apilado() {
      paneles.forEach(function (p) {
        var media = PV.$('.servicios__media', p);
        if (!media) return;
        gsap.fromTo(media, { yPercent: -6 }, {
          yPercent: 6, ease: 'none',
          scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }

    var mm = gsap.matchMedia();
    mm.add({
      // el modo horizontal necesita alto: en pantallas bajas (portátiles de 1366 × 768 con las barras del navegador, ~630 px
      // de alto útil) los paneles quedaban de 300–370 px y el número grande se montaba sobre el título: ahí van las tarjetas
      horizontal: '(min-width: 761px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)',
      apilado: '(max-width: 760px)'
    }, function (ctx) {
      var c = ctx.conditions;
      if (PV.reduced) return;
      if (c.horizontal) return horizontal();
      if (c.apilado) apilado();
    });
  }
};
