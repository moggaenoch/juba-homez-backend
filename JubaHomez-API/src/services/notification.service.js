const { query } = require("../config/db");

async function notify({ userId, type, title, message, refType, refId }) {
  await query(
    "INSERT INTO notifications (user_id, type, title, message, ref_type, ref_id) VALUES (?,?,?,?,?,?)",
    [userId, type, title || null, message || null, refType || null, refId || null]
  );
}

module.exports = { notify };
