jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const XLSX = require("xlsx");
const db = require("../../../config/db");
const history = require("../deliveryHistory.service");

// Mismo formato que el control de entregas de IESS Latacunga (fechas como serial de Excel).
const serial = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000) + 25569;
const workbook = () => {
  const header = ["CALIBRADORES", "", "CANTIDADES MAXIMAS / CAJA", "CANTIDADES MAXIMAS / UNIDADES", "PRESENTACION", "TOTAL ENTREGADOS", "RESTANTES",
    serial("2024-09-18"), serial("2024-12-18"), serial("2024-02-28"), serial("2025-03-18"), "Stock 05/11/2025"];
  const rows = [
    header,
    [8443459190, "TSH CalSet", 7, 14, "4 x 1.3", 8, 6, 2, 2, "", 4, ""],
    ["CONTROLES", "", "", "", "ml", 0, "", "", "", "", "", ""],
    [11731416190, "PreciControl Universal", 23, 46, "4 x 3", 50, -4, 20, 20, "", 10, 6],
    ["ID", "CONSUMIBLES", "", "", "", 0, 0, "", "", "", "", ""],
    ["", "AGUA BIDESTILADA", 420, 420, "", 105, 315, 25, 80, "", "", ""],
    ["", "MENSUAL ", "", "", "", "", "", "", "", "", "", ""],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "INMUNO");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
};

describe("historial de entregas reales", () => {
  test("lee el control de entregas: unidades a cajas, secciones, entregas y stock", () => {
    const items = history.parseControlFile(workbook());
    const byName = Object.fromEntries(items.map((item) => [item.productName, item]));
    expect(byName["TSH CalSet"]).toMatchObject({ itemType: "calibrador", supplierCode: "8443459190", unitsPerBox: 2, deliveredBoxes: 4, contractedBoxes: 7 });
    expect(byName["TSH CalSet"].deliveries).toHaveLength(3);
    expect(byName["PreciControl Universal"]).toMatchObject({ itemType: "control", deliveredBoxes: 25 });
    expect(byName["PreciControl Universal"].stock).toEqual([{ label: "Stock 05/11/2025", units: 6 }]);
    expect(byName["AGUA BIDESTILADA"]).toMatchObject({ itemType: "material", supplierCode: null, deliveredBoxes: 105 });
    expect(byName["MENSUAL"]).toBeUndefined();
  });

  test("periodo: de la primera a la ultima entrega mas el intervalo medio, sin fechas mal tipeadas", () => {
    const [item] = history.parseControlFile(workbook());
    // 2024-09-18 a 2025-03-18 (181 dias) + 90,5 dias medios = 271,5 dias; se ignora 2024-02-28.
    expect(item.period.months).toBeCloseTo(271.5 / 30.4, 1);
  });

  test("lo entregado se lleva a la duracion del proceso", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ item_type: "control", supplier_code: "011731416190", delivered_boxes: "25", period_months: "10" }] });
    const real = await history.realForProcess("bc", 15);
    expect(real.get("control::11731416190")).toBe(37.5);
  });
});
