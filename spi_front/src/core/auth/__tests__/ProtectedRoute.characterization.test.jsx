// Caracterizacion del control de acceso del frontend (plan RBAC, Fase 1B).
// Congela el comportamiento ACTUAL de ProtectedRoute y RoleRedirect. Si una de estas pruebas
// cambia, cambio lo que cada rol puede abrir en pantalla y debe ser una decision explicita.
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute, RoleRedirect } from "../ProtectedRoute";
import { useAuth } from "../AuthContext";
import { isPathEnabledForUser, isModuleUnderConstruction, getModuleStatusForPath } from "../moduleAccess";

let mockPathname = "/dashboard/comercial";

// react-router-dom 7 solo publica ESM y el Jest de CRA no lo resuelve: se simula como modulo virtual.
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
  Outlet: () => <div data-testid="outlet">contenido</div>,
  useLocation: () => ({ pathname: mockPathname, search: "" }),
}), { virtual: true });
jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../ui/UIContext", () => ({ useUI: () => ({ showToast: jest.fn() }) }));
jest.mock("../moduleAccess", () => ({
  isPathEnabledForUser: jest.fn(() => true),
  isModuleUnderConstruction: jest.fn(() => false),
  getModuleStatusForPath: jest.fn(() => ({ stage: "construction" })),
}));
jest.mock("../../ui/components/UnderConstructionPage", () => () => <div data-testid="en-construccion" />);

const user = (overrides = {}) => ({ role: "comercial", lopdp_internal_status: "granted", ...overrides });

function outcome({ auth, allowedRoles = [], strictRoles = false, pathname = "/dashboard/comercial" }) {
  mockPathname = pathname;
  useAuth.mockReturnValue({ loading: false, isAuthenticated: true, ...auth });
  const { unmount } = render(<ProtectedRoute allowedRoles={allowedRoles} strictRoles={strictRoles} />);
  const result = screen.queryByTestId("outlet")
    ? "permitido"
    : screen.queryByTestId("en-construccion")
      ? "en-construccion"
      : screen.queryByTestId("navigate")?.textContent || "otro";
  unmount();
  return result;
}

beforeEach(() => {
  isPathEnabledForUser.mockReturnValue(true);
  isModuleUnderConstruction.mockReturnValue(false);
  // CRA reinicia los mocks antes de cada prueba (resetMocks), por eso se reponen aqui.
  getModuleStatusForPath.mockReturnValue({ stage: "construction" });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  sessionStorage.clear();
});
afterEach(() => console.warn.mockRestore());

