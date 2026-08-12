const express = require("express");
const orders = require("../data/ordersStore");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const PROJECT_TYPES = new Set([
  "web-digital-development",
  "software-engineering",
  "ui-ux-design",
  "brand-identity",
  "it-infrastructure-support",
  "digital-marketing-growth",
  "data-database-management",
  "cybersecurity-solutions",
  "technology-consulting",
  "not-sure"
]);

const BUDGET_RANGES = new Set([
  "under-100k",
  "100k-300k",
  "300k-700k",
  "700k-plus",
  "not-sure"
]);

function validateOrder(body) {
  const errors = [];
  const projectType = body.projectType || "";
  const budget = body.budget || "";
  const pagesNeeded = (body.pagesNeeded || "").trim();
  const description = (body.description || "").trim();
  const timeline = (body.timeline || "").trim();

  if (!PROJECT_TYPES.has(projectType)) errors.push("Please choose the kind of website you want.");
  if (!BUDGET_RANGES.has(budget)) errors.push("Please choose a budget range.");
  if (description.length < 15) errors.push("Please describe your project in a bit more detail (15+ characters).");
  if (description.length > 4000) errors.push("Description is too long.");

  return { errors, clean: { projectType, budget, pagesNeeded, description, timeline } };
}

/* POST /api/orders — submit a new website request (must be logged in) */
router.post("/", requireAuth, (req, res) => {
  const { errors, clean } = validateOrder(req.body || {});
  if (errors.length) {
    return res.status(400).json({ error: errors[0], details: errors });
  }

  const order = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    status: "new",
    ...clean,
    createdAt: new Date().toISOString()
  };

  orders.append(order);
  return res.status(201).json({ ok: true, order });
});

/* GET /api/orders — the logged-in user's own requests only */
router.get("/", requireAuth, (req, res) => {
  const mine = orders.filter((o) => o.userId === req.user.id);
  return res.json({ orders: mine });
});

module.exports = router;
