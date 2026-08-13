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

/* POST /api/orders — submit a new service request (must be logged in) */
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
    amount: null,
    paymentStatus: "unpaid",
    paymentReference: null,
    paidAt: null,
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

/**
 * POST /api/orders/:id/verify-payment — confirms a card payment with
 * Paystack and marks the order as paid. The customer only ever pays for
 * their own accepted, priced request; the amount actually paid is
 * re-checked against Paystack's own record, not trusted from the client.
 */
router.post("/:id/verify-payment", requireAuth, async (req, res) => {
  const reference = (req.body && req.body.reference || "").trim();
  if (!reference) return res.status(400).json({ error: "Missing payment reference." });

  const order = orders.find((o) => o.id === req.params.id);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: "Request not found." });
  }
  if (order.status !== "accepted") {
    return res.status(400).json({ error: "This request hasn't been accepted yet, so it isn't ready for payment." });
  }
  if (!order.amount || order.amount <= 0) {
    return res.status(400).json({ error: "No amount has been set for this request yet." });
  }
  if (order.paymentStatus === "paid") {
    return res.json({ ok: true, order }); // already paid — treat as success, not an error
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return res.status(503).json({ error: "Payments aren't set up yet. Please contact us to arrange payment." });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const data = await response.json();

    const expectedKobo = Math.round(Number(order.amount) * 100);
    const paidOk =
      data &&
      data.status === true &&
      data.data &&
      data.data.status === "success" &&
      data.data.amount === expectedKobo &&
      data.data.currency === "NGN";

    if (!paidOk) {
      return res.status(400).json({ error: "We couldn't confirm this payment. If you were charged, please contact us." });
    }

    const updated = orders.update(order.id, {
      paymentStatus: "paid",
      paymentReference: reference,
      paidAt: new Date().toISOString()
    });

    return res.json({ ok: true, order: updated });
  } catch (err) {
    console.error("Payment verification error:", err);
    return res.status(502).json({ error: "Couldn't reach the payment provider. Please try again shortly." });
  }
});

module.exports = router;
