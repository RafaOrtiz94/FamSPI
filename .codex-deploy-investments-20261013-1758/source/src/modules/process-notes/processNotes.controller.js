const { asyncHandler } = require("../../middlewares/asyncHandler");
const service = require("./processNotes.service");

// mentioned_user_ids llega como array cuando el body es JSON (nota sin
// adjuntos) pero como string JSON cuando el body es multipart/form-data
// (nota con imagenes) -- FormData no soporta arrays anidados nativos.
function parseMentionedUserIds(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function filesToAttachments(files) {
  return (files || []).map((file) => ({
    filename: file.originalname,
    contentType: file.mimetype,
    contentBase64: file.buffer.toString("base64"),
  }));
}

exports.listNotes = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  await service.assertParticipantAccess(entityType, entityId, req.user);
  const notes = await service.listNotes(entityType, entityId);
  res.json({ ok: true, data: notes });
});

exports.createNote = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const note = await service.createNote({
    entityType,
    entityId,
    author: req.user,
    body: req.body?.body,
    parentNoteId: req.body?.parent_note_id || null,
    mentionedUserIds: parseMentionedUserIds(req.body?.mentioned_user_ids),
    attachments: filesToAttachments(req.files),
  });
  res.status(201).json({ ok: true, data: note });
});

exports.markNoteRead = asyncHandler(async (req, res) => {
  const { entityType, entityId, noteId } = req.params;
  await service.assertParticipantAccess(entityType, entityId, req.user);
  await service.markNoteRead(entityType, entityId, noteId, req.user.id);
  res.json({ ok: true });
});

exports.listMentionCandidates = asyncHandler(async (req, res) => {
  const { entityType } = req.params;
  await service.assertParticipantAccess(entityType, req.query.entity_id, req.user);
  const candidates = await service.listMentionCandidates(entityType);
  res.json({ ok: true, data: candidates });
});

exports.sendEmail = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const note = await service.sendProcessEmail({
    entityType,
    entityId,
    author: req.user,
    to: req.body?.to,
    cc: req.body?.cc,
    subject: req.body?.subject,
    body: req.body?.body,
    attachments: filesToAttachments(req.files),
  });
  res.status(201).json({ ok: true, data: note });
});
