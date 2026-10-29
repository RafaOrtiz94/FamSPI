// Verificacion de las reglas de negocio de permisos laborales (control GxP de
// proceso): limites por tipo, validacion de fechas y requisitos IESS.

jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const {
  validatePermisoEstudios,
  validatePermisoSalud,
  getStartOfWeek,
  getEndOfWeek,
} = require("../permisos.validation");

describe("validatePermisoEstudios", () => {
  it("acepta hasta 3 horas", () => {
    expect(validatePermisoEstudios(3)).toMatchObject({ valid: true, es_recuperable: true });
  });
  it("rechaza mas de 3 horas", () => {
    expect(() => validatePermisoEstudios(4)).toThrow(/no puede exceder 3 horas/);
  });
});

describe("validatePermisoSalud", () => {
  const base = {
    fecha_inicio: "2026-07-06",
    fecha_fin: "2026-07-06",
    subtipo_salud: "enfermedad_certificada",
  };

  it("exige fechas de inicio y fin", () => {
    expect(() => validatePermisoSalud({ ...base, fecha_inicio: null })).toThrow(/fechas de inicio y fin/);
  });

  it("rechaza fecha fin anterior a inicio", () => {
    expect(() => validatePermisoSalud({ ...base, fecha_inicio: "2026-07-10", fecha_fin: "2026-07-06" }))
      .toThrow(/no puede ser anterior/);
  });

  it("rechaza subtipo de salud no valido", () => {
    expect(() => validatePermisoSalud({ ...base, subtipo_salud: "otro" })).toThrow(/no válido/);
  });

  it("para menos de 4 dias exige certificado medico y no tramite IESS", () => {
    const out = validatePermisoSalud({ ...base, duracion_dias: 2 });
    expect(out.justificantes_requeridos).toContain("certificado_medico");
    expect(out.requiere_tramite_iess).toBe(false);
  });

  it("para 4 dias o mas exige certificado IESS y tramite de subsidios", () => {
    const out = validatePermisoSalud({
      fecha_inicio: "2026-07-06",
      fecha_fin: "2026-07-10",
      subtipo_salud: "enfermedad_certificada",
      duracion_dias: 5,
    });
    expect(out.requiere_tramite_iess).toBe(true);
    expect(out.justificantes_requeridos).toContain("certificado_medico_iess");
    expect(out.mensaje).toMatch(/IESS/);
  });

  it("marca recuperable solo para atencion medica familiar", () => {
    const familiar = validatePermisoSalud({ ...base, duracion_dias: 1, subtipo_salud: "atencion_medica_familiar" });
    expect(familiar.es_recuperable).toBe(true);
    const propia = validatePermisoSalud({ ...base, duracion_dias: 1 });
    expect(propia.es_recuperable).toBe(false);
  });
});

describe("getStartOfWeek / getEndOfWeek", () => {
  it("el inicio de semana es domingo y el fin es sabado", () => {
    // 2026-07-08 es miercoles
    const start = new Date(getStartOfWeek("2026-07-08"));
    const end = new Date(getEndOfWeek("2026-07-08"));
    expect(start.getDay()).toBe(0); // domingo
    expect(end.getDay()).toBe(6); // sabado
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});
