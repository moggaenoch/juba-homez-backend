const { fail } = require("../utils/responses");
const { query } = require("../config/db");

function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(fail(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(fail(403, "Forbidden: insufficient role"));
    next();
  };
}

async function requirePropertyOwnershipOrRole(req, _res, next) {
  if (!req.user) return next(fail(401, "Authentication required"));
  if (req.user.role === "admin") return next();

  const propertyId = req.params.id;
  const rows = await query(
    "SELECT id, owner_id, broker_id FROM properties WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [propertyId]
  );
  if (!rows.length) return next(fail(404, "Property not found"));

  const p = rows[0];
  const isOwner = req.user.role === "owner" && p.owner_id === req.user.id;
  const isBroker = req.user.role === "broker" && p.broker_id === req.user.id;

  if (!isOwner && !isBroker) return next(fail(403, "Forbidden: not owner/broker of this property"));
  next();
}

module.exports = { requireRoles, requirePropertyOwnershipOrRole };
