const { asyncHandler } = require("../../middlewares/asyncHandler");
const service = require("./signatureWorkflows.service");
const {
  validateCreateWorkflowPayload,
  validateSignerActionPayload,
} = require("./signatureWorkflows.validation");

exports.createWorkflow = asyncHandler(async (req, res) => {
  const payload = validateCreateWorkflowPayload(req.body || {});
  const result = await service.createWorkflow({ payload, user: req.user });
  res.status(201).json({ ok: true, data: result });
});

exports.listWorkflows = asyncHandler(async (req, res) => {
  const data = await service.listWorkflows({
    user: req.user,
    filters: {
      status: req.query.status || null,
      source_module: req.query.source_module || null,
    },
  });
  res.json({ ok: true, data });
});

exports.getWorkflow = asyncHandler(async (req, res) => {
  const data = await service.getWorkflow(Number(req.params.id), req.user);
  res.json({ ok: true, data });
});

exports.sendWorkflow = asyncHandler(async (req, res) => {
  const data = await service.sendWorkflow(Number(req.params.id), req.user);
  res.json({ ok: true, data });
});

exports.openSignerStep = asyncHandler(async (req, res) => {
  const data = await service.openSignerStep({
    workflowId: Number(req.params.id),
    signerId: Number(req.params.signerId),
    user: req.user,
  });
  res.json({ ok: true, data });
});

exports.signStep = asyncHandler(async (req, res) => {
  const action = validateSignerActionPayload(req.body || {}, { requireConsent: true });
  action.ip_address = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null;
  action.user_agent = req.headers["user-agent"] || null;
  const data = await service.signStep({
    workflowId: Number(req.params.id),
    signerId: Number(req.params.signerId),
    user: req.user,
    action,
  });
  res.json({ ok: true, data });
});

exports.rejectStep = asyncHandler(async (req, res) => {
  const action = validateSignerActionPayload(req.body || {}, { requireReason: true });
  const data = await service.rejectStep({
    workflowId: Number(req.params.id),
    signerId: Number(req.params.signerId),
    user: req.user,
    action,
  });
  res.json({ ok: true, data });
});

exports.listMyPending = asyncHandler(async (req, res) => {
  const data = await service.listMyPending(req.user);
  res.json({ ok: true, data });
});

exports.listMyCompleted = asyncHandler(async (req, res) => {
  const data = await service.listMyCompleted(req.user);
  res.json({ ok: true, data });
});

exports.listSignerCandidates = asyncHandler(async (_req, res) => {
  const data = await service.listSignerCandidates();
  res.json({ ok: true, data });
});

exports.downloadSourcePdf = asyncHandler(async (req, res) => {
  const payload = await service.getDocumentPayload({
    workflowId: Number(req.params.id),
    documentId: Number(req.params.documentId),
    final: false,
    user: req.user,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${payload.filename}"`);
  res.send(Buffer.from(payload.base64, "base64"));
});

exports.downloadFinalPdf = asyncHandler(async (req, res) => {
  const payload = await service.getDocumentPayload({
    workflowId: Number(req.params.id),
    documentId: Number(req.params.documentId),
    final: true,
    user: req.user,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${payload.filename}"`);
  res.send(Buffer.from(payload.base64, "base64"));
});

exports.cancelWorkflow = asyncHandler(async (req, res) => {
  const data = await service.cancelWorkflow(Number(req.params.id), req.user);
  res.json({ ok: true, data });
});

exports.validateSignerProfiles = asyncHandler(async (req, res) => {
  const userIds = (req.body?.user_ids || []).map(Number).filter(Boolean);
  const incomplete = await service.validateSignerProfiles(userIds);
  res.json({ ok: true, incomplete });
});

exports.reassignSigner = asyncHandler(async (req, res) => {
  const { userId, email, name, reason } = req.body;
  const data = await service.reassignSigner(
    Number(req.params.id),
    Number(req.params.signerId),
    { userId: userId || null, email, name, reason },
    req.user
  );
  res.json({ ok: true, data });
});

exports.verifyWorkflowJson = asyncHandler(async (req, res) => {
  const data = await service.verifyByToken(String(req.params.token || "").trim());
  if (!data) return res.status(404).json({ ok: false, message: "Token de verificacion no encontrado" });
  res.json({ ok: true, data });
});

exports.verifyWorkflowHtml = asyncHandler(async (req, res) => {
  const data = await service.verifyByToken(String(req.params.token || "").trim());
  if (!data) {
    return res.status(404).type("html").send("<html><body><h1>Token no encontrado</h1></body></html>");
  }
  const signersHtml = (data.signers || [])
    .map(
      (signer) =>
        `<li>${signer.name_snapshot} (${signer.role_snapshot || "sin_rol"}) - ${signer.status}${
          signer.signed_at ? ` - ${new Date(signer.signed_at).toLocaleString()}` : ""
        }</li>`
    )
    .join("");
  res.type("html").send(`
    <html>
      <head><title>Verificacion FamSign</title></head>
      <body>
        <h1>Verificacion FamSign</h1>
        <p><strong>Codigo:</strong> ${data.workflow.workflow_code}</p>
        <p><strong>Estado:</strong> ${data.workflow.status}</p>
        <p><strong>Titulo:</strong> ${data.workflow.title || ""}</p>
        <p><strong>Origen:</strong> ${data.workflow.source_module}/${data.workflow.source_entity}/${data.workflow.source_entity_id}</p>
        <h2>Firmantes</h2>
        <ul>${signersHtml}</ul>
      </body>
    </html>
  `);
});
