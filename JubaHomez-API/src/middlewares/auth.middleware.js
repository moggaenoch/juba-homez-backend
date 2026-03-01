// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { fail } = require("../utils/responses");
const { query } = require("../config/db");

async function authRequired(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(fail(401, "Missing Authorization Bearer token"));

  // 1) Verify JWT
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    console.error("JWT VERIFY FAILED:", e.name, e.message);
    return next(fail(401, e.name === "TokenExpiredError" ? "Token expired" : "Invalid token"));
  }

  // 2) Fetch user from DB (use ONLY columns that exist in your table)
  try {
    const users = await query(
      "SELECT id, role, status, email, name, phone FROM users WHERE id = ? LIMIT 1",
      [payload.userId]
    );

    if (!users.length) return next(fail(401, "Invalid token (user not found)"));
    if (users[0].status !== "active") return next(fail(403, "Account is not active"));

    req.user = users[0];
    return next();
  } catch (e) {
    // This is what you're hitting now
    console.error("AUTH DB LOOKUP FAILED:", e.code, e.message);
    return next(fail(500, "Auth lookup failed"));
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
