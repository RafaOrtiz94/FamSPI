/**
 * Prediccion por consumo real de procesos de referencia y su verificacion. Archivo puro (sin base).
 *
 * La verdad del motor es lo que un laboratorio realmente consumio. Un proceso de referencia aporta,
 * por producto, su consumo por mes. Un cliente nuevo se predice con esas tasas (sin escalar por
 * pruebas: en calibradores y controles el consumo depende del calendario, no del volumen; medido con
 * Latacunga y Tena), con las reglas del manual del equipo y, sin referencia directa, con la mediana de
 * la familia (tipo y modulo).
 *
 * Lectores:
 *   - parseConsumptionLog: registro de consumibles con entregas por fecha y lecturas de stock
 *     (formato HJMVI Tena). Consumo = stock inicial + entregado - stock final, entre la primera y la
 *     ultima lectura de stock.
 *   - parseSpecialistWorkbook: libro del Business Case con las hojas de calculo del especialista
 *     (c303 c503, e402 e801): DET, estabilidad y PRODUCTO A ENTREGAR por producto.
 */

const XLSX = require("xlsx");
const { evaluateEquipmentManual } = require("./consumableEquipmentManual");

const DAY_MS = 86400000;
const COINCIDENCE_SHARE = 0.15;
// Lo real difiere 5 veces o mas del motor Y del especialista: casi siempre es la unidad del registro.
const UNIT_SUSPECT_RATIO = 5;
const STOP_WORDS = /^(ii|iii|iv|v[0-9.]*|gen|g[0-9]|e2g|elecsys|cobas|calset|cs|set|x|ml)$/;
// "CS" suelto es la abreviatura de CalSet de Elecsys (ej. "Cortisol CS", "IgE CS").
const IMMUNO = /elecsys|calset|\bcs\b|precicontrol|e2g|procell|cleancell|preclean|assay|multiassay|e801|e402|e 801/i;

const normalizeCode = (value) => String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const excelDate = (serial) => new Date(Math.round((serial - 25569) * DAY_MS));
const isDateSerial = (value) => typeof value === "number" && value > 40000 && value < 60000;
const textDate = (text) => {
  const match = String(text).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))) : null;
};
// En secciones mixtas ("CONTROLES Y CALIBRADORES") el tipo sale del nombre del producto.
const ISE = /\bise\b|electrod|activator|deprotein/i;
const CONTROL_NAME = /precicontrol|precinorm|precipath|control/i;
const CALIBRATOR_NAME = /\bcs\b|calset|cal set|calibrat|c\.?f\.?a\.?s|preciset|precimat/i;
const typeOfSection = (section, name = "") => {
  if (/CONTROL/.test(section) && /CALIBR/.test(section)) return CONTROL_NAME.test(name) ? "control" : "calibrador";
  if (/CALIBR/.test(section)) return "calibrador";
  if (/CONTROL/.test(section)) return "control";
  if (/REACTIV/.test(section)) return "reactivo";
  if (/CONSUMIBLE|SISTEMA|MATERIAL/.test(section)) return "material";
  // Hoja sin secciones (ej. HGP Puyo, TICS): el tipo sale del nombre; lo de ISE es material, como en el Sheet.
  if (ISE.test(name)) return "material";
  if (CONTROL_NAME.test(name)) return "control";
  if (CALIBRATOR_NAME.test(name)) return "calibrador";
  return "material";
};
const moduleOf = (name, sheetName = "") => {
  if (ISE.test(name)) return "ise";
  return /e402|e801/i.test(sheetName) || IMMUNO.test(name) ? "inmuno" : "quimica";
};
const words = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 1 && !STOP_WORDS.test(word));

/**
 * Cantidad de una celda del registro: numero, o texto que empieza con numero ("10 kits", "1, en uso",
 * "2 y 1 en uso" = 3). Sin numero inicial ("DEBO 3", "NO ENVIADO") no es cantidad. Las fechas dentro
 * del texto ("caduca 30/06/2026") no cuentan.
 */
function cellQuantity(value) {
  if (typeof value === "number") return value;
  const text = String(value).replace(/\(?\d{1,2}[-/]\d{1,2}[-/]\d{4}\)?/g, " ").trim().toLowerCase();
  if (!/^\d/.test(text)) return null;
  let total = Number(text.match(/^\d+(?:[.,]\d+)?/)[0].replace(",", "."));
  (text.match(/\by\s+(\d+)/g) || []).forEach((part) => { total += Number(part.replace(/\D/g, "")); });
  return total;
}

const CODE_PATTERN = /^\d{7,}$/;
const codeOf = (value) => String(value ?? "").replace(/\s+/g, "").trim();

