const express = require("express");
const router = express.Router();
const ctrl = require("./notifications.controller");
const { verifyToken } = require("../../middlewares/auth");

router.use(verifyToken);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/read-all", ctrl.markAll);
router.patch("/:id/read", ctrl.markRead);

module.exports = router;
