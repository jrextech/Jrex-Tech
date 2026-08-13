const express = require("express");
const bcrypt = require("bcryptjs");
const users = require("../data/usersStore");
const { requireAuth, signToken } = require("../middleware/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role || "user", createdAt: u.createdAt };
}

/**
 * Admin accounts are granted by email, via the ADMIN_EMAILS environment
 * variable (comma-separated). Checked on both signup and login so it
 * works whether someone signs up after you've added their email, or
 * already had an account before you did.
 */
function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function syncAdminRole(user) {
  const shouldBeAdmin = adminEmails().includes(user.email);
  const currentlyAdmin = user.role === "admin";
  if (shouldBeAdmin && !currentlyAdmin) {
    return users.update(user.id, { role: "admin" }) || user;
  }
  return user;
}

/* POST /api/auth/signup ------------------------------------------------ */
router.post("/signup", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (name.length < 2) return res.status(400).json({ error: "Please enter your full name." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

    if (users.find((u) => u.email === email)) {
      return res.status(409).json({ error: "An account with that email already exists. Try logging in instead." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      email,
      passwordHash,
      role: adminEmails().includes(email) ? "admin" : "user",
      createdAt: new Date().toISOString()
    };
    users.append(user);

    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong creating your account. Please try again." });
  }
});

/* POST /api/auth/login -------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    let user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    user = syncAdminRole(user);

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong logging you in. Please try again." });
  }
});

/* GET /api/auth/me — used by the frontend to check/restore a session ---- */
router.get("/me", requireAuth, (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });
  return res.json({ user: publicUser(user) });
});

module.exports = router;
