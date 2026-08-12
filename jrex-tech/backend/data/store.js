// Contact form submissions store (SQLite-backed — see db.js for schema).
const { createStore } = require("./createStore");
module.exports = createStore("submissions");
