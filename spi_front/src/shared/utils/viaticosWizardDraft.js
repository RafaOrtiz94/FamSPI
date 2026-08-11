// Borrador local del Paso 1 (Facturas SRI) del wizard de viaticos.
//
// ponytail: solo cubre clasificacion (categoria/modo/seleccion) + referencia
// al documento de respaldo ya subido (documentId/documentLink/documentName)
// -- el archivo en si nunca vive en localStorage porque ya se subio al
// adjuntarlo (ver ViaticosWizard.handleAttachDocument). Si el navegador se
// cierra o la pestaña se recarga antes de pulsar "Cargar facturas", este
// borrador permite retomar sin re-subir el TXT ni las fotos de respaldo.
const DRAFT_PREFIX = "spi_viaticos_wizard_draft_";

const keyFor = (allowanceId) => `${DRAFT_PREFIX}${allowanceId}`;

export const saveStep1Draft = (allowanceId, { txtContent, invoiceRows, tripDateRange }) => {
  if (!allowanceId) return;
  try {
    localStorage.setItem(
      keyFor(allowanceId),
      JSON.stringify({
        txtContent,
        invoiceRows: (invoiceRows || []).map(({ file, ...rest }) => rest),
        tripDateRange: tripDateRange || null,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // localStorage lleno o no disponible -- el borrador es una comodidad,
    // no un requisito para poder declarar.
  }
};

export const loadStep1Draft = (allowanceId) => {
  if (!allowanceId) return null;
  try {
    const raw = localStorage.getItem(keyFor(allowanceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.invoiceRows) || !parsed.invoiceRows.length) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearStep1Draft = (allowanceId) => {
  if (!allowanceId) return;
  try {
    localStorage.removeItem(keyFor(allowanceId));
  } catch {
    // no-op
  }
};
