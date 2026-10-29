// Verificacion del predicado de estado de empleo pasivo (usado para decidir
// la sincronizacion de estado activo del usuario en offboarding).

const {
  isPassiveEmploymentStatus,
  shouldSyncUserActiveStatus,
  PASSIVE_EMPLOYMENT_STATUSES,
} = require("../profileSync");

describe("isPassiveEmploymentStatus", () => {
  it("reconoce todos los estados pasivos definidos (case-insensitive)", () => {
    for (const status of PASSIVE_EMPLOYMENT_STATUSES) {
      expect(isPassiveEmploymentStatus(status.toUpperCase())).toBe(true);
    }
  });
  it("no marca como pasivo un estado activo o vacio", () => {
    expect(isPassiveEmploymentStatus("activo")).toBe(false);
    expect(isPassiveEmploymentStatus("")).toBe(false);
    expect(isPassiveEmploymentStatus(null)).toBe(false);
  });
});

describe("shouldSyncUserActiveStatus", () => {
  it("sincroniza solo cuando el estado es pasivo", () => {
    expect(shouldSyncUserActiveStatus("desvinculado")).toBe(true);
    expect(shouldSyncUserActiveStatus("activo")).toBe(false);
  });
});
