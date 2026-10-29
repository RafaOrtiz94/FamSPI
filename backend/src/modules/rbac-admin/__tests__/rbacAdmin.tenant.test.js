jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../../security/authorization/centralAuthorization", () => ({ invalidateCentralCache: jest.fn() }));

const db = require("../../../config/db");
const { logAction } = require("../../../utils/audit");
const service = require("../rbacAdmin.service");
const tenant = require("../../../security/authorization/tenantContext");

const SCOPE = { enabled: true, tenantId: 7 };
const USER = { id: 20, fullname: "Persona", email: "p@x.test", role: "comercial", extra_roles: [], active: true };

// Respuestas por fragmento de SQL; el primero que coincide gana.
const script = (routes) => db.query.mockImplementation(async (sql) => {
  const hit = routes.find(([needle]) => sql.includes(needle));
  return hit ? hit[1] : { rows: [] };
});
const calls = (needle) => db.query.mock.calls.filter(([sql]) => sql.includes(needle));

describe("contexto de empresa", () => {
  beforeEach(() => { jest.clearAllMocks(); delete process.env.RBAC_TENANT_MODE; });
  afterAll(() => { delete process.env.RBAC_TENANT_MODE; });

  it("apagado devuelve NO_TENANT sin tocar la base", async () => {
    expect(await tenant.resolveTenantScope(1)).toBe(tenant.NO_TENANT);
    expect(db.query).not.toHaveBeenCalled();
    await tenant.assertMember(tenant.NO_TENANT, 99);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("encendido resuelve la membresia activa por defecto y sin membresia responde 403", async () => {
    process.env.RBAC_TENANT_MODE = "true";
    script([["tenant_memberships", { rows: [{ tenant_id: "7" }] }]]);
    expect(await tenant.resolveTenantScope(1)).toEqual({ enabled: true, tenantId: 7 });
    script([]);
    await expect(tenant.resolveTenantScope(2)).rejects.toMatchObject({ status: 403 });
  });

  it("un usuario de otra empresa responde 404, igual que uno que no existe", async () => {
    script([]);
    await expect(tenant.assertMember(SCOPE, 99)).rejects.toMatchObject({ status: 404 });
    script([["tenant_memberships", { rows: [{}] }]]);
    await expect(tenant.assertMember(SCOPE, 20)).resolves.toBeUndefined();
  });

  it("los fragmentos de visibilidad: apagado identicos a hoy, encendido con parametro", () => {
    const p1 = [];
    expect(tenant.roleVisibility("r", tenant.NO_TENANT, p1)).toBe("r.tenant_id IS NULL");
    expect(tenant.roleVisibility("", tenant.NO_TENANT, p1)).toBe("tenant_id IS NULL");
    expect(tenant.rowVisibility("a", tenant.NO_TENANT, p1)).toBe("TRUE");
    expect(p1).toEqual([]);
    const p2 = ["x"];
    expect(tenant.roleVisibility("r", SCOPE, p2)).toBe("(r.tenant_id IS NULL OR r.tenant_id = $2)");
    expect(tenant.rowVisibility("a", SCOPE, p2)).toBe("(a.tenant_id IS NULL OR a.tenant_id = $3)");
    expect(p2).toEqual(["x", 7, 7]);
  });
});

describe("administracion con empresa", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("no deja administrar a un usuario de otra empresa y no escribe nada", async () => {
    script([["FROM public.users", { rows: [USER] }]]); // existe, pero no es miembro (tenant_memberships vacio)
    await expect(service.assignRole({ actorId: 1, userId: 20, roleKey: "comercial", reason: "motivo valido", scope: SCOPE })).rejects.toMatchObject({ status: 404 });
    await expect(service.getUserAccess(20, SCOPE)).rejects.toMatchObject({ status: 404 });
    await expect(service.grantPermission({ actorId: 1, userId: 20, permissionKey: "x.y.read", reason: "motivo valido", scope: SCOPE })).rejects.toMatchObject({ status: 404 });
    await expect(service.revokeRole({ actorId: 1, userId: 20, assignmentId: 3, reason: "motivo valido", scope: SCOPE })).rejects.toMatchObject({ status: 404 });
    await expect(service.revokeGrant({ actorId: 1, userId: 20, grantId: 3, scope: SCOPE })).rejects.toMatchObject({ status: 404 });
    expect(calls("INSERT").length + calls("UPDATE").length).toBe(0);
  });

  it("asignar un rol en una empresa guarda la empresa y busca el rol entre los de sistema y los de esa empresa", async () => {
    script([
      ["FROM public.users", { rows: [USER] }],
      ["FROM public.tenant_memberships", { rows: [{}] }],
      ["FROM public.roles", { rows: [{ id: 5 }] }],
      ["INSERT INTO public.user_role_assignments", { rows: [{ id: 1 }] }],
    ]);
    await service.assignRole({ actorId: 1, userId: 20, roleKey: "Custom_Ventas", reason: "cubre vacaciones", scope: SCOPE });
    const lookup = calls("SELECT id FROM public.roles")[0];
    expect(lookup[0]).toContain("tenant_id = $2");
    expect(lookup[1]).toEqual(["custom_ventas", 7]);
    const insert = calls("INSERT INTO public.user_role_assignments")[0];
    expect(insert[0]).toContain("tenant_id)");
    expect(insert[1]).toEqual([20, 5, "cubre vacaciones", 1, null, 7]);
    // la auditoria queda etiquetada con la empresa
    const entry = logAction.mock.calls[0][0];
    expect(entry.datos_nuevos).toMatchObject({ user_id: 20, tenant_id: 7, role: "custom_ventas" });
  });

  it("las listas piden solo lo visible para la empresa", async () => {
    script([]);
    await service.listRoles(SCOPE);
    const [roleSql, roleParams] = db.query.mock.calls[0];
    expect(roleSql).toContain("r.tenant_id = $2");
    expect(roleParams).toEqual([7, 7]);
    db.query.mockClear();
    await service.getMatrix(SCOPE);
    expect(db.query.mock.calls[0][1]).toEqual([7]);
    db.query.mockClear();
    await service.listMembers(SCOPE);
    expect(db.query.mock.calls[0][0]).toContain("tenant_memberships");
    db.query.mockClear();
    await service.listAudit({ scope: SCOPE });
    expect(db.query.mock.calls[0][0]).toContain("datos_nuevos->>'tenant_id'");
    expect(db.query.mock.calls[0][1]).toEqual([50, "7"]);
  });

  it("apagado, las mismas funciones no agregan ninguna condicion de empresa", async () => {
    script([]);
    await service.listRoles();
    expect(db.query.mock.calls[0][0]).toContain("WHERE r.tenant_id IS NULL AND r.is_active ORDER BY r.key");
    expect(db.query.mock.calls[0][1]).toEqual([]);
    db.query.mockClear();
    await service.listAudit();
    expect(db.query.mock.calls[0][0]).not.toContain("tenant_id");
    db.query.mockClear();
    await service.listMembers();
    expect(db.query.mock.calls[0][0]).not.toContain("tenant_memberships");
  });

  describe("roles de la empresa", () => {
    const client = { query: jest.fn(), release: jest.fn() };
    beforeEach(() => {
      db.getClient.mockResolvedValue(client);
      client.query.mockReset();
      client.query.mockImplementation(async (sql) => (sql.includes("INSERT INTO public.roles") ? { rows: [{ id: 90, key: "custom_ventas", label: "Ventas" }] } : { rows: [] }));
    });

    it("el rol nuevo nace en la empresa del administrador", async () => {
      script([
        ["FROM public.permissions", { rows: [{ key: "clients.root.read" }] }],
        ["FROM public.roles r WHERE r.id", { rows: [{ id: 90, key: "custom_ventas", label: "Ventas", is_system: false, tenant_id: 7, permissions: ["clients.root.read"], users: 0 }] }],
      ]);
      await service.createRole({ actorId: 1, key: "ventas", label: "Ventas", permissions: ["clients.root.read"], reason: "rol para ventas", scope: SCOPE });
      const insert = client.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO public.roles"));
      expect(insert[0]).toContain("VALUES ($3, $1, $2, FALSE)");
      expect(insert[1]).toEqual(["custom_ventas", "Ventas", 7]);
    });

    it("un rol de otra empresa no es visible y uno anterior sin empresa no es editable", async () => {
      script([]); // getRole no encuentra nada: no es visible para la empresa
      await expect(service.updateRole({ actorId: 1, roleId: 91, label: "x", reason: "motivo valido", scope: SCOPE })).rejects.toMatchObject({ status: 404 });
      script([["FROM public.roles r WHERE r.id", { rows: [{ id: 92, key: "custom_viejo", label: "Viejo", is_system: false, tenant_id: null, permissions: ["a.b.read"], users: 0 }] }]]);
      await expect(service.updateRole({ actorId: 1, roleId: 92, label: "Nuevo", reason: "motivo valido", scope: SCOPE })).rejects.toMatchObject({ status: 403 });
      await expect(service.archiveRole({ actorId: 1, roleId: 92, reason: "motivo valido", scope: SCOPE })).rejects.toMatchObject({ status: 403 });
      expect(db.getClient).not.toHaveBeenCalled();
    });

    it("el conteo de usuarios de un rol solo cuenta a los miembros de la empresa", async () => {
      script([["FROM public.roles r WHERE r.id", { rows: [{ id: 90, key: "custom_ventas", label: "Ventas", is_system: false, tenant_id: 7, permissions: ["a.b.read"], users: 0 }] }]]);
      await service.getRole(90, SCOPE);
      expect(db.query.mock.calls[0][0]).toContain("tenant_memberships m ON m.user_id = a.user_id");
    });
  });
});
