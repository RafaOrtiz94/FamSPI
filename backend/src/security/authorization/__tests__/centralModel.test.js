const {
  effectiveRoleSet, buildCatalog, buildEndpointIndex, resolveEndpointPermission, decide,
} = require("../centralModel");

const endpoint = (method, path, roleGuards, extra = {}) => ({ method, path, roleGuards, classification: "rol", scope: "private", ...extra });

describe("modelo central de autorizacion", () => {
  it("el conjunto efectivo es la interseccion de las guardas encadenadas", () => {
    expect([...effectiveRoleSet([["comercial", "gerencia"], ["jefe_comercial", "gerencia_general", "ti"]])].sort())
      .toEqual(["gerencia_general", "jefe_comercial"]);
    expect(effectiveRoleSet([])).toBeNull();
  });

  it("deriva permisos provisionales y deja fuera lo que no es de rol", () => {
    const catalog = buildCatalog([
      endpoint("GET", "/api/v1/viaticos", [["finanzas"]]),
      endpoint("GET", "/api/v1/viaticos/:id", [["finanzas"]]),
      endpoint("GET", "/api/v1/viaticos/export", [["jefe_ti"]]),
      endpoint("POST", "/api/v1/viaticos/batch-pay", [["finanzas"]]),
      endpoint("GET", "/api/v1/notifications", [], { classification: "solo_autenticado" }),
    ], { registry: { "/api/v1/viaticos": { modules: ["finanzas_viaticos"] } }, moduleKeys: ["finanzas_viaticos"] });
    expect(catalog.permissions.map((p) => p.key).sort()).toEqual(["viaticos.batch-pay.create", "viaticos.export.read", "viaticos.root.read"]);
    expect(catalog.permissions.find((p) => p.key === "viaticos.root.read").module_key).toBe("finanzas_viaticos");
    expect(catalog.endpointMap).toHaveLength(4);
    expect(catalog.endpointMap.some((item) => item.route_pattern.includes("notifications"))).toBe(false);
  });

  it("un mismo nombre con roles distintos genera variantes -v2", () => {
    const catalog = buildCatalog([
      endpoint("POST", "/api/v1/clients/:id", [["comercial"]]),
      endpoint("POST", "/api/v1/clients/:cid", [["finanzas"]]),
    ], {});
    expect(catalog.permissions.map((p) => p.key).sort()).toEqual(["clients.root.create", "clients.root.create-v2"]);
    expect(catalog.variantReport).toEqual([{ base: "clients.root.create", variants: 2 }]);
  });

  it("resuelve el permiso por metodo y ruta concreta, y prefiere la ruta mas especifica", () => {
    const index = buildEndpointIndex([
      { method: "GET", route_pattern: "/api/v1/x/:id", permission_key: "x.root.read" },
      { method: "GET", route_pattern: "/api/v1/x/stats", permission_key: "x.stats.read" },
    ]);
    expect(resolveEndpointPermission(index, "get", "/api/v1/x/stats?y=1")).toBe("x.stats.read");
    expect(resolveEndpointPermission(index, "GET", "/api/v1/x/77")).toBe("x.root.read");
    expect(resolveEndpointPermission(index, "POST", "/api/v1/x/77")).toBeNull();
  });
  it("una ruta enrutada sin guarda de rol no se confunde con la ruta parametrica", () => {
    const index = buildEndpointIndex([{ method: "GET", route_pattern: "/api/v1/x/:id", permission_key: "x.root.read" }]);
    expect(resolveEndpointPermission(index, "GET", "/api/v1/x/my", "/my")).toBeNull();
    expect(resolveEndpointPermission(index, "GET", "/api/v1/x/77", "/x/:id")).toBe("x.root.read");
    expect(resolveEndpointPermission(index, "GET", "/api/v1/x/77", "/")).toBe("x.root.read");
  });

  describe("decide", () => {
    const permissionRoles = new Map([["x.root.read", new Set(["comercial"])]]);
    const base = { permissionKey: "x.root.read", permissionRoles };

    it("rol permitido pasa y otro no", () => {
      expect(decide({ ...base, userRoles: new Set(["comercial"]) }).allowed).toBe(true);
      expect(decide({ ...base, userRoles: new Set(["logistica"]) })).toMatchObject({ allowed: false, reason: "sin_rol" });
    });
    it("los superroles pasan siempre", () => {
      expect(decide({ ...base, userRoles: new Set(["administrador"]) })).toMatchObject({ allowed: true, reason: "superrol" });
    });
    it("el pasante solo pasa si el modulo fue verificado", () => {
      expect(decide({ ...base, userRoles: new Set(["pasante"]) }).allowed).toBe(false);
      expect(decide({ ...base, userRoles: new Set(["pasante"]), moduleVerified: true }).allowed).toBe(true);
    });
    it("un grant individual suma y un permiso desconocido niega", () => {
      expect(decide({ ...base, userRoles: new Set(["logistica"]), grantedPermissions: new Set(["x.root.read"]) })).toMatchObject({ allowed: true, reason: "grant_individual" });
      expect(decide({ ...base, permissionKey: "y", userRoles: new Set(["comercial"]) })).toMatchObject({ allowed: false, reason: "permiso_desconocido" });
    });
    it("un usuario sin roles (pending, null) no pasa", () => {
      expect(decide({ ...base, userRoles: new Set() }).allowed).toBe(false);
    });
  });
});
