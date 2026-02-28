// src/app.js
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
 * 2) CORS (GitHub Pages)
 */
const allowedOrigins = [
  env.FRONTEND_URL, // Render env var: https://moggaenoch.github.io
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow curl/postman
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// ✅ Preflight
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
 * 5) Static files (uploads) - optional
 */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/**
 * 6) Root + Health
 */
app.get("/", (_req, res) => res.status(200).send("JubaHomez API is running ✅"));
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

/**
 * 7) API routes
 */
app.use("/api/v1", routes);

/**
 * 8) 404 handler
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
 * 9) Error handler
 */
app.use(errorMiddleware);

module.exports = app;
