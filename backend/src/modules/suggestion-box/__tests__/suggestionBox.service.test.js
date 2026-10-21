jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));

const db = require("../../../config/db");
const service = require("../suggestionBox.service");

const fakeClient = (insertedRow) => ({
  query: jest.fn((sql) => {
    if (String(sql).startsWith("INSERT INTO public.suggestion_box_submissions")) {
      return Promise.resolve({ rows: [insertedRow] });
    }
    return Promise.resolve({ rows: [] });
  }),
  release: jest.fn(),
});

const user = { id: 9, fullname: "Ana Perez", email: "ana@fam-project.com" };

beforeEach(() => jest.clearAllMocks());

describe("anonimato: solo el canal interno puede pedirlo", () => {
  test("externo con is_anonymous=true se rechaza", async () => {
    await expect(
      service.createSubmission(
        { submission_type: "suggestion", subject: "x", message: "y", is_anonymous: true, reporter_name: "N", reporter_email: "n@x.com" },
        { source: "external" },
      ),
    ).rejects.toThrow(/anonimo no esta disponible en el canal externo/);
  });

  test("interno con is_anonymous=true no guarda nombre ni correo, pero si el reporter_user_id (constraint de BD)", async () => {
    const client = fakeClient({ id: "s1", reference_code: "BQ-1", submission_type: "suggestion", status: "received", created_at: "now" });
    db.getClient.mockResolvedValue(client);

    await service.createSubmission(
      { submission_type: "suggestion", subject: "x", message: "y", is_anonymous: true },
      { source: "internal", user },
    );

    const insertCall = client.query.mock.calls.find(([sql]) => String(sql).startsWith("INSERT INTO public.suggestion_box_submissions"));
    const [, params] = insertCall;
    // [reference, type, source, is_anonymous, reporterName, reporterEmail, reporterPhone, reporter_user_id, subject, message]
    expect(params[3]).toBe(true);
    expect(params[4]).toBeNull();
    expect(params[5]).toBeNull();
    expect(params[7]).toBe(9);
  });

  test("interno sin pedir anonimato guarda su propio nombre y correo", async () => {
    const client = fakeClient({ id: "s2", reference_code: "BQ-2", submission_type: "complaint", status: "received", created_at: "now" });
    db.getClient.mockResolvedValue(client);

    await service.createSubmission({ submission_type: "complaint", subject: "x", message: "y" }, { source: "internal", user });

    const [, params] = client.query.mock.calls.find(([sql]) => String(sql).startsWith("INSERT INTO public.suggestion_box_submissions"));
    expect(params[3]).toBe(false);
    expect(params[4]).toBe("Ana Perez");
    expect(params[5]).toBe("ana@fam-project.com");
  });
});

describe("listSubmissions/getSubmission ocultan reporter_user_id en registros anonimos", () => {
  test("listSubmissions filtra por source y limpia reporter_user_id cuando is_anonymous", async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: "a", is_anonymous: true, reporter_user_id: 9, source: "internal" },
        { id: "b", is_anonymous: false, reporter_user_id: 3, source: "internal" },
      ],
    });

    const rows = await service.listSubmissions({ source: "internal" });

    expect(db.query.mock.calls[0][0]).toContain("s.source = $1");
    expect(rows[0].reporter_user_id).toBeUndefined();
    expect(rows[1].reporter_user_id).toBe(3);
  });

  test("getSubmission limpia reporter_user_id cuando is_anonymous", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: "a", is_anonymous: true, reporter_user_id: 9 }] })
      .mockResolvedValueOnce({ rows: [] });

    const row = await service.getSubmission("a");
    expect(row.reporter_user_id).toBeUndefined();
  });

  test("un source invalido se rechaza", async () => {
    await expect(service.listSubmissions({ source: "otro" })).rejects.toThrow(/Origen no permitido/);
  });
});
