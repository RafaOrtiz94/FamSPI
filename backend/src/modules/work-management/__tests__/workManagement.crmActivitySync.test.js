// Cobertura de syncCrmActivityForItem: un item de Work Management debe
// reflejarse como actividad de crm.crm_activities SOLO cuando su proyecto ya
// tiene crm_opportunity_id/crm_account_id (no se inventa un vinculo CRM), y
// la sincronizacion nunca debe bloquear la operacion de Work Management aun
// si crm.crm_activities falla.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const logger = require("../../../config/logger");
const { createItem, updateItem, deleteItem } = require("../workManagement.service");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const BOARD_ID = "44444444-4444-4444-8444-444444444444";
const ITEM_ID = "55555555-5555-4555-8555-555555555555";
const ACTIVITY_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = 29;

function mockAccessChain(db, { crmOpportunityId = null, crmAccountId = null } = {}) {
  db.query.mockImplementation((sql) => {
    if (sql.includes("FROM work_management.board_groups g")) {
      return Promise.resolve({ rows: [{ id: GROUP_ID, board_id: BOARD_ID, project_id: PROJECT_ID }] });
    }
    if (sql.includes("FROM work_management.items i")) {
      return Promise.resolve({
        rows: [{
          id: ITEM_ID,
          project_id: PROJECT_ID,
          board_id: BOARD_ID,
          group_id: GROUP_ID,
          title: "Tarea",
          status: "in_progress",
          crm_activity_id: ACTIVITY_ID,
        }],
      });
    }
    if (sql.includes("FROM work_management.projects p")) {
      return Promise.resolve({ rows: [{ id: PROJECT_ID, workspace_id: WORKSPACE_ID, owner_user_id: USER_ID }] });
    }
    if (sql.includes("FROM work_management.workspaces w")) {
      return Promise.resolve({ rows: [{ id: WORKSPACE_ID, owner_user_id: USER_ID }] });
    }
    if (sql.includes("FROM work_management.items") && sql.includes("created_at >")) {
      return Promise.resolve({ rows: [] });
    }
    throw new Error(`db.query no mockeada: ${sql}`);
  });
}

