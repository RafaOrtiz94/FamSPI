// jefe_comercial (y demas MANAGER_ROLES) debe ver y administrar TODOS los
// workspaces del modulo, no solo los propios/donde es miembro -- antes el
// filtro de listWorkspaces no tenia bypass de rol para nadie, y no existia
// forma de renombrar/editar un workspace ni administrar sus miembros.
jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const service = require("../workManagement.service");

describe("listWorkspaces - bypass de manager", () => {
  beforeEach(() => db.query.mockReset());

  it("jefe_comercial recibe bypass=true en la query (ve todos los workspaces)", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await service.listWorkspaces(42, "jefe_comercial");
    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual([42, true]);
  });

  it("un rol sin privilegio de manager no recibe bypass", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await service.listWorkspaces(42, "comercial");
    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual([42, false]);
  });
});

describe("updateWorkspace - control de acceso de administracion", () => {
  beforeEach(() => db.query.mockReset());

  const workspaceRow = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    owner_user_id: 99,
    member_role: null,
    membership_active: null,
    name: "Original",
    description: null,
  };

  it("jefe_comercial puede renombrar un workspace del que no es dueno ni miembro", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [workspaceRow] }) // assertWorkspaceAccess
      .mockResolvedValueOnce({ rows: [{ ...workspaceRow, name: "Nuevo nombre" }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // logActivity

    const result = await service.updateWorkspace(
      workspaceRow.id,
      { name: "Nuevo nombre" },
      1, // userId distinto del owner
      "jefe_comercial",
    );
    expect(result.name).toBe("Nuevo nombre");
  });

  it("un miembro comun ('member', no owner/admin) no puede renombrar el workspace", async () => {
    const memberRow = { ...workspaceRow, member_role: "member", membership_active: true };
    db.query.mockResolvedValueOnce({ rows: [memberRow] }); // assertWorkspaceAccess (pasa por ser miembro activo)
    await expect(
      service.updateWorkspace(workspaceRow.id, { name: "Hackeado" }, 1, "comercial"),
    ).rejects.toThrow(/permisos/i);
  });

  it("un usuario ajeno (ni dueño, ni miembro, ni manager) recibe acceso denegado al workspace", async () => {
    db.query.mockResolvedValueOnce({ rows: [workspaceRow] }); // assertWorkspaceAccess
    await expect(
      service.updateWorkspace(workspaceRow.id, { name: "Hackeado" }, 1, "comercial"),
    ).rejects.toThrow(/acceso denegado/i);
  });

  it("el dueño del workspace si puede renombrarlo aunque no sea manager", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [workspaceRow] })
      .mockResolvedValueOnce({ rows: [{ ...workspaceRow, name: "Renombrado por dueño" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.updateWorkspace(
      workspaceRow.id,
      { name: "Renombrado por dueño" },
      99, // mismo id que owner_user_id
      "comercial",
    );
    expect(result.name).toBe("Renombrado por dueño");
  });
});

// Bug real reportado tras el fix de listWorkspaces: jefe_comercial ya veia
// TODOS los workspaces en la lista, pero al entrar a un proyecto especifico
// de un workspace ajeno seguia recibiendo 403 ("Acceso denegado al
// proyecto") porque assertProjectAccess (y assertBoardAccess/
// assertGroupAccess/assertItemAccess, que lo llaman internamente) no tenian
// el mismo bypass de rol -- listWorkspaces por si solo no bastaba.
describe("getProject - bypass de manager a nivel de proyecto", () => {
  beforeEach(() => db.query.mockReset());

  const projectRow = {
    id: "660e8400-e29b-41d4-a716-446655440000",
    workspace_id: "550e8400-e29b-41d4-a716-446655440000",
    owner_user_id: 99,
    member_role: null,
    membership_active: null,
  };
  const workspaceRow = {
    id: projectRow.workspace_id,
    owner_user_id: 99,
    member_role: null,
    membership_active: null,
  };

  it("jefe_comercial puede abrir un proyecto de un workspace del que no es dueño ni miembro", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [projectRow] }) // assertProjectAccess: SELECT project
      .mockResolvedValueOnce({ rows: [workspaceRow] }) // assertWorkspaceAccess (interno)
      .mockResolvedValueOnce({ rows: [{ id: projectRow.id }] }); // SELECT final de getProject

    const result = await service.getProject(projectRow.id, 1, "jefe_comercial");
    expect(result.id).toBe(projectRow.id);
  });

  it("un usuario ajeno (ni dueño, ni miembro, ni manager) sigue recibiendo acceso denegado", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [projectRow] })
      .mockResolvedValueOnce({ rows: [workspaceRow] });

    // assertProjectAccess llama primero a assertWorkspaceAccess -- para un
    // ajeno total, el rechazo ocurre ahi ("...al workspace"), antes de
    // llegar al chequeo propio del proyecto.
    await expect(service.getProject(projectRow.id, 1, "comercial")).rejects.toThrow(
      /acceso denegado al workspace/i,
    );
  });
});

