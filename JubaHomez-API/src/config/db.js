// src/config/db.js
const mysql = require("mysql2/promise");
const env = require("./env");

const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * ✅ IMPORTANT:
 * - returns ONLY rows for SELECT
 * - returns ResultSetHeader for INSERT/UPDATE (includes insertId)
 * - avoids using pool.query() directly (which returns [rows, fields])
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, query };
