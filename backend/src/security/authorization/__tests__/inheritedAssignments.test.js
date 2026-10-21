jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const { deriveInheritedRoles, reconcileUserInheritedRoles, isConvertible } = require("../inheritedAssignments");

const scope = (role) => ({ financiero: "finanzas", comercial: "comercial" }[role] || role);

describe("asignaciones heredadas", () => {
  it("deriva rol, area y extra_roles sin repetir", () => {
    const { assignments, unconvertible } = deriveInheritedRoles({ role: "Financiero", extra_roles: ["backoffice_comercial", "bc_quality_summary"] }, scope);
    expect(assignments).toEqual([
      { role: "financiero", source: "legacy_role" },
      { role: "finanzas", source: "legacy_scope" },
      { role: "backoffice_comercial", source: "legacy_extra_role" },
      { role: "bc_quality_summary", source: "legacy_extra_role" },
    ]);
    expect(unconvertible).toEqual([]);
    expect(deriveInheritedRoles({ role: "jefe_ti" }, scope).assignments).toEqual([{ role: "jefe_ti", source: "legacy_role" }]);
  });

  it("no convierte pending, null ni vacio, ni extra_roles invalidos", () => {
    ["pending", "null", "pendiente", "", null, undefined].forEach((role) => {
      const derived = deriveInheritedRoles({ role }, scope);
      expect(derived.assignments).toEqual([]);
      expect(derived.unconvertible).toHaveLength(1);
    });
    const derived = deriveInheritedRoles({ role: "comercial", extra_roles: ["pending", "ok_rol"] }, scope);
    expect(derived.assignments.map((item) => item.role)).toEqual(["comercial", "ok_rol"]);
    expect(derived.unconvertible).toEqual([{ value: "pending", where: "extra_roles" }]);
    expect(isConvertible("Robert'); DROP")).toBe(false);
  });

  describe("reconcile", () => {
    const db = { query: jest.fn() };
    beforeEach(() => db.query.mockReset());

    it("agrega lo que falta y revoca lo que ya no corresponde, sin tocar manuales", async () => {
      db.query.mockImplementation(async (sql) => {
        if (sql.includes("a.source <> 'manual'")) return { rows: [{ id: 11, role: "comercial", source: "legacy_role" }, { id: 12, role: "viejo", source: "legacy_extra_role" }] };
        if (sql.includes("INSERT INTO public.user_role_assignments")) return { rowCount: 1 };
        return { rows: [] };
      });
      const result = await reconcileUserInheritedRoles(db, { id: 7, role: "comercial", extra_roles: ["nuevo"] });
      expect(result).toEqual({ added: 1, removed: 1 });
      const revoke = db.query.mock.calls.find(([sql]) => sql.includes("UPDATE public.user_role_assignments"));
      expect(revoke[1]).toEqual([[12]]);
      expect(revoke[0]).not.toContain("manual");
    });

    it("es idempotente cuando ya esta al dia", async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, role: "comercial", source: "legacy_role" }] });
      expect(await reconcileUserInheritedRoles(db, { id: 7, role: "comercial", extra_roles: [] })).toEqual({ added: 0, removed: 0 });
      expect(db.query.mock.calls.some(([sql]) => sql.includes("INSERT") || sql.includes("UPDATE"))).toBe(false);
    });
  });
});
