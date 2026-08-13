const express = require("express");
const store = require("../data/store");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      ip: req.ip,
      read: 0
    };

    store.append(submission);

    if (process.env.CONTACT_TO_EMAIL) {
      sendMail({
        to: process.env.CONTACT_TO_EMAIL,
        replyTo: clean.email,
        subject: `[JREX Tech website] ${clean.subject}`,
        text: `From: ${clean.name} <${clean.email}>\n\n${clean.message}`
      });
    }

    return res.status(201).json({ ok: true, message: "Message received." });
  } catch (err) {
    console.error("Contact route error:", err);
    return res.status(500).json({ error: "Something went wrong on our end. Please try again shortly." });
  }
});

module.exports = router;
