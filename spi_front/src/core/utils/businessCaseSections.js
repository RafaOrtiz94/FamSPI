// Unica fuente de las etiquetas legibles de seccion del Business Case --
// antes vivian solo dentro de BusinessCaseWorkspace.jsx (SECTION_LABELS) y
// otros puntos (CaseHeader.jsx, modales de reapertura) mostraban el id crudo
// (ej. "general", "investment_values_fin") o una heuristica debil
// (replace(/_/g, " ")) en vez de reusar el mismo diccionario.
export const SECTION_LABELS = {
  general: "Datos Generales",
  lab: "Entorno Laboratorio",
  requirement: "Condiciones del BC",
  equipment: "Equipamiento",
  lis: "Integración LIS",
  determinations: "Determinaciones",
  investments: "Inversiones",
  investment_values: "Precios financieros y operativos",
  investment_values_op: "Precio operativo",
  investment_values_fin: "Precio financiero",
  consumption_export: "Resumen",
  offer_workspace: "Oferta Comercial",
  dispatch_workspace: "Cantidades Máximas",
  feasibility: "Factibilidad",
};

export const getSectionLabel = (sectionId) => SECTION_LABELS[sectionId] || String(sectionId || "Seccion");
