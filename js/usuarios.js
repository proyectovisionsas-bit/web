/* ============================================================
   Proyectovisión · usuarios.js — página "Información importante para usuarios".
   Formato PQR: la página es estática (sin servidor), así que el formulario arma la solicitud
   y la abre en el correo del usuario (a proyectovisions.a.s@gmail.com) o en el WhatsApp
   de la oficina de su municipio. No guarda ni envía datos a ningún otro lado.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.usuarios = {
  init: function (PV) {
    var form = document.getElementById('pqr-form');
    if (!form) return;
    var CORREO = 'proyectovisions.a.s@gmail.com';
    var error = form.querySelector('.pqr__error');
    var via = 'correo';
    form.querySelectorAll('button[data-via]').forEach(function (b) {
      b.addEventListener('click', function () { via = b.getAttribute('data-via'); });
    });

    function valor(nombre) { var el = form.elements[nombre]; return el ? String(el.value || '').trim() : ''; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (e.submitter && e.submitter.getAttribute('data-via')) via = e.submitter.getAttribute('data-via');
      var obligatorios = ['tipo', 'municipio', 'nombre', 'documento', 'direccion', 'celular', 'detalle'];
      var faltan = obligatorios.filter(function (n) { return !valor(n); });
      var autorizo = form.elements.autorizo && form.elements.autorizo.checked;
      obligatorios.forEach(function (n) { var el = form.elements[n]; if (el) el.setAttribute('aria-invalid', faltan.indexOf(n) >= 0 ? 'true' : 'false'); });
      if (faltan.length || !autorizo) {
        if (error) error.hidden = false;
        var primero = faltan.length ? form.elements[faltan[0]] : form.elements.autorizo;
        if (primero && primero.focus) primero.focus();
        return;
      }
      if (error) error.hidden = true;
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
        if (!wa) { if (error) { error.textContent = 'Seleccione su municipio para enviarla por WhatsApp.'; error.hidden = false; } return; }
        window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent('PQR - Proyectovisión\n' + texto), '_blank', 'noopener');
      } else {
        var asunto = 'PQR - ' + valor('tipo') + ' - ' + valor('nombre');
        window.location.href = 'mailto:' + CORREO + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(texto);
      }
    });
  }
};
