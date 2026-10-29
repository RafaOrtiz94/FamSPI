jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/mailer", () => ({ sendMail: jest.fn().mockResolvedValue({ providerThreadId: "t1" }) }));
jest.mock("../../notifications/notifications.service", () => ({ createNotification: jest.fn().mockResolvedValue({}) }));

const db = require("../../../config/db");
const { sendMail } = require("../../../utils/mailer");
const { createNotification } = require("../../notifications/notifications.service");
const service = require("../bcAvailability.service");

const acp = { id: 9, role: "acp_comercial", email: "acp@x.com" };
const row = (over = {}) => ({ id: 1, requested_by: 5, status: "requested", equipment_name: "EQ", business_case_id: "bc", queries: [], ...over });

beforeEach(() => jest.clearAllMocks());

test("envía un correo por proveedor (sin duplicados) y pasa a in_progress", async () => {
  db.query.mockImplementation(async (sql) => {
    if (sql.includes("FROM public.bc_availability_requests r")) return { rows: [row()] };
    if (sql.includes("INSERT INTO public.bc_availability_supplier_queries")) return { rows: [{ id: 1 }] };
    return { rows: [] };
  });
  const { sent } = await service.sendToSuppliers({ id: 1, user: acp, providerEmails: "a@p.com, b@p.com A@p.com, mal" });
  expect(sendMail).toHaveBeenCalledTimes(2);
  expect(sent).toHaveLength(2);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'in_progress'"), [1]);
});

test("cerrar notifica al comercial solicitante", async () => {
  db.query.mockImplementation(async (sql) =>
    sql.includes("FROM public.bc_availability_requests r") ? { rows: [row({ status: "in_progress" })] } : { rows: [] },
  );
  await service.close({ id: 1, user: acp, status: "confirmed", notes: "ok" });
  expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ user_id: 5 }));
});

test("no permite cerrar dos veces ni ver solicitudes ajenas", async () => {
  db.query.mockResolvedValue({ rows: [row({ status: "confirmed" })] });
  await expect(service.close({ id: 1, user: acp, status: "rejected" })).rejects.toMatchObject({ code: "ALREADY_CLOSED" });
  await expect(service.getById(1, { id: 77, role: "comercial" })).rejects.toMatchObject({ status: 403 });
});
