/* ============================================================
   Proyectovisión · nav.js — barra superior.
   app.js ya pone .is-compacta / .is-oculta, el botón .topbar__menu → html.menu-abierto y el enlace activo.
   Aquí: entrada de la barra al cargar, cápsula de luz que sigue al puntero, progreso de lectura
   en el borde inferior y la coreografía del panel móvil (enlaces escalonados, hilo que se dibuja).
   Sin GSAP todo sigue funcionando (CSS hace las transiciones básicas).
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.nav = {
  init: function (PV) {
    var html = document.documentElement;
    var barra = PV.$('.topbar');
    if (!barra) return;
    var fila = PV.$('.topbar__barra', barra);
    var nav = PV.$('.topbar__nav', barra);
    var enlaces = PV.$$('.topbar__enlace', barra);
    var cursor = PV.$('.topbar__cursor', barra);
    var progreso = PV.$('.topbar__progreso', barra);
    var boton = PV.$('.topbar__menu', barra);
    var panel = PV.$('.topbar__panel', barra);
    var animar = PV.hayGsap() && !PV.reduced;
    if (animar) barra.classList.add('topbar--gsap');

    // enlace activo según el hash con el que se abrió la página (app.js lo actualiza luego al desplazar)
    function marcarHash() {
      var h = location.hash;
      if (!h || h.length < 2) return;
      PV.$$('a[href^="#"]', barra).forEach(function (a) { a.classList.toggle('is-activo', a.getAttribute('href') === h); });
    }
    marcarHash();
    window.addEventListener('hashchange', marcarHash);

    // ---------- 1. la barra baja desde arriba y sus piezas entran escalonadas ----------
    function entrada() {
      if (!animar || !fila) { barra.classList.add('is-lista'); return; }
      var piezas = [PV.$('.topbar__marca', barra)].concat(enlaces, [PV.$('.topbar__cta', barra), boton]).filter(Boolean);
      // sin transiciones CSS mientras GSAP mueve las piezas (clearProps las devuelve al terminar)
      piezas.forEach(function (el) { el.style.transition = 'none'; });
      var tl = gsap.timeline({ onComplete: function () { barra.classList.add('is-lista'); } });
      tl.from(fila, { yPercent: -100, duration: 0.9, ease: 'power3.out', clearProps: 'transform' }, 0)
        .from(piezas, { y: -14, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', clearProps: 'all' }, 0.25);
    }

    // ---------- 2. cápsula de luz que se desliza bajo el enlace señalado (solo puntero fino) ----------
    function cursorLuz() {
      if (!nav || !cursor || PV.touch || !enlaces.length) return;
      var mover, ancho, ver, primero = true;
      if (animar) {
        mover = gsap.quickTo(cursor, 'x', { duration: 0.4, ease: 'power3.out' });
        ancho = gsap.quickTo(cursor, 'width', { duration: 0.4, ease: 'power3.out' });
        ver = gsap.quickTo(cursor, 'opacity', { duration: 0.3, ease: 'power2.out' });
      } else {
        mover = function (v) { cursor.style.transform = 'translateX(' + v + 'px)'; };
        ancho = function (v) { cursor.style.width = v + 'px'; };
        ver = function (v) { cursor.style.opacity = v; };
      }
      function ir(a) {
        var rn = nav.getBoundingClientRect(), ra = a.getBoundingClientRect();
        var x = ra.left - rn.left, w = ra.width;
        if (primero) {
          // la primera vez aparece ya en su sitio, sin viajar desde lejos
          if (animar) gsap.set(cursor, { x: x, width: w });
          else { cursor.style.transition = 'none'; mover(x); ancho(w); void cursor.offsetWidth; cursor.style.transition = ''; }
          primero = false;
        }
        mover(x); ancho(w); ver(1);
      }
      function fuera() { ver(0); primero = true; }
      enlaces.forEach(function (a) {
        a.addEventListener('pointerenter', function () { ir(a); });
        a.addEventListener('focus', function () { ir(a); });
      });
      nav.addEventListener('pointerleave', fuera);
      nav.addEventListener('focusout', function (e) { if (!nav.contains(e.relatedTarget)) fuera(); });
    }

    // ---------- 3. progreso de lectura: la línea del borde inferior se llena al bajar ----------
    function progresoLectura() {
      if (!progreso) return;
      var desplazable = html.scrollHeight > window.innerHeight + 10;
      if (desplazable && PV.hayST() && !PV.reduced) {
        try {
          gsap.to(progreso, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4, invalidateOnRefresh: true } });
          return;
        } catch (e) { /* cae al modo manual */ }
      }
      function pintar() {
        var max = html.scrollHeight - window.innerHeight;
        progreso.style.transform = 'scaleX(' + (max > 0 ? PV.clamp(window.scrollY / max, 0, 1) : 0) + ')';
      }
      window.addEventListener('scroll', pintar, { passive: true });
      window.addEventListener('resize', pintar);
      pintar();
    }

    // ---------- 4. panel móvil: escucha html.menu-abierto (lo alterna app.js) y coreografía la entrada ----------
    function menu() {
      if (!boton || !panel) return;
      var items = PV.$$('.topbar__panel-enlace', panel);
      var pie = PV.$$('.topbar__panel-pie > *', panel);
      var eyebrow = PV.$('.topbar__panel-eyebrow', panel);
      var hilo = PV.$('.topbar__hilo-base', panel);
      var tl = null;
      var abierto = html.classList.contains('menu-abierto');

      function construir() {
        tl = gsap.timeline({ paused: true, onReverseComplete: function () { panel.classList.remove('is-visible'); } });
        tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0);
        if (hilo) tl.fromTo(hilo, { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power3.inOut' }, 0.1);
        if (eyebrow) tl.fromTo(eyebrow, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.15);
        if (items.length) tl.fromTo(items, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.07, ease: 'power4.out' }, 0.2);
        if (pie.length) tl.fromTo(pie, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0.5);
        return tl;
      }
      function abrir() {
        panel.classList.add('is-visible');
        panel.scrollTop = 0;
        boton.setAttribute('aria-label', 'Cerrar el menú');
        if (animar) (tl || construir()).timeScale(1).play();
        if (!PV.touch) setTimeout(function () { if (items[0] && html.classList.contains('menu-abierto')) items[0].focus({ preventScroll: true }); }, 400);
      }
      function cerrar() {
        boton.setAttribute('aria-label', 'Abrir el menú');
        if (animar && tl) tl.timeScale(1.8).reverse();
        else panel.classList.remove('is-visible');
        if (panel.contains(document.activeElement)) boton.focus({ preventScroll: true });
      }
      if ('MutationObserver' in window) {
        new MutationObserver(function () {
          var ahora = html.classList.contains('menu-abierto');
          if (ahora === abierto) return;
          abierto = ahora;
          ahora ? abrir() : cerrar();
        }).observe(html, { attributes: true, attributeFilter: ['class'] });
      }
      if (abierto) abrir();
      // con el menú abierto el resto de la página está inerte (app.js) y el Tab da la vuelta dentro de la cabecera
      // (logo, botón de WhatsApp si se ve, botón del menú y los enlaces del panel); Escape cierra y devuelve el foco al botón
      var enfocable = function (el) { return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      document.addEventListener('keydown', function (e) {
        if (!html.classList.contains('menu-abierto')) return;
        if (e.key === 'Escape') { e.preventDefault(); PV.menu(false, { foco: true }); return; }
        if (e.key !== 'Tab') return;
        var focos = PV.$$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', barra).filter(enfocable);
        if (!focos.length) return;
        var primero = focos[0], ultimo = focos[focos.length - 1], act = document.activeElement;
        var fuera = !barra.contains(act);
        if (e.shiftKey && (act === primero || fuera)) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && (act === ultimo || fuera)) { e.preventDefault(); primero.focus(); }
      });
      // un enlace del panel a otra parte de esta misma página (p. ej. «Nosotros» estando en el inicio) cierra el menú
      panel.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a[href]')) PV.menu(false); });
      // al volver con «atrás» (caché del navegador) la página no debe aparecer con el menú abierto y el fondo inerte
      window.addEventListener('pageshow', function (e) { if (e.persisted) PV.menu(false); });
      var mq = window.matchMedia('(min-width: 74.01em)'); // igual que el corte de nav.css (74em ≈ 1184 px): arriba de eso la barra muestra los enlaces
      var cambio = function () { if (mq.matches) PV.menu(false); };
      if (mq.addEventListener) mq.addEventListener('change', cambio); else if (mq.addListener) mq.addListener(cambio);
    }

    // ---------- 4b. la fila de la barra nunca se sale de la pantalla ----------
    // Con la letra del celular al 130–160 % o con zoom, «Proyectovisión» + WhatsApp + menú no caben: se esconde el nombre
    // (queda el logo, y el enlace sigue diciendo «Proyectovisión, ir al inicio»). Se mide de nuevo al cambiar el tamaño.
    function filaQueCabe() {
      var fila = PV.$('.topbar__fila', barra);
      if (!fila) return;
      var medir = function () {
        barra.classList.remove('topbar--sin-nombre');
        if (fila.scrollWidth > fila.clientWidth + 1) barra.classList.add('topbar--sin-nombre');
      };
      medir();
      if ('ResizeObserver' in window) new ResizeObserver(function () { requestAnimationFrame(medir); }).observe(fila);
      else window.addEventListener('resize', medir);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    }

    // ---------- 4c. franja «Información importante para usuarios · PQR» (celular y tableta) ----------
    // Su alto real (cambia con la letra y con el ancho) va a --franja-h: la primera sección de la página le deja ese sitio (base.css)
    function franja() {
      var f = PV.$('.topbar__franja', barra);
      if (!f) return;
      var poner = function () { html.style.setProperty('--franja-h', (f.offsetHeight || 0) + 'px'); };
      poner();
      if ('ResizeObserver' in window) new ResizeObserver(poner).observe(f);
      else window.addEventListener('resize', poner);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(poner);
    }

    // ---------- 5. una sola acción naranja por pantalla ----------
    // El botón de la barra va en fantasma mientras el botón naranja de la portada está a la vista (en celular, escondido);
    // cuando ese botón sale por arriba, .topbar.is-sola lo enciende. Sin portada (vista previa sola) se enciende desde el inicio.
    // Se vigilan todos los botones naranja del contenido (no los de la barra ni los de ventanas): la barra solo se
    // enciende cuando no hay ninguno a la vista, para que nunca haya dos naranjas a la vez (DESIGN.md §5).
    function ctaSola() {
      var cta = PV.$('.topbar__cta', barra);
      if (!cta) return;
      var naranjas = Array.prototype.filter.call(document.querySelectorAll('.boton--fuego'), function (b) {
        return !(b.closest && (b.closest('.topbar') || b.closest('dialog')));
      });
      if (!naranjas.length || !('IntersectionObserver' in window) || typeof Set !== 'function') { barra.classList.add('is-sola'); return; }
      var visibles = new Set();
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) visibles.add(e.target); else visibles.delete(e.target); });
        barra.classList.toggle('is-sola', visibles.size === 0);
      }, { rootMargin: '-' + Math.round(PV.altoBarra ? PV.altoBarra() : 72) + 'px 0px 0px 0px', threshold: 0 });
      naranjas.forEach(function (b) { io.observe(b); });
    }


    // ---------- 6. "¿En qué municipio se encuentra?": los botones de WhatsApp generales abren la ventana para elegir la oficina ----------
    // Enlaces con data-elegir-oficina="texto del mensaje". Sin <dialog> (navegador muy viejo) o sin JS, el enlace lleva a oficinas.html.
    // Soporte técnico: si el botón lo pide (data-tipo="soporte") o el mensaje es de soporte o de una falla, la oficina que tiene
    // número de soporte propio (hoy Florencia: datos.json → sedes[].soporte, escrito por generar.mjs en data-wa-soporte)
    // recibe el mensaje en ese número y no en la línea de atención. data-tipo con otro valor (p. ej. "ventas") lo evita.
    var SOPORTE = /soporte t[eé]cnico|luz roja|sin internet|no tengo internet|no navega|no aparece la red|wifi|internet lento|falla|da[ñn]o/i;
    function elegirOficina() {
      var dlg = document.getElementById('elegir-oficina');
      if (!dlg || typeof dlg.showModal !== 'function') return;
      var ops = PV.$$('.elegir__op', dlg);
      var eyebrow = PV.$('.eyebrow', dlg), eyebrowTexto = eyebrow ? eyebrow.textContent : '';
      var disparador = null;
      function abrirDlg(texto, tipo) {
        var msg = (texto || 'Buen día, quiero información').replace(/[.\s]+$/, '');
        var soporte = tipo ? tipo === 'soporte' : SOPORTE.test(msg);
        ops.forEach(function (a) {
          var conSoporte = soporte && a.hasAttribute('data-wa-soporte');
          var numero = a.getAttribute(conSoporte ? 'data-wa-soporte' : 'data-wa');
          a.href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(msg + ' en ' + a.getAttribute('data-municipio') + '.');
          var num = PV.$('.elegir__num', a), visible = a.getAttribute(conSoporte ? 'data-num-soporte' : 'data-num');
          if (num && visible) num.textContent = visible;
        });
        if (eyebrow) eyebrow.textContent = soporte ? 'Soporte técnico por WhatsApp' : eyebrowTexto;
        if (html.classList.contains('menu-abierto')) PV.menu(false);
        if (PV.lenis) PV.lenis.stop();
        dlg.showModal();
      }
      // en captura: va antes que el salto suave de app.js
      document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('[data-elegir-oficina]') : null;
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        disparador = a;
        abrirDlg(a.getAttribute('data-elegir-oficina'), a.getAttribute('data-tipo'));
      }, true);
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg || (e.target.closest && e.target.closest('[data-cerrar]'))) { dlg.close(); return; }
        if (e.target.closest && e.target.closest('.elegir__op')) setTimeout(function () { if (dlg.open) dlg.close(); }, 200);
      });
      // al cerrar, el foco vuelve al botón que la abrió; si ese botón ya no se ve (estaba en el menú, que se cerró), al botón del menú
      dlg.addEventListener('close', function () {
        if (PV.lenis) PV.lenis.start();
        var d = disparador; disparador = null;
        setTimeout(function () {
          var act = document.activeElement;
          if (act && act !== document.body && act !== document.documentElement) return;
          var destino = d && d.getClientRects().length ? d : (boton && boton.getClientRects().length ? boton : null);
          if (destino) destino.focus({ preventScroll: true });
        }, 0);
      });
    }

    entrada();
    cursorLuz();
    progresoLectura();
    menu();
    filaQueCabe();
    franja();
    ctaSola();
    elegirOficina();
  }
};
