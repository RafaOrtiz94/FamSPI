import api from "./index";

const unwrap = (res) => res.data?.data ?? res.data;

export const searchReservableTiAssets = async (businessCaseId, catalogId, q) =>
  unwrap(await api.get(`/business-case/${businessCaseId}/investments/catalog/${catalogId}/ti-asset-search`, { params: { q } }));

export const listTiAssetReservations = async (businessCaseId, catalogId) =>
  unwrap(await api.get(`/business-case/${businessCaseId}/investments/catalog/${catalogId}/ti-asset-reservations`));

export const reserveTiAsset = async (businessCaseId, catalogId, tiAssetId) =>
  unwrap(await api.post(`/business-case/${businessCaseId}/investments/catalog/${catalogId}/ti-asset-reservations`, { ti_asset_id: tiAssetId }));

export const releaseTiAssetReservation = async (businessCaseId, catalogId, reservationId) =>
  unwrap(await api.delete(`/business-case/${businessCaseId}/investments/catalog/${catalogId}/ti-asset-reservations/${reservationId}`));

// Todas las reservas del BC de una vez (sin filtrar por item) -- para mostrar
// visibilidad a cualquier usuario con acceso a inversiones y para saber, en
// precios/cotizacion, si un item ya esta cubierto por inventario TI.
export const listAllTiAssetReservations = async (businessCaseId) =>
  unwrap(await api.get(`/business-case/${businessCaseId}/investments/ti-asset-reservations`));
