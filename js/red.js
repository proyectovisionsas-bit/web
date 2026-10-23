/* ============================================================
   Proyectovisión · red.js — "Así es la red"
   - el haz que barre la banda solo corre mientras la banda está en pantalla
   - titular partido en palabras (SplitText) que entra al verse
   - segmentos del recorrido que se dibujan con scrub
   - un pulso de luz que recorre nodo → troncal → caja NAP → tu casa
     en bucle, solo mientras el bloque está en pantalla
   El parallax de la banda lo hace app.js con [data-parallax].
   Sin GSAP o con movimiento reducido no se mueve nada y todo se ve.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.red = {
  init: function (PV) {
    var sec = PV.$('#red');
    if (!sec || PV.reduced) return;

    /* ---- haz de la banda: encendido solo en pantalla (sin depender de GSAP) ---- */
    var banda = PV.$('.red__banda', sec);
    if (banda && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        banda.classList.toggle('is-en-pantalla', en[0].isIntersecting && !document.hidden);
      }, { threshold: 0.01 }).observe(banda);
      document.addEventListener('visibilitychange', function () { if (document.hidden) banda.classList.remove('is-en-pantalla'); });
    } else if (banda) banda.classList.add('is-en-pantalla');

    if (!PV.hayST()) return;

    var h2 = PV.$('.red__titulo', sec);
    var ruta = PV.$('.red__ruta', sec);
    var pasos = PV.$('.red__pasos', sec);
    var luz = PV.$('.red__luz', sec);
    var estela = PV.$('.red__estela', sec);
    var items = PV.$$('.red__paso', sec);
    var puntos = PV.$$('.red__punto', sec);
    var segs = PV.$$('.red__seg', sec);

    /* ---- titular (se parte cuando las fuentes ya cargaron, para que las líneas midan bien) ---- */
    function titular() {
      var partido = PV.partir(h2, 'lines,words');
      if (partido && partido.words && partido.words.length) {
        gsap.from(partido.words, { yPercent: 110, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: h2, start: 'top 88%', once: true } });
      } else {
        gsap.from(h2, { y: 36, opacity: 0, duration: 1, scrollTrigger: { trigger: h2, start: 'top 88%', once: true } });
      }
    }
    if (h2) {
      if (document.fonts && document.fonts.ready && document.fonts.status !== 'loaded') document.fonts.ready.then(titular);
      else titular();
    }

    if (!ruta || !pasos || !luz || puntos.length < 2) return;

    /* ---- recorrido: segmentos con scrub y pulso de luz ---- */
    var temporizadores = [];
    function encender(i) {
      var el = items[i];
      if (!el) return;
      el.classList.add('is-encendido');
      clearTimeout(temporizadores[i]);
      temporizadores[i] = setTimeout(function () { el.classList.remove('is-encendido'); }, i === items.length - 1 ? 1100 : 800);
    }

    var mm = gsap.matchMedia();
    mm.add({ horizontal: '(min-width: 761px)', vertical: '(max-width: 760px)' }, function (ctx) {
      var horizontal = ctx.conditions.horizontal;
      var prop = horizontal ? 'scaleX' : 'scaleY';
      var tl = null, activo = false;

      // los segmentos se dibujan al desplazarse (scrub), uno tras otro
      if (segs.length) {
        var desde = {}, hasta = {};
        desde[prop] = 0; hasta[prop] = 1;
        hasta.ease = 'none';
        hasta.stagger = 0.35;
        hasta.scrollTrigger = { trigger: ruta, start: 'top 92%', end: 'top 45%', scrub: 0.5 };
        gsap.fromTo(segs, desde, hasta);
      }

      gsap.set(estela, { rotation: horizontal ? 0 : 90 });

      function construir() {
        if (tl) tl.kill();
        var base = pasos.getBoundingClientRect();
        var pts = puntos.map(function (p) {
          var r = p.getBoundingClientRect();
          return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
        });
        tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.9 });
        tl.set(luz, { x: pts[0].x, y: pts[0].y, opacity: 0 });
        tl.to(luz, { opacity: 1, duration: 0.35, ease: 'power1.out' });
        tl.add(function () { encender(0); });
        for (var i = 1; i < pts.length; i++) {
          (function (i) {
            var d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            tl.to(luz, { x: pts[i].x, y: pts[i].y, duration: PV.clamp(d / 240, 0.7, 1.6), ease: 'power1.inOut' }, '+=0.15');
            tl.add(function () { encender(i); });
          })(i);
        }
        tl.to(luz, { opacity: 0, duration: 0.5, ease: 'power1.in' }, '+=0.35');
        if (activo) tl.play();
      }

      construir();
      // posiciones nuevas cuando cambian las fuentes o el tamaño (ScrollTrigger.refresh)
      ScrollTrigger.addEventListener('refresh', construir);

      ScrollTrigger.create({
        trigger: ruta, start: 'top bottom', end: 'bottom top',
        onToggle: function (st) { activo = st.isActive; if (!tl) return; activo ? tl.play() : tl.pause(); }
      });

      return function () {
        ScrollTrigger.removeEventListener('refresh', construir);
        if (tl) tl.kill();
        gsap.set(luz, { clearProps: 'all' });
        gsap.set(segs, { clearProps: 'all' });
        items.forEach(function (el) { el.classList.remove('is-encendido'); });
      };
    });
  }
};
