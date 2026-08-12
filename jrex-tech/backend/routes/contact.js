const express = require("express");
const nodemailer = require("nodemailer");
const { createStore } = require("../data/store");

const router = express.Router();
const store = createStore("submissions.json");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Build a nodemailer transporter from environment variables.
 * Returns null if SMTP isn't configured — the route falls back to
 * storage-only mode in that case, so the form still works out of the box.
 */
function buildTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function validatePayload(body) {
  const errors = [];
  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();

  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (!EMAIL_RE.test(email)) errors.push("A valid email address is required.");
  if (subject.length < 3) errors.push("Subject must be at least 3 characters.");
  if (message.length < 10) errors.push("Message must be at least 10 characters.");
  if (name.length > 120 || subject.length > 200 || message.length > 5000) {
    errors.push("One or more fields exceed the allowed length.");
  }

  return { errors, clean: { name, email, subject, message } };
}

router.post("/", async (req, res) => {
  try {
    // Honeypot: real visitors never fill this hidden field in.
    if (req.body.company) {
      return res.status(200).json({ ok: true }); // silently pretend success to the bot
    }

    const { errors, clean } = validatePayload(req.body || {});
    if (errors.length) {
      return res.status(400).json({ error: errors[0], details: errors });
    }

    const submission = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      ...clean,
      submittedAt: new Date().toISOString(),
      ip: req.ip
    };

    store.append(submission);

    const transporter = buildTransporter();
    if (transporter && process.env.CONTACT_TO_EMAIL) {
      transporter
        .sendMail({
          from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
          to: process.env.CONTACT_TO_EMAIL,
          replyTo: clean.email,
          subject: `[JREX Tech website] ${clean.subject}`,
          text: `From: ${clean.name} <${clean.email}>\n\n${clean.message}`
        })
        .catch((err) => console.error("Email send failed (submission was still saved):", err.message));
    }

    return res.status(201).json({ ok: true, message: "Message received." });
  } catch (err) {
    console.error("Contact route error:", err);
    return res.status(500).json({ error: "Something went wrong on our end. Please try again shortly." });
  }
});

module.exports = router;
