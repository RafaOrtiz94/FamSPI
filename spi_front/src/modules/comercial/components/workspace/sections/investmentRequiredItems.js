// Accesorios obligatorios de inversiones adicionales. Debe coincidir con
// backend/src/modules/business-case/investmentRequiredItems.js (el backend
// tambien los agrega y rechaza quitarlos, esto solo adelanta el efecto en la UI).
export const REQUIRED_INVESTMENT_RULES = Object.freeze([
  { trigger: "impresora", required: ["tinta", "a4 printer paper"] },
  { trigger: "impresora zebra termica zd230 ethernet y usb", required: ["etiquetas"] },
]);

export const normalizeInvestmentName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isCatalogItem = (row) => row?.parent_catalog_id == null;
const hasQuantity = (row) => Number(row?.quantity) > 0;

const findByName = (items, name) =>
  items.find((row) => isCatalogItem(row) && normalizeInvestmentName(row.name) === name) || null;

// Disparadores con cantidad que exigen este item (para el badge y el bloqueo).
export const getActiveTriggersFor = (items, item) => {
  if (!isCatalogItem(item)) return [];
  const key = normalizeInvestmentName(item.name);
  return REQUIRED_INVESTMENT_RULES
    .filter((rule) => rule.required.includes(key))
    .map((rule) => findByName(items, rule.trigger))
    .filter((trigger) => trigger && hasQuantity(trigger));
};

// Agrega con cantidad 1 los requeridos que faltan. Devuelve la lista nueva y
// los items agregados (para marcarlos como pendientes de guardar).
export const applyRequiredInvestmentItems = (items) => {
  const added = [];
  let next = items;
  REQUIRED_INVESTMENT_RULES.forEach((rule) => {
    const trigger = findByName(next, rule.trigger);
    if (!trigger || !hasQuantity(trigger)) return;
    rule.required.forEach((requiredName) => {
      const required = findByName(next, requiredName);
      if (!required || hasQuantity(required)) return;
      const updated = {
        ...required,
        quantity: 1,
        selected: true,
        characteristics: required.characteristics || `Obligatorio con ${trigger.name}`,
      };
      next = next.map((row) => (row.id === required.id ? updated : row));
      added.push({ item: updated, trigger });
    });
  });
  return { items: next, added };
};
