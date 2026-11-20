/* ============================================================
   Proyectovisión · app.js — núcleo compartido.
   Expone window.PV con: reduced, touch, lenis, $, $$, irA, formatoCOP, copy, sections.
   Cada sección registra PV.sections.<nombre> = { init(PV) {...} } y el núcleo la inicia al cargar el DOM.
   Sin módulos ES: funciona abriendo index.html desde el disco y en celulares de gama media.
   ============================================================ */
window.PV = window.PV || {};
(function () {
  var PV = window.PV;
  PV.sections = PV.sections || {};
  PV.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  PV.touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  PV.lenis = null;
  PV.copy = null;
  PV.$ = function (s, r) { return (r || document).querySelector(s); };
  PV.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  PV.formatoCOP = function (n) { return '$' + Math.round(n).toLocaleString('es-CO'); };
  PV.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  PV.hayGsap = function () { return !!window.gsap; };
  PV.hayST = function () { return !!(window.gsap && window.ScrollTrigger); };

  document.documentElement.classList.add('js');
  if (PV.reduced) document.documentElement.classList.add('calmo');
  if (PV.touch) document.documentElement.classList.add('tactil');

  // textos embebidos (opcional): <script type="application/json" id="pv-copy">…</script>
  function leerCopy() {
    var el = document.getElementById('pv-copy');
    if (!el) return;
    try { PV.copy = JSON.parse(el.textContent); } catch (e) { console.warn('copy.json inválido', e); }
  }

  function registrarGsap() {
    if (!window.gsap) return;
    var plugins = [window.ScrollTrigger, window.SplitText, window.ScrollToPlugin].filter(Boolean);
    if (plugins.length) gsap.registerPlugin.apply(gsap, plugins);
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
    if (window.ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true });
  }

  // desplazamiento suave con Lenis, enganchado al ticker de GSAP
  function suave() {
    if (PV.reduced || !window.Lenis || !window.gsap) return;
    try {
      var lenis = new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
      if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      PV.lenis = lenis;
    } catch (e) { console.warn('Lenis no arrancó', e); }
  }

  // alto real de la barra fija (72 px arriba, 58 px compacta); si no hay barra, el token --barra
  PV.altoBarra = function () {
    var b = document.querySelector('.topbar__barra') || document.querySelector('.topbar');
    var h = b ? b.getBoundingClientRect().height : 0;
    return h || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barra')) || 72;
  };

  // sin offset explícito, el destino queda bajo la barra con el mismo margen que usa el navegador sin JS
  // (scroll-margin-top de base.css) o, si el elemento no lo tiene, el alto real de la barra más 16 px
  PV.irA = function (destino, offset) {
    var el = typeof destino === 'string' ? document.querySelector(destino) : destino;
    if (!el) return;
    var off;
    if (typeof offset === 'number') off = offset;
    else {
      var margen = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      off = -Math.max(margen, PV.altoBarra() + 16);
    }
    if (PV.lenis) PV.lenis.scrollTo(el, { offset: off, duration: 1.3 });
    else { var top = el.getBoundingClientRect().top + window.scrollY + off; window.scrollTo({ top: top, behavior: PV.reduced ? 'auto' : 'smooth' }); }
  };

  // menú del celular: un solo punto para abrirlo y cerrarlo (botón, Escape, enlaces, ventana de oficinas).
  // Abierto, todo lo que no es la cabecera queda inerte (el teclado y los lectores de pantalla no salen del menú);
  // se recorre desde la cabecera hacia arriba, así funciona aunque la cabecera quede dentro de <main>.
  var inertes = [];
  function fondoInerte(on) {
    if (!on) { inertes.forEach(function (el) { el.inert = false; }); inertes = []; return; }
    var cab = PV.$('.topbar');
    for (var el = cab; el && el.parentElement && el !== document.body; el = el.parentElement) {
      Array.prototype.forEach.call(el.parentElement.children, function (h) {
        if (h === el || h.inert || /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(h.tagName)) return;
        h.inert = true; inertes.push(h);
      });
    }
  }
  PV.menu = function (abrir, opciones) {
    var html = document.documentElement, boton = PV.$('.topbar__menu');
    var ya = html.classList.contains('menu-abierto');
    if (typeof abrir !== 'boolean') abrir = !ya;
    if (abrir === ya) return;
    html.classList.toggle('menu-abierto', abrir);
    if (boton) { boton.setAttribute('aria-expanded', String(abrir)); boton.setAttribute('aria-label', abrir ? 'Cerrar el menú' : 'Abrir el menú'); }
    fondoInerte(abrir);
    if (PV.lenis) { abrir ? PV.lenis.stop() : PV.lenis.start(); }
    if (!abrir && opciones && opciones.foco && boton) boton.focus({ preventScroll: true });
  };

  // enlaces a una sección de la misma página («#pagos» o «oficinas.html#pagos» estando en oficinas.html):
  // desplazamiento suave bajo la barra, cierra el menú y deja el foco en el destino (lo que espera quien usa teclado)
  function anclas() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a || (a.target && a.target !== '_self')) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin || url.pathname.replace(/\/index\.html$/, '/') !== location.pathname.replace(/\/index\.html$/, '/') || url.hash.length < 2) return;
      var id = url.hash;
      var el = null;
      try { el = document.querySelector(id); } catch (err) { return; }
      // «Saltar al contenido» (#contenido): si la página aún no tiene <main id="contenido">, a la primera sección
      if (!el && a.classList.contains('saltar')) el = document.querySelector('main') || document.getElementById('inicio');
      if (!el) return;
      e.preventDefault();
      PV.menu(false);
      PV.irA(el);
      if (!el.matches('a[href], button, input, select, textarea, summary, [tabindex]')) el.setAttribute('tabindex', '-1');
      try { el.focus({ preventScroll: true }); } catch (err) {}
      try { history.replaceState(null, '', id); } catch (err) {}
    });
  }

  // barra superior: se compacta al bajar y, en tableta y escritorio, se esconde al bajar rápido.
  // En celular vertical (≤ 760 px de ancho) no se esconde: así siempre hay una acción a la vista (WhatsApp y menú) mientras
  // se lee. Con el celular acostado (poca altura) sí se esconde, para no quitarle una sexta parte a la pantalla.
  function barra() {
    var barra = PV.$('.topbar');
    if (!barra) return;
    var ultimo = 0;
    var celular = window.matchMedia('(max-width: 760px) and (min-height: 480px)');
    function alBajar() {
      var y = window.scrollY || 0;
      barra.classList.toggle('is-compacta', y > 40);
      barra.classList.toggle('is-oculta', !celular.matches && y > 320 && y > ultimo && !document.documentElement.classList.contains('menu-abierto'));
      ultimo = y;
    }
    window.addEventListener('scroll', alBajar, { passive: true });
    alBajar();
    var boton = PV.$('.topbar__menu');
    if (boton) boton.addEventListener('click', function () { PV.menu(); });
    // enlace activo según la sección visible
    var enlaces = PV.$$('.topbar a[href^="#"]');
    var secciones = enlaces.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
    if (secciones.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          enlaces.forEach(function (a) { a.classList.toggle('is-activo', a.getAttribute('href') === '#' + en.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      secciones.forEach(function (s) { io.observe(s); });
    }
  }

  // revelados: [data-reveal] recibe .is-in al entrar; los hermanos dentro de un mismo padre se escalonan
  function revelados() {
    var piezas = PV.$$('[data-reveal]');
    if (!piezas.length) return;
    if (PV.reduced || !('IntersectionObserver' in window)) { piezas.forEach(function (el) { el.classList.add('is-in'); }); return; }
    piezas.forEach(function (el) {
      if (el.style.getPropertyValue('--retardo')) return;
      var padre = el.parentElement;
      var hermanos = PV.$$(':scope > [data-reveal]', padre);
      var i = hermanos.indexOf(el);
      if (i > 0) el.style.setProperty('--retardo', Math.min(i, 8) * 90 + 'ms');
    });
    // umbral 0: basta con que asome. Con 5 % del área, una tarjeta alta dentro de un carrusel que solo asoma por el
    // borde (celular en horizontal) no llegaba nunca al umbral y se quedaba invisible
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    piezas.forEach(function (el) { io.observe(el); });
    // lo que ya está en pantalla aparece sin esperar; si el rescate de base.css ya lo mostró (el JS llegó tarde),
    // se marca en este mismo cuadro para que al poner html.lista no vuelva a esconderse
    var enVista = function () {
      piezas.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.95 && r.bottom > 0) el.classList.add('is-in'); });
    };
    var rescatado = false;
    try { rescatado = parseFloat(getComputedStyle(piezas[0]).opacity) > 0; } catch (e) {}
    if (rescatado) enVista(); else requestAnimationFrame(enVista);
  }

  // cada .seccion lleva .is-en-pantalla mientras se ve: base.css pausa con eso sus bucles decorativos (puntos que laten, auroras)
  function enPantalla() {
    var secs = PV.$$('.seccion');
    if (!secs.length) return;
    if (!('IntersectionObserver' in window)) { secs.forEach(function (s) { s.classList.add('is-en-pantalla'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-en-pantalla', en.isIntersecting); });
    }, { rootMargin: '10% 0px', threshold: 0 });
    secs.forEach(function (s) { io.observe(s); });
  }

  // umbrales: la línea de luz entre dos secciones (.umbral, base.css) recibe .is-in al entrar y un pulso la recorre una vez
  function umbrales() {
    var els = PV.$$('.umbral');
    if (!els.length) return;
    if (PV.reduced || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.3 });
    els.forEach(function (el) { io.observe(el); });
  }

  // contadores: <span data-contador="500" data-prefijo="" data-sufijo=" megas" data-decimales="0">0</span>
  function contadores() {
    var els = PV.$$('[data-contador]');
    if (!els.length) return;
    function pintar(el, v) {
      var dec = +(el.getAttribute('data-decimales') || 0);
      var txt = (dec ? v.toFixed(dec) : Math.round(v).toString()).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      el.textContent = (el.getAttribute('data-prefijo') || '') + txt + (el.getAttribute('data-sufijo') || '');
    }
    function animar(el) {
      var fin = parseFloat(el.getAttribute('data-contador'));
      if (PV.reduced || !window.gsap) { pintar(el, fin); return; }
      var obj = { v: 0 };
      gsap.to(obj, { v: fin, duration: 1.8, ease: 'power3.out', onUpdate: function () { pintar(el, obj.v); } });
    }
    if (!('IntersectionObserver' in window)) { els.forEach(animar); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { animar(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (el) { pintar(el, 0); io.observe(el); });
  }

  // parallax suave: [data-parallax="0.18"] se mueve ese porcentaje del alto de la ventana al desplazar
  function parallax() {
    if (PV.reduced || !PV.hayST()) return;
    PV.$$('[data-parallax]').forEach(function (el) {
      var f = parseFloat(el.getAttribute('data-parallax')) || 0.15;
      gsap.fromTo(el, { yPercent: -f * 40 }, { yPercent: f * 40, ease: 'none', scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  // auroras (.fondo-aurora): sus manchas animadas se pausan mientras no están en pantalla (base.css: .is-quieta).
  // Complementa a enPantalla(): esa cubre las .seccion; esta también la del panel del menú (header.topbar), que no es sección.
  function auroras() {
    var els = PV.$$('.fondo-aurora');
    if (!els.length || PV.reduced || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-quieta', !en.isIntersecting); });
    }, { threshold: 0 });
    els.forEach(function (el) { io.observe(el); });
  }

  // halo del cursor
  function halo() {
    if (PV.touch || PV.reduced || !window.gsap) return;
    var h = document.createElement('div');
    h.className = 'halo';
    document.body.appendChild(h);
    var x = gsap.quickTo(h, 'x', { duration: 0.35, ease: 'power3' });
    var y = gsap.quickTo(h, 'y', { duration: 0.35, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { x(e.clientX); y(e.clientY); h.classList.add('is-visible'); }, { passive: true });
    document.addEventListener('pointerleave', function () { h.classList.remove('is-visible'); });
    document.addEventListener('pointerover', function (e) { var t = e.target.closest ? e.target.closest('a, button, [data-halo], input, label, summary') : null; h.classList.toggle('is-grande', !!t); });
  }

  // tarjetas con borde luminoso: --mx/--my en px relativos a la tarjeta
  function tarjetasLuz() {
    if (PV.touch) return;
    document.addEventListener('pointermove', function (e) {
      var t = e.target.closest ? e.target.closest('.tarjeta-luz') : null;
      if (!t) return;
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // titulares partidos en líneas/palabras para animarlos: <h1 data-split="lines">…</h1>
  PV.partir = function (el, tipo) {
    if (!window.SplitText || PV.reduced) return null;
    try { return new SplitText(el, { type: tipo || 'lines,words', linesClass: 'linea', wordsClass: 'palabra', mask: tipo && tipo.indexOf('lines') >= 0 ? 'lines' : undefined }); }
    catch (e) { try { return new SplitText(el, { type: tipo || 'lines,words', linesClass: 'linea', wordsClass: 'palabra' }); } catch (err) { return null; } }
  };

  // ---------- modo diurno / nocturno ----------
  // El script de la cabecera (.web2/plantilla.html) ya puso <html data-tema="claro|oscuro"> antes de pintar: la elección
  // guardada (localStorage «pv-tema») o, si la persona nunca eligió, el modo de su celular o computador.
  // Aquí: cambiar de modo (botón sol/luna, nav.js), recordar la elección, seguir al sistema mientras no haya elección
  // y avisar con el evento «pv:tema» a lo que se pinta con JS (motas del inicio, hilos de contacto, mapa de cobertura).
  // Si la persona elige lo mismo que su sistema, no se guarda nada: vuelve a seguir al sistema.
  PV.tema = (function () {
    var html = document.documentElement, CLAVE = 'pv-tema';
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    var leer = function () { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } };
    var sistema = function () { return mq && mq.matches ? 'claro' : 'oscuro'; };
    var actual = function () { return html.getAttribute('data-tema') === 'claro' ? 'claro' : 'oscuro'; };
    function aplicar(t) {
      if (t === actual() && html.hasAttribute('data-tema')) return;
      html.setAttribute('data-tema', t);
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'claro' ? '#f4f7fc' : '#050c1f');
      var ev; try { ev = new CustomEvent('pv:tema', { detail: t }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('pv:tema', false, false, t); }
      document.dispatchEvent(ev);
    }
    function poner(t) {
      try { if (t === sistema()) localStorage.removeItem(CLAVE); else localStorage.setItem(CLAVE, t); } catch (e) {}
      // cambio con un fundido corto donde el navegador lo sabe hacer (View Transitions); si no, de una vez
      if (document.startViewTransition && !PV.reduced) { try { document.startViewTransition(function () { aplicar(t); }); return; } catch (e) {} }
      aplicar(t);
    }
    var guardado = leer();
    if (guardado !== 'claro' && guardado !== 'oscuro') guardado = null;
    if (!html.hasAttribute('data-tema')) aplicar(guardado || sistema());   // por si el script de la cabecera no corrió
    if (mq) {
      var alCambiar = function () { var g = leer(); if (g !== 'claro' && g !== 'oscuro') aplicar(sistema()); };
      if (mq.addEventListener) mq.addEventListener('change', alCambiar); else if (mq.addListener) mq.addListener(alCambiar);
    }
    return { actual: actual, poner: poner, alternar: function () { poner(actual() === 'claro' ? 'oscuro' : 'claro'); } };
  })();
  // color de un token (rgb «r g b») para pintar en canvas: «r, g, b»
  PV.tokenRgb = function (nombre, porDefecto) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return v ? v.split(/[\s,]+/).slice(0, 3).join(', ') : porDefecto;
  };

  // utilidades de canvas compartidas
  PV.dpr = function (max) { return Math.min(window.devicePixelRatio || 1, max || 1.5); };
  // ejecuta cb(ts) solo mientras el elemento esté en pantalla y la pestaña visible
  PV.bucleVisible = function (el, cb) {
    var activo = false, raf = 0, ultimo = 0;
    function tick(ts) { if (!activo) return; cb(ts, ts - ultimo); ultimo = ts; raf = requestAnimationFrame(tick); }
    function arrancar() { if (activo || document.hidden) return; activo = true; ultimo = performance.now(); raf = requestAnimationFrame(tick); }
    function parar() { activo = false; cancelAnimationFrame(raf); }
    if ('IntersectionObserver' in window) { new IntersectionObserver(function (en) { en[0].isIntersecting ? arrancar() : parar(); }, { threshold: 0.01 }).observe(el); } else arrancar();
    document.addEventListener('visibilitychange', function () { document.hidden ? parar() : arrancar(); });
    return { arrancar: arrancar, parar: parar };
  };

  function iniciarSecciones() {
    Object.keys(PV.sections).forEach(function (n) {
      var s = PV.sections[n];
      try { if (s && typeof s.init === 'function') s.init(PV); }
      catch (e) { console.error('sección ' + n + ' falló al iniciar', e); }
    });
  }

  function arranque() {
    leerCopy();
    registrarGsap();
    suave();
    anclas();
    barra();
    enPantalla();
    iniciarSecciones();
    revelados();
    umbrales();
    contadores();
    parallax();
    auroras();
    halo();
    tarjetasLuz();
    var refrescar = function () { if (window.ScrollTrigger) ScrollTrigger.refresh(); };
    window.addEventListener('load', refrescar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refrescar);
    document.documentElement.classList.add('lista');
  }

  // con <script defer> este archivo corre en estado 'interactive', antes que los scripts de sección que vienen detrás:
  // también entonces hay que esperar a DOMContentLoaded (que se dispara cuando todos los diferidos han corrido)
  var diferido = !!(document.currentScript && document.currentScript.hasAttribute && document.currentScript.hasAttribute('defer'));
  if (document.readyState === 'loading' || (document.readyState === 'interactive' && diferido)) document.addEventListener('DOMContentLoaded', arranque);
  else arranque();
})();
