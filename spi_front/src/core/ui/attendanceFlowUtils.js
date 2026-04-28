const OPERATIONAL_TYPES = new Set([
  "operacion_campo",
  "operacion_de_campo",
  "salida_oficina",
  "viaje",
  "campo",
]);

const normalizeType = (type) => String(type || "").trim().toLowerCase();

export const getAttendanceFlowType = (exception) => {
  if (!exception) return "none";
  return OPERATIONAL_TYPES.has(normalizeType(exception?.type)) ? "operational" : "unexpected";
};

export const isOperationalFlow = (exception) => getAttendanceFlowType(exception) === "operational";

export const isUnexpectedFlow = (exception) => getAttendanceFlowType(exception) === "unexpected";

