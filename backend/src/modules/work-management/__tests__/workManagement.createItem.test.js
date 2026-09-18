// Cobertura del guard "item creado en el proyecto equivocado" (createItem).
// Ver comentario en workManagement.service.js:2098 -- el bug real reportado
// (Karen Barberan, ago 2026, y reincidencias posteriores) era un group_id
// obsoleto en el frontend tras cambiar de proyecto. Estos tests fijan el
// contrato del backend independientemente de si el frontend manda o no
// expected_project_id.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const { createItem } = require("../workManagement.service");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const BOARD_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = 29;

function setupHappyPathMocks() {
  db.query.mockImplementation((sql) => {
    if (sql.includes("FROM work_management.board_groups g")) {
      return Promise.resolve({ rows: [{ id: GROUP_ID, board_id: BOARD_ID, project_id: GROUP_PROJECT_ID }] });
    }
    if (sql.includes("FROM work_management.projects p")) {
      return Promise.resolve({
        rows: [{ id: GROUP_PROJECT_ID, workspace_id: "ws-1", owner_user_id: USER_ID, member_role: null, membership_active: null }],
      });
    }
    if (sql.includes("FROM work_management.workspaces w")) {
      return Promise.resolve({
        rows: [{ id: "ws-1", owner_user_id: USER_ID, member_role: null, membership_active: null }],
      });
    }
    if (sql.includes("FROM work_management.items") && sql.includes("created_at >")) {
      return Promise.resolve({ rows: [] }); // sin duplicado reciente
    }
    throw new Error(`Query no mockeada: ${sql}`);
  });

  const clientQuery = jest.fn((sql) => {
    if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
      return Promise.resolve();
    }
    if (sql.includes("MAX(sort_order)")) {
      return Promise.resolve({ rows: [{ next_sort_order: 0 }] });
    }
    if (sql.includes("INSERT INTO work_management.items")) {
      return Promise.resolve({
        rows: [{ id: "item-1", project_id: GROUP_PROJECT_ID, group_id: GROUP_ID, title: "Nuevo item" }],
      });
    }
    if (sql.includes("INSERT INTO work_management.work_activity_log")) {
      return Promise.resolve();
    }
    throw new Error(`client.query no mockeada: ${sql}`);
  });

  db.getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
  return clientQuery;
}

describe("createItem — guard de proyecto equivocado", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("crea el item bajo el proyecto REAL del grupo cuando expected_project_id coincide", async () => {
    setupHappyPathMocks();
    const item = await createItem(GROUP_ID, { title: "Nuevo item", expected_project_id: GROUP_PROJECT_ID }, USER_ID);
    expect(item.project_id).toBe(GROUP_PROJECT_ID);
  });

  it("rechaza con 409 si expected_project_id no coincide con el proyecto real del grupo (bug reproducido)", async () => {
    const clientQuery = setupHappyPathMocks();
    await expect(
      createItem(GROUP_ID, { title: "Item de otro proyecto", expected_project_id: OTHER_PROJECT_ID }, USER_ID)
    ).rejects.toMatchObject({ status: 409 });
    // Ademas de rechazar, no debe haber llegado a insertar nada.
    expect(clientQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO work_management.items"), expect.anything());
  });

  it("sin expected_project_id (cliente legacy), igual inserta bajo el proyecto real del grupo, nunca bajo uno distinto", async () => {
    setupHappyPathMocks();
    const item = await createItem(GROUP_ID, { title: "Item sin chequeo explicito" }, USER_ID);
    expect(item.project_id).toBe(GROUP_PROJECT_ID);
    expect(item.project_id).not.toBe(OTHER_PROJECT_ID);
  });

  it("devuelve el item existente en vez de duplicar si el mismo usuario reintenta el mismo titulo en <2min", async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM work_management.board_groups g")) {
        return Promise.resolve({ rows: [{ id: GROUP_ID, board_id: BOARD_ID, project_id: GROUP_PROJECT_ID }] });
      }
      if (sql.includes("FROM work_management.projects p")) {
        return Promise.resolve({
          rows: [{ id: GROUP_PROJECT_ID, workspace_id: "ws-1", owner_user_id: USER_ID }],
        });
      }
      if (sql.includes("FROM work_management.workspaces w")) {
        return Promise.resolve({ rows: [{ id: "ws-1", owner_user_id: USER_ID }] });
      }
      if (sql.includes("FROM work_management.items") && sql.includes("created_at >")) {
        return Promise.resolve({ rows: [{ id: "item-existente", project_id: GROUP_PROJECT_ID, title: "Repetido" }] });
      }
      throw new Error(`Query no mockeada: ${sql}`);
    });
    db.getClient.mockResolvedValue({ query: jest.fn(), release: jest.fn() });

    const item = await createItem(GROUP_ID, { title: "Repetido" }, USER_ID);
    expect(item.id).toBe("item-existente");
    expect(db.getClient).not.toHaveBeenCalled(); // no abre transaccion, no inserta de nuevo
  });
});
