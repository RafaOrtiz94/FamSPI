// Accesorios obligatorios de inversiones adicionales: si un item "disparador"
// tiene cantidad > 0, sus items requeridos deben estar en la lista con
// cantidad > 0. Se agregan solos (cantidad 1) y no se pueden quitar mientras
// el disparador siga en la lista. Las reglas usan el NOMBRE del catalogo
// (normalizado) porque los ids cambian entre ambientes y el catalogo se
// sincroniza desde la plantilla. Debe coincidir con
// spi_front/src/modules/comercial/components/workspace/sections/investmentRequiredItems.js
// Sin requires pesados a proposito: se testea aislado (ver investmentEditAccess.js).

const REQUIRED_INVESTMENT_RULES = Object.freeze([
  { trigger: "impresora", required: ["tinta", "a4 printer paper"] },
  { trigger: "impresora zebra termica zd230 ethernet y usb", required: ["etiquetas"] },
]);

function normalizeInvestmentName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// catalog: filas { id, name, quantity } del BC (estado guardado).
// incoming: selecciones que se van a guardar ({ catalog_id, quantity, ... }).
// Devuelve { additions, violations }: items requeridos que faltan (se agregan
// con cantidad 1) y requeridos que el payload intenta dejar en 0.
function resolveRequiredInvestmentItems({ catalog = [], incoming = [] }) {
  const byName = new Map();
  catalog.forEach((row) => {
    const key = normalizeInvestmentName(row.name);
    // Solo items del catalogo general: un item de "Otros" llamado "Tinta" no cuenta.
    if (key && row.parent_catalog_id == null && !byName.has(key)) byName.set(key, row);
  });
  const incomingById = new Map(incoming.map((item) => [String(item.catalog_id), item]));
  const finalQuantity = (row) => {
    const pending = incomingById.get(String(row.id));
    const value = pending ? pending.quantity : row.quantity;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const additions = [];
  const violations = [];
  REQUIRED_INVESTMENT_RULES.forEach((rule) => {
    const trigger = byName.get(rule.trigger);
    if (!trigger || finalQuantity(trigger) <= 0) return;
    rule.required.forEach((requiredName) => {
      const required = byName.get(requiredName);
      if (!required || finalQuantity(required) > 0) return;
      const pending = incomingById.get(String(required.id));
      if (pending && Number(required.quantity) > 0) {
        violations.push({ trigger: trigger.name, required: required.name });
        return;
      }
      if (additions.some((item) => String(item.catalog_id) === String(required.id))) return;
      additions.push({
        catalog_id: required.id,
        quantity: 1,
        characteristics: `Obligatorio con ${trigger.name}`,
        notes: pending?.notes ?? null,
      });
    });
  });
  return { additions, violations };
}

module.exports = {
  REQUIRED_INVESTMENT_RULES,
  normalizeInvestmentName,
  resolveRequiredInvestmentItems,
};
