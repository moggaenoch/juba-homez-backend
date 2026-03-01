const bcrypt = require("bcryptjs");
const { pool, query } = require("../config/db");

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  const name = process.env.ADMIN_NAME || "System Admin";
  const phone = process.env.ADMIN_PHONE || "0000000000";

  if (!email || !password) {
    console.error("❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);

  if (existing.length) {
    const id = existing[0].id;
    await query(
      "UPDATE users SET role='admin', status='active', name=?, phone=?, password_hash=? WHERE id=?",
      [name, phone, passwordHash, id]
    );
    console.log(`✅ Updated existing user to admin (id=${id})`);
  } else {
    const result = await query(
      "INSERT INTO users (role, status, name, email, phone, password_hash) VALUES ('admin','active',?,?,?,?)",
      [name, email, phone, passwordHash]
    );
    console.log(`✅ Created admin user (id=${result.insertId})`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error("❌ seedAdmin failed:", e);
  process.exit(1);
});