describe("syncCrmActivityForItem — via createItem", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("proyecto CON crm_opportunity_id: crea la actividad en crm.crm_activities y guarda crm_activity_id en el item", async () => {
    mockAccessChain(db);

    const clientQuery = jest.fn((sql) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return Promise.resolve();
      }
      if (sql.includes("MAX(sort_order)")) {
        return Promise.resolve({ rows: [{ next_sort_order: 0 }] });
      }
      if (sql.includes("INSERT INTO work_management.items")) {
        return Promise.resolve({
          rows: [{ id: ITEM_ID, project_id: PROJECT_ID, group_id: GROUP_ID, title: "Nuevo item", status: "todo", crm_activity_id: null }],
        });
      }
      if (sql.includes("FROM work_management.projects")) {
        return Promise.resolve({
          rows: [{ id: PROJECT_ID, name: "Proyecto vinculado", crm_opportunity_id: "opp-1", crm_account_id: null }],
        });
      }
      if (sql.includes("INSERT INTO crm.crm_activities")) {
        return Promise.resolve({ rows: [{ id: ACTIVITY_ID }] });
      }
      if (sql.includes("UPDATE work_management.items") && sql.includes("crm_activity_id")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      throw new Error(`client.query no mockeada: ${sql}`);
    });
    db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });

    const item = await createItem(GROUP_ID, { title: "Nuevo item" }, USER_ID);

    expect(item.id).toBe(ITEM_ID);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crm.crm_activities"),
      expect.arrayContaining(["opp-1"])
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE work_management.items"),
      [ACTIVITY_ID, ITEM_ID]
    );
  });

  it("proyecto SIN crm_opportunity_id ni crm_account_id: no toca crm.crm_activities", async () => {
    mockAccessChain(db);

    const clientQuery = jest.fn((sql) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return Promise.resolve();
      }
      if (sql.includes("MAX(sort_order)")) {
        return Promise.resolve({ rows: [{ next_sort_order: 0 }] });
      }
      if (sql.includes("INSERT INTO work_management.items")) {
        return Promise.resolve({
          rows: [{ id: ITEM_ID, project_id: PROJECT_ID, group_id: GROUP_ID, title: "Nuevo item", status: "todo", crm_activity_id: null }],
        });
      }
      if (sql.includes("FROM work_management.projects")) {
        return Promise.resolve({
          rows: [{ id: PROJECT_ID, name: "Proyecto sin CRM", crm_opportunity_id: null, crm_account_id: null }],
        });
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      throw new Error(`client.query no mockeada: ${sql}`);
    });
    db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });

    const item = await createItem(GROUP_ID, { title: "Nuevo item" }, USER_ID);

    expect(item.id).toBe(ITEM_ID);
    expect(clientQuery).not.toHaveBeenCalledWith(expect.stringContaining("crm.crm_activities"), expect.anything());
  });

  it("un fallo al sincronizar con CRM no bloquea la creacion del item (solo logger.warn)", async () => {
    mockAccessChain(db);

    const clientQuery = jest.fn((sql) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return Promise.resolve();
      }
      if (sql.includes("MAX(sort_order)")) {
        return Promise.resolve({ rows: [{ next_sort_order: 0 }] });
      }
      if (sql.includes("INSERT INTO work_management.items")) {
        return Promise.resolve({
          rows: [{ id: ITEM_ID, project_id: PROJECT_ID, group_id: GROUP_ID, title: "Nuevo item", status: "todo", crm_activity_id: null }],
        });
      }
      if (sql.includes("FROM work_management.projects")) {
        return Promise.resolve({
          rows: [{ id: PROJECT_ID, name: "Proyecto vinculado", crm_opportunity_id: "opp-1", crm_account_id: null }],
        });
      }
      if (sql.includes("INSERT INTO crm.crm_activities")) {
        return Promise.reject(new Error("crm.crm_activities no disponible"));
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      throw new Error(`client.query no mockeada: ${sql}`);
    });
    db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });

    const item = await createItem(GROUP_ID, { title: "Nuevo item" }, USER_ID);

    expect(item.id).toBe(ITEM_ID);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe("syncCrmActivityForItem — via updateItem", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("marcar el item como 'done' actualiza (no duplica) la actividad CRM ya vinculada, a 'completed'", async () => {
    mockAccessChain(db);

    const clientQuery = jest.fn((sql) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return Promise.resolve();
      }
      if (sql.includes("UPDATE work_management.items") && sql.includes("RETURNING *")) {
        return Promise.resolve({
          rows: [{ id: ITEM_ID, project_id: PROJECT_ID, board_id: BOARD_ID, title: "Tarea", status: "done", crm_activity_id: ACTIVITY_ID }],
        });
      }
      if (sql.includes("FROM work_management.projects")) {
        return Promise.resolve({
          rows: [{ id: PROJECT_ID, name: "Proyecto vinculado", crm_opportunity_id: "opp-1", crm_account_id: null }],
        });
      }
      if (sql.includes("UPDATE crm.crm_activities")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      throw new Error(`client.query no mockeada: ${sql}`);
    });
    db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });

    await updateItem(ITEM_ID, { status: "done" }, USER_ID, "comercial");

    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crm.crm_activities"),
      expect.arrayContaining([ACTIVITY_ID, "completed"])
    );
    expect(clientQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO crm.crm_activities"), expect.anything());
  });
});

describe("syncCrmActivityForItem — via deleteItem", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("borrar el item hace soft-delete (deleted_at) de la actividad CRM vinculada, no un DELETE fisico", async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM work_management.items i")) {
        return Promise.resolve({
          rows: [{ id: ITEM_ID, project_id: PROJECT_ID, board_id: BOARD_ID, title: "Tarea", crm_activity_id: ACTIVITY_ID }],
        });
      }
      if (sql.includes("FROM work_management.projects p")) {
        return Promise.resolve({ rows: [{ id: PROJECT_ID, workspace_id: WORKSPACE_ID, owner_user_id: USER_ID }] });
      }
      if (sql.includes("FROM work_management.workspaces w")) {
        return Promise.resolve({ rows: [{ id: WORKSPACE_ID, owner_user_id: USER_ID }] });
      }
      if (sql.includes("FROM work_management.projects") && !sql.includes(" p")) {
        return Promise.resolve({
          rows: [{ id: PROJECT_ID, name: "Proyecto vinculado", crm_opportunity_id: "opp-1", crm_account_id: null }],
        });
      }
      if (sql.includes("UPDATE crm.crm_activities")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO work_management.work_activity_log")) {
        return Promise.resolve();
      }
      if (sql.includes("DELETE FROM work_management.items")) {
        return Promise.resolve({ rows: [] });
      }
      throw new Error(`db.query no mockeada: ${sql}`);
    });

    const result = await deleteItem(ITEM_ID, USER_ID, "comercial");

    expect(result).toEqual({ id: ITEM_ID });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crm.crm_activities SET deleted_at"),
      [ACTIVITY_ID]
    );
  });
});
