const crypto = require("crypto");
const {
  DEFAULT_MAPPING_VERSION,
  validateGenerationRequest,
  stableStringify,
  buildSignedWebAppPayload,
} = require("../businessCaseSheetGeneration.contract");

describe("businessCaseSheetGeneration.contract", () => {
  it("validates generation payload and sets defaults", () => {
    const result = validateGenerationRequest({
      fields: { client_name: "Cliente Demo" },
      inversiones: {
        Servidor: {
          cantidad: 1,
          precio: 3200,
          precio_operativo: 3000,
          precio_financiero: 3200,
          descripcion: "Servidor en rack",
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value.mapping_version).toBe(DEFAULT_MAPPING_VERSION);
    expect(result.value.inversiones.Servidor.cantidad).toBe(1);
    expect(result.value.inversiones.Servidor.precio_financiero).toBe(3200);
    expect(result.value.inversiones.Servidor.precio_operativo).toBe(3000);
    expect(result.value.inversiones.Servidor.descripcion).toBe("Servidor en rack");
  });

  it("rejects invalid inversiones payload", () => {
    const result = validateGenerationRequest({
      fields: { client_name: "Cliente Demo" },
      inversiones: { Servidor: { cantidad: -1, precio: 3200 } },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("cantidad");
  });

  it("builds deterministic signatures with stable stringify", () => {
    const payloadA = {
      request_id: "ba44b8af-629e-4495-8db5-d6708920f85e",
      idempotency_key: "abc",
      mapping_version: "BC_MAPPING_v2026_01_15",
      timestamp: "2026-03-02T12:00:00.000Z",
      auth_token: "token-1",
      output_folder_id: "1abcFolder",
      fields: { b: 2, a: 1 },
      inversiones: { Servidor: { precio: 100, cantidad: 2 } },
    };
    const payloadB = {
      inversiones: { Servidor: { cantidad: 2, precio: 100 } },
      fields: { a: 1, b: 2 },
      auth_token: "token-1",
      output_folder_id: "1abcFolder",
      mapping_version: "BC_MAPPING_v2026_01_15",
      timestamp: "2026-03-02T12:00:00.000Z",
      idempotency_key: "abc",
      request_id: "ba44b8af-629e-4495-8db5-d6708920f85e",
    };

    const canonicalA = stableStringify(payloadA);
    const canonicalB = stableStringify(payloadB);
    expect(canonicalA).toBe(canonicalB);

    const secret = "test-secret";
    const signed = buildSignedWebAppPayload(payloadA, secret);
    const expected = crypto
      .createHmac("sha256", secret)
      .update(
        stableStringify({
          request_id: payloadA.request_id,
          idempotency_key: payloadA.idempotency_key,
          mapping_version: payloadA.mapping_version,
          timestamp: payloadA.timestamp,
          auth_token: payloadA.auth_token,
          output_folder_id: payloadA.output_folder_id,
          fields: payloadA.fields,
          inversiones: payloadA.inversiones,
          max_quantities: [],
          equipment_tabs: [],
          sheet_context: {},
        }),
        "utf8",
      )
      .digest("hex");

    expect(signed.signature).toBe(expected);
    expect(signed.auth_token).toBe("token-1");
    expect(signed.output_folder_id).toBe("1abcFolder");
  });
});
