/**
 * Formula auditada de CANTIDADES para inmuno-quimica cobas (pestañas
 * "c303 c503" y " e402 e801" de TABLA BASE BC.xlsx). No calcula precios.
 *
 * Reglas, tal como estan en las celdas del libro:
 *   Reactivo:    calculado = DET/AÑO/PROCESO / DET/KIT        (=F9/D9)
 *                minimo    = 360 / dias de estabilidad         (=(360/E9))
 *                a enviar  = ROUNDUP(max(calculado, minimo)) solo si hay demanda
 *   Resto:       a entregar = ROUNDUP(minimo por estabilidad) solo si el producto
 *                esta en uso. "En uso" se deriva de los reactivos con demanda:
 *     - calibradores y controles: vinculados a un reactivo con demanda segun la
 *       ficha del producto (catalog_consumable_specs.parameters.linked_products);
 *     - consumibles: el modulo (quimica / inmuno) tiene algun reactivo con demanda.
 *
 * Electrolitos (ISE) queda FUERA: su consumo depende del volumen de muestras y el
 * libro solo trae el minimo por estabilidad (p. ej. 360 cajas para un estandar de
 * 1 dia), que no representa lo que se entrega. Necesita su propia regla.
 *
 * El libro deja vacia la columna "a enviar" de los reactivos y solo la llena en
 * los consumibles de inmuno (= minimo). La regla max(calculado, minimo) es la
 * misma que ya esta auditada en las matrices de hematologia (=IF(G>H,G,H)).
 *
 * Los parametros (DET/KIT, presentacion, estabilidad) salen de
 * immunoChemistryCobasQuantities.data.json, generado con
 * scripts/generate_cobas_quantity_package_data.js y atado al SHA-256 del libro.
 */
const data = require("./immunoChemistryCobasQuantities.data.json");

const VERSION = "2026-10-02.1";

// Analizadores de cada configuracion: las filas marcadas c303/c503/e402/e801
// solo aplican a su analizador; las no marcadas aplican a todos.
const CONFIGURATIONS = Object.freeze({
  "COBAS PRO c503 e801": Object.freeze(["c503", "e801"]),
});

const REAGENT_LINK_BLOCKS = new Set(["calibrador_control", "calibrador", "control"]);

function rowKey(row) {
  return `${row.module}_${row.row}`;
}

function previousColumn(cell) {
  const match = String(cell).match(/^([A-Z])(\d+)$/);
  return `${String.fromCharCode(match[1].charCodeAt(0) - 1)}${match[2]}`;
}

function resolveConfiguration(equipmentName) {
  const name = String(equipmentName || "").toLowerCase();
  if (/cobas\s*pro/.test(name) && /503/.test(name) && /801/.test(name)) return "COBAS PRO c503 e801";
  return null;
}

function rowsForConfiguration(configuration) {
  const variants = CONFIGURATIONS[configuration];
  if (!variants) return [];
  return data.rows.filter((row) => !row.variant || variants.includes(row.variant));
}

function stabilityMinimumExpression(row) {
  const base = { op: "divide", args: [{ value: row.minimumNumerator }, { value: row.stabilityDays }] };
  return row.minimumDividedByPerKit ? { op: "divide", args: [base, { value: row.perKit }] } : base;
}

