process.env.SECRET_KEY = process.env.SECRET_KEY || "test-secret";

jest.mock("../../config/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock("../../modules/attendance/attendanceShortcutTokens.repository", () => ({
  isTokenRevoked: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const { verifyToken } = require("../auth");
const { isTokenRevoked } = require("../../modules/attendance/attendanceShortcutTokens.repository");

const signShortcutToken = (extra = {}) =>
  jwt.sign(
    { sub: "7", id: 7, iss: "spi-fam-backend", aud: "spi-fam-frontend", token_kind: "shortcut", jti: "abc-123", ...extra },
    process.env.SECRET_KEY
  );

const buildRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

beforeEach(() => jest.clearAllMocks());

test("token de shortcut revocado es rechazado con 401", async () => {
  isTokenRevoked.mockResolvedValue(true);
  const req = { headers: { authorization: `Bearer ${signShortcutToken()}` }, socket: {} };
  const res = buildRes();
  const next = jest.fn();

  await verifyToken(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(401);
  expect(res.body.code).toBe("TOKEN_REVOKED");
});

test("token de shortcut no revocado continua normalmente", async () => {
  isTokenRevoked.mockResolvedValue(false);
  const req = { headers: { authorization: `Bearer ${signShortcutToken()}` }, socket: {} };
  const res = buildRes();
  const next = jest.fn();

  await verifyToken(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.user.id).toBe(7);
});

test("token normal (sin token_kind) no consulta revocacion", async () => {
  const token = jwt.sign(
    { sub: "7", id: 7, iss: "spi-fam-backend", aud: "spi-fam-frontend" },
    process.env.SECRET_KEY
  );
  const req = { headers: { authorization: `Bearer ${token}` }, socket: {} };
  const res = buildRes();
  const next = jest.fn();

  await verifyToken(req, res, next);

  expect(isTokenRevoked).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
});
