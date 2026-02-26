const { query } = require("../config/db");

async function audit({ actorId, action, entityType, entityId, meta }) {
  await query(
    "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, meta_json) VALUES (?,?,?,?,?)",
    [actorId || null, action, entityType || null, entityId || null, meta ? JSON.stringify(meta) : null]
  );
}

module.exports = { audit };
