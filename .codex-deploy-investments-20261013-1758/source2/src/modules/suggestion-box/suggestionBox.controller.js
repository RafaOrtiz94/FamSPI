const { asyncHandler } = require("../../middlewares/asyncHandler");
const service = require("./suggestionBox.service");

exports.createPublicSubmission = asyncHandler(async (req, res) => {
  const data = await service.createSubmission(req.body || {}, { source: "external" });
  res.status(201).json({ ok: true, data });
});

exports.createInternalSubmission = asyncHandler(async (req, res) => {
  const data = await service.createSubmission(req.body || {}, { source: "internal", user: req.user });
  res.status(201).json({ ok: true, data });
});

exports.listSubmissions = asyncHandler(async (req, res) => {
  const data = await service.listSubmissions({ status: req.query?.status, submissionType: req.query?.submission_type, q: req.query?.q, limit: req.query?.limit });
  res.json({ ok: true, total: data.length, data });
});

exports.getSubmission = asyncHandler(async (req, res) => {
  const data = await service.getSubmission(req.params.id);
  res.json({ ok: true, data });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const data = await service.updateStatus(req.params.id, req.body || {}, req.user?.id || null);
  res.json({ ok: true, data });
});
