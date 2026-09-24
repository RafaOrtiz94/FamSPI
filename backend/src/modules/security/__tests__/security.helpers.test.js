// Verificacion de los controles de seguridad puros del modulo `security`:
// validacion de CIDR, coincidencia de IP contra CIDR, enmascarado de IP,
// truncado de user-agent, saneo para exportacion y deteccion de fuera de
// horario. Son controles de integridad/privacidad (WHO TRS 1033 Annex 4).

jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn() }));

const { isValidCIDR, ipMatchesCIDR } = require("../security.whitelist");
const {
  maskIPv4InString,
  truncateUA,
  sanitizeForExportRow,
} = require("../security.privacy");
const { isWeekend, checkOffHoursWithHolidays } = require("../security.holidays.ec");

describe("security.whitelist – validacion de CIDR", () => {
  it("acepta un CIDR IPv4 valido", () => {
    expect(isValidCIDR("10.0.0.0/24")).toBe(true);
    expect(isValidCIDR("192.168.1.0/32")).toBe(true);
  });

  it("rechaza CIDR mal formados", () => {
    expect(isValidCIDR("10.0.0.0")).toBe(false); // sin mascara
    expect(isValidCIDR("10.0.0.0/33")).toBe(false); // mascara fuera de rango
    expect(isValidCIDR("999.0.0.0/24")).toBe(false); // octeto invalido
    expect(isValidCIDR("no-es-cidr")).toBe(false);
    expect(isValidCIDR(null)).toBe(false);
  });
});

describe("security.whitelist – coincidencia IP contra CIDR", () => {
  it("hace match dentro de un /24", () => {
    expect(ipMatchesCIDR("10.0.0.5", "10.0.0.0/24")).toBe(true);
    expect(ipMatchesCIDR("10.0.0.250", "10.0.0.0/24")).toBe(true);
  });

  it("no hace match fuera del /24", () => {
    expect(ipMatchesCIDR("10.0.1.5", "10.0.0.0/24")).toBe(false);
  });

  it("soporta coincidencia exacta de IP", () => {
    expect(ipMatchesCIDR("1.2.3.4", "1.2.3.4")).toBe(true);
    expect(ipMatchesCIDR("1.2.3.5", "1.2.3.4")).toBe(false);
  });

  it("devuelve false ante entradas vacias", () => {
    expect(ipMatchesCIDR("", "10.0.0.0/24")).toBe(false);
    expect(ipMatchesCIDR("10.0.0.5", "")).toBe(false);
  });
});

describe("security.privacy – enmascarado y saneo de datos sensibles", () => {
  it("enmascara el ultimo octeto de una IPv4 dentro de un string", () => {
    expect(maskIPv4InString("acceso desde 192.168.1.100")).toBe("acceso desde 192.168.1.xxx");
  });

  it("devuelve el valor tal cual si no es string", () => {
    expect(maskIPv4InString(1234)).toBe(1234);
    expect(maskIPv4InString(null)).toBe(null);
  });

  it("trunca user-agents largos a 80 caracteres + ...", () => {
    const largo = "a".repeat(100);
    const out = truncateUA(largo);
    expect(out.endsWith("...")).toBe(true);
    expect(out.length).toBe(83);
    expect(truncateUA("corto")).toBe("corto");
  });

  it("sanitizeForExportRow siempre enmascara la IP y trunca el user_agent", () => {
    const row = { ip: "10.20.30.40", user_agent: "x".repeat(120), otro: "valor" };
    const out = sanitizeForExportRow(row);
    expect(out.ip).toBe("10.20.30.xxx");
    expect(out.user_agent.length).toBe(83);
    expect(out.otro).toBe("valor");
  });
});

describe("security.holidays – deteccion de fin de semana y fuera de horario", () => {
  it("identifica sabado y domingo como fin de semana", () => {
    expect(isWeekend(new Date(2026, 6, 18))).toBe(true); // sabado 18/07/2026
    expect(isWeekend(new Date(2026, 6, 19))).toBe(true); // domingo 19/07/2026
    expect(isWeekend(new Date(2026, 6, 20))).toBe(false); // lunes
  });

  it("marca fuera de horario un sabado", () => {
    const res = checkOffHoursWithHolidays(new Date(2026, 6, 18, 10, 0));
    expect(res.isOffHours).toBe(true);
    expect(res.reason).toBe("weekend");
  });

  it("marca fuera de horario un dia laboral de madrugada", () => {
    const res = checkOffHoursWithHolidays(new Date(2026, 6, 20, 3, 0)); // lunes 03:00
    expect(res.isOffHours).toBe(true);
    expect(res.reason).toBe("offhours");
  });

  it("no marca fuera de horario un dia laboral en horario de oficina", () => {
    const res = checkOffHoursWithHolidays(new Date(2026, 6, 20, 12, 0)); // lunes 12:00
    expect(res.isOffHours).toBe(false);
  });
});
