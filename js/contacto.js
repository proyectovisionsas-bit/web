/* ============================================================
   contacto.js — sección "Contacto" + pie.
   - Lienzo: hilos de fibra colgando con gotas de luz que bajan y destellan en la punta (canvas 2D,
     capa estática prerrenderizada, PV.dpr(1.5), PV.bucleVisible, parallax leve con el puntero).
   - Título "Hablemos" por letras (SplitText) al entrar.
   - Pie: marca a todo lo ancho medida en JS (una sola línea exacta), gradiente continuo repartido
     entre letras, entrada escalonada, imán con el puntero; botón "subir" con anillo de progreso.
   Si GSAP no está o PV.reduced es true, todo se ve quieto y completo.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.contacto = {
  init: function (PV) {
    var sec = PV.$('#contacto');
    if (sec) { contactoLienzo(PV, sec); contactoTitulo(PV, sec); contactoCometa(PV, sec); }
    var pie = PV.$('.pie');
    if (pie) { pieMarca(PV, pie); pieSubir(PV, pie); }
  }
};

function contactoToken(nombre, porDefecto) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v || porDefecto;
}
function contactoRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  var n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}
function contactoRebotar(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

/* ---------- lienzo: hilos que gotean luz ---------- */
function contactoLienzo(PV, sec) {
  var canvas = sec.querySelector('.contacto__lienzo');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  // colores del modo actual; de noche la luz se suma ('lighter'), de día se pinta encima (sumar luz sobre blanco no se ve)
  var colores = [], suma = 'lighter';
  function leerColores() {
    colores = [contactoRgb(contactoToken('--cian', '#22d3ee')), contactoRgb(contactoToken('--azul-claro', '#4f6bff')), contactoRgb(contactoToken('--violeta', '#7c3aed')), contactoRgb(contactoToken('--cian-suave', '#7ee8f5'))];
    suma = document.documentElement.getAttribute('data-tema') === 'claro' ? 'source-over' : 'lighter';
  }
  leerColores();
  var W = 0, H = 0, dpr = 1, hilos = [], capa = null, brillos = [];

  function sprite(c) {
    var s = document.createElement('canvas'); s.width = s.height = 64;
    var g = s.getContext('2d');
    var r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(' + c + ',1)'); r.addColorStop(0.22, 'rgba(' + c + ',0.6)'); r.addColorStop(1, 'rgba(' + c + ',0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return s;
  }
  function punto(h, t) { var u = 1 - t; return [u * u * h.x0 + 2 * u * t * h.x1 + t * t * h.x2, u * u * h.y0 + 2 * u * t * h.y1 + t * t * h.y2]; }

  function construir() {
    W = canvas.clientWidth || sec.clientWidth; H = canvas.clientHeight || sec.clientHeight;
    if (!W || !H) return;
    dpr = PV.dpr(1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    brillos = colores.map(sprite);
    var n = Math.round(PV.clamp(W / 26, 14, 64));
    hilos = [];
    for (var i = 0; i < n; i++) {
      var x = (i + 0.5) / n * W + (Math.random() - 0.5) * (W / n) * 1.5;
      var L = H * (0.28 + Math.random() * 0.46);
      var r = Math.random(), ci = r < 0.45 ? 0 : r < 0.75 ? 1 : r < 0.9 ? 2 : 3;
      hilos.push({ x0: x, y0: -10, x1: x + (Math.random() - 0.5) * 70, y1: L * 0.55, x2: x + (Math.random() - 0.5) * 120, y2: L, c: colores[ci], ci: ci, grosor: 0.8 + Math.random() * 1.2, alfa: 0.16 + Math.random() * 0.24, t: -Math.random() * 3, v: 0.13 + Math.random() * 0.22, flash: 0 });
    }
    capa = document.createElement('canvas'); capa.width = canvas.width; capa.height = canvas.height;
    var g = capa.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    hilos.forEach(function (h) {
      var grad = g.createLinearGradient(0, 0, 0, h.y2);
      grad.addColorStop(0, 'rgba(' + h.c + ',' + (h.alfa * 0.7).toFixed(3) + ')');
      grad.addColorStop(0.6, 'rgba(' + h.c + ',' + h.alfa.toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + h.c + ',' + Math.min(1, h.alfa * 1.8).toFixed(3) + ')');
      g.strokeStyle = grad; g.lineWidth = h.grosor;
      g.beginPath(); g.moveTo(h.x0, h.y0); g.quadraticCurveTo(h.x1, h.y1, h.x2, h.y2); g.stroke();
      var s = 9 + h.grosor * 6;
      g.globalAlpha = 0.5; g.drawImage(brillos[h.ci], h.x2 - s / 2, h.y2 - s / 2, s, s); g.globalAlpha = 1;
    });
  }

  function dibujar(ts, dt) {
    dt = Math.min(dt || 16, 50) / 1000;
    ctx.clearRect(0, 0, W, H);
    if (capa) ctx.drawImage(capa, 0, 0, W, H);
    ctx.globalCompositeOperation = suma;
    ctx.lineCap = 'round';
    for (var i = 0; i < hilos.length; i++) {
      var h = hilos[i];
      if (h.flash > 0) {
        h.flash -= dt;
        var k = Math.max(0, h.flash / 0.7), s = 16 + (1 - k) * 54;
        ctx.globalAlpha = k * 0.85; ctx.drawImage(brillos[h.ci], h.x2 - s / 2, h.y2 - s / 2, s, s);
        if (h.flash <= 0) h.t = -0.5 - Math.random() * 3.5;
        continue;
      }
      h.t += h.v * dt;
      if (h.t < 0) continue;
      if (h.t >= 1) { h.flash = 0.7; continue; }
      var p = punto(h, h.t), q = punto(h, Math.max(0, h.t - 0.08));
      ctx.globalAlpha = 0.9; ctx.strokeStyle = 'rgba(' + h.c + ',0.9)'; ctx.lineWidth = h.grosor + 0.8;
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      var s2 = 11 + h.grosor * 5;
      ctx.drawImage(brillos[3], p[0] - s2 / 2, p[1] - s2 / 2, s2, s2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function estatico() {
    hilos.forEach(function (h, i) { h.t = i % 3 === 0 ? Math.random() : -1; });
    dibujar(0, 0);
  }

  construir();
  if (PV.reduced) { estatico(); }
  else { PV.bucleVisible(canvas, dibujar); }

  var reconstruir = contactoRebotar(function () { construir(); if (PV.reduced) estatico(); }, 180);
  window.addEventListener('resize', reconstruir);
  // al cambiar de modo (botón sol/luna o el sistema), los hilos se vuelven a pintar con los colores nuevos
  document.addEventListener('pv:tema', function () { leerColores(); construir(); if (PV.reduced) estatico(); });
  if ('ResizeObserver' in window) {
    var ultimoH = sec.clientHeight;
    new ResizeObserver(function () { if (Math.abs(sec.clientHeight - ultimoH) > 12) { ultimoH = sec.clientHeight; reconstruir(); } }).observe(sec);
  }

  // parallax leve con el puntero (solo escritorio)
  if (!PV.touch && !PV.reduced && window.gsap) {
    var qx = gsap.quickTo(canvas, 'x', { duration: 0.9, ease: 'power2' });
    var qy = gsap.quickTo(canvas, 'y', { duration: 0.9, ease: 'power2' });
    sec.addEventListener('pointermove', function (e) {
      var r = sec.getBoundingClientRect();
      qx(((e.clientX - r.left) / r.width - 0.5) * -16);
      qy(((e.clientY - r.top) / r.height - 0.5) * -8);
    }, { passive: true });
    sec.addEventListener('pointerleave', function () { qx(0); qy(0); });
  }
}

/* ---------- cometa que recorre el borde de la tarjeta CTA ---------- */
function contactoCometa(PV, sec) {
  var cometa = sec.querySelector('.contacto__cometa'), tarjeta = sec.querySelector('.contacto__cta');
  if (!cometa || !tarjeta || PV.reduced) return;
  if (!(window.CSS && CSS.supports && CSS.supports('offset-path', "path('M0 0 L1 1')"))) return;
  function trazar() {
    var w = tarjeta.clientWidth, h = tarjeta.clientHeight;
    if (!w || !h) return;
    var r = Math.min(parseFloat(getComputedStyle(tarjeta).borderTopLeftRadius) || 20, w / 2, h / 2);
    var d = 'M' + r + ',0 H' + (w - r) + ' A' + r + ',' + r + ' 0 0 1 ' + w + ',' + r + ' V' + (h - r) + ' A' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h + ' H' + r + ' A' + r + ',' + r + ' 0 0 1 0,' + (h - r) + ' V' + r + ' A' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z';
    cometa.style.setProperty('--trazo', "path('" + d + "')");
    cometa.classList.add('is-lista');
  }
  trazar();
  if ('ResizeObserver' in window) new ResizeObserver(contactoRebotar(trazar, 120)).observe(tarjeta);
  else window.addEventListener('resize', contactoRebotar(trazar, 120));
}

/* ---------- título "Hablemos" letra por letra ---------- */
function contactoTitulo(PV, sec) {
  var h2 = sec.querySelector('.contacto__titulo');
  if (!h2 || PV.reduced || !PV.hayST()) return;
  function partirTitulo() {
    var split = PV.partir(h2, 'lines,chars');
    if (!split || !split.chars || !split.chars.length) return;
    gsap.from(split.chars, { yPercent: 110, rotate: 3, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.05, scrollTrigger: { trigger: h2, start: 'top 88%', once: true } });
  }
  // SplitText mide con la fuente aplicada: si Clash Display aún carga, se espera (como hacen historia y red)
  if (document.fonts && document.fonts.status !== 'loaded' && document.fonts.ready) document.fonts.ready.then(partirTitulo, partirTitulo);
  else partirTitulo();
}

/* ---------- pie: marca a todo lo ancho ---------- */
function pieMarca(PV, pie) {
  var caja = pie.querySelector('.pie__marca'), texto = pie.querySelector('.pie__marca-texto');
  if (!caja || !texto) return;
  var original = texto.textContent.trim();
  var letras = Array.from ? Array.from(original) : original.split('');
  texto.textContent = '';
  var spans = letras.map(function (ch) { var s = document.createElement('span'); s.className = 'pie__letra'; s.textContent = ch; texto.appendChild(s); return s; });
  texto.classList.add('is-partida');

  // mide a 100px y escala al ancho de la caja; segunda pasada por si el redondeo o el espaciado entre letras
  // no escalan lineales, y nunca más ancho que la caja (así la «n» final no se corta en celular)
  function ajustar() {
    var ancho = caja.clientWidth;
    if (!ancho) return;
    texto.style.fontSize = '100px';
    var w = texto.getBoundingClientRect().width;
    if (!w) return;
    var fs = 100 * ancho / w;
    texto.style.fontSize = fs.toFixed(2) + 'px';
    var w2 = texto.getBoundingClientRect().width;
    if (w2 && Math.abs(w2 - ancho) > 0.5) { fs = fs * ancho / w2; texto.style.fontSize = fs.toFixed(2) + 'px'; w2 = texto.getBoundingClientRect().width; }
    if (w2 > ancho + 0.25) { fs = fs * (ancho - 0.5) / w2; texto.style.fontSize = fs.toFixed(2) + 'px'; }
    var r0 = texto.getBoundingClientRect();
    spans.forEach(function (s) {
      var r = s.getBoundingClientRect();
      s.style.backgroundSize = r0.width.toFixed(1) + 'px 100%';
      s.style.backgroundPosition = (-(r.left - r0.left)).toFixed(1) + 'px 0';
    });
  }
  ajustar();
  // la fuente de titulares puede llegar después del primer ajuste: se repite cuando carga de verdad
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(ajustar);
    if (document.fonts.load) { try { document.fonts.load('700 100px "Clash Display"').then(ajustar, function () {}); } catch (e) {} }
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', ajustar);
  }
  window.addEventListener('load', ajustar);
  window.addEventListener('resize', contactoRebotar(ajustar, 120));
  if ('ResizeObserver' in window) {
    var anchoVisto = caja.clientWidth;
    new ResizeObserver(contactoRebotar(function () { if (caja.clientWidth !== anchoVisto) { anchoVisto = caja.clientWidth; ajustar(); } }, 80)).observe(caja);
  }

  if (PV.reduced || !window.gsap) return;
  if (PV.hayST()) {
    gsap.from(spans, { yPercent: 108, duration: 1.2, ease: 'power4.out', stagger: 0.04, scrollTrigger: { trigger: caja, start: 'top 96%', once: true } });
  }
  // imán: las letras cercanas al puntero se elevan
  if (!PV.touch) {
    var qs = spans.map(function (s) { return gsap.quickTo(s, 'y', { duration: 0.45, ease: 'power3' }); });
    var centros = [];
    var medir = function () { centros = spans.map(function (s) { var r = s.getBoundingClientRect(); return r.left + r.width / 2; }); };
    caja.addEventListener('pointerenter', medir);
    caja.addEventListener('pointermove', function (e) {
      if (!centros.length) medir();
      for (var i = 0; i < spans.length; i++) { var d = (e.clientX - centros[i]) / 150; qs[i](-24 * Math.exp(-d * d)); }
    }, { passive: true });
    caja.addEventListener('pointerleave', function () { qs.forEach(function (q) { q(0); }); });
  }
}

/* ---------- botón subir ---------- */
function pieSubir(PV, pie) {
  var btn = pie.querySelector('.pie__subir');
  if (!btn) return;
  var traza = btn.querySelector('.pie__subir-traza'), largo = 0;
  if (traza) { largo = 2 * Math.PI * parseFloat(traza.getAttribute('r')); traza.style.strokeDasharray = largo; traza.style.strokeDashoffset = largo; }
  // en celular (≤760 px) solo se muestra mientras el usuario sube y se esconde tras unos segundos quieto,
  // para no tapar los botones de WhatsApp de las tarjetas ni los créditos del pie (misma idea que .topbar.is-oculta)
  var mq = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
  var pedido = false, ultimo = window.scrollY || 0, reposo = 0;
  function esconder() { btn.classList.remove('is-visible'); }
  function pintar() {
    pedido = false;
    var y = window.scrollY || 0;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var lejos = y > window.innerHeight * 0.6;
    var movil = !!(mq && mq.matches);
    var menu = document.documentElement.classList.contains('menu-abierto');
    var mostrar = lejos && !menu && (!movil || y < ultimo - 2 || (y === ultimo && btn.classList.contains('is-visible')));
    btn.classList.toggle('is-visible', mostrar);
    if (traza) traza.style.strokeDashoffset = (largo * (1 - Math.min(1, y / max))).toFixed(1);
    clearTimeout(reposo);
    if (movil && mostrar) reposo = setTimeout(esconder, 2600);
    ultimo = y;
  }
  window.addEventListener('scroll', function () { if (!pedido) { pedido = true; requestAnimationFrame(pintar); } }, { passive: true });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { ultimo = window.scrollY || 0; pintar(); });
  pintar();
  btn.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    var inicio = document.querySelector('#inicio');
    if (inicio) PV.irA(inicio, -80);
    else if (PV.lenis) PV.lenis.scrollTo(0, { duration: 1.3 });
    else window.scrollTo({ top: 0, behavior: PV.reduced ? 'auto' : 'smooth' });
  });
}
