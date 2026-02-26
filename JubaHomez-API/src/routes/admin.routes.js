const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authRequired } = require("../middlewares/auth.middleware");
const { requireRoles } = require("../middlewares/rbac.middleware");
const { validate } = require("../middlewares/validate.middleware");
const admin = require("../controllers/admin.controller");

router.use(authRequired, requireRoles("admin"));

// Users approvals
router.get("/users", asyncHandler(admin.listUsers));
router.patch("/users/:id/approve", asyncHandler(admin.approveUser));
router.patch("/users/:id/reject", validate(admin.rejectSchema), asyncHandler(admin.rejectUser));

// Properties approvals
router.get("/properties", asyncHandler(admin.listProperties));
router.patch("/properties/:id/approve", asyncHandler(admin.approveProperty));
router.patch("/properties/:id/reject", validate(admin.rejectSchema), asyncHandler(admin.rejectProperty));

// Media approvals
router.get("/media", asyncHandler(admin.listMedia));
router.patch("/media/:id/approve", asyncHandler(admin.approveMedia));
router.patch("/media/:id/reject", validate(admin.rejectSchema), asyncHandler(admin.rejectMedia));

// Audit logs
router.get("/audit-logs", asyncHandler(admin.auditLogs));

// Announcements
router.post("/announcements", validate(admin.announcementSchema), asyncHandler(admin.createAnnouncement));

module.exports = router;