function buildPackage(configuration) {
  const rows = rowsForConfiguration(configuration);
  if (!rows.length) return null;

  const inputs = {
    active_quimica: {
      type: "boolean",
      default: false,
      source: { sheet: "c303 c503", cell: "F82", label: "TOTAL DET > 0 (modulo de quimica en uso)" },
    },
    active_inmuno: {
      type: "boolean",
      default: false,
      source: { sheet: " e402 e801", cell: "E112", label: "TOTAL DET > 0 (modulo de inmunologia en uso)" },
    },
  };
  const rules = [];
  const modeledRows = [];
  const unmodeledRows = [];
  const occurrences = new Map();

  for (const row of rows) {
    const isReagent = row.block === "reactivo";
    if (row.block === "ise") {
      unmodeledRows.push({ ...row, reason: "ISE_REQUIRES_VOLUME_RULE" });
      continue;
    }
    // Sin estabilidad (o sin DET/KIT en un reactivo) la celda del libro es #DIV/0!: no se publica.
    if (!row.stabilityDays || (isReagent && !row.perKit) || (row.minimumDividedByPerKit && !row.perKit)) {
      unmodeledRows.push({ ...row, reason: "MISSING_STABILITY_OR_PRESENTATION" });
      continue;
    }

    const key = rowKey(row);
    const occurrence = (occurrences.get(row.productId) || 0) + 1;
    occurrences.set(row.productId, occurrence);
    const identity = {
      kind: "item",
      configuration,
      section: row.block,
      productId: row.productId,
      productName: row.name,
      occurrence,
    };
    const rule = (suffix, cell, formula, expression) => rules.push({
      id: `${key}.${suffix}`,
      identity,
      source: { sheet: row.sheet, cell, formula },
      expression,
    });
    const minimumFormula = row.minimumDividedByPerKit
      ? `=(${row.minimumNumerator}/${row.cells.stability})/${row.cells.perKit}`
      : `=(${row.minimumNumerator}/${row.cells.stability})`;

    let inputName;
    if (isReagent) {
      inputName = `demand_${key}`;
      const demandCell = previousColumn(row.cells.calculated);
      inputs[inputName] = {
        type: "number",
        default: 0,
        source: { sheet: row.sheet, cell: demandCell, label: "DET/AÑO/PROCESO" },
      };
      rule("testsPerKit", row.cells.perKit, String(row.perKit), { value: row.perKit });
      rule(
        "calculatedQuantity",
        row.cells.calculated,
        `=${demandCell}/${row.cells.perKit}`,
        { op: "divide", args: [{ input: inputName }, { ref: `${key}.testsPerKit` }] },
      );
      rule("stabilityMinimum", row.cells.minimum, minimumFormula, stabilityMinimumExpression(row));
      rule(
        "deliverableQuantity",
        row.cells.deliverable,
        `=IF(${demandCell}>0,MAX(${row.cells.calculated},${row.cells.minimum}),0)`,
        {
          op: "if",
          args: [
            { op: "gt", args: [{ input: inputName }, { value: 0 }] },
            { op: "max", args: [{ ref: `${key}.calculatedQuantity` }, { ref: `${key}.stabilityMinimum` }] },
            { value: 0 },
          ],
        },
      );
    } else {
      if (REAGENT_LINK_BLOCKS.has(row.block)) {
        inputName = `linked_${key}`;
        inputs[inputName] = {
          type: "boolean",
          default: false,
          source: { sheet: row.sheet, cell: `A${row.row}`, label: "Vinculado a un reactivo con demanda (ficha del producto)" },
        };
      } else {
        inputName = `active_${row.module}`;
      }
      rule("stabilityMinimum", row.cells.minimum, minimumFormula, stabilityMinimumExpression(row));
      rule(
        "deliverableQuantity",
        row.cells.deliverable,
        `=${row.cells.minimum}`,
        { op: "if", args: [{ input: inputName }, { ref: `${key}.stabilityMinimum` }, { value: 0 }] },
      );
    }
    rule(
      "roundedDeliverable",
      row.cells.deliverable,
      `=ROUNDUP(${row.cells.deliverable},0)`,
      { op: "round_up", args: [{ ref: `${key}.deliverableQuantity` }, { value: 0 }] },
    );
    modeledRows.push({ ...row, key, inputName });
  }

  return {
    packageDefinition: Object.freeze({
      packageId: "inmuno-quimica-cobas-pro-c503-e801-cantidades",
      version: VERSION,
      sourceWorkbook: { ...data.sourceWorkbook },
      scope: { family: "inmuno_quimica", equipment: configuration, modality: "cantidades" },
      inputs,
      rules,
    }),
    modeledRows,
    unmodeledRows,
  };
}

const packageCache = new Map();
function getQuantityPackage(equipmentName) {
  const configuration = resolveConfiguration(equipmentName);
  if (!configuration) return null;
  if (!packageCache.has(configuration)) packageCache.set(configuration, buildPackage(configuration));
  return packageCache.get(configuration);
}

module.exports = { VERSION, getQuantityPackage, resolveConfiguration, REAGENT_LINK_BLOCKS };
