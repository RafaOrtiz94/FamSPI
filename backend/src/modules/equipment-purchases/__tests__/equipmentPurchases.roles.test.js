// Bug real (plan servicio-tecnico, Fase C): canRegisterSiteInspection y
// canViewInspectionQueue usaban listas de tokens que no cubrian "ing_servicio"
// (el rol principal de tecnico de campo) ni "esp_app" -- ninguno de los dos
// contiene "tecnico" ni "jefe_servicio" como substring, asi que ambos roles
// quedaban silenciosamente sin poder registrar ni ver inspecciones de compra
// publica. Este test fija el comportamiento correcto.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

const service = require("../equipmentPurchases.service");

describe("equipmentPurchases – roles de inspeccion tecnica", () => {
  it.each(["tecnico", "ing_servicio", "esp_app", "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico"])(
    "canRegisterSiteInspection acepta rol %s",
    (role) => {
      expect(service.canRegisterSiteInspection({ role })).toBe(true);
    },
  );

  it.each(["tecnico", "ing_servicio", "esp_app", "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico"])(
    "canViewInspectionQueue acepta rol %s",
    (role) => {
      expect(service.canViewInspectionQueue({ role })).toBe(true);
    },
  );

  it("ambos rechazan un rol ajeno", () => {
    expect(service.canRegisterSiteInspection({ role: "comercial" })).toBe(false);
    expect(service.canViewInspectionQueue({ role: "comercial" })).toBe(false);
  });
});