/**
 * Registro de consumibles (entregas por fecha + lecturas "Stock dd/mm/aaaa") -> consumo por producto.
 * Formatos vistos: HJMVI Tena (ID, producto, fechas, Stock), HGP Puyo 2025 (codigo en columna B,
 * nombre en C, fechas como texto "21/07/2025 nuevo proceso") y hoja TICS 2026 (etiquetas de stock en
 * la fila de arriba de las fechas). Con { sheets } solo se leen esas hojas (ej. para separar procesos
 * que comparten archivo).
 */
function parseConsumptionLog(buffer, { sheets = null } = {}) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const products = [];
  workbook.SheetNames.forEach((sheetName) => {
    if (sheets && !sheets.map((name) => name.trim()).includes(sheetName.trim())) return;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = rows.findIndex((row) => row.filter(isDateSerial).length >= 3);
    if (headerIndex < 0) return;
    const header = rows[headerIndex];
    const above = headerIndex > 0 ? rows[headerIndex - 1] : [];
    const columns = header.map((value, column) => {
      if (isDateSerial(value)) return { column, kind: "delivery", date: excelDate(value) };
      // La etiqueta puede estar en la fila del encabezado o en la de arriba (hoja TICS).
      const label = String(value || above[column] || "");
      if (/stock/i.test(label)) return { column, kind: "stock", date: textDate(label) };
      if (textDate(label)) return { column, kind: "delivery", date: textDate(label) };
      return null;
    }).filter((entry) => entry && entry.date);
    if (!columns.some((entry) => entry.kind === "stock")) return;
    let section = String(header[0] || "").trim().toUpperCase();
    rows.slice(headerIndex + 1).forEach((row) => {
      const first = String(row[0]).trim();
      // El codigo esta en una de las primeras columnas; el nombre es el primer texto despues de el.
      const codeIndex = [0, 1, 2].find((index) => CODE_PATTERN.test(codeOf(row[index])));
      if (codeIndex === undefined) {
        if (/^(CONTROLES|CONSUMIBLES|SISTEMA|CALIBRADORES)/i.test(first)) section = first.toUpperCase();
        return;
      }
      const code = codeOf(row[codeIndex]);
      const name = [codeIndex + 1, codeIndex + 2, codeIndex - 1]
        .map((index) => (index >= 0 ? String(row[index] ?? "").trim() : ""))
        .find((text) => text && !/^[\d.,\s]+$/.test(text)) || "";
      if (!name) return;
      const deliveries = [];
      const stock = [];
      columns.forEach(({ column, kind, date }) => {
        const quantity = cellQuantity(row[column]);
        if (quantity === null) return;
        const iso = date.toISOString().slice(0, 10);
        if (kind === "delivery" && quantity > 0) deliveries.push({ date: iso, quantity });
        if (kind === "stock") stock.push({ date: iso, quantity });
      });
      // Las columnas no siempre van en orden de fecha.
      stock.sort((a, b) => a.date.localeCompare(b.date));
      if (stock.length < 2) return;
      const firstStock = stock[0];
      const lastStock = stock[stock.length - 1];
      const between = deliveries.filter((entry) => entry.date > firstStock.date && entry.date <= lastStock.date)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      const months = (Date.parse(lastStock.date) - Date.parse(firstStock.date)) / (30.4 * DAY_MS);
      const used = firstStock.quantity + between - lastStock.quantity;
      products.push({
        sheet: sheetName.trim(), itemType: typeOfSection(section, name), code: normalizeCode(code), name, module: moduleOf(name, sheetName),
        from: firstStock.date, to: lastStock.date, months: round(months), used: round(used),
        perMonth: months > 0 ? round(used / months, 4) : null, deliveries: deliveries.length, stockReadings: stock.length,
        delivered: round(deliveries.reduce((sum, entry) => sum + entry.quantity, 0)),
      });
    });
  });
  return products;
}

/**
 * Archivo de entregas en modalidad "determinaciones efectivas" (ej. HGP Puyo "2da ENTREGA"): por reactivo,
 * la cantidad requerida y las determinaciones efectivas reportadas por periodo ("Determinaciones
 * efectivas del dd/mm/aaaa al dd/mm/aaaa"). Es la demanda REAL de reactivos del laboratorio.
 */
