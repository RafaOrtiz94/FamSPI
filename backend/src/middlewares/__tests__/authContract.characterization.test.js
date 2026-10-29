// Contrato HTTP de autenticacion y autorizacion legacy (plan RBAC, Fase 1B).
// Monta los middlewares reales (verifyToken + requireRole) sobre una app Express minima y congela
// codigos de estado y forma de la respuesta. El motor central no puede cambiar estos contratos.
jest.mock("../../modules/attendance/attendanceShortcutTokens.repository", () => ({
  isTokenRevoked: jest.fn(async () => false),
}));
jest.mock("../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { verifyToken } = require("../auth");
const { requireRole } = require("../roles");
const { isTokenRevoked } = require("../../modules/attendance/attendanceShortcutTokens.repository");

const SECRET = "clave-de-prueba-solo-para-jest";
const CLAIMS = { iss: "spi-fam-backend", aud: "spi-fam-frontend" };
const sign = (payload, { secret = SECRET, ...options } = {}) =>
  jwt.sign({ ...CLAIMS, sub: String(payload.id ?? 1), ...payload }, secret, { expiresIn: "5m", ...options });

function buildApp() {
  const app = express();
  app.get("/solo-autenticado", verifyToken, (req, res) => res.json({ ok: true, role: req.user.role }));
  app.get("/solo-ti", verifyToken, requireRole(["ti"]), (req, res) => res.json({ ok: true }));
  return app;
}

describe("contrato HTTP de verifyToken y requireRole", () => {
  let app;
  beforeAll(() => {
    process.env.SECRET_KEY = SECRET;
    app = buildApp();
  });

  test("sin token: 401 NO_TOKEN", async () => {
    const res = await request(app).get("/solo-autenticado");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, code: "NO_TOKEN", message: "Token ausente" });
  });

  test("token firmado con otra llave: 401 INVALID_TOKEN", async () => {
    const res = await request(app).get("/solo-autenticado").set("Authorization", `Bearer ${sign({ id: 1, role: "comercial" }, { secret: "otra-llave" })}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, code: "INVALID_TOKEN", message: "Token invalido o expirado" });
  });

  test("token expirado: 401 INVALID_TOKEN", async () => {
    const res = await request(app).get("/solo-autenticado").set("Authorization", `Bearer ${sign({ id: 1, role: "comercial" }, { expiresIn: "-1s" })}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  test("emisor o audiencia ajenos: 403 INVALID_CLAIMS", async () => {
    const res = await request(app).get("/solo-autenticado").set("Authorization", `Bearer ${sign({ id: 1, role: "comercial", iss: "otro-sistema" })}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, code: "INVALID_CLAIMS", message: "Token no valido para esta aplicacion" });
  });

  test("token valido: 200 y req.user lleva los claims", async () => {
    const res = await request(app).get("/solo-autenticado").set("Authorization", `Bearer ${sign({ id: 7, role: "comercial" })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, role: "comercial" });
  });

  test("acepta el token tambien en x-access-token y sin prefijo Bearer", async () => {
    const token = sign({ id: 7, role: "comercial" });
    expect((await request(app).get("/solo-autenticado").set("x-access-token", token)).status).toBe(200);
    expect((await request(app).get("/solo-autenticado").set("Authorization", token)).status).toBe(200);
  });

  test("token de atajo revocado: 401 TOKEN_REVOKED", async () => {
    isTokenRevoked.mockResolvedValueOnce(true);
    const res = await request(app).get("/solo-autenticado").set("Authorization", `Bearer ${sign({ id: 7, role: "comercial", token_kind: "shortcut", jti: "abc" })}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_REVOKED");
  });

  test("rol sin permiso: 403 con { ok: false, error }", async () => {
    const res = await request(app).get("/solo-ti").set("Authorization", `Bearer ${sign({ id: 7, role: "comercial" })}`);
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/^Acceso denegado\. Roles permitidos: /);
  });

  test("rol del grupo, superrol y extra_roles: 200", async () => {
    const call = (payload) => request(app).get("/solo-ti").set("Authorization", `Bearer ${sign(payload)}`);
    expect((await call({ id: 1, role: "jefe_ti" })).status).toBe(200);
    expect((await call({ id: 2, role: "admin" })).status).toBe(200);
    expect((await call({ id: 3, role: "comercial", extra_roles: ["soporte"] })).status).toBe(200);
  });
});
