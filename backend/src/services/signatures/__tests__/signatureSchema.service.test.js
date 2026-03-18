jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

const db = require("../../../config/db");
const {
  assertSignatureDependencies,
  getSignatureDependencyStatus,
} = require("../signatureSchema.service");

describe("signatureSchema.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports available signature dependencies", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ relation_name: "public.document_verification_info" }] });

    const status = await getSignatureDependencyStatus({ force: true });

    expect(status).toEqual({
      sealGenerator: true,
      qrTracker: true,
      verificationView: true,
    });
  });

  it("throws a controlled error when required dependencies are missing", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ relation_name: "public.document_verification_info" }] });

    await expect(
      assertSignatureDependencies(["sealGenerator"], { force: true })
    ).rejects.toMatchObject({
      status: 503,
      code: "SIGNATURE_SCHEMA_MISSING",
    });
  });
});
