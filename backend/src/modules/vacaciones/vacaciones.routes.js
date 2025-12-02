const express = require("express");
const controller = require("./vacaciones.controller");

const router = express.Router();

router.post("/", controller.create);
router.get("/", controller.list);
router.patch("/:id/status", controller.updateStatus);
router.get("/summary/data", controller.getSummary);

module.exports = router;
