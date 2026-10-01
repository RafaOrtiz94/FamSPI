/**
 * Especificacion tecnica de un activo TI (PDF, descarga de un clic).
 *
 * Flujo: datos REGISTRADOS del activo (ti_assets + accesorios + responsable)
 * -> redaccion con Claude (salida JSON estructurada) -> PDF con pdfkit.
 * La IA solo redacta/organiza lo registrado: no debe agregar especificaciones.
 * Si no hay credenciales de Anthropic o la llamada falla, el documento se
 * genera igual con redaccion de plantilla (el clic nunca queda sin PDF).
 */
const PDFDocument = require("pdfkit");
const db = require("../../config/db");
const logger = require("../../config/logger");

const SPEC_MODEL = "claude-opus-5-5";
const AI_TIMEOUT_MS = 75000;

const STATUS_LABELS = {
  assigned: "Asignado",
  unassigned: "Disponible (sin asignar)",
  available: "Disponible",
  maintenance: "En mantenimiento",
  damaged: "Dañado",
  retired: "Dado de baja",
  inactive: "Inactivo",
  reserved: "Reservado para Business Case",
};
const OWNERSHIP_LABELS = { company: "Propiedad de la empresa", client: "Propiedad del cliente", leased: "Arrendado" };
const USAGE_LABELS = {
  internal: "Uso interno",
  customer_site: "Instalado en sitio del cliente",
  loan: "Préstamo",
  spare: "Equipo de respaldo",
  demo: "Demostración",
};

function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

// dateOnly: columnas DATE (pg las entrega a medianoche UTC) -- formatear en UTC
// para no correrlas un dia al pasar a hora de Ecuador.
function fmtDate(value, { dateOnly = false } = {}) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("es-EC", {
    timeZone: dateOnly ? "UTC" : "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// characteristics es JSONB, pero la UI guarda texto libre ("RAM, disco...");
// puede llegar como string, como objeto {} o como objeto con claves.
function characteristicsToText(value) {
  if (!hasText(value) && typeof value !== "object") return "";
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => hasText(v));
    return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
  }
  return String(value);
}

async function loadAssetFacts(assetId) {
  const { rows } = await db.query(
    `SELECT a.*,
            COALESCE(u.fullname, u.name, u.email) AS assigned_to_name,
            u.email AS assigned_to_email,
            COALESCE(c.fullname, c.name, c.email) AS custodian_name
       FROM public.ti_assets a
       LEFT JOIN public.users u ON u.id = a.assigned_to_user_id
       LEFT JOIN public.users c ON c.id = a.custodian_user_id
      WHERE a.id = $1 AND a.active IS NOT FALSE
      LIMIT 1`,
    [assetId],
  );
  const asset = rows[0];
  if (!asset) {
    const error = new Error("Activo no encontrado");
    error.status = 404;
    throw error;
  }

  const { rows: accessories } = await db.query(
    `SELECT name, brand, model, serial_number, imei, is_new, physical_condition, observations
       FROM public.ti_asset_accessories
      WHERE asset_id = $1 AND active = true
      ORDER BY created_at ASC`,
    [assetId],
  );

  const frequency = Number(asset.maintenance_frequency_months) || 12;
  let nextMaintenance = null;
  if (asset.last_maintenance_at) {
    const next = new Date(asset.last_maintenance_at);
    next.setUTCMonth(next.getUTCMonth() + frequency);
    nextMaintenance = fmtDate(next, { dateOnly: true });
  }

  // Solo pares con valor: lo que no esta registrado no se envia (y la IA no
  // debe inventarlo).
  const identification = [
    ["Nombre del activo", asset.name],
    ["Código de activo", asset.asset_code],
    ["Marca", asset.brand],
    ["Modelo", asset.model],
    ["Número de serie", asset.serial_number],
    ["IMEI", asset.imei],
    ["Estado", STATUS_LABELS[asset.status] || asset.status],
    ["Tipo de propiedad", OWNERSHIP_LABELS[asset.ownership_type] || asset.ownership_type],
    ["Contexto de uso", USAGE_LABELS[asset.usage_context] || asset.usage_context],
    ["Fecha de compra", fmtDate(asset.purchase_date, { dateOnly: true })],
    ["Categoría de valor", asset.value_category === "asset" ? "Activo fijo" : asset.value_category === "control_item" ? "Bien de control" : null],
    ["Estado físico inicial", asset.physical_condition_score ? `${asset.physical_condition_score}/10` : null],
    ["Estado funcional inicial", asset.functional_condition_score ? `${asset.functional_condition_score}/10` : null],
    ["Asignado a", asset.assigned_to_name],
    ["Fecha de asignación", fmtDate(asset.assigned_at)],
    ["Custodio", asset.custodian_name],
    ["Ubicación", asset.location_label || asset.client_location_label],
    ["Bodega", [asset.warehouse_code, asset.warehouse_section, asset.warehouse_shelf].filter(hasText).join(" / ") || null],
    ["Frecuencia de mantenimiento", `${frequency} meses`],
    ["Último mantenimiento", fmtDate(asset.last_maintenance_at, { dateOnly: true })],
    ["Próximo mantenimiento estimado", nextMaintenance],
  ].filter(([, value]) => hasText(value));

  return {
    asset,
    identification,
    characteristicsText: characteristicsToText(asset.characteristics),
    accessories: accessories.map((acc) => ({
      nombre: acc.name,
      marca: acc.brand || null,
      modelo: acc.model || null,
      serie: acc.serial_number || null,
      nuevo: acc.is_new === true,
      estado_fisico: acc.physical_condition ? `${acc.physical_condition}/10` : null,
      observaciones: acc.observations || null,
    })),
  };
}

