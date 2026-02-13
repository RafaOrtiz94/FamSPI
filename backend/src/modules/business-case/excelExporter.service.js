const XLSX = require("xlsx");
const businessCaseService = require("./businessCase.service");
const investmentsService = require("./investments.service");

function buildGeneralSheet(bc, calculations) {
  const bcId = bc.business_case_id || bc.id;
  const rows = [
    { Campo: "ID", Valor: bcId },
    { Campo: "Cliente", Valor: bc.client_name || "-" },
    { Campo: "Estado", Valor: bc.status || "-" },
    { Campo: "Etapa", Valor: bc.bc_stage || "-" },
    { Campo: "Responsable", Valor: bc.assigned_to_name || "-" },
    { Campo: "Costo mensual", Valor: calculations?.monthlyCost ?? "" },
    { Campo: "Costo anual", Valor: calculations?.annualCost ?? "" },
    { Campo: "Consumo total", Valor: calculations?.totalConsumption ?? "" },
    { Campo: "Pruebas", Valor: calculations?.totalTests ?? "" },
    { Campo: "Utilización", Valor: `${calculations?.utilization ?? 0}%` },
  ];
  return XLSX.utils.json_to_sheet(rows);
}

function buildConsumptionSheet(items = []) {
  const rows = items.map((item) => ({
    Equipo: item.equipmentName || item.equipment_name || "-",
    Tipo: item.type || item.item_type || "-",
    Item: item.name || "-",
    "ID Item": item.itemId || item.item_id || "",
    "Cantidad Anual": item.annualQty ?? item.annual_qty ?? 0,
    Fuente: item.source || "-",
  }));
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Sin consumos registrados" }]);
}

function buildInvestmentsSheet(bc) {
  const investments = bc.modern_bc_metadata?.investments || [];
  const rows = investments.map((inv) => ({
    Concepto: inv.name || inv.concept || "-",
    Monto: inv.amount ?? "",
    Tipo: inv.type || "capex",
  }));
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Sin inversiones registradas" }]);
}

async function generateBusinessCaseExcel(businessCaseId) {
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
  const consumptionData = await businessCaseService.getConsumptionItems(businessCaseId);
  const consumptionItems = Array.isArray(consumptionData?.items) ? consumptionData.items : [];
  const calculations = (await businessCaseService.getCalculations(businessCaseId)) || {};
  const investments = await investmentsService.getCatalogWithSelections(businessCaseId);
  const selectedInvestments = Array.isArray(investments)
    ? investments.filter((inv) => inv.selected)
    : [];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildGeneralSheet(bc, calculations), "BusinessCase");
  XLSX.utils.book_append_sheet(workbook, buildConsumptionSheet(consumptionItems), "Consumos");
  XLSX.utils.book_append_sheet(
    workbook,
    buildInvestmentsSheet({ ...bc, modern_bc_metadata: { investments: selectedInvestments } }),
    "Inversiones"
  );

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  generateBusinessCaseExcel,
};
