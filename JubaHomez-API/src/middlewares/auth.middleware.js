const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { fail } = require("../utils/responses");
const { query } = require("../config/db");

async function authRequired(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(fail(401, "Missing Authorization Bearer token"));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const users = await query(
      "SELECT id, role, status, email, name, phone, bio, avatar_url FROM users WHERE id = ? LIMIT 1",
      [payload.userId]
    );
    if (!users.length) return next(fail(401, "Invalid token (user not found)"));
    if (users[0].status !== "active") return next(fail(403, "Account is not active"));
    req.user = users[0];
    return next();
  } catch (e) {
    return next(fail(401, "Invalid/expired token"));
  }
}

function authOptional(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.userId, role: payload.role };
  } catch (_e) {
    // ignore
  }
  next();
}

module.exports = { authRequired, authOptional };
