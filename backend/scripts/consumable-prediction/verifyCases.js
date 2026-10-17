"use strict";

/**
 * Verificacion automatica del motor de prediccion contra procesos reales.
 *
 * Casos:
 *   - Carpeta de casos (por defecto docs/Motor predictivo BC): cada subcarpeta es un caso; si no hay
 *     subcarpetas, la carpeta entera es un caso. Un caso = libro del BC (hojas del especialista con
 *     PRODUCTO A ENTREGAR) + registro de consumibles (entregas y lecturas de stock).
 *     Si la subcarpeta tiene varios procesos, un casos.json los declara:
 *       [{ "nombre", "bc", "consumo", "hojasConsumo": [..], "enCurso": true, "historialDe": "<nombre>",
 *          "determinacionesEfectivas": "<archivo>" }]
 *     enCurso: aun sin consumo medible; se genera la prediccion y lo entregado a la fecha, sin metricas.
 *     historialDe: el mismo cliente en un proceso anterior; su consumo real manda (cliente que repite).
 *   - Base de datos (--db): Business Case con historial de entregas reales (bc_delivery_history).
 * Cada caso se predice como cliente nuevo SOLO con los demas (dejar uno fuera) y se compara contra su
 * consumo real. Escribe un Excel por caso en <carpeta>/Verificacion, lo vuelve a leer y comprueba que
 * cada cantidad escrita es la calculada.
 *
 *   node scripts/consumable-prediction/verifyCases.js [--dir=<carpeta>] [--db] [--load]
 * Con --load guarda el consumo real de los casos de la carpeta en bc_reference_consumption (referencias
 * del motor para clientes nuevos), sin los productos marcados con unidad dudosa.
 * Con --db se ejecuta con el entorno del staging local (scripts/staging_local.ps1) o con Secret Manager.
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const rc = require("../../src/modules/business-case/referenceConsumption");

const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [k, v] = arg.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const caseDir = path.resolve(__dirname, "../../..", args.dir || "docs/Motor predictivo BC");
const outDir = path.join(caseDir, "Verificacion");
const pct = (value) => (value === null || value === undefined ? "-" : `${Math.round(value * 100)} %`);
const normalizeCode = (value) => String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");
// Meses minimos entre la primera y la ultima lectura de stock para tomar el consumo como verdad.
const MIN_MEASURED_MONTHS = 3;

function readCase(folder, spec) {
  const name = spec.nombre;
  const files = spec.bc && spec.consumo
    ? [spec.bc, spec.consumo]
    : fs.readdirSync(folder).filter((file) => /\.xlsx?$/i.test(file) && !file.startsWith("~$") && !/^Prediccion motor|^Verificacion/i.test(file));
  let specialist = null; let log = null;
  files.forEach((file) => {
    const buffer = fs.readFileSync(path.join(folder, file));
    const workbook = rc.parseSpecialistWorkbook(buffer);
    if ((spec.bc ? file === spec.bc : workbook.rows.filter((row) => row.specialistQuantity > 0).length >= 10) && !specialist) { specialist = { file, ...workbook }; return; }
    const consumption = rc.parseConsumptionLog(buffer, { sheets: file === spec.consumo ? spec.hojasConsumo || null : null });
    if (consumption.length >= 10 && !log) log = { file, products: consumption };
  });
  if (!specialist || !log) return { name, skipped: `falta ${!specialist ? "el libro del BC" : "el registro de consumibles"}` };
  const months = Number(Object.values(specialist.meta).map((m) => m.termMonths).find((v) => Number(v) > 0)) || 12;
  const measured = (p) => p.months >= MIN_MEASURED_MONTHS && p.perMonth !== null;
  const realByCode = new Map(spec.enCurso ? [] : log.products.filter(measured).map((p) => [p.code, p]));
  const deliveredByCode = new Map(log.products.map((p) => [p.code, p.delivered]));
  const seen = new Set();
  const products = specialist.rows.filter((row) => row.itemType !== "reactivo" && (row.specialistQuantity > 0 || realByCode.has(row.code)))
    .filter((row) => (seen.has(row.code) ? false : seen.add(row.code)))
    .map((row) => ({ code: row.code, name: row.name, itemType: row.itemType, module: row.module, specialistQuantity: row.specialistQuantity ?? null,
      real: realByCode.has(row.code) && realByCode.get(row.code).used >= 0 ? Number((realByCode.get(row.code).perMonth * months).toFixed(2)) : null,
      deliveredToDate: deliveredByCode.get(row.code) ?? null }));
  const references = spec.enCurso ? [] : log.products.filter((p) => measured(p) && p.perMonth >= 0 && p.itemType !== "reactivo")
    .map((p) => ({ source: name, code: p.code, name: p.name, itemType: p.itemType, module: p.module, perMonth: p.perMonth }));
  // Demanda real de reactivos (determinaciones efectivas reportadas) contra el DET del BC.
  let reagentDemand = null;
  if (spec.determinacionesEfectivas) {
    const reported = rc.parseEffectiveDeterminations(fs.readFileSync(path.join(folder, spec.determinacionesEfectivas)));
    const detByCode = new Map(specialist.rows.filter((row) => row.itemType === "reactivo" && row.det > 0).map((row) => [row.code, row.det]));
    const matched = reported.filter((r) => r.perMonth !== null && detByCode.has(r.code));
    const planned = matched.reduce((sum, r) => sum + detByCode.get(r.code) / months, 0);
    const real = matched.reduce((sum, r) => sum + r.perMonth, 0);
    reagentDemand = { reagents: matched.length, plannedPerMonth: Math.round(planned), realPerMonth: Math.round(real), ratio: planned ? Number((real / planned).toFixed(3)) : null,
      months: matched[0]?.months ?? null, file: spec.determinacionesEfectivas };
  }
  return { name, source: `${specialist.file} + ${log.file}`, months, products, references, fromFolder: true, logFile: log.file,
    inProgress: spec.enCurso === true, historyOf: spec.historialDe || null, reagentDemand };
}

function readFolderCases(folder) {
  const manifest = path.join(folder, "casos.json");
  if (fs.existsSync(manifest)) return JSON.parse(fs.readFileSync(manifest, "utf8")).map((spec) => readCase(folder, spec));
  return [readCase(folder, { nombre: path.basename(folder) })];
}

async function readDbCases() {
  const db = require("../../src/config/db");
  const { rows } = await db.query(
    `SELECT h.business_case_id::text AS id, MAX(v.client_name) AS client, MAX(rq.projected_deadline_months) AS months
       FROM bc_delivery_history h
       LEFT JOIN v_business_cases_complete v ON v.business_case_id = h.business_case_id
       LEFT JOIN bc_requirements rq ON rq.business_case_id = h.business_case_id
      GROUP BY 1`,
  );
  const cases = [];
  for (const row of rows) {
    const months = Number(row.months) || 12;
    const history = (await db.query(
      `SELECT item_type, supplier_code, product_name, delivered_boxes::float AS boxes, period_months::float AS period
         FROM bc_delivery_history WHERE business_case_id = $1 AND supplier_code IS NOT NULL`, [row.id])).rows;
    const planned = (await db.query(
      `SELECT LOWER(item_type) AS item_type, item_id, MAX(name) AS name, SUM(planned_qty)::float AS planned
         FROM bc_consumption_items WHERE business_case_id = $1 AND LOWER(item_type) <> 'reactivo' GROUP BY 1, 2`, [row.id])).rows;
    const rate = new Map(history.map((h) => [normalizeCode(h.supplier_code), h.boxes / (h.period || months)]));
    const moduleOf = rc.__testables.moduleOf;
    const products = planned.filter((p) => p.planned > 0 || rate.has(normalizeCode(p.item_id))).map((p) => ({
      code: normalizeCode(p.item_id), name: p.name, itemType: p.item_type, module: moduleOf(p.name),
      specialistQuantity: p.planned ?? null, real: rate.has(normalizeCode(p.item_id)) ? Number((rate.get(normalizeCode(p.item_id)) * months).toFixed(2)) : null,
    }));
    const references = history.map((h) => ({ source: row.client || row.id.slice(0, 8), code: normalizeCode(h.supplier_code), name: h.product_name, itemType: h.item_type, module: moduleOf(h.product_name), perMonth: h.boxes / (h.period || months) }));
    cases.push({ name: row.client || row.id.slice(0, 8), source: "base de datos (bc_delivery_history)", months, products, references });
  }
  return cases;
}

async function writeAndCheck(target, lines, result) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `Verificacion motor - ${target.name.replace(/[\\/:*?"<>|]/g, "_")}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prediccion");
  sheet.columns = [
    { header: "Tipo", key: "itemType", width: 11 }, { header: "Modulo", key: "module", width: 9 }, { header: "ID", key: "code", width: 13 },
    { header: "Producto", key: "name", width: 42 }, { header: `Prediccion motor (${target.months} meses)`, key: "prediction", width: 16 },
    { header: "PRODUCTO A ENTREGAR especialista", key: "specialistQuantity", width: 18 }, { header: `Consumo real (llevado a ${target.months} meses)`, key: "real", width: 18 },
    { header: "Entregado a la fecha", key: "deliveredToDate", width: 12 },
    { header: "Motor - real", key: "engineDiff", width: 11 }, { header: "Especialista - real", key: "specialistDiff", width: 12 },
    { header: "Revisar unidad", key: "unit", width: 10 }, { header: "Base", key: "basis", width: 22 }, { header: "Detalle", key: "detail", width: 70 },
  ];
  lines.forEach((line) => sheet.addRow({
    ...line,
    engineDiff: line.prediction !== null && line.real !== null ? Number((line.prediction - line.real).toFixed(2)) : null,
    specialistDiff: line.specialistQuantity !== null && line.real !== null ? Number((line.specialistQuantity - line.real).toFixed(2)) : null,
    unit: line.unitSuspect ? "si" : "",
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "M1" };
  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [{ width: 44 }, { width: 22 }, { width: 22 }];
  [
    ["Caso", target.name], ["Fuente", target.source], ["Referencias usadas", result.referenceSources.join(", ") || "-"],
    ["Como se predijo", "Como cliente nuevo: solo con el consumo real de los demas casos y las reglas del manual del equipo."],
    ["Productos medidos", result.inProgress ? "Proceso en curso: todavia sin consumo medible; comparar contra lo entregado a la fecha y verificar al cierre." : `${result.compared} (mismos para motor y especialista; sin ${result.excludedUnitSuspect.length} con unidad dudosa)`],
    ["Demanda real de reactivos", result.reagentDemand ? `${result.reagentDemand.realPerMonth} determinaciones/mes reportadas contra ${result.reagentDemand.plannedPerMonth}/mes del DET del BC (${pct(result.reagentDemand.ratio)}) en ${result.reagentDemand.reagents} reactivos, ${result.reagentDemand.months} meses (${result.reagentDemand.file})` : "-"],
    [], ["", "Motor", "Especialista"],
    ["Dentro de +/-15 %", result.engine.withinTolerance, result.specialist.withinTolerance],
    ["Error por producto", pct(result.engine.error), pct(result.specialist.error)],
    ["Desvio del total", pct(result.engine.totalDeviation), pct(result.specialist.totalDeviation)],
    [], ["Desvio del total por tipo", "Motor", "Especialista"],
    ...Object.entries(result.byType).map(([type, value]) => [`${type} (real ${Math.round(value.real)})`, pct(value.engine.totalDeviation), pct(value.specialist.totalDeviation)]),
    [], ["Excluidos por unidad dudosa", result.excludedUnitSuspect.join(", ") || "-"],
  ].forEach((row) => summary.addRow(row));
  summary.getColumn(1).font = { bold: true };
  await workbook.xlsx.writeFile(file);

  // Comprobacion: se vuelve a leer el archivo y cada prediccion escrita debe ser la calculada.
  const back = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets.Prediccion, { defval: null });
  const mismatches = back.filter((row, index) => (row[`Prediccion motor (${target.months} meses)`] ?? null) !== (lines[index].prediction ?? null)
    || String(row.ID) !== String(lines[index].code));
  return { file, rowsWritten: back.length, mismatches: mismatches.length };
}

(async () => {
  const folders = fs.existsSync(caseDir) ? fs.readdirSync(caseDir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "Verificacion").map((e) => path.join(caseDir, e.name)) : [];
  const cases = (folders.length ? folders : [caseDir]).flatMap((folder) => readFolderCases(folder));
  if (args.db) cases.push(...await readDbCases());
  cases.filter((c) => c.skipped).forEach((c) => console.log(`OMITIDO ${c.name}: ${c.skipped}`));
  const usable = cases.filter((c) => !c.skipped);
  console.log(`Casos: ${usable.length} (${usable.map((c) => c.name).join(", ")})`);
  const report = [];
  let failed = false;
  for (const target of usable) {
    const references = usable.filter((other) => other !== target && other.name !== target.historyOf).flatMap((other) => other.references);
    const history = usable.find((other) => other.name === target.historyOf) || null;
    if (!references.length && !history) { console.log(`${target.name}: sin otros casos para predecir (hace falta al menos 2)`); continue; }
    const historyByCode = new Map((history?.references || []).map((reference) => [reference.code, reference]));
    const fromReferences = rc.predictFromReferences(target.products, references, { months: target.months });
    const lines = fromReferences.map((line) => {
      const own = historyByCode.get(line.code);
      // Cliente que repite: su propio consumo real del proceso anterior manda (salvo el manual del equipo).
      if (own && line.basis !== "equipment_manual") {
        return { ...line, prediction: Math.ceil(own.perMonth * target.months - 1e-9), basis: "client_history", detail: `${own.perMonth} por mes × ${target.months} (${own.source})` };
      }
      return line;
    }).map((line) => ({ ...line, unitSuspect: rc.unitSuspect(line) }));
    const result = { ...rc.verify(lines), referenceSources: [...new Set([...(history ? [`${history.name} (historial propio)`] : []), ...references.map((r) => r.source)])], inProgress: target.inProgress, reagentDemand: target.reagentDemand };
    const check = await writeAndCheck(target, lines, result);
    if (check.mismatches) failed = true;
    report.push({ caso: target.name, ...result, archivo: check.file, comprobacion: check });
    if (args.load && target.fromFolder && !target.inProgress) {
      const db = require("../../src/config/db");
      const suspect = new Set(lines.filter((line) => line.unitSuspect).map((line) => line.code));
      const rows = target.references.filter((reference) => !suspect.has(reference.code));
      await db.query("DELETE FROM bc_reference_consumption WHERE source_name = $1", [target.name]);
      for (const reference of rows) {
        await db.query(
          `INSERT INTO bc_reference_consumption (source_name, item_type, supplier_code, product_name, module, per_month, source_file)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (source_name, item_type, supplier_code) DO UPDATE SET per_month = EXCLUDED.per_month, loaded_at = NOW()`,
          [target.name, reference.itemType, reference.code, reference.name, reference.module, reference.perMonth, target.logFile],
        );
      }
      console.log(`   cargado como referencia del motor: ${rows.length} productos (sin ${suspect.size} con unidad dudosa)`);
    }
    console.log(`\n== ${target.name} (${target.months} meses) con referencias: ${result.referenceSources.join(", ")}`);
    if (result.reagentDemand) console.log(`   demanda real de reactivos: ${result.reagentDemand.realPerMonth}/mes contra ${result.reagentDemand.plannedPerMonth}/mes del DET del BC (${pct(result.reagentDemand.ratio)}) en ${result.reagentDemand.reagents} reactivos`);
    if (result.inProgress) {
      const delivered = lines.filter((line) => line.deliveredToDate > 0);
      console.log(`   EN CURSO: prediccion para ${lines.filter((line) => line.prediction !== null).length} productos; ${delivered.length} ya tienen entregas a la fecha (verificar al cierre)`);
    }
    console.log(`   productos medidos ${result.compared} · excluidos por unidad dudosa: ${result.excludedUnitSuspect.join(", ") || "ninguno"}`);
    console.log(`   motor:        ±15% ${result.engine.withinTolerance}/${result.compared} · error ${pct(result.engine.error)} · desvio del total ${pct(result.engine.totalDeviation)}`);
    console.log(`   especialista: ±15% ${result.specialist.withinTolerance}/${result.compared} · error ${pct(result.specialist.error)} · desvio del total ${pct(result.specialist.totalDeviation)}`);
    Object.entries(result.byType).forEach(([type, value]) => console.log(`   ${type.padEnd(10)} real ${Math.round(value.real)} · desvio motor ${pct(value.engine.totalDeviation)} · especialista ${pct(value.specialist.totalDeviation)}`));
    console.log(`   archivo: ${check.file} · filas ${check.rowsWritten} · comprobacion ${check.mismatches ? `FALLA (${check.mismatches} diferencias)` : "OK"}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "verificacion.json"), JSON.stringify({ fecha: new Date().toISOString(), casos: report }, null, 1));
  if (failed) process.exitCode = 1;
  setTimeout(() => process.exit(process.exitCode || 0), 300);
})().catch((error) => { console.error(error); process.exit(1); });
