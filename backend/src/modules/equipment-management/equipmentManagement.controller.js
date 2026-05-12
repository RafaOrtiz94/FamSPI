const { asyncHandler } = require("../../middlewares/asyncHandler");
const service = require("./equipmentManagement.service");

const send = (res, data, status = 200) => {
  res.status(status).json({
    ok: true,
    data,
    total: Array.isArray(data) ? data.length : undefined,
  });
};

exports.listStatuses = asyncHandler(async (_req, res) => {
  send(res, await service.listStatuses());
});

exports.listModels = asyncHandler(async (req, res) => {
  send(res, await service.listModels(req.query || {}));
});

exports.getModelDetail = asyncHandler(async (req, res) => {
  send(res, await service.getModelDetail(req.params.id));
});

exports.listAssets = asyncHandler(async (req, res) => {
  send(res, await service.listAssets(req.query || {}));
});

exports.createAsset = asyncHandler(async (req, res) => {
  if (!req.body?.equipment_model_id) {
    return res.status(400).json({ ok: false, message: "equipment_model_id es requerido" });
  }
  send(res, await service.createAsset(req.body, req.user?.id || null), 201);
});

exports.changeAssetStatus = asyncHandler(async (req, res) => {
  if (!req.body?.status) {
    return res.status(400).json({ ok: false, message: "status es requerido" });
  }
  send(res, await service.changeAssetStatus(req.params.id, req.body, req.user?.id || null));
});

exports.reserveAsset = asyncHandler(async (req, res) => {
  send(res, await service.reserveAsset(req.params.id, req.body || {}, req.user?.id || null), 201);
});

exports.installAsset = asyncHandler(async (req, res) => {
  if (!req.body?.client_id) {
    return res.status(400).json({ ok: false, message: "client_id es requerido" });
  }
  send(res, await service.installAsset(req.params.id, req.body, req.user?.id || null));
});

exports.listAssetTimeline = asyncHandler(async (req, res) => {
  send(res, await service.listAssetTimeline(req.params.id));
});

exports.listSchedule = asyncHandler(async (req, res) => {
  send(res, await service.listSchedule(req.query || {}));
});

exports.createProcedure = asyncHandler(async (req, res) => {
  if (!req.body?.equipment_model_id || !req.body?.name) {
    return res.status(400).json({ ok: false, message: "equipment_model_id y name son requeridos" });
  }
  send(res, await service.createProcedure(req.body, req.user?.id || null), 201);
});

exports.createPart = asyncHandler(async (req, res) => {
  if (!req.body?.name) {
    return res.status(400).json({ ok: false, message: "name es requerido" });
  }
  send(res, await service.createPart(req.body), 201);
});

exports.attachPartToProcedure = asyncHandler(async (req, res) => {
  if (!req.body?.part_id) {
    return res.status(400).json({ ok: false, message: "part_id es requerido" });
  }
  send(res, await service.attachPartToProcedure(req.params.id, req.body), 201);
});
