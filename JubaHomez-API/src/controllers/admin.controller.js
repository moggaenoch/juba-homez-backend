const Joi = require("joi");
const { query } = require("../config/db");
const { ok, fail, created } = require("../utils/responses");
const { audit } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

const rejectSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required()
});

const announcementSchema = Joi.object({
  title: Joi.string().min(3).max(120).required(),
  message: Joi.string().min(5).max(3000).required(),
  audience: Joi.array()
    .items(Joi.string().valid("all", "customer", "broker", "owner", "photographer"))
    .min(1)
    .required(),
  expiresAt: Joi.date().optional()
});

async function listUsers(req, res) {
  const { status, role } = req.query;
  const where = ["1=1"];
  const params = [];
  if (status) { where.push("status = ?"); params.push(status); }
  if (role) { where.push("role = ?"); params.push(role); }

  const rows = await query(
    `SELECT id, role, status, name, email, phone, created_at
     FROM users
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 300`,
    params
  );
  return ok(res, { users: rows });
}

async function approveUser(req, res) {
  const id = Number(req.params.id);
  const rows = await query("SELECT id, role, status FROM users WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "User not found");
  await query("UPDATE users SET status = 'active' WHERE id = ?", [id]);

  await audit({ actorId: req.user.id, action: "USER_APPROVED", entityType: "user", entityId: id });
  await notify({ userId: id, type: "approval", title: "Account approved", message: "Your account has been approved." });

  return ok(res, { userId: id, status: "active" });
}

async function rejectUser(req, res) {
  const id = Number(req.params.id);
  const { reason } = req.body;

  const rows = await query("SELECT id FROM users WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "User not found");

  await query("UPDATE users SET status = 'rejected' WHERE id = ?", [id]);

  await audit({ actorId: req.user.id, action: "USER_REJECTED", entityType: "user", entityId: id, meta: { reason } });
  await notify({ userId: id, type: "approval", title: "Account rejected", message: `Rejected: ${reason}` });

  return ok(res, { userId: id, status: "rejected" });
}

async function listProperties(req, res) {
  const { approval_status } = req.query;
  const where = ["p.deleted_at IS NULL"];
  const params = [];
  if (approval_status) { where.push("p.approval_status = ?"); params.push(approval_status); }

  const rows = await query(
    `SELECT p.id, p.title, p.price, p.type, p.location, p.area, p.approval_status, p.created_at
     FROM properties p
     WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC
     LIMIT 300`,
    params
  );
  return ok(res, { properties: rows });
}

async function approveProperty(req, res) {
  const id = Number(req.params.id);

  const rows = await query("SELECT id, owner_id, broker_id, title FROM properties WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Property not found");

  await query("UPDATE properties SET approval_status = 'approved' WHERE id = ?", [id]);

  const ownerOrBroker = rows[0].broker_id || rows[0].owner_id;
  if (ownerOrBroker) {
    await notify({
      userId: ownerOrBroker,
      type: "approval",
      title: "Listing approved",
      message: `Your property "${rows[0].title}" has been approved.`,
      refType: "property",
      refId: id
    });
  }

  await audit({ actorId: req.user.id, action: "PROPERTY_APPROVED", entityType: "property", entityId: id });

  return ok(res, { propertyId: id, approval_status: "approved" });
}

async function rejectProperty(req, res) {
  const id = Number(req.params.id);
  const { reason } = req.body;

  const rows = await query("SELECT id, owner_id, broker_id, title FROM properties WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Property not found");

  await query("UPDATE properties SET approval_status = 'rejected' WHERE id = ?", [id]);

  const ownerOrBroker = rows[0].broker_id || rows[0].owner_id;
  if (ownerOrBroker) {
    await notify({
      userId: ownerOrBroker,
      type: "approval",
      title: "Listing rejected",
      message: `Your property "${rows[0].title}" was rejected: ${reason}`,
      refType: "property",
      refId: id
    });
  }

  await audit({ actorId: req.user.id, action: "PROPERTY_REJECTED", entityType: "property", entityId: id, meta: { reason } });

  return ok(res, { propertyId: id, approval_status: "rejected" });
}

async function listMedia(req, res) {
  const { status, propertyId } = req.query;
  const where = ["m.deleted_at IS NULL"];
  const params = [];

  if (status) { where.push("m.approval_status = ?"); params.push(status); }
  if (propertyId) { where.push("m.property_id = ?"); params.push(Number(propertyId)); }

  const rows = await query(
    `SELECT m.id, m.property_id, m.kind, m.url, m.thumb_url, m.mime_type, m.size_bytes,
            m.approval_status, m.uploaded_by, m.created_at
     FROM media m
     WHERE ${where.join(" AND ")}
     ORDER BY m.created_at DESC
     LIMIT 300`,
    params
  );

  return ok(res, { media: rows });
}

async function approveMedia(req, res) {
  const id = Number(req.params.id);

  const rows = await query(
    `SELECT m.id, m.property_id, m.uploaded_by, m.approval_status,
            p.title, p.owner_id, p.broker_id
     FROM media m
     JOIN properties p ON p.id = m.property_id
     WHERE m.id = ? AND m.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  if (!rows.length) throw fail(404, "Media not found");

  const m = rows[0];
  if (m.approval_status === "approved") return ok(res, { mediaId: id, approval_status: "approved" });

  await query("UPDATE media SET approval_status = 'approved' WHERE id = ?", [id]);

  await audit({
    actorId: req.user.id,
    action: "MEDIA_APPROVED",
    entityType: "media",
    entityId: id,
    meta: { propertyId: m.property_id }
  });

  const targets = new Set();
  if (m.uploaded_by) targets.add(m.uploaded_by);
  if (m.owner_id) targets.add(m.owner_id);
  if (m.broker_id) targets.add(m.broker_id);

  for (const userId of targets) {
    await notify({
      userId,
      type: "approval",
      title: "Media approved",
      message: `Media for "${m.title}" has been approved and is now visible.`,
      refType: "media",
      refId: id
    });
  }

  return ok(res, { mediaId: id, approval_status: "approved" });
}

async function rejectMedia(req, res) {
  const id = Number(req.params.id);
  const { reason } = req.body;

  const rows = await query(
    `SELECT m.id, m.property_id, m.uploaded_by, m.approval_status,
            p.title, p.owner_id, p.broker_id
     FROM media m
     JOIN properties p ON p.id = m.property_id
     WHERE m.id = ? AND m.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  if (!rows.length) throw fail(404, "Media not found");

  const m = rows[0];

  await query("UPDATE media SET approval_status = 'rejected' WHERE id = ?", [id]);

  await audit({
    actorId: req.user.id,
    action: "MEDIA_REJECTED",
    entityType: "media",
    entityId: id,
    meta: { propertyId: m.property_id, reason }
  });

  const targets = new Set();
  if (m.uploaded_by) targets.add(m.uploaded_by);
  if (m.owner_id) targets.add(m.owner_id);
  if (m.broker_id) targets.add(m.broker_id);

  for (const userId of targets) {
    await notify({
      userId,
      type: "approval",
      title: "Media rejected",
      message: `Media for "${m.title}" was rejected: ${reason}`,
      refType: "media",
      refId: id
    });
  }

  return ok(res, { mediaId: id, approval_status: "rejected" });
}

async function auditLogs(req, res) {
  const { actorId, action, from, to } = req.query;

  const where = ["1=1"];
  const params = [];

  if (actorId) { where.push("actor_id = ?"); params.push(Number(actorId)); }
  if (action) { where.push("action = ?"); params.push(action); }
  if (from) { where.push("created_at >= ?"); params.push(new Date(from)); }
  if (to) { where.push("created_at <= ?"); params.push(new Date(to)); }

  const rows = await query(
    `SELECT id, actor_id, action, entity_type, entity_id, meta_json, created_at
     FROM audit_logs
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 500`,
    params
  );

  return ok(res, { logs: rows });
}

async function createAnnouncement(req, res) {
  const { title, message, audience, expiresAt } = req.body;

  const result = await query(
    "INSERT INTO announcements (title, message, audience_json, expires_at, created_by) VALUES (?,?,?,?,?)",
    [title, message, JSON.stringify(audience), expiresAt || null, req.user.id]
  );

  await audit({
    actorId: req.user.id,
    action: "ANNOUNCEMENT_CREATED",
    entityType: "announcement",
    entityId: result.insertId
  });

  return created(res, { announcementId: result.insertId });
}

module.exports = {
  rejectSchema,
  announcementSchema,
  listUsers,
  approveUser,
  rejectUser,
  listProperties,
  approveProperty,
  rejectProperty,
  listMedia,
  approveMedia,
  rejectMedia,
  auditLogs,
  createAnnouncement
};
