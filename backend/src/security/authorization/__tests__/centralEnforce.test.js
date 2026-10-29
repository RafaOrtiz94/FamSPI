jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../centralAuthorization", () => ({ loadModel: jest.fn(), loadUser: jest.fn() }));

const { loadModel, loadUser } = require("../centralAuthorization");
const { buildEndpointIndex } = require("../centralModel");
const { requireRole } = require("../../../middlewares/roles");

const model = () => ({
  index: buildEndpointIndex([
    { method: "GET", route_pattern: "/api/v1/viaticos", permission_key: "viaticos.root.read" },
    { method: "GET", route_pattern: "/api/v1/viaticos/:id", permission_key: "viaticos.root.read-v2" },
  ]),
  permissionRoles: new Map([
    ["viaticos.root.read", new Set(["finanzas", "financiero"])],
    ["viaticos.root.read-v2", new Set(["financiero"])],
  ]),
});

const run = async (user, { baseUrl = "/api/v1/viaticos", routePath = "/", originalUrl = "/api/v1/viaticos", verified = false, guard = ["finanzas"] } = {}) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  const req = { user, method: "GET", baseUrl, originalUrl, route: { path: routePath }, _moduleAccessVerified: verified };
  await requireRole(guard)(req, res, next);
  return { res, next };
};

describe("enforcement central por area", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RBAC_CENTRAL_ENFORCE;
    loadModel.mockResolvedValue(model());
    loadUser.mockResolvedValue({ roles: new Set(), grants: new Set() });
  });
  afterAll(() => { delete process.env.RBAC_CENTRAL_ENFORCE; });

  it("sin la bandera decide requireRole y no consulta al motor", async () => {
    expect((await run({ id: 1, role: "financiero" })).next).toHaveBeenCalledTimes(1);
    expect((await run({ id: 1, role: "comercial" })).res.status).toHaveBeenCalledWith(403);
    expect(loadModel).not.toHaveBeenCalled();
  });

  it("un area no listada sigue con requireRole", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "attendance";
    expect((await run({ id: 1, role: "financiero" })).next).toHaveBeenCalledTimes(1);
    expect(loadModel).not.toHaveBeenCalled();
  });

  it("area activada: decide el motor con los roles del token", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    expect((await run({ id: 1, role: "financiero" })).next).toHaveBeenCalledTimes(1);
    const denied = await run({ id: 2, role: "comercial" });
    expect(denied.next).not.toHaveBeenCalled();
    expect(denied.res.status).toHaveBeenCalledWith(403);
    expect(denied.res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PERMISSION_DENIED" }));
  });

  it("una asignacion manual de la base suma al rol del token", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    loadUser.mockResolvedValue({ roles: new Set(["financiero"]), grants: new Set() });
    expect((await run({ id: 3, role: "comercial" })).next).toHaveBeenCalledTimes(1);
  });

  it("un grant individual permite aunque el rol no", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    loadUser.mockResolvedValue({ roles: new Set(), grants: new Set(["viaticos.root.read"]) });
    expect((await run({ id: 3, role: "comercial" })).next).toHaveBeenCalledTimes(1);
  });

  it("un usuario nuevo sin asignaciones en la base funciona con el rol del token", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    loadUser.mockResolvedValue({ roles: new Set(), grants: new Set() });
    expect((await run({ id: 99, role: "financiero" })).next).toHaveBeenCalledTimes(1);
  });

  it("resuelve la ruta con parametro y respeta su permiso propio", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    const opts = { routePath: "/:id", originalUrl: "/api/v1/viaticos/55" };
    expect((await run({ id: 1, role: "financiero" }, opts)).next).toHaveBeenCalledTimes(1);
    expect((await run({ id: 1, role: "finanzas" }, opts)).res.status).toHaveBeenCalledWith(403);
  });

  it("el pasante con modulo verificado pasa y sin verificar no", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    expect((await run({ id: 5, role: "pasante" }, { verified: true })).next).toHaveBeenCalledTimes(1);
    expect((await run({ id: 5, role: "pasante" })).res.status).toHaveBeenCalledWith(403);
  });

  it("fallo seguro: si el motor falla o se agota, decide requireRole", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    loadModel.mockRejectedValue(new Error("sin base"));
    expect((await run({ id: 1, role: "financiero" })).next).toHaveBeenCalledTimes(1);
    expect((await run({ id: 2, role: "comercial" })).res.status).toHaveBeenCalledWith(403);
  });

  it("fallo seguro: un endpoint que el catalogo no conoce lo decide requireRole", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "viaticos";
    const opts = { routePath: "/otra", originalUrl: "/api/v1/viaticos/otra" };
    expect((await run({ id: 1, role: "financiero" }, opts)).next).toHaveBeenCalledTimes(1);
    expect((await run({ id: 2, role: "comercial" }, opts)).res.status).toHaveBeenCalledWith(403);
  });
});

describe("enforcement con '*'", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadModel.mockResolvedValue(model());
    loadUser.mockResolvedValue({ roles: new Set(), grants: new Set() });
  });
  afterAll(() => { delete process.env.RBAC_CENTRAL_ENFORCE; });

  it("activa todas las areas", async () => {
    process.env.RBAC_CENTRAL_ENFORCE = "*";
    expect((await run({ id: 1, role: "financiero" })).next).toHaveBeenCalledTimes(1);
    expect((await run({ id: 2, role: "comercial" })).res.status).toHaveBeenCalledWith(403);
    expect(loadModel).toHaveBeenCalled();
  });
});
