const Joi = require("joi");
const { query } = require("../config/db");
const { ok, fail } = require("../utils/responses");
const { audit } = require("../services/audit.service");

const updateMeSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().min(7).max(30).optional(),
  bio: Joi.string().max(500).optional(),
  avatar_url: Joi.string().uri().optional()
});

async function me(req, res) {
  return ok(res, { user: req.user });
}

async function updateMe(req, res) {
  const { name, phone, bio, avatar_url } = req.body;

  await query(
    "UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url) WHERE id = ?",
    [name || null, phone || null, bio || null, avatar_url || null, req.user.id]
  );

  await audit({ actorId: req.user.id, action: "PROFILE_UPDATED", entityType: "user", entityId: req.user.id });

  const rows = await query("SELECT id, role, status, name, email, phone, bio, avatar_url FROM users WHERE id = ?", [
    req.user.id
  ]);
  return ok(res, { user: rows[0] });
}

async function publicProfile(req, res) {
  const id = Number(req.params.id);
  const rows = await query(
    "SELECT id, role, name, bio, avatar_url FROM users WHERE id = ? AND status = 'active' LIMIT 1",
    [id]
  );
  if (!rows.length) throw fail(404, "User not found");
  return ok(res, { profile: rows[0] });
}

module.exports = { updateMeSchema, me, updateMe, publicProfile };
