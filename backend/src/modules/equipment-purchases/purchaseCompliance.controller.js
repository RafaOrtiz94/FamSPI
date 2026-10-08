const multer = require("multer");
const service = require("./purchaseCompliance.service");

const upload = multer({ storage: multer.memoryStorage() });

function handleError(error, res) {
  return res.status(error.status || 500).json({
    ok: false,
    code: error.code || "PUBLIC_PURCHASE_COMPLIANCE_ERROR",
    message: error.message || "No se pudo completar la operación.",
    ...(error.details ? { details: error.details } : {}),
  });
}

const action = (handler) => async (req, res) => {
  try {
    const data = await handler(req);
    return res.json({ ok: true, data });
  } catch (error) {
    return handleError(error, res);
  }
};

module.exports = {
  upload,
  getCompliance: action((req) => service.getCompliance({ purchaseId: req.params.id, user: req.user })),
  updateProcedureType: action((req) => service.updateProcedureType({
    purchaseId: req.params.id,
    procedureType: req.body?.procedure_type,
    user: req.user,
  })),
  uploadEvidence: action((req) => service.uploadEvidence({
    purchaseId: req.params.id,
    requirementKey: req.params.requirementKey,
    file: req.file,
    user: req.user,
  })),
  updateItemStatus: action((req) => service.updateItemStatus({
    purchaseId: req.params.id,
    requirementKey: req.params.requirementKey,
    status: req.body?.status,
    notes: req.body?.notes,
    user: req.user,
  })),
  listSharedDocuments: action((req) => service.listSharedDocuments({ user: req.user })),
  uploadSharedDocument: action((req) => service.uploadSharedDocument({
    documentType: req.params.documentType,
    file: req.file,
    notes: req.body?.notes,
    user: req.user,
  })),
};
