/* ============================================================
   Proyectovisión · promos.js — carrusel del banner «Novedades y promociones» (#promociones).
   Sin JS el banner es una fila que se desliza con el dedo. Con JS:
   · vuelve a mirar las fechas de cada promoción (data-desde / data-hasta, hora de Colombia; «hasta» ya no cuenta):
     las vencidas o las que aún no empiezan se esconden aunque la página no se haya vuelto a publicar.
     Si no queda ninguna, se esconde el banner entero;
   · con dos o más: flechas, puntos y (sin movimiento reducido) cambio automático cada 7 s.
     El reloj corre solo con el banner a la vista, sin el puntero ni el foco sobre las promociones y con la pestaña
     visible; si no, espera donde iba. .is-corriendo hace que la barrita del punto activo (promos.css) avance a la par.
     Usar flechas o puntos, o deslizar la fila, lo deja quieto (el botón ▶ lo reanuda): nada cambia mientras alguien lee.
   (El reloj es de JS y no el animationend de la barrita: Chrome a veces da por terminada una animación que estaba
   en pausa justo cuando arranca, y el carrusel saltaba a la siguiente al llegar a él.)
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.promos = {
  init: function (PV) {
    var sec = PV.$('#promociones');
    if (!sec) return;
    var pista = PV.$('.promos__pista', sec);
    var todas = PV.$$('.promo', sec);
    if (!pista || !todas.length) return;

    // fechas: «2026-12-24» → medianoche de Colombia (UTC−5, sin horario de verano)
    var fecha = function (f) { return f ? Date.parse(f + 'T00:00:00-05:00') : NaN; };
    var ahora = Date.now();
    todas.forEach(function (s) {
      var d = fecha(s.getAttribute('data-desde')), h = fecha(s.getAttribute('data-hasta'));
      s.hidden = (!isNaN(d) && ahora < d) || (!isNaN(h) && ahora >= h);
    });
    var vis = todas.filter(function (s) { return !s.hidden; });
    var n = vis.length;
    if (!n) { sec.hidden = true; return; }
    vis.forEach(function (s, i) {
      var t = PV.$('.promo__titulo', s);
      s.setAttribute('aria-label', (i + 1) + ' de ' + n + (t ? ': ' + t.textContent.trim() : ''));
    });
    if (n < 2) return;

    var controles = PV.$('.promos__controles', sec);
    var puntos = PV.$('.promos__puntos', sec);
    var pausa = PV.$('.promos__pausa', sec);
    var DURACION = 7000;
    var auto = !PV.reduced;
    var actual = -1, destino = -1, programadoHasta = 0, pausado = false;

    // ---------- reloj del cambio automático ----------
    var enVista = false, encima = false, focoDentro = false;
    var corriendo = false, restante = DURACION, desde = 0, reloj = 0;
    function puedeCorrer() { return auto && !pausado && enVista && !encima && !focoDentro && !document.hidden; }
    function actualizarReloj() {
      var debe = puedeCorrer();
      if (debe === corriendo) return;
      corriendo = debe;
      sec.classList.toggle('is-corriendo', debe);
      if (debe) { desde = performance.now(); reloj = setTimeout(cumplido, restante); }
      else { clearTimeout(reloj); restante = Math.max(0, restante - (performance.now() - desde)); }
    }
    function reiniciarReloj() {
      clearTimeout(reloj);
      restante = DURACION;
      if (corriendo) { desde = performance.now(); reloj = setTimeout(cumplido, restante); }
    }
    function cumplido() { if (corriendo) ir(actual + 1); }

    var botones = vis.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'promos__punto';
      b.setAttribute('aria-label', 'Ver la promoción ' + (i + 1) + ' de ' + n);
      b.addEventListener('click', function () { detener(); ir(i); });
      puntos.appendChild(b);
      return b;
    });

    function marcar(i) {
      if (i === actual) return;
      actual = i;
      botones.forEach(function (b, j) {
        if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      reiniciarReloj();   // la barrita del punto nuevo también empieza de cero
    }

    function ir(i) {
      i = (i + n) % n;
      destino = i;
      programadoHasta = performance.now() + 1000;
      pista.scrollTo({ left: vis[i].offsetLeft, behavior: PV.reduced ? 'auto' : 'smooth' });
      marcar(i);
    }

    // la que se ve: la de borde izquierdo más cerca del desplazamiento de la pista
    var pendiente = false;
    function medir() {
      pendiente = false;
      var x = pista.scrollLeft, mejor = 0, dist = Infinity;
      vis.forEach(function (s, i) { var d = Math.abs(s.offsetLeft - x); if (d < dist) { dist = d; mejor = i; } });
      if (destino >= 0) {
        if (mejor !== destino && performance.now() < programadoHasta) return;   // de camino a la elegida
        destino = -1;
      }
      marcar(mejor);
    }
    pista.addEventListener('scroll', function () {
      if (!pendiente) { pendiente = true; requestAnimationFrame(medir); }
      if (performance.now() > programadoHasta) detener();   // la movió la persona (dedo, panel táctil, teclado)
    }, { passive: true });

    function pausar(si) {
      pausado = si;
      sec.classList.toggle('is-pausado', si);
      pausa.setAttribute('aria-label', si ? 'Reanudar el cambio automático de las promociones' : 'Pausar el cambio automático de las promociones');
      if (!si) restante = DURACION;   // al reanudar, la barrita vuelve a empezar: el reloj también
      actualizarReloj();
    }
    function detener() { if (auto && !pausado) pausar(true); }

    PV.$$('.promos__flecha', sec).forEach(function (b) {
      b.addEventListener('click', function () { detener(); ir(actual + (parseInt(b.getAttribute('data-dir'), 10) || 1)); });
    });

    if (auto) {
      sec.classList.add('is-auto');
      pausa.addEventListener('click', function () { pausar(!pausado); });
      // espera: el puntero (ratón) o el foco sobre las promociones, fuera de la vista, pestaña escondida
      pista.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { encima = true; actualizarReloj(); } });
      pista.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { encima = false; actualizarReloj(); } });
      pista.addEventListener('focusin', function () { focoDentro = true; actualizarReloj(); });
      pista.addEventListener('focusout', function (e) { focoDentro = !!(e.relatedTarget && pista.contains(e.relatedTarget)); actualizarReloj(); });
      document.addEventListener('visibilitychange', actualizarReloj);
      pista.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a, button')) detener(); });   // usó una promoción
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          enVista = en[0].isIntersecting && en[0].intersectionRatio >= 0.5;
          actualizarReloj();
        }, { threshold: [0, 0.5, 1] }).observe(pista);
      } else { enVista = true; }
    } else {
      pausa.hidden = true;
    }

    controles.hidden = false;
    puntos.hidden = false;
    marcar(0);
    if (pista.scrollLeft) medir();   // el navegador pudo devolver la fila a donde estaba
    actualizarReloj();
  }
};
