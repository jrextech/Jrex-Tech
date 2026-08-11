const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

/** Attaches req.user if a valid Bearer token is present; otherwise 401s. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Please log in to continue." });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

/**
 * Same as requireAuth, but also requires the account's role in the
 * database to be "admin". Checked against the database on every request
 * rather than trusted from the JWT, so revoking admin access takes effect
 * immediately instead of waiting for the token to expire.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    // requireAuth already sent a response if auth failed; guard against
    // continuing when headers are already sent.
    if (res.headersSent) return;

    const users = require("../data/usersStore"); // lazy require avoids a require cycle
    const record = users.find((u) => u.id === req.user.id);
    if (!record || record.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    req.user.role = record.role;
    next();
  });
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email },
    SECRET,
    { expiresIn: "7d" }
  );
}

/** Like requireAuth, but never blocks — just sets req.user if a valid token is present. */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  req.user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      req.user = { id: payload.sub, name: payload.name, email: payload.email };
    } catch {
      /* ignore invalid/expired token, treat as logged out */
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth, signToken, SECRET };
