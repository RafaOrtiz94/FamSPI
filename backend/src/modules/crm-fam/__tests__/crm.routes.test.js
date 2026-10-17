jest.mock("../../../middlewares/roles", () => ({
  requireRole: () => (_req, _res, next) => next(),
}));

jest.mock("../crm.controller", () => new Proxy({}, {
  get: (_target, property) => jest.fn((_req, _res) => property),
}));

const router = require("../crm.routes");

const registeredRoutes = router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
  }));

const routeIndex = (path, method) => registeredRoutes.findIndex(
  (route) => route.path === path && route.methods.includes(method),
);

describe("CRM Fam campaign route contract", () => {
  test("registers the campaign list endpoint consumed by crmFamApi", () => {
    expect(routeIndex("/email-campaigns", "get")).toBeGreaterThanOrEqual(0);
  });

  test("registers fixed campaign paths before the parameterized detail path", () => {
    const audience = routeIndex("/email-campaigns/audience", "get");
    const suppressions = routeIndex("/email-campaigns/suppressions", "get");
    const detail = routeIndex("/email-campaigns/:id", "get");

    expect(audience).toBeGreaterThanOrEqual(0);
    expect(suppressions).toBeGreaterThanOrEqual(0);
    expect(detail).toBeGreaterThan(audience);
    expect(detail).toBeGreaterThan(suppressions);
  });
});
