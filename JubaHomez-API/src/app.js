const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");


const env = require("./config/env");
const routes = require("./routes");
const { errorMiddleware } = require("./middlewares/error.middleware");

const app = express();

/**
 * 1) Security + Logging
 */
app.use(helmet());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

/**
 * 2) CORS (important for GitHub Pages)
 * - Add your GitHub Pages URL to FRONTEND_URL in Render env vars
 * - Example: FRONTEND_URL=https://moggaenoch.github.io
 */
const allowedOrigins = [
  env.FRONTEND_URL, // production frontend (GitHub Pages / custom domain)
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (Postman/curl) with no origin
      if (!origin) return cb(null, true);

      // Allow if origin is in allowlist
      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false // set to true only if you use cookies/sessions across domains
  })
);

/**
 * 3) Body parsing
 */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * 4) Rate limiting (safe defaults if env is missing)
 */
app.use(
  rateLimit({
    windowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(env.RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false
  })
);

/**
 * 5) Static files (uploads)
 * Ensure you have an /uploads folder in your project root if you use this.
 */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/**
 * 6) Root route to avoid "Cannot GET /"
 */
app.get("/", (_req, res) => {
  res
    .status(200)
    .send("JubaHomez API is running ✅ Try /health or /api/v1");
});

/**
 * 7) Health check
 */
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    env: env.NODE_ENV || "unknown"
  });
});

/**
 * 8) API routes
 * Your routes should be mounted under /api/v1
 */
app.use("/api/v1", routes);

/**
 * 9) 404 handler (nice for debugging)
 */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl
  });
});

/**
 * 10) Error handler (your existing middleware)
 */
app.use(errorMiddleware);

module.exports = app;
