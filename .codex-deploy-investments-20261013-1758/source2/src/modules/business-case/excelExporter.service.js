const XLSX = require("xlsx");
const businessCaseService = require("./businessCase.service");
const investmentsService = require("./investments.service");
const dispatchWorkspaceService = require("./bcDispatchWorkspace.service");

const ITEM_TYPE_LABELS = {
  determinacion: "Determinación",
  reactivo: "Reactivo",
  control: "Control",
  calibrador: "Calibrador",
  consumible: "Consumible",
  material: "Material",
  otro: "Otro",
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toCurrency(value) {
  if (value === null || value === undefined) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed;
}

function buildSheet(rows = [], fallbackNote = "Sin datos") {
  if (!rows.length) {
    return XLSX.utils.json_to_sheet([{ Nota: fallbackNote }]);
  }
  return XLSX.utils.json_to_sheet(rows);
}

function buildGeneralSheet(bc, calculations) {
  const bcId = bc.business_case_id || bc.id;
  const monthlyCost = calculations?.monthlyCost ?? calculations?.monthly_cost ?? "";
  const annualCost = calculations?.annualCost ?? calculations?.annual_cost ?? "";
  const totalConsumption =
    calculations?.totalConsumption ?? calculations?.reagent_consumption ?? calculations?.total_consumption ?? "";
  const totalTests = calculations?.totalTests ?? calculations?.total_annual_tests ?? "";
  const utilization = calculations?.utilization ?? calculations?.equipment_utilization ?? 0;
  const annualRevenue = calculations?.annual_revenue ?? calculations?.annualRevenue ?? "";
  const annualProfit = calculations?.annual_profit ?? calculations?.annualProfit ?? "";
  const roi = calculations?.roi_percentage ?? calculations?.roi ?? "";

  const rows = [
    { Campo: "ID", Valor: bcId },
    { Campo: "Cliente", Valor: bc.client_name || "-" },
    { Campo: "Estado", Valor: bc.status || "-" },
    { Campo: "Etapa", Valor: bc.bc_stage || "-" },
    { Campo: "Tipo BC", Valor: bc.bc_purchase_type || "-" },
    { Campo: "Responsable", Valor: bc.assigned_to_name || "-" },
    { Campo: "Costo mensual", Valor: monthlyCost },
    { Campo: "Costo anual", Valor: annualCost },
    { Campo: "Consumo total", Valor: totalConsumption },
    { Campo: "Pruebas", Valor: totalTests },
    { Campo: "Utilización", Valor: `${utilization}%` },
    { Campo: "Ingreso anual", Valor: annualRevenue },
    { Campo: "Utilidad anual", Valor: annualProfit },
    { Campo: "ROI (%)", Valor: roi },
  ];
  return buildSheet(rows);
}

function buildNegotiationElementsSheet(items = []) {
  const rows = items.map((item) => {
    const unitPrice = toCurrency(item.unitPrice);
    const plannedQty = toNumber(item.plannedQty, 0);
    const plannedAmount = unitPrice === "" ? "" : plannedQty * unitPrice;

    return {
      Equipo: item.equipmentName || "-",
      Tipo: ITEM_TYPE_LABELS[item.itemType] || item.itemType || "Otro",
      "Nombre elemento": item.itemName || "-",
      "ID elemento": item.itemId || "",
      "Cantidad anual (base BC)": toNumber(item.annualQty, 0),
      "Cantidad plan comercial": plannedQty,
      "Precio unitario comercial": unitPrice,
      "Total comercial": plannedAmount === "" ? "" : plannedAmount,
      "Cantidad a despachar (ops)": toNumber(item.opsDispatchQty, 0),
      "Cantidad despachada": toNumber(item.opsDispatchedQty, 0),
      "Cantidad pendiente": toNumber(item.pendingQty, 0),
      "Estado despacho": item.opsStatus || "pendiente",
      "Nota comercial": item.commercialNotes || "",
      "Nota operaciones": item.operationsNotes || "",
    };
  });

  return buildSheet(rows, "Sin elementos de negociación registrados");
}

function buildCommercialPlanSheet(items = []) {
  const rows = items.map((item) => {
    const unitPrice = toCurrency(item.unitPrice);
    const plannedQty = toNumber(item.plannedQty, 0);
    return {
      Equipo: item.equipmentName || "-",
      Tipo: ITEM_TYPE_LABELS[item.itemType] || item.itemType || "Otro",
      Elemento: item.itemName || "-",
      "Cantidad planificada": plannedQty,
      "Precio unitario": unitPrice,
      "Subtotal": unitPrice === "" ? "" : plannedQty * unitPrice,
      "Actualizado por": item.commercialUpdatedByEmail || "",
      "Fecha actualización": item.commercialUpdatedAt || "",
      Observaciones: item.commercialNotes || "",
    };
  });
  return buildSheet(rows, "Sin plan comercial registrado");
}

function buildOperationsControlSheet(items = []) {
  const rows = items.map((item) => ({
    Equipo: item.equipmentName || "-",
    Tipo: ITEM_TYPE_LABELS[item.itemType] || item.itemType || "Otro",
    Elemento: item.itemName || "-",
    "Cantidad a despachar": toNumber(item.opsDispatchQty, 0),
    "Cantidad despachada": toNumber(item.opsDispatchedQty, 0),
    "Cantidad pendiente": toNumber(item.pendingQty, 0),
    Estado: item.opsStatus || "pendiente",
    "Actualizado por": item.operationsUpdatedByEmail || "",
    "Fecha actualización": item.operationsUpdatedAt || "",
    Observaciones: item.operationsNotes || "",
  }));
  return buildSheet(rows, "Sin control operativo registrado");
}

function buildInvestmentsSheet(investments = []) {
  const rows = investments.map((inv) => ({
    Concepto: inv.name || inv.item_name || inv.concept || "-",
    Categoria: inv.category || "",
    Cantidad: toNumber(inv.quantity, 0),
    "Precio Unitario": toCurrency(inv.unit_price),
    "Monto Total": inv.unit_price !== undefined && inv.unit_price !== null
      ? toNumber(inv.quantity, 0) * toNumber(inv.unit_price, 0)
      : toCurrency(inv.amount),
    Seleccionado: inv.selected ? "Si" : "No",
    Notas: inv.notes || "",
  }));
  return buildSheet(rows, "Sin inversiones registradas");
}

async function generateBusinessCaseExcel(businessCaseId) {
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
  const calculations = (await businessCaseService.getCalculations(businessCaseId)) || {};
  let negotiationItems = [];
  try {
    const dispatchWorkspace = await dispatchWorkspaceService.getDispatchWorkspace(businessCaseId);
    negotiationItems = Array.isArray(dispatchWorkspace?.items) ? dispatchWorkspace.items : [];
  } catch (_error) {
    const fallbackConsumption = await businessCaseService.getConsumptionItems(businessCaseId);
    const fallbackItems = Array.isArray(fallbackConsumption?.items) ? fallbackConsumption.items : [];
    negotiationItems = fallbackItems.map((item) => ({
      equipmentName: item.equipmentName || item.equipment_name || "Sin equipo",
      itemType: item.type || item.item_type || "otro",
      itemName: item.name || "-",
      itemId: item.itemId || item.item_id || "",
      annualQty: toNumber(item.annualQty ?? item.annual_qty, 0),
      plannedQty: toNumber(item.annualQty ?? item.annual_qty, 0),
      unitPrice: null,
      opsDispatchQty: toNumber(item.annualQty ?? item.annual_qty, 0),
      opsDispatchedQty: 0,
      pendingQty: toNumber(item.annualQty ?? item.annual_qty, 0),
      opsStatus: "pendiente",
      commercialNotes: "",
      operationsNotes: "",
    }));
  }
  const investments = await investmentsService.getCatalogWithSelections(businessCaseId);
  const selectedInvestments = Array.isArray(investments)
    ? investments.filter((inv) => inv.selected)
    : [];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildGeneralSheet(bc, calculations), "Resumen");
  XLSX.utils.book_append_sheet(
    workbook,
    buildNegotiationElementsSheet(negotiationItems),
    "Elementos",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildCommercialPlanSheet(negotiationItems),
    "Plan_Comercial",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildOperationsControlSheet(negotiationItems),
    "Control_Ops",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildInvestmentsSheet(selectedInvestments),
    "Inversiones"
  );

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  generateBusinessCaseExcel,
};
