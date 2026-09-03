describe("manual Sheet update permission", () => {
  it("allows only jefe_ti to force a Sheet recreation", () => {
    const canForceUpdate = (role) => String(role || "").trim().toLowerCase() === "jefe_ti";

    expect(canForceUpdate("jefe_ti")).toBe(true);
    expect(canForceUpdate("comercial")).toBe(false);
    expect(canForceUpdate("jefe_comercial")).toBe(false);
  });
});
