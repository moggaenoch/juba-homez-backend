const Joi = require("joi");
const { query } = require("../config/db");
const { ok, created, fail } = require("../utils/responses");
const { audit } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

const createJobSchema = Joi.object({
  notes: Joi.string().max(5000).optional(),
  preferredDates: Joi.array().items(Joi.string().min(5).max(40)).max(10).optional(),
  preferredPhotographerId: Joi.number().integer().optional()
});

const rejectSchema = Joi.object({
  reason: Joi.string().min(3).max(255).required()
});

const scheduleSchema = Joi.object({
  scheduledAt: Joi.date().required()
});

const messageSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required()
});

async function createJob(req, res) {
  const u = req.user;
  const propertyId = Number(req.params.propertyId);
  const { notes, preferredDates, preferredPhotographerId } = req.body;

  const props = await query(
    "SELECT id, title, owner_id, broker_id FROM properties WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [propertyId]
  );
  if (!props.length) throw fail(404, "Property not found");

  const p = props[0];
  if (u.role !== "admin") {
    const okOwner = u.role === "owner" && p.owner_id === u.id;
    const okBroker = u.role === "broker" && p.broker_id === u.id;
    if (!okOwner && !okBroker) throw fail(403, "Forbidden: not owner/broker of this property");
  }

  const result = await query(
    `INSERT INTO photo_jobs (property_id, requested_by, preferred_photographer_id, notes, preferred_dates_json, status)
     VALUES (?,?,?,?,?,'open')`,
    [
      propertyId,
      u.id,
      preferredPhotographerId || null,
      notes || null,
      preferredDates ? JSON.stringify(preferredDates) : null
    ]
  );

  const jobId = result.insertId;

  await audit({
    actorId: u.id,
    action: "PHOTO_JOB_CREATED",
    entityType: "photo_job",
    entityId: jobId,
    meta: { propertyId }
  });

  if (preferredPhotographerId) {
    await notify({
      userId: preferredPhotographerId,
      type: "photo_job",
      title: "Photography request",
      message: `You have a new preferred photography request for "${p.title}".`,
      refType: "photo_job",
      refId: jobId
    });
  }

  return created(res, { jobId, status: "open" });
}

async function listOpenJobs(req, res) {
  const u = req.user;

  if (u.role === "admin") {
    const rows = await query(
      `SELECT pj.id, pj.property_id, pj.status, pj.preferred_photographer_id, pj.created_at
       FROM photo_jobs pj
       WHERE pj.status = 'open'
       ORDER BY pj.created_at DESC
       LIMIT 300`
    );
    return ok(res, { jobs: rows });
  }

  const rows = await query(
    `SELECT pj.id, pj.property_id, pj.status, pj.preferred_photographer_id, pj.created_at
     FROM photo_jobs pj
     WHERE pj.status = 'open'
       AND (pj.preferred_photographer_id IS NULL OR pj.preferred_photographer_id = ?)
     ORDER BY pj.created_at DESC
     LIMIT 300`,
    [u.id]
  );

  return ok(res, { jobs: rows });
}

async function acceptJob(req, res) {
  const u = req.user;
  const id = Number(req.params.id);

  const rows = await query("SELECT * FROM photo_jobs WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Job not found");
  const job = rows[0];

  if (u.role !== "admin") {
    if (job.status !== "open") throw fail(400, "Job is not open");
    if (job.preferred_photographer_id && job.preferred_photographer_id !== u.id) {
      throw fail(403, "Forbidden: job is preferred for another photographer");
    }
  }

  await query("UPDATE photo_jobs SET photographer_id = ?, status = 'assigned' WHERE id = ?", [u.id, id]);

  await audit({ actorId: u.id, action: "PHOTO_JOB_ACCEPTED", entityType: "photo_job", entityId: id });

  await notify({
    userId: job.requested_by,
    type: "photo_job",
    title: "Photographer assigned",
    message: "A photographer accepted your job request.",
    refType: "photo_job",
    refId: id
  });

  return ok(res, { jobId: id, status: "assigned" });
}

