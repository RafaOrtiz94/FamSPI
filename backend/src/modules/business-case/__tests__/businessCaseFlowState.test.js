// businessCase.service.js arrastra, via businessCasePurchaseHandoff.service ->
// equipmentPurchases.service, un require de "uuid" (ESM-only) que Jest no
// puede transformar. Se mockean solo las dependencias pesadas/no usadas por
// deriveBusinessCaseFlowState para poder cargar el modulo real bajo test.
jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../businessCaseCalculator.service", () => ({}));
jest.mock("../../private-purchases/privatePurchaseStateMachine", () => ({ PrivatePurchaseStateMachine: jest.fn() }));
jest.mock("../../private-purchases/privatePurchaseStates.constants", () => ({ PRIVATE_PURCHASE_STATES: {} }));
jest.mock("../businessCaseDriveFolder.service", () => ({ ensureBusinessCaseDriveFolder: jest.fn() }));
jest.mock("../businessCaseSheetEquipment.helper", () => ({ filterEquipmentPairsForSheet: jest.fn() }));
jest.mock("../businessCasePurchaseHandoff.service", () => ({ ensurePurchaseWorkspaceForFeasibleBusinessCase: jest.fn() }));

const { __testables } = require("../businessCase.service");
const { deriveBusinessCaseFlowState } = __testables;

describe("deriveBusinessCaseFlowState", () => {
  test("DRAFT_INICIAL sin nada cargado -> Borrador", () => {
    expect(deriveBusinessCaseFlowState({ canonicalState: "DRAFT_INICIAL", metadata: {}, investments: [] }))
      .toEqual({ code: "borrador", label: "Borrador" });
  });

  test("sin reactivos lockeados -> Pendiente de Comercial", () => {
    expect(deriveBusinessCaseFlowState({ canonicalState: "DATOS_BASE_COMPLETOS", metadata: {}, investments: [] }))
      .toEqual({ code: "pendiente_comercial", label: "Pendiente de Comercial" });
  });

  test("reactivos lockeados, servicio pendiente -> Pendiente de Servicio", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "DATOS_BASE_COMPLETOS",
      metadata: { determinations_gate: { section_locks: { reactivos: true } } },
      investments: [],
    })).toEqual({ code: "pendiente_servicio", label: "Pendiente de Servicio" });
  });

  test("comercial + servicio listos, financiero sin precio -> Pendiente de Financiero", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "DATOS_BASE_COMPLETOS",
      metadata: {
        determinations_gate: {
          section_locks: { reactivos: true, controles: true, calibradores: true, materiales: true },
        },
      },
      investments: [{ selected: true, unit_price_financial: null }],
    })).toEqual({ code: "pendiente_financiero", label: "Pendiente de Financiero" });
  });

  test("todo listo, sin decision de viabilidad -> En Evaluacion de Viabilidad", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "EN_EVALUACION_VIABILIDAD",
      metadata: {
        determinations_gate: {
          section_locks: { reactivos: true, controles: true, calibradores: true, materiales: true },
        },
      },
      investments: [{ selected: true, unit_price_financial: 100 }],
    })).toEqual({ code: "en_evaluacion_viabilidad", label: "En Evaluación de Viabilidad" });
  });

  test("decision factible -> Viable, tiene prioridad aunque el gate no este completo", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "VIABLE",
      metadata: { feasibility: { decision: { is_feasible: true } } },
      investments: [],
    })).toEqual({ code: "viable", label: "Viable" });
  });

  test("decision no factible -> No Viable", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "OBSERVADO_POR_VIABILIDAD",
      metadata: { feasibility: { decision: { is_feasible: false } } },
      investments: [],
    })).toEqual({ code: "no_viable", label: "No Viable" });
  });

  test("estados terminales de gerencia tienen prioridad sobre todo lo demas", () => {
    expect(deriveBusinessCaseFlowState({
      canonicalState: "CANCELADO",
      metadata: { feasibility: { decision: { is_feasible: true } } },
      investments: [],
    })).toEqual({ code: "cancelado", label: "Cancelado" });

    expect(deriveBusinessCaseFlowState({ canonicalState: "RECHAZADO_POR_GERENCIA", metadata: {}, investments: [] }))
      .toEqual({ code: "rechazado_gerencia", label: "Rechazado por Gerencia" });

    expect(deriveBusinessCaseFlowState({ canonicalState: "CERRADO_PARA_APROBACION", metadata: {}, investments: [] }))
      .toEqual({ code: "cerrado_aprobacion", label: "Cerrado para Aprobación" });

    expect(deriveBusinessCaseFlowState({ canonicalState: "AJUSTES_OPERATIVOS", metadata: {}, investments: [] }))
      .toEqual({ code: "ajustes_operativos", label: "En Ajustes Operativos" });
  });
});
