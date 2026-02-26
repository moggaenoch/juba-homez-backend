function errorMiddleware(err, _req, res, _next) {
  const code = err.statusCode || 500;
  const payload = {
    error: {
      code,
      message: err.message || "Server error",
      ...(err.details ? { details: err.details } : {})
    }
  };
  res.status(code).json(payload);
}

module.exports = { errorMiddleware };
