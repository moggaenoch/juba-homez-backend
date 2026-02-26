const path = require("path");
const sharp = require("sharp");
const { query } = require("../config/db");
const { ok, created, fail } = require("../utils/responses");
const { audit } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

function fileUrl(filename) {
  return `/uploads/${filename}`;
}

async function listPropertyMediaPublic(req, res) {
  const propertyId = Number(req.params.id);
  const rows = await query(
    `SELECT id, kind, url, thumb_url, created_at
     FROM media
     WHERE property_id = ?
       AND deleted_at IS NULL
       AND approval_status = 'approved'
     ORDER BY created_at DESC`,
    [propertyId]
  );
  return ok(res, { media: rows });
}

async function uploadPropertyMedia(req, res) {
  const u = req.user;
  const propertyId = Number(req.params.id);

  const props = await query(
    "SELECT id, title, owner_id, broker_id FROM properties WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [propertyId]
  );
  if (!props.length) throw fail(404, "Property not found");

  if (!req.files || !req.files.length) throw fail(400, "No files uploaded");

  const p = props[0];
  if (u.role !== "admin") {
    const okOwner = u.role === "owner" && p.owner_id === u.id;
    const okBroker = u.role === "broker" && p.broker_id === u.id;
    const okPhotog = u.role === "photographer";
    if (!okOwner && !okBroker && !okPhotog) throw fail(403, "Forbidden");
  }

  const inserted = [];
  for (const f of req.files) {
    const isImage = f.mimetype.startsWith("image/");
    const isVideo = f.mimetype.startsWith("video/");
    const kind = isImage ? "photo" : isVideo ? "video" : null;
    if (!kind) continue;

    let thumbUrl = null;
    if (isImage) {
      const thumbName = `thumb-${path.parse(f.filename).name}.jpg`;
      const thumbPath = path.join(process.cwd(), "uploads", thumbName);

      await sharp(f.path)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toFile(thumbPath);

      thumbUrl = fileUrl(thumbName);
    }

    const url = fileUrl(f.filename);

    const result = await query(
      `INSERT INTO media
       (property_id, uploaded_by, kind, url, thumb_url, mime_type, size_bytes, approval_status)
       VALUES (?,?,?,?,?,?,?,'pending')`,
      [propertyId, u.id, kind, url, thumbUrl, f.mimetype, f.size]
    );

    inserted.push({ id: result.insertId, kind, url, thumbUrl });

    await audit({
      actorId: u.id,
      action: "MEDIA_UPLOADED",
      entityType: "media",
      entityId: result.insertId,
      meta: { propertyId, kind, mime: f.mimetype, size: f.size }
    });
  }

  const admins = await query("SELECT id FROM users WHERE role='admin' AND status='active' LIMIT 50");
  for (const a of admins) {
    await notify({
      userId: a.id,
      type: "approval",
      title: "Media pending approval",
      message: `New media uploaded for "${p.title}" requires approval.`,
      refType: "property",
      refId: propertyId
    });
  }

  return created(res, { uploaded: inserted, approval_status: "pending" });
}

async function softDeleteMedia(req, res) {
  const u = req.user;
  const id = Number(req.params.id);

  const rows = await query(
    `SELECT m.id, m.property_id, p.owner_id, p.broker_id
     FROM media m
     JOIN properties p ON p.id = m.property_id
     WHERE m.id = ? AND m.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  if (!rows.length) throw fail(404, "Media not found");

  const m = rows[0];
  if (u.role !== "admin") {
    const okOwner = u.role === "owner" && m.owner_id === u.id;
    const okBroker = u.role === "broker" && m.broker_id === u.id;
    if (!okOwner && !okBroker) throw fail(403, "Forbidden");
  }

  await query("UPDATE media SET deleted_at = NOW() WHERE id = ?", [id]);

  await audit({ actorId: u.id, action: "MEDIA_DELETED", entityType: "media", entityId: id });

  return ok(res, { mediaId: id, deleted: true });
}

module.exports = { listPropertyMediaPublic, uploadPropertyMedia, softDeleteMedia };
