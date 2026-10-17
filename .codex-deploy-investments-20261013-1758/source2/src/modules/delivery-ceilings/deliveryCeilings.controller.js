const Joi = require("joi");
const service = require("./deliveryCeilings.service");

const listQuerySchema = Joi.object({
  ceilingId: Joi.number().integer().positive().optional(),
  businessCaseId: Joi.string().trim().optional(),
  privatePurchaseId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim()).optional(),
  status: Joi.string()
    .trim()
    .valid(...service.DELIVERY_CEILING_STATUSES)
    .optional(),
  purchaseType: Joi.string()
    .trim()
    .valid(...service.DELIVERY_CEILING_PURCHASE_TYPES)
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
});

const getValidationMessage = (error) => {
  if (!error?.details?.length) return "Solicitud invalida";
  return error.details.map((detail) => detail.message).join(", ");
};

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    code: error?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    message: error?.message || fallbackMessage,
    details: error?.details || null,
  });
};

async function listDeliveryCeilings(req, res) {
  const { error, value } = listQuerySchema.validate(req.query || {}, {
    convert: true,
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      code: "DELIVERY_CEILING_QUERY_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.listDeliveryCeilings(value);
    return res.status(200).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo listar delivery ceilings");
  }
}

module.exports = {
  listDeliveryCeilings,
};
