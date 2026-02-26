const Joi = require("joi");
const { query } = require("../config/db");
const { ok, created, fail } = require("../utils/responses");
const { audit } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

const createSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(7).max(30).required(),
  message: Joi.string().min(5).max(2000).required()
});

const replySchema = Joi.object({
  message: Joi.string().min(1).max(2000).required()
});

function looksLikeSpam(msg) {
  const m = msg.toLowerCase();
  const bad = ["http://", "https://", "buy now", "free money", "click here"];
  return bad.some(x => m.includes(x));
}

async function create(req, res) {
  const propertyId = Number(req.params.id);
  const { name, email, phone, message } = req.body;

  if (looksLikeSpam(message)) throw fail(400, "Message blocked (suspected spam)");

  const props = await query(
    "SELECT id, owner_id, broker_id, title FROM properties WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [propertyId]
  );
  if (!props.length) throw fail(404, "Property not found");

  const p = props[0];
  const recipientId = p.broker_id || p.owner_id;
  if (!recipientId) throw fail(400, "This property has no assigned broker/owner to contact");

  const result = await query(
    `INSERT INTO inquiries (property_id, recipient_user_id, sender_user_id, sender_name, sender_email, sender_phone, message, status)
     VALUES (?,?,?,?,?,?,?,'open')`,
    [propertyId, recipientId, req.user?.id || null, name, email, phone, message]
  );

  const inquiryId = result.insertId;

  await audit({
    actorId: req.user?.id || null,
    action: "INQUIRY_CREATED",
    entityType: "inquiry",
    entityId: inquiryId,
    meta: { propertyId, recipientId }
  });

  await notify({
    userId: recipientId,
    type: "inquiry",
    title: "New property inquiry",
    message: `You received a new inquiry for "${p.title}".`,
    refType: "inquiry",
    refId: inquiryId
  });

  return created(res, { inquiryId, reference: `INQ-${new Date().getFullYear()}-${String(inquiryId).padStart(6, "0")}` });
}

async function listMine(req, res) {
  const u = req.user;

  let rows;
  if (u.role === "admin") {
    rows = await query(
      `SELECT i.id, i.property_id, i.sender_name, i.sender_email, i.sender_phone, i.status, i.created_at
       FROM inquiries i
       ORDER BY i.created_at DESC
       LIMIT 200`
    );
  } else {
    rows = await query(
      `SELECT i.id, i.property_id, i.sender_name, i.sender_email, i.sender_phone, i.status, i.created_at
       FROM inquiries i
       WHERE i.recipient_user_id = ?
       ORDER BY i.created_at DESC
       LIMIT 200`,
      [u.id]
    );
  }

  return ok(res, { inquiries: rows });
}

async function getOne(req, res) {
  const id = Number(req.params.id);
  const u = req.user;

  const rows = await query("SELECT i.* FROM inquiries i WHERE i.id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Inquiry not found");

  const inquiry = rows[0];
  if (u.role !== "admin" && inquiry.recipient_user_id !== u.id) {
    throw fail(403, "Forbidden");
  }

  const replies = await query(
    `SELECT r.id, r.inquiry_id, r.sender_user_id, r.message, r.created_at
     FROM inquiry_replies r
     WHERE r.inquiry_id = ?
     ORDER BY r.created_at ASC`,
    [id]
  );

  return ok(res, { inquiry, replies });
}

async function reply(req, res) {
  const id = Number(req.params.id);
  const u = req.user;

  const inquiryRows = await query("SELECT * FROM inquiries WHERE id = ? LIMIT 1", [id]);
  if (!inquiryRows.length) throw fail(404, "Inquiry not found");

  const inquiry = inquiryRows[0];
  if (u.role !== "admin" && inquiry.recipient_user_id !== u.id) throw fail(403, "Forbidden");

  const { message } = req.body;

  await query(
    "INSERT INTO inquiry_replies (inquiry_id, sender_user_id, message) VALUES (?,?,?)",
    [id, u.id, message]
  );

  await audit({ actorId: u.id, action: "INQUIRY_REPLIED", entityType: "inquiry", entityId: id });

  if (inquiry.sender_user_id) {
    await notify({
      userId: inquiry.sender_user_id,
      type: "message",
      title: "Reply to your inquiry",
      message: "You received a reply to your property inquiry.",
      refType: "inquiry",
      refId: id
    });
  }

  return ok(res, { replied: true });
}

module.exports = { createSchema, replySchema, create, listMine, getOne, reply };