describe("ProtectedRoute: sesion", () => {
  test("mientras carga muestra la verificacion y no decide", () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false, user: null });
    render(<ProtectedRoute allowedRoles={["comercial"]} />);
    expect(screen.getByText("Verificando sesión...")).toBeTruthy();
  });

  test("sin sesion redirige a /login y recuerda a donde iba", () => {
    expect(outcome({ auth: { isAuthenticated: false, user: null }, pathname: "/dashboard/ti" })).toBe("/login");
    expect(sessionStorage.getItem("redirectTo")).toBe("/dashboard/ti");
  });

  test("rol pendiente, vacio o con texto pending va a /registro-en-proceso", () => {
    ["pending", "pendiente", "", "usuario_pendiente"].forEach((role) => {
      expect(outcome({ auth: { user: user({ role }) } })).toBe("/registro-en-proceso");
    });
  });

  test("el texto 'null' como rol NO se trata como pendiente: cae en no autorizado", () => {
    expect(outcome({ auth: { user: user({ role: "null" }) }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
  });

  test("must_change_password obliga a /cambiar-password antes de cualquier otra pantalla", () => {
    expect(outcome({ auth: { user: user({ role: "pasante", must_change_password: true }) } })).toBe("/cambiar-password");
  });

  test("LOPDP pendiente no bloquea la navegacion", () => {
    expect(outcome({ auth: { user: user({ lopdp_internal_status: "pending" }) }, allowedRoles: ["comercial"] })).toBe("permitido");
  });
});

describe("ProtectedRoute: decision por rol", () => {
  test("lista vacia permite a cualquier usuario autenticado", () => {
    expect(outcome({ auth: { user: user({ role: "logistica" }) } })).toBe("permitido");
  });

  test("rol en la lista pasa; fuera de la lista va a /unauthorized", () => {
    expect(outcome({ auth: { user: user() }, allowedRoles: ["comercial"] })).toBe("permitido");
    expect(outcome({ auth: { user: user({ role: "logistica" }) }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
  });

  test("la comparacion es exacta: NO expande grupos como hace el backend", () => {
    // En el backend requireRole(['comercial']) deja pasar a jefe_comercial; aqui no.
    expect(outcome({ auth: { user: user({ role: "jefe_comercial" }) }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
  });

  test("ignora mayusculas y acepta el rol tambien por scope y por extra_roles", () => {
    expect(outcome({ auth: { user: user({ role: "Comercial" }) }, allowedRoles: ["COMERCIAL"] })).toBe("permitido");
    expect(outcome({ auth: { user: user({ role: "asesor", scope: "comercial" }) }, allowedRoles: ["comercial"] })).toBe("permitido");
    expect(outcome({ auth: { user: user({ role: "financiero", extra_roles: ["backoffice_comercial"] }) }, allowedRoles: ["backoffice_comercial"] })).toBe("permitido");
  });

  test("gerencia y pasante pasan rutas no estrictas aunque no esten en la lista", () => {
    expect(outcome({ auth: { user: user({ role: "gerencia" }) }, allowedRoles: ["comercial"] })).toBe("permitido");
    expect(outcome({ auth: { user: user({ role: "pasante" }) }, allowedRoles: ["comercial"] })).toBe("permitido");
  });

  test("gerencia_general NO tiene ese pase: solo el valor exacto 'gerencia' (por rol o por scope)", () => {
    expect(outcome({ auth: { user: user({ role: "gerencia_general" }) }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
    expect(outcome({ auth: { user: user({ role: "gerencia_general", scope: "gerencia" }) }, allowedRoles: ["comercial"] })).toBe("permitido");
  });

  test("con strictRoles ni gerencia ni pasante pasan sin estar en la lista", () => {
    expect(outcome({ auth: { user: user({ role: "gerencia" }) }, allowedRoles: ["comercial"], strictRoles: true })).toBe("/unauthorized");
    expect(outcome({ auth: { user: user({ role: "pasante" }) }, allowedRoles: ["comercial"], strictRoles: true })).toBe("/unauthorized");
  });

  test("admin no es superrol en el frontend (en el backend si)", () => {
    expect(outcome({ auth: { user: user({ role: "admin" }) }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
  });
});

describe("ProtectedRoute: modulo", () => {
  test("modulo deshabilitado para el usuario va a /unauthorized aunque el rol pase", () => {
    isPathEnabledForUser.mockReturnValue(false);
    expect(outcome({ auth: { user: user() }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
  });

  test("modulo en construccion muestra su pagina; el rol se evalua antes", () => {
    isModuleUnderConstruction.mockReturnValue(true);
    expect(outcome({ auth: { user: user() }, allowedRoles: ["comercial"] })).toBe("en-construccion");
    expect(outcome({ auth: { user: user({ role: "logistica" }) }, allowedRoles: ["comercial"] })).toBe("/unauthorized");
  });
});

describe("RoleRedirect: panel de inicio por rol", () => {
  const target = (userValue) => {
    useAuth.mockReturnValue({ loading: false, user: userValue });
    const { unmount } = render(<RoleRedirect />);
    const to = screen.getByTestId("navigate").textContent;
    unmount();
    return to;
  };

  test("cada rol real cae en su panel", () => {
    expect({
      acp_comercial: target({ role: "acp_comercial" }),
      comercial: target({ role: "comercial" }),
      financiero: target({ role: "financiero" }),
      gerencia_general: target({ role: "gerencia_general" }),
      ing_servicio: target({ role: "ing_servicio" }),
      ing_servicio_ext: target({ role: "ing_servicio_ext" }),
      jefe_calidad: target({ role: "jefe_calidad" }),
      jefe_comercial: target({ role: "jefe_comercial" }),
      jefe_financiero: target({ role: "jefe_financiero" }),
      jefe_logistica: target({ role: "jefe_logistica" }),
      jefe_operaciones: target({ role: "jefe_operaciones" }),
      jefe_servicio: target({ role: "jefe_servicio" }),
      jefe_ti: target({ role: "jefe_ti" }),
      logistica: target({ role: "logistica" }),
      operaciones: target({ role: "operaciones" }),
      pasante: target({ role: "pasante" }),
      talento_humano: target({ role: "talento_humano" }),
    }).toMatchSnapshot();
  });

  test("sin usuario va a /login; rol pendiente a /registro-en-proceso; rol desconocido a /unauthorized", () => {
    expect(target(null)).toBe("/login");
    expect(target({ role: "pending" })).toBe("/registro-en-proceso");
    expect(target({ role: "null" })).toBe("/unauthorized");
    expect(target({ role: "rol_que_no_existe" })).toBe("/unauthorized");
  });
});
