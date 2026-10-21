jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

const {
  normalizeText, normalizeNumeric, normalizeItemType, normalizeBoolean, hasAnyRole,
} = require("../consumableFiles.service");

describe("consumable-files – normalizeText", () => {
  it("recorta y usa fallback cuando es null/undefined/vacio", () => {
    expect(normalizeText("  hola  ")).toBe("hola");
    expect(normalizeText(null, "default")).toBe("default");
    expect(normalizeText("   ", "default")).toBe("default");
  });
});

describe("consumable-files – normalizeNumeric", () => {
  it("acepta un numero valido dentro de rango y redondea a 3 decimales", () => {
    expect(normalizeNumeric("1.23456", "campo")).toBe(1.235);
  });
  it("lanza error si el valor no es numerico", () => {
    expect(() => normalizeNumeric("abc", "campo")).toThrow(/invalido/);
  });
  it("lanza error si esta fuera de rango (min por defecto 0)", () => {
    expect(() => normalizeNumeric(-1, "campo")).toThrow(/fuera de rango/);
  });
});

describe("consumable-files – normalizeItemType", () => {
  it("acepta los tipos validos y cualquier otro cae en 'otro'", () => {
    expect(normalizeItemType("reactivo")).toBe("reactivo");
    expect(normalizeItemType("tipo-desconocido")).toBe("otro");
  });
});

describe("consumable-files – normalizeBoolean", () => {
  it("interpreta valores comunes de verdadero", () => {
    for (const v of ["1", "true", "si", "yes", "on", true]) {
      expect(normalizeBoolean(v)).toBe(true);
    }
  });
  it("usa el fallback ante valores ausentes", () => {
    expect(normalizeBoolean(undefined, true)).toBe(true);
    expect(normalizeBoolean(null, false)).toBe(false);
  });
});

describe("consumable-files – hasAnyRole", () => {
  it("reconoce un rol permitido entre varios formatos de usuario", () => {
    expect(hasAnyRole({ role: "jefe_calidad" }, new Set(["jefe_calidad"]))).toBe(true);
    expect(hasAnyRole({ roles: ["tecnico", "gerencia"] }, new Set(["gerencia"]))).toBe(true);
  });
  it("no reconoce un usuario sin el rol permitido", () => {
    expect(hasAnyRole({ role: "tecnico" }, new Set(["gerencia"]))).toBe(false);
  });
});
