jest.mock("../../../config/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));

jest.mock("../../approvals/approvals.service", () => ({
  listPending: jest.fn(),
}));
jest.mock("../withdrawalWorkflow.service", () => ({
  listWithdrawalWorkflows: jest.fn(),
}));
jest.mock("../correctiveCases.service", () => ({
  listCorrectiveCasesWorkspace: jest.fn(),
}));
jest.mock("../../mantenimientos/preventivePlanning.service", () => ({
  listPreventiveAnnualPlans: jest.fn(),
  getPreventivePlanItems: jest.fn(),
}));
jest.mock("../externalCases.service", () => ({
  listExternalCasesWorkspace: jest.fn(),
}));

const approvalsService = require("../../approvals/approvals.service");
const withdrawalWorkflowService = require("../withdrawalWorkflow.service");
const correctiveCasesService = require("../correctiveCases.service");
const preventivePlanningService = require("../../mantenimientos/preventivePlanning.service");
const externalCasesService = require("../externalCases.service");

const { getActionQueue } = require("../actionQueue.service");

const emptyAll = () => {
  approvalsService.listPending.mockResolvedValue({ rows: [], total: 0 });
  withdrawalWorkflowService.listWithdrawalWorkflows.mockResolvedValue([]);
  correctiveCasesService.listCorrectiveCasesWorkspace.mockResolvedValue([]);
  preventivePlanningService.listPreventiveAnnualPlans.mockResolvedValue([]);
  externalCasesService.listExternalCasesWorkspace.mockResolvedValue([]);
};

describe("actionQueue.service getActionQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emptyAll();
  });

  it("normaliza una aprobacion pendiente al formato comun", async () => {
    approvalsService.listPending.mockResolvedValue({
      rows: [
        {
          id: 14,
          created_at: "2026-03-18T10:00:00.000Z",
          type_code: "F.ST-20",
          type_title: "Solicitud de inspección de ambiente",
          requester_name: "Ada Lovelace",
          payload: { nombre_cliente: "Cliente Demo", fecha_instalacion: "2099-01-01" },
        },
      ],
      total: 1,
    });

    const result = await getActionQueue({ user: { id: 1, role: "jefe_servicio" }, scope: "team" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "approval:14",
      type: "approval",
      client_name: "Cliente Demo",
      primary_action: "Asignar",
      source_path: "/dashboard/servicio-tecnico/solicitudes?tab=inspeccion&subtab=independientes",
    });
  });

  it("scope=mine no incluye aprobaciones, preventivo ni casos externos (decisiones de jefatura/CEAC)", async () => {
    await getActionQueue({ user: { id: 5 }, scope: "mine" });

    expect(approvalsService.listPending).not.toHaveBeenCalled();
    expect(preventivePlanningService.listPreventiveAnnualPlans).not.toHaveBeenCalled();
    expect(externalCasesService.listExternalCasesWorkspace).not.toHaveBeenCalled();
  });

  it("scope=mine filtra retiros por el usuario asignado en workflow_state.work_order", async () => {
    withdrawalWorkflowService.listWithdrawalWorkflows.mockResolvedValue([
      {
        id: 1,
        request_id: 100,
        workflow_status: "en_progreso",
        client_name: "Cliente A",
        request_created_at: "2026-01-01T00:00:00.000Z",
        workflow_state: { work_order: { assigned_user_id: 5 } },
      },
      {
        id: 2,
        request_id: 101,
        workflow_status: "en_progreso",
        client_name: "Cliente B",
        request_created_at: "2026-01-01T00:00:00.000Z",
        workflow_state: { work_order: { assigned_user_id: 9 } },
      },
    ]);

    const result = await getActionQueue({ user: { id: 5 }, scope: "mine" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].client_name).toBe("Cliente A");
    expect(correctiveCasesService.listCorrectiveCasesWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ onlyMine: true })
    );
  });

  it("scope=team solo lista retiros sin ejecutor asignado, para que el jefe los coordine", async () => {
    withdrawalWorkflowService.listWithdrawalWorkflows.mockResolvedValue([
      {
        id: 1,
        workflow_status: "en_progreso",
        client_name: "Sin asignar",
        request_created_at: "2026-01-01T00:00:00.000Z",
        workflow_state: {},
      },
      {
        id: 2,
        workflow_status: "en_progreso",
        client_name: "Ya asignado",
        request_created_at: "2026-01-01T00:00:00.000Z",
        workflow_state: { work_order: { assigned_user_id: 9 } },
      },
      {
        id: 3,
        workflow_status: "cerrado",
        client_name: "Cerrado",
        request_created_at: "2026-01-01T00:00:00.000Z",
        workflow_state: {},
      },
    ]);

    const result = await getActionQueue({ user: { id: 1 }, scope: "team" });

    expect(result.items.map((item) => item.client_name)).toEqual(["Sin asignar"]);
  });

  it("filtra correctivos a estados accionables y marca urgencia por SLA vencido", async () => {
    correctiveCasesService.listCorrectiveCasesWorkspace.mockResolvedValue([
      {
        id: 1,
        code: "COR-1",
        status: "ceac_received",
        client_name: "Cliente SLA",
        sla_response_breached: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        code: "COR-2",
        status: "closed",
        client_name: "Cerrado",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const result = await getActionQueue({ user: { id: 1 }, scope: "team" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ type: "corrective", urgency: "urgent" });
    expect(result.by_urgency.urgent).toBe(1);
  });

  it("preventivo solo incluye items en offer_pending del plan activo", async () => {
    preventivePlanningService.listPreventiveAnnualPlans.mockResolvedValue([
      { id: 1, status: "closed" },
      { id: 2, status: "active" },
    ]);
    preventivePlanningService.getPreventivePlanItems.mockResolvedValue([
      { id: 10, status: "offer_pending", equipment_name: "Autoclave", client_name: "Cliente X" },
      { id: 11, status: "completed", equipment_name: "Autoclave", client_name: "Cliente Y" },
    ]);

    const result = await getActionQueue({ user: { id: 1 }, scope: "team" });

    expect(preventivePlanningService.getPreventivePlanItems).toHaveBeenCalledWith(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ type: "preventive_offer", client_name: "Cliente X" });
  });

  it("casos externos: sync_error es urgente, pending_validation/blocked son normales, otros estados se excluyen", async () => {
    externalCasesService.listExternalCasesWorkspace.mockResolvedValue([
      { id: 1, code: "EXT-1", internal_status: "sync_error", client_name: "A", updated_at: "2026-01-01" },
      { id: 2, code: "EXT-2", internal_status: "pending_validation", client_name: "B", updated_at: "2026-01-01" },
      { id: 3, code: "EXT-3", internal_status: "reconciled", client_name: "C", updated_at: "2026-01-01" },
    ]);

    const result = await getActionQueue({ user: { id: 1 }, scope: "team" });

    expect(result.items.map((item) => item.id)).toEqual(["external_case:1", "external_case:2"]);
    expect(result.items[0].urgency).toBe("urgent");
    expect(result.items[1].urgency).toBe("normal");
  });

  it("ordena la cola por urgencia (urgent > today > normal) y expone conteos", async () => {
    correctiveCasesService.listCorrectiveCasesWorkspace.mockResolvedValue([
      { id: 1, status: "ceac_received", client_name: "Normal", created_at: "2026-01-01" },
      { id: 2, status: "ceac_received", sla_resolution_breached: true, client_name: "Urgente", created_at: "2026-01-02" },
    ]);

    const result = await getActionQueue({ user: { id: 1 }, scope: "team" });

    expect(result.items.map((item) => item.client_name)).toEqual(["Urgente", "Normal"]);
    expect(result.total).toBe(2);
    expect(result.by_urgency).toEqual({ urgent: 1, today: 0, normal: 1 });
  });

  it("por defecto (scope invalido/ausente) usa scope=team", async () => {
    const result = await getActionQueue({ user: { id: 1 } });
    expect(result.scope).toBe("team");
  });
});
