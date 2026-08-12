const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "jrex.sqlite3");

const db = new Database(DB_PATH);

// WAL mode: readers don't block writers and vice versa, and it survives
// power loss / crashes without corrupting the file — the right default
// for a small always-on server, not just for high-traffic sites.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           TEXT PRIMARY KEY,
    userId       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    userName     TEXT NOT NULL,
    userEmail    TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'new',
    projectType  TEXT NOT NULL,
    budget       TEXT NOT NULL,
    pagesNeeded  TEXT,
    timeline     TEXT,
    description  TEXT NOT NULL,
    createdAt    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    subject      TEXT NOT NULL,
    message      TEXT NOT NULL,
    submittedAt  TEXT NOT NULL,
    ip           TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// Safe migration: add the "role" column if this database was created by an
// earlier version of the app that didn't have admin accounts yet.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes("role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

module.exports = db;
