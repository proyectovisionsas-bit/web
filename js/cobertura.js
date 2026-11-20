/* ============================================================
   Proyectovisión · cobertura.js — el mapa del Caquetá que se enciende.
   1. Con el scroll (scrub): el contorno se dibuja (stroke-dashoffset) y la vista hace zoom del
      departamento entero al detalle de las sedes. El zoom es solo un transform (translate + scale)
      sobre .cobertura__zoom; los dos SVG tienen el viewBox fijo en la vista final. Para que el zoom
      no vuelva a rasterizar el mapa (cientos de trazados) cuadro a cuadro, el mapa base se pinta una
      sola vez en cuatro <canvas> (fondo, interior y contorno a la escala inicial; mapa completo a la
      escala final) y durante el zoom se componen esos bitmaps; el SVG vivo solo pinta el contorno
      mientras se dibuja y vuelve, nítido, al terminar el zoom.
   2. Una sola vez, cuando el mapa está casi entero en pantalla: las sedes aparecen, la troncal se
      dibuja y salen etiquetas, enlaces y leyenda (línea de tiempo propia, no atada al scroll).
   3. Un pulso de luz recorre la troncal en bucle (getPointAtLength en un rAF que solo corre con el
      mapa en pantalla); las ondas de las sedes son divs HTML (transform compuesto) y se pausan fuera.
   Las etiquetas y la cabeza de luz son HTML y se colocan con la transformación actual del zoom.
   Si los bitmaps no se pueden construir, el SVG vivo hace todo (trazos por escalones).
   Sin GSAP o con movimiento reducido: todo se ve, quieto, en la vista de detalle.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.cobertura = {
  init: function (PV) {
    var sec = document.getElementById('cobertura');
    if (!sec) return;
    var $ = function (s, r) { return (r || sec).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };

    var escena = $('.cobertura__escena'), mapa = $('.cobertura__mapa'), marco = $('.cobertura__marco'), lienzo = $('.cobertura__lienzo'), zoom = $('.cobertura__zoom');
    var base = $('.cobertura__svg--base'), red = $('.cobertura__svg--red');
    if (!escena || !mapa || !marco || !lienzo || !zoom || !base || !red) return;
    var depto = $('#cob-depto'), contorno = $('.cobertura__contorno'), relleno = $('.cobertura__relleno'), cuadricula = $('.cobertura__cuadricula');
    var vecinos = $('.cobertura__vecinos'), rios = $('.cobertura__rios'), munisG = $('.cobertura__munis');
    var troncalPath = $('#cob-troncal'), troncal = $('.cobertura__troncal'), troncalLuz = $('.cobertura__troncal-luz'), cola = $('.cobertura__cola');
    var pulso = $('.cobertura__pulso'), cabeza = $('.cobertura__cabeza');
    var enlaces = $$('.cobertura__enlace'), sedes = $$('.cobertura__sede'), sedesIn = $$('.cobertura__sede-in'), ondas = $$('.cobertura__onda-sede');
    var etiquetas = $$('.cobertura__etq'), tarjetas = $$('[data-sede-enlace]'), leyenda = $('.cobertura__leyenda'), chipsM = $$('.cobertura__chip');
    var capas = { fondo: $('.cobertura__capa--fondo'), interior: $('.cobertura__capa--interior'), lineas: $('.cobertura__capa--lineas'), todo: $('.cobertura__capa--todo') };
    var lejos = $$('.cobertura__capa--lejos');

    // caja del departamento en unidades del SVG (viewBox original 0 0 1000 1000)
    var BBOX = { x0: 60, y0: 165.6, x1: 940, y1: 834.4 };
    var mqMovil = window.matchMedia('(max-width: 900px)');
    var ancho = 1, alto = 1, tam = [];
    var Vf = { x: 60, y: 305, w: 350, h: 262 };   // vista final (detalle de las sedes), fija en el viewBox
    var Vi = { x: 0, y: 0, w: 950, h: 722 };      // vista inicial (departamento entero)
    var esc = 1, kFin = 1;                         // px por unidad SVG en la vista final, y su inverso
    var z = { p: 0 };                              // progreso del zoom: 0 departamento entero, 1 detalle
    var rev = { fondo: 0, interior: 0 };           // revelado del fondo (vecinos, ríos) y del interior (relleno, municipios)
    var estado = { s: 1, tx: 0, ty: 0 };           // transform actual del envolvente
    var nivelTrazo = -1, NIVELES = 7;
    var L = 0, LT = 0;
    try { L = depto.getTotalLength(); LT = troncalPath.getTotalLength(); } catch (e) { L = 0; LT = 0; }
    var tl = null, encendido = false, troncalLista = false;
    var animado = false, claveCapas = '', construyendo = false, generacion = 0;
    var modo = 'pendiente';                        // 'pendiente' (bitmaps en construcción) → 'bitmaps' | 'vivo' (sin bitmaps: el SVG hace todo)
    var agujero = '', conAgujero = false;          // clip-path de los bitmaps lejanos con el hueco de la vista final

    // medidas de diseño (offsetWidth no cambia con el reveal en transform)
    function medir() {
      ancho = lienzo.offsetWidth || 1; alto = lienzo.offsetHeight || 1;
      tam = etiquetas.map(function (e) { return { w: e.offsetWidth, h: e.offsetHeight }; });
    }
    // encaja un rectángulo (centro + tamaño) a la proporción real del lienzo
    function encajar(cx, cy, w, h) {
      var a = ancho / alto;
      if (w / h < a) w = h * a; else h = w / a;
      return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    }
    function vistaInicio() { return encajar((BBOX.x0 + BBOX.x1) / 2, (BBOX.y0 + BBOX.y1) / 2, (BBOX.x1 - BBOX.x0) * 1.08, (BBOX.y1 - BBOX.y0) * 1.08); }
    // la vista de detalle incluye Solano (sur) y San Vicente del Caguán (norte), los municipios punteados de los extremos
    function vistaFin() { return mqMovil.matches ? encajar(250, 442, 344, 284) : encajar(247, 442, 350, 280); }
    function s0() { return Vf.w / Vi.w; }
    function grosor(el, px, k) { if (el) el.style.strokeWidth = (px * k).toFixed(3); }
    // trazos del SVG vivo en px constantes para la escala s del zoom; solo por escalones (cada cambio repinta el SVG)
    function trazos(s, forzar) {
      var si = s0(), u = si >= 1 ? 1 : Math.log(Math.max(s, si) / si) / Math.log(1 / si);
      var nivel = Math.round(Math.max(0, Math.min(1, u)) * NIVELES);
      if (!forzar && nivel === nivelTrazo) return;
      nivelTrazo = nivel;
      var k = kFin / (si * Math.pow(1 / si, nivel / NIVELES));
      grosor(contorno, 1.8, k); grosor(munisG, 0.9, k); grosor(rios, 1, k); grosor(vecinos, 0.8, k);
    }
    // punto SVG → px dentro del lienzo con el zoom actual
    function aPx(x, y) { return { x: estado.s * (x - Vf.x) * esc + estado.tx, y: estado.s * (y - Vf.y) * esc + estado.ty }; }
    // en la vista final ninguna etiqueta queda cortada por el borde del marco: si no cabe, se corre hacia adentro
    // (con letra de 15 px, a 1280 px «San José del Fragua» y «Belén de los Andaquíes» se salían por la izquierda)
    var BORDE = 6;
    function colocarEtiquetas() {
      var movil = mqMovil.matches;
      for (var i = 0; i < etiquetas.length; i++) {
        var e = etiquetas[i], t = tam[i] || { w: 0, h: 0 };
        var pos = ((movil && e.getAttribute('data-pos-movil')) || e.getAttribute('data-pos') || '0,0,0,0').split(',');
        var p = aPx(parseFloat(e.getAttribute('data-x')), parseFloat(e.getAttribute('data-y')));
        var px = p.x + parseFloat(pos[0]) + t.w * parseFloat(pos[2]) / 100;
        var py = p.y + parseFloat(pos[1]) + t.h * parseFloat(pos[3]) / 100;
        if (t.w && t.w < ancho - 2 * BORDE) { px = Math.min(Math.max(px, BORDE), ancho - BORDE - t.w); py = Math.min(Math.max(py, BORDE), alto - BORDE - t.h); }
        e.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
      }
    }
    function capa(el, op, visible) { if (!el) return; el.style.opacity = op.toFixed(3); el.style.visibility = visible ? 'visible' : 'hidden'; }
    // qué pinta cada cosa según la fase: dibujo del contorno (bitmaps a escala inicial + contorno vivo),
    // zoom (solo bitmaps; el SVG vivo oculto) y final (SVG vivo, nítido; bitmaps ocultos)
    function aplicarCapas() {
      var p = z.p, fin = p >= 0.999, enZoom = p > 0.002 && !fin;
      if (modo !== 'vivo') {
        // último tramo del zoom (p ≥ 0,97: la banda fuera de la vista final mide menos del 5 % del lienzo): entra el bitmap
        // nítido de la vista final y a los lejanos se les abre un hueco con su forma; el relleno es translúcido y, si se
        // superpusieran o se fundieran por opacidad, se vería un rectángulo más saturado o más oscuro
        var tarde = p >= 0.97 && !fin;
        capa(capas.fondo, rev.fondo, !fin);
        capa(capas.interior, rev.interior, !fin);
        capa(capas.lineas, 1, enZoom);
        capa(capas.todo, 1, tarde);
        if (tarde !== conAgujero) {
          conAgujero = tarde;
          for (var i = 0; i < lejos.length; i++) { lejos[i].style.clipPath = tarde ? agujero : ''; lejos[i].style.webkitClipPath = tarde ? agujero : ''; }
        }
        base.classList.toggle('is-oculto', enZoom);
        base.classList.toggle('is-dibujo', !fin);
        trazos(fin ? 1 : s0(), false);
      } else {
        base.classList.remove('is-oculto'); base.classList.remove('is-dibujo');
        var f = rev.fondo.toFixed(3), r = rev.interior.toFixed(3);
        if (cuadricula) cuadricula.style.opacity = (0.12 * rev.fondo).toFixed(3);
        vecinos.style.opacity = f; rios.style.opacity = f; relleno.style.opacity = r; munisG.style.opacity = r;
        trazos(estado.s, false);
      }
    }
    // el zoom: solo transform sobre el envolvente (capa compuesta); al llegar al detalle se quita para que el mapa quede nítido
    function alZoom(forzar) {
      var p = z.p, w = Vi.w + (Vf.w - Vi.w) * p, s = Vf.w / w;
      var cx = (Vi.x + Vi.w / 2) + ((Vf.x + Vf.w / 2) - (Vi.x + Vi.w / 2)) * p;
      var cy = (Vi.y + Vi.h / 2) + ((Vf.y + Vf.h / 2) - (Vi.y + Vi.h / 2)) * p;
      if (p >= 0.999) {
        estado.s = 1; estado.tx = 0; estado.ty = 0;
        zoom.style.transform = ''; zoom.style.willChange = '';
      } else {
        estado.s = s; estado.tx = ancho / 2 - s * (cx - Vf.x) * esc; estado.ty = alto / 2 - s * (cy - Vf.y) * esc;
        zoom.style.willChange = 'transform';
        zoom.style.transform = 'translate3d(' + estado.tx.toFixed(2) + 'px,' + estado.ty.toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
      }
      if (forzar) nivelTrazo = -1;
      if (animado) aplicarCapas();
      colocarEtiquetas();
    }
    // el modo (diurno / nocturno) va en la clave: los colores del mapa están pintados en los bitmaps
    function claveActual() { return Math.round(ancho) + 'x' + Math.round(alto) + '@' + PV.dpr(1.5) + '|' + base.getAttribute('viewBox') + '|' + document.documentElement.getAttribute('data-tema'); }
    // vista final en los dos SVG (una vez por refresh), trazos y marcadores en px, ondas en su sitio
    function aplicarVista() {
      Vf = vistaFin(); Vi = vistaInicio();
      esc = ancho / Vf.w; kFin = 1 / esc;
      var vb = Vf.x.toFixed(2) + ' ' + Vf.y.toFixed(2) + ' ' + Vf.w.toFixed(2) + ' ' + Vf.h.toFixed(2);
      base.setAttribute('viewBox', vb); red.setAttribute('viewBox', vb);
      grosor(contorno, 1.8, kFin); grosor(munisG, 0.9, kFin); grosor(rios, 1, kFin); grosor(vecinos, 0.8, kFin);
      grosor(troncal, 2.6, kFin); grosor(troncalLuz, 10, kFin); grosor(cola, 3.2, kFin);
      for (var i = 0; i < enlaces.length; i++) { grosor(enlaces[i], 1.5, kFin); enlaces[i].style.strokeDasharray = (5 * kFin).toFixed(2) + ' ' + (6 * kFin).toFixed(2); }
      var ks = kFin.toFixed(4);
      for (i = 0; i < sedes.length; i++) sedes[i].setAttribute('transform', 'translate(' + sedes[i].getAttribute('data-x') + ' ' + sedes[i].getAttribute('data-y') + ') scale(' + ks + ')');
      for (i = 0; i < ondas.length; i++) {
        ondas[i].style.left = ((parseFloat(ondas[i].getAttribute('data-x')) - Vf.x) * esc).toFixed(1) + 'px';
        ondas[i].style.top = ((parseFloat(ondas[i].getAttribute('data-y')) - Vf.y) * esc).toFixed(1) + 'px';
      }
      // los bitmaps «lejos» cubren la vista inicial entera, en coordenadas de la vista final (el envolvente los escala)
      var W = (Vi.w * esc).toFixed(1), H = (Vi.h * esc).toFixed(1), Lx = (Vf.x - Vi.x) * esc, Ty = (Vf.y - Vi.y) * esc;
      for (i = 0; i < lejos.length; i++) {
        lejos[i].style.left = (-Lx).toFixed(1) + 'px'; lejos[i].style.top = (-Ty).toFixed(1) + 'px';
        lejos[i].style.width = W + 'px'; lejos[i].style.height = H + 'px';
      }
      agujero = 'polygon(evenodd, 0 0, ' + W + 'px 0, ' + W + 'px ' + H + 'px, 0 ' + H + 'px, 0 0, ' +
        Lx.toFixed(1) + 'px ' + Ty.toFixed(1) + 'px, ' + (Lx + ancho).toFixed(1) + 'px ' + Ty.toFixed(1) + 'px, ' +
        (Lx + ancho).toFixed(1) + 'px ' + (Ty + alto).toFixed(1) + 'px, ' + Lx.toFixed(1) + 'px ' + (Ty + alto).toFixed(1) + 'px, ' + Lx.toFixed(1) + 'px ' + Ty.toFixed(1) + 'px)';
      if (conAgujero) for (i = 0; i < lejos.length; i++) { lejos[i].style.clipPath = agujero; lejos[i].style.webkitClipPath = agujero; }
      alZoom(true);
      // si cambió el tamaño, los bitmaps se vuelven a pintar (mientras tanto se estiran, que es casi lo mismo)
      if (animado && modo === 'bitmaps' && !construyendo && claveActual() !== claveCapas) construirCapas(claveActual(), function (ok) { modo = ok ? 'bitmaps' : 'vivo'; aplicarCapas(); });
    }
    function moverCabeza(v) {
      if (!L) return;
      var pt = depto.getPointAtLength(L * v), p = aPx(pt.x, pt.y);
      cabeza.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
    }
    for (var i = 0; i < etiquetas.length; i++) { etiquetas[i].style.left = '0'; etiquetas[i].style.top = '0'; }

    // --- bitmaps del mapa base: un clon del SVG con los estilos calculados como atributos, pintado en un canvas ---
    var GRUPOS = { '.cobertura__cuadricula': 0, '.cobertura__vecinos': 0.8, '.cobertura__rios': 1, '.cobertura__relleno': 0, '.cobertura__munis': 0.9, '.cobertura__contorno': 1.8 };
    function clonBase(sNivel, mostrar, vb) {
      var k = kFin / sNivel, c = base.cloneNode(true);
      c.setAttribute('viewBox', vb);
      var vivos = [base].concat($$('*', base)), clones = [c].concat(Array.prototype.slice.call(c.querySelectorAll('*')));
      var props = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stop-color', 'stop-opacity', 'color', 'opacity'];
      for (var i = 0; i < vivos.length; i++) {
        var v = vivos[i], cl = clones[i], inl = v.getAttribute('style');
        if (inl) v.removeAttribute('style');            // los valores de la hoja, no los que GSAP o el zoom hayan dejado
        var cs = getComputedStyle(v);
        for (var j = 0; j < props.length; j++) {
          var val = cs.getPropertyValue(props[j]);
          if (val) cl.setAttribute(props[j], val.replace(/url\("([^"]*)"\)/g, 'url($1)').replace(/^(-?[\d.]+)px$/, '$1'));
        }
        if (inl) v.setAttribute('style', inl);
        cl.removeAttribute('style');
      }
      // el trazado del departamento lo instancia también el <use> del contorno: debe heredar (relleno en su grupo,
      // solo trazo en el <use>) y no llevar el degradado como atributo propio, o el relleno se pintaría dos veces
      var dep = c.querySelector('#cob-depto');
      if (dep) { dep.setAttribute('fill', 'inherit'); dep.setAttribute('stroke', 'inherit'); dep.removeAttribute('fill-opacity'); dep.removeAttribute('stroke-opacity'); dep.removeAttribute('stroke-width'); dep.removeAttribute('opacity'); }
      c.removeAttribute('role'); c.removeAttribute('aria-labelledby'); c.removeAttribute('class'); c.removeAttribute('focusable');
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      c.setAttribute('width', Math.round(ancho)); c.setAttribute('height', Math.round(alto));
      Object.keys(GRUPOS).forEach(function (sel) {
        var g = c.querySelector(sel); if (!g) return;
        if (mostrar.indexOf(sel) < 0) { g.setAttribute('visibility', 'hidden'); return; }
        var px = GRUPOS[sel]; if (!px) return;
        var w = (px * k).toFixed(3); g.setAttribute('stroke-width', w);
        var hijos = g.querySelectorAll('*'); for (var h = 0; h < hijos.length; h++) hijos[h].setAttribute('stroke-width', w);
      });
      return c;
    }
    function pintarCapa(canvas, clon, extra, cb) {
      var xml; try { xml = new XMLSerializer().serializeToString(clon); } catch (e) { cb(false); return; }
      var img = new Image(), d = PV.dpr(1.5) * extra, w = Math.round(ancho), h = Math.round(alto);
      img.onload = function () {
        try {
          canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
          var cx = canvas.getContext('2d'); cx.setTransform(d, 0, 0, d, 0, 0); cx.clearRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
          cb(true);
        } catch (e) { cb(false); }
      };
      img.onerror = function () { cb(false); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    }
    function construirCapas(clave, cb) {
      if (!window.XMLSerializer || !capas.fondo || !capas.interior || !capas.lineas || !capas.todo) { cb(false); return; }
      construyendo = true;
      // los tres «lejos» pintan la vista inicial entera (departamento completo) con trazos para la escala inicial;
      // «todo» pinta solo la vista final con trazos para la escala final y se funde encima durante el zoom
      var si = s0(), todos = Object.keys(GRUPOS), ok = true, i = 0;
      var vbI = Vi.x.toFixed(2) + ' ' + Vi.y.toFixed(2) + ' ' + Vi.w.toFixed(2) + ' ' + Vi.h.toFixed(2), vbF = base.getAttribute('viewBox');
      // los lejanos se amplían hasta ~2,7× durante el zoom: van con resolución extra (×1,5, tope 1800 px de ancho)
      var extra = Math.max(1, Math.min(1.5, 1800 / (Math.round(ancho) * PV.dpr(1.5))));
      var lista = [
        [capas.fondo, si, ['.cobertura__cuadricula', '.cobertura__vecinos', '.cobertura__rios'], vbI, extra],
        [capas.interior, si, ['.cobertura__relleno', '.cobertura__munis'], vbI, extra],
        [capas.lineas, si, ['.cobertura__contorno'], vbI, extra],
        [capas.todo, 1, todos, vbF, 1]
      ];
      (function paso() {
        if (i >= lista.length) { construyendo = false; if (ok) claveCapas = clave; cb(ok); return; }
        var it = lista[i++];
        pintarCapa(it[0], clonBase(it[1], it[2], it[3]), it[4], function (bien) { ok = ok && bien; setTimeout(paso, 0); });
      })();
    }

    // al cambiar de modo, los bitmaps del mapa base se vuelven a pintar con los colores nuevos (el SVG vivo cambia solo)
    // (si en ese momento se están pintando, se espera a que terminen)
    var esperasTema = 0;
    document.addEventListener('pv:tema', function repintar(e) {
      if (e) esperasTema = 0;
      if (!animado || modo === 'vivo') return;
      if (construyendo || modo === 'pendiente') { if (esperasTema++ < 40) setTimeout(repintar, 250); return; }
      if (claveActual() !== claveCapas) construirCapas(claveActual(), function (ok) { modo = ok ? 'bitmaps' : 'vivo'; aplicarCapas(); });
    });

    // las ondas solo corren con el mapa en pantalla
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { lienzo.classList.toggle('is-visible', en[0].isIntersecting); }, { threshold: 0.01 }).observe(lienzo);
    else lienzo.classList.add('is-visible');

    // la lista y las etiquetas se iluminan mutuamente
    function activar(clave, on) {
      var todos = sedes.concat(etiquetas, tarjetas, chipsM);
      for (var i = 0; i < todos.length; i++) {
        var el = todos[i];
        if (el.getAttribute('data-sede') === clave || el.getAttribute('data-sede-enlace') === clave) el.classList.toggle('is-activa', on);
      }
    }
    // focusin/focusout: las tarjetas de oficina ya no son un enlace sino una caja con dos (WhatsApp y mapa)
    function enlazar(el, clave) {
      el.addEventListener('pointerenter', function () { activar(clave, true); });
      el.addEventListener('pointerleave', function () { activar(clave, false); });
      el.addEventListener('focusin', function () { activar(clave, true); });
      el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) activar(clave, false); });
    }
    tarjetas.forEach(function (a) { enlazar(a, a.getAttribute('data-sede-enlace')); });
    etiquetas.forEach(function (e) { enlazar(e, e.getAttribute('data-sede')); });
    chipsM.forEach(function (c) { enlazar(c, c.getAttribute('data-sede')); });

    // el contador del año no lleva separador de miles (el núcleo escribe 2.018)
    var anio = $('.cobertura__anio');
    if (anio && 'MutationObserver' in window) {
      new MutationObserver(function () {
        var t = anio.textContent;
        if (t.indexOf('.') >= 0) anio.textContent = t.replace(/\./g, '');
      }).observe(anio, { childList: true, characterData: true, subtree: true });
    }

    // --- sin GSAP o con movimiento reducido: vista de detalle, todo visible, quieto ---
    if (PV.reduced || !PV.hayST()) {
      z.p = 1; encendido = true; lienzo.classList.add('is-encendido');
      var quieto = function () { medir(); aplicarVista(); };
      quieto();
      window.addEventListener('resize', quieto);
      window.addEventListener('load', quieto);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(quieto);
      return;
    }

    // --- pulso de luz que recorre la troncal (solo con el mapa en pantalla y la troncal ya dibujada) ---
    var reloj = 0, pulsoVisible = false;
    function ocultarPulso() { if (pulsoVisible) { pulso.style.opacity = '0'; cola.style.opacity = '0'; pulsoVisible = false; } }
    function tick(ts, dt) {
      if (!LT || !troncalLista) { ocultarPulso(); return; }
      reloj += Math.min(dt || 16, 64);
      var ciclo = 4800, viaje = 3900, f = (reloj % ciclo) / viaje;
      if (f >= 1) { ocultarPulso(); return; }
      var ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      var d = ease * LT, p = troncalPath.getPointAtLength(d);
      pulso.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ') scale(' + kFin.toFixed(4) + ')');
      var colaLen = Math.min(LT * 0.2, 48);
      cola.style.strokeDasharray = colaLen.toFixed(2) + ' ' + (LT + colaLen * 2).toFixed(2);
      cola.style.strokeDashoffset = (colaLen - d).toFixed(2);
      var op = Math.min(1, f * 10, (1 - f) * 6).toFixed(3);
      pulso.style.opacity = op; cola.style.opacity = op;
      pulsoVisible = true;
    }
    PV.bucleVisible(lienzo, tick);

    // --- el encendido: una sola vez, a su propio ritmo (no depende del scroll) ---
    function encender() {
      if (encendido) return;
      encendido = true;
      lienzo.classList.add('is-encendido');
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .to(sedesIn, { scale: 1, duration: 0.55, ease: 'back.out(2.4)', stagger: 0.1 }, 0)
        .to([troncalLuz, troncal], { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, 0.3)
        .to(etiquetas, { opacity: 1, duration: 0.45, stagger: 0.08 }, 0.6)
        .to(enlaces, { opacity: 1, duration: 0.6, stagger: 0.25 }, 1.2)
        .to(leyenda, { opacity: 1, duration: 0.6 }, 1.4)
        .call(function () { troncalLista = true; }, null, 1.5);
    }

    // --- contorno y zoom ligados al scroll, por tamaño de pantalla ---
    ScrollTrigger.addEventListener('refreshInit', medir);
    ScrollTrigger.addEventListener('refresh', aplicarVista);
    var vh = function () { return window.innerHeight || 800; };
    animado = true;
    var mm = gsap.matchMedia();
    mm.add({ movil: '(max-width: 900px)', escritorio: '(min-width: 901px)' }, function (ctx) {
      var gen = ++generacion;
      medir();
      z.p = 0; rev.fondo = 0; rev.interior = 0;
      // +2: con dashoffset exacto el remate redondo del trazo pinta un punto en el extremo
      gsap.set(contorno, { strokeDasharray: L + 2, strokeDashoffset: L + 2 });
      if (!encendido) {
        gsap.set(leyenda, { opacity: 0 });
        gsap.set(etiquetas, { opacity: 0 });
        gsap.set(enlaces, { opacity: 0 });
        gsap.set(sedesIn, { scale: 0, transformOrigin: '50% 50%' });
        gsap.set([troncal, troncalLuz], { strokeDasharray: LT + 2, strokeDashoffset: LT + 2 });
      }
      aplicarVista();
      // el recorrido: desde que asoma el mapa hasta poco antes de que se pegue arriba (o hasta que se ve entero, si eso llega antes)
      var distancia = function () {
        var topFijo = parseFloat(getComputedStyle(mapa).top) || 80;
        var finTop = Math.max(topFijo + vh() * 0.1, vh() * 0.9 - marco.offsetHeight);
        return Math.round(Math.max(240, vh() * 0.95 - finTop));
      };
      var dibujo = { v: 0 };
      function crearLinea() {
        tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: escena,
            start: 'top 95%',
            end: function () { return '+=' + distancia(); },
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: function (st) { if (st.progress >= 0.9) encender(); }
          }
        });
        // 1. el contorno se dibuja y una cabeza de luz lo recorre; el fondo (vecinos, ríos) y el interior (relleno, municipios) se revelan
        tl.to(dibujo, { v: 1, duration: 0.42, onUpdate: function () { moverCabeza(dibujo.v); } }, 0)
          .to(contorno, { strokeDashoffset: 0, duration: 0.42 }, 0)
          .to(cabeza, { opacity: 1, duration: 0.03 }, 0.01)
          .to(cabeza, { opacity: 0, duration: 0.05 }, 0.39)
          .fromTo(rev, { fondo: 0 }, { fondo: 1, duration: 0.26, onUpdate: aplicarCapas }, 0.04)
          .fromTo(rev, { interior: 0 }, { interior: 1, duration: 0.3, ease: 'power1.inOut', onUpdate: aplicarCapas }, 0.12)
        // 2. zoom del departamento al detalle de las sedes (solo transform sobre bitmaps)
          .fromTo(z, { p: 0 }, { p: 1, duration: 0.58, ease: 'power2.inOut', onUpdate: function () { alZoom(false); } }, 0.42);
        // 3. el encendido también salta cuando el marco está casi entero en pantalla (p. ej. al llegar por el ancla del menú)
        ScrollTrigger.create({
          trigger: escena,
          start: function () { return 'top ' + Math.max(0, Math.round(vh() - marco.offsetHeight - 24)) + 'px'; },
          once: true,
          onEnter: encender
        });
      }
      var clave = claveActual();
      if (claveCapas === clave) { modo = 'bitmaps'; aplicarCapas(); ctx.add(crearLinea); }
      else construirCapas(clave, function (ok) { if (gen !== generacion) return; modo = ok ? 'bitmaps' : 'vivo'; aplicarCapas(); ctx.add(crearLinea); });
      return function () { tl = null; };
    });
  }
};
