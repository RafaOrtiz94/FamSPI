// Regresion de produccion (2026-09-28): cerrar un BC como no factible con
// "rechazado por falta de informacion" escribia ese valor en
// private_purchase_requests.offer_kind y violaba su CHECK -> 500 con la
// decision ya guardada. Mismos mocks de carga que businessCaseFlowState.test.js.
const mockClient = { query: jest.fn(), release: jest.fn() };
jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn(async () => mockClient) }));
jest.mock("../businessCaseCalculator.service", () => ({}));
jest.mock("../../private-purchases/privatePurchaseStateMachine", () => ({
  PrivatePurchaseStateMachine: { transition: jest.fn(), canTransition: jest.fn(() => true) },
}));
jest.mock("../businessCaseDriveFolder.service", () => ({ ensureBusinessCaseDriveFolder: jest.fn() }));
jest.mock("../businessCaseSheetEquipment.helper", () => ({ filterEquipmentPairsForSheet: jest.fn() }));
jest.mock("../businessCasePurchaseHandoff.service", () => ({ ensurePurchaseWorkspaceForFeasibleBusinessCase: jest.fn() }));
jest.mock("../bcInvestmentTiAssetReservations.service", () => ({ releaseAllForBusinessCase: jest.fn() }));
jest.mock("../businessCaseWorkflowSla.service", () => ({ isParticipantStageComplete: jest.fn() }));

const db = require("../../../config/db");
const { PrivatePurchaseStateMachine } = require("../../private-purchases/privatePurchaseStateMachine");
const service = require("../businessCase.service");

const user = { id: 7, email: "acp@fam-project.com", role: "acp_comercial" };

async function decideNotFeasible(fallback) {
  mockClient.query.mockImplementation(async (sql) => (
    String(sql).includes("FOR UPDATE") ? { rows: [{ id: "bc-1", modern_bc_metadata: { private_purchase_id: 55 } }] } : { rows: [] }
  ));
  db.query.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes("FROM v_business_cases")) return { rows: [{ uses_modern_system: true, bc_system_type: "modern" }] };
    if (text.includes("SELECT id, status, offer_kind, extra")) {
      return { rows: [{ id: 55, status: "acp_availability_confirmed", offer_kind: "comodato", extra: {} }] };
    }
    if (text.includes("SELECT status FROM private_purchase_requests")) return { rows: [{ status: "acp_availability_confirmed" }] };
    return { rows: [] };
  });
  // El retorno final (getBusinessCaseById) no interesa aqui: solo lo que se escribe en el expediente.
  await service.saveFeasibilityDecision("bc-1", { is_feasible: false, notes: "Sin datos", fallback_offer_kind: fallback }, user)
    .catch(() => null);
  return db.query.mock.calls.find(([sql]) => String(sql).includes("SET offer_kind"));
}

describe("saveFeasibilityDecision: modalidad del expediente privado al cerrar no factible", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rechazado por falta de informacion conserva la modalidad y no abre flujo alterno", async () => {
    const [, params] = await decideNotFeasible("rechazado_falta_informacion");
    expect(params[1]).toBeNull(); // COALESCE(NULL, offer_kind): nunca llega un valor fuera del CHECK
    expect(JSON.parse(params[2]).business_case_decision.fallback_offer_kind).toBe("rechazado_falta_informacion");
    expect(PrivatePurchaseStateMachine.transition).not.toHaveBeenCalled();
  });

  test("una alternativa comercial sigue cambiando la modalidad y pasa a flujo alterno", async () => {
    const [, params] = await decideNotFeasible("venta");
    expect(params[1]).toBe("venta");
    expect(PrivatePurchaseStateMachine.transition).toHaveBeenCalledTimes(1);
  });
});