// ─── Redaccion con Claude ────────────────────────────────────────────────────

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    resumen: { type: "string" },
    descripcion_general: { type: "string" },
    especificaciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          componente: { type: "string" },
          valor: { type: "string" },
          // "fabricante": ficha tecnica del modelo; "registro": inventario SPI.
          fuente: { type: "string", enum: ["fabricante", "registro"] },
        },
        required: ["componente", "valor", "fuente"],
        additionalProperties: false,
      },
    },
    estado_y_condicion: { type: "string" },
    accesorios_y_complementos: { type: "string" },
    uso_y_asignacion: { type: "string" },
    mantenimiento_y_cuidados: { type: "string" },
    justificacion_tecnica: { type: "string" },
    datos_no_registrados: { type: "array", items: { type: "string" } },
  },
  required: [
    "resumen",
    "descripcion_general",
    "especificaciones",
    "estado_y_condicion",
    "accesorios_y_complementos",
    "uso_y_asignacion",
    "mantenimiento_y_cuidados",
    "justificacion_tecnica",
    "datos_no_registrados",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Redactas documentos de especificacion tecnica de equipos tecnologicos para el Departamento de TI de una empresa en Ecuador. Escribes en espanol formal, claro y bien argumentado, en tercera persona.

Fuente de las especificaciones: cuando la marca y el modelo identifican un producto comercial concreto, las especificaciones tecnicas son las de la ficha del fabricante para ese modelo (fuente "fabricante"): tamano, resolucion, tecnologia, conectividad, rendimiento, etc. Incluye solo valores de los que estes seguro para ese modelo exacto; si un valor depende de la variante o version (por ejemplo, un sufijo de modelo que no se registro), indicalo asi en lugar de elegir una. Los datos de identificacion y estado (serie, IMEI, estado fisico, asignacion) y las caracteristicas de equipos sin modelo comercial (por ejemplo, ensamblados o clones con modelo "N/A") vienen del registro (fuente "registro"). Si el texto registrado contradice la ficha del fabricante, usa el valor del fabricante y menciona la diferencia en "datos_no_registrados" para que se corrija el registro. Nunca completes un equipo sin modelo comercial con valores supuestos: lo que falte va en "datos_no_registrados".

Como organizar la informacion:
- "especificaciones": filas componente/valor/fuente (por ejemplo "Procesador", "Memoria RAM", "Resolucion"). Incluye tambien marca, modelo, serie e IMEI si existen (fuente "registro").
- Las secciones de texto explican y argumentan a partir de los datos y de la ficha del modelo: que es el equipo y para que sirve segun su tipo, en que estado se encuentra, que accesorios lo acompanan, a quien esta asignado y como se gestiona su mantenimiento. "justificacion_tecnica" argumenta por que el equipo es adecuado (o que limitaciones tiene) para su uso. Puedes dar recomendaciones generales de cuidado propias del tipo de equipo, sin presentarlas como datos del activo.
- Cada seccion de texto tiene uno o dos parrafos. Si una seccion no tiene datos (por ejemplo, sin accesorios), dilo en una frase breve.`;

let anthropicClient = null;
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  if (!anthropicClient) {
    const Anthropic = require("@anthropic-ai/sdk");
    anthropicClient = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  }
  return anthropicClient;
}

async function generateNarrativeWithAI(facts) {
  const client = getAnthropicClient();
  if (!client) return null;

  const payload = buildNarrativeInput(facts);

  const response = await client.beta.messages.create({
    model: SPEC_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: NARRATIVE_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Datos registrados del activo (JSON):\n${JSON.stringify(payload, null, 2)}\n\nRedacta la especificacion tecnica de este activo.`,
      },
    ],
  });

  if (response.stop_reason !== "end_turn") {
    throw new Error(`Redaccion IA incompleta (stop_reason=${response.stop_reason})`);
  }
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  return JSON.parse(text);
}

