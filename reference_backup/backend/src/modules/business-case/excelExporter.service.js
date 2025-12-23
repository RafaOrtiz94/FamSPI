const XLSX = require("xlsx");
const businessCaseService = require("./businessCase.service");
const determinationsService = require("./determinations.service");

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

function buildDeterminationsSheet(determinations = []) {
  const rows = determinations.map((det) => ({
    Determinacion: det.name || det.roche_code || "-",
    Categoria: det.category || "-",
    "Cantidad Mensual": det.monthly_quantity ?? "-",
    Consumo: det.calculated_consumption ?? "-",
    "Costo Calculado": det.calculated_cost ?? "-",
  }));
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Sin determinaciones" }]);
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
  const determinations = await determinationsService.getDeterminations(businessCaseId);
  const calculations = (await businessCaseService.getCalculations(businessCaseId)) || {};

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildGeneralSheet(bc, calculations), "BusinessCase");
  XLSX.utils.book_append_sheet(workbook, buildDeterminationsSheet(determinations), "Determinaciones");
  XLSX.utils.book_append_sheet(workbook, buildInvestmentsSheet(bc), "Inversiones");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  generateBusinessCaseExcel,
};
