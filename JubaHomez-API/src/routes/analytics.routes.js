const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authOptional, authRequired } = require("../middlewares/auth.middleware");
const { requireRoles, requirePropertyOwnershipOrRole } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const a = require("../controllers/analytics.controller");

router.post("/events", authOptional, validate(a.eventSchema), asyncHandler(a.trackEvent));

router.get("/my-properties", authRequired, requireRoles("owner", "broker", "admin"), asyncHandler(a.myPropertiesStats));

router.get("/properties/:id", authRequired, requirePropertyOwnershipOrRole, asyncHandler(a.propertyStats));

module.exports = router;
