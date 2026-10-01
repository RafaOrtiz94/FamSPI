jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { sanitizeMetadata, toDriveViewUrl } = require("../userProfile.service");

describe("user-profile – sanitizeMetadata", () => {
  it("elimina claves bloqueadas (email, fullname, etc.)", () => {
    const out = sanitizeMetadata({ email: "a@b.com", nickname: "Ana" });
    expect(out).not.toHaveProperty("email");
    expect(out.nickname).toBe("Ana");
  });
  it("trunca strings a 500 caracteres y descarta undefined", () => {
    const out = sanitizeMetadata({ bio: "x".repeat(600), skip: undefined });
    expect(out.bio.length).toBe(500);
    expect(out).not.toHaveProperty("skip");
  });
  it("devuelve {} si metadata no es un objeto", () => {
    expect(sanitizeMetadata(null)).toEqual({});
    expect(sanitizeMetadata("texto")).toEqual({});
  });
});

describe("user-profile – toDriveViewUrl", () => {
  it("construye la URL de thumbnail cuando hay driveId", () => {
    expect(toDriveViewUrl("FILE1")).toBe("https://drive.google.com/thumbnail?id=FILE1&sz=w300");
  });
  it("devuelve null sin driveId", () => {
    expect(toDriveViewUrl(null)).toBeNull();
  });
});
