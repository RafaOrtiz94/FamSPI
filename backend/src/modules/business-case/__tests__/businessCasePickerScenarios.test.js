// 10 escenarios de verificacion para el rework del picker de Business Case:
// 4 de seguridad (quien ve que) + 6 de la escalera de flow_state.
jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../businessCaseCalculator.service", () => ({}));
jest.mock("../../private-purchases/privatePurchaseStateMachine", () => ({ PrivatePurchaseStateMachine: jest.fn() }));
jest.mock("../../private-purchases/privatePurchaseStates.constants", () => ({ PRIVATE_PURCHASE_STATES: {} }));
jest.mock("../businessCaseDriveFolder.service", () => ({ ensureBusinessCaseDriveFolder: jest.fn() }));
jest.mock("../businessCaseSheetEquipment.helper", () => ({ filterEquipmentPairsForSheet: jest.fn() }));
jest.mock("../businessCasePurchaseHandoff.service", () => ({ ensurePurchaseWorkspaceForFeasibleBusinessCase: jest.fn() }));

const db = require("../../../config/db");
const { listBusinessCases, __testables } = require("../businessCase.service");
const { deriveBusinessCaseFlowState } = __testables;

const mockListRow = (overrides = {}) => ({
  business_case_id: "bc-1",
  client_name: "Cliente Demo",
  canonical_state: "DRAFT_INICIAL",
  modern_bc_metadata: {},
  created_by: 5,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  total_count: "1",
  ...overrides,
});

describe("Escenarios de seguridad — listBusinessCases filtra por created_by segun rol", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM bc_investment_selections")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [mockListRow()] });
    });
  });

  test("Escenario 1: comercial base SOLO ve sus propios BC", async () => {
    await listBusinessCases({}, { id: 42, role: "comercial" });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/created_by = \$\d/);
    expect(params).toContain(42);
  });

  test("Escenario 2: backoffice_comercial (no jefe) tambien queda restringido", async () => {
    await listBusinessCases({}, { id: 9, role: "backoffice_comercial" });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/created_by = \$\d/);
    expect(params).toContain(9);
  });

  test("Escenario 3: jefe_comercial ve TODOS, sin filtro created_by", async () => {
    await listBusinessCases({}, { id: 42, role: "jefe_comercial" });
    const [sql] = db.query.mock.calls[0];
    expect(sql).not.toMatch(/created_by = \$/);
  });

  test("Escenario 4: jefe_servicio, jefe_financiero, jefe_ti, gerencia_general y admin ven TODOS", async () => {
    for (const role of ["jefe_servicio", "jefe_financiero", "jefe_ti", "gerencia_general", "admin"]) {
      jest.clearAllMocks();
      db.query.mockImplementation((sql) => {
        if (sql.includes("FROM bc_investment_selections")) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [mockListRow()] });
      });
       
      await listBusinessCases({}, { id: 1, role });
      const [sql] = db.query.mock.calls[0];
      expect(sql).not.toMatch(/created_by = \$/);
    }
  });
});

describe("Escenarios de la escalera de flow_state (deriveBusinessCaseFlowState)", () => {
  test("Escenario 5: BC recien creado sin nada -> Borrador", () => {
    expect(deriveBusinessCaseFlowState({ canonicalState: "DRAFT_INICIAL", metadata: {}, investments: [] }))
      .toEqual({ code: "borrador", label: "Borrador" });
  });

  test("Escenario 6: comercial aun no completa reactivos -> Pendiente de Comercial", () => {
    expect(deriveBusinessCaseFlowState({ canonicalState: "DATOS_BASE_COMPLETOS", metadata: {}, investments: [] }))
      .toEqual({ code: "pendiente_comercial", label: "Pendiente de Comercial" });
  });

  test("Escenario 7: reactivos listos, servicio no sincronizo calibradores/controles/materiales -> Pendiente de Servicio", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "DATOS_BASE_COMPLETOS",
      metadata: { determinations_gate: { section_locks: { reactivos: true } } },
      investments: [],
    })).toEqual({ code: "pendiente_servicio", label: "Pendiente de Servicio" });
  });

  test("Escenario 8: comercial + servicio listos, financiero sin precio -> Pendiente de Financiero", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "DATOS_BASE_COMPLETOS",
      metadata: {
        determinations_gate: { section_locks: { reactivos: true, controles: true, calibradores: true, materiales: true } },
      },
      investments: [{ selected: true, unit_price_financial: null }],
    })).toEqual({ code: "pendiente_financiero", label: "Pendiente de Financiero" });
  });

  test("Escenario 9: decision de viabilidad factible tiene prioridad aunque el gate no este completo", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "VIABLE",
      metadata: { feasibility: { decision: { is_feasible: true } }, determinations_gate: {} },
      investments: [],
    })).toEqual({ code: "viable", label: "Viable" });
  });

  test("Escenario 10: CANCELADO tiene prioridad absoluta sobre cualquier otro dato", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "CANCELADO",
      metadata: {
        feasibility: { decision: { is_feasible: true } },
        determinations_gate: { section_locks: { reactivos: true, controles: true, calibradores: true, materiales: true } },
      },
      investments: [{ selected: true, unit_price_financial: 500 }],
    })).toEqual({ code: "cancelado", label: "Cancelado" });
  });
});
