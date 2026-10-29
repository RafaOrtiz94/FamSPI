// Primer adaptador real del motor: la formula auditada de cantidades de cobas Pro <503+801>,
// aplicada a la duracion del proceso. Las pruebas usan las filas reales del libro auditado.
const { RULE_ADAPTERS, __testables } = require("../consumableRuleAdapters");
const { evaluateConsumableRule } = require("../consumableRules.rules");
const cobasQuantities = require("../calculationPackages/immunoChemistryCobasQuantities.package");

const { calculateCobasProProcess, COBAS_PRO_503_801 } = __testables;
const pkg = cobasQuantities.getQuantityPackage(COBAS_PRO_503_801.equipmentName);
const rowsOf = (productId) => pkg.modeledRows.filter((row) => row.productId === productId);
const firstRow = (block, extra = () => true) => pkg.modeledRows.find((row) => row.block === block && !row.minimumDividedByPerKit && extra(row));
const identity = (itemType, supplierCode) => ({ ...COBAS_PRO_503_801, itemType, supplierCode });

describe("registro de adaptadores", () => {
  test("solo hay adaptadores con fuente declarada y alcance exacto", () => {
    expect(RULE_ADAPTERS.length).toBe(4);
    RULE_ADAPTERS.forEach((adapter) => {
      expect(adapter.source).toMatchObject({ type: "audited_workbook" });
      expect(adapter.selector).toMatchObject(COBAS_PRO_503_801);
      expect(typeof adapter.calculate).toBe("function");
    });
    expect(RULE_ADAPTERS.map((a) => a.selector.itemType).sort()).toEqual(["calibrador", "control", "material", "reactivo"]);
  });

  test("el equipo del adaptador es el mismo que resuelve el libro auditado", () => {
    expect(cobasQuantities.resolveConfiguration(COBAS_PRO_503_801.equipmentName)).toBe("COBAS PRO c503 e801");
    expect(pkg.modeledRows.length).toBeGreaterThan(100);
  });
});

describe("formula del proceso (cobas Pro <503+801>)", () => {
  test("con 12 meses da exactamente lo mismo que la formula anual auditada del libro", () => {
    let checked = 0;
    pkg.modeledRows.forEach((row) => {
      if (rowsOf(row.productId).length !== 1) return; // los compartidos se prueban aparte
      const isReagent = row.block === "reactivo";
      const annualDemand = 5000;
      const result = calculateCobasProProcess({
        identity: identity(isReagent ? "reactivo" : "control", row.productId),
        processDurationMonths: 12,
        annualDemand: isReagent ? annualDemand : null,
        audited: { rows: [row], inUse: true, annualQuantity: 1 },
      });
      let minimum = row.minimumNumerator / row.stabilityDays;
      if (row.minimumDividedByPerKit) minimum /= row.perKit;
      const expected = Math.ceil((isReagent ? Math.max(annualDemand / row.perKit, minimum) : minimum) - 1e-9);
      expect(result.quantity).toBe(expected);
      checked += 1;
    });
    expect(checked).toBeGreaterThan(100);
  });

  test("reactivo: manda la demanda cuando supera al vencimiento, y se escala con los meses", () => {
    const row = firstRow("reactivo");
    const annualDemand = row.perKit * 40;
    const run = (months) => calculateCobasProProcess({
      identity: identity("reactivo", row.productId), processDurationMonths: months, annualDemand, audited: { rows: [row], inUse: true },
    });
    expect(run(12).quantity).toBe(40);
    expect(run(24).quantity).toBe(80);
    expect(run(15).quantity).toBe(50);
    expect(run(24).components.drivenBy).toBe("demand");
    expect(run(24).formula).toContain("pruebas del proceso");
  });

  test("reactivo con poca demanda: manda el vencimiento por estabilidad", () => {
    const row = firstRow("reactivo");
    const result = calculateCobasProProcess({
      identity: identity("reactivo", row.productId), processDurationMonths: 24, annualDemand: 1, audited: { rows: [row], inUse: true },
    });
    expect(result.quantity).toBe(Math.ceil((24 * 30) / row.stabilityDays - 1e-9));
    expect(result.components.drivenBy).toBe("stability");
  });

  test("calibrador o control en uso: dias del proceso entre estabilidad, redondeado hacia arriba", () => {
    const row = firstRow("control");
    const result = calculateCobasProProcess({
      identity: identity("control", row.productId), processDurationMonths: 18, audited: { rows: [row], inUse: true, annualQuantity: 13 },
    });
    expect(result.quantity).toBe(Math.ceil((18 * 30) / row.stabilityDays - 1e-9));
    expect(result.status).toBe("calculated");
    expect(result.annualAuditedQuantity).toBe(13);
  });

  test("producto que no esta en uso, o reactivo sin demanda: cantidad 0, como el libro", () => {
    const control = firstRow("control");
    const reagent = firstRow("reactivo");
    expect(calculateCobasProProcess({ identity: identity("control", control.productId), processDurationMonths: 24, audited: { rows: [control], inUse: false } }).quantity).toBe(0);
    expect(calculateCobasProProcess({ identity: identity("reactivo", reagent.productId), processDurationMonths: 24, annualDemand: 0, audited: { rows: [reagent], inUse: false } }).quantity).toBe(0);
  });

  test("producto en las dos pestañas: se entrega una vez, con la mayor necesidad", () => {
    const shared = pkg.modeledRows.find((row) => row.block !== "reactivo" && rowsOf(row.productId).length > 1);
    if (!shared) return;
    const rows = rowsOf(shared.productId);
    const result = calculateCobasProProcess({
      identity: identity("material", shared.productId), processDurationMonths: 24, audited: { rows, inUse: true },
    });
    const needs = rows.map((row) => {
      let need = (24 * 30) / row.stabilityDays;
      if (row.minimumDividedByPerKit) need /= row.perKit;
      return need;
    });
    expect(result.quantity).toBe(Math.ceil(Math.max(...needs) - 1e-9));
    expect(result.components.rows).toHaveLength(rows.length);
  });

  test("nunca sale verificado: las convenciones esperan validacion de experto", () => {
    const row = firstRow("control");
    const result = calculateCobasProProcess({ identity: identity("control", row.productId), processDurationMonths: 12, audited: { rows: [row], inUse: true } });
    expect(result.verified).toBe(false);
    expect(result.validation.status).toBe("pending_expert");
    expect(result.validation.conventions.length).toBeGreaterThan(0);
  });

  test("sin fila en el libro, o ISE, no fabrica cantidad", () => {
    const base = { identity: identity("material", "999"), processDurationMonths: 24 };
    expect(calculateCobasProProcess({ ...base, audited: { rows: [] } })).toMatchObject({ status: "no_rule", quantity: null, reason: { code: "AUDITED_ROW_NOT_FOUND" } });
    expect(calculateCobasProProcess({ ...base, audited: { rows: [], unmodeledReason: "ISE_REQUIRES_VOLUME_RULE" } }).reason.code).toBe("ISE_RULE_NOT_DEFINED");
    expect(calculateCobasProProcess({ ...base, audited: { rows: [], unmodeledReason: "MISSING_STABILITY_OR_PRESENTATION" } }).reason.code).toBe("AUDITED_ROW_NOT_CALCULABLE");
    expect(calculateCobasProProcess({ ...base, audited: null }).status).toBe("no_rule");
  });
});

