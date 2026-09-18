jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { computeBusinessMinutesElapsed } = require("../permisos.service");

describe("computeBusinessMinutesElapsed", () => {
  it("cuenta solo una hora habil de viernes 17:00 a lunes 09:00", () => {
    const start = new Date("2026-08-14T22:00:00.000Z"); // viernes 17:00 America/Guayaquil
    const end = new Date("2026-08-17T14:00:00.000Z");   // lunes 09:00 America/Guayaquil
    expect(computeBusinessMinutesElapsed(start, end)).toBe(60);
  });

  it("no cuenta horas fuera de la jornada en fin de semana", () => {
    const start = new Date("2026-08-15T15:00:00.000Z"); // sabado 10:00 America/Guayaquil
    const end = new Date("2026-08-15T20:00:00.000Z");   // sabado 15:00 America/Guayaquil
    expect(computeBusinessMinutesElapsed(start, end)).toBe(0);
  });
});
