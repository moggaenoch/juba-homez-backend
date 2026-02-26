const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken({ userId, role }) {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

module.exports = { signToken };
