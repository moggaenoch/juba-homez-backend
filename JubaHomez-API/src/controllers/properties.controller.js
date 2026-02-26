const Joi = require("joi");
const { query } = require("../config/db");
const { ok, created, fail } = require("../utils/responses");
const { audit } = require("../services/audit.service");

const createSchema = Joi.object({
  title: Joi.string().min(3).max(120).required(),
  description: Joi.string().min(10).max(5000).required(),
  price: Joi.number().integer().min(0).required(),
  type: Joi.string().valid("sale", "rent").required(),
  status: Joi.string().valid("available", "unavailable").default("available"),
  location: Joi.string().min(2).max(120).required(),
  area: Joi.string().min(2).max(120).required(),
  rooms: Joi.number().integer().min(0).required(),
  bathrooms: Joi.number().integer().min(0).default(0),
  size: Joi.number().integer().min(0).optional(),
  address: Joi.string().min(2).max(255).optional()
});

const updateSchema = Joi.object({
  title: Joi.string().min(3).max(120).optional(),
  description: Joi.string().min(10).max(5000).optional(),
  price: Joi.number().integer().min(0).optional(),
  type: Joi.string().valid("sale", "rent").optional(),
  location: Joi.string().min(2).max(120).optional(),
  area: Joi.string().min(2).max(120).optional(),
  rooms: Joi.number().integer().min(0).optional(),
  bathrooms: Joi.number().integer().min(0).optional(),
  size: Joi.number().integer().min(0).optional(),
  address: Joi.string().min(2).max(255).optional()
});

const statusSchema = Joi.object({
  status: Joi.string().valid("available", "unavailable").required()
});

async function listPublic(req, res) {
  const {
    location,
    area,
    rooms,
    type,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sort = "-created_at"
  } = req.query;

  const where = ["p.deleted_at IS NULL", "p.approval_status = 'approved'", "p.status = 'available'"];
  const params = [];

  if (location) {
    where.push("p.location LIKE ?");
    params.push(`%${location}%`);
  }
  if (area) {
    where.push("p.area = ?");
    params.push(area);
  }
  if (rooms) {
    where.push("p.rooms = ?");
    params.push(Number(rooms));
  }
  if (type) {
    where.push("p.type = ?");
    params.push(type);
  }
  if (minPrice) {
    where.push("p.price >= ?");
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    where.push("p.price <= ?");
    params.push(Number(maxPrice));
  }

  const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
  const sortDir = sort.startsWith("-") ? "DESC" : "ASC";
  const allowedSort = new Set(["created_at", "price"]);
  const safeSortField = allowedSort.has(sortField) ? sortField : "created_at";

  const offset = (Number(page) - 1) * Number(limit);

  const countRows = await query(
    `SELECT COUNT(*) as total
     FROM properties p
     WHERE ${where.join(" AND ")}`,
    params
  );
  const total = countRows[0]?.total || 0;

  const rows = await query(
    `SELECT p.id, p.title, p.price, p.type, p.location, p.area, p.rooms, p.bathrooms,
            p.created_at
     FROM properties p
     WHERE ${where.join(" AND ")}
     ORDER BY p.${safeSortField} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  return ok(res, rows, { page: Number(page), limit: Number(limit), total });
}

async function getOnePublic(req, res) {
  const id = Number(req.params.id);

  const rows = await query(
    `SELECT p.*
     FROM properties p
     WHERE p.id = ? AND p.deleted_at IS NULL AND p.approval_status = 'approved'`,
    [id]
  );
  if (!rows.length) throw fail(404, "Property not found");

  return ok(res, { property: rows[0] });
}

async function areas(_req, res) {
  const rows = await query(
    "SELECT DISTINCT area FROM properties WHERE deleted_at IS NULL ORDER BY area ASC"
  );
  return ok(res, { areas: rows.map(r => r.area) });
}

async function create(req, res) {
  const u = req.user;
  const body = req.body;

  const ownerId = u.role === "owner" ? u.id : null;
  const brokerId = u.role === "broker" ? u.id : null;

  const result = await query(
    `INSERT INTO properties
      (title, description, price, type, status, approval_status, location, area, rooms, bathrooms, size, address, owner_id, broker_id)
     VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?)`,
    [
      body.title,
      body.description,
      body.price,
      body.type,
      body.status,
      body.location,
      body.area,
      body.rooms,
      body.bathrooms,
      body.size || null,
      body.address || null,
      ownerId,
      brokerId
    ]
  );

  const propertyId = result.insertId;

  await audit({
    actorId: u.id,
    action: "PROPERTY_SUBMITTED",
    entityType: "property",
    entityId: propertyId,
    meta: { approval_status: "pending" }
  });

  return created(res, { propertyId, approval_status: "pending" });
}

async function update(req, res) {
  const id = Number(req.params.id);

  const fields = req.body;
  const keys = Object.keys(fields);
  if (!keys.length) throw fail(400, "No fields to update");

  const setSql = keys.map(k => `${k} = ?`).join(", ");
  const params = keys.map(k => fields[k]);

  await query(`UPDATE properties SET ${setSql} WHERE id = ?`, [...params, id]);

  await audit({ actorId: req.user.id, action: "PROPERTY_UPDATED", entityType: "property", entityId: id });

  const rows = await query("SELECT * FROM properties WHERE id = ? LIMIT 1", [id]);
  return ok(res, { property: rows[0] });
}

async function setStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  await query("UPDATE properties SET status = ? WHERE id = ?", [status, id]);

  await audit({
    actorId: req.user.id,
    action: "PROPERTY_STATUS_CHANGED",
    entityType: "property",
    entityId: id,
    meta: { status }
  });

  return ok(res, { propertyId: id, status });
}

async function softDelete(req, res) {
  const id = Number(req.params.id);

  await query("UPDATE properties SET deleted_at = NOW() WHERE id = ?", [id]);

  await audit({ actorId: req.user.id, action: "PROPERTY_DELETED", entityType: "property", entityId: id });

  return ok(res, { propertyId: id, deleted: true });
}

module.exports = {
  createSchema,
  updateSchema,
  statusSchema,
  listPublic,
  getOnePublic,
  areas,
  create,
  update,
  setStatus,
  softDelete
};
