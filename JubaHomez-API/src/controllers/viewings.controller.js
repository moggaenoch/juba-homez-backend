const Joi = require("joi");
const { query } = require("../config/db");
const { ok, created, fail } = require("../utils/responses");
const { audit } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

const createRequestSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(7).max(30).required(),
  preferredDates: Joi.array().items(Joi.string().min(5).max(40)).max(10).optional(),
  message: Joi.string().max(2000).optional(),

  // ✅ NEW: allow customer to choose broker vs owner (or explicit recipientUserId)
  recipientRole: Joi.string().valid("broker", "owner").optional(),
  recipientUserId: Joi.number().integer().optional()
});

const createViewingSchema = Joi.object({
  requestId: Joi.number().integer().required(),
  scheduledAt: Joi.date().required(),
  locationNote: Joi.string().max(255).optional(),
  agentNote: Joi.string().max(255).optional()
});

const rescheduleSchema = Joi.object({
  newScheduledAt: Joi.date().required(),
  reason: Joi.string().min(3).max(255).required()
});

const cancelSchema = Joi.object({
  reason: Joi.string().min(3).max(255).required()
});

async function createRequest(req, res) {
  const propertyId = Number(req.params.propertyId);
  const { name, email, phone, preferredDates, message, recipientRole, recipientUserId } = req.body;

  const props = await query(
    "SELECT id, title, owner_id, broker_id FROM properties WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [propertyId]
  );
  if (!props.length) throw fail(404, "Property not found");

  const p = props[0];

  const ownerId = p.owner_id ? Number(p.owner_id) : null;
  const brokerId = p.broker_id ? Number(p.broker_id) : null;

  // Default behavior: broker first, else owner
  let recipientId = brokerId || ownerId;
  if (!recipientId) throw fail(400, "No broker/owner assigned to this property");

  // ✅ If UI selected broker/owner specifically, enforce it
  if (recipientRole) {
    if (recipientRole === "broker") {
      if (!brokerId) throw fail(400, "This property has no broker assigned");
      recipientId = brokerId;
    } else if (recipientRole === "owner") {
      if (!ownerId) throw fail(400, "This property has no owner assigned");
      recipientId = ownerId;
    }
  }

  // ✅ If UI sent explicit recipientUserId, validate it matches property broker/owner
  if (recipientUserId) {
    const rid = Number(recipientUserId);
    const allowed = [brokerId, ownerId].filter(Boolean).map(Number);
    if (!allowed.includes(rid)) throw fail(400, "Invalid recipient for this property");
    recipientId = rid;
  }

  const result = await query(
    `INSERT INTO viewing_requests
     (property_id, recipient_user_id, requester_user_id, requester_name, requester_email, requester_phone, preferred_dates_json, message)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      propertyId,
      recipientId,
      req.user?.id || null,
      name,
      email,
      phone,
      preferredDates ? JSON.stringify(preferredDates) : null,
      message || null
    ]
  );

  const requestId = result.insertId;

  await audit({
    actorId: req.user?.id || null,
    action: "VIEWING_REQUEST_CREATED",
    entityType: "viewing_request",
    entityId: requestId,
    meta: {
      propertyId,
      recipientId,
      recipientRole: recipientRole || null,
      recipientUserId: recipientUserId || null
    }
  });

  // Notify the recipient (broker/owner)
  await notify({
    userId: recipientId,
    type: "viewing",
    title: "New viewing request",
    message: `New viewing request for "${p.title}".`,
    refType: "viewing_request",
    refId: requestId
  });

  // Optional: also notify the customer (if logged in)
  if (req.user?.id) {
    await notify({
      userId: req.user.id,
      type: "viewing",
      title: "Viewing request sent",
      message: `Your viewing request for "${p.title}" was sent.`,
      refType: "viewing_request",
      refId: requestId
    });
  }

  return created(res, {
    requestId,
    reference: `VR-${new Date().getFullYear()}-${String(requestId).padStart(6, "0")}`
  });
}

async function listRequestsMine(req, res) {
  const u = req.user;

  const where = [];
  const params = [];

  // ✅ NEW: show "my requests" for customers, otherwise show requests received (recipient)
  if (u.role !== "admin") {
    if (u.role === "customer") {
      where.push("vr.requester_user_id = ?");
      params.push(u.id);
    } else {
      where.push("vr.recipient_user_id = ?");
      params.push(u.id);
    }
  }

  if (req.query.status) {
    where.push("vr.status = ?");
    params.push(req.query.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query(
    `SELECT vr.id, vr.property_id, vr.requester_user_id, vr.recipient_user_id,
            vr.requester_name, vr.requester_email, vr.requester_phone,
            vr.status, vr.created_at
     FROM viewing_requests vr
     ${whereSql}
     ORDER BY vr.created_at DESC
     LIMIT 300`,
    params
  );

  return ok(res, { requests: rows });
}

async function createViewingFromRequest(req, res) {
  const u = req.user;
  const { requestId, scheduledAt, locationNote, agentNote } = req.body;

  const rows = await query("SELECT * FROM viewing_requests WHERE id = ? LIMIT 1", [requestId]);
  if (!rows.length) throw fail(404, "Viewing request not found");

  const vr = rows[0];
  if (u.role !== "admin" && vr.recipient_user_id !== u.id) throw fail(403, "Forbidden");
  if (vr.status !== "pending") throw fail(400, "Request is not pending");

  const result = await query(
    `INSERT INTO viewings
      (request_id, property_id, recipient_user_id, requester_user_id, scheduled_at, location_note, agent_note)
     VALUES (?,?,?,?,?,?,?)`,
    [
      vr.id,
      vr.property_id,
      vr.recipient_user_id,
      vr.requester_user_id,
      new Date(scheduledAt),
      locationNote || null,
      agentNote || null
    ]
  );

  const viewingId = result.insertId;

  await query("UPDATE viewing_requests SET status = 'accepted' WHERE id = ?", [vr.id]);

  await audit({
    actorId: u.id,
    action: "VIEWING_SCHEDULED",
    entityType: "viewing",
    entityId: viewingId,
    meta: { requestId: vr.id, propertyId: vr.property_id, scheduledAt }
  });

  // Notify customer
  if (vr.requester_user_id) {
    await notify({
      userId: vr.requester_user_id,
      type: "viewing",
      title: "Viewing scheduled",
      message: "Your viewing request has been scheduled.",
      refType: "viewing",
      refId: viewingId
    });
  }

  return created(res, { viewingId, status: "upcoming" });
}

async function listViewings(req, res) {
  const u = req.user;
  const { from, to, status } = req.query;

  const where = [];
  const params = [];

  // ✅ NEW: customers should see their own viewings by requester_user_id
  if (u.role !== "admin") {
    if (u.role === "customer") {
      where.push("v.requester_user_id = ?");
      params.push(u.id);
    } else {
      where.push("v.recipient_user_id = ?");
      params.push(u.id);
    }
  }

  if (from) {
    where.push("v.scheduled_at >= ?");
    params.push(new Date(from));
  }
  if (to) {
    where.push("v.scheduled_at <= ?");
    params.push(new Date(to));
  }
  if (status) {
    where.push("v.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query(
    `SELECT v.id, v.property_id, v.request_id, v.recipient_user_id, v.requester_user_id,
            v.scheduled_at, v.status, v.cancel_reason, v.created_at
     FROM viewings v
     ${whereSql}
     ORDER BY v.scheduled_at ASC
     LIMIT 500`,
    params
  );

  return ok(res, { viewings: rows });
}

async function reschedule(req, res) {
  const u = req.user;
  const id = Number(req.params.id);
  const { newScheduledAt, reason } = req.body;

  const rows = await query("SELECT * FROM viewings WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Viewing not found");

  const v = rows[0];

  // ✅ NEW: allow customer (requester) OR broker/owner (recipient) OR admin
  const canEdit =
    u.role === "admin" ||
    v.recipient_user_id === u.id ||
    (v.requester_user_id && v.requester_user_id === u.id);

  if (!canEdit) throw fail(403, "Forbidden");
  if (v.status !== "upcoming") throw fail(400, "Only upcoming viewings can be rescheduled");

  await query("UPDATE viewings SET scheduled_at = ? WHERE id = ?", [new Date(newScheduledAt), id]);

  await audit({
    actorId: u.id,
    action: "VIEWING_RESCHEDULED",
    entityType: "viewing",
    entityId: id,
    meta: { reason, newScheduledAt, byRole: u.role }
  });

  // Notify both sides (if they exist and are different)
  const recipients = new Set();
  if (v.requester_user_id) recipients.add(Number(v.requester_user_id));
  if (v.recipient_user_id) recipients.add(Number(v.recipient_user_id));

  for (const userId of recipients) {
    await notify({
      userId,
      type: "viewing",
      title: "Viewing rescheduled",
      message: "A viewing appointment has been rescheduled.",
      refType: "viewing",
      refId: id
    });
  }

  return ok(res, { viewingId: id, scheduledAt: newScheduledAt });
}

async function cancel(req, res) {
  const u = req.user;
  const id = Number(req.params.id);
  const { reason } = req.body;

  const rows = await query("SELECT * FROM viewings WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Viewing not found");

  const v = rows[0];

  // ✅ NEW: allow customer (requester) OR broker/owner (recipient) OR admin
  const canEdit =
    u.role === "admin" ||
    v.recipient_user_id === u.id ||
    (v.requester_user_id && v.requester_user_id === u.id);

  if (!canEdit) throw fail(403, "Forbidden");
  if (v.status !== "upcoming") throw fail(400, "Only upcoming viewings can be cancelled");

  await query("UPDATE viewings SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [reason, id]);

  await audit({
    actorId: u.id,
    action: "VIEWING_CANCELLED",
    entityType: "viewing",
    entityId: id,
    meta: { reason, byRole: u.role }
  });

  // Notify both sides (if they exist and are different)
  const recipients = new Set();
  if (v.requester_user_id) recipients.add(Number(v.requester_user_id));
  if (v.recipient_user_id) recipients.add(Number(v.recipient_user_id));

  for (const userId of recipients) {
    await notify({
      userId,
      type: "viewing",
      title: "Viewing cancelled",
      message: "A viewing appointment was cancelled.",
      refType: "viewing",
      refId: id
    });
  }

  return ok(res, { viewingId: id, cancelled: true });
}

module.exports = {
  createRequestSchema,
  createViewingSchema,
  rescheduleSchema,
  cancelSchema,
  createRequest,
  listRequestsMine,
  createViewingFromRequest,
  listViewings,
  reschedule,
  cancel
};
