/* ============================================================
   Proyectovisión · hero.js — portada: aurora + suelo + troncal de fibra + reactor de anillos + titular gigante.
   - Entrada: titular por líneas (SplitText con máscara, esperando la fuente), subtítulo, botones, datos, reactor.
   - Troncal: hero.js traza el camino (desde abajo a la izquierda hasta tocar el anillo exterior), lo dibuja con
     stroke-dashoffset al cargar y hace viajar un pulso de 120 px en bucle (getPointAtLength → transform de un div).
   - Reactor: el 500 cuenta al cargar con GSAP y lanza una onda al terminar (y cada vez que llega un pulso).
   - Año 2018: cuenta sin separador de miles (data-anio); los otros datos usan data-contador de app.js.
   - Parallax con el puntero (solo escritorio), scrub al salir de la portada, motas de luz en canvas.
   - Fuera de pantalla: .is-visible se quita y las animaciones CSS quedan en pausa (ver hero.css).
   - Si no hay GSAP o PV.reduced: todo se ve, nada se mueve.
   - Carga lenta: hero.css esconde las piezas de la entrada solo hasta que este archivo toma el mando (.is-animando) y,
     si tarda más de 2 s, las muestra solo (rescate). Si al iniciar ya están a la vista, la entrada no se repite:
     la portada queda tal cual (troncal dibujada, 500 y 2018 en su sitio) y solo siguen los bucles.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.hero = {
  init: function (PV) {
    var sec = document.querySelector('.hero--c');
    if (!sec) return;
    var $ = function (s) { return sec.querySelector(s); };
    var titulo = $('.hero-c__titulo');
    var eyebrow = $('.hero-c__eyebrow');
    var lead = $('.hero-c__lead');
    var acciones = $('.hero-c__acciones');
    var datos = $('.hero-c__datos');
    var anillos = $('.hero-c__anillos');
    var reactor = $('.hero-c__reactor');
    var nucleo = $('.hero-c__nucleo');
    var numero = $('.hero-c__numero');
    var suelo = $('.hero-c__suelo');
    var scroll = $('.hero-c__scroll');
    var mancha = $('.hero-c__mancha');
    var anio = $('[data-anio]');
    var contenido = $('.hero-c__contenido');
    var fibra = $('.hero-c__fibra');
    var troncal = $('.hero-c__troncal');
    var troncalBase = $('.hero-c__troncal-base');
    var troncalHalo = $('.hero-c__troncal-halo');
    var pulso = $('.hero-c__pulso');
    var mostrarTodo = function () { sec.classList.add('is-lista'); };
    // ¿llegó tarde el JS? Si el rescate de hero.css ya está mostrando la portada (opacidad > 0 en el eyebrow), no se vuelve
    // a esconder: la entrada coreografiada es un extra para quien carga rápido; quien esperó ya está leyendo
    var rescatado = false;
    try { rescatado = !!(eyebrow && parseFloat(getComputedStyle(eyebrow).opacity) > 0); } catch (e) {}
    if (rescatado) mostrarTodo();
    sec.classList.add('is-animando'); // hero.js toma el mando: el rescate de CSS deja de contar

    // indicador de scroll: baja a la siguiente sección
    if (scroll) scroll.addEventListener('click', function () {
      var sig = sec.nextElementSibling;
      if (sig) PV.irA(sig, -64); else window.scrollTo({ top: window.innerHeight, behavior: PV.reduced ? 'auto' : 'smooth' });
    });

    // en pantalla / fuera de pantalla: las animaciones CSS de la portada solo corren mientras se ve
    sec.classList.add('is-visible');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { sec.classList.toggle('is-visible', en[0].isIntersecting); }, { threshold: 0 }).observe(sec);
    }

    // --- la troncal: el camino se calcula con la geometría real (sección + reactor) ---
    var mqEscritorio = window.matchMedia('(min-width: 1024px)');
    var LT = 0; // longitud de la troncal en px
    function trazarTroncal() {
      if (!troncal || !anillos || !troncalBase || !mqEscritorio.matches) { LT = 0; return 0; }
      var r = sec.getBoundingClientRect(), a = anillos.getBoundingClientRect();
      var W = Math.round(r.width), H = Math.round(r.height);
      if (!W || !H || !a.width) { LT = 0; return 0; }
      troncal.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      // centro y radio del anillo exterior (r=272 en un viewBox de 600), sin el parallax del momento
      var cx = a.left - r.left + a.width / 2, cy = a.top - r.top + a.height / 2, R = a.width * 272 / 600;
      var ang = 135 * Math.PI / 180; // abajo a la izquierda del anillo (en pantalla, y crece hacia abajo)
      var ex = cx + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R;
      var d = 'M-40 ' + (H + 40) + ' C ' + Math.round(W * 0.33) + ' ' + (H - 24) + ', ' + Math.round(ex - 60) + ' ' + (H - 12) + ', ' + Math.round(ex) + ' ' + Math.round(ey);
      troncalBase.setAttribute('d', d);
      if (troncalHalo) troncalHalo.setAttribute('d', d);
      try { LT = troncalBase.getTotalLength(); } catch (e) { LT = 0; }
      return LT;
    }
    trazarTroncal();

    // sin GSAP o con movimiento reducido: contenido completo y quieto
    if (!PV.hayGsap() || PV.reduced) {
      mostrarTodo();
      window.addEventListener('resize', function () { trazarTroncal(); }, { passive: true });
      return;
    }

    var gsap = window.gsap;
    var troncalDibujada = false;

    // --- entrada ---
    function entrada() {
      trazarTroncal(); // con la fuente ya cargada, la geometría es la definitiva
      var split = PV.partir(titulo, 'lines');
      splitTitulo = split;
      var lineas = split && split.lines && split.lines.length ? split.lines : [titulo];
      var tl = gsap.timeline({ defaults: { ease: 'power4.out' }, onStart: mostrarTodo, onComplete: deshacerTitulo });
      tl.from(lineas, { yPercent: 115, duration: 1.15, stagger: 0.13 }, 0.05)
        .fromTo(eyebrow, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.8 }, 0)
        .fromTo(suelo, { opacity: 0 }, { opacity: 1, duration: 1.8, ease: 'power2.out' }, 0.1)
        .fromTo(reactor, { opacity: 0, scale: 0.72, rotation: -28, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, rotation: 0, duration: 1.7, ease: 'expo.out' }, 0.15)
        .fromTo(nucleo, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 1, ease: 'power3.out' }, 0.45)
        .fromTo(lead, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.9 }, 0.5)
        .fromTo(acciones, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.9 }, 0.62)
        .fromTo(datos, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.9 }, 0.74)
        .fromTo(scroll, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, 1.3);

      // la troncal se dibuja desde el suelo hasta el reactor
      if (fibra && troncalBase) {
        var trazos = troncalHalo ? [troncalHalo, troncalBase] : [troncalBase];
        if (LT) gsap.set(trazos, { strokeDasharray: LT + 2, strokeDashoffset: LT + 2 });
        tl.fromTo(fibra, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.55);
        if (LT) tl.to(trazos, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut', onComplete: function () { troncalDibujada = true; } }, 0.6);
        else troncalDibujada = true;
      }

      // reactor: el 500 cuenta como si arrancara
      if (numero && numero.hasAttribute('data-reactor')) { // con texto (sin data-reactor) el núcleo no cuenta
        var fin = parseFloat(numero.getAttribute('data-reactor')) || 500;
        var obj = { v: 0 };
        numero.textContent = '0';
        tl.to(obj, {
          v: fin, duration: 2.1, ease: 'power2.inOut',
          onUpdate: function () { numero.textContent = Math.round(obj.v).toString(); },
          onComplete: function () { numero.textContent = String(fin); nucleo.classList.add('is-cargado'); }
        }, 0.5);
      } else if (nucleo) {
        tl.add(function () { nucleo.classList.add('is-cargado'); }, 2.2);
      }
      // año: de 1990 a 2018 sin puntos de miles
      if (anio) {
        var a = { v: 1990 }, finA = parseInt(anio.getAttribute('data-anio'), 10) || 2018;
        tl.to(a, { v: finA, duration: 1.6, ease: 'power3.out', onUpdate: function () { anio.textContent = String(Math.round(a.v)); } }, 0.8);
      }
      return tl;
    }

    // terminada la entrada, el titular vuelve a fluir solo (sin las líneas de SplitText): así el halo de «luz»
    // no queda recortado por la máscara y un cambio de ancho o de fuente no deja líneas mal cortadas
    var arrancada = false, tlEntrada = null, splitTitulo = null;
    function deshacerTitulo() {
      if (!splitTitulo) return;
      try { splitTitulo.revert(); } catch (e) {}
      splitTitulo = null;
    }
    function arrancar() {
      if (arrancada) return;
      arrancada = true;
      if (rescatado) {
        // la portada ya se ve: estado final directo (troncal entera, onda del núcleo una vez), sin repetir la entrada
        trazarTroncal();
        troncalDibujada = true;
        if (nucleo) nucleo.classList.add('is-cargado');
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { trazarTroncal(); });
        return;
      }
      tlEntrada = entrada();
    }
    if (rescatado) arrancar();
    // esperar la fuente del titular (tope 1000 ms) para que SplitText mida las líneas con Clash Display y no con la de respaldo
    else if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 1em "Clash Display"'), document.fonts.ready]).then(arrancar, arrancar);
      setTimeout(arrancar, 1000);
    } else arrancar();
    // si cambia el ancho mientras la entrada sigue, el titular se deshace al terminar (onComplete); si ya terminó, no hay nada que hacer
    var resizeT = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        var l = trazarTroncal();
        if (l && troncalDibujada) gsap.set(troncalHalo ? [troncalHalo, troncalBase] : [troncalBase], { strokeDasharray: l + 2, strokeDashoffset: 0 });
      }, 180);
    }, { passive: true });

    // --- parallax con el puntero (solo con puntero fino); la troncal acompaña al reactor para seguir tocándolo ---
    if (!PV.touch && anillos) {
      var ax = gsap.quickTo(anillos, 'x', { duration: 0.9, ease: 'power3' });
      var ay = gsap.quickTo(anillos, 'y', { duration: 0.9, ease: 'power3' });
      var fx = fibra ? gsap.quickTo(fibra, 'x', { duration: 0.9, ease: 'power3' }) : null;
      var fy = fibra ? gsap.quickTo(fibra, 'y', { duration: 0.9, ease: 'power3' }) : null;
      var nx = gsap.quickTo(nucleo, 'x', { duration: 1.1, ease: 'power3' });
      var ny = gsap.quickTo(nucleo, 'y', { duration: 1.1, ease: 'power3' });
      var mx = mancha ? gsap.quickTo(mancha, 'x', { duration: 1.6, ease: 'power2' }) : null;
      var my = mancha ? gsap.quickTo(mancha, 'y', { duration: 1.6, ease: 'power2' }) : null;
      window.addEventListener('pointermove', function (e) {
        var px = e.clientX / window.innerWidth - 0.5, py = e.clientY / window.innerHeight - 0.5;
        ax(px * 22); ay(py * 16);
        if (fx) { fx(px * 22); fy(py * 16); }
        nx(px * -10); ny(py * -8);
        if (mx) { mx(px * -60); my(py * -40); }
      }, { passive: true });
    }

    // --- al salir de la portada: el texto sube despacio y el reactor (con su troncal) se apaga ---
    if (PV.hayST() && contenido && anillos) {
      var salida = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: true } })
        .to(contenido, { yPercent: -8, ease: 'none' }, 0)
        .to(anillos, { yPercent: 14, opacity: 0, ease: 'none' }, 0)
        .to(suelo, { yPercent: 10, ease: 'none' }, 0);
      if (fibra) salida.to(fibra, { yPercent: 6, opacity: 0, ease: 'none' }, 0);
    }

    // --- el pulso que recorre la troncal (solo con la portada en pantalla y la troncal dibujada) ---
    if (fibra && pulso && troncalBase) {
      var LARGO = 120, VEL = 380, pos = 0, espera = 0.6, visible = false;
      PV.bucleVisible(fibra, function (ts, dt) {
        if (!LT || !troncalDibujada || !mqEscritorio.matches) { if (visible) { pulso.style.opacity = '0'; visible = false; } return; }
        var s = Math.min(dt || 16, 50) / 1000;
        if (espera > 0) { espera -= s; return; }
        pos += VEL * s;
        if (pos >= LT + LARGO) {
          pos = 0; espera = 0.9 + Math.random() * 1.1;
          if (visible) { pulso.style.opacity = '0'; visible = false; }
          // la luz llega al reactor: la onda del núcleo vuelve a salir
          if (nucleo && nucleo.classList.contains('is-cargado')) { nucleo.classList.remove('is-cargado'); void nucleo.offsetWidth; nucleo.classList.add('is-cargado'); }
          return;
        }
        var cab = Math.min(pos, LT), cola = Math.max(0, pos - LARGO);
        var B, A;
        try { B = troncalBase.getPointAtLength(cab); A = troncalBase.getPointAtLength(cola); } catch (e) { return; }
        var len = Math.hypot(B.x - A.x, B.y - A.y);
        if (len < 2) { if (visible) { pulso.style.opacity = '0'; visible = false; } return; }
        var ang = Math.atan2(B.y - A.y, B.x - A.x);
        pulso.style.transform = 'translate(' + (B.x - LARGO).toFixed(1) + 'px,' + (B.y - 1.5).toFixed(1) + 'px) rotate(' + ang.toFixed(4) + 'rad) scaleX(' + (len / LARGO).toFixed(3) + ')';
        if (!visible) { pulso.style.opacity = '1'; visible = true; }
      });
    }

    // --- motas de luz que suben desde el suelo (canvas, solo mientras se ve) ---
    var canvas = $('.hero-c__motas');
    if (canvas && canvas.getContext) {
      var ctx = canvas.getContext('2d');
      var W = 0, H = 0, dpr = PV.dpr(1.5), motas = [];
      function crear(m, inicial) {
        m.x = Math.random() * W;
        m.y = inicial ? Math.random() * H : H + 10;
        m.r = 0.6 + Math.random() * 1.6;
        m.vy = 10 + Math.random() * 26;        // px/s hacia arriba
        m.vx = (Math.random() - 0.5) * 8;
        m.fase = Math.random() * Math.PI * 2;
        m.vida = 0.35 + Math.random() * 0.65;
        return m;
      }
      function medir() {
        var r = sec.getBoundingClientRect();
        W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = W < 760 ? 26 : 58;
        motas.length = 0;
        for (var i = 0; i < n; i++) motas.push(crear({}, true));
      }
      medir();
      var resizeM = 0;
      window.addEventListener('resize', function () { clearTimeout(resizeM); resizeM = setTimeout(medir, 160); }, { passive: true });
      PV.bucleVisible(canvas, function (ts, dt) {
        var s = Math.min(dt, 50) / 1000;
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < motas.length; i++) {
          var m = motas[i];
          m.y -= m.vy * s; m.x += m.vx * s; m.fase += s * 1.6;
          if (m.y < H * 0.18 || m.x < -10 || m.x > W + 10) crear(m, false);
          var altura = 1 - (m.y / H);                 // 0 abajo → 1 arriba
          var a = m.vida * (0.45 + 0.55 * Math.sin(m.fase)) * Math.max(0, 1 - Math.abs(altura - 0.45) / 0.45);
          if (a <= 0.02) continue;
          ctx.beginPath();
          ctx.fillStyle = 'rgba(126, 232, 245, ' + a.toFixed(3) + ')';
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
};
