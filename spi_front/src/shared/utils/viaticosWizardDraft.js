// Borrador local del Paso 1 (Facturas SRI) del wizard de viaticos.
//
// ponytail: solo cubre clasificacion (categoria/modo/seleccion) + referencia
// al documento de respaldo ya subido (documentId/documentLink/documentName)
// -- el archivo en si nunca vive en localStorage porque ya se subio al
// adjuntarlo (ver ViaticosWizard.handleAttachDocument). Si el navegador se
// cierra o la pestaña se recarga antes de pulsar "Cargar facturas", este
// borrador permite retomar sin re-subir el TXT ni las fotos de respaldo.
import { readPwaStorageData, removePwaStorage, writePwaStorage } from "../../core/pwa/storage";

const DRAFT_PREFIX = "viaticos_wizard_draft_";

const keyFor = (allowanceId) => `${DRAFT_PREFIX}${allowanceId}`;

export const saveStep1Draft = (allowanceId, { txtContent, invoiceRows, tripDateRange }) => {
  if (!allowanceId) return;
  writePwaStorage(
    keyFor(allowanceId),
    {
      txtContent,
      invoiceRows: (invoiceRows || []).map(({ file, ...rest }) => rest),
      tripDateRange: tripDateRange || null,
    },
    { namespace: "spi_pwa_drafts" }
  );
};

export const loadStep1Draft = (allowanceId) => {
  if (!allowanceId) return null;
  const parsed = readPwaStorageData(keyFor(allowanceId), { namespace: "spi_pwa_drafts" });
  if (!parsed?.data || !Array.isArray(parsed.data.invoiceRows) || !parsed.data.invoiceRows.length) return null;
  return {
    ...parsed.data,
    savedAt: parsed.savedAt,
  };
};

export const clearStep1Draft = (allowanceId) => {
  if (!allowanceId) return;
  removePwaStorage(keyFor(allowanceId), { namespace: "spi_pwa_drafts" });
};
