const express = require("express");
const controller = require("./crmWebhook.controller");

const router = express.Router();

// Ruta pública — NO requiere JWT.
// Seguridad: header X-Hook-Secret validado contra CRM_WEBHOOK_SECRET en .env.
// EspoCRM llama a POST /api/v1/integrations/crm/webhook cuando cambia una Opportunity.
router.post("/", controller.receiveWebhook);

module.exports = router;
