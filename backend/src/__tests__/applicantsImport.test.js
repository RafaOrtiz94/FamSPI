const express = require("express");

jest.mock("../modules/applicants/applicants.service", () => ({
  importApplicant: jest.fn(),
}));

const service = require("../modules/applicants/applicants.service");
const applicantsRoutes = require("../modules/applicants/applicants.routes");

const buildApp = () => {
  const app = express();
  app.use("/api/applicants", applicantsRoutes);
  app.use((err, _req, res, _next) => {
    if (err && err.status === 413) {
      return res.status(413).json({ ok: false, message: "Payload too large" });
    }
    return res.status(err.status || 500).json({ ok: false, message: err.message || "Error" });
  });
  return app;
};

const startServer = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });

describe("POST /api/applicants/import", () => {
  beforeAll(() => {
    process.env.APPLICANTS_API_KEY = "test-key";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("payload valido -> 200", async () => {
    service.importApplicant.mockResolvedValue({ user_id: 1, email: "a@b.com" });
    const app = buildApp();
    const { server, port } = await startServer(app);

    const res = await fetch(`http://127.0.0.1:${port}/api/applicants/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify({ email: "a@b.com", nombres: "Ana", apellidos: "Perez" }),
    });

    const body = await res.json();
    server.close();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("sin email -> 400", async () => {
    const err = new Error("Email es obligatorio");
    err.status = 400;
    service.importApplicant.mockRejectedValue(err);

    const app = buildApp();
    const { server, port } = await startServer(app);

    const res = await fetch(`http://127.0.0.1:${port}/api/applicants/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify({ nombres: "Ana", apellidos: "Perez" }),
    });

    const body = await res.json();
    server.close();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  test("api key invalida -> 401", async () => {
    const app = buildApp();
    const { server, port } = await startServer(app);

    const res = await fetch(`http://127.0.0.1:${port}/api/applicants/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "wrong-key",
      },
      body: JSON.stringify({ email: "a@b.com", nombres: "Ana", apellidos: "Perez" }),
    });

    const body = await res.json();
    server.close();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
  });

  test("payload gigante -> 413", async () => {
    service.importApplicant.mockResolvedValue({ user_id: 1, email: "a@b.com" });
    const app = buildApp();
    const { server, port } = await startServer(app);

    const bigPayload = {
      email: "a@b.com",
      nombres: "Ana",
      apellidos: "Perez",
      data: "x".repeat(6 * 1024 * 1024),
    };

    const res = await fetch(`http://127.0.0.1:${port}/api/applicants/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify(bigPayload),
    });

    const body = await res.json();
    server.close();

    expect(res.status).toBe(413);
    expect(body.ok).toBe(false);
  });
});
