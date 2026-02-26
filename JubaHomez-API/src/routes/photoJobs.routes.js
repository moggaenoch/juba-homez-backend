const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authRequired } = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const pj = require("../controllers/photoJobs.controller");

router.post(
  "/properties/:propertyId",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  validate(pj.createJobSchema),
  asyncHandler(pj.createJob)
);

router.get(
  "/open",
  authRequired,
  requireRoles("photographer", "admin"),
  asyncHandler(pj.listOpenJobs)
);

router.patch(
  "/:id/accept",
  authRequired,
  requireRoles("photographer", "admin"),
  asyncHandler(pj.acceptJob)
);

router.patch(
  "/:id/reject",
  authRequired,
  requireRoles("photographer", "admin"),
  validate(pj.rejectSchema),
  asyncHandler(pj.rejectJob)
);

router.patch(
  "/:id/schedule",
  authRequired,
  requireRoles("photographer", "admin"),
  validate(pj.scheduleSchema),
  asyncHandler(pj.scheduleJob)
);

router.patch(
  "/:id/complete",
  authRequired,
  requireRoles("photographer", "admin"),
  asyncHandler(pj.completeJob)
);

router.post(
  "/:id/messages",
  authRequired,
  requireRoles("photographer", "broker", "owner", "admin"),
  validate(pj.messageSchema),
  asyncHandler(pj.sendMessage)
);

router.get(
  "/:id/messages",
  authRequired,
  requireRoles("photographer", "broker", "owner", "admin"),
  asyncHandler(pj.listMessages)
);

module.exports = router;