function parseEffectiveDeterminations(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const out = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = rows.findIndex((row) => row.some((value) => /determinaciones efectivas/i.test(String(value))));
    if (headerIndex < 0) return;
    const header = rows[headerIndex].map((value) => String(value).trim());
    const required = header.findIndex((value) => /^CANTIDAD REQUERIDA/i.test(value));
    const periods = header.map((value, column) => {
      if (!/determinaciones efectivas/i.test(value)) return null;
      const dates = [...value.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].map((m) => Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
      if (!dates.length) return null;
      return { column, from: dates.length > 1 ? dates[0] : null, to: dates[dates.length - 1] };
    }).filter(Boolean);
    if (!periods.length) return;
    rows.slice(headerIndex + 1).forEach((row) => {
      const codeIndex = [0, 1, 2].find((index) => CODE_PATTERN.test(codeOf(row[index])));
      if (codeIndex === undefined) return;
      const name = String(row[codeIndex + 1] ?? "").trim();
      const reported = periods.map((period) => ({ ...period, determinations: Number(row[period.column]) || 0 }));
      // Meses cubiertos: del inicio del primer periodo con fecha "del" al fin del ultimo.
      const starts = reported.map((period) => period.from).filter(Boolean);
      const first = starts.length ? Math.min(...starts) : null;
      const last = Math.max(...reported.map((period) => period.to));
      const months = first ? (last - first) / (30.4 * DAY_MS) : null;
      const total = reported.filter((period) => period.from).reduce((sum, period) => sum + period.determinations, 0);
      out.push({
        sheet: sheetName.trim(), code: normalizeCode(codeOf(row[codeIndex])), name,
        required: required >= 0 ? Number(row[required]) || null : null,
        reportedInPeriods: round(total), months: months === null ? null : round(months),
        perMonth: months > 0 ? round(total / months, 3) : null,
      });
    });
  });
  return out;
}

/** Libro del especialista (hojas de calculo del BC) -> productos con DET, estabilidad y PRODUCTO A ENTREGAR. */
function parseSpecialistWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const rowsOut = [];
  const meta = {};
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const labelValue = (label) => rows.find((row) => String(row[0]).trim().toUpperCase().startsWith(label))?.[1] ?? null;
    let section = "REACTIVOS";
    let map = null;
    rows.forEach((row) => {
      const upper = row.map((value) => String(value).trim().toUpperCase());
      const planColumn = upper.findIndex((value) => value.startsWith("PRODUCTO A ENVIAR") || value.startsWith("PRODUCTO A ENTREGAR"));
      if (planColumn >= 0) {
        section = upper[0] && !["I.D", "DESCRIPCION"].includes(upper[0]) ? upper[0] : "REACTIVOS";
        map = {
          plan: planColumn,
          det: upper.findIndex((value) => value.startsWith("DET/AÑO")),
          stability: upper.findIndex((value) => value.startsWith("DIAS ESTABIL")),
        };
        return;
      }
      if (!map) return;
      // Los titulos no siempre coinciden con los datos: el codigo es la columna A o B que sea numerica.
      const codeIndex = Number(String(row[0]).trim()) > 0 ? 0 : (Number(String(row[1]).trim()) > 0 ? 1 : -1);
      if (codeIndex < 0) {
        if (/^(CONTROLES|CONSUMIBLES|SISTEMA|CALIBRADORES)/i.test(String(row[0]).trim())) section = String(row[0]).trim().toUpperCase();
        return;
      }
      const number = (value) => (value === "" || value === null || Number.isNaN(Number(value)) ? null : Number(value));
      const name = String(row[codeIndex === 0 ? 1 : 0]).trim();
      rowsOut.push({
        sheet: sheetName.trim(), itemType: typeOfSection(section, name), code: normalizeCode(row[codeIndex]), name, module: moduleOf(name, sheetName),
        det: map.det >= 0 ? number(row[map.det]) : null,
        stabilityDays: map.stability >= 0 ? number(row[map.stability]) : null,
        specialistQuantity: number(row[map.plan]),
      });
    });
    if (map) meta[sheetName.trim()] = { termMonths: labelValue("PLAZO"), projectionMonths: labelValue("PROYECCI") };
  });
  return { meta, rows: rowsOut };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

/**
 * Prediccion de los productos de un proceso con las tasas de referencia.
 * @param products [{ code, name, itemType, module }]
 * @param references [{ source, code, name, itemType, module, perMonth }] de OTROS procesos
 */
