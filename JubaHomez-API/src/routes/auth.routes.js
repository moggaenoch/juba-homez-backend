const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { validate } = require("../middlewares/validate.middleware");

const auth = require("../controllers/auth.controller");

router.post("/register", validate(auth.registerSchema), asyncHandler(auth.register));
router.post("/login", validate(auth.loginSchema), asyncHandler(auth.login));
router.post("/password/forgot", validate(auth.forgotSchema), asyncHandler(auth.forgotPassword));
router.post("/password/reset", validate(auth.resetSchema), asyncHandler(auth.resetPassword));

module.exports = router;
