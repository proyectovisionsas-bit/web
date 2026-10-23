/* ============================================================
   Proyectovisión · pagos.js — sección "Paga tu factura" (#pagos).
   Solo agrega el botón "Copiar número de cuenta" cuando el navegador puede copiar.
   Sin JavaScript el número se lee y se selecciona igual.
   ============================================================ */
window.PV = window.PV || {}; PV.sections = PV.sections || {};
PV.sections.pagos = {
  init: function (PV) {
    var boton = PV.$('#pagos .pagos__copiar');
    if (!boton || !navigator.clipboard || !window.isSecureContext) return;
    boton.hidden = false;
    var original = boton.textContent;
    boton.addEventListener('click', function () {
      navigator.clipboard.writeText(boton.getAttribute('data-copiar')).then(function () {
        boton.textContent = 'Número copiado';
        setTimeout(function () { boton.textContent = original; }, 2200);
      }, function () { boton.hidden = true; });
    });
  }
};