function predictFromReferences(products, references, { months, equipmentName = "cobas Pro c503 e801 ISE" }) {
  // Consumo real primero; lo que declaro jefe_servicio en otros procesos ("expert") solo si no hay real.
  const real = references.filter((reference) => reference.kind !== "expert");
  const expert = references.filter((reference) => reference.kind === "expert");
  const groupByCode = (list) => {
    const map = new Map();
    list.forEach((reference) => {
      if (!(reference.perMonth >= 0)) return;
      if (!map.has(reference.code)) map.set(reference.code, []);
      map.get(reference.code).push(reference);
    });
    return map;
  };
  const byCode = groupByCode(real);
  const expertByCode = groupByCode(expert);
  const families = {};
  real.forEach((reference) => {
    if (!(reference.perMonth >= 0)) return;
    const key = `${reference.itemType}::${reference.module}`;
    (families[key] ||= []).push(reference.perMonth);
  });
  const average = (list) => list.reduce((sum, entry) => sum + entry.perMonth, 0) / list.length;
  return products.map((product) => {
    const manual = evaluateEquipmentManual({
      identity: { supplierCode: product.code, itemType: product.itemType, equipmentName },
      processDurationMonths: months, environment: {},
    });
    if (manual?.status === "calculated") {
      return { ...product, prediction: manual.quantity, basis: "equipment_manual", detail: manual.formula };
    }
    const direct = byCode.get(product.code);
    if (direct?.length) {
      const rate = average(direct);
      return { ...product, prediction: Math.ceil(rate * months - 1e-9), basis: "reference_same_code", detail: `${round(rate, 3)} por mes × ${months} (${direct.map((entry) => entry.source).join(", ")})` };
    }
    const declared = expertByCode.get(product.code);
    if (declared?.length) {
      const rate = average(declared);
      return { ...product, prediction: Math.ceil(rate * months - 1e-9), basis: "reference_expert", detail: `${round(rate, 3)} por mes × ${months} (${declared.map((entry) => entry.source).join(", ")})` };
    }
    const productWords = words(product.name);
    const byName = productWords.length ? real.filter((reference) => reference.itemType === product.itemType
      && reference.perMonth >= 0 && productWords.every((word) => words(reference.name).includes(word))) : [];
    if (byName.length) {
      const rate = average(byName);
      return { ...product, prediction: Math.ceil(rate * months - 1e-9), basis: "reference_same_name", detail: `${round(rate, 3)} por mes × ${months} (${byName.map((entry) => `${entry.name}, ${entry.source}`).join("; ")})` };
    }
    const familyRate = median(families[`${product.itemType}::${product.module}`] || []);
    if (familyRate !== null) {
      return { ...product, prediction: Math.ceil(familyRate * months - 1e-9), basis: "reference_family_median", detail: `mediana de ${product.itemType} de ${product.module}: ${round(familyRate, 3)} por mes × ${months}` };
    }
    return { ...product, prediction: null, basis: "no_reference", detail: "Sin referencia" };
  });
}

/** Marca automatica: lo real difiere 5 veces o mas del motor y del especialista (unidad del registro). */
function unitSuspect(line) {
  if (!(line.real > 0)) return false;
  const far = (value) => value > 0 && Math.max(line.real / value, value / line.real) >= UNIT_SUSPECT_RATIO;
  return far(line.prediction) && (line.specialistQuantity === null || far(line.specialistQuantity));
}

const coincides = (predicted, real) => Math.abs(predicted - real) <= Math.max(1, COINCIDENCE_SHARE * real);

/** Error y aciertos de una columna contra lo real, sobre las mismas filas para todas las columnas. */
function score(lines, key) {
  let error = 0; let real = 0; let predicted = 0; let ok = 0;
  lines.forEach((line) => {
    error += Math.abs(line[key] - line.real); real += line.real; predicted += line[key];
    if (coincides(line[key], line.real)) ok += 1;
  });
  return { compared: lines.length, withinTolerance: ok, error: real ? round(error / real, 4) : null, totalDeviation: real ? round((predicted - real) / real, 4) : null };
}

function verify(lines) {
  const usable = lines.filter((line) => line.real !== null && line.real >= 0 && line.prediction !== null && line.specialistQuantity !== null);
  const clean = usable.filter((line) => !line.unitSuspect);
  const byType = Object.fromEntries(["calibrador", "control", "material"].map((type) => {
    const group = clean.filter((line) => line.itemType === type);
    return [type, { real: round(group.reduce((s, l) => s + l.real, 0)), engine: score(group, "prediction"), specialist: score(group, "specialistQuantity") }];
  }));
  return {
    compared: clean.length,
    excludedUnitSuspect: usable.filter((line) => line.unitSuspect).map((line) => line.name),
    engine: score(clean, "prediction"),
    specialist: score(clean, "specialistQuantity"),
    byType,
  };
}

module.exports = {
  COINCIDENCE_SHARE,
  UNIT_SUSPECT_RATIO,
  cellQuantity,
  parseConsumptionLog,
  parseSpecialistWorkbook,
  parseEffectiveDeterminations,
  predictFromReferences,
  unitSuspect,
  coincides,
  score,
  verify,
  __testables: { moduleOf, words, median },
};
