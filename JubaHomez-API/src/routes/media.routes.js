const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authRequired } = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/rbac.middleware");
const media = require("../controllers/media.controller");

router.delete("/:id", authRequired, requireRoles("broker", "owner", "admin"), asyncHandler(media.softDeleteMedia));

module.exports = router;
