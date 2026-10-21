const { resolveRequiredInvestmentItems } = require("../investmentRequiredItems");

const catalog = [
  { id: 17, name: "Impresora", quantity: 0 },
  { id: 19, name: "Tinta", quantity: 0 },
  { id: 49, name: "A4 printer paper", quantity: 0 },
  { id: 21, name: "Impresora Zebra Termica ZD230 ETHERNET Y USB", quantity: 0 },
  { id: 48, name: "Etiquetas", quantity: 0 },
  { id: 67, name: "Otros", quantity: 0 },
];

describe("accesorios obligatorios de inversiones", () => {
  it("agrega tinta y papel al elegir impresora", () => {
    const { additions, violations } = resolveRequiredInvestmentItems({
      catalog,
      incoming: [{ catalog_id: 17, quantity: 2 }],
    });
    expect(violations).toEqual([]);
    expect(additions.map((item) => item.catalog_id).sort()).toEqual([19, 49]);
    expect(additions.every((item) => item.quantity === 1)).toBe(true);
  });

  it("la Zebra exige etiquetas, no tinta ni papel", () => {
    const { additions } = resolveRequiredInvestmentItems({
      catalog,
      incoming: [{ catalog_id: 21, quantity: 1 }],
    });
    expect(additions.map((item) => item.catalog_id)).toEqual([48]);
  });

  it("no duplica lo que ya esta en la lista", () => {
    const { additions } = resolveRequiredInvestmentItems({
      catalog: catalog.map((row) => (row.id === 19 ? { ...row, quantity: 3 } : row)),
      incoming: [{ catalog_id: 17, quantity: 1 }],
    });
    expect(additions.map((item) => item.catalog_id)).toEqual([49]);
  });

  it("rechaza dejar en 0 un obligatorio mientras haya impresora", () => {
    const { violations } = resolveRequiredInvestmentItems({
      catalog: catalog.map((row) => ([17, 19, 49].includes(row.id) ? { ...row, quantity: 1 } : row)),
      incoming: [{ catalog_id: 19, quantity: 0 }],
    });
    expect(violations).toEqual([{ trigger: "Impresora", required: "Tinta" }]);
  });

  it("quitar la impresora junto con sus consumibles es valido", () => {
    const { additions, violations } = resolveRequiredInvestmentItems({
      catalog: catalog.map((row) => ([17, 19, 49].includes(row.id) ? { ...row, quantity: 1 } : row)),
      incoming: [{ catalog_id: 17, quantity: 0 }, { catalog_id: 19, quantity: 0 }],
    });
    expect(violations).toEqual([]);
    expect(additions).toEqual([]);
  });

  it("un item de Otros llamado Impresora no dispara la regla", () => {
    const { additions } = resolveRequiredInvestmentItems({
      catalog: [...catalog, { id: 900, name: "Impresora", quantity: 1, parent_catalog_id: 67 }],
      incoming: [],
    });
    expect(additions).toEqual([]);
  });
});

describe("filas de Otros en el Sheet", () => {
  const { buildInvestmentRanges } = require("../businessCaseSheetSyncLocal.service");
  const template = {
    bc: {
      objectiveRows: new Map([["servidor", 71], ["otros", 121]]),
      investmentRowDefaults: new Map(),
      investmentSubtotalRow: 122,
    },
  };
  const inversiones = {
    Servidor: { nombre: "Servidor", cantidad: 1, precio: 500 },
    "otros_item:902": { otros_item: true, orden: 902, nombre: "Capacitacion", caracteristicas: "8 horas", cantidad: 2, precio: 50 },
    "otros_item:901": { otros_item: true, orden: 901, nombre: "Capacitacion", caracteristicas: "4 horas", cantidad: 1, precio: 30 },
    "Equipo nuevo": { nombre: "Equipo nuevo", cantidad: 1, precio: 10 },
  };
  const cell = (updates, range) => updates.find((u) => u.range === range)?.values[0][0];

  it("escribe cada item en su fila bajo Otros, en orden de creacion, sin tocar las de arriba", () => {
    const { updates, clears } = buildInvestmentRanges(template, inversiones, { otrosRowCount: 2 });
    expect(cell(updates, "BC!E71")).toBe(500);
    expect(cell(updates, "BC!B122")).toBe("4 HORAS");
    expect(cell(updates, "BC!F122")).toBe(30);
    expect(cell(updates, "BC!B123")).toBe("8 HORAS");
    expect(cell(updates, "BC!F123")).toBe(100);
    // Las filas dinamicas bajan las 2 filas insertadas.
    expect(cell(updates, "BC!E133")).toBe(10);
    expect(cell(updates, "BC!E131")).toBeUndefined();
    expect(clears).toEqual(["BC!A133:F207"]);
  });

  it("sin filas preparadas en la hoja, los items de Otros van a filas dinamicas", () => {
    const { updates } = buildInvestmentRanges(template, inversiones, { otrosRowCount: 0 });
    expect(cell(updates, "BC!A131")).toBe("CAPACITACION");
    expect(cell(updates, "BC!A132")).toBe("CAPACITACION");
    expect(cell(updates, "BC!E133")).toBe(10);
  });
});
