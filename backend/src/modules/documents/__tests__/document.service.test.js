// Verificacion de los constructores de enlaces de Drive del modulo documents
// (acceso/recuperacion de documentos del expediente).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { driveViewLink, driveUcLink } = require("../document.service");

describe("document.service – enlaces de Drive", () => {
  it("construye el enlace de visualizacion con el id del archivo", () => {
    expect(driveViewLink("ABC123")).toBe("https://drive.google.com/file/d/ABC123/view");
  });

  it("construye el enlace de descarga directa con el id del archivo", () => {
    expect(driveUcLink("ABC123")).toBe("https://drive.google.com/uc?id=ABC123");
  });
});
