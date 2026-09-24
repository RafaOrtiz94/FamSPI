// Reemplaza workManagement.updateItemSupporters.test.js: el viejo
// updateItemSupporters ("reemplazar toda la lista") se partio en
// addItemSupporter/removeItemSupporter (uno a la vez) para poder guardar
// contexto/assigned_by/created_at por persona sin arriesgar perder esos
// datos por una condicion de carrera al re-guardar la lista completa. Ver
// workManagement.service.js#addItemSupporter/removeItemSupporter.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../notifications/notificationManager", () => ({ sendNotification: jest.fn().mockResolvedValue(undefined) }));

const db = require("../../../config/db");
const notificationManager = require("../../notifications/notificationManager");
const { addItemSupporter, removeItemSupporter } = require("../workManagement.service");

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const BOARD_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_USER_ID = 29;
const SUPPORTER_ID = 55;

function baseAccessMocks() {
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
      return Promise.resolve({ rows: [{ id: params[0] }] });
    }
    throw new Error(`db.query no mockeada: ${sql}`);
  });
}

describe("addItemSupporter", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("rechaza sin context", async () => {
    baseAccessMocks();
    await expect(
      addItemSupporter(ITEM_ID, { supporter_user_id: SUPPORTER_ID, context: "  " }, ACTOR_USER_ID)
    ).rejects.toMatchObject({ status: 400 });
    expect(db.getClient).not.toHaveBeenCalled();
  });

  it("agrega un apoyo nuevo: enrola como viewer y notifica con boton hacia el proyecto", async () => {
    baseAccessMocks();
    const clientQuery = jest.fn((sql) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return Promise.resolve();
      }
      if (sql.includes("INSERT INTO work_management.followers")) {
        return Promise.resolve({ rows: [{ inserted: true }] });
      }
      if (sql.includes("FROM work_management.projects")) {
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

    const result = await addItemSupporter(
      ITEM_ID,
      { supporter_user_id: SUPPORTER_ID, context: "Revisar el anexo tecnico antes del viernes" },
      ACTOR_USER_ID
    );

    expect(result).toMatchObject({ supporter_user_id: SUPPORTER_ID, is_new: true });

    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO work_management.workspace_members"),
      [WORKSPACE_ID, SUPPORTER_ID, ACTOR_USER_ID]
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO work_management.project_members"),
      [PROJECT_ID, SUPPORTER_ID, ACTOR_USER_ID]
    );
    const membersCall = clientQuery.mock.calls.find(([sql]) => sql.includes("INSERT INTO work_management.project_members"));
    expect(membersCall[0]).toMatch(/'viewer'/);

    expect(notificationManager.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SUPPORTER_ID,
        source: "work_management.item.supporter_assigned",
        customMessage: expect.stringContaining("Revisar el anexo tecnico antes del viernes"),
        meta: expect.objectContaining({
          target_path: `/dashboard/work-management/projects/${PROJECT_ID}`,
          cta_label: "Abrir en Work Management",
        }),
      })
    );
  });

  it("si ya era apoyo (ON CONFLICT actualiza), no re-enrola ni re-notifica", async () => {
    baseAccessMocks();
    const clientQuery = jest.fn((sql) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return Promise.resolve();
      }
      if (sql.includes("INSERT INTO work_management.followers")) {
        return Promise.resolve({ rows: [{ inserted: false }] });
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      throw new Error(`client.query no mockeada: ${sql}`);
    });
    db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });

    const result = await addItemSupporter(
      ITEM_ID,
      { supporter_user_id: SUPPORTER_ID, context: "Contexto actualizado" },
      ACTOR_USER_ID
    );

    expect(result).toMatchObject({ is_new: false });
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO work_management.workspace_members"),
      expect.anything()
    );
    expect(notificationManager.sendNotification).not.toHaveBeenCalled();
  });
});

describe("removeItemSupporter", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("borra solo la fila de ese usuario, sin tocar el resto de los apoyos", async () => {
    db.query.mockImplementation((sql) => {
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
      if (sql.includes("DELETE FROM work_management.followers")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      throw new Error(`db.query no mockeada: ${sql}`);
    });

    const result = await removeItemSupporter(ITEM_ID, SUPPORTER_ID, ACTOR_USER_ID);

    expect(result).toEqual({ item_id: ITEM_ID, supporter_user_id: SUPPORTER_ID });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM work_management.followers WHERE item_id = $1 AND user_id = $2"),
      [ITEM_ID, SUPPORTER_ID]
    );
  });
});
