jest.mock("../../../config/db", () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));
jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));
jest.mock("../../../utils/audit", () => ({
  logAction: jest.fn(),
}));
jest.mock("../../../utils/mailer", () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../requests/requests.service", () => ({
  updateRequestStatus: jest.fn(),
}));
jest.mock("../../notifications/notificationManager", () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

const db = require("../../../config/db");
const approvalsService = require("../approvals.service");

function makeMockClient({ requestInfo, approver, assignedUser }) {
  const query = jest.fn(async (sql) => {
    if (sql.includes("FROM requests r")) return { rows: [requestInfo] };
    if (sql.includes("SELECT email, fullname, name FROM users")) return { rows: [approver] };
    if (sql.includes("FROM public.users WHERE id = $1")) {
      return { rows: assignedUser ? [assignedUser] : [] };
    }
    return { rows: [] };
  });
  return { query, release: jest.fn() };
}

describe("approvals.service listPending", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies explicit approver visibility while preserving legacy unassigned requests", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 14,
          status: "pendiente",
          created_at: "2026-03-18T10:00:00.000Z",
          requester_name: "Ada Lovelace",
          type_code: "F.ST-20",
          type_title: "Legacy title",
          total_count: "1",
        },
      ],
    });

    const result = await approvalsService.listPending(2, 5, {
      id: 77,
      role: "jefe_tecnico",
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain("pa.approver_id = $2");
    expect(db.query.mock.calls[0][0]).toContain("OR NOT EXISTS");
    expect(db.query.mock.calls[0][1]).toEqual([
      ["approved", "aprobado", "rechazado", "rejected", "cancelado", "cancelled"],
      77,
      5,
      5,
    ]);
    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: 14,
      requester_name: "Ada Lovelace",
      type_code: "F.ST-20",
    });
    expect(result.rows[0].type_title).toBe("Solicitud de inspección de ambiente");
    expect(result.rows[0]).not.toHaveProperty("total_count");
  });
});

describe("approvals.service approve — coordinacion F.ST-20", () => {
  const requestInfo = {
    id: 55,
    requester_id: 9,
    payload: { nombre_cliente: "Cliente Demo", fecha_instalacion: "2026-09-01", fecha_tope_instalacion: "2026-09-10" },
    requester_email: "solicitante@fam.test",
    requester_name: "Solicitante Demo",
    request_title: "Inspección de ambiente",
    request_code: "F.ST-20",
  };
  const approver = { email: "jefe@fam.test", fullname: "Jefe Servicio", name: "Jefe Servicio" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza asignar a un usuario sin rol de servicio (ej. comercial)", async () => {
    const client = makeMockClient({
      requestInfo,
      approver,
      assignedUser: { id: 3, email: "vendedor@fam.test", role: "comercial", display_name: "Vendedor" },
    });
    db.getClient.mockResolvedValue(client);

    await expect(
      approvalsService.approve(55, 1, { assigned_user_id: 3, inspection_date: "2026-09-05", notes: "" })
    ).rejects.toThrow(/ingeniero de servicio, especialista de aplicaciones o jefe de servicio/);

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it.each(["ing_servicio", "esp_app", "jefe_servicio", "jefe_tecnico"])(
    "acepta asignar a un usuario con rol %s",
    async (role) => {
      const client = makeMockClient({
        requestInfo,
        approver,
        assignedUser: { id: 4, email: "tecnico@fam.test", role, display_name: "Técnico Demo" },
      });
      db.getClient.mockResolvedValue(client);

      const result = await approvalsService.approve(55, 1, {
        assigned_user_id: 4,
        inspection_date: "2026-09-05",
        notes: "",
      });

      expect(result).toEqual({ status: "approved", request_id: 55 });
      expect(client.query).toHaveBeenCalledWith("COMMIT");
      const insertCall = client.query.mock.calls.find(([sql]) =>
        sql.includes("INSERT INTO servicio.cronograma_actividades_tecnicas")
      );
      expect(insertCall).toBeDefined();
    }
  );

  it("exige tecnico y fecha para F.ST-20", async () => {
    const client = makeMockClient({ requestInfo, approver, assignedUser: null });
    db.getClient.mockResolvedValue(client);

    await expect(approvalsService.approve(55, 1, {})).rejects.toThrow(
      /Debes asignar un técnico y una fecha/
    );
  });
});
