jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../security/authorization/centralAuthorization", () => ({ invalidateCentralCache: jest.fn() }));

const db = require("../../../config/db");
const { invalidateCentralCache } = require("../../../security/authorization/centralAuthorization");
const service = require("../rbacAdmin.service");

const USER = { id: 20, fullname: "Persona Prueba", email: "p@staging.invalid", role: "comercial", extra_roles: [], active: true };
const future = () => new Date(Date.now() + 86400000).toISOString();

// Respuestas por consulta, en orden de aparicion por texto.
const script = (routes) => db.query.mockImplementation(async (sql) => {
  const hit = routes.find(([needle]) => sql.includes(needle));
  return hit ? hit[1] : { rows: [] };
});

describe("administracion RBAC", () => {
  beforeEach(() => { jest.clearAllMocks(); delete process.env.RBAC_CENTRAL_PILOT; });

  it("no deja modificar los propios roles ni permisos", async () => {
    await expect(service.assignRole({ actorId: 20, userId: 20, roleKey: "comercial", reason: "motivo valido" })).rejects.toMatchObject({ status: 403 });
    await expect(service.grantPermission({ actorId: 20, userId: 20, permissionKey: "x", reason: "motivo valido" })).rejects.toMatchObject({ status: 403 });
    await expect(service.revokeGrant({ actorId: 20, userId: 20, grantId: 1 })).rejects.toMatchObject({ status: 403 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it("exige motivo y una fecha de vencimiento futura", async () => {
    await expect(service.assignRole({ actorId: 1, userId: 20, roleKey: "comercial", reason: "  " })).rejects.toMatchObject({ status: 400 });
    await expect(service.assignRole({ actorId: 1, userId: 20, roleKey: "comercial", reason: "motivo valido", expiresAt: "2020-01-01" })).rejects.toMatchObject({ status: 400 });
    await expect(service.grantPermission({ actorId: 1, userId: 20, permissionKey: "x", reason: "motivo valido", expiresAt: "no-es-fecha" })).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza usuario, rol o permiso inexistentes", async () => {
    script([]);
    await expect(service.assignRole({ actorId: 1, userId: 99, roleKey: "comercial", reason: "motivo valido" })).rejects.toMatchObject({ status: 404 });
    script([["FROM public.users", { rows: [USER] }]]);
    await expect(service.assignRole({ actorId: 1, userId: 20, roleKey: "inventado", reason: "motivo valido" })).rejects.toMatchObject({ status: 400 });
    await expect(service.grantPermission({ actorId: 1, userId: 20, permissionKey: "inventado", reason: "motivo valido" })).rejects.toMatchObject({ status: 400 });
  });

  it("asigna un rol manual, invalida la cache y avisa que no cambia el acceso real", async () => {
    script([
      ["FROM public.users", { rows: [USER] }],
      ["FROM public.roles", { rows: [{ id: 5 }] }],
      ["INSERT INTO public.user_role_assignments", { rows: [{ id: 1 }] }],
    ]);
    const result = await service.assignRole({ actorId: 1, userId: 20, roleKey: "Comercial", reason: "cubre vacaciones", expiresAt: future() });
    expect(invalidateCentralCache).toHaveBeenCalledWith(20);
    expect(result.enforcement).toMatchObject({ central_decides: false });
    const insert = db.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO public.user_role_assignments"));
    expect(insert[0]).toContain("'manual'");
    expect(insert[1]).toEqual([20, 5, "cubre vacaciones", 1, expect.any(String)]);
  });

  it("una asignacion manual repetida da 409", async () => {
    script([["FROM public.users", { rows: [USER] }], ["FROM public.roles", { rows: [{ id: 5 }] }]]);
    await expect(service.assignRole({ actorId: 1, userId: 20, roleKey: "comercial", reason: "motivo valido" })).rejects.toMatchObject({ status: 409 });
    expect(invalidateCentralCache).not.toHaveBeenCalled();
  });

  it("solo revoca asignaciones manuales vigentes", async () => {
    script([]);
    await expect(service.revokeRole({ actorId: 1, userId: 20, assignmentId: 3, reason: "ya no aplica" })).rejects.toMatchObject({ status: 404 });
    const update = db.query.mock.calls[0][0];
    expect(update).toContain("source = 'manual'");
    expect(update).toContain("revoked_at IS NULL");
  });

  it("el resumen indica el modo piloto", async () => {
    process.env.RBAC_CENTRAL_PILOT = "true";
    script([["SELECT\n", { rows: [{ roles: 1 }] }], ["COUNT", { rows: [{ roles: 1 }] }]]);
    const summary = await service.getSummary();
    expect(summary.enforcement.pilot_permissions).toEqual(["module_access.read", "module_access.manage"]);
    delete process.env.RBAC_CENTRAL_PILOT;
  });
});

describe("auditoria, matriz y sincronizacion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("la matriz agrupa permisos por rol y area", async () => {
    db.query.mockResolvedValue({ rows: [{ role: "comercial", area: "clients", permissions: 4 }, { role: "jefe_ti", area: "users", permissions: 2 }, { role: "comercial", area: "users", permissions: 1 }] });
    const matrix = await service.getMatrix();
    expect(matrix.areas).toEqual(["clients", "users"]);
    expect(matrix.roles).toEqual(["comercial", "jefe_ti"]);
    expect(matrix.cells["comercial|clients"]).toBe(4);
  });

  it("la auditoria solo lee el modulo rbac_cambios y filtra por usuario con parametros", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await service.listAudit({ userId: 20, limit: 9999 });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("l.modulo = 'rbac_cambios'");
    expect(sql).toContain("$2");
    expect(params).toEqual([200, "20"]);
  });
});

