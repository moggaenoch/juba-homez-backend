const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authOptional, authRequired } = require("../middlewares/auth.middleware");
const { requireRoles, requirePropertyOwnershipOrRole } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { upload } = require("../middlewares/upload.middleware");

const props = require("../controllers/properties.controller");
const inquiries = require("../controllers/inquiries.controller");
const media = require("../controllers/media.controller");

router.get("/", authOptional, asyncHandler(props.listPublic));
router.get("/areas", asyncHandler(props.areas));
router.get("/:id", authOptional, asyncHandler(props.getOnePublic));

// Media (public approved)
router.get("/:id/media", asyncHandler(media.listPropertyMediaPublic));

// Upload media (pending approval)
router.post(
  "/:id/media",
  authRequired,
  requireRoles("broker", "owner", "photographer", "admin"),
  upload.array("files", 10),
  asyncHandler(media.uploadPropertyMedia)
);

// Customer/Guest: create inquiry on property
router.post("/:id/inquiries", validate(inquiries.createSchema), asyncHandler(inquiries.create));

// Create property (broker/owner/admin)
router.post(
  "/",
  authRequired,
  requireRoles("broker", "owner", "admin"),
  validate(props.createSchema),
  asyncHandler(props.create)
);

// Update property (owner/broker of property or admin)
router.patch(
  "/:id",
  authRequired,
  requirePropertyOwnershipOrRole,
  validate(props.updateSchema),
  asyncHandler(props.update)
);

// Set status
router.patch(
  "/:id/status",
  authRequired,
  requirePropertyOwnershipOrRole,
  validate(props.statusSchema),
  asyncHandler(props.setStatus)
);

// Soft delete
router.delete("/:id", authRequired, requirePropertyOwnershipOrRole, asyncHandler(props.softDelete));

module.exports = router;
