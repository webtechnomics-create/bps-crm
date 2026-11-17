/**
 * One-time database setup for hosts without the Prisma CLI (e.g. cPanel Node.js App).
 *  - Creates all tables (runs prisma/migrations/* SQL) if they don't exist yet
 *  - Creates the first Super Admin (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD, or defaults)
 *  - SEED_DEMO=1 adds a few demo users (no demo leads)
 * Safe to run more than once.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

// Load .env next to this file if the host did not set the variables already.
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const exists = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."User"')::text AS t`);
  if (!exists[0].t) {
    const dir = path.join(__dirname, "migrations");
    for (const m of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "migration.sql"))).sort()) {
      const sql = fs.readFileSync(path.join(dir, m, "migration.sql"), "utf8");
      const statements = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
        .filter(Boolean);
      for (const s of statements) await prisma.$executeRawUnsafe(s);
      console.log(`Applied migration ${m} (${statements.length} statements)`);
    }
  } else {
    console.log("Tables already exist, skipping migrations.");
  }

  const email = (process.env.SUPERADMIN_EMAIL || "superadmin@bps.local").toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "ChangeMe@123";
  if (!(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.user.create({ data: { name: "Super Admin", email, role: "SUPER_ADMIN", autoAssign: false, passwordHash: await bcrypt.hash(password, 10) } });
    console.log(`Super Admin created: ${email} / ${password}  -> change this password after first login!`);
  } else console.log(`Super Admin already exists: ${email}`);

  if (process.env.SEED_DEMO === "1") {
    const pw = await bcrypt.hash("Demo@1234", 10);
    for (const [name, mail, role] of [["Admission Head", "admin@bps.local", "ADMIN"], ["Neha Sharma", "neha@bps.local", "COUNSELOR"], ["Rakesh Jain", "rakesh@bps.local", "COUNSELOR"]]) {
      await prisma.user.upsert({ where: { email: mail }, update: {}, create: { name, email: mail, role, passwordHash: pw, autoAssign: role === "COUNSELOR" } });
    }
    console.log("Demo users ready (password Demo@1234).");
  }
  console.log("Database setup complete.");
}

main()
  .catch((e) => {
    console.error("Setup failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