// Eliminar workspaces/proyectos/items no existia en absoluto en el modulo --
// se agrega gateado por el mismo criterio de administracion (manager,
// owner/admin) para workspace/proyecto, y por acceso normal (igual que
// editar) para items.
describe("deleteWorkspace / deleteProject / deleteItem", () => {
  beforeEach(() => db.query.mockReset());

  const workspaceRow = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    owner_user_id: 99,
    member_role: null,
    membership_active: null,
    name: "WS",
  };
  const projectRow = {
    id: "660e8400-e29b-41d4-a716-446655440000",
    workspace_id: workspaceRow.id,
    owner_user_id: 99,
    member_role: null,
    membership_active: null,
    name: "Proyecto",
  };
  const itemRow = {
    id: "770e8400-e29b-41d4-a716-446655440000",
    project_id: projectRow.id,
    board_id: "880e8400-e29b-41d4-a716-446655440000",
    title: "Tarea",
  };

  it("jefe_comercial puede eliminar un workspace que no le pertenece", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [workspaceRow] }) // assertWorkspaceAccess
      .mockResolvedValueOnce({ rows: [] }) // logActivity
      .mockResolvedValueOnce({ rows: [] }); // DELETE

    const result = await service.deleteWorkspace(workspaceRow.id, 1, "jefe_comercial");
    expect(result).toEqual({ id: workspaceRow.id });
  });

  it("un miembro comun no puede eliminar el workspace", async () => {
    const memberRow = { ...workspaceRow, member_role: "member", membership_active: true };
    db.query.mockResolvedValueOnce({ rows: [memberRow] });
    await expect(service.deleteWorkspace(workspaceRow.id, 1, "comercial")).rejects.toThrow(/permisos/i);
  });

  it("jefe_comercial puede eliminar un proyecto que no le pertenece", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [projectRow] }) // assertProjectAccess
      .mockResolvedValueOnce({ rows: [workspaceRow] }) // assertWorkspaceAccess (dentro de assertProjectAccess)
      .mockResolvedValueOnce({ rows: [workspaceRow] }) // assertWorkspaceAccess (llamado de nuevo en deleteProject)
      .mockResolvedValueOnce({ rows: [] }) // logActivity
      .mockResolvedValueOnce({ rows: [] }); // DELETE

    const result = await service.deleteProject(projectRow.id, 1, "jefe_comercial");
    expect(result).toEqual({ id: projectRow.id });
  });

  it("un miembro comun del proyecto (no owner/admin, ni del proyecto ni del workspace) no puede eliminarlo", async () => {
    const memberProjectRow = { ...projectRow, member_role: "member", membership_active: true };
    // Miembro tambien del workspace (para que assertWorkspaceAccess no lo
    // rechace antes de llegar al chequeo de administracion del proyecto),
    // pero solo como 'member', no owner/admin.
    const memberWorkspaceRow = { ...workspaceRow, member_role: "member", membership_active: true };
    db.query
      .mockResolvedValueOnce({ rows: [memberProjectRow] })
      .mockResolvedValueOnce({ rows: [memberWorkspaceRow] })
      .mockResolvedValueOnce({ rows: [memberWorkspaceRow] });

    await expect(service.deleteProject(projectRow.id, 1, "comercial")).rejects.toThrow(/permisos/i);
  });

  it("cualquiera con acceso al item (igual que para editarlo) puede eliminarlo", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [itemRow] }) // assertItemAccess: SELECT item
      .mockResolvedValueOnce({ rows: [projectRow] }) // assertProjectAccess interno
      .mockResolvedValueOnce({ rows: [workspaceRow] }) // assertWorkspaceAccess interno
      .mockResolvedValueOnce({ rows: [] }) // logActivity
      .mockResolvedValueOnce({ rows: [] }); // DELETE

    const result = await service.deleteItem(itemRow.id, 1, "jefe_comercial");
    expect(result).toEqual({ id: itemRow.id });
  });
});
