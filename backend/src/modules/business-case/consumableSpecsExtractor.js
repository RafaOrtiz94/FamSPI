/**
 * Extractor de ficha tecnica desde documentos del fabricante (Roche Method
 * Sheets en texto de `pdftotext -raw`). Lo usan los scripts de
 * backend/scripts/consumable-specs para poblar catalog_consumable_specs.
 *
 * Regla: nunca inventar. Cada valor sale de una linea del documento y la
 * evidencia textual se conserva; lo que no se reconoce queda null y la fila
 * se marca 'partial'.
 */

const UNIT_DAYS = { hour: 1 / 24, hours: 1 / 24, h: 1 / 24, day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30 };

function toDays(amount, unit) {
  return Math.round(Number(amount) * UNIT_DAYS[unit.toLowerCase()] * 1000) / 1000;
}

// pdftotext pierde el guion y el simbolo de grado ("2-8 °C" sale "28 �C").
function normalizeDocumentText(raw) {
  return String(raw || "")
    .replace(/�|ï¿½/g, "°")
    .replace(/\b2\s?8\s?°\s?C/g, "2-8 °C")
    .replace(/\b15\s?25\s?°\s?C/g, "15-25 °C")
    .replace(/\b20\s?25\s?°\s?C/g, "20-25 °C")
    .replace(/\b15\s?32\s?°\s?C/g, "15-32 °C")
    .replace(/×|°(?=\s?\d+(\.\d+)?\s?mL)/g, "x");
}

function normalizeCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.replace(/^0+(?=\d)/, "") : null;
}

function packFor(text, code, itemType) {
  const code11 = String(code).padStart(11, "0");
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes(code11));
  if (start < 0) return { evidence: null };
  // Linea del codigo y siguientes, hasta el inicio del cuerpo o el siguiente material.
  const window = [];
  for (let j = start; j < Math.min(lines.length, start + 6); j++) {
    if (j > start && /^(English|System information|Intended use|\* Some kits)/.test(lines[j])) break;
    if (j > start && /^\d{11}\*?\s/.test(lines[j]) && !/\d{8}500\b/.test(lines[j])) break;
    window.push(lines[j].trim());
  }
  const evidence = window.join(" | ");
  const out = { evidence };
  let m;
  if ((m = evidence.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*mL/i))) {
    out.containers = Number(m[1]);
    out.volume_ml = Number(m[2]);
  } else if ((m = evidence.match(/\((\d+(?:\.\d+)?)\s*mL\)/i))) {
    out.containers = 1;
    out.volume_ml = Number(m[1]);
  }
  if ((m = evidence.match(/(\d[\d,.]*)\s*tests/i))) {
    out.tests = Number(m[1].replace(/[,.]/g, ""));
  } else if (itemType === "reactivo" && (m = evidence.match(/\d{8}500\s+(\d{2,5})\b/))) {
    // Elecsys: "<codigo>500 100" -> columna de pruebas del kit.
    out.tests = Number(m[1]);
    out.tests_from_column = true;
  }
  return out;
}

function sections(text, start, stops, maxLines = 40) {
  const lines = text.split(/\r?\n/);
  const out = [];
  lines.forEach((line, i) => {
    if (!start.test(line)) return;
    const block = [];
    for (let j = i; j < Math.min(lines.length, i + maxLines); j++) {
      if (j > i && stops.test(lines[j])) break;
      block.push(lines[j].trim());
    }
    out.push({ line: i, text: block.filter(Boolean).join("\n") });
  });
  return out;
}

const SYSTEM_HEADER = /(cobas c 303\/503|cobas c 303|cobas c 503|cobas c 311\/501|cobas c 501\/502|cobas c systems|COBAS INTEGRA systems|COBAS INTEGRA 400 plus|cobas c 111|cobas c 701\/702|cobas c 702|cobas pro|cobas pure)/i;

// Analizador del bloque: ultima cabecera corta que empieza con el analizador.
function systemAt(text, lineNo) {
  const lines = text.split(/\r?\n/);
  for (let i = lineNo - 1; i >= 0 && i > lineNo - 120; i--) {
    const line = lines[i].trim();
    const m = line.match(SYSTEM_HEADER);
    if (m && line.length <= 45 && line.toLowerCase().startsWith(m[1].toLowerCase())) return m[1];
  }
  return null;
}