describe("constructor de roles", () => {
  const client = { query: jest.fn(), release: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    db.getClient = jest.fn().mockResolvedValue(client);
    client.query.mockReset();
    client.query.mockImplementation(async (sql) => (sql.includes("INSERT INTO public.roles") ? { rows: [{ id: 90, key: "custom_ventas", label: "Ventas" }] } : { rows: [] }));
  });
  const knownPermissions = (...keys) => (sql) => {
    if (sql.includes("FROM public.permissions")) return { rows: keys.map((key) => ({ key })) };
    if (sql.includes("FROM public.roles r WHERE r.id")) return { rows: [{ id: 90, key: "custom_ventas", label: "Ventas", is_system: false, permissions: keys, users: 0 }] };
    return { rows: [] };
  };

  it("el nombre siempre lleva el prefijo custom_ y no puede imitar a admin ni a un rol del codigo", async () => {
    db.query.mockImplementation(async (sql) => knownPermissions("clients.root.read")(sql));
    await service.createRole({ actorId: 1, key: "Admin", label: "Ventas", permissions: ["clients.root.read"], reason: "rol para ventas" });
    const insert = client.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO public.roles"));
    expect(insert[1][0]).toBe("custom_admin");
    await expect(service.createRole({ actorId: 1, key: "!", label: "Ventas", permissions: ["clients.root.read"], reason: "rol para ventas" })).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza permisos de administracion del RBAC y permisos que no existen", async () => {
    db.query.mockImplementation(async (sql) => knownPermissions("clients.root.read")(sql));
    await expect(service.createRole({ actorId: 1, key: "x1", label: "Ventas", permissions: ["rbac.manage"], reason: "rol para ventas" })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/administracion del sistema/) });
    await expect(service.createRole({ actorId: 1, key: "x1", label: "Ventas", permissions: ["module_access.read"], reason: "rol para ventas" })).rejects.toMatchObject({ status: 400 });
    await expect(service.createRole({ actorId: 1, key: "x1", label: "Ventas", permissions: ["no.existe.read"], reason: "rol para ventas" })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/no existen/) });
    await expect(service.createRole({ actorId: 1, key: "x1", label: "Ventas", permissions: [], reason: "rol para ventas" })).rejects.toMatchObject({ status: 400 });
    expect(db.getClient).not.toHaveBeenCalled();
  });

  it("exige motivo y crea el rol y sus permisos en una transaccion", async () => {
    db.query.mockImplementation(async (sql) => knownPermissions("clients.root.read", "clients.root.create")(sql));
    await expect(service.createRole({ actorId: 1, key: "ventas", label: "Ventas", permissions: ["clients.root.read"], reason: " " })).rejects.toMatchObject({ status: 400 });
    const role = await service.createRole({ actorId: 1, key: "ventas", label: "Ventas", permissions: ["clients.root.read", "clients.root.create", "clients.root.read"], reason: "rol para ventas" });
    expect(role.key).toBe("custom_ventas");
    const sqls = client.query.mock.calls.map(([sql]) => sql);
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls[sqls.length - 1]).toBe("COMMIT");
    const link = client.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO public.role_permissions"));
    expect(link[1][1]).toEqual(["clients.root.create", "clients.root.read"]);
    expect(invalidateCentralCache).toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it("un nombre repetido da 409 y deshace la transaccion", async () => {
    db.query.mockImplementation(async (sql) => knownPermissions("clients.root.read")(sql));
    client.query.mockImplementation(async (sql) => {
      if (sql.includes("INSERT INTO public.roles")) throw Object.assign(new Error("dup"), { code: "23505" });
      return { rows: [] };
    });
    await expect(service.createRole({ actorId: 1, key: "ventas", label: "Ventas", permissions: ["clients.root.read"], reason: "rol para ventas" })).rejects.toMatchObject({ status: 409 });
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("los roles de sistema no se editan ni se archivan", async () => {
    db.query.mockImplementation(async (sql) => (sql.includes("FROM public.roles r WHERE r.id")
      ? { rows: [{ id: 5, key: "comercial", label: "comercial", is_system: true, permissions: ["clients.root.read"], users: 3 }] } : { rows: [] }));
    await expect(service.updateRole({ actorId: 1, roleId: 5, label: "Otro", reason: "cambio de prueba" })).rejects.toMatchObject({ status: 403 });
    await expect(service.archiveRole({ actorId: 1, roleId: 5, reason: "cambio de prueba" })).rejects.toMatchObject({ status: 403 });
    expect(db.getClient).not.toHaveBeenCalled();
  });

  it("editar calcula lo agregado y lo quitado, y sin cambios responde 400", async () => {
    const stored = { id: 90, key: "custom_ventas", label: "Ventas", is_system: false, permissions: ["clients.root.read"], users: 0 };
    db.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM public.permissions")) return { rows: [{ key: "clients.root.create" }] };
      if (sql.includes("FROM public.roles r WHERE r.id")) return { rows: [stored] };
      return { rows: [] };
    });
    await expect(service.updateRole({ actorId: 1, roleId: 90, permissions: ["clients.root.read"], reason: "sin cambios reales" })).rejects.toMatchObject({ status: 400 });
    db.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM public.permissions")) return { rows: [{ key: "clients.root.create" }] };
      if (sql.includes("FROM public.roles r WHERE r.id")) return { rows: [stored] };
      return { rows: [] };
    });
    await service.updateRole({ actorId: 1, roleId: 90, permissions: ["clients.root.create"], reason: "cambia lectura por crear" });
    const link = client.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO public.role_permissions"));
    expect(link[1][1]).toEqual(["clients.root.create"]);
    expect(invalidateCentralCache).toHaveBeenCalled();
  });

  it("archivar se rechaza mientras algun usuario tenga el rol", async () => {
    db.query.mockImplementation(async (sql) => (sql.includes("FROM public.roles r WHERE r.id")
      ? { rows: [{ id: 90, key: "custom_ventas", label: "Ventas", is_system: false, permissions: ["a.b.read"], users: 2 }] } : { rows: [] }));
    await expect(service.archiveRole({ actorId: 1, roleId: 90, reason: "ya no se usa" })).rejects.toMatchObject({ status: 409 });
    expect(db.query.mock.calls.some(([sql]) => sql.includes("is_active = FALSE"))).toBe(false);
  });
});
