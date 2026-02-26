const { query } = require("../config/db");
const { ok, fail } = require("../utils/responses");

async function listMine(req, res) {
  const unread = req.query.unread === "true";
  const where = unread ? "AND n.read_at IS NULL" : "";
  const rows = await query(
    `SELECT n.id, n.type, n.title, n.message, n.ref_type, n.ref_id, n.read_at, n.created_at
     FROM notifications n
     WHERE n.user_id = ? ${where}
     ORDER BY n.created_at DESC
     LIMIT 200`,
    [req.user.id]
  );
  return ok(res, { notifications: rows });
}

async function markRead(req, res) {
  const id = Number(req.params.id);
  const rows = await query("SELECT id, user_id FROM notifications WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Notification not found");
  if (rows[0].user_id !== req.user.id) throw fail(403, "Forbidden");

  await query("UPDATE notifications SET read_at = NOW() WHERE id = ?", [id]);
  return ok(res, { read: true });
}

async function markAllRead(req, res) {
  await query("UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL", [req.user.id]);
  return ok(res, { readAll: true });
}

module.exports = { listMine, markRead, markAllRead };
