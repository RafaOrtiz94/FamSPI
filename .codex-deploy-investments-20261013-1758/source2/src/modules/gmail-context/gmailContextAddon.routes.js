const express = require("express");
const controller = require("./gmailContext.controller");
const { verifyAddonIdentity } = require("./gmailContextAddonAuth");

const router = express.Router();
router.use(verifyAddonIdentity);

router.get("/communications", controller.list);
router.post("/communications", controller.register);
router.get("/communications/:id/client-suggestions", controller.clientSuggestions);
router.post("/communications/:id/link", controller.link);
router.get("/search/clients", controller.searchClients);
router.get("/search/processes", controller.searchProcesses);

module.exports = router;
