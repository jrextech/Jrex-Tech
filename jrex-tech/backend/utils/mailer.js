const nodemailer = require("nodemailer");

/**
 * Builds a nodemailer transporter from environment variables.
 * Returns null if SMTP isn't configured — callers should treat that as
 * "skip sending, but don't fail the request", so the site keeps working
 * even before email is set up.
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

/**
 * Sends an email if SMTP is configured; silently no-ops (with a console
 * log) if it isn't, and never throws — a failed/unsent email should
 * never break the API request that triggered it.
 */
function sendMail({ to, subject, text, replyTo }) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.log(`[mailer] SMTP not configured — skipped email to ${to}: "${subject}"`);
    return Promise.resolve({ sent: false });
  }

  return transporter
    .sendMail({
      from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
      to,
      replyTo,
      subject,
      text
    })
    .then(() => ({ sent: true }))
    .catch((err) => {
      console.error("[mailer] Send failed:", err.message);
      return { sent: false, error: err.message };
    });
}

module.exports = { sendMail };
