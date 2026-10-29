jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalizeActaCategory, _validatePolicyAttributes } = require("../collabDeliveries.service");

describe("collab-deliveries – normalizeActaCategory", () => {
  it("agrupa variantes de herramienta", () => {
    for (const v of ["herramienta", "herramientas", "herramienta_trabajo"]) {
      expect(normalizeActaCategory(v)).toBe("herramienta");
    }
  });
  it("agrupa variantes de ropa/uniforme", () => {
    for (const v of ["ropa", "uniforme", "uniformes"]) {
      expect(normalizeActaCategory(v)).toBe("ropa");
    }
  });
  it("devuelve null para vacio y el valor normalizado para otras categorias", () => {
    expect(normalizeActaCategory("")).toBeNull();
    expect(normalizeActaCategory("EPP")).toBe("epp");
    expect(normalizeActaCategory("POLIZA")).toBe("poliza");
  });

  it("exige todos los datos contractuales de una póliza", () => {
    expect(() => _validatePolicyAttributes({ aseguradora: "Aseguradora" })).toThrow("numero_poliza");
    expect(() => _validatePolicyAttributes({
      tipo_seguro: "Salud y Vida",
      aseguradora: "Aseguradora",
      numero_poliza: "POL-001",
      vigencia: "01/01/2026 - 31/12/2026",
      monto_asegurado: "$10.000",
    })).not.toThrow();
    expect(() => _validatePolicyAttributes({
      tipo_seguro: "Accidentes",
      aseguradora: "Aseguradora",
      numero_poliza: "POL-001",
      vigencia: "01/01/2026 - 31/12/2026",
      monto_asegurado: "$10.000",
    })).toThrow("tipo_seguro inválido");
  });
});
