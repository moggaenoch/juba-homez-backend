const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/users", require("./users.routes"));
router.use("/properties", require("./properties.routes"));
router.use("/inquiries", require("./inquiries.routes"));
router.use("/notifications", require("./notifications.routes"));
router.use("/admin", require("./admin.routes"));

// Add-ons (1-4)
router.use("/viewings", require("./viewings.routes"));
router.use("/photo-jobs", require("./photoJobs.routes"));
router.use("/analytics", require("./analytics.routes"));
router.use("/media", require("./media.routes"));

module.exports = router;
