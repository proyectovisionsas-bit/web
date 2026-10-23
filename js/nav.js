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
      // Escape cierra; y si la ventana crece a escritorio con el menú abierto, también
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && html.classList.contains('menu-abierto')) boton.click(); });
      var mq = window.matchMedia('(min-width: 74.01em)'); // igual que el corte de nav.css (74em ≈ 1184 px): arriba de eso la barra muestra los enlaces
      var cambio = function () { if (mq.matches && html.classList.contains('menu-abierto')) boton.click(); };
      if (mq.addEventListener) mq.addEventListener('change', cambio); else if (mq.addListener) mq.addListener(cambio);
    }

    // ---------- 5. una sola acción naranja por pantalla ----------
    // El botón de la barra va en fantasma mientras el botón naranja de la portada está a la vista (en celular, escondido);
    // cuando ese botón sale por arriba, .topbar.is-sola lo enciende. Sin portada (vista previa sola) se enciende desde el inicio.
    function ctaSola() {
      var cta = PV.$('.topbar__cta', barra);
      if (!cta) return;
      var portada = PV.$('#inicio .boton--fuego');
      if (!portada || !('IntersectionObserver' in window)) { barra.classList.add('is-sola'); return; }
      var io = new IntersectionObserver(function (en) {
        barra.classList.toggle('is-sola', !en[0].isIntersecting);
      }, { rootMargin: '-' + Math.round(PV.altoBarra ? PV.altoBarra() : 72) + 'px 0px 0px 0px', threshold: 0 });
      io.observe(portada);
    }


    // ---------- 6. "¿En qué municipio se encuentra?": los botones de WhatsApp generales abren la ventana para elegir la oficina ----------
    // Enlaces con data-elegir-oficina="texto del mensaje". Sin <dialog> (navegador muy viejo) o sin JS, el enlace lleva a oficinas.html.
    function elegirOficina() {
      var dlg = document.getElementById('elegir-oficina');
      if (!dlg || typeof dlg.showModal !== 'function') return;
      var ops = PV.$$('.elegir__op', dlg);
      function abrirDlg(texto) {
        var msg = (texto || 'Buen día, quiero información').replace(/[.\s]+$/, '');
        ops.forEach(function (a) {
          a.href = 'https://wa.me/' + a.getAttribute('data-wa') + '?text=' + encodeURIComponent(msg + ' en ' + a.getAttribute('data-municipio') + '.');
        });
        if (html.classList.contains('menu-abierto') && boton) boton.click();
        if (PV.lenis) PV.lenis.stop();
        dlg.showModal();
      }
      // en captura: va antes que el salto suave de app.js
      document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('[data-elegir-oficina]') : null;
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        abrirDlg(a.getAttribute('data-elegir-oficina'));
      }, true);
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg || (e.target.closest && e.target.closest('[data-cerrar]'))) { dlg.close(); return; }
        if (e.target.closest && e.target.closest('.elegir__op')) setTimeout(function () { if (dlg.open) dlg.close(); }, 200);
      });
      dlg.addEventListener('close', function () { if (PV.lenis) PV.lenis.start(); });
    }

    entrada();
    cursorLuz();
    progresoLectura();
    menu();
    ctaSola();
    elegirOficina();
  }
};
