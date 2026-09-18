// Requerimiento: al asignar a un usuario como apoyo ("followers") de un item,
// debe quedar habilitado para ABRIR ese item -- lo que exige ser miembro
// (viewer) del workspace y del proyecto -- y recibir una notificacion.
// Ver workManagement.service.js:updateItemSupporters.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../notifications/notificationManager", () => ({ sendNotification: jest.fn().mockResolvedValue(undefined) }));

const db = require("../../../config/db");
const notificationManager = require("../../notifications/notificationManager");
const { updateItemSupporters } = require("../workManagement.service");

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const BOARD_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_USER_ID = 29;
const NEW_SUPPORTER_ID = 55;
const ALREADY_SUPPORTER_ID = 56;

function baseAccessMocks({ existingFollowerIds = [] } = {}) {
  db.query.mockImplementation((sql, params) => {
    if (sql.includes("FROM work_management.items i")) {
      return Promise.resolve({
        rows: [{ id: ITEM_ID, project_id: PROJECT_ID, board_id: BOARD_ID, title: "Revisar contrato" }],
      });
    }
    if (sql.includes("FROM work_management.projects p")) {
      return Promise.resolve({ rows: [{ id: PROJECT_ID, workspace_id: WORKSPACE_ID, owner_user_id: ACTOR_USER_ID }] });
    }
    if (sql.includes("FROM work_management.workspaces w")) {
      return Promise.resolve({ rows: [{ id: WORKSPACE_ID, owner_user_id: ACTOR_USER_ID }] });
    }
    if (sql.includes("FROM public.users") && sql.includes("COALESCE(active, true) = true")) {
      // todos los ids solicitados son usuarios activos validos
      return Promise.resolve({ rows: params[0].map((id) => ({ id })) });
    }
    throw new Error(`Query no mockeada: ${sql}`);
  });

  const clientQuery = jest.fn((sql) => {
    if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
      return Promise.resolve();
    }
    if (sql.includes("SELECT user_id") && sql.includes("FROM work_management.followers")) {
      return Promise.resolve({ rows: existingFollowerIds.map((id) => ({ user_id: id })) });
    }
    if (sql.includes("DELETE FROM work_management.followers")) {
      return Promise.resolve();
    }
    if (sql.includes("INSERT INTO work_management.followers")) {
      return Promise.resolve();
    }
    if (sql.includes("SELECT id, name, workspace_id FROM work_management.projects")) {
      return Promise.resolve({ rows: [{ id: PROJECT_ID, name: "Implementacion CRM", workspace_id: WORKSPACE_ID }] });
    }
    if (sql.includes("INSERT INTO work_management.workspace_members")) {
      return Promise.resolve();
    }
    if (sql.includes("INSERT INTO work_management.project_members")) {
      return Promise.resolve();
    }
    if (sql.includes("INSERT INTO work_management.work_activity_log")) {
      return Promise.resolve();
    }
    throw new Error(`client.query no mockeada: ${sql}`);
  });
  db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
  return clientQuery;
}

describe("updateItemSupporters — auto-enrolamiento y notificacion", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("agrega al nuevo apoyo como viewer del workspace y del proyecto (solo ese proyecto)", async () => {
    const clientQuery = baseAccessMocks({ existingFollowerIds: [] });

    await updateItemSupporters(ITEM_ID, { support_user_ids: [NEW_SUPPORTER_ID] }, ACTOR_USER_ID);

    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO work_management.workspace_members"),
      [WORKSPACE_ID, NEW_SUPPORTER_ID, ACTOR_USER_ID]
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO work_management.project_members"),
      [PROJECT_ID, NEW_SUPPORTER_ID, ACTOR_USER_ID]
    );
    // el rol insertado debe ser 'viewer', nunca editor/admin
    const membersCall = clientQuery.mock.calls.find(([sql]) => sql.includes("INSERT INTO work_management.project_members"));
    expect(membersCall[0]).toMatch(/'viewer'/);
  });

  it("envia una notificacion al nuevo apoyo mencionando el item y el proyecto", async () => {
    baseAccessMocks({ existingFollowerIds: [] });

    await updateItemSupporters(ITEM_ID, { support_user_ids: [NEW_SUPPORTER_ID] }, ACTOR_USER_ID);

    expect(notificationManager.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: NEW_SUPPORTER_ID,
        source: "work_management.item.supporter_assigned",
        customMessage: expect.stringContaining("Revisar contrato"),
      })
    );
    expect(notificationManager.sendNotification.mock.calls[0][0].customMessage).toEqual(
      expect.stringContaining("Implementacion CRM")
    );
  });

  it("no re-inscribe ni re-notifica a un apoyo que ya estaba asignado", async () => {
    const clientQuery = baseAccessMocks({ existingFollowerIds: [ALREADY_SUPPORTER_ID] });

    await updateItemSupporters(ITEM_ID, { support_user_ids: [ALREADY_SUPPORTER_ID] }, ACTOR_USER_ID);

    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO work_management.workspace_members"),
      expect.anything()
    );
    expect(notificationManager.sendNotification).not.toHaveBeenCalled();
  });
});