// Redaccion de respaldo sin IA: mismas secciones, solo con datos registrados.
function buildTemplateNarrative(facts) {
  const { asset, characteristicsText, accessories } = facts;
  const brandModel = [asset.brand, asset.model].filter(hasText).join(" ");
  const specs = [
    ["Marca", asset.brand],
    ["Modelo", asset.model],
    ["Número de serie", asset.serial_number],
    ["IMEI", asset.imei],
  ].filter(([, v]) => hasText(v)).map(([componente, valor]) => ({ componente, valor: String(valor), fuente: "registro" }));
  if (characteristicsText) {
    characteristicsText.split(/[;,\n]+/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const [label, ...rest] = part.split(":");
      specs.push(rest.length ? { componente: label.trim(), valor: rest.join(":").trim(), fuente: "registro" } : { componente: "Característica", valor: part, fuente: "registro" });
    });
  }
  const missing = [];
  if (!characteristicsText) missing.push("Características técnicas (procesador, memoria, almacenamiento, etc.)");
  if (!hasText(asset.serial_number)) missing.push("Número de serie");
  if (!asset.purchase_date) missing.push("Fecha de compra");

  return {
    resumen: `El presente documento describe las especificaciones técnicas del activo "${asset.name}"${brandModel ? ` (${brandModel})` : ""}${asset.asset_code ? `, identificado con el código ${asset.asset_code}` : ""}, con base en la información registrada en el sistema de activos de TI.`,
    descripcion_general: `El activo corresponde a ${asset.name}${brandModel ? ` de marca/modelo ${brandModel}` : ""}. Su estado actual en el inventario es "${STATUS_LABELS[asset.status] || asset.status || "sin estado"}".`,
    especificaciones: specs,
    estado_y_condicion: asset.physical_condition_score || asset.functional_condition_score
      ? `Al momento de su registro se evaluó con un estado físico de ${asset.physical_condition_score || "-"}/10 y un estado funcional de ${asset.functional_condition_score || "-"}/10.`
      : "No se registró una evaluación de condición física o funcional.",
    accesorios_y_complementos: accessories.length
      ? `El activo se entrega con ${accessories.length} accesorio(s): ${accessories.map((a) => a.nombre).join(", ")}.`
      : "No se registraron accesorios asociados a este activo.",
    uso_y_asignacion: asset.assigned_to_name
      ? `El equipo se encuentra asignado a ${asset.assigned_to_name}${asset.assigned_at ? ` desde el ${fmtDate(asset.assigned_at)}` : ""}.`
      : "El equipo no tiene un colaborador asignado actualmente.",
    mantenimiento_y_cuidados: `El activo tiene definida una frecuencia de mantenimiento preventivo de ${Number(asset.maintenance_frequency_months) || 12} meses${asset.last_maintenance_at ? `; el último mantenimiento registrado fue el ${fmtDate(asset.last_maintenance_at, { dateOnly: true })}` : ""}.`,
    justificacion_tecnica: "Las características detalladas en este documento corresponden a la información registrada del activo y sustentan su identificación, control y uso dentro de la organización.",
    datos_no_registrados: missing,
  };
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

