export const PUBLIC_PURCHASE_STATUS_OVERVIEW = [
  { key: "waiting_provider_response", label: "Esperando respuesta de proveedor" },
  { key: "waiting_proforma", label: "Solicitando proforma" },
  { key: "proforma_received", label: "Proforma recibida" },
  { key: "waiting_signed_proforma", label: "Reservado y esperando proforma firmada" },
  { key: "pending_contract", label: "Pendiente contrato" },
  { key: "no_stock", label: "Sin stock" },
  { key: "completed", label: "Completado" },
];

export const getPublicPurchaseActiveCount = (stats = {}) =>
  (stats?.waiting_provider_response ?? 0) +
  (stats?.waiting_proforma ?? 0) +
  (stats?.proforma_received ?? 0) +
  (stats?.waiting_signed_proforma ?? 0) +
  (stats?.pending_contract ?? 0);
