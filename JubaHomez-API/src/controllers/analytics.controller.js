const Joi = require("joi");
const { query } = require("../config/db");
const { ok } = require("../utils/responses");
const { audit } = require("../services/audit.service");

const eventSchema = Joi.object({
  type: Joi.string().min(3).max(60).required(),
  propertyId: Joi.number().integer().optional(),
  sessionId: Joi.string().max(80).optional(),
  meta: Joi.object().optional()
});

async function trackEvent(req, res) {
  const { type, propertyId, sessionId, meta } = req.body;

  await query(
    "INSERT INTO analytics_events (type, property_id, user_id, session_id, meta_json) VALUES (?,?,?,?,?)",
    [type, propertyId || null, req.user?.id || null, sessionId || null, meta ? JSON.stringify(meta) : null]
  );

  if (req.user?.id) {
    await audit({
      actorId: req.user.id,
      action: "ANALYTICS_EVENT",
      entityType: "analytics_event",
      entityId: null,
      meta: { type, propertyId }
    });
  }

  return ok(res, { recorded: true });
}

async function propertyStats(req, res) {
  const propertyId = Number(req.params.id);
  const { from, to } = req.query;

  const params = [propertyId];
  let dateFilter = "";
  if (from) { dateFilter += " AND created_at >= ? "; params.push(new Date(from)); }
  if (to) { dateFilter += " AND created_at <= ? "; params.push(new Date(to)); }

  const views = await query(
    `SELECT COUNT(*) AS c
     FROM analytics_events
     WHERE property_id = ? AND type = 'PROPERTY_VIEW' ${dateFilter}`,
    params
  );

  const inquiries = await query(
    `SELECT COUNT(*) AS c
     FROM inquiries
     WHERE property_id = ? ${dateFilter}`,
    params
  );

  const viewings = await query(
    `SELECT COUNT(*) AS c
     FROM viewings
     WHERE property_id = ? ${dateFilter}`,
    params
  );

  return ok(res, {
    propertyId,
    metrics: {
      views: views[0].c,
      inquiries: inquiries[0].c,
      viewings: viewings[0].c
    }
  });
}

async function myPropertiesStats(req, res) {
  const u = req.user;
  const { from, to } = req.query;

  let ownerClause = "";
  const params = [];
  if (u.role === "owner") {
    ownerClause = "p.owner_id = ?";
    params.push(u.id);
  } else if (u.role === "broker") {
    ownerClause = "p.broker_id = ?";
    params.push(u.id);
  } else {
    ownerClause = "1=1";
  }

  const props = await query(
    `SELECT p.id, p.title
     FROM properties p
     WHERE p.deleted_at IS NULL AND ${ownerClause}
     ORDER BY p.created_at DESC
     LIMIT 500`,
    params
  );

  const out = [];
  for (const p of props) {
    const dateParams = [p.id];
    let dateFilter = "";
    if (from) { dateFilter += " AND created_at >= ? "; dateParams.push(new Date(from)); }
    if (to) { dateFilter += " AND created_at <= ? "; dateParams.push(new Date(to)); }

    const views = await query(
      `SELECT COUNT(*) AS c FROM analytics_events WHERE property_id = ? AND type='PROPERTY_VIEW' ${dateFilter}`,
      dateParams
    );
    const inquiries = await query(
      `SELECT COUNT(*) AS c FROM inquiries WHERE property_id = ? ${dateFilter}`,
      dateParams
    );
    const viewings = await query(
      `SELECT COUNT(*) AS c FROM viewings WHERE property_id = ? ${dateFilter}`,
      dateParams
    );

    out.push({
      propertyId: p.id,
      title: p.title,
      views: views[0].c,
      inquiries: inquiries[0].c,
      viewings: viewings[0].c
    });
  }

  return ok(res, { properties: out });
}

module.exports = { eventSchema, trackEvent, propertyStats, myPropertiesStats };
