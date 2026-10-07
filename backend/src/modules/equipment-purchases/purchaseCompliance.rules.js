const PROCEDURE_TYPES = Object.freeze({
  INFIMA_CUANTIA: 'infima_cuantia',
  SUBASTA_INVERSA_ELECTRONICA: 'subasta_inversa_electronica',
});

const REQUIREMENTS = Object.freeze([
  { key: 'proforma', code: '1', order: 1, title: 'Proforma' },
  {
    key: 'contracting_need', code: 'NC', order: 1.5,
    title: 'Necesidad de contratación',
    independent: true,
    help: 'Ítem independiente: puede cargarse sin alterar la secuencia obligatoria del procedimiento.',
  },
  { key: 'pliego', code: '2', order: 2, title: 'Pliego' },
  { key: 'technical_specifications', code: '3', order: 3, title: 'Especificaciones técnicas (TDR)' },
  { key: 'sercop_offer', code: '4', order: 4, title: 'Oferta presentada en el portal del SERCOP' },
  { key: 'initial_offer', code: '5', order: 5, title: 'Oferta inicial' },
  { key: 'award_resolution', code: '6', order: 6, title: 'Resolución de adjudicación' },
  {
    key: 'performance_bond', code: '7', order: 7,
    title: 'Póliza de fiel cumplimiento',
    help: 'Obligatoria cuando el presupuesto referencial supera USD 70.000.',
  },
  { key: 'signed_contract', code: '8', order: 8, title: 'Contrato firmado por Famproject y la entidad' },
  {
    key: 'delivery_request', code: '9', order: 9,
    title: 'Solicitud de entrega de mercadería',
    help: 'Debe incluir la respuesta de la entidad contratante.',
  },
  { key: 'signed_invoice', code: '10', order: 10, title: 'Factura firmada por las dos partes' },
  { key: 'signed_delivery_guide', code: '11', order: 11, title: 'Guía de remisión firmada por Famproject y la entidad' },
  { key: 'famproject_delivery_record', code: '12', order: 12, title: 'Acta de entrega de Famproject firmada por ambas partes' },
  {
    key: 'equipment_delivery_record', code: '13', order: 13,
    title: 'Acta de entrega de equipos de Famproject firmada por ambas partes',
    allows_not_applicable: true,
  },
  { key: 'entity_acceptance_record', code: '14', order: 14, title: 'Acta de recepción de la entidad firmada por ambas partes' },
  { key: 'enabling_documents', code: '15', order: 15, title: 'Documentos habilitantes de empresa y representante legal', shared_library: true },
  { key: 'sanitary_registrations', code: '16', order: 16, title: 'Registros sanitarios' },
  { key: 'batch_analysis', code: '17', order: 17, title: 'Análisis de lote' },
  { key: 'technical_datasheets', code: '18', order: 18, title: 'Fichas técnicas' },
  { key: 'exchange_commitment_letter', code: '19', order: 19, title: 'Carta de compromiso de canje' },
  { key: 'technical_warranty', code: '20', order: 20, title: 'Garantía técnica' },
]);

const SHARED_DOCUMENT_TYPES = Object.freeze([
  { key: 'company_ruc', label: 'RUC de la empresa' },
  { key: 'company_rup', label: 'RUP de la empresa' },
  { key: 'income_tax_return', label: 'Impuesto a la renta' },
  { key: 'bank_certificate', label: 'Certificado bancario' },
  { key: 'operating_permit', label: 'Permiso de funcionamiento' },
  { key: 'bpadt_certificate', label: 'Certificado de BPADT' },
  { key: 'general_manager_id', label: 'Cédula del gerente general' },
  { key: 'general_manager_appointment', label: 'Nombramiento del gerente general' },
]);

const INFIMA_REQUIRED_CODES = new Set(['3', '8', '9', '20']);

const isBaseRequired = (requirement, procedureType) => {
  if (procedureType === PROCEDURE_TYPES.INFIMA_CUANTIA) {
    return INFIMA_REQUIRED_CODES.has(requirement.code);
  }
  if (procedureType === PROCEDURE_TYPES.SUBASTA_INVERSA_ELECTRONICA) {
    const code = Number(requirement.code);
    return Number.isInteger(code) && code >= 2 && code <= 20;
  }
  return false;
};

const evaluateRequirement = (requirement, purchase = {}) => {
  const baseRequired = isBaseRequired(requirement, purchase.procedure_type);
  if (!baseRequired) return { required: false, condition_pending: false, condition_message: null };

  if (requirement.key === 'performance_bond') {
    if (purchase.presupuesto_referencial === null || purchase.presupuesto_referencial === undefined || purchase.presupuesto_referencial === '') {
      return {
        required: true,
        condition_pending: true,
        condition_message: 'Registra el presupuesto referencial para determinar si la póliza aplica.',
      };
    }
    if (Number(purchase.presupuesto_referencial) <= 70000) {
      return { required: false, condition_pending: false, condition_message: 'No aplica: presupuesto referencial de hasta USD 70.000.' };
    }
  }

  return { required: true, condition_pending: false, condition_message: null };
};

const buildRequirements = (purchase) => REQUIREMENTS.map((requirement) => ({
  ...requirement,
  ...evaluateRequirement(requirement, purchase),
}));

const findRequirement = (key) => REQUIREMENTS.find((item) => item.key === key) || null;

module.exports = {
  PROCEDURE_TYPES,
  REQUIREMENTS,
  SHARED_DOCUMENT_TYPES,
  buildRequirements,
  findRequirement,
};
