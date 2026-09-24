const express = require("express");
const multer = require("multer");
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./processNotes.controller");

const router = express.Router();
// Limite por archivo generoso pero acotado -- el limite real combinado
// (20MB) lo valida processNotes.service.js contra el total de adjuntos,
// esto solo evita que un solo archivo gigante agote memoria antes de eso.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 10 } });

router.use(verifyToken);

router.get("/:entityType/mention-candidates", ctrl.listMentionCandidates);
router.get("/:entityType/:entityId", ctrl.listNotes);
router.post("/:entityType/:entityId", upload.array("files", 10), ctrl.createNote);
router.post("/:entityType/:entityId/email", upload.array("files", 10), ctrl.sendEmail);
router.post("/:entityType/:entityId/:noteId/read", ctrl.markNoteRead);

module.exports = router;
