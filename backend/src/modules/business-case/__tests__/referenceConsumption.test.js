const XLSX = require("xlsx");
const rc = require("../referenceConsumption");

const serial = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000) + 25569;
const book = (sheets) => {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

describe("consumo real de procesos de referencia", () => {
  test("lee cantidades de celdas con notas", () => {
    expect(rc.cellQuantity(3)).toBe(3);
    expect(rc.cellQuantity("2 y 1 en uso")).toBe(3);
    expect(rc.cellQuantity("1, caduca 30/06/2026")).toBe(1);
    expect(rc.cellQuantity("10 kits")).toBe(10);
    expect(rc.cellQuantity("DEBO 3")).toBeNull();
    expect(rc.cellQuantity("NO ENVIADO")).toBeNull();
  });

  test("registro: consumo = stock inicial + entregado - stock final, entre la primera y la ultima lectura", () => {
    const buffer = book({
      "QUIMICA ACTUAL": [
        ["", "COBAS PRO"],
        ["I.D", "DESCRIPCION", "", "DET/KIT", "DET/AÑO/PROCESO", "PRODUCTO CALCULADO", "PRODUCTO A ENVIAR"],
        ["CONTROLES Y CALIBRADORES", "", "", "", "", "", "", serial("2025-06-25"), "Stock 06/08/2025", serial("2025-08-12"), serial("2025-09-09"), "Stock 06/02/2026"],
        [5117003190, "PreciControl ClinChem Multi 1", "", "20 x 5", "", "", 13, 4, 14, 6, "DEBO 3", "2 y 1 en uso"],
      ],
    });
    const [product] = rc.parseConsumptionLog(buffer);
    // 14 + 6 (la entrega anterior a la primera lectura no cuenta) - 3 = 17 en 6 meses.
    expect(product).toMatchObject({ code: "5117003190", itemType: "control", used: 17 });
    expect(product.months).toBeCloseTo(6, 0);
  });

  test("libro del especialista: columnas por seccion y codigo en la columna que sea numerica", () => {
    const buffer = book({
      " e402 e801": [
        ["PLAZO", 12, "MESES"],
        ["DESCRIPCION", "I.D", "DET/KIT", "DIAS ESTABILIDAD", "DET/AÑO/PROCESO", "DET/ TOTAL", "PRODUCTO CALCULADO", "MINIMOS POR ESTABILIDAD", "PRODUCTO A ENVIAR"],
        [8443432190, "TSH Elecsys E2G 300", 300, 112, 3700, 4529, 15.1, 4.8, 17],
        ["CALIBRADORES", "", "PRESENTACION", "DIAS ESTABILIDAD", "", "", "PRODUCTO CALCULADO", "MINIMOS POR ESTABILIDAD", "PRODUCTO A ENTREGAR"],
        [8443459190, "TSH CalSet", 2, 84, "", "", "", 4.29, 6],
      ],
    });
    const { meta, rows } = rc.parseSpecialistWorkbook(buffer);
    expect(meta["e402 e801"]).toMatchObject({ termMonths: 12 });
    expect(rows).toEqual([
      expect.objectContaining({ code: "8443432190", itemType: "reactivo", det: 3700, specialistQuantity: 17, module: "inmuno" }),
      expect.objectContaining({ code: "8443459190", itemType: "calibrador", stabilityDays: 84, specialistQuantity: 6 }),
    ]);
  });

  test("prediccion: manual del equipo, mismo codigo (promedio), mismo nombre y mediana de la familia", () => {
    const references = [
      { source: "A", code: "1", name: "TSH CalSet", itemType: "calibrador", module: "inmuno", perMonth: 0.5 },
      { source: "B", code: "1", name: "TSH CalSet", itemType: "calibrador", module: "inmuno", perMonth: 1.5 },
      { source: "A", code: "2", name: "FSH CalSet II", itemType: "calibrador", module: "inmuno", perMonth: 0.25 },
    ];
    const lines = rc.predictFromReferences([
      { code: "10825468001", name: "Electrodo sodio", itemType: "material", module: "ise" },
      { code: "1", name: "TSH CalSet", itemType: "calibrador", module: "inmuno" },
      { code: "9", name: "FSH CalSet III", itemType: "calibrador", module: "inmuno" },
      { code: "8", name: "LH CalSet", itemType: "calibrador", module: "inmuno" },
      { code: "7", name: "Algo", itemType: "control", module: "quimica" },
    ], references, { months: 12 });
    expect(lines.map((line) => [line.basis, line.prediction])).toEqual([
      ["equipment_manual", 6], ["reference_same_code", 12], ["reference_same_name", 3], ["reference_family_median", 6], ["no_reference", null],
    ]);
  });

  test("verificacion: mismas filas para motor y especialista, sin las de unidad dudosa", () => {
    const lines = [
      { name: "A", itemType: "calibrador", prediction: 10, specialistQuantity: 12, real: 10 },
      { name: "B", itemType: "material", prediction: 36, specialistQuantity: 57, real: 303 },
      { name: "C", itemType: "control", prediction: 4, specialistQuantity: null, real: 5 },
    ].map((line) => ({ ...line, unitSuspect: rc.unitSuspect(line) }));
    expect(lines.map((line) => line.unitSuspect)).toEqual([false, true, false]);
    const result = rc.verify(lines);
    expect(result).toMatchObject({ compared: 1, excludedUnitSuspect: ["B"], engine: { withinTolerance: 1, error: 0 }, specialist: { error: 0.2 } });
  });
});

describe("secciones mixtas", () => {
  test("en CONTROLES Y CALIBRADORES el tipo sale del nombre", () => {
    const buffer = book({
      "c303 c503": [
        ["PLAZO", 12],
        ["CONTROLES Y CALIBRADORES", "", "", "PRESENTACION", "DIAS ESTABILDAD", "", "", "PRODUCTO CALCULADO", "MINIMOS POR ESTABILIDAD", "PRODUCTO A ENTREGAR"],
        [10759350190, "Calibrator f.a.s.", "", 12, 28, "", "", "", 12.8, 3],
        [3121313122, "PRECINORM PUC", "", 4, 28, "", "", "", 12.8, 6],
      ],
    });
    expect(rc.parseSpecialistWorkbook(buffer).rows.map((row) => row.itemType)).toEqual(["calibrador", "control"]);
  });
});

test("CS suelto es un CalSet de inmuno", () => {
  expect(rc.__testables.moduleOf("Cortisol CS")).toBe("inmuno");
  expect(rc.__testables.moduleOf("C.f.a.s. Cystatin C")).toBe("quimica");
});

test("lo declarado por jefe_servicio entra solo si no hay consumo real del mismo producto", () => {
  const references = [
    { source: "A", code: "1", name: "X", itemType: "control", module: "quimica", perMonth: 1 },
    { source: "jefe_servicio · B", code: "1", name: "X", itemType: "control", module: "quimica", perMonth: 5, kind: "expert" },
    { source: "jefe_servicio · B", code: "2", name: "Y", itemType: "control", module: "quimica", perMonth: 2, kind: "expert" },
  ];
  const lines = rc.predictFromReferences([
    { code: "1", name: "X", itemType: "control", module: "quimica" },
    { code: "2", name: "Y", itemType: "control", module: "quimica" },
  ], references, { months: 12 });
  expect(lines.map((line) => [line.basis, line.prediction])).toEqual([["reference_same_code", 12], ["reference_expert", 24]]);
});

describe("formatos HGP Puyo", () => {
  test("codigo en columna B, nombre en C, sin secciones (tipo por nombre) y stock fuera de orden", () => {
    const buffer = book({
      "402 2025": [
        ["", "Material Number", "Material Description", "QFAM", serial("2025-07-20"), "Stock 15/05/2026", serial("2025-09-01"), "Stock 12/01/2026", serial("2026-02-10")],
        ["", 9227261190, "AFP G2 CS Elecsys V3", 2, 2, 1, 1, 3, 1],
        ["", 5947626190, "PreciControl ClinChem Multi 1", 2, 4, 2, 2, 6, 0],
        ["", 8063354190, "ECO-D, 40T, cobas c pack green", 2, 4, 2, 3, 5, 0],
      ],
    });
    const products = rc.parseConsumptionLog(buffer);
    expect(products.map((p) => [p.code, p.itemType])).toEqual([["9227261190", "calibrador"], ["5947626190", "control"], ["8063354190", "material"]]);
    // Lecturas ordenadas por fecha: 12/01/2026 = 3 primero, 15/05/2026 = 1 al final.
    // 3 en stock + 1 entregado el 10/02/2026 - 1 al final = 3.
    expect(products[0]).toMatchObject({ from: "2026-01-12", to: "2026-05-15", used: 3 });
  });

  test("hoja TICS: etiquetas de stock en la fila de arriba de las fechas", () => {
    const buffer = book({
      QUIMICA: [
        ["HOJA DE CONTROL DE DETERMINACIONES"],
        ["Provincia /Ciudad", "", "", "", "", "Entregas", "", "", "STOCK 21/08/2026", "Stock al 25/09/2026"],
        ["I.D", "REACTIVO / CONTROL / CALIBRADOR / CONSUMIBLE", "DET/KIT", "CAJA", "UNIDADES", serial("2026-06-30"), serial("2026-08-21"), serial("2026-09-28"), "", ""],
        [10759350190, "Calibrator f.a.s.", 12, 2, 24, 3, 1, 2, 2, 2],
      ],
    });
    expect(rc.parseConsumptionLog(buffer)[0]).toMatchObject({ code: "10759350190", itemType: "calibrador", stockReadings: 2, delivered: 6 });
  });

  test("determinaciones efectivas reportadas por periodo", () => {
    const buffer = book({
      Hoja1: [
        ["No.", "Id", "DISPOSITIVO MÉDICO", "CANTIDAD REQUERIDA", "PRESENTACION", "Determinaciones efectivas al 28/09/2025", "Determinaciones efectivas del 29/09/2025 al 26/11/2025", "Determinaciones efectivas del 27/11/2025 al 13/01/2026"],
        [1, 8058750190, "Reactivos/Kit para determinación de ácido úrico", 1000, 1300, 500, 60, 40],
      ],
    });
    const [reagent] = rc.parseEffectiveDeterminations(buffer);
    // Solo los periodos con inicio y fin (29/09/2025 a 13/01/2026, unos 3,5 meses): 100 determinaciones.
    expect(reagent).toMatchObject({ code: "8058750190", required: 1000, reportedInPeriods: 100 });
    expect(reagent.months).toBeCloseTo(3.5, 1);
  });
});
