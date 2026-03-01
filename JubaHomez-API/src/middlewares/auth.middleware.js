// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { fail } = require("../utils/responses");
const { query } = require("../config/db");

async function authRequired(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(fail(401, "Missing Authorization Bearer token"));

  // 1) Verify token ONLY
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    console.error("JWT VERIFY FAILED:", e.name, e.message);
    // More truthful message:
    const msg = e.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return next(fail(401, msg));
  }

  // 2) Load user from DB (separate error handling)
  let users;
  try {
    users = await query(
      "SELECT id, role, status, email, name, phone, bio, avatar_url FROM users WHERE id = ? LIMIT 1",
      [payload.userId]
    );
  } catch (e) {
    console.error("AUTH DB LOOKUP FAILED:", e.message);
    return next(fail(500, "Auth lookup failed"));
  }

  if (!users.length) return next(fail(401, "Invalid token (user not found)"));
  if (users[0].status !== "active") return next(fail(403, "Account is not active"));

  req.user = users[0];
  return next();
}

function authOptional(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.userId, role: payload.role };
  } catch (e) {
    // ignore
  }

  next();
}

module.exports = { authRequired, authOptional };
