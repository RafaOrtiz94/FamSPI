// Verificacion de la regla de negocio de dias de vacaciones con la extension
// de fin de semana (regla laboral: un viernes puede extender el consumo al
// sabado/domingo, con cupo maximo de 2 fines de semana por periodo).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { computeVacationDaysWithWeekendRule, resolveApproverRole } = require("../vacaciones.service");

describe("computeVacationDaysWithWeekendRule", () => {
  it("devuelve 0 dias cuando la fecha fin es anterior al inicio", () => {
    expect(computeVacationDaysWithWeekendRule("2026-07-10", "2026-07-06", 0))
      .toEqual({ effectiveDays: 0, weekendsConsumedByRequest: 0 });
  });

  it("cuenta dias inclusivos sin extension cuando no hay viernes en el rango", () => {
    // 2026-07-06 lunes a 2026-07-08 miercoles = 3 dias, sin viernes
    expect(computeVacationDaysWithWeekendRule("2026-07-06", "2026-07-08", 0))
      .toEqual({ effectiveDays: 3, weekendsConsumedByRequest: 0 });
  });

  it("extiende al sabado y domingo cuando el rango termina un viernes y hay cupo", () => {
    // 2026-07-10 es viernes: el fin de semana queda fuera del rango => +2 dias
    const out = computeVacationDaysWithWeekendRule("2026-07-10", "2026-07-10", 0);
    expect(out.weekendsConsumedByRequest).toBe(1);
    expect(out.effectiveDays).toBe(3); // 1 dia + sabado + domingo
  });

  it("no extiende cuando ya se consumieron los 2 fines de semana del cupo", () => {
    const out = computeVacationDaysWithWeekendRule("2026-07-10", "2026-07-10", 2);
    expect(out).toEqual({ effectiveDays: 1, weekendsConsumedByRequest: 0 });
  });
});

describe("resolveApproverRole", () => {
  it("redirige jefe_operaciones a jefe_financiero", () => {
    expect(resolveApproverRole("jefe_operaciones")).toBe("jefe_financiero");
  });

  it("redirige jefe_logistica a jefe_financiero", () => {
    expect(resolveApproverRole("jefe_logistica")).toBe("jefe_financiero");
  });

  it("mantiene otras jefaturas en gerencia general", () => {
    expect(resolveApproverRole("jefe_calidad")).toBe("gerencia_general");
  });
});
