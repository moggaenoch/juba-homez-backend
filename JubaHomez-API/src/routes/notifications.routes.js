const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authRequired } = require("../middlewares/auth.middleware");
const n = require("../controllers/notifications.controller");

router.get("/", authRequired, asyncHandler(n.listMine));
router.patch("/:id/read", authRequired, asyncHandler(n.markRead));
router.patch("/read-all", authRequired, asyncHandler(n.markAllRead));

module.exports = router;
