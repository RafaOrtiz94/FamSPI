const { classifyPgError } = require("../dashboard.service");

describe("dashboard – classifyPgError", () => {
  it("clasifica error sin codigo como DB_ERROR generico", () => {
    expect(classifyPgError(null)).toMatchObject({ type: "DB_ERROR", statusCode: 503 });
    expect(classifyPgError({})).toMatchObject({ type: "DB_ERROR" });
  });
  it("clasifica tabla inexistente (42P01) como SCHEMA_MISSING", () => {
    const out = classifyPgError({ code: "42P01", table: "foo" });
    expect(out).toMatchObject({ type: "SCHEMA_MISSING", statusCode: 500 });
    expect(out.message).toContain("foo");
  });
  it("clasifica columna inexistente (42703) como SCHEMA_MISSING", () => {
    const out = classifyPgError({ code: "42703", column: "bar" });
    expect(out).toMatchObject({ type: "SCHEMA_MISSING" });
    expect(out.message).toContain("bar");
  });
  it("clasifica otros codigos de error como DB_ERROR de conexion", () => {
    const out = classifyPgError({ code: "ECONNRESET", message: "conn lost" });
    expect(out).toMatchObject({ type: "DB_ERROR", statusCode: 503 });
  });
});
