const service = require("./approvals.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const logger = require("../../config/logger");

/** 📋 Listar pendientes */
exports.listPending = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  const result = await service.listPending(Number(page), Number(pageSize), {
    id: req.user.id,
    role: req.user.role,
  });
  res.json(result);
});

/** ✅ Aprobar */
exports.approve = asyncHandler(async (req, res) => {
  const request_id = parseInt(req.params.id, 10);
  const approver_id = req.user.id;
  const result = await service.approve(request_id, approver_id);
  res.json({ ok: true, result });
});

/** ❌ Rechazar */
exports.reject = asyncHandler(async (req, res) => {
  const request_id = parseInt(req.params.id, 10);
  const approver_id = req.user.id;
  const { note } = req.body;
  const result = await service.reject(request_id, approver_id, note);
  res.json({ ok: true, result });
});
