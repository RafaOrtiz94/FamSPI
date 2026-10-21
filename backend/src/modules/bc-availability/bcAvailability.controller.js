const Joi = require("joi");
const service = require("./bcAvailability.service");

const createSchema = Joi.object({
  // normalizeApiPayloads renombra business_case_id -> businessCaseId antes de llegar aqui
  businessCaseId: Joi.string().uuid().required(),
  servicio_equipo_id: Joi.alternatives(Joi.string().trim(), Joi.number()).required(),
  equipment_name: Joi.string().trim().allow("", null).max(300),
  notes: Joi.string().trim().allow("", null).max(2000),
});
const sendSchema = Joi.object({
  provider_emails: Joi.alternatives(Joi.array().items(Joi.string()), Joi.string()).required(),
  notes: Joi.string().trim().allow("", null).max(2000),
});
const responseSchema = Joi.object({
  result: Joi.string().valid(...service.SUPPLIER_RESULTS).required(),
  notes: Joi.string().trim().allow("", null).max(2000),
});
const closeSchema = Joi.object({
  status: Joi.string().valid(...service.CLOSE_STATUSES).required(),
  notes: Joi.string().trim().allow("", null).max(2000),
});

const handle = (schema, fn) => async (req, res) => {
  try {
    let body = req.body;
    if (schema) {
      const { value, error } = schema.validate(req.body || {}, { abortEarly: false, stripUnknown: true });
      if (error) return res.status(400).json({ ok: false, message: error.message });
      body = value;
    }
    const data = await fn(req, body);
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, code: err.code, message: err.message });
  }
};

exports.list = handle(null, (req) =>
  service.list({ user: req.user, businessCaseId: req.query.businessCaseId, status: req.query.status }),
);
exports.get = handle(null, (req) => service.getById(req.params.id, req.user));
exports.create = handle(createSchema, (req, b) =>
  service.create({
    user: req.user,
    businessCaseId: b.businessCaseId,
    servicioEquipoId: b.servicio_equipo_id,
    equipmentName: b.equipment_name,
    notes: b.notes,
  }),
);
exports.sendToSuppliers = handle(sendSchema, (req, b) =>
  service.sendToSuppliers({ id: req.params.id, user: req.user, providerEmails: b.provider_emails, notes: b.notes }),
);
exports.recordResponse = handle(responseSchema, (req, b) =>
  service.recordSupplierResponse({
    id: req.params.id,
    queryId: req.params.queryId,
    user: req.user,
    result: b.result,
    notes: b.notes,
  }),
);
exports.close = handle(closeSchema, (req, b) =>
  service.close({ id: req.params.id, user: req.user, status: b.status, notes: b.notes }),
);
