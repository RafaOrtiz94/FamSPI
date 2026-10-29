// Pruebas de caracterizacion del RBAC legacy (plan RBAC, Fase 1B).
// Congelan el comportamiento ACTUAL de roles.js, no el deseado: si una de estas pruebas cambia,
// cambio la autorizacion de produccion y debe ser una decision explicita, no un efecto colateral.
const { requireRole, ROLE_GROUPS, normalizeRoleName, collectUserRoles, expandRoles } = require("../roles");
const { REAL_ROLES, INVALID_ROLE_VALUES, EXTRA_ROLE_CASES } = require("../../security/authorization/__fixtures__/legacyRoles.fixture");

function decide(allowedRoles, user, reqExtras = {}) {
  const req = { user, ...reqExtras };
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let passed = false;
  requireRole(allowedRoles)(req, res, () => { passed = true; });
  return { passed, status: passed ? 200 : res.statusCode, body: res.body };
}

describe("RBAC legacy: normalizacion y recoleccion de roles", () => {
  test("normalizeRoleName pasa a minusculas y une espacios y guiones con guion bajo", () => {
    expect(normalizeRoleName("  Jefe-Comercial ")).toBe("jefe_comercial");
    expect(normalizeRoleName("Talento Humano")).toBe("talento_humano");
    expect(normalizeRoleName("jefe  de--ti")).toBe("jefe_de_ti");
    expect(normalizeRoleName(null)).toBe("");
    expect(normalizeRoleName(undefined)).toBe("");
  });

  test("collectUserRoles junta role, scope, role_name, roles, scopes y extra_roles sin duplicar", () => {
    const roles = collectUserRoles({
      role: "Comercial",
      scope: "comercial",
      role_name: "Asesor Comercial",
      roles: ["jefe-comercial"],
      scopes: ["ventas"],
      extra_roles: ["crm_leads_all_access"],
    });
    expect([...roles].sort()).toEqual(["asesor_comercial", "comercial", "crm_leads_all_access", "jefe_comercial", "ventas"]);
  });

  test("collectUserRoles ignora vacios y campos que no son arreglo", () => {
    expect(collectUserRoles({}).size).toBe(0);
    expect(collectUserRoles().size).toBe(0);
    expect([...collectUserRoles({ role: "", roles: "comercial", extra_roles: null })]).toEqual([]);
  });

  test("los valores invalidos de users.role se tratan como un rol cualquiera, sin significado especial", () => {
    INVALID_ROLE_VALUES.forEach((value) => {
      expect([...collectUserRoles({ role: value })]).toEqual([value]);
      expect(decide(["comercial"], { role: value }).status).toBe(403);
    });
  });
});

describe("RBAC legacy: grupos de roles", () => {
  test("ROLE_GROUPS no cambia sin actualizar esta foto", () => {
    expect(ROLE_GROUPS).toMatchSnapshot();
  });

  test("expandRoles expande grupos, conserva roles sueltos y normaliza", () => {
    expect([...expandRoles(["ext_users"])].sort()).toEqual(["esp_app_ext", "ing_servicio_ext"]);
    expect([...expandRoles(["jefe_logistica"])]).toEqual(["jefe_logistica"]);
    expect([...expandRoles(["Jefe-Calidad"])].sort()).toEqual(["jefe_calidad", "jefe_de_calidad"]);
    expect(expandRoles([]).size).toBe(0);
  });

  test("un nombre que es rol y grupo a la vez se expande como grupo", () => {
    // "comercial" es un rol real y tambien el nombre de un grupo: permitir "comercial" permite a toda la familia.
    expect(expandRoles(["comercial"]).has("jefe_comercial")).toBe(true);
    expect(decide(["comercial"], { role: "acp_comercial" }).passed).toBe(true);
  });
});

describe("RBAC legacy: decision de requireRole", () => {
  test("sin usuario responde 401 con el contrato { ok: false }", () => {
    expect(decide(["comercial"], undefined)).toEqual({ passed: false, status: 401, body: { ok: false, error: "No autenticado." } });
  });

  test("rol fuera de la lista responde 403 y enumera los roles permitidos ya expandidos", () => {
    const result = decide(["jefe_ti"], { role: "comercial" });
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, error: "Acceso denegado. Roles permitidos: jefe_ti, jefe_de_ti" });
  });

  test("usuario autenticado sin ningun rol responde 403", () => {
    expect(decide(["comercial"], {}).status).toBe(403);
  });

  test("solo admin y administrador son superroles; gerencia no lo es en el backend", () => {
    expect(decide(["jefe_ti"], { role: "admin" }).passed).toBe(true);
    expect(decide(["jefe_ti"], { role: "administrador" }).passed).toBe(true);
    expect(decide(["jefe_ti"], { role: "gerencia" }).passed).toBe(false);
    expect(decide(["jefe_ti"], { role: "gerencia_general" }).passed).toBe(false);
    expect(decide([], { role: "admin" }).passed).toBe(true);
  });

  test("lista de permitidos vacia deniega a todos menos a los superroles", () => {
    REAL_ROLES.forEach((role) => expect(decide([], { role }).passed).toBe(false));
  });

  test("extra_roles concede acceso adicional sin cambiar el rol principal", () => {
    expect(decide(["backoffice_comercial"], { role: "financiero" }).passed).toBe(false);
    EXTRA_ROLE_CASES.forEach(({ role, extra_roles: extraRoles }) => {
      extraRoles.forEach((extra) => {
        expect(decide([extra], { role, extra_roles: extraRoles }).passed).toBe(true);
      });
      // El rol principal sigue valiendo.
      expect(decide([role], { role, extra_roles: extraRoles }).passed).toBe(true);
    });
  });

  test("pasante: pasa una ruta que no lo lista solo si moduleAccessGuard ya verifico el modulo", () => {
    expect(decide(["comercial"], { role: "pasante" }).passed).toBe(false);
    expect(decide(["comercial"], { role: "pasante" }, { _moduleAccessVerified: true }).passed).toBe(true);
    // El atajo es exclusivo de pasante.
    expect(decide(["comercial"], { role: "logistica" }, { _moduleAccessVerified: true }).passed).toBe(false);
    // Si la ruta lista "pasante", se evalua como cualquier otro rol.
    expect(decide(["pasante"], { role: "pasante" }).passed).toBe(true);
  });

  test("matriz de decision: cada rol real contra cada grupo y cada rol real", () => {
    const targets = [...new Set([...Object.keys(ROLE_GROUPS), ...REAL_ROLES])].sort();
    const matrix = {};
    targets.forEach((target) => {
      matrix[target] = REAL_ROLES.filter((role) => decide([target], { role }).passed);
    });
    expect(matrix).toMatchSnapshot();
  });
});
