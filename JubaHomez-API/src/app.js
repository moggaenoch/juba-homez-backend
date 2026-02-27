// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const env = require("./config/env");
const routes = require("./routes"); // this should export an Express Router
const { errorMiddleware } = require("./middlewares/error.middleware");

const app = express();

/**
 * 1) Security + Logging
 */
app.use(helmet());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

/**
 * 2) CORS (GitHub Pages)
 */
const allowedOrigins = [
  env.FRONTEND_URL, // set on Render: https://moggaenoch.github.io
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
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
    credentials: false,
  })
);

// ✅ IMPORTANT: handle preflight requests
app.options("*", cors());

/**
 * 3) Body parsing
 */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * 4) Rate limiting
 */
app.use(
  rateLimit({
    windowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(env.RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/**
 * 5) Static files (uploads) (optional)
 */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/**
 * 6) Root route
 */
app.get("/", (_req, res) => {
  res.status(200).send("JubaHomez API is running ✅ Try /health");
});

/**
 * 7) Health check
 */
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime(), env: env.NODE_ENV });
});

/**
 * 8) API routes
 * Your API base is /api/v1
 */
app.use("/api/v1", routes);

/**
 * 9) 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

/**
 * 10) Error handler
 */
app.use(errorMiddleware);

module.exports = app;
