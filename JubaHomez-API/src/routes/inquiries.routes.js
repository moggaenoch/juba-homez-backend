const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authRequired } = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const inquiries = require("../controllers/inquiries.controller");

router.get("/", authRequired, requireRoles("broker", "owner", "admin"), asyncHandler(inquiries.listMine));
router.get("/:id", authRequired, requireRoles("broker", "owner", "admin"), asyncHandler(inquiries.getOne));
router.post("/:id/replies", authRequired, requireRoles("broker", "owner", "admin"), validate(inquiries.replySchema), asyncHandler(inquiries.reply));

module.exports = router;
