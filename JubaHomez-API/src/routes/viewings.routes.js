const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authOptional, authRequired } = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const v = require("../controllers/viewings.controller");

router.post(
  "/properties/:propertyId/requests",
  authOptional,
  validate(v.createRequestSchema),
  asyncHandler(v.createRequest)
);

router.get(
  "/requests",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  asyncHandler(v.listRequestsMine)
);

router.post(
  "/",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  validate(v.createViewingSchema),
  asyncHandler(v.createViewingFromRequest)
);

router.get(
  "/",
  authRequired,
  requireRoles("broker", "owner", "photographer", "admin"),
  asyncHandler(v.listViewings)
);

router.patch(
  "/:id/reschedule",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  validate(v.rescheduleSchema),
  asyncHandler(v.reschedule)
);

router.patch(
  "/:id/cancel",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  validate(v.cancelSchema),
  asyncHandler(v.cancel)
);

module.exports = router;
