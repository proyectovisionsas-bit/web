/* ============================================================
   Proyectovisión · velocidad.js — "¿Cuántos megas necesita?"
   Cálculo: 5 de base + megas por uso + 2 por cada persona adicional, redondeado al plan más chico que lo cubra en el
   municipio elegido. (B2, 19-11-2026: CRIT-08) Esos valores no están aprobados en datos.json: la página ya no los muestra
   como hechos (ni «+N» en los usos ni la suma); el resultado se presenta como una sugerencia aproximada y siempre ofrece
   hablar con la oficina. Los números del velocímetro crecen en pantallas angostas para no quedar por debajo de 15 px.
   Velocímetro SVG: arco luminoso (stroke-dashoffset) con halos sin filtros, punto y aguja, número animado,
   barrido de arranque, pulso de luz por la pista (en su propio SVG; 3 vueltas al encender, 1 por cambio, nunca infinito).
   Respeta PV.reduced y funciona sin GSAP.
   Primer paso: elegir la oficina (botones de opción). Sin oficina elegida, la tarjeta pide elegirla y el velocímetro usa
   la escala de todas las oficinas. Comparte el municipio con "planes": localStorage['pv-municipio'] + evento 'pv:municipio';
   publica el plan recomendado: localStorage['pv-plan'] + evento 'pv:plan' ({ megas, municipio }).
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.velocidad = {
  init: function (PV) {
    var sec = document.getElementById('velocidad');
    if (!sec) return;
    var q = function (s, r) { return (r || sec).querySelector(s); };
    var qa = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };
    var gs = window.gsap || null;
    var quieto = !!PV.reduced || !gs; // sin movimiento: todo se pinta directo en su sitio

    /* ---------- datos: copia de copy.json.planes embebida en el partial ---------- */
    var datos = null;
    try { datos = JSON.parse(document.getElementById('velocidad-datos').textContent); } catch (e) { datos = null; }
    if ((!datos || !datos.municipios) && PV.copy && PV.copy.planes) datos = PV.copy.planes;
    if (!datos || !datos.municipios || !datos.municipios.length) return;
    var municipios = datos.municipios;
    // municipio con lista de precios confirmada: sus planes; sin lista: la escala de referencia (solo megas, el valor lo confirma la oficina)
    var escala = (datos.escala && datos.escala.length ? datos.escala : [15, 50, 100, 150, 300, 500]).slice().sort(function (a, b) { return a - b; });
    municipios.forEach(function (m) {
      m.planes = (m.planes || []).slice().sort(function (a, b) { return a.megas - b.megas; });
      m.conLista = !!(m.confirmado && m.planes.length);
      if (!m.conLista) m.planes = escala.map(function (x) { return { megas: x, precio: '', para: '' }; });
    });
    // sin oficina elegida: las velocidades de todas las oficinas juntas (sin precio)
    var refPlanes = (function () {
      var vistos = {}, l = [];
      municipios.forEach(function (m) { m.planes.forEach(function (p) { if (!vistos[p.megas]) { vistos[p.megas] = 1; l.push({ megas: p.megas, precio: '', para: '' }); } }); });
      return l.length ? l.sort(function (a, b) { return a.megas - b.megas; }) : escala.map(function (x) { return { megas: x, precio: '', para: '' }; });
    })();

    var sinjs = q('.velocidad__sinjs');
    if (sinjs) sinjs.hidden = true;

    /* ---------- elementos ---------- */
    var chips = qa('.velocidad__chip');
    var rango = q('.velocidad__rango');
    var salidaNum = q('.velocidad__personas-valor b');
    var salidaTxt = q('.velocidad__personas-valor span');
    var escala = qa('.velocidad__escala span');
    var formula = q('.velocidad__formula');
    var svg = q('.velocidad__svg');
    var pista = q('.velocidad__pista'), arco = q('.velocidad__arco'), halos = qa('.velocidad__arco-halo'), halosG = q('.velocidad__halos');
    var pulso = q('.velocidad__pulso'), pulsoSvg = q('.velocidad__svg--pulso');
    var ticks = q('.velocidad__ticks'), aguja = q('.velocidad__aguja'), punto = q('.velocidad__punto'), puntoGlow = q('.velocidad__punto-glow'), onda = q('.velocidad__onda');
    var lectura = q('.velocidad__lectura'), cifraNum = q('.velocidad__cifra-num'), cifraNota = q('.velocidad__cifra-nota');
    var radios = qa('.velocidad__oficina-radio');
    var planSede = q('.velocidad__plan-sede'), planCambiar = q('.velocidad__plan-cambiar'), planTitulo = q('.velocidad__plan-titulo');
    var planTv = q('.velocidad__plan-tv'), planTvNombre = q('.velocidad__plan-tv-nombre');
    var planCuerpo = q('.velocidad__plan-cuerpo'), planMegas = q('.velocidad__plan-megas-num'), planPrecio = q('.velocidad__plan-precio-num');
    var planPara = q('.velocidad__plan-para'), planRef = q('.velocidad__plan-ref'), planCta = q('.velocidad__plan-cta'), planPrecioMes = q('.velocidad__plan-precio-mes');
    var asesor = q('.velocidad__asesor');
    var medidor = q('.velocidad__medidor');
    if (!svg || !arco || !pista || !rango || !ticks || !aguja || !punto || !cifraNum) return;

    /* ---------- reglas del cálculo ---------- */
    var BASE = 5, POR_PERSONA = 2;

    /* ---------- geometría del velocímetro (igual que en el partial) ---------- */
    var CX = 200, CY = 206, R = 150, A0 = 150, SWEEP = 240, MARG = 0.04;
    function xy(t, r) { var a = (A0 + t * SWEEP) * Math.PI / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
    function posTick(i, n) { return n > 1 ? MARG + (i / (n - 1)) * (1 - 2 * MARG) : 0.5; }
    // los planes van a espacios iguales por el arco; entre dos planes se interpola la necesidad
    function posNecesidad(need, planes) {
      var n = planes.length;
      if (need <= planes[0].megas) return posTick(0, n);
      if (need >= planes[n - 1].megas) return posTick(n - 1, n);
      for (var i = 0; i < n - 1; i++) {
        var a = planes[i].megas, b = planes[n > i + 1 ? i + 1 : i].megas;
        if (need >= a && need < b) return posTick(i, n) + ((need - a) / (b - a)) * (posTick(i + 1, n) - posTick(i, n));
      }
      return posTick(n - 1, n);
    }

    // los números van dentro del SVG (viewBox de 448 de ancho): en un celular angosto 19 unidades se veían de 7 a 14 px.
    // Se agrandan según el ancho real del SVG (hasta 40 unidades) para que en pantalla midan al menos ~15,5 px.
    function tamanoTicks() {
      var w = svg.getBoundingClientRect().width;
      if (!w) return;
      var u = Math.min(42, Math.max(19, 15.6 / (w / 448)));
      ticks.style.setProperty('--velocidad-tick', u.toFixed(1) + 'px');
      dentroTicks();
    }
    // con números grandes, los de los extremos ("300", "500") se correrían fuera del SVG y el marco los recortaría:
    // se mueven hacia adentro lo justo para quedar dentro del viewBox (−24…424 × 0…318)
    var VB = { x0: -22, x1: 422, y0: 2, y1: 316 };
    function dentroTicks() {
      qa('.velocidad__tick text').forEach(function (t) {
        if (!t.hasAttribute('data-x')) { t.setAttribute('data-x', t.getAttribute('x')); t.setAttribute('data-y', t.getAttribute('y')); }
        var x = +t.getAttribute('data-x'), y = +t.getAttribute('data-y');
        t.setAttribute('x', x); t.setAttribute('y', y);
        var b;
        try { b = t.getBBox(); } catch (e) { return; }
        if (!b || !b.width) return;
        var dx = 0, dy = 0;
        if (b.x + b.width > VB.x1) dx = VB.x1 - (b.x + b.width);
        else if (b.x < VB.x0) dx = VB.x0 - b.x;
        if (b.y < VB.y0) dy = VB.y0 - b.y;
        else if (b.y + b.height > VB.y1) dy = VB.y1 - (b.y + b.height);
        if (dx || dy) { t.setAttribute('x', (x + dx).toFixed(1)); t.setAttribute('y', (y + dy).toFixed(1)); }
      });
    }
    var NS = 'http://www.w3.org/2000/svg';
    function crear(nombre, attrs) { var e = document.createElementNS(NS, nombre); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
    function pintarTicks(planes) {
      while (ticks.firstChild) ticks.removeChild(ticks.firstChild);
      planes.forEach(function (p, i) {
        var t = posTick(i, planes.length);
        var g = crear('g', { 'class': 'velocidad__tick', 'data-megas': p.megas });
        var p1 = xy(t, R + 14), p2 = xy(t, R + 24), p3 = xy(t, R + 46);
        var seg = { x1: p1.x.toFixed(1), y1: p1.y.toFixed(1), x2: p2.x.toFixed(1), y2: p2.y.toFixed(1) };
        // halo del tick del plan: una línea más ancha y tenue debajo (sin drop-shadow dentro del SVG)
        seg['class'] = 'velocidad__tick-halo'; g.appendChild(crear('line', seg));
        seg['class'] = 'velocidad__tick-linea'; g.appendChild(crear('line', seg));
        var c = Math.cos((A0 + t * SWEEP) * Math.PI / 180);
        var tx = crear('text', { x: p3.x.toFixed(1), y: p3.y.toFixed(1), 'text-anchor': c < -0.3 ? 'end' : c > 0.3 ? 'start' : 'middle', 'dominant-baseline': 'middle' });
        tx.textContent = p.megas;
        g.appendChild(tx);
        ticks.appendChild(g);
      });
      dentroTicks();
    }

    var estado = { t: 0, num: 0 };
    function f(v) { return v.toFixed(2); }
    function pintar(t) {
      var tt = Math.max(0, Math.min(1, t));
      var off = String(1 - tt);
      arco.setAttribute('stroke-dashoffset', off);
      for (var i = 0; i < halos.length; i++) halos[i].setAttribute('stroke-dashoffset', off);
      var a = xy(tt, R - 24), b = xy(tt, R + 12), p = xy(tt, R);
      aguja.setAttribute('x1', f(a.x)); aguja.setAttribute('y1', f(a.y)); aguja.setAttribute('x2', f(b.x)); aguja.setAttribute('y2', f(b.y));
      punto.setAttribute('cx', f(p.x)); punto.setAttribute('cy', f(p.y));
      if (puntoGlow) { puntoGlow.setAttribute('cx', f(p.x)); puntoGlow.setAttribute('cy', f(p.y)); }
      if (onda) { onda.setAttribute('cx', f(p.x)); onda.setAttribute('cy', f(p.y)); }
    }
    function mostrarIndicador() { aguja.style.opacity = '1'; punto.style.opacity = '1'; if (puntoGlow) puntoGlow.style.opacity = '0.85'; if (halosG) halosG.style.opacity = '1'; }

    /* ---------- municipio compartido con "planes" ---------- */
    function existe(k) { return !!k && municipios.some(function (m) { return m.clave === k; }); }
    function leerClave() {
      var k = null;
      try { k = localStorage.getItem('pv-municipio'); } catch (e) { k = null; }
      return existe(k) ? k : null; // primera visita: ninguna oficina elegida
    }
    var clave = leerClave();
    function municipio() { for (var i = 0; i < municipios.length; i++) if (municipios[i].clave === clave) return municipios[i]; return null; }
    function planesActuales() { var m = municipio(); return m ? m.planes : refPlanes; }
    function marcarRadios() { radios.forEach(function (r) { r.checked = r.value === clave; }); sec.classList.toggle('con-oficina', !!clave); }
    function fijarClave(k, propagar) {
      if (!existe(k) || k === clave) { marcarRadios(); return; }
      clave = k;
      marcarRadios();
      pintarTicks(planesActuales());
      if (propagar) {
        try { localStorage.setItem('pv-municipio', clave); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('pv:municipio', { detail: { clave: clave, origen: 'velocidad' } })); } catch (e) {}
      }
      actualizar();
    }

    /* ---------- cálculo ---------- */
    function calcular() {
      var m = municipio(), planes = m ? m.planes : refPlanes;
      var usos = chips.filter(function (ch) { return ch.getAttribute('aria-pressed') === 'true'; })
        .map(function (ch) { return { nombre: ch.getAttribute('data-nombre') || ch.textContent.trim(), megas: +ch.getAttribute('data-megas') || 0 }; });
      var personas = Math.max(1, +rango.value || 1), extra = personas - 1;
      var need = BASE + extra * POR_PERSONA + usos.reduce(function (s, u) { return s + u.megas; }, 0);
      var plan = null;
      for (var i = 0; i < planes.length; i++) if (planes[i].megas >= need) { plan = planes[i]; break; }
      var tope = false;
      if (!plan) { plan = planes[planes.length - 1]; tope = true; }
      return { need: need, usos: usos, personas: personas, extra: extra, plan: plan, tope: tope, planes: planes, t: posNecesidad(need, planes), municipio: m };
    }
    // lo que la persona marcó, en palabras (sin las cifras internas del cálculo)
    function marcado(c) {
      var partes = c.usos.map(function (u) { return u.nombre; });
      partes.push(c.personas + (c.personas === 1 ? ' persona' : ' personas'));
      return partes.join(', ');
    }
    function textoFormula(c) {
      var s = 'Según lo que marcó (' + marcado(c) + '), ';
      if (!c.municipio) return 'Según lo que marcó: ' + marcado(c) + '.';
      var guia = '';
      if (!c.municipio.conLista) return s + (c.tope ? 'le sugerimos un plan a la medida o internet dedicado en ' + c.municipio.nombre + '.' : 'le sugerimos un plan de ' + c.plan.megas + ' megas o más en ' + c.municipio.nombre + '.') + guia;
      if (c.tope) s += 'le sugerimos hablar con la oficina de ' + c.municipio.nombre + ': para más de ' + c.plan.megas + ' megas le ofrecemos un plan a la medida.';
      else s += 'le sugerimos el plan de ' + c.plan.megas + ' megas en ' + c.municipio.nombre + '.' + guia;
      if (c.plan.tv) s += ' En ' + c.municipio.nombre + ' los planes incluyen TV ' + c.plan.tv + '.';
      return s;
    }

    /* ---------- tarjeta del plan ---------- */
    var ultimoPlan = null, ultimaClave = null;
    // la calculadora solo publica su recomendación (localStorage + evento) cuando el visitante la ha tocado;
    // así la rejilla de planes no arranca marcando el plan más chico
    var tocado = false;
    ['pointerdown', 'keydown', 'input', 'change'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { if (!tocado && e.target && e.target.closest && e.target.closest('#velocidad')) tocado = true; }, { passive: true, capture: true });
    });
    var ctaTexto = planCta ? planCta.querySelector('span') : null;
    function pintarPlan(c) {
      var p = c.plan, m = c.municipio;
      var cambio = ultimoPlan !== p.megas || ultimaClave !== (m ? m.clave : '');
      if (planTitulo) planTitulo.textContent = m ? 'Plan sugerido en' : 'Velocidad sugerida';
      if (cifraNota) cifraNota.textContent = m ? 'plan sugerido' : 'según lo que marcó';
      ponerAsesor(m);
      if (planSede) { planSede.textContent = m ? m.nombre : ''; planSede.hidden = !m; }
      if (planCambiar) planCambiar.hidden = !m;
      if (planMegas) planMegas.textContent = p.megas;
      if (planTv) planTv.hidden = !(m && p.tv);
      if (planTvNombre) planTvNombre.textContent = (m && p.tv) || '';
      if (!m) {
        if (planPrecio) planPrecio.textContent = '—';
        if (planPrecioMes) planPrecioMes.hidden = true;
        if (planPara) planPara.textContent = 'Elija su oficina para ver el plan sugerido y su valor mensual.';
        if (planRef) planRef.hidden = true;
        if (planCta) {
          planCta.href = '#velocidad-oficinas';
          planCta.removeAttribute('target');
          planCta.removeAttribute('aria-label'); // el texto visible ya dice lo que hace
          if (ctaTexto) ctaTexto.textContent = 'Elija primero su oficina';
        }
        ultimoPlan = p.megas; ultimaClave = '';
        return;
      }
      if (planPrecio) planPrecio.textContent = m.conLista ? p.precio : 'A la medida';
      if (planPrecioMes) planPrecioMes.hidden = !m.conLista;
      if (planPara) planPara.textContent = m.conLista ? (p.para || '') : 'Le enviamos por WhatsApp los planes y tarifas vigentes en ' + m.nombre + '.';
      if (planRef) planRef.hidden = true;
      if (planCta) {
        var nombre = p.megas + ' megas' + (p.tv ? ' + TV ' + p.tv : '');
        var texto = 'Buen día, quiero solicitar el plan de ' + nombre + ' en ' + m.nombre + (m.conLista ? ' (' + p.precio + ' al mes)' : '') + '.';
        planCta.href = 'https://wa.me/' + m.wa + '?text=' + encodeURIComponent(texto);
        planCta.setAttribute('target', '_blank');
        planCta.setAttribute('aria-label', 'Solicitar este plan por WhatsApp: ' + nombre + ' en ' + m.nombre); // empieza por el texto visible
        if (ctaTexto) ctaTexto.textContent = 'Solicitar este plan por WhatsApp';
      }
      if (cambio) {
        if (!quieto && entro && planCuerpo) gs.fromTo(planCuerpo, { y: 10, opacity: 0.45 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', overwrite: true });
        if (tocado) {
          try { localStorage.setItem('pv-plan', String(p.megas)); } catch (e) {}
          try { document.dispatchEvent(new CustomEvent('pv:plan', { detail: { megas: p.megas, municipio: m.clave, origen: 'velocidad' } })); } catch (e) {}
        }
      }
      ultimoPlan = p.megas; ultimaClave = m.clave;
    }

    /* ---------- «hable con su oficina»: sin oficina abre la ventana para elegirla; con oficina, su WhatsApp ---------- */
    function ponerAsesor(m) {
      if (!asesor) return;
      if (!m) {
        asesor.href = 'oficinas.html';
        asesor.setAttribute('data-elegir-oficina', 'Buen día, quiero asesoría para elegir mi plan de internet');
        asesor.removeAttribute('target'); asesor.removeAttribute('rel');
        asesor.textContent = 'hable con su oficina';
        return;
      }
      asesor.removeAttribute('data-elegir-oficina');
      asesor.href = 'https://wa.me/' + m.wa + '?text=' + encodeURIComponent('Buen día, quiero asesoría para elegir mi plan de internet en ' + m.nombre + '.');
      asesor.setAttribute('target', '_blank'); asesor.setAttribute('rel', 'noopener');
      asesor.textContent = 'hable con la oficina de ' + m.nombre;
    }

    /* ---------- pulso de luz que recorre la pista: 3 vueltas al encender, 1 al cambiar el plan o al volver a verse; nunca infinito.
       Corre en su propio SVG (capa propia mientras está vivo), así no obliga a repintar el fondo ni los halos en cada cuadro. ---------- */
    var pulsoTween = null, visible = false, encendido = false;
    function lanzarPulso(vueltas) {
      if (quieto || !visible || !encendido || !pulso || pulsoTween || document.hidden) return;
      if (pulsoSvg) pulsoSvg.classList.add('is-viva');
      pulsoTween = gs.fromTo(pulso, { attr: { 'stroke-dashoffset': 0.09 } }, { attr: { 'stroke-dashoffset': -1 }, duration: 2.4, ease: 'power1.inOut', repeat: Math.max(0, (vueltas || 1) - 1), repeatDelay: 1.1, onComplete: pararPulso });
    }
    function pararPulso() {
      if (pulsoTween) { pulsoTween.kill(); pulsoTween = null; }
      if (pulso) pulso.setAttribute('stroke-dashoffset', '0.09');
      if (pulsoSvg) pulsoSvg.classList.remove('is-viva');
    }
    if (medidor && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var antes = visible;
        visible = en[en.length - 1].isIntersecting;
        if (!visible) pararPulso();
        else if (!antes && encendido) lanzarPulso(1);
      }, { threshold: 0.15 }).observe(medidor);
    } else visible = true;
    document.addEventListener('visibilitychange', function () { if (document.hidden) pararPulso(); });

    /* ---------- actualización general ---------- */
    var entro = false;
    function ondear() {
      if (quieto || !onda) return;
      gs.fromTo(onda, { attr: { r: 8 }, opacity: 0.9 }, { attr: { r: 44 }, opacity: 0, duration: 0.9, ease: 'power2.out', overwrite: true });
    }
    function escribirCifra() { cifraNum.textContent = Math.round(estado.num); }
    function fijarCifra(v) { estado.num = v; escribirCifra(); } // valor exacto al terminar: nunca queda un número que no sea el del plan
    function actualizar() {
      var c = calcular();
      if (formula) formula.textContent = textoFormula(c);
      qa('.velocidad__tick').forEach(function (g) { g.classList.toggle('is-plan', +g.getAttribute('data-megas') === c.plan.megas); });
      pintarPlan(c);
      if (!entro) return; // la entrada pinta el estado actual al llegar a pantalla
      if (quieto) { estado.t = c.t; estado.num = c.plan.megas; pintar(c.t); escribirCifra(); return; }
      gs.to(estado, { t: c.t, duration: 0.9, ease: 'power3.out', overwrite: 'auto', onUpdate: function () { pintar(estado.t); } });
      if (Math.round(estado.num) !== c.plan.megas) {
        var megas = c.plan.megas;
        gs.to(estado, { num: megas, duration: 0.6, ease: 'power2.out', snap: { num: 1 }, overwrite: 'auto', onUpdate: escribirCifra, onComplete: function () { fijarCifra(megas); } });
        gs.fromTo(cifraNum, { scale: 1.08 }, { scale: 1, duration: 0.55, ease: 'power3.out', overwrite: true });
        ondear();
        lanzarPulso(1); // la luz recorre la pista una vez: los datos nuevos llegan
      }
    }

    /* ---------- entrada: barrido de arranque (como un tablero al encender) y luego el valor real ---------- */
    function entrar() {
      if (entro) return;
      entro = true;
      var c = calcular();
      if (quieto) {
        pista.setAttribute('stroke-dashoffset', '0');
        mostrarIndicador();
        estado.t = c.t; fijarCifra(c.plan.megas);
        pintar(c.t);
        encendido = true;
        return;
      }
      // los valores finales se leen cuando ese tramo arranca (si el visitante toca algo durante el barrido, se respeta).
      // La lectura está oculta desde el arranque y se enciende a 1,3 s, así no se ve el salto del número a 0.
      // El contador dura 0,7 s con snap y escribe el valor exacto al terminar: a los 2,2 s ya marca el plan.
      estado.num = 0; escribirCifra();
      var tl = gs.timeline({ onComplete: function () { encendido = true; lanzarPulso(3); } });
      tl.to(pista, { attr: { 'stroke-dashoffset': 0 }, duration: 1.1, ease: 'power2.inOut' }, 0)
        .fromTo(qa('.velocidad__tick'), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out' }, 0.3)
        .to([aguja, punto, halosG].filter(Boolean), { opacity: 1, duration: 0.35 }, 0.55)
        .to(estado, { t: 1, duration: 0.9, ease: 'power2.inOut', onUpdate: function () { pintar(estado.t); } }, 0.6)
        .to(estado, { t: function () { return calcular().t; }, duration: 0.95, ease: 'power3.out', onUpdate: function () { pintar(estado.t); } }, 1.55)
        .to(estado, { num: function () { return calcular().plan.megas; }, duration: 0.7, ease: 'power2.out', snap: { num: 1 }, onUpdate: escribirCifra, onComplete: function () { fijarCifra(calcular().plan.megas); } }, 1.5)
        .add(ondear, 2.3);
      if (puntoGlow) tl.to(puntoGlow, { opacity: 0.85, duration: 0.35 }, 0.55);
      if (lectura) tl.to(lectura, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.3);
    }

    /* ---------- controles ---------- */
    chips.forEach(function (ch) {
      ch.addEventListener('click', function () {
        ch.setAttribute('aria-pressed', ch.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        actualizar();
      });
    });
    function pintarRango() {
      var v = +rango.value, min = +rango.min || 1, max = +rango.max || 8;
      var p = (v - min) / (max - min);
      rango.style.setProperty('--p', 'calc(14px + (100% - 28px) * ' + p.toFixed(4) + ')');
      if (salidaNum) salidaNum.textContent = v;
      if (salidaTxt) salidaTxt.textContent = v === 1 ? 'persona' : 'personas';
      rango.setAttribute('aria-valuetext', v + (v === 1 ? ' persona' : ' personas'));
      escala.forEach(function (b) { var bv = +b.getAttribute('data-v'); b.classList.toggle('is-activo', bv === v); b.classList.toggle('is-pasado', bv < v); });
    }
    rango.addEventListener('input', function () { pintarRango(); actualizar(); });
    radios.forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) fijarClave(r.value, true); });
    });
    // "Elija primero su oficina" / "Cambiar oficina": el desplazamiento lo hace app.js (anclas #); aquí solo el foco en la opción
    sec.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#velocidad-oficinas"]');
      if (!a) return;
      var r = radios.filter(function (x) { return x.checked; })[0] || radios[0];
      if (r) setTimeout(function () { try { r.focus({ preventScroll: true }); } catch (err) { r.focus(); } }, PV.reduced ? 60 : 1000);
    });
    document.addEventListener('pv:municipio', function (e) {
      var d = e.detail;
      if (d && typeof d === 'object' && d.origen === 'velocidad') return;
      var k = typeof d === 'string' ? d : (d && (d.clave || d.municipio || d.id || d.valor));
      if (!existe(k)) k = leerClave();
      fijarClave(k, false);
    });
    window.addEventListener('storage', function (e) { if (e.key === 'pv-municipio' && existe(e.newValue)) fijarClave(e.newValue, false); });

    /* ---------- arranque ---------- */
    marcarRadios();
    tamanoTicks();
    if ('ResizeObserver' in window) new ResizeObserver(function () { tamanoTicks(); }).observe(svg);
    else window.addEventListener('resize', tamanoTicks, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(dentroTicks); // el ancho de los números depende de la fuente
    pintarTicks(planesActuales());
    pintarRango();
    pintar(0);
    actualizar();
    if (!quieto && lectura) gs.set(lectura, { opacity: 0 }); // se enciende en la entrada (con movimiento reducido o sin GSAP nunca se oculta)
    if (quieto || !window.ScrollTrigger) {
      if (quieto) entrar();
      else if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { entrar(); io.disconnect(); } }, { threshold: 0.35 }); io.observe(medidor || svg); }
      else entrar();
    } else {
      ScrollTrigger.create({ trigger: medidor || svg, start: 'top 78%', once: true, onEnter: entrar });
    }
    PV.velocidad = {
      recalcular: actualizar,
      municipio: function () { return clave; },
      estado: function () { return { entro: entro, encendido: encendido, visible: visible, pulsoCorriendo: !!pulsoTween, megas: Math.round(estado.num) }; } // para depurar y para las capturas
    };
  }
};
