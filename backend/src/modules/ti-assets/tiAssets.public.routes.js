const express = require("express");
const ctrl = require("./tiAssets.controller");

const router = express.Router();

router.get("/:assetCode/condition-photos/:photoIndex", ctrl.getPublicInitialConditionPhoto);
router.get("/:assetCode", ctrl.getPublicAssetByCode);

module.exports = router;
