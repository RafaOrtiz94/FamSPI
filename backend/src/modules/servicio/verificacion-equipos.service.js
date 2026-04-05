/**
 * src/modules/servicio/verificacion-equipos.service.js
 * ----------------------------------------------------
 * Genera F.ST-09, guarda en Drive y sincroniza el ciclo de verificacion
 * con los workflows de instalacion (compras publicas / privadas).
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const { securePdfForm } = require("../../utils/pdfFormSecurity");
const {
  normalizeInstallationWorkflowState,
  appendVerificationAttempt,
  enrichInstallationWorkflowWithGate,
  createInstallationWorkflowError,
} = require("./installationWorkflow.service");
const { trackFst09WorkflowDocument } = require("./fst14.service");

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "plantillas",
  "F.ST-09_V03_VERIFICACIÓN DE EQUIPOS NUEVOS.pdf",
);

let privateInstallationColumnsReady = false;
const ensurePrivateInstallationColumns = async () => {
  if (privateInstallationColumnsReady) return;
  await db.query(`
    ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS installation_workflow JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
  privateInstallationColumnsReady = true;
};

const toSafeObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const resolveVerificationInput = (raw = {}) => {
  const source = toSafeObject(raw);
  const analisis =
    source["ANÁLISIS"] ||
    source.ANALISIS ||
    source.analisis ||
    source.analysis ||
    "";
  const signature =
    source.firma_af_image ||
    source.frima_af_image ||
    source.signature ||
    "";
  const anexos = Array.isArray(source.anexos_af_image)
    ? source.anexos_af_image
    : Array.isArray(source.annexes)
      ? source.annexes
      : [];

  return {
    Fecha: source.Fecha || source.fecha || "",
    Cliente: source.Cliente || source.cliente || "",
    Equipo: source.Equipo || source.equipo || "",
    Serie: source.Serie || source.serie || "",
    RESULTADOS: source.RESULTADOS || source.resultados || "",
    ANALISIS: analisis,
    firma_af_image: signature,
    anexos_af_image: anexos,
    verification_result: String(
      source.verification_result ||
        source.verification_outcome ||
        source.resultado_verificacion ||
        source.result ||
        "",
    ).trim().toLowerCase(),
    criteria_reference:
      source.criteria_reference ||
      source.source_reference ||
      source.fuente_tecnica ||
      source.referencia_tecnica ||
      null,
    remediation_notes: source.remediation_notes || source.remediation_review_notes || null,
    source_type: source.source_type || source.sourceType || null,
    source_id: source.source_id || source.sourceId || null,
    request_id: source.request_id || source.requestId || null,
  };
};

const setFieldTextVariants = (form, fieldNames = [], value) => {
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  for (const fieldName of names) {
    try {
      const field = form.getField(fieldName);
      if (field && typeof field.setText === "function") {
        field.setText(value || "");
        return fieldName;
      }
    } catch (_error) {
      // Ignore: field may not exist in current template version.
    }
  }
  return null;
};

const downloadDriveImage = async (fileId) => {
  try {
    const response = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(response.data);
  } catch (error) {
    logger.warn({ error, fileId }, "No se pudo descargar imagen desde Drive");
    return null;
  }
};

const resolveImageBuffer = async (rawValue) => {
  const value = String(rawValue || "");
  if (!value) return null;
  if (value.startsWith("data:image")) {
    try {
      const base64Data = value.replace(/^data:image\/\w+;base64,/, "");
      return Buffer.from(base64Data, "base64");
    } catch (_error) {
      return null;
    }
  }
  return downloadDriveImage(value);
};

const resolveAnnexBuffers = async (annexValues = []) => {
  const values = toSafeArray(annexValues);
  const buffers = [];
  for (const value of values) {
    // eslint-disable-next-line no-await-in-loop
    const imageBuffer = await resolveImageBuffer(value);
    if (imageBuffer) buffers.push(imageBuffer);
  }
  return buffers;
};

const normalizeVerificationOutcome = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["failed", "falla", "no_conforme", "no-conforme", "error"].includes(normalized)) {
    return "failed";
  }
  return "passed";
};

const inferEquipmentName = (equipment = []) =>
  toSafeArray(equipment)
    .map((item) => item?.name || item?.label || item?.sku || item?.equipment_name)
    .filter(Boolean)
    .join(", ");

const generateEquipmentVerificationPDF = async (verificationPayload) => {
  const input = resolveVerificationInput(verificationPayload);
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const signatureBuffer = await resolveImageBuffer(input.firma_af_image);
  const annexBuffers = await resolveAnnexBuffers(input.anexos_af_image);

  setFieldTextVariants(form, ["Fecha"], input.Fecha || "");
  setFieldTextVariants(form, ["Cliente"], input.Cliente || "");
  setFieldTextVariants(form, ["Equipo"], input.Equipo || "");
  setFieldTextVariants(form, ["Serie"], input.Serie || "");
  setFieldTextVariants(form, ["RESULTADOS"], input.RESULTADOS || "");
  setFieldTextVariants(form, ["ANÁLISIS", "ANALISIS"], input.ANALISIS || "");

  if (signatureBuffer) {
    try {
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);
      const signatureFieldName = setFieldTextVariants(form, ["frima_af_image", "firma_af_image"], "");
      if (signatureFieldName) {
        const signatureField = form.getField(signatureFieldName);
        if (signatureField && typeof signatureField.setImage === "function") {
          signatureField.setImage(signatureImage);
        }
      }
    } catch (error) {
      logger.warn({ error }, "No se pudo incrustar firma en F.ST-09");
    }
  }

  // Anexos: como la plantilla actual no expone un control multipage formal,
  // registramos la cantidad en el campo correspondiente cuando exista.
  if (annexBuffers.length > 0) {
    setFieldTextVariants(form, ["anexos_af_image"], `Adjuntos: ${annexBuffers.length}`);
  }

  try {
    form.getFields().forEach((field) => {
      if (typeof field.updateAppearances === "function") field.updateAppearances(baseFont);
      if (typeof field.setFontSize === "function") field.setFontSize(10);
    });
  } catch (appearanceError) {
    logger.warn({ appearanceError }, "No se pudieron actualizar apariencias de F.ST-09");
  }

  securePdfForm(form);
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

const saveVerificationToDrive = async (pdfBuffer, input, user = null) => {
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error("DRIVE_ROOT_FOLDER_ID no configurado");
  }

  const servicioFolder = await ensureFolder("Servicio Técnico", rootFolderId);
  const verificationFolder = await ensureFolder("Verificación", servicioFolder.id);

  const timestamp = new Date().toISOString().slice(0, 10);
  const userName = String(user?.fullname || user?.name || user?.email || "Usuario")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .slice(0, 30);
  const safeClient = String(input.Cliente || "Cliente")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .slice(0, 30);
  const safeEquipment = String(input.Equipo || "Equipo")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .slice(0, 30);

  const recordFolderName = `${safeClient}-${safeEquipment}-${input.Serie || "SN"}-${timestamp}-${userName}`;
  const recordFolder = await ensureFolder(recordFolderName, verificationFolder.id);

  const fileName = `F.ST-09_Verificacion_Equipo_${safeEquipment || "Equipo"}_${timestamp}.pdf`;
  const stored = await uploadBase64File(
    fileName,
    pdfBuffer.toString("base64"),
    "application/pdf",
    recordFolder.id,
  );

  return {
    folderId: recordFolder.id,
    pdfFile: stored,
    images: [],
  };
};

const updatePublicPurchaseVerificationCycle = async ({
  sourceId,
  input,
  user,
  document,
}) => {
  const numericId = Number.parseInt(String(sourceId || ""), 10);
  if (!Number.isFinite(numericId)) {
    throw createInstallationWorkflowError("source_id invalido para compra publica", {
      status: 400,
      code: "WORKFLOW_SOURCE_INVALID",
    });
  }

  const { rows } = await db.query(
    `SELECT id, client_name, inspection_request_id, equipment, extra
       FROM equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [numericId],
  );
  if (!rows.length) {
    throw createInstallationWorkflowError("Compra publica no encontrada para registrar F.ST-09", {
      status: 404,
      code: "WORKFLOW_SOURCE_NOT_FOUND",
    });
  }

  const row = rows[0];
  const extra = toSafeObject(row.extra);
  const siteReady = Boolean(extra?.inspection_site?.ready_for_installation);
  const normalized = normalizeInstallationWorkflowState(extra.installation_workflow || {}, {
    equipment: row.equipment || [],
  });
  const withAttempt = appendVerificationAttempt({
    workflow: normalized,
    payload: {
      result: normalizeVerificationOutcome(input.verification_result),
      criteria_reference: input.criteria_reference,
      analysis: input.ANALISIS,
      notes: input.remediation_notes,
      request_id: input.request_id || row.inspection_request_id || null,
      remediation_notes: input.remediation_notes,
    },
    user,
    document,
  });
  const nextWorkflow = enrichInstallationWorkflowWithGate({
    workflow: withAttempt,
    siteReady,
    requiresSiteInspection: Boolean(row.inspection_request_id),
  });
  const nextExtra = { ...extra, installation_workflow: nextWorkflow };

  await db.query(
    `UPDATE equipment_purchase_requests
        SET extra = $1::jsonb,
            updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(nextExtra), numericId],
  );

  await trackFst09WorkflowDocument({
    sourceType: "public_purchase",
    sourceId: String(numericId),
    requestId: Number.isFinite(Number(input.request_id))
      ? Number(input.request_id)
      : row.inspection_request_id || null,
    driveFileId: document.file_id,
    driveFolderId: document.folder_id || null,
    driveLink: document.link || null,
    clientName: row.client_name || input.Cliente || null,
    equipmentName: inferEquipmentName(row.equipment || []) || input.Equipo || null,
    user,
    metadata: {
      verification_result: normalizeVerificationOutcome(input.verification_result),
      verification_status: nextWorkflow.verification_cycle.status,
      source_module: "equipment_purchases",
      purchase_id: numericId,
    },
  });

  return {
    source_type: "public_purchase",
    source_id: String(numericId),
    verification_status: nextWorkflow.verification_cycle.status,
    installation_can_close: Boolean(nextWorkflow.closure_gate?.can_close),
    blocked_reasons: nextWorkflow.closure_gate?.blocked_reasons || [],
  };
};

const updatePrivatePurchaseVerificationCycle = async ({
  sourceId,
  input,
  user,
  document,
}) => {
  await ensurePrivateInstallationColumns();
  const numericId = Number.parseInt(String(sourceId || ""), 10);
  if (!Number.isFinite(numericId)) {
    throw createInstallationWorkflowError("source_id invalido para compra privada", {
      status: 400,
      code: "WORKFLOW_SOURCE_INVALID",
    });
  }

  const { rows } = await db.query(
    `SELECT id, client_snapshot, inspection_request_id, equipment,
            site_inspection_ready_for_installation, installation_workflow
       FROM private_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [numericId],
  );
  if (!rows.length) {
    throw createInstallationWorkflowError("Compra privada no encontrada para registrar F.ST-09", {
      status: 404,
      code: "WORKFLOW_SOURCE_NOT_FOUND",
    });
  }

  const row = rows[0];
  const normalized = normalizeInstallationWorkflowState(row.installation_workflow || {}, {
    equipment: row.equipment || [],
  });
  const withAttempt = appendVerificationAttempt({
    workflow: normalized,
    payload: {
      result: normalizeVerificationOutcome(input.verification_result),
      criteria_reference: input.criteria_reference,
      analysis: input.ANALISIS,
      notes: input.remediation_notes,
      request_id: input.request_id || row.inspection_request_id || null,
      remediation_notes: input.remediation_notes,
    },
    user,
    document,
  });
  const nextWorkflow = enrichInstallationWorkflowWithGate({
    workflow: withAttempt,
    siteReady: Boolean(row.site_inspection_ready_for_installation),
    requiresSiteInspection: Boolean(row.inspection_request_id),
  });

  await db.query(
    `UPDATE private_purchase_requests
        SET installation_workflow = $1::jsonb,
            updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(nextWorkflow), numericId],
  );

  const snapshot = toSafeObject(row.client_snapshot);
  const clientName =
    snapshot.commercial_name ||
    snapshot.client_name ||
    snapshot.name ||
    input.Cliente ||
    null;
  await trackFst09WorkflowDocument({
    sourceType: "private_purchase",
    sourceId: String(numericId),
    requestId: Number.isFinite(Number(input.request_id))
      ? Number(input.request_id)
      : row.inspection_request_id || null,
    driveFileId: document.file_id,
    driveFolderId: document.folder_id || null,
    driveLink: document.link || null,
    clientName,
    equipmentName: inferEquipmentName(row.equipment || []) || input.Equipo || null,
    user,
    metadata: {
      verification_result: normalizeVerificationOutcome(input.verification_result),
      verification_status: nextWorkflow.verification_cycle.status,
      source_module: "private_purchases",
      purchase_id: numericId,
    },
  });

  return {
    source_type: "private_purchase",
    source_id: String(numericId),
    verification_status: nextWorkflow.verification_cycle.status,
    installation_can_close: Boolean(nextWorkflow.closure_gate?.can_close),
    blocked_reasons: nextWorkflow.closure_gate?.blocked_reasons || [],
  };
};

const upsertVerificationCycleBySource = async ({ input, user, document }) => {
  const sourceType = String(input.source_type || "").trim().toLowerCase();
  const sourceId = String(input.source_id || "").trim();
  if (!sourceType || !sourceId) return null;
  if (!["public_purchase", "private_purchase"].includes(sourceType)) return null;

  if (sourceType === "public_purchase") {
    return updatePublicPurchaseVerificationCycle({ sourceId, input, user, document });
  }
  return updatePrivatePurchaseVerificationCycle({ sourceId, input, user, document });
};

const generateEquipmentVerificationPDFEndpoint = async (req, res) => {
  try {
    const input = resolveVerificationInput(req.body || {});

    if (!input.Fecha) {
      return res.status(400).json({ ok: false, message: "La fecha (Fecha) es obligatoria" });
    }
    if (!input.Cliente) {
      return res.status(400).json({ ok: false, message: "El cliente (Cliente) es obligatorio" });
    }
    if (!input.Equipo) {
      return res.status(400).json({ ok: false, message: "El equipo (Equipo) es obligatorio" });
    }
    if (!input.Serie) {
      return res.status(400).json({ ok: false, message: "La serie (Serie) es obligatoria" });
    }
    if (!input.RESULTADOS || input.RESULTADOS.trim().length < 10) {
      return res.status(400).json({
        ok: false,
        message:
          "Los RESULTADOS son obligatorios y deben contener detalles tecnicos (minimo 10 caracteres)",
      });
    }
    if (!input.ANALISIS || input.ANALISIS.trim().length < 10) {
      return res.status(400).json({
        ok: false,
        message:
          "El ANALISIS es obligatorio y debe contener interpretacion tecnica (minimo 10 caracteres)",
      });
    }
    if (!input.firma_af_image || input.firma_af_image.length < 10) {
      return res.status(400).json({ ok: false, message: "La firma del especialista es obligatoria" });
    }
    const verificationResult = normalizeVerificationOutcome(input.verification_result);
    if (!input.criteria_reference) {
      return res.status(400).json({
        ok: false,
        code: "VERIFICATION_CRITERIA_REQUIRED",
        message: "Debes registrar la fuente/criterio tecnico usado para la verificacion",
      });
    }

    const pdfBuffer = await generateEquipmentVerificationPDF(input);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(500).json({ ok: false, message: "Error: PDF de verificacion generado vacio" });
    }

    const driveResult = await saveVerificationToDrive(pdfBuffer, input, req.userInfo);
    if (!driveResult?.pdfFile?.id) {
      return res.status(500).json({ ok: false, message: "Error guardando archivos en Google Drive" });
    }

    let workflowSync = null;
    try {
      workflowSync = await upsertVerificationCycleBySource({
        input,
        user: req.userInfo || req.user || null,
        document: {
          file_id: driveResult.pdfFile.id,
          link:
            driveResult.pdfFile.webViewLink ||
            `https://drive.google.com/file/d/${driveResult.pdfFile.id}/view`,
          folder_id: driveResult.folderId || null,
        },
      });
    } catch (workflowError) {
      logger.error({ workflowError, input }, "No se pudo sincronizar ciclo de verificacion F.ST-09");
      return res.status(workflowError.status || 500).json({
        ok: false,
        code: workflowError.code || "VERIFICATION_WORKFLOW_SYNC_FAILED",
        message:
          workflowError.message ||
          "No se pudo sincronizar el ciclo de verificacion con el workflow de instalacion",
        details: workflowError.details || null,
      });
    }

    return res.json({
      ok: true,
      message: "Verificacion de equipo registrada correctamente",
      driveFolderId: driveResult.folderId,
      pdfId: driveResult.pdfFile.id,
      fecha: input.Fecha,
      cliente: input.Cliente,
      equipo: input.Equipo,
      serie: input.Serie,
      verification_result: verificationResult,
      workflow: workflowSync,
    });
  } catch (error) {
    logger.error({ error }, "Error en endpoint de PDF de verificacion de equipos");
    return res.status(error.status || 500).json({
      ok: false,
      code: error.code || "VERIFICATION_PDF_ERROR",
      message: error.message || "Error generando PDF de verificacion de equipos",
      details: error.details || null,
    });
  }
};

module.exports = {
  generateEquipmentVerificationPDF,
  generateEquipmentVerificationPDFEndpoint,
};
