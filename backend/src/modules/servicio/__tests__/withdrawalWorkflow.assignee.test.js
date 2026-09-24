jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
jest.mock("../../notifications/notificationManager", () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));
// El resto del require-chain real de withdrawalWorkflow.service.js arrastra
// paquetes ESM-only (uuid) que Jest no transforma -- se mockean para aislar
// la unidad bajo prueba, no se usan en applyWorkflowAction.
jest.mock("../../../utils/drive", () => ({ ensureFolder: jest.fn(), uploadBase64File: jest.fn() }));
jest.mock("../workflowRegistry.service", () => ({
  SUPPORTED_WORKFLOW_SOURCE_TYPES: ["request"],
  upsertWorkflow: jest.fn(),
  validateSourceType: jest.fn(),
}));
jest.mock("../workflowAudit.service", () => ({ appendWorkflowAuditEvent: jest.fn() }));
jest.mock("../fst14.service", () => ({ trackWorkflowDocumentByCode: jest.fn() }));
jest.mock("../packagingLabels.service", () => ({
  ensureWithdrawalPackagingLabelsTable: jest.fn(),
  listWithdrawalPackages: jest.fn(),
  upsertWithdrawalPackages: jest.fn(),
}));
jest.mock("../fst11.service", () => ({ buildDriveLink: jest.fn() }));
jest.mock("../../requests/requests.service", () => ({ markRequestCompleted: jest.fn() }));

const db = require("../../../config/db");
const notificationManager = require("../../notifications/notificationManager");
const { applyWorkflowAction } = require("../withdrawalWorkflow.service");

describe("withdrawalWorkflow.service applyWorkflowAction — open_work_order asignacion", () => {
  const baseRow = {
    source_type: "request",
    source_id: "99",
    client_name: "Cliente Demo",
    request_snapshot: JSON.stringify({ client_name: "Cliente Demo", requester_id: 1 }),
    workflow_state: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza asignar la WO a un usuario sin rol de servicio", async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 5, email: "vendedor@fam.test", role: "comercial", display_name: "Vendedor" }],
    });

    await expect(
      applyWorkflowAction({
        row: baseRow,
        action: "open_work_order",
        payload: { work_order_number: "WO-1", assigned_user_id: 5 },
        user: { id: 1 },
      })
    ).rejects.toThrow(/ingeniero de servicio, especialista de aplicaciones o jefe de servicio/);

    expect(notificationManager.sendNotification).not.toHaveBeenCalled();
  });

  it.each(["ing_servicio", "esp_app", "jefe_servicio"])(
    "acepta y notifica al asignado con rol %s",
    async (role) => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 6, email: "tecnico@fam.test", role, display_name: "Técnico Demo" }],
      });

      const result = await applyWorkflowAction({
        row: baseRow,
        action: "open_work_order",
        payload: { work_order_number: "WO-2", assigned_user_id: 6 },
        user: { id: 1 },
      });

      expect(result.nextState.work_order.assigned_user_id).toBe(6);
      expect(result.nextState.work_order.assigned_email).toBe("tecnico@fam.test");
      expect(notificationManager.sendNotification).toHaveBeenCalledTimes(1);
      expect(notificationManager.sendNotification.mock.calls[0][0]).toMatchObject({ userId: 6 });
    }
  );

  it("sigue funcionando sin assigned_user_id (solo texto libre, compatibilidad hacia atras)", async () => {
    const result = await applyWorkflowAction({
      row: baseRow,
      action: "open_work_order",
      payload: { work_order_number: "WO-3", assigned_to: "Contratista externo" },
      user: { id: 1 },
    });

    expect(db.query).not.toHaveBeenCalled();
    expect(result.nextState.work_order.assigned_to).toBe("Contratista externo");
    expect(result.nextState.work_order.assigned_user_id).toBeNull();
    expect(notificationManager.sendNotification).not.toHaveBeenCalled();
  });

  it("rechaza si el usuario asignado no existe", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      applyWorkflowAction({
        row: baseRow,
        action: "open_work_order",
        payload: { work_order_number: "WO-4", assigned_user_id: 999 },
        user: { id: 1 },
      })
    ).rejects.toThrow(/no existe/);
  });
});
