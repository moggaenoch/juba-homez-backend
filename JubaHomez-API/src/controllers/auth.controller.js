const Joi = require("joi");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const { query } = require("../config/db");
const { created, ok, fail } = require("../utils/responses");
const { signToken } = require("../services/token.service");
const { audit } = require("../services/audit.service");

const allowedRoles = ["customer", "broker", "owner", "photographer"];

const registerSchema = Joi.object({
  role: Joi.string().valid(...allowedRoles).required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(7).max(30).required(),
  password: Joi.string().min(8).max(128).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required()
});

const forgotSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required()
});

async function register(req, res) {
  const { role, name, email, phone, password } = req.body;

  const exists = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (exists.length) throw fail(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const status = role === "customer" ? "active" : "pending";

  const rows = await query(
    "INSERT INTO users (role, status, name, email, phone, password_hash) VALUES (?,?,?,?,?,?)",
    [role, status, name, email, phone, passwordHash]
  );

  const userId = rows.insertId;

  await audit({
    actorId: userId,
    action: "USER_REGISTERED",
    entityType: "user",
    entityId: userId,
    meta: { role, status }
  });

  const token = status === "active" ? signToken({ userId, role }) : null;

  return created(res, {
    user: { id: userId, role, status, name, email, phone },
    token
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  const users = await query(
    "SELECT id, role, status, name, email, phone, password_hash, failed_login_attempts, locked_until FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  if (!users.length) throw fail(401, "Invalid email or password");

  const u = users[0];
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    throw fail(403, "Account temporarily locked due to repeated failed attempts");
  }

  const match = await bcrypt.compare(password, u.password_hash);
  if (!match) {
    const attempts = (u.failed_login_attempts || 0) + 1;
    let lockedUntil = null;
    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await query(
      "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
      [attempts >= 5 ? 0 : attempts, lockedUntil, u.id]
    );

    throw fail(401, "Invalid email or password");
  }

  if (u.status !== "active") throw fail(403, "Account not active (pending/blocked)");

  await query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", [u.id]);

  const token = signToken({ userId: u.id, role: u.role });

  await audit({
    actorId: u.id,
    action: "USER_LOGGED_IN",
    entityType: "user",
    entityId: u.id,
    meta: { sessionId: uuid() }
  });

  return ok(res, { token, user: { id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone } });
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  const users = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (!users.length) return ok(res, { message: "If the email exists, reset instructions were sent." });

  const token = uuid();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await query("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,?)", [
    users[0].id,
    token,
    expiresAt
  ]);

  await audit({ actorId: users[0].id, action: "PASSWORD_RESET_REQUESTED", entityType: "user", entityId: users[0].id });

  return ok(res, { message: "Reset token generated (demo).", token });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  const rows = await query(
    "SELECT pr.id, pr.user_id, pr.expires_at FROM password_resets pr WHERE pr.token = ? AND pr.used_at IS NULL LIMIT 1",
    [token]
  );
  if (!rows.length) throw fail(400, "Invalid or used reset token");
  if (new Date(rows[0].expires_at) < new Date()) throw fail(400, "Reset token expired");

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, rows[0].user_id]);
  await query("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [rows[0].id]);

  await audit({
    actorId: rows[0].user_id,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "user",
    entityId: rows[0].user_id
  });

  return ok(res, { message: "Password reset successful" });
}

module.exports = {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  register,
  login,
  forgotPassword,
  resetPassword
};
