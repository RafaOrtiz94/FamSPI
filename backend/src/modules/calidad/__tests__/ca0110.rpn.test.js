// Verificacion del calculo de RPN (FMEA) del modulo de calidad (CA0110).
// NOTA: modulo en desarrollo activo; validacion provisional.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

const { calculateRPN } = require("../ca0110.service");

describe("calidad CA0110 – calculateRPN", () => {
  it("multiplica severidad x ocurrencia x deteccion", () => {
    expect(calculateRPN(2, 3, 4)).toBe(24);
    expect(calculateRPN(1, 1, 1)).toBe(1);
    expect(calculateRPN(5, 5, 5)).toBe(125);
  });
});