function parseStability(block) {
  const b = block.replace(/\n/g, " ");
  const r = {};
  let m;
  if ((m = b.match(/[Oo]n-?board[^.]{0,80}?(\d+(?:\.\d+)?)\s*(weeks?|days?|months?|hours?)/))
    || (m = b.match(/on (?:the )?analy[sz]ers?[^.\d]{0,30}?(\d+(?:\.\d+)?)\s*(weeks?|days?|months?|hours?)/i))) {
    r.onboard_days = toDays(m[1], m[2]);
  }
  if (/on-?board[^.]{0,60}up to (the )?expiration/i.test(b)) r.onboard_until_expiration = true;
  // Tabla "at 2-8 °C  N unidad" primero: en prosa "N unidad at 2-8 °C" el valor
  // previo puede pertenecer a otra fila (15-25 °C) cuando la tabla se aplana.
  if ((m = b.match(/at 2-8 °C:?\s*(\d+(?:\.\d+)?)\s*(weeks?|days?|months?|hours?)/))) {
    r.open_days = toDays(m[1], m[2]);
  } else if ((m = b.match(/(?:[Aa]fter opening|reconstitut\w*|opened)[^.]{0,120}?(?:or |: ?|^)(\d+(?:\.\d+)?)\s*(weeks?|days?|months?|hours?)\s*at 2-8 °C/))) {
    r.open_days = toDays(m[1], m[2]);
  } else if ((m = b.match(/(?:[Aa]fter opening|[Oo]pened)[^.]{0,40}?(\d+(?:\.\d+)?)\s*(weeks?|days?|months?)\b/))) {
    r.open_days = toDays(m[1], m[2]);
    r.open_condition_unstated = true;
  }
  // Envase de un solo uso (ampollas ISE): se descarta el resto al abrir.
  if (/used immediately|single use|must not be stored/i.test(b)) r.single_use = true;
  // Elecsys CalSet/PreciControl: la alicuota puesta en el analizador se usa una
  // vez; el frasco sigue vigente a 2-8 °C segun open_days.
  if (/use only once/i.test(b) && !r.single_use) r.onboard_aliquot_single_use = true;
  if ((m = b.match(/(\d+(?:\.\d+)?)\s*(weeks?|days?|months?)\s*\(?when frozen once/i))) r.frozen_once_days = toDays(m[1], m[2]);
  return r;
}

function parseCalibration(block) {
  const b = block.replace(/\n/g, " ");
  const r = { events: [] };
  if (/lot change|reagent lot|each lot|new lot/i.test(b)) r.events.push("reagent_lot_change");
  if (/each (cobas c |cobas e |reagent )?(pack|kit|cassette)|after reagent pack|new (reagent )?(pack|kit)/i.test(b)) r.events.push("reagent_pack_change");
  let m;
  if ((m = b.match(/every (\d+(?:\.\d+)?)\s*(weeks?|days?|months?)/i))) r.interval_days = toDays(m[1], m[2]);
  if ((m = b.match(/after (\d+(?:\.\d+)?)\s*(weeks?|days?)\s*on-?board/i))) r.onboard_pack_interval_days = toDays(m[1], m[2]);
  if ((m = b.match(/after (\d+(?:\.\d+)?)\s*(months?|weeks?|days?)\s*(?:\(\d+ days\) )?when using the same reagent lot/i))) r.same_lot_interval_days = toDays(m[1], m[2]);
  if ((m = b.match(/after (\d+(?:\.\d+)?)\s*(days?|weeks?)\s*\(?(?:when using the same reagent kit|on the analyzer)/i))) r.onboard_kit_interval_days = toDays(m[1], m[2]);
  if ((m = b.match(/Calibration replicate\s+(\w+)/i))) r.replicate = m[1].toLowerCase();
  if ((m = b.match(/Calibration mode\s+([A-Za-z -]+?)(?:\s{2}|Calibration|$)/))) r.mode = m[1].trim();
  return r;
}

function parseQualityControl(block) {
  const b = block.replace(/\n/g, " ");
  const r = {};
  let m;
  if ((m = b.match(/Control interval\s+(\d+)\s*hours/i))) r.interval_hours = Number(m[1]);
  else if ((m = b.match(/once every (\d+) hours/i))) r.interval_hours = Number(m[1]);
  else if ((m = b.match(/(?:at least|once) every (\d+(?:\.\d+)?)\s*(weeks?|days?|hours?)/i))) r.interval_hours = Math.round(toDays(m[1], m[2]) * 24);
  if (/after (lot )?calibration/i.test(b) || /controls?[^.]{0,40}after (each )?calibration/i.test(b)) r.after_calibration = true;
  if (/once per reagent kit|each reagent kit|per reagent pack/i.test(b)) r.per_kit = true;
  return r;
}

// Codigos de 11 digitos que el documento lista (Order information / Materials
// required) y que existen en el catalogo: calibradores/controles del reactivo.
function linkedCodes(text, selfCode, typeByCode) {
  const found = new Set((text.match(/\b\d{11}\b/g) || []).map(normalizeCode));
  const out = { calibradores: [], controles: [], materiales: [] };
  found.forEach((code) => {
    if (code === selfCode) return;
    const type = typeByCode.get(code);
    if (type === "calibrador") out.calibradores.push(code);
    else if (type === "control") out.controles.push(code);
    else if (type === "material") out.materiales.push(code);
  });
  return out;
}

const STOP_STABILITY = /^(Calibration|Specimen collection|Test procedure|Application|Materials provided|Materials required|Traceability|Precautions|Quality control|Limitations|Handling|Additional information|Symbols|Specific performance)/;
const STOP_CALIBRATION = /^(Quality control|Traceability|Calculation|Limitations|Specific performance|Expected values)/;
const STOP_QC = /^(Calculation|Limitations|Specific performance|Expected values|Traceability)/;

/** Extraccion cruda de un producto a partir del texto normalizado de su documento. */
function extractFromDocument({ text, code, itemType, typeByCode }) {
  const out = {
    pack: packFor(text, code, itemType),
    stability: sections(text, /^Storage and stability/, STOP_STABILITY)
      .map((s) => ({ system: systemAt(text, s.line), ...parseStability(s.text), evidence: s.text.slice(0, 1200) })),
  };
  if (itemType === "reactivo") {
    out.calibration = sections(text, /^Calibration\b/, STOP_CALIBRATION, 25)
      .map((s) => ({ system: systemAt(text, s.line), ...parseCalibration(s.text), evidence: s.text.slice(0, 900) }));
    out.qc = sections(text, /^Quality control\b/, STOP_QC, 15)
      .map((s) => ({ system: systemAt(text, s.line), ...parseQualityControl(s.text), evidence: s.text.slice(0, 700) }));
    out.links = linkedCodes(text, code, typeByCode || new Map());
  }
  return out;
}

const clip = (value, n) => (value ? value.replace(/\s+/g, " ").trim().slice(0, n) : null);
const BASIS_BY_TYPE = { calibrador: "calibration_event", control: "qc_event", reactivo: "per_test" };

/**
 * Convierte la extraccion en una fila de catalog_consumable_specs.
 * doc: { id, title, type, version, date (ISO), systems[], url }
 */
function toSpecRow({ code, itemType, name, doc, extraction, retrievedAt }) {
  const base = { supplier_code: code, item_type: itemType, product_name: name, system_specs: {}, parameters: {}, single_use: false, compatible_systems: [] };
  if (!doc) {
    return { ...base, valid_from: retrievedAt, consumption_basis: "unknown", source_type: "none", verification_status: "pending",
      notes: "Sin documento del fabricante en eLabDoc para este codigo. Cargar ficha desde otra fuente del fabricante." };
  }
  const stability = extraction.stability || [];
  const calibration = extraction.calibration || [];
  const qc = extraction.qc || [];
  const specs = {};
  const keyOf = (block) => block.system || "todos";
  const put = (key, field, value) => {
    if (value === undefined || value === null) return;
    specs[key] = specs[key] || {};
    specs[key][field] = value;
  };

  stability.forEach((s) => {
    put(keyOf(s), "onboard_days", s.onboard_days);
    if (s.onboard_until_expiration) put(keyOf(s), "onboard_until_expiration", true);
  });
  calibration.forEach((c) => {
    const values = { interval_days: c.interval_days, onboard_pack_interval_days: c.onboard_pack_interval_days,
      same_lot_interval_days: c.same_lot_interval_days, onboard_kit_interval_days: c.onboard_kit_interval_days,
      replicate: c.replicate, mode: c.mode };
    Object.keys(values).forEach((k) => values[k] === undefined && delete values[k]);
    const previous = specs[keyOf(c)]?.calibration || {};
    const events = [...new Set([...(previous.events || []), ...(c.events || [])])];
    if (!Object.keys(values).length && !events.length) return;
    put(keyOf(c), "calibration", { ...previous, ...values, ...(events.length ? { events } : {}) });
  });
  qc.forEach((q) => {
    const values = { interval_hours: q.interval_hours, per_kit: q.per_kit, after_calibration: q.after_calibration };
    Object.keys(values).forEach((k) => values[k] === undefined && delete values[k]);
    if (Object.keys(values).length) put(keyOf(q), "qc", { ...(specs[keyOf(q)]?.qc || {}), ...values });
  });

  const onboardValues = [...new Set(stability.map((s) => s.onboard_days).filter((v) => v != null))];
  const openDays = stability.map((s) => s.open_days).find((v) => v != null) ?? null;
  const singleUse = stability.some((s) => s.single_use);
  const pack = extraction.pack || {};
  const parameters = {};
  const frozen = stability.map((s) => s.frozen_once_days).find((v) => v != null);
  if (frozen) parameters.stability_frozen_once_days = frozen;
  if (stability.some((s) => s.open_condition_unstated)) parameters.open_condition_unstated = true;
  if (stability.some((s) => s.onboard_aliquot_single_use)) parameters.onboard_aliquot_single_use = true;
  if (pack.tests_from_column) parameters.tests_from_order_table = true;
  const links = extraction.links;
  if (links && (links.calibradores.length || links.controles.length || links.materiales.length)) parameters.linked_products = links;
  parameters.evidence = {
    order_line: clip(pack.evidence, 240),
    storage_and_stability: stability.slice(0, 3).map((s) => clip(s.evidence, 500)),
    ...(calibration.length ? { calibration: calibration.slice(0, 3).map((c) => clip(c.evidence, 500)) } : {}),
    ...(qc.length ? { quality_control: qc.slice(0, 2).map((c) => clip(c.evidence, 350)) } : {}),
  };

  const hasPack = Boolean(pack.containers || pack.tests);
  const hasStability = openDays != null || onboardValues.length > 0 || singleUse || stability.some((s) => s.onboard_until_expiration);
  const hasCalibration = itemType !== "reactivo"
    || calibration.some((c) => c.events?.length || c.interval_days || c.same_lot_interval_days || c.onboard_pack_interval_days);
  const missing = [!hasPack && "presentacion", !hasStability && "estabilidad", !hasCalibration && "frecuencia_calibracion"].filter(Boolean);

  return {
    ...base,
    valid_from: doc.date,
    containers_per_pack: pack.containers ?? null,
    container_volume_ml: pack.volume_ml ?? null,
    tests_per_pack: pack.tests ?? null,
    stability_open_days: openDays,
    stability_onboard_days: onboardValues.length === 1 ? onboardValues[0] : null,
    single_use: singleUse,
    consumption_basis: BASIS_BY_TYPE[itemType] || (onboardValues.length ? "onboard_time" : "unknown"),
    compatible_systems: doc.systems || [],
    system_specs: specs,
    parameters,
    source_type: /Quick Reference|catalogue/i.test(`${doc.type} ${doc.title}`) ? "manufacturer_catalogue" : "manufacturer_method_sheet",
    source_title: doc.title,
    source_url: doc.url,
    source_document_id: doc.id,
    source_document_version: doc.version,
    source_document_date: doc.date,
    source_retrieved_at: retrievedAt,
    verification_status: missing.length ? "partial" : "extracted",
    notes: missing.length
      ? `Extraccion automatica incompleta: falta ${missing.join(", ")}. Revisar documento.`
      : "Extraccion automatica desde el documento del fabricante; pendiente de revision humana.",
  };
}

module.exports = {
  normalizeDocumentText,
  normalizeCode,
  packFor,
  parseStability,
  parseCalibration,
  parseQualityControl,
  systemAt,
  linkedCodes,
  extractFromDocument,
  toSpecRow,
};
