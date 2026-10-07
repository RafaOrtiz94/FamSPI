const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { executePackage, validatePackage } = require("../matrixCalculationEngine.service");
const { getQuantityPackage, resolveConfiguration } = require("../calculationPackages/immunoChemistryCobasQuantities.package");
const data = require("../calculationPackages/immunoChemistryCobasQuantities.data.json");

const pkg = getQuantityPackage("cobas Pro <503+801> ISE");
const rowFor = (productId, block) => pkg.modeledRows.find((row) => row.productId === productId && (!block || row.block === block));
const run = (inputs) => executePackage(pkg.packageDefinition, inputs).values;

describe("formula auditada de cantidades inmuno-quimica cobas Pro", () => {
  test("los parametros corresponden al libro auditado: si la plantilla cambia hay que regenerar y re-auditar", () => {
    const workbook = path.join(__dirname, "..", "..", "..", "..", "Mapeador_Sheets", data.sourceWorkbook.fileName);
    const sha256 = crypto.createHash("sha256").update(fs.readFileSync(workbook)).digest("hex");
    expect(sha256).toBe(data.sourceWorkbook.sha256);
  });

  test("solo aplica a cobas Pro 503+801 y el paquete es valido para el motor", () => {
    expect(resolveConfiguration("cobas Pro <503+801> ISE")).toBe("COBAS PRO c503 e801");
    expect(getQuantityPackage("cobas Pure <303>")).toBeNull();
    expect(getQuantityPackage("XN-1000 sin licencias")).toBeNull();
    expect(() => validatePackage(pkg.packageDefinition)).not.toThrow();
  });

  // Valores de las celdas del BC historico de Latacunga (junio 2026), fila 9 de "c303 c503":
  // DET/AÑO/PROCESO 13003, DET/KIT 1300, estabilidad 182 -> G9 = 10.00230769, H9 = 1.98.
  test("reactivo: reproduce las celdas del historico y entrega el maximo redondeado hacia arriba", () => {
    const uricAcid = rowFor("8058750190", "reactivo");
    const values = run({ [uricAcid.inputName]: 13003 });
    expect(Number(values[`${uricAcid.key}.calculatedQuantity`])).toBeCloseTo(10.00230769, 8);
    expect(Number(values[`${uricAcid.key}.stabilityMinimum`])).toBeCloseTo(1.98, 2);
    expect(Number(values[`${uricAcid.key}.roundedDeliverable`])).toBe(11);
  });

  test("reactivo: con poca demanda manda el minimo por estabilidad; sin demanda no se entrega", () => {
    const ggt = rowFor("8057796190", "reactivo"); // 400 det/kit, 84 dias -> minimo 4.29
    expect(Number(run({ [ggt.inputName]: 400 })[`${ggt.key}.roundedDeliverable`])).toBe(5);
    expect(Number(run({})[`${ggt.key}.roundedDeliverable`])).toBe(0);
  });

  test("calibrador/control: solo se entrega si esta vinculado a un reactivo con demanda", () => {
    const cfas = rowFor("10759350190"); // estabilidad 28 dias -> 360/28 = 12.86
    expect(cfas.inputName).toMatch(/^linked_/);
    expect(Number(run({ [cfas.inputName]: true })[`${cfas.key}.roundedDeliverable`])).toBe(13);
    expect(Number(run({})[`${cfas.key}.roundedDeliverable`])).toBe(0);
  });

  test("consumible: depende de que su modulo tenga reactivos con demanda", () => {
    const reactionCell = rowFor("7700814001"); // c503, estabilidad 60 dias -> 6
    expect(reactionCell.inputName).toBe("active_quimica");
    expect(Number(run({ active_quimica: true })[`${reactionCell.key}.roundedDeliverable`])).toBe(6);
    expect(Number(run({ active_inmuno: true })[`${reactionCell.key}.roundedDeliverable`])).toBe(0);
  });

  // El cobas Pro <503+801> son dos analizadores: la formula debe cubrir las dos
  // pestañas del libro ("c303 c503" y " e402 e801"), no solo una.
  test("alcance: modela las dos pestañas y un BC con reactivos de ambas activa los dos modulos", () => {
    const sheets = new Set(pkg.modeledRows.map((row) => row.sheet));
    expect(sheets).toEqual(new Set(["c303 c503", " e402 e801"]));
    for (const sheet of sheets) {
      const blocks = new Set(pkg.modeledRows.filter((row) => row.sheet === sheet).map((row) => row.block));
      expect(blocks.has("reactivo")).toBe(true);
      expect(blocks.has("consumible")).toBe(true);
    }

    const { buildQuantityEquipmentResult } = require("../businessCasePricingLab.service").__testables;
    const item = (item_id, annual_qty, item_type = "reactivo") => ({ item_key: `cons:16:${item_id}`, item_id, item_type, annual_qty, planned_qty: 0, equipment_id: 16 });
    const result = buildQuantityEquipmentResult({
      equipment: { equipment_id: 16, equipment_name: "cobas Pro <503+801> ISE", equipment_code: "PRO" },
      modality: "determinacion",
      quantityPackage: pkg,
      items: [item("8058750190", 13003), item("8443432190", 22003), item("4444191001", 0, "material")],
      // TSH (inmuno) vincula su calibrador; acido urico (quimica) vincula C.f.a.s.
      reagentLinks: new Map([["8058750190", ["10759350190"]], ["8443432190", ["8443459190"]]]),
    });

    expect(result.status).toBe("calculated");
    expect(result.inputs).toMatchObject({ reagentsWithDemand: 2, activeChemistry: true, activeImmunology: true });
    const quantity = (productId) => result.calculation.items.filter((entry) => entry.productId === productId);
    expect(quantity("8058750190")[0].calculatedQuantity).toBe(11); // quimica: 13003 / 1300
    expect(quantity("8443432190")[0].calculatedQuantity).toBe(74); // inmuno: 22003 / 300
    expect(quantity("10759350190")[0].calculatedQuantity).toBe(13); // calibrador de quimica
    expect(quantity("8443459190")[0].calculatedQuantity).toBe(5); // calibrador de inmuno: 360 / 84
    // Copillas esta en las dos pestañas: un solo renglon, marcado como compartido.
    expect(quantity("4444191001")).toHaveLength(1);
    expect(quantity("4444191001")[0]).toMatchObject({ calculatedQuantity: 1, sharedAcrossModules: true });
  });

  test("alcance: con reactivos solo de quimica no entrega consumibles ni calibradores de inmunologia", () => {
    const { buildQuantityEquipmentResult } = require("../businessCasePricingLab.service").__testables;
    const result = buildQuantityEquipmentResult({
      equipment: { equipment_id: 16, equipment_name: "cobas Pro <503+801> ISE" },
      modality: "determinacion",
      quantityPackage: pkg,
      items: [{ item_key: "cons:16:1", item_id: "8058750190", item_type: "reactivo", annual_qty: 13003, equipment_id: 16 }],
      reagentLinks: new Map([["8058750190", ["10759350190"]]]),
    });
    expect(result.inputs).toMatchObject({ activeChemistry: true, activeImmunology: false });
    const immunoIds = new Set(pkg.modeledRows.filter((row) => row.module === "inmuno").map((row) => row.productId));
    const chemistryIds = new Set(pkg.modeledRows.filter((row) => row.module === "quimica").map((row) => row.productId));
    const onlyImmuno = result.calculation.items.filter((entry) => immunoIds.has(entry.productId) && !chemistryIds.has(entry.productId));
    expect(onlyImmuno).toHaveLength(0);
  });

  test("excluye las filas del analizador que no corresponde y no modela electrolitos ni filas sin estabilidad", () => {
    expect(pkg.modeledRows.some((row) => ["c303", "e402"].includes(row.variant))).toBe(false);
    expect(pkg.modeledRows.some((row) => row.block === "ise")).toBe(false);
    expect(pkg.unmodeledRows.filter((row) => row.reason === "ISE_REQUIRES_VOLUME_RULE").length).toBeGreaterThan(0);
    expect(pkg.modeledRows.every((row) => row.stabilityDays > 0)).toBe(true);
  });
});
