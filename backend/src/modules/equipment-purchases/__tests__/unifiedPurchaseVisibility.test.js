// Verificacion de la matriz de visibilidad y acciones por rol/estado de
// compras (control de acceso / segregacion de funciones).

const {
  PURCHASE_TYPES,
  isTabVisible,
  isActionAllowed,
} = require("../unifiedPurchaseVisibility.config");

describe("unifiedPurchaseVisibility – isTabVisible", () => {
  it("un tab con roles ['*'] es visible para cualquier rol", () => {
    expect(isTabVisible("commercial", PURCHASE_TYPES.PUBLIC, "cualquier_rol")).toBe(true);
  });

  it("un tab marcado hidden nunca es visible", () => {
    expect(isTabVisible("public_acp", PURCHASE_TYPES.PRIVATE, "gerencia")).toBe(false);
  });

  it("un tab inexistente devuelve false", () => {
    expect(isTabVisible("tab-inexistente", PURCHASE_TYPES.PUBLIC, "gerencia")).toBe(false);
  });
});

describe("unifiedPurchaseVisibility – isActionAllowed", () => {
  it("devuelve false para un estado sin configuracion", () => {
    expect(isActionAllowed("cualquier_accion", "estado-inexistente", PURCHASE_TYPES.PUBLIC, "gerencia")).toBe(false);
  });
});
