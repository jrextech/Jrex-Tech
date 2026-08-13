const express = require("express");
const usersStore = require("../data/usersStore");
const ordersStore = require("../data/ordersStore");
const submissionsStore = require("../data/store");
const { requireAdmin } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

const ORDER_STATUSES = new Set(["new", "accepted", "rejected", "in-progress", "done"]);

const PROJECT_LABELS = {
  "web-digital-development": "Web & Digital Development",
  "software-engineering": "Software Engineering",
  "ui-ux-design": "UI/UX & Product Design",
  "brand-identity": "Brand Identity & Creative Design",
  "it-infrastructure-support": "IT Infrastructure & Support",
  "digital-marketing-growth": "Digital Marketing & Growth",
  "data-database-management": "Data & Database Management",
  "cybersecurity-solutions": "Cybersecurity Solutions",
  "technology-consulting": "Technology Consulting"
};

/** "your request for Web & Digital Development" / "your service request" if unspecified */
function describeService(projectType) {
  const label = PROJECT_LABELS[projectType];
  return label ? `your request for ${label}` : "your service request";
}

/** Only email a customer if they haven't turned off status-update emails in Settings. */
function emailIfSubscribed(userId, mailOptions) {
  const user = usersStore.find((u) => u.id === userId);
  if (user && user.emailNotifications === 0) return; // explicitly opted out
  sendMail(mailOptions);
}

// Every route below requires a logged-in admin account.
router.use(requireAdmin);

/* GET /api/admin/stats — quick counts for the dashboard header --------- */
router.get("/stats", (req, res) => {
  const orders = ordersStore.readAll();
  const byStatus = { new: 0, accepted: 0, rejected: 0, "in-progress": 0, done: 0 };
  orders.forEach((o) => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  const totalUnreadMessages = submissionsStore.filter((s) => !s.read).length;

  res.json({
    totalUsers: usersStore.readAll().length,
    totalOrders: orders.length,
    totalMessages: submissionsStore.readAll().length,
    totalUnreadMessages,
    byStatus
  });
});

/* GET /api/admin/orders — every service request, newest first --------- */
router.get("/orders", (req, res) => {
  const orders = ordersStore.readAll().slice().reverse();
  res.json({ orders });
});

/* PATCH /api/admin/orders/:id — manually set an order's status --------
   Used for later-stage moves (in-progress / done). Accepting or
   rejecting a *new* request should go through the dedicated routes
   below instead, since those also email the customer. */
router.patch("/orders/:id", (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.has(status)) {
    return res.status(400).json({ error: "Not a valid status." });
  }
  const updated = ordersStore.update(req.params.id, { status });
  if (!updated) return res.status(404).json({ error: "Request not found." });
  res.json({ ok: true, order: updated });
});

/* POST /api/admin/orders/:id/accept — accept a request, optionally
   attach a price, and email the customer to let them know. ----------- */
router.post("/orders/:id/accept", async (req, res) => {
  const order = ordersStore.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Request not found." });

  const patch = { status: "accepted" };

  if (req.body && req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== "") {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number." });
    }
    patch.amount = amount;
  }

  const updated = ordersStore.update(order.id, patch);

  const amountLine = patch.amount
    ? `\n\nAgreed amount: ₦${Number(patch.amount).toLocaleString("en-NG")}. You can pay securely from your dashboard once you're ready.`
    : "";
  emailIfSubscribed(order.userId, {
    to: order.userEmail,
    subject: "Your JREX Tech request has been accepted",
    text:
      `Hi ${order.userName},\n\nGood news — ${describeService(order.projectType)} has been accepted. ` +
      `Our team will be in touch shortly with next steps.${amountLine}\n\n— JREX Tech`
  });

  res.json({ ok: true, order: updated });
});

/* POST /api/admin/orders/:id/reject — decline a request and let the
   customer know, politely. ------------------------------------------- */
router.post("/orders/:id/reject", async (req, res) => {
  const order = ordersStore.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Request not found." });

  const updated = ordersStore.update(order.id, { status: "rejected" });

  emailIfSubscribed(order.userId, {
    to: order.userEmail,
    subject: "Update on your JREX Tech request",
    text:
      `Hi ${order.userName},\n\nThank you for your interest in ${describeService(order.projectType)}. ` +
      `We're not able to take this on at the moment, but we'd be glad to hear from you again in the future.\n\n— JREX Tech`
  });

  res.json({ ok: true, order: updated });
});

/* GET /api/admin/contacts — every contact form submission --------------
   Viewing the list marks everything in it as read, so the unread badge
   clears the same way an email inbox would. */
router.get("/contacts", (req, res) => {
  const submissions = submissionsStore.readAll();
  submissions.filter((s) => !s.read).forEach((s) => submissionsStore.update(s.id, { read: 1 }));
  res.json({ submissions: submissions.slice().reverse() });
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