async function rejectJob(req, res) {
  const u = req.user;
  const id = Number(req.params.id);
  const { reason } = req.body;

  const rows = await query("SELECT * FROM photo_jobs WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Job not found");
  const job = rows[0];

  if (u.role !== "admin") {
    if (job.status !== "open") throw fail(400, "Job is not open");
    if (job.preferred_photographer_id && job.preferred_photographer_id !== u.id) {
      throw fail(403, "Forbidden");
    }
  }

  await query("UPDATE photo_jobs SET status = 'rejected', reject_reason = ? WHERE id = ?", [reason, id]);

  await audit({ actorId: u.id, action: "PHOTO_JOB_REJECTED", entityType: "photo_job", entityId: id, meta: { reason } });

  await notify({
    userId: job.requested_by,
    type: "photo_job",
    title: "Photography request rejected",
    message: `Photographer rejected the job: ${reason}`,
    refType: "photo_job",
    refId: id
  });

  return ok(res, { jobId: id, status: "rejected" });
}

async function scheduleJob(req, res) {
  const u = req.user;
  const id = Number(req.params.id);
  const { scheduledAt } = req.body;

  const rows = await query("SELECT * FROM photo_jobs WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Job not found");
  const job = rows[0];

  if (u.role !== "admin" && job.photographer_id !== u.id) throw fail(403, "Forbidden");
  if (!["assigned", "scheduled"].includes(job.status)) throw fail(400, "Job must be assigned first");

  await query("UPDATE photo_jobs SET scheduled_at = ?, status = 'scheduled' WHERE id = ?", [new Date(scheduledAt), id]);

  await audit({ actorId: u.id, action: "PHOTO_JOB_SCHEDULED", entityType: "photo_job", entityId: id, meta: { scheduledAt } });

  await notify({
    userId: job.requested_by,
    type: "photo_job",
    title: "Session scheduled",
    message: "Your photography session has been scheduled.",
    refType: "photo_job",
    refId: id
  });

  return ok(res, { jobId: id, status: "scheduled", scheduledAt });
}

async function completeJob(req, res) {
  const u = req.user;
  const id = Number(req.params.id);

  const rows = await query("SELECT * FROM photo_jobs WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Job not found");
  const job = rows[0];

  if (u.role !== "admin" && job.photographer_id !== u.id) throw fail(403, "Forbidden");
  if (job.status !== "scheduled") throw fail(400, "Job must be scheduled to complete");

  await query("UPDATE photo_jobs SET status = 'completed' WHERE id = ?", [id]);

  await audit({ actorId: u.id, action: "PHOTO_JOB_COMPLETED", entityType: "photo_job", entityId: id });

  await notify({
    userId: job.requested_by,
    type: "photo_job",
    title: "Job completed",
    message: "Photography job marked as completed.",
    refType: "photo_job",
    refId: id
  });

  return ok(res, { jobId: id, status: "completed" });
}

async function canAccessJob(user, job) {
  if (user.role === "admin") return true;
  if (user.role === "photographer" && job.photographer_id === user.id) return true;
  if ((user.role === "broker" || user.role === "owner") && job.requested_by === user.id) return true;
  return false;
}

async function sendMessage(req, res) {
  const u = req.user;
  const id = Number(req.params.id);
  const { message } = req.body;

  const rows = await query("SELECT * FROM photo_jobs WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Job not found");
  const job = rows[0];

  if (!(await canAccessJob(u, job))) throw fail(403, "Forbidden");

  await query("INSERT INTO photo_job_messages (job_id, sender_user_id, message) VALUES (?,?,?)", [id, u.id, message]);

  await audit({ actorId: u.id, action: "PHOTO_JOB_MESSAGE_SENT", entityType: "photo_job", entityId: id });

  const target = u.id === job.requested_by ? job.photographer_id : job.requested_by;
  if (target) {
    await notify({
      userId: target,
      type: "message",
      title: "New job message",
      message: "You received a new message on a photography job.",
      refType: "photo_job",
      refId: id
    });
  }

  return ok(res, { sent: true });
}

async function listMessages(req, res) {
  const u = req.user;
  const id = Number(req.params.id);

  const rows = await query("SELECT * FROM photo_jobs WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw fail(404, "Job not found");
  const job = rows[0];

  if (!(await canAccessJob(u, job))) throw fail(403, "Forbidden");

  const msgs = await query(
    `SELECT m.id, m.sender_user_id, m.message, m.created_at
     FROM photo_job_messages m
     WHERE m.job_id = ?
     ORDER BY m.created_at ASC`,
    [id]
  );

  return ok(res, { messages: msgs });
}

module.exports = {
  createJobSchema,
  rejectSchema,
  scheduleSchema,
  messageSchema,
  createJob,
  listOpenJobs,
  acceptJob,
  rejectJob,
  scheduleJob,
  completeJob,
  sendMessage,
  listMessages
};
