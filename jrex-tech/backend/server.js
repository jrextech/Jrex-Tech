require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const contactRoute = require("./routes/contact");
const authRoute = require("./routes/auth");
const ordersRoute = require("./routes/orders");
const adminRoute = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

/* ---------------------------------------------------------
   Core middleware
   --------------------------------------------------------- */
app.use(express.json({ limit: "50kb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    methods: ["GET", "POST", "PATCH"]
  })
);

// Basic abuse protection on the contact endpoint: 10 submissions
// per 15 minutes per IP.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please try again later." }
});

// Tighter limit on auth attempts to slow down brute-forcing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});

/* ---------------------------------------------------------
   API routes
   --------------------------------------------------------- */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "jrex-tech-backend", time: new Date().toISOString() });
});

// Public, unauthenticated: safe to expose (it's the whole point of a
// "publishable" key). Never put PAYSTACK_SECRET_KEY here.
app.get("/api/public-config", (req, res) => {
  res.json({ paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null });
});

app.use("/api/contact", contactLimiter, contactRoute);
app.use("/api/auth", authLimiter, authRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/admin", adminRoute);

/* ---------------------------------------------------------
   Serve the static frontend (single-server deployment)
   --------------------------------------------------------- */
app.use(express.static(FRONTEND_DIR));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"), (err) => {
    if (err) next(err);
  });
});

/* ---------------------------------------------------------
   Error handling
   --------------------------------------------------------- */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`JREX Tech server running → http://localhost:${PORT}`);
});
