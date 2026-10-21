import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

jest.mock("react-hot-toast", () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../../../../core/api/rbacAdminApi", () => ({
  getRbacSummary: jest.fn(),
  getRbacMembers: jest.fn(),
  getRbacRoles: jest.fn(),
  getRbacPermissions: jest.fn(),
  getRbacUserAccess: jest.fn(),
  getRbacMatrix: jest.fn(),
  getRbacAudit: jest.fn(),
  syncRbacInherited: jest.fn(),
  assignRbacRole: jest.fn(),
  revokeRbacRole: jest.fn(),
  grantRbacPermission: jest.fn(),
  revokeRbacGrant: jest.fn(),
}));

const toast = require("react-hot-toast").default;
const api = require("../../../../core/api/rbacAdminApi");
const RbacCentralPanel = require("../RbacCentralPanel").default;

const summary = { roles: 3, permissions: 10, endpoints: 20, manual_assignments: 1, enforcement: { central_decides: false, note: "Hoy decide requireRole." } };

beforeEach(() => {
  jest.clearAllMocks();
  api.getRbacMembers.mockResolvedValue([{ id: 7, fullname: "Persona Prueba", email: "p@x.test", active: true }]);
  api.getRbacSummary.mockResolvedValue(summary);
  api.getRbacRoles.mockResolvedValue([{ id: 1, key: "comercial", permissions: 4, users: 2 }]);
  api.getRbacPermissions.mockResolvedValue([{ key: "clients.root.read", roles: 2 }]);
});

describe("panel Roles y permisos", () => {
  it("muestra el estado de carga y luego el aviso de que no cambia el acceso real", async () => {
    render(<RbacCentralPanel />);
    expect(screen.getByRole("status").textContent).toMatch(/Cargando/);
    expect(await screen.findByText(/todavía no modifica el acceso real de nadie/)).toBeTruthy();
    expect(screen.getByText("Endpoints con permiso")).toBeTruthy();
  });

  it("avisa con un error si el catalogo no carga", async () => {
    api.getRbacSummary.mockRejectedValue(new Error("fallo"));
    render(<RbacCentralPanel />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/No se pudo cargar el catálogo/)));
  });

  it("matriz: estado de carga, datos y error diferenciados", async () => {
    api.getRbacMatrix.mockResolvedValueOnce({ areas: ["clients"], roles: ["comercial"], cells: { "comercial|clients": 4 } });
    render(<RbacCentralPanel />);
    fireEvent.click(await screen.findByRole("tab", { name: "Matriz" }));
    expect(await screen.findByRole("table", { name: "Permisos por rol y área" })).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();

    api.getRbacAudit.mockRejectedValueOnce(new Error("fallo"));
    fireEvent.click(screen.getByRole("tab", { name: "Auditoría" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/No se pudo cargar esta vista/);
  });

  it("auditoria: vacia y con entradas muestra antes y despues", async () => {
    api.getRbacAudit.mockResolvedValueOnce([]);
    const { unmount } = render(<RbacCentralPanel />);
    fireEvent.click(await screen.findByRole("tab", { name: "Auditoría" }));
    expect(await screen.findByText("Todavía no hay cambios registrados.")).toBeTruthy();
    unmount();

    api.getRbacAudit.mockResolvedValueOnce([
      { id: 1, action: "asignar_rol", description: "Rol logistica: cubre vacaciones", actor: "ti@x.test", at: "2026-10-08T10:00:00Z", before: null, after: { role: "logistica" } },
    ]);
    render(<RbacCentralPanel />);
    fireEvent.click(await screen.findByRole("tab", { name: "Auditoría" }));
    expect(await screen.findByText("Rol asignado")).toBeTruthy();
    expect(screen.getByText(/^Después:/)).toBeTruthy();
    expect(screen.queryByText(/^Antes:/)).toBeNull();
  });

  it("restringido: un 403 del servidor se informa y no deja datos en pantalla", async () => {
    api.getRbacSummary.mockRejectedValue({ response: { status: 403 } });
    render(<RbacCentralPanel />);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText("Acceso por usuario")).toBeNull();
  });

  it("la sincronizacion pide confirmacion y no actua si se cancela", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<RbacCentralPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizar roles heredados" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/cambia el acceso real/));
    expect(api.syncRbacInherited).not.toHaveBeenCalled();
  });

  it("al elegir un usuario muestra sus roles y bloquea envios duplicados mientras guarda", async () => {
    api.getRbacUserAccess.mockResolvedValue({
      user: { id: 7, role: "comercial" },
      assignments: [{ id: 1, role: "comercial", source: "legacy_role", expires_at: null }],
      grants: [],
    });
    let release;
    api.assignRbacRole.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ user: { id: 7, role: "comercial" }, assignments: [], grants: [] }); }));
    render(<RbacCentralPanel />);
    fireEvent.change(await screen.findByLabelText("Usuario"), { target: { value: "7" } });
    expect(await screen.findByText("Rol del usuario")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "comercial" } });
    fireEvent.change(screen.getAllByLabelText("Motivo (obligatorio)")[0], { target: { value: "cubre vacaciones" } });
    const submit = screen.getByRole("button", { name: "Asignar rol" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(api.assignRbacRole).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rol asignado."));
  });
});

describe("estados de error del panel", () => {
  it("fallo recuperable: muestra reintentar y vuelve a cargar", async () => {
    api.getRbacSummary.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValue(summary);
    render(<RbacCentralPanel />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/No se pudo cargar el catálogo/);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/todavía no modifica el acceso real/)).toBeTruthy();
  });

  it("restringido: mensaje propio y sin boton de reintentar", async () => {
    api.getRbacSummary.mockRejectedValue({ response: { status: 403 } });
    render(<RbacCentralPanel />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/No tienes permiso/);
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
});
