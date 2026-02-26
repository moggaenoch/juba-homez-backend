function ok(res, data, meta) {
  return res.status(200).json(meta ? { data, meta } : { data });
}
function created(res, data) {
  return res.status(201).json({ data });
}
function fail(code, message, details) {
  const err = new Error(message);
  err.statusCode = code;
  err.details = details;
  return err;
}

module.exports = { ok, created, fail };
