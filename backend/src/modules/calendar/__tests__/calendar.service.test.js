jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/google", () => ({ calendar: { events: { insert: jest.fn() } } }));

const db = require("../../../config/db");
const { getUserEmailsByRoles } = require("../calendar.service");

describe("calendar – getUserEmailsByRoles", () => {
  it("devuelve los emails de los usuarios que tienen alguno de los roles", async () => {
    db.query.mockResolvedValue({ rows: [{ email: "a@fam.com" }, { email: "b@fam.com" }] });
    const emails = await getUserEmailsByRoles(["gerencia", "operaciones"]);
    expect(emails).toEqual(["a@fam.com", "b@fam.com"]);
    expect(db.query.mock.calls[0][1]).toEqual([["gerencia", "operaciones"]]);
  });

  it("devuelve arreglo vacio si la consulta falla", async () => {
    db.query.mockRejectedValue(new Error("db down"));
    const emails = await getUserEmailsByRoles(["gerencia"]);
    expect(emails).toEqual([]);
  });
});
