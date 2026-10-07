const {
  PROCEDURE_TYPES,
  SHARED_DOCUMENT_TYPES,
  buildRequirements,
} = require('../purchaseCompliance.rules');

const requiredCodes = (purchase) => buildRequirements(purchase)
  .filter((item) => item.required)
  .map((item) => item.code);

describe('public purchase compliance rules', () => {
  test('ínfima cuantía exige únicamente 3, 8, 9 y 20', () => {
    expect(requiredCodes({ procedure_type: PROCEDURE_TYPES.INFIMA_CUANTIA }))
      .toEqual(['3', '8', '9', '20']);
  });

  test('subasta inversa exige del numeral 2 al 20', () => {
    const codes = requiredCodes({
      procedure_type: PROCEDURE_TYPES.SUBASTA_INVERSA_ELECTRONICA,
      presupuesto_referencial: 80000,
    });
    expect(codes).toEqual(Array.from({ length: 19 }, (_, index) => String(index + 2)));
  });

  test('la póliza no aplica con presupuesto de hasta USD 70.000', () => {
    const items = buildRequirements({
      procedure_type: PROCEDURE_TYPES.SUBASTA_INVERSA_ELECTRONICA,
      presupuesto_referencial: 70000,
    });
    expect(items.find((item) => item.code === '7')).toMatchObject({ required: false, condition_pending: false });
  });

  test('la póliza queda condicionada si todavía no existe presupuesto', () => {
    const items = buildRequirements({ procedure_type: PROCEDURE_TYPES.SUBASTA_INVERSA_ELECTRONICA });
    expect(items.find((item) => item.code === '7')).toMatchObject({ required: true, condition_pending: true });
  });

  test('documentos habilitantes define cada archivo reutilizable', () => {
    expect(SHARED_DOCUMENT_TYPES).toHaveLength(8);
    expect(new Set(SHARED_DOCUMENT_TYPES.map((item) => item.key)).size).toBe(8);
  });

  test('necesidad de contratación es un ítem independiente', () => {
    const item = buildRequirements({ procedure_type: PROCEDURE_TYPES.INFIMA_CUANTIA })
      .find((requirement) => requirement.key === 'contracting_need');
    expect(item.independent).toBe(true);
    expect(item.required).toBe(false);
  });
});
