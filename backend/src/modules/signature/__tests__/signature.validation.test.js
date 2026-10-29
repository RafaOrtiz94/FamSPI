// Verificacion del control de firma electronica: la solicitud debe traer
// documento, consentimiento expreso, rol de firma y rol autorizado del sello.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { validateSignatureRequest } = require("../signature.controller");

const validBody = () => ({
  document_base64: "JVBERi0xLjQ=",
  consent: true,
  role_at_sign: "tecnico",
  authorized_role: "gerencia_general",
});

describe("validateSignatureRequest", () => {
  it("acepta una solicitud completa y valida", () => {
    expect(() => validateSignatureRequest(validBody())).not.toThrow();
  });

  it("exige el documento en base64", () => {
    const b = validBody(); b.document_base64 = "";
    expect(() => validateSignatureRequest(b)).toThrow(/documento en base64/);
  });

  it("exige consentimiento expreso (consent === true)", () => {
    const b = validBody(); b.consent = false;
    expect(() => validateSignatureRequest(b)).toThrow(/consentimiento/);
  });

  it("exige el rol con el que se firma", () => {
    const b = validBody(); b.role_at_sign = "  ";
    expect(() => validateSignatureRequest(b)).toThrow(/rol con el que firma/);
  });

  it("exige el rol autorizado para el sello", () => {
    const b = validBody(); b.authorized_role = "";
    expect(() => validateSignatureRequest(b)).toThrow(/rol autorizado/);
  });
});