describe("motor con el adaptador registrado", () => {
  const row = firstRow("control");

  test("calcula para el equipo exacto aunque el producto no tenga ficha tecnica", () => {
    const result = evaluateConsumableRule({
      identity: identity("control", row.productId), spec: null, processDurationMonths: 24, audited: { rows: [row], inUse: true },
    });
    expect(result.status).toBe("calculated");
    expect(result.quantity).toBe(Math.ceil((24 * 30) / row.stabilityDays - 1e-9));
    expect(result.rule).toMatchObject({ id: "cobas-pro-503-801.proceso.control", source: { type: "audited_workbook" } });
    expect(result.verified).toBe(false);
  });

  test("otro equipo, aunque sea parecido, sigue sin regla", () => {
    const result = evaluateConsumableRule({
      identity: { ...identity("control", row.productId), equipmentName: "cobas Pro <503> ISE", equipmentCode: "8463662001", family: "chemistry" },
      spec: { verification_status: "verified" }, processDurationMonths: 24, audited: { rows: [row], inUse: true },
    });
    expect(result).toMatchObject({ status: "no_rule", quantity: null, reason: { code: "RULE_ADAPTER_NOT_REGISTERED" } });
  });

  test("sin duracion del proceso no calcula", () => {
    const result = evaluateConsumableRule({ identity: identity("control", row.productId), spec: null, processDurationMonths: null, audited: { rows: [row], inUse: true } });
    expect(result).toMatchObject({ status: "no_rule", quantity: null, reason: { code: "PROCESS_DURATION_MISSING" } });
  });

  test("cuando el adaptador no tiene base, el motor devuelve no_rule con la regla que lo decidio", () => {
    const result = evaluateConsumableRule({ identity: identity("material", "999"), spec: null, processDurationMonths: 24, audited: { rows: [] } });
    expect(result).toMatchObject({ status: "no_rule", quantity: null, verified: false, reason: { code: "AUDITED_ROW_NOT_FOUND" } });
    expect(result.rule.id).toBe("cobas-pro-503-801.proceso.material");
  });
});
