/* ============================================================
   Proyectovisión · usuarios.js — página "Información importante para usuarios".
   Formato PQR: la página es estática (sin servidor), así que el formulario arma la solicitud
   y la abre en el correo del usuario (a proyectovisions.a.s@gmail.com) o en el WhatsApp
   de la oficina de su municipio. No guarda ni envía datos a ningún otro lado.
   Si faltan datos: arriba del formulario aparece qué falta (con un enlace a cada campo) y el foco va allí.
   Después de abrir el correo o WhatsApp: debajo de los botones queda escrito qué pasó y qué hacer si no se abrió.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.usuarios = {
  init: function (PV) {
    var form = document.getElementById('pqr-form');
    if (!form) return;
    var CORREO = 'proyectovisions.a.s@gmail.com';
    var error = document.getElementById('pqr-error');
    var estado = form.querySelector('.pqr__estado');
    var OBLIGATORIOS = ['tipo', 'municipio', 'nombre', 'documento', 'direccion', 'celular', 'detalle'];
    var via = 'correo';
    form.querySelectorAll('button[data-via]').forEach(function (b) {
      b.addEventListener('click', function () { via = b.getAttribute('data-via'); });
    });

    function valor(nombre) { var el = form.elements[nombre]; return el ? String(el.value || '').trim() : ''; }
    function campo(nombre) { return form.elements[nombre]; }
    // nombre visible del campo (el texto de su etiqueta, sin el asterisco)
    function etiqueta(el) {
      if (el.name === 'autorizo') return 'La autorización para tratar sus datos';
      var l = el.closest ? el.closest('label') : null;
      var t = l && l.querySelector('span');
      return t ? t.textContent.replace(/\s*\*\s*$/, '').trim() : el.name;
    }
    // lleva la vista al elemento (bajo la barra fija) y le pone el foco sin saltos
    function llevarA(el, destino) {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      if (PV.irA) PV.irA(destino || el); else (destino || el).scrollIntoView({ block: 'center' });
    }
    // qué falta: campos obligatorios vacíos y la autorización sin marcar
    function faltantes() {
      var lista = OBLIGATORIOS.filter(function (n) { return !valor(n); }).map(campo).filter(Boolean);
      var aut = campo('autorizo');
      if (aut && !aut.checked) lista.push(aut);
      return lista;
    }
    function marcar(lista) {
      OBLIGATORIOS.concat('autorizo').forEach(function (n) { var el = campo(n); if (el) el.setAttribute('aria-invalid', lista.indexOf(el) >= 0 ? 'true' : 'false'); });
    }
    function pintarError(lista) {
      if (!error) return;
      var ul = error.querySelector('.pqr__error-lista');
      if (!ul) { ul = document.createElement('ul'); ul.className = 'pqr__error-lista'; error.appendChild(ul); }
      ul.textContent = '';
      lista.forEach(function (el) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + el.id;
        a.textContent = etiqueta(el);
        a.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation(); // app.js no debe moverse por su cuenta: aquí se enfoca el campo
          llevarA(el, el.closest('label') || el);
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      error.hidden = !lista.length;
    }
    // mientras corrige: el campo deja de marcarse en rojo y la lista de arriba se acorta
    function alCorregir() {
      if (!error || error.hidden) return;
      var lista = faltantes();
      marcar(lista);
      pintarError(lista);
    }
    form.addEventListener('input', alCorregir);
    form.addEventListener('change', alCorregir);

    // el correo con un punto de corte antes de la @ (en celular no se parte por la mitad de una palabra)
    function nodoCorreo() {
      var s = document.createElement('span');
      var i = CORREO.indexOf('@');
      s.appendChild(document.createTextNode(CORREO.slice(0, i)));
      s.appendChild(document.createElement('wbr'));
      s.appendChild(document.createTextNode(CORREO.slice(i)));
      return s;
    }
    // si el aviso queda debajo de la pantalla, se sube lo justo para verlo completo
    function aLaVista(el) {
      var extra = el.getBoundingClientRect().bottom - window.innerHeight + 16;
      if (extra <= 0) return;
      if (PV.lenis) PV.lenis.scrollTo(window.scrollY + extra, { duration: 0.6 });
      else window.scrollBy({ top: extra, behavior: PV.reduced ? 'auto' : 'smooth' });
    }
    // partes: textos y, donde va el correo, el valor CORREO
    var temporizador = 0;
    function avisar(partes) {
      if (!estado) return;
      clearTimeout(temporizador);
      estado.textContent = '';
      estado.hidden = false;
      // la región de estado ya está a la vista cuando cambia el texto: así los lectores de pantalla la anuncian
      temporizador = setTimeout(function () {
        partes.forEach(function (p) { estado.appendChild(p === CORREO ? nodoCorreo() : document.createTextNode(p)); });
        aLaVista(estado);
      }, 60);
    }

    // el formulario ya responde: se esconde la nota «Si al tocar los botones no pasa nada…» (css/usuarios.css)
    form.classList.add('pqr--lista');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (e.submitter && e.submitter.getAttribute('data-via')) via = e.submitter.getAttribute('data-via');
      var lista = faltantes();
      marcar(lista);
      if (lista.length) {
        clearTimeout(temporizador);
        if (estado) { estado.hidden = true; estado.textContent = ''; }
        pintarError(lista);
        if (error) llevarA(error); else if (lista[0].focus) lista[0].focus();
        return;
      }
      pintarError([]);
      var sel = form.elements.municipio;
      var opcion = sel.options[sel.selectedIndex];
      var municipio = opcion ? opcion.textContent.trim() : '';
      var texto = [
        'Tipo de solicitud: ' + valor('tipo'),
        'Municipio: ' + municipio,
        'Titular del servicio: ' + valor('nombre'),
        'Documento: ' + valor('documento'),
        'Dirección del servicio: ' + valor('direccion'),
        'Celular: ' + valor('celular'),
        'Correo para la respuesta: ' + (valor('correo') || '(no indicado)'),
        '',
        'Solicitud:',
        valor('detalle'),
        '',
        'Autorizo el tratamiento de mis datos para atender esta solicitud.'
      ].join('\n');
      if (via === 'whatsapp') {
        var wa = opcion ? opcion.getAttribute('data-wa') : '';
        if (!wa) { pintarError([sel]); if (error) llevarA(error); return; }
        window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent('PQR - Proyectovisión\n' + texto), '_blank', 'noopener');
        avisar(['Le abrimos WhatsApp con su solicitud para la oficina de ' + municipio + ': toque «Enviar» para que nos llegue. Si no se abrió, escríbanos al correo ', CORREO, '.']);
      } else {
        var asunto = 'PQR - ' + valor('tipo') + ' - ' + valor('nombre');
        window.location.href = 'mailto:' + CORREO + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(texto);
        avisar(['Le abrimos su aplicación de correo con la solicitud lista para enviar a ', CORREO, ': revísela y toque «Enviar». Si no se abrió, toque «Enviar por WhatsApp» o escriba directamente a ese correo.']);
      }
    });
  }
};
