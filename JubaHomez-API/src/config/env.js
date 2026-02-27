const dotenv = require("dotenv");
dotenv.config();

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5000),

  // ✅ add this for CORS
  FRONTEND_URL: process.env.FRONTEND_URL || "https://moggaenoch.github.io",

  DB_HOST: must("DB_HOST"),
  DB_USER: must("DB_USER"),
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: must("DB_NAME"),
  DB_PORT: Number(process.env.DB_PORT || 3306),

  JWT_SECRET: must("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX || 120),
};

