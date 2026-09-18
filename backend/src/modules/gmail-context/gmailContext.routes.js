const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const controller = require("./gmailContext.controller");

const router = express.Router();
router.use(verifyToken);

router.get("/communications", controller.list);
router.post("/communications", controller.register);
router.get("/communications/:id/client-suggestions", controller.clientSuggestions);
router.get("/communications/:id/process-candidates", controller.processCandidates);
router.post("/communications/:id/auto-link", controller.autoLink);
router.post("/communications/:id/link", controller.link);
router.get("/search/clients", controller.searchClients);
router.get("/search/processes", controller.searchProcesses);

module.exports = router;
