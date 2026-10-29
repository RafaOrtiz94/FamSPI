import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

jest.mock("react-hot-toast", () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../../../../core/api/rbacAdminApi", () => ({
  getRbacRoles: jest.fn(),
  getRbacPermissions: jest.fn(),
  getRbacRole: jest.fn(),
  createRbacRole: jest.fn(),
  updateRbacRole: jest.fn(),
  archiveRbacRole: jest.fn(),
}));

const toast = require("react-hot-toast").default;
const api = require("../../../../core/api/rbacAdminApi");
const RbacRoleBuilder = require("../RbacRoleBuilder").default;
const { slug } = require("../RbacRoleBuilder");

const ROLES = [
  { id: 1, key: "comercial", label: "comercial", is_system: true, permissions: 3, users: 2 },
  { id: 9, key: "custom_ventas", label: "Ventas", is_system: false, permissions: 1, users: 0 },
];
const PERMISSIONS = [
  { key: "clients.root.read", resource: "clients/root" },
  { key: "clients.root.create", resource: "clients/root" },
  { key: "viaticos.root.read", resource: "viaticos/root" },
  { key: "rbac.manage", resource: "rbac" },
];

beforeEach(() => {
  jest.clearAllMocks();
  api.getRbacRoles.mockResolvedValue(ROLES);
  api.getRbacPermissions.mockResolvedValue(PERMISSIONS);
  api.getRbacRole.mockImplementation(async (id) => (id === 9
    ? { id: 9, key: "custom_ventas", label: "Ventas", is_system: false, permissions: ["clients.root.read"], users: 0 }
    : { id: 1, key: "comercial", label: "comercial", is_system: true, permissions: ["clients.root.read", "clients.root.create", "rbac.manage"], users: 2 }));
});

const open = async () => { render(<RbacRoleBuilder />); await screen.findByRole("table", { name: "Roles del catálogo" }); };

describe("constructor de roles", () => {
  it("convierte el nombre en un nombre tecnico seguro", () => {
    expect(slug("  Ventas Región Sur! ")).toBe("ventas_region_sur");
  });

  it("lista roles de sistema y personalizados con acciones distintas", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Ver permisos de comercial" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicar comercial" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar comercial" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar Ventas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archivar Ventas" })).toBeTruthy();
  });

  it("estado de error recuperable al cargar", async () => {
    api.getRbacRoles.mockRejectedValueOnce(new Error("fallo"));
    render(<RbacRoleBuilder />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/No se pudieron cargar los roles/);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("table", { name: "Roles del catálogo" })).toBeTruthy();
  });

  it("nunca ofrece los permisos de administracion del RBAC", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo rol" }));
    expect(await screen.findByLabelText("clients.root.read")).toBeTruthy();
    expect(screen.queryByLabelText("rbac.manage")).toBeNull();
  });

  it("valida nombre, permisos y motivo antes de enviar", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo rol" }));
    fireEvent.change(await screen.findByLabelText("Nombre del rol"), { target: { value: "Ventas Norte" } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "rol de ventas del norte" } });
    fireEvent.submit(screen.getByRole("form", { name: "Nuevo rol" }));
    expect(toast.error).toHaveBeenCalledWith("Elige al menos un permiso.");
    expect(api.createRbacRole).not.toHaveBeenCalled();
  });

  it("crea el rol con prefijo, permisos elegidos y por grupo, y bloquea el doble envio", async () => {
    let release;
    api.createRbacRole.mockImplementation(() => new Promise((resolve) => { release = () => resolve({}); }));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo rol" }));
    fireEvent.change(await screen.findByLabelText("Nombre del rol"), { target: { value: "Ventas Norte" } });
    expect(screen.getByText("custom_ventas_norte")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Todo clients"));
    fireEvent.click(screen.getByLabelText("viaticos.root.read"));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "rol de ventas del norte" } });
    const form = screen.getByRole("form", { name: "Nuevo rol" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.createRbacRole).toHaveBeenCalledTimes(1);
    expect(api.createRbacRole).toHaveBeenCalledWith({
      label: "Ventas Norte",
      key: "custom_ventas_norte",
      permissions: expect.arrayContaining(["clients.root.read", "clients.root.create", "viaticos.root.read"]),
      reason: "rol de ventas del norte",
    });
    release();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rol creado."));
  });

  it("un rol de sistema se abre en solo lectura, sin boton de guardar", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Ver permisos de comercial" }));
    expect(await screen.findByText(/solo lectura/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(screen.getByLabelText("clients.root.read").disabled).toBe(true);
    // los permisos de administracion del RBAC del rol de sistema tampoco se muestran
    expect(screen.queryByLabelText("rbac.manage")).toBeNull();
  });

  it("duplicar precarga los permisos del rol de sistema como un rol nuevo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Duplicar comercial" }));
    expect(await screen.findByRole("heading", { name: "Nuevo rol" })).toBeTruthy();
    expect(screen.getByLabelText("Nombre del rol").value).toBe("comercial (copia)");
    expect(screen.getByLabelText("clients.root.create").checked).toBe(true);
    expect(screen.getByLabelText("viaticos.root.read").checked).toBe(false);
  });

  it("archivar pide motivo y muestra el error del servidor (rol en uso)", async () => {
    jest.spyOn(window, "prompt").mockReturnValue("ya no se usa");
    api.archiveRbacRole.mockRejectedValue({ response: { data: { message: "El rol lo tienen 2 usuario(s). Retiraselo primero." } } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Archivar Ventas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El rol lo tienen 2 usuario(s). Retiraselo primero."));
    expect(api.archiveRbacRole).toHaveBeenCalledWith(9, "ya no se usa");
  });

  it("archivar sin motivo no llama al servidor", async () => {
    jest.spyOn(window, "prompt").mockReturnValue("  ");
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Archivar Ventas" }));
    expect(api.archiveRbacRole).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("editar un rol personalizado envia solo los cambios con su motivo", async () => {
    api.updateRbacRole.mockResolvedValue({});
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Editar Ventas" }));
    await screen.findByRole("heading", { name: "Editar Ventas" });
    const form = screen.getByRole("form", { name: "Editar Ventas" });
    fireEvent.click(within(form).getByLabelText("clients.root.create"));
    fireEvent.change(within(form).getByLabelText(/Motivo/), { target: { value: "suma crear clientes" } });
    fireEvent.submit(form);
    await waitFor(() => expect(api.updateRbacRole).toHaveBeenCalledWith(9, {
      label: "Ventas", permissions: expect.arrayContaining(["clients.root.read", "clients.root.create"]), reason: "suma crear clientes",
    }));
  });
});
