const Joi = require("joi");
const service = require("./deliveryRequests.service");

const createDeliveryRequestSchema = Joi.object({
  ceilingId: Joi.number().integer().positive().required(),
  asOfDate: Joi.date().iso().optional(),
  lines: Joi.array()
    .items(
      Joi.object({
        ceilingLineId: Joi.number().integer().positive().required(),
        requestedQty: Joi.number().positive().required(),
      }),
    )
    .min(1)
    .required(),
  notes: Joi.string().trim().allow("", null).max(2000).optional(),
});

const confirmDeliverySchema = Joi.object({
  id: Joi.number().integer().positive().required(),
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

async function createDeliveryRequest(req, res) {
  const { error, value } = createDeliveryRequestSchema.validate(req.body || {}, {
    convert: true,
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      code: "DELIVERY_REQUEST_PAYLOAD_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.createDeliveryRequest({
      ceilingId: value.ceilingId,
      asOfDate: value.asOfDate,
      lines: value.lines,
      notes: value.notes,
      actorUser: req.user || null,
    });
    return res.status(201).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo crear delivery request");
  }
}

async function confirmDeliveryRequest(req, res) {
  const { error, value } = confirmDeliverySchema.validate(req.params || {}, {
    convert: true,
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      code: "DELIVERY_REQUEST_ID_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.confirmDeliveryRequest({
      requestId: value.id,
      actorUser: req.user || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo confirmar delivery request");
  }
}

module.exports = {
  createDeliveryRequest,
  confirmDeliveryRequest,
};
