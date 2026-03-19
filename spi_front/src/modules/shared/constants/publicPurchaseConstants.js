export const PUBLIC_PURCHASE_STATUS_OVERVIEW = [
 { key: "pending_provider_assignment", label: "Pendiente datos de proveedor (ACP)" },
 { key: "waiting_provider_response", label: "Esperando respuesta de proveedor" },
 { key: "waiting_proforma", label: "Solicitando proforma" },
 { key: "proforma_received", label: "Proforma recibida" },
 { key: "waiting_signed_proforma", label: "Reservado y esperando proforma firmada" },
 { key: "pending_contract", label: "Pendiente contrato" },
 { key: "contract_available", label: "Contrato disponible" },
 { key: "delivery_dates_requested", label: "Pendiente fechas de entrega" },
 { key: "delivery_dates_submitted", label: "Fechas de entrega registradas" },
 { key: "waiting_dispatch", label: "Esperando despacho" },
 { key: "dispatch_ready", label: "Despacho listo" },
 { key: "no_stock", label: "Sin stock" },
 { key: "completed", label: "Completado" },
];

export const getPublicPurchaseActiveCount = (stats = {}) =>
 (stats?.pending_provider_assignment ?? 0) +
 (stats?.waiting_provider_response ?? 0) +
 (stats?.waiting_proforma ?? 0) +
 (stats?.proforma_received ?? 0) +
 (stats?.waiting_signed_proforma ?? 0) +
 (stats?.pending_contract ?? 0) +
 (stats?.contract_available ?? 0) +
 (stats?.delivery_dates_requested ?? 0) +
 (stats?.delivery_dates_submitted ?? 0) +
 (stats?.waiting_dispatch ?? 0) +
 (stats?.dispatch_ready ?? 0);
