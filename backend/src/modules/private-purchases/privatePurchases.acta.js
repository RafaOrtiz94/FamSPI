const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const TEMPLATE_PATH = path.join(
  __dirname,
  "../../data/plantillas/F.ST-10_V04_ACTA DE ENTREGA.pdf"
);

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-EC");
};

const safeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const setTextField = (form, fieldName, value) => {
  try {
    form.getTextField(fieldName).setText(safeText(value));
  } catch (error) {
    // Campos opcionales pueden no existir en la plantilla
  }
};

const fillEquipmentRows = (form, items = []) => {
  const rows = Array.isArray(items) ? items.slice(0, 7) : [];
  for (let i = 0; i < 7; i += 1) {
    const item = rows[i] || {};
    const index = i + 1;
    setTextField(form, `cod_equipo_${index}`, item.product_code || "");
    setTextField(form, `nom_equipo_${index}`, item.equipment_name || "");
    setTextField(form, `cant_equipo_${index}`, item.quantity || "");
    setTextField(form, `serie_equipo_${index}`, item.serial || "");
  }
};

const fillObservations = (form, observations = []) => {
  const lines = Array.isArray(observations) ? observations.slice(0, 3) : [];
  for (let i = 0; i < 3; i += 1) {
    setTextField(form, `ob_${i + 1}`, lines[i] || "");
  }
};

const generateDeliveryActPdf = async ({
  actaNumber,
  clientName,
  clientId,
  clientAddress,
  clientPhone,
  deliveryDate,
  dispatchItems,
  observations,
  dispatchedBy,
  dispatchedAt,
  deliveredBy,
  deliveredAt,
}) => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Plantilla de acta no encontrada: ${TEMPLATE_PATH}`);
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  setTextField(form, "num_acta", actaNumber);
  setTextField(form, "nom_cliente", clientName);
  setTextField(form, "ruc_cedula", clientId);
  setTextField(form, "dir", clientAddress);
  setTextField(form, "tel", clientPhone);
  setTextField(form, "fecha_entrega", formatDate(deliveryDate));

  fillEquipmentRows(form, dispatchItems);
  fillObservations(form, observations);

  setTextField(form, "des_por", dispatchedBy);
  setTextField(form, "fecha_des", formatDate(dispatchedAt));
  setTextField(form, "ent_por", deliveredBy);
  setTextField(form, "fecha_ent", formatDate(deliveredAt));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

module.exports = {
  generateDeliveryActPdf,
};
