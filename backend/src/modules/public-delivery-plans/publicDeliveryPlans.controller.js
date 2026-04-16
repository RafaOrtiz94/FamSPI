const Joi = require("joi");
const service = require("./publicDeliveryPlans.service");

const listQuerySchema = Joi.object({
  deliveryCeilingId: Joi.number().integer().positive().optional(),
  status: Joi.string()
    .trim()
    .valid(...service.PUBLIC_DELIVERY_PLAN_STATUSES)
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
});

const createDraftSchema = Joi.object({
  deliveryCeilingId: Joi.number().integer().positive().required(),
  notes: Joi.string().trim().allow("", null).max(2000).optional(),
});

const addLineParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const addLineBodySchema = Joi.object({
  deliveryCeilingLineId: Joi.number().integer().positive().required(),
  scheduledStart: Joi.date().iso().required(),
  scheduledEnd: Joi.date().iso().required(),
  maxQtyTranche: Joi.number().positive().required(),
  notes: Joi.string().trim().allow("", null).max(2000).optional(),
});

const transitionSchema = Joi.object({
  toStatus: Joi.string()
    .trim()
    .valid(...service.PUBLIC_DELIVERY_PLAN_STATUSES)
    .required(),
  reason: Joi.string().trim().allow("", null).max(2000).optional(),
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

async function list(req, res) {
  const { error, value } = listQuerySchema.validate(req.query || {}, {
    convert: true,
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PUBLIC_DELIVERY_PLAN_QUERY_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.list(value);
    return res.status(200).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo listar public delivery plans");
  }
}

async function createDraft(req, res) {
  const { error, value } = createDraftSchema.validate(req.body || {}, {
    convert: true,
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PUBLIC_DELIVERY_PLAN_PAYLOAD_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.createDraft({
      deliveryCeilingId: value.deliveryCeilingId,
      notes: value.notes,
      actorUser: req.user || null,
    });
    return res.status(201).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo crear public delivery plan");
  }
}

async function addLine(req, res) {
  const { error: paramsError, value: paramsValue } = addLineParamsSchema.validate(
    req.params || {},
    {
      convert: true,
      abortEarly: false,
    },
  );
  if (paramsError) {
    return res.status(400).json({
      ok: false,
      code: "PUBLIC_DELIVERY_PLAN_ID_INVALID",
      message: getValidationMessage(paramsError),
      details: paramsError.details,
    });
  }

  const { error, value } = addLineBodySchema.validate(req.body || {}, {
    convert: true,
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PUBLIC_DELIVERY_PLAN_LINE_PAYLOAD_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.addLine({
      planId: paramsValue.id,
      deliveryCeilingLineId: value.deliveryCeilingLineId,
      scheduledStart: value.scheduledStart,
      scheduledEnd: value.scheduledEnd,
      maxQtyTranche: value.maxQtyTranche,
      notes: value.notes,
      actorUser: req.user || null,
    });
    return res.status(201).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo agregar tramo al public delivery plan");
  }
}

async function transitionStatus(req, res) {
  const { error: paramsError, value: paramsValue } = addLineParamsSchema.validate(
    req.params || {},
    {
      convert: true,
      abortEarly: false,
    },
  );
  if (paramsError) {
    return res.status(400).json({
      ok: false,
      code: "PUBLIC_DELIVERY_PLAN_ID_INVALID",
      message: getValidationMessage(paramsError),
      details: paramsError.details,
    });
  }

  const { error, value } = transitionSchema.validate(req.body || {}, {
    convert: true,
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PUBLIC_DELIVERY_PLAN_TRANSITION_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.transitionStatus({
      planId: paramsValue.id,
      toStatus: value.toStatus,
      reason: value.reason,
      actorUser: req.user || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (serviceError) {
    return handleError(res, serviceError, "No se pudo cambiar estado del public delivery plan");
  }
}

module.exports = {
  list,
  createDraft,
  addLine,
  transitionStatus,
};

