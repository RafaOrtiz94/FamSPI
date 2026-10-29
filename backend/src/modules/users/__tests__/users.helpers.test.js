// Verificacion de los normalizadores/validadores del modulo users
// (identidad y control de datos de usuario).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const {
  normalizeRole, normalizeText, normalizeEmail, isValidEmail, parseBoolean,
} = require("../users.controller");

describe("normalizeRole", () => {
  it("minusculiza y reemplaza espacios/guiones por guion bajo", () => {
    expect(normalizeRole("  Jefe-Tecnico Senior ")).toBe("jefe_tecnico_senior");
    expect(normalizeRole(null)).toBe("");
  });
});

describe("normalizeText", () => {
  it("recorta y limita la longitud", () => {
    expect(normalizeText("  hola  ")).toBe("hola");
    expect(normalizeText("abcdef", 3)).toBe("abc");
    expect(normalizeText(null)).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("normaliza a minusculas y sin espacios", () => {
    expect(normalizeEmail("  Foo.Bar@FAM.COM ")).toBe("foo.bar@fam.com");
  });
});

describe("isValidEmail", () => {
  it("acepta correos validos y rechaza invalidos", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("sin-arroba")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("parseBoolean", () => {
  it("interpreta valores verdaderos/falsos y devuelve null si es ambiguo", () => {
    expect(parseBoolean("si")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean(false)).toBe(false);
    expect(parseBoolean("quiza")).toBeNull();
  });
});
