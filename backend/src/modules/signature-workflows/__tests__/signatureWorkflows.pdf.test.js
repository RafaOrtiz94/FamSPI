const { isSignerExcludedFromDocument } = require("../signatureWorkflows.pdf");

describe("signatureWorkflows.pdf correction filtering", () => {
  test("excludes a signer explicitly replaced by an audited correction", () => {
    expect(isSignerExcludedFromDocument({ status: "replaced", meta: {} })).toBe(true);
  });

  test("excludes a signer marked only through correction metadata", () => {
    expect(isSignerExcludedFromDocument({ status: "signed", meta: { exclude_from_document: true } })).toBe(true);
  });

  test("keeps ordinary signed and pending signers in the corrected document", () => {
    expect(isSignerExcludedFromDocument({ status: "signed", meta: {} })).toBe(false);
    expect(isSignerExcludedFromDocument({ status: "available", meta: {} })).toBe(false);
  });
});
