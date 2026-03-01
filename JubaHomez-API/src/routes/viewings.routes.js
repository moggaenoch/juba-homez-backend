const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authOptional, authRequired } = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const v = require("../controllers/viewings.controller");

// Customer (or guest) can request a viewing for a specific property.
// Controller can now accept recipientRole / recipientUserId (if you applied the controller update).
router.post(
  "/properties/:propertyId/requests",
  authOptional,
  validate(v.createRequestSchema),
  asyncHandler(v.createRequest)
);

// ✅ UPDATED: allow customers to see THEIR requests (controller listRequestsMine handles customer vs recipient logic)
router.get(
  "/requests",
  authRequired,
  requireRoles("customer", "broker", "owner", "admin"),
  asyncHandler(v.listRequestsMine)
);

// Broker/Owner/Admin schedules the actual viewing from a request
router.post(
  "/",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  validate(v.createViewingSchema),
  asyncHandler(v.createViewingFromRequest)
);

// ✅ UPDATED: allow customers to list THEIR viewings (controller listViewings handles requester vs recipient logic)
router.get(
  "/",
  authRequired,
  requireRoles("customer", "broker", "owner", "photographer", "admin"),
  asyncHandler(v.listViewings)
);

// ✅ UPDATED: allow customer to reschedule their own viewing (controller enforces ownership)
router.patch(
  "/:id/reschedule",
  authRequired,
  requireRoles("customer", "broker", "owner", "admin"),
  validate(v.rescheduleSchema),
  asyncHandler(v.reschedule)
);

// ✅ UPDATED: allow customer to cancel their own viewing (controller enforces ownership)
router.patch(
  "/:id/cancel",
  authRequired,
  requireRoles("customer", "broker", "owner", "admin"),
  validate(v.cancelSchema),
  asyncHandler(v.cancel)
);

module.exports = router;
