const express = require("express");
const usersStore = require("../data/usersStore");
const ordersStore = require("../data/ordersStore");
const submissionsStore = require("../data/store");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const ORDER_STATUSES = new Set(["new", "in-progress", "done"]);

// Every route below requires a logged-in admin account.
router.use(requireAdmin);

/* GET /api/admin/stats — quick counts for the dashboard header --------- */
router.get("/stats", (req, res) => {
  const orders = ordersStore.readAll();
  const byStatus = { new: 0, "in-progress": 0, done: 0 };
  orders.forEach((o) => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  res.json({
    totalUsers: usersStore.readAll().length,
    totalOrders: orders.length,
    totalMessages: submissionsStore.readAll().length,
    byStatus
  });
});

/* GET /api/admin/orders — every service request, newest first --------- */
router.get("/orders", (req, res) => {
  const orders = ordersStore.readAll().slice().reverse();
  res.json({ orders });
});

/* PATCH /api/admin/orders/:id — update an order's status -------------- */
router.patch("/orders/:id", (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.has(status)) {
    return res.status(400).json({ error: "Status must be one of: new, in-progress, done." });
  }
  const updated = ordersStore.update(req.params.id, { status });
  if (!updated) return res.status(404).json({ error: "Request not found." });
  res.json({ ok: true, order: updated });
});

/* GET /api/admin/contacts — every contact form submission -------------- */
router.get("/contacts", (req, res) => {
  const submissions = submissionsStore.readAll().slice().reverse();
  res.json({ submissions });
});

/* GET /api/admin/users — every registered account (no password data) --- */
router.get("/users", (req, res) => {
  const users = usersStore
    .readAll()
    .slice()
    .reverse()
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role || "user", createdAt: u.createdAt }));
  res.json({ users });
});

module.exports = router;
