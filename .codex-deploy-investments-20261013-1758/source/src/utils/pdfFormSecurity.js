// Algunos campos de plantillas PDF no traen /DA (default appearance), y
// pdf-lib no puede fijar el tamaño de fuente in-place sobre un DA que no
// existe (regex de reemplazo sobre el DA actual). Sin tamaño explicito el
// campo se renderiza con auto-size, mucho mas grande que el resto (bug real
// observado en el campo "cliente" de F.ST-20). Este helper sintetiza un /DA
// valido desde cero cuando falta: el nombre de fuente ("Helv") es solo un
// token, pdf-lib no lo resuelve contra recursos reales al hornear la
// apariencia via updateAppearances(font) -- solo importa el tamaño numerico.
function setFieldFontSizeSafe(field, fontSize) {
  if (typeof field?.setFontSize !== "function") return;
  try {
    field.setFontSize(fontSize);
  } catch (_err) {
    try {
      field.acroField.setDefaultAppearance(`/Helv ${fontSize} Tf 0 g`);
    } catch (_fallbackErr) {
      // Sin remedio; el campo quedara con su tamaño por defecto.
    }
  }
}

function securePdfForm(form) {
  if (!form) return;
  try {
    const fields = form.getFields();
    for (const field of fields) {
      try {
        if (typeof field.enableReadOnly === "function") field.enableReadOnly();
      } catch (_) {
        // Ignore unsupported field types.
      }
    }
    // Converts interactive form controls into static PDF content.
    form.flatten();
  } catch (error) {
    console.warn("No se pudo asegurar formulario PDF:", error.message);
  }
}

module.exports = { securePdfForm, setFieldFontSizeSafe };
