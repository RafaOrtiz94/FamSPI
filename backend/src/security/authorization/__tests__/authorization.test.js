const {
  hasPermission,
  isKnownPermission,
  listPermissionsForUser,
} = require("../authorization");

describe("authorization core", () => {
  it("reconoce permisos registrados y rechaza permisos desconocidos", () => {
    expect(isKnownPermission("module_access.manage")).toBe(true);
    expect(isKnownPermission("module_access.unknown")).toBe(false);
  });

  it("aplica aliases y roles de administrador", () => {
    expect(hasPermission({ role: "jefe_de_ti" }, "module_access.manage")).toBe(true);
    expect(hasPermission({ role: "administrador" }, "module_access.manage")).toBe(true);
    expect(hasPermission({ role: "comercial" }, "module_access.manage")).toBe(false);
  });

  it("incluye extra_roles como capacidad puntual", () => {
    expect(hasPermission({ role: "comercial", extra_roles: ["jefe_ti"] }, "module_access.manage")).toBe(true);
  });

  it("lista solo los permisos efectivos del usuario", () => {
    expect(listPermissionsForUser({ role: "comercial" })).toEqual([]);
    expect(listPermissionsForUser({ role: "jefe_ti" })).toEqual([
      "module_access.read",
      "module_access.manage",
    ]);
  });
});
