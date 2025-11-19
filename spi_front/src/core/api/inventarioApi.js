// ============================================================
// 📦 API: Inventario SPI Fam
// ------------------------------------------------------------
// Maneja operaciones de inventario y movimientos asociados.
// ============================================================

import api from "./index"; // ✅ usa el cliente central en el mismo nivel

// 🔹 Obtener movimientos asociados a una solicitud
export async function getInventoryByRequest({ requestId }) {
  const res = await api.get(`/inventario?request_id=${requestId}`);
  return res.data?.data || [];
}

// 🔹 Obtener saldo actual de un item
export async function getItemBalance(itemId) {
  const res = await api.get(`/inventario/${itemId}/saldo`);
  return res.data?.saldo || 0;
}