function renderSpecPdf({ facts, narrative, aiGenerated, generatedByName }) {
  const { asset, identification, accessories } = facts;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = 515;
    const LEFT = 40;

    const ensureSpace = (needed) => {
      if (doc.y + needed > 780) doc.addPage();
    };
    const sectionTitle = (title) => {
      ensureSpace(80); // titulo + primeras lineas juntos (sin titulos huerfanos)
      doc.moveDown(0.8);
      const y = doc.y;
      doc.rect(LEFT, y, 3, 14).fill("#2563EB");
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text(title, LEFT + 10, y + 1, { width: W - 10 });
      doc.moveDown(0.4);
    };
    const paragraph = (text) => {
      if (!hasText(text)) return;
      ensureSpace(30);
      doc.fontSize(9.5).font("Helvetica").fillColor("#1f2937").text(String(text), LEFT, doc.y, { width: W, align: "justify", lineGap: 2 });
    };
    const keyValueTable = (rowsKv, labelWidth = 170) => {
      rowsKv.forEach(([label, value], index) => {
        const valueText = String(value ?? "-");
        const height = Math.max(16, doc.heightOfString(valueText, { width: W - labelWidth - 12, fontSize: 8.5 }) + 6);
        ensureSpace(height);
        const y = doc.y;
        if (index % 2 === 0) doc.rect(LEFT, y, W, height).fill("#f8fafc");
        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#334155").text(label, LEFT + 6, y + 4, { width: labelWidth - 8 });
        doc.fontSize(8.5).font("Helvetica").fillColor("#1f2937").text(valueText, LEFT + labelWidth, y + 4, { width: W - labelWidth - 12 });
        doc.y = y + height;
      });
    };

    // Encabezado
    doc.rect(LEFT, 40, W, 70).fill("#1E293B");
    doc.fillColor("#ffffff").fontSize(15).font("Helvetica-Bold").text("Especificación Técnica de Activo TI", LEFT + 12, 52, { width: W - 24 });
    doc.fontSize(10).font("Helvetica").fillColor("#cbd5e1")
      .text(`${asset.name}${asset.asset_code ? `  ·  Código ${asset.asset_code}` : ""}`, LEFT + 12, 74, { width: W - 24 });
    doc.fontSize(8).fillColor("#94a3b8")
      .text(`Emitido el ${fmtDate(new Date())}${generatedByName ? `  ·  Por ${generatedByName}` : ""}`, LEFT + 12, 92, { width: W - 24 });
    doc.y = 124;

    sectionTitle("1. Resumen");
    paragraph(narrative.resumen);

    sectionTitle("2. Identificación del activo");
    keyValueTable(identification);

    sectionTitle("3. Descripción general");
    paragraph(narrative.descripcion_general);

    sectionTitle("4. Especificaciones técnicas");
    const specs = Array.isArray(narrative.especificaciones) ? narrative.especificaciones : [];
    const fromManufacturer = (s) => s?.fuente === "fabricante";
    if (specs.length) {
      keyValueTable(specs.map((s) => [fromManufacturer(s) ? `${s.componente} *` : s.componente, s.valor]));
      if (specs.some(fromManufacturer)) {
        doc.moveDown(0.3);
        doc.fontSize(7.5).font("Helvetica-Oblique").fillColor("#64748b").text(
          `* Especificación según la ficha técnica del fabricante para el modelo ${[asset.brand, asset.model].filter(hasText).join(" ")}. `
            + "Las filas sin asterisco provienen del registro de inventario del activo.",
          LEFT, doc.y, { width: W },
        );
      }
    } else {
      paragraph("No hay especificaciones técnicas registradas para este activo.");
    }

    sectionTitle("5. Estado y condición");
    paragraph(narrative.estado_y_condicion);

    sectionTitle("6. Accesorios y complementos");
    paragraph(narrative.accesorios_y_complementos);
    if (accessories.length) {
      doc.moveDown(0.4);
      keyValueTable(accessories.map((acc) => [
        acc.nombre,
        [
          [acc.marca, acc.modelo].filter(hasText).join(" "),
          acc.serie ? `Serie ${acc.serie}` : null,
          acc.estado_fisico ? `Estado físico ${acc.estado_fisico}` : null,
          acc.nuevo ? "Nuevo" : null,
          acc.observaciones,
        ].filter(hasText).join(" · ") || "-",
      ]));
    }

    sectionTitle("7. Uso y asignación");
    paragraph(narrative.uso_y_asignacion);

    sectionTitle("8. Mantenimiento y cuidados");
    paragraph(narrative.mantenimiento_y_cuidados);

    sectionTitle("9. Justificación técnica");
    paragraph(narrative.justificacion_tecnica);

    const missing = Array.isArray(narrative.datos_no_registrados) ? narrative.datos_no_registrados.filter(hasText) : [];
    if (missing.length) {
      sectionTitle("10. Información pendiente en el registro");
      paragraph("Los siguientes datos no constan en el registro del activo o difieren de la ficha del fabricante, y deberían completarse o corregirse:");
      doc.moveDown(0.3);
      missing.forEach((item) => {
        ensureSpace(16);
        doc.fontSize(9).font("Helvetica").fillColor("#1f2937").text(`•  ${item}`, LEFT + 8, doc.y, { width: W - 8 });
      });
    }

    const note = aiGenerated
      ? "Redacción asistida por IA con datos del registro y de la ficha del fabricante del modelo. Verifique los datos antes de usarlo en procesos formales."
      : "Documento generado a partir de los datos registrados del activo.";
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      // El pie va dentro del margen inferior: sin esto pdfkit agrega una
      // pagina en blanco por cada pie escrito.
      doc.page.margins.bottom = 0;
      doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
        .text(`${note}  ·  Página ${i + 1} de ${pageCount}  ·  FAM SPI Activos TI`, LEFT, 805, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}

// Datos que recibe quien redacta (IA por API o redaccion guardada a mano).
function buildNarrativeInput(facts) {
  return {
    identificacion: Object.fromEntries(facts.identification),
    caracteristicas_registradas: facts.characteristicsText || null,
    accesorios: facts.accessories,
  };
}

function isValidNarrative(value) {
  return Boolean(value && typeof value === "object" && hasText(value.resumen) && Array.isArray(value.especificaciones));
}

// Orden: redaccion guardada (tech_spec_narrative) -> IA por API -> plantilla.
async function generateAssetTechSpecPdf(assetId, { generatedByName = null } = {}) {
  const facts = await loadAssetFacts(assetId);
  let narrative = isValidNarrative(facts.asset.tech_spec_narrative) ? facts.asset.tech_spec_narrative : null;
  let aiGenerated = Boolean(narrative);
  if (!narrative) {
    try {
      narrative = await generateNarrativeWithAI(facts);
      aiGenerated = Boolean(narrative);
    } catch (error) {
      logger.warn({ assetId, error: error?.message }, "[TI_SPEC] Redaccion IA fallo; se usa plantilla");
    }
  }
  if (!narrative) narrative = buildTemplateNarrative(facts);

  const pdfBuffer = await renderSpecPdf({ facts, narrative, aiGenerated, generatedByName });
  const code = facts.asset.asset_code || String(facts.asset.id).padStart(6, "0");
  return { pdfBuffer, filename: `Especificacion-Tecnica-${code}.pdf`, aiGenerated };
}

// Publica en Drive el PDF de cada activo con redaccion guardada:
// Activos TI / Especificaciones Tecnicas / <codigo> / Especificacion-Tecnica-<codigo>.pdf
// Corre en Cloud Run (credenciales de Drive). dryRun=true solo lista.
async function publishStoredTechSpecs({ dryRun = true, assetIds = null, generatedByName = null } = {}) {
  const { ensureFolder, uploadBase64File } = require("../../utils/drive");
  const ids = Array.isArray(assetIds) && assetIds.length ? assetIds.map(Number).filter(Number.isInteger) : null;
  const { rows } = await db.query(
    `SELECT id, asset_code FROM public.ti_assets
      WHERE tech_spec_narrative IS NOT NULL AND active IS NOT FALSE
        AND ($1::bigint[] IS NULL OR id = ANY($1::bigint[]))
      ORDER BY id`,
    [ids],
  );
  const base = process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
  if (!dryRun && !base) {
    const error = new Error("DRIVE_ROOT_FOLDER_ID no configurado");
    error.status = 500;
    throw error;
  }

  const results = [];
  let specsRootId = null;
  for (const row of rows) {
    if (dryRun) {
      results.push({ asset_id: row.id, asset_code: row.asset_code, published: false, reason: "dry_run" });
      continue;
    }
    try {
      if (!specsRootId) {
        const activosRoot = await ensureFolder("Activos TI", base);
        specsRootId = (await ensureFolder("Especificaciones Técnicas", activosRoot.id)).id;
      }
      const assetFolder = await ensureFolder(String(row.asset_code || row.id), specsRootId);
      const { pdfBuffer, filename } = await generateAssetTechSpecPdf(row.id, { generatedByName });
      const uploaded = await uploadBase64File(filename, pdfBuffer.toString("base64"), "application/pdf", assetFolder.id);
      const fileId = uploaded?.id || null;
      const url = uploaded?.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);
      await db.query(
        `UPDATE public.ti_assets SET tech_spec_drive_file_id = $2, tech_spec_drive_url = $3 WHERE id = $1`,
        [row.id, fileId, url],
      );
      results.push({ asset_id: row.id, asset_code: row.asset_code, published: true, drive_url: url });
    } catch (error) {
      logger.warn({ assetId: row.id, error: error?.message }, "[TI_SPEC] No se pudo publicar en Drive");
      results.push({ asset_id: row.id, asset_code: row.asset_code, published: false, error: error?.message || String(error) });
    }
  }
  return {
    dry_run: dryRun,
    total: results.length,
    published: results.filter((r) => r.published).length,
    failed: results.filter((r) => r.error).length,
    results,
  };
}

module.exports = {
  generateAssetTechSpecPdf,
  publishStoredTechSpecs,
  loadAssetFacts,
  buildNarrativeInput,
  isValidNarrative,
  NARRATIVE_SCHEMA,
  buildTemplateNarrative,
  characteristicsToText,
};
