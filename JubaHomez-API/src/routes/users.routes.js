const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { authRequired } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const users = require("../controllers/users.controller");

router.get("/me", authRequired, asyncHandler(users.me));
router.patch("/me", authRequired, validate(users.updateMeSchema), asyncHandler(users.updateMe));
router.get("/:id/public", asyncHandler(users.publicProfile));

module.exports = router;
