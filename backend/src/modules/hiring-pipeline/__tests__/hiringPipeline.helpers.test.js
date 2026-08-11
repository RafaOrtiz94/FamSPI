jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const {
  hasApprovedStageResult,
  isLegacyReferenceVerificationPending,
  STAGE_ORDER,
} = require("../hiring-pipeline.service");

describe("hiring-pipeline – hasApprovedStageResult", () => {
  it("es true cuando existe un resultado aprobado para esa etapa", () => {
    const entry = { stage_results: [{ stage: "primera_entrevista", result: "aprobado" }] };
    expect(hasApprovedStageResult(entry, "primera_entrevista")).toBe(true);
  });
  it("es false sin resultados o sin match de etapa/resultado", () => {
    expect(hasApprovedStageResult({}, "primera_entrevista")).toBe(false);
    expect(hasApprovedStageResult({ stage_results: [{ stage: "otra", result: "aprobado" }] }, "primera_entrevista")).toBe(false);
  });
});

describe("hiring-pipeline – isLegacyReferenceVerificationPending", () => {
  it("es false si la etapa no es verificacion_referencias", () => {
    expect(isLegacyReferenceVerificationPending({}, "primera_entrevista")).toBe(false);
  });
  it("es false si el estado no es en_evaluacion", () => {
    expect(isLegacyReferenceVerificationPending({ status: "rechazado" }, "verificacion_referencias")).toBe(false);
  });
  it("es true para un candidato legacy que avanzo sin verificacion de referencias aprobada", () => {
    const entry = {
      status: "en_evaluacion",
      current_stage: STAGE_ORDER[STAGE_ORDER.indexOf("verificacion_referencias") + 2],
      stage_results: [],
    };
    expect(isLegacyReferenceVerificationPending(entry, "verificacion_referencias")).toBe(true);
  });
});
