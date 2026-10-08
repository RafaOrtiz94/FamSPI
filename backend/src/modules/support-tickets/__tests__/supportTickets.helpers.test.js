// Verificacion de la matriz de prioridad y del predicado de rol TI del
// modulo de mesa de ayuda (control de acceso/derivacion).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { derivePriority, isTIUser } = require("../supportTickets.service");

describe("derivePriority", () => {
  it("alto + alto => critica", () => {
    expect(derivePriority("alto", "alto")).toBe("critica");
  });
  it("un solo alto => alta", () => {
    expect(derivePriority("alto", "bajo")).toBe("alta");
    expect(derivePriority("bajo", "alto")).toBe("alta");
  });
  it("medio => media", () => {
    expect(derivePriority("medio", "bajo")).toBe("media");
  });
  it("ambos bajos => baja", () => {
    expect(derivePriority("bajo", "bajo")).toBe("baja");
  });
  it("por defecto (sin datos) trata como medio => media", () => {
    expect(derivePriority()).toBe("media");
  });
});

describe("isTIUser", () => {
  it("no reconoce a un usuario sin roles", () => {
    expect(isTIUser({})).toBe(false);
    expect(isTIUser({ role: "tecnico_campo_random" })).toBe(false);
  });
});
