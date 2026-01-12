const XLSX = require("xlsx");
const pdfGenerator = require("../pdfGenerator.service");
const excelExporter = require("../excelExporter.service");

jest.mock("../businessCase.service", () => ({
  getBusinessCaseById: jest.fn().mockResolvedValue({
    business_case_id: 1,
    client_name: "Clinica Demo",
    status: "draft",
    bc_stage: "pending",
    assigned_to_name: "Ana Perez",
    modern_bc_metadata: { investments: [{ name: "Equipo auxiliar", amount: 1200, type: "opex" }] },
  }),
  getCalculations: jest.fn().mockResolvedValue({
    monthlyCost: 1500,
    annualCost: 18000,
    totalConsumption: 300,
    totalTests: 1200,
    utilization: 75,
    warnings: ["Capacidad por encima del 70%"],
  }),
}));

jest.mock("../determinations.service", () => ({
  getDeterminations: jest.fn().mockResolvedValue([
    {
      determination_id: 10,
      name: "Glucosa",
      category: "Química",
      monthly_quantity: 500,
      calculated_consumption: 120,
      calculated_cost: 300,
    },
  ]),
}));

describe("Exporters", () => {
  it("should generate a PDF buffer with BC content", async () => {
    const buffer = await pdfGenerator.generateBusinessCasePdf(1);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("should generate an Excel workbook with the expected sheets", async () => {
    const buffer = await excelExporter.generateBusinessCaseExcel(1);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["BusinessCase", "Determinaciones", "Inversiones"]);

    const bcSheet = XLSX.utils.sheet_to_json(workbook.Sheets.BusinessCase);
    expect(bcSheet.find((row) => row.Campo === "Cliente").Valor).toBe("Clinica Demo");
  });
});
