/**
 * One-time migration: imports data from the old JSON-file store
 * (backend/data/users.json, orders.json, submissions.json) into the
 * new SQLite database, if those files still exist. Safe to run more
 * than once — it skips any row whose id is already in the database.
 *
 * Usage:  node scripts/migrate-json-to-sqlite.js
 */
const fs = require("fs");
const path = require("path");
const db = require("../data/db");

const DATA_DIR = path.join(__dirname, "..", "data");

function loadJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8") || "[]");
  } catch (err) {
    console.error(`Could not parse ${fileName}:`, err.message);
    return null;
  }
}

function importTable(tableName, fileName) {
  const rows = loadJson(fileName);
  if (!rows) {
    console.log(`- ${fileName} not found, nothing to migrate for "${tableName}".`);
    return;
  }

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  const existingIds = new Set(db.prepare(`SELECT id FROM ${tableName}`).all().map((r) => r.id));

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (existingIds.has(row.id)) {
      skipped++;
      continue;
    }
    const cols = columns.filter((c) => row[c] !== undefined);
    const placeholders = cols.map((c) => `@${c}`).join(", ");
    const colList = cols.join(", ");
    try {
      db.prepare(`INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})`).run(row);
      imported++;
    } catch (err) {
      console.error(`  Failed to import row ${row.id} into ${tableName}:`, err.message);
    }
  }

  console.log(`- ${fileName} → ${tableName}: imported ${imported}, skipped ${skipped} (already present).`);
}

console.log("Migrating legacy JSON data into SQLite (backend/data/jrex.sqlite3)...\n");
importTable("users", "users.json");
importTable("orders", "orders.json");
importTable("submissions", "submissions.json");
console.log("\nDone. The old .json files were left in place — safe to delete once you've verified the data.");
