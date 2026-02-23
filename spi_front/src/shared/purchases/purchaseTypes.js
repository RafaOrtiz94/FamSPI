export const PURCHASE_FAMILY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
});

export const PURCHASE_KIND = Object.freeze({
  PUBLIC_COMODATO: 'comodato_publico',
  PRIVATE_SALE: 'venta',
  PRIVATE_RENT: 'alquiler',
  PRIVATE_RENT_TRANSFER: 'alquiler_transferencia_dominio',
  PRIVATE_COMODATO: 'comodato',
});

export const PURCHASE_START_MODE = Object.freeze({
  EXISTING_MODAL: 'existing_modal',
  BUSINESS_CASE_PREFLOW: 'business_case_preflow',
});

export const PRIVATE_PURCHASE_OPTIONS = Object.freeze([
  { key: PURCHASE_KIND.PRIVATE_SALE, title: 'Venta', startFrom: PURCHASE_START_MODE.EXISTING_MODAL },
  { key: PURCHASE_KIND.PRIVATE_RENT, title: 'Alquiler', startFrom: PURCHASE_START_MODE.EXISTING_MODAL },
  {
    key: PURCHASE_KIND.PRIVATE_RENT_TRANSFER,
    title: 'Alquiler con transferencia de dominio',
    startFrom: PURCHASE_START_MODE.EXISTING_MODAL,
  },
  { key: PURCHASE_KIND.PRIVATE_COMODATO, title: 'Comodato', startFrom: PURCHASE_START_MODE.BUSINESS_CASE_PREFLOW },
]);

export const PUBLIC_PURCHASE_OPTIONS = Object.freeze([
  {
    key: PURCHASE_KIND.PUBLIC_COMODATO,
    title: 'Comodato (Compra publica)',
    startFrom: PURCHASE_START_MODE.BUSINESS_CASE_PREFLOW,
  },
]);

export const OFFER_KIND_LABELS = Object.freeze({
  [PURCHASE_KIND.PRIVATE_SALE]: 'Venta',
  [PURCHASE_KIND.PRIVATE_RENT]: 'Alquiler',
  [PURCHASE_KIND.PRIVATE_RENT_TRANSFER]: 'Alquiler con transferencia de dominio',
  [PURCHASE_KIND.PRIVATE_COMODATO]: 'Comodato',
  [PURCHASE_KIND.PUBLIC_COMODATO]: 'Comodato (Compra publica)',
});

export function normalizeOfferKind(kind) {
  const allowed = [
    PURCHASE_KIND.PRIVATE_SALE,
    PURCHASE_KIND.PRIVATE_RENT,
    PURCHASE_KIND.PRIVATE_RENT_TRANSFER,
    PURCHASE_KIND.PRIVATE_COMODATO,
  ];
  return allowed.includes(kind) ? kind : PURCHASE_KIND.PRIVATE_SALE;
}
