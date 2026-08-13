const db = require("./db");

/**
 * A small ORM-style wrapper around one SQLite table, exposing the same
 * shape as the old JSON-file store (readAll/append/find/filter/update)
 * so nothing in routes/ had to change when storage moved to SQLite.
 *
 * Backed by a real embedded database now: proper schema and column
 * types, unique/foreign-key constraints enforced by SQLite itself,
 * indexed lookups, and WAL journaling so it survives a crash mid-write.
 * Still just one file on disk (backend/data/jrex.sqlite3) — back it up
 * by copying that file, no server process to manage.
 */
function createStore(tableName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);

  const selectAllStmt = db.prepare(`SELECT * FROM ${tableName}`);
  const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`);

  function readAll() {
    return selectAllStmt.all();
  }

  function append(record) {
    const cols = columns.filter((c) => record[c] !== undefined);
    const placeholders = cols.map((c) => `@${c}`).join(", ");
    const colList = cols.join(", ");
    db.prepare(`INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})`).run(record);
    return record;
  }

  function find(predicate) {
    return readAll().find(predicate);
  }

  function filter(predicate) {
    return readAll().filter(predicate);
  }

  function update(id, patch) {
    const cols = columns.filter((c) => c !== "id" && patch[c] !== undefined);
    if (!cols.length) return find((r) => r.id === id) || null;
    const setClause = cols.map((c) => `${c} = @${c}`).join(", ");
    const info = db
      .prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = @id`)
      .run({ ...patch, id });
    if (info.changes === 0) return null;
    return find((r) => r.id === id);
  }

  function remove(id) {
    const info = deleteStmt.run(id);
    return info.changes > 0;
  }

  return { readAll, append, find, filter, update, remove };
}

module.exports = { createStore };
