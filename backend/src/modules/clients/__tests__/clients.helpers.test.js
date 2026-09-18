jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { buildDriveLink } = require("../clients.service");

describe("clients – buildDriveLink", () => {
  it("construye el enlace de Drive con el id del archivo", () => {
    expect(buildDriveLink("FILE9")).toBe("https://drive.google.com/file/d/FILE9/view");
  });
});
