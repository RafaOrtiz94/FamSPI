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

module.exports = { securePdfForm };
