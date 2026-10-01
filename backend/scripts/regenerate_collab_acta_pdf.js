#!/usr/bin/env node
/**
 * regenerate_collab_acta_pdf.js
 * Fuerza la regeneracion del PDF de una acta de collab-deliveries (entrega de
 * herramientas/ropa/EPP a colaboradores) y sube el nuevo PDF a Drive,
 * reemplazando el pdf_drive_file_id guardado.
 *
 * Necesario porque downloadActaPdf solo regenera si el acta NUNCA tuvo un
 * PDF (pdf_drive_file_id vacio) -- una vez generado, siempre sirve la copia
 * guardada, aunque el codigo de la plantilla (estilos, negrita, etc.) haya
 * cambiado despues.
 *
 * Uso:
 *   node scripts/regenerate_collab_acta_pdf.js --id=29
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const service = require("../src/modules/collab-deliveries/collabDeliveries.service");

const idArg = process.argv.find((a) => a.startsWith("--id="));
const actaId = idArg ? Number(idArg.split("=")[1]) : null;

async function run() {
  if (!Number.isFinite(actaId) || actaId <= 0) {
    console.error("[REGEN-ACTA] Uso: node scripts/regenerate_collab_acta_pdf.js --id=<actaId>");
    process.exit(1);
  }

  const result = await service.generateAndStoreActaPdf(actaId);
  console.log("[REGEN-ACTA]", result);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[REGEN-ACTA] Error:", err);
    process.exit(1);
  });
