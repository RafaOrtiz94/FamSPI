export const CLIENT_CREATION_SCOPES = [
  "comercial",
  "jefe_comercial",
  "asesor",
  "asesor_comercial",
];

export const canManageClientRequests = (scope = "") => {
  const normalized = (scope || "").toLowerCase();
  return CLIENT_CREATION_SCOPES.includes(normalized);
};
