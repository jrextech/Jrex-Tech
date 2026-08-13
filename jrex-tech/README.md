# JREX Tech — Website

A full rebuild of the JREX Tech website: a redesigned frontend (14 pages)
plus a Node.js/Express backend with accounts, a "request a service"
system, a dedicated admin console with notifications and an accept/reject
workflow, card payments via Paystack, account settings, an FAQ, legal
pages, and a real embedded database — so visitors can sign up, tell you
what they need, get accepted and pay for it, and you can see and manage
all of it from one place.

```
jrex-tech/
├── frontend/                 Static site (HTML/CSS/JS)
│   ├── index.html            Home
│   ├── about.html            About
│   ├── services.html         All 9 services, each with "Request This Service"
│   ├── faq.html               Accordion FAQ + "still have a question?" mini-form
│   ├── contact.html          Contact, with a working form
│   ├── signup.html           Create an account
│   ├── login.html            Log in
│   ├── order.html            Request a service (requires login)
│   ├── dashboard.html        A logged-in user's requests, status, and Pay Now
│   ├── settings.html         Profile, password, and email notification preferences
│   ├── admin.html            Staff console: requests, messages, users, notifications
│   ├── terms.html            Terms of Service
│   ├── privacy.html          Privacy Policy
│   ├── refund.html           Refund Policy
│   ├── css/style.css         Design system + all page styles
│   ├── js/main.js            Nav toggle, scroll reveal, contact form logic
│   ├── js/auth.js            Session storage, auth-aware nav, authFetch() helper
│   └── images/               Existing site images (reused)
└── backend/                   Node/Express API
    ├── server.js              Entry point — serves the frontend + API
    ├── routes/contact.js      POST /api/contact — validates + stores + emails
    ├── routes/auth.js         Signup, login, profile update, change password
    ├── routes/orders.js       Requests + payment verification (customer-facing)
    ├── routes/admin.js        Accept/reject, status, messages, users (admin-only)
    ├── middleware/auth.js     JWT issuing + verification + requireAdmin
    ├── utils/mailer.js        Shared SMTP sender used by contact form + accept/reject emails
    ├── data/db.js             SQLite connection + schema (the actual database)
    ├── data/createStore.js    Reusable query wrapper over one SQLite table
    ├── data/store.js          Contact submissions table
    ├── data/usersStore.js     Registered accounts table
    ├── data/ordersStore.js    Service request table
    ├── data/jrex.sqlite3      The database file itself (created on first run)
    ├── scripts/migrate-json-to-sqlite.js   One-time import from the old JSON files
    ├── package.json
    └── .env.example           Copy to .env and fill in real values
```

## The services catalog

Services (`services.html`) and the request form (`order.html`) both reflect
the same nine categories, so the site's promise and the intake form match:

1. Web & Digital Development
2. Software Engineering
3. UI/UX & Product Design
4. Brand Identity & Creative Design
5. IT Infrastructure & Support
6. Digital Marketing & Growth
7. Data & Database Management
8. Cybersecurity Solutions
9. Technology Consulting

Every service card has a **"Request This Service"** link that jumps to
`order.html` with that category already selected — visitors don't have to
re-explain what they clicked on.

## Storage: SQLite, not flat JSON files

Earlier drafts stored submissions in plain `.json` files, which work but
are easy to corrupt with a crash mid-write and don't enforce any rules
about the data going in. This version uses **SQLite** instead
(`better-sqlite3`) — a real embedded database in a single file
(`backend/data/jrex.sqlite3`):

- **A real schema.** Each table (`users`, `orders`, `submissions`) has
  typed columns and `NOT NULL` constraints, so bad data gets rejected at
  the database layer, not just in the request handler.
- **Constraints enforced by the database itself.** Email addresses are
  `UNIQUE` on `users` — two accounts can't collide even under a race
  condition. Every order's `userId` is a real foreign key into `users`,
  enforced by SQLite (not just "hopefully matches").
- **WAL journaling.** The database survives a crash or power loss
  mid-write without corrupting — the file just replays its write-ahead
  log on next start.
- **Indexed lookups.** `orders.userId` and `users.email` are indexed, so
  "my requests" and "log in" queries stay fast as the table grows.
- **Still just one file.** No database server to run or manage — back it
  up by copying `backend/data/jrex.sqlite3`, same as you'd copy any file.

This was tested directly in this environment (Node's experimental
built-in SQLite module stood in for `better-sqlite3` during development,
since the same API and SQL apply) — inserts, the unique-email constraint,
the foreign-key constraint, updates, and durability across a reconnect
all behaved as expected. The shipped code uses `better-sqlite3` via npm
for broader host compatibility.

**If you already ran an earlier version of this site** with the old
`.json` files, nothing is lost — run `npm run migrate:json` once from
`backend/` and it imports any existing `users.json`, `orders.json`, and
`submissions.json` into the new database (safe to run more than once;
it skips rows that are already there).

## What this version adds (accounts & requests)

- **Accounts** — sign up / log in with email + password (bcrypt-hashed,
  JWT session tokens kept in the browser's `localStorage`).
- **Request a service** (`order.html`) — pick the service, a budget
  range, and describe the project. Guests are shown a log in / sign up
  prompt instead of the form.
- **Dashboard** (`dashboard.html`) — logged-in users see every request
  they've submitted with a status badge (New / In Progress / Completed).
- Nav bar adapts automatically: guests see **Log In / Sign Up**,
  logged-in users see **Dashboard / Log Out** — no page reload needed.

## What changed from the very first version

- Fixed broken markup, absolute image paths, an empty Services page,
  mismatched brand colors.
- Full visual redesign matching the logo's navy + steel-blue palette.
- Services rebuilt around the real 9-category catalog.
- Contact form: client-side validation, spam honeypot, real backend
  endpoint with optional email notification.
- Responsive nav, keyboard-accessible focus states, skip-to-content link,
  SEO meta tags, favicon.

## Running it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd backend
npm install
cp .env.example .env      # set a real JWT_SECRET; email settings are optional
npm start
```

Then open **http://localhost:4000** — the Express server serves the
`frontend` folder directly, so the whole site (pages, accounts, contact
form, service requests) runs from one command. The SQLite database file
is created automatically on first run.

> Note: this environment's sandbox has no internet access, so `npm install`
> and a full live run of the real `better-sqlite3` package couldn't be done
> here. Every file has been syntax-checked (`node --check`), and the
> database schema and query logic were functionally tested using Node's
> built-in SQLite module as a stand-in (see "Storage" above) — the two
> commands above will run normally on your machine.

### Frontend only (no backend)

You can open `frontend/index.html` directly, or serve it with any static
server (`npx serve frontend`). The static pages work, but sign up, log in,
the contact form, and service requests all need the backend running.

### Inspecting the database directly

`backend/data/jrex.sqlite3` is a normal SQLite file — open it with the
`sqlite3` CLI, [DB Browser for SQLite](https://sqlitebrowser.org/), or
any SQLite GUI to look at the data without going through the API:

```bash
sqlite3 backend/data/jrex.sqlite3 "SELECT * FROM orders;"
```

## Accounts, sessions & requests — how it fits together

- `POST /api/auth/signup` and `POST /api/auth/login` return a JWT
  (`token`) and the user's public profile. The frontend stores the token
  in `localStorage` (see `frontend/js/auth.js`) and attaches it as
  `Authorization: Bearer <token>` on every request that needs it, via the
  `JrexAuth.authFetch()` helper.
- `POST /api/orders` and `GET /api/orders` are protected by
  `middleware/auth.js` — `GET` only ever returns the logged-in user's own
  requests, matched by `userId`.
- **Set `JWT_SECRET` in `.env` to a long random string before deploying.**
  The fallback value in the code is for local development only and is
  not safe to use in production.
- Passwords are hashed with bcrypt before being stored — plaintext
  passwords are never written to disk.

## Contact form → email setup (optional)

By default, submissions are saved to the `submissions` table even without
any email configuration. To also get an email notification, fill in the
SMTP settings in `.env` (Gmail App Password, SendGrid, Mailgun, Zoho, etc.
all work) — see the comments in `.env.example`.

## Admin Console

`admin.html` is a dedicated staff console with its own top bar (Requests /
Messages / Users) — deliberately separate from the public site's nav, so
it doesn't feel like just another customer-facing page. Visible only to
accounts with the `admin` role.

- **Getting your first admin account**: set `ADMIN_EMAILS` in `.env` to
  your email (comma-separated if there's more than one person), e.g.
  `ADMIN_EMAILS=you@jrextech.com`. Then sign up (or log back in if you
  already have an account) with that email — the role is granted
  automatically, checked against the database on every request, not
  just trusted from old login tokens. Multiple people can each have
  their own admin account this way.
- **Notifications**: a red badge shows the count of new/unactioned
  requests right on the "Requests" tab, and a separate badge on
  "Messages" shows unread contact-form submissions — clears the moment
  you actually open that tab, the same way an inbox would. The browser
  tab title updates too (e.g. `(3) Admin Console`), so you'd notice even
  with the tab in the background.
- **Accept / Reject**: a brand-new request shows Accept and Reject
  buttons instead of a plain status dropdown. Accepting optionally lets
  you set a price (in ₦) right there; either action automatically emails
  the customer to let them know. Once accepted, the dropdown returns for
  moving it further along (In Progress → Completed).
- Everything under `/api/admin/*` is protected server-side by
  `requireAdmin` — a non-admin account gets a 403 even if they somehow
  load the page, they don't just get a hidden nav link.

## Card Payments (Paystack)

Once a request is accepted with a price attached, the customer sees a
"Pay ₦X Now" button on their own dashboard. Tapping it opens a Paystack
payment popup (card, bank transfer, or USSD) — Paystack is built for
Nigerian businesses and pays out to a Nigerian bank account.

- **Setup**: create a free account at [paystack.com](https://paystack.com),
  grab your API keys from Settings → API Keys & Webhooks, and put them in
  `.env` as `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY` — see the
  comments in `.env.example` for the full walkthrough, including using
  test keys first before going live.
- **Without these set**, the site still works fine — customers just see
  a "payments aren't set up yet, please contact us" message instead of a
  broken button, so there's no rush to configure this before launching.
- **How it stays honest**: the browser never decides whether a payment
  succeeded. After Paystack's popup closes, the backend independently
  asks Paystack to confirm the transaction, and cross-checks the amount
  paid against the amount you set when accepting the request — a
  tampered or fake "success" response from the browser can't mark an
  order as paid.
- The public key is safe to expose (that's what it's for); the secret
  key is only ever used server-side and must never be shared or
  committed.

## Account Settings

`settings.html` gives logged-in users real control over their account,
not just a placeholder page:

- **Profile** — update your display name (email stays fixed, since it's
  also the login).
- **Change Password** — requires the current password to confirm it's
  really you, then hashes the new one with bcrypt before saving.
- **Notifications** — a toggle for "email me about request status
  updates." Turning it off is respected server-side: `routes/admin.js`
  checks this preference before sending an accept/reject email, not just
  hidden in the UI.

## FAQ and Legal Pages

- `faq.html` — a real accordion of common questions (timelines, pricing,
  payments, support), plus a **"Still have a question?"** mini-form at
  the bottom that posts straight to the existing `/api/contact` endpoint
  — no separate backend needed for it.
- `terms.html`, `privacy.html`, `refund.html` — starting-point legal
  pages, linked from every page's footer. These are templates to adapt,
  not legal advice — worth having reviewed before you treat them as
  final, especially `privacy.html` regarding Nigeria's NDPR data
  protection requirements.

## Deploying — where to actually run this

You need somewhere that runs a persistent Node.js process (not a
static-only host) because of the login system and the SQLite database
file. A few solid, beginner-friendly options for a small business site
like this one:

- **[Render](https://render.com)** — probably the easiest starting
  point. Create a "Web Service" from your GitHub repo, set the build
  command to `npm install` and the start command to `npm start` (both
  inside `backend/`), add the environment variables from `.env.example`
  in the dashboard, and attach a small **persistent disk** mounted at
  `backend/data` so `jrex.sqlite3` survives restarts and redeploys. Has
  a free tier; paid tiers start cheap for a small site like this.
- **[Railway](https://railway.app)** — similar workflow to Render:
  connect the repo, set env vars, attach a persistent volume for
  `backend/data`. Usage-based pricing, generally a bit more affordable
  for a low-traffic site.
- **[Fly.io](https://fly.io)** — more control (and more setup), runs
  your app as a small VM close to your users, supports persistent
  volumes the same way. A good next step if you outgrow Render/Railway.
- **A basic VPS** (DigitalOcean, Linode, Hetzner) — full control, install
  Node yourself, run the app with a process manager like `pm2` so it
  restarts if it crashes or the server reboots. More setup, but nothing
  is hidden behind a platform's abstractions if something goes wrong.

Whichever you pick, the important part is the same: set every variable
from `.env.example` (especially `JWT_SECRET` and `ADMIN_EMAILS`) in that
host's dashboard, and make sure `backend/data/` is on **persistent**
storage — some hosts wipe the filesystem on every deploy unless you
explicitly attach a volume, which would delete the database.

- **Frontend-only alternative**: if you'd rather host the static site
  separately (Netlify, GitHub Pages, Vercel) and the API elsewhere, set
  `window.JREX_API_BASE = "https://your-api-domain.com"` in a small
  `<script>` tag before `js/auth.js` loads on every page.
- If you outgrow SQLite (multiple servers writing at once, very high
  traffic), swap the connection in `backend/data/db.js` for Postgres or
  MySQL. Every store built on `createStore()` exposes the same small API
  — `readAll`, `append`, `find`, `filter`, `update` — so the routes
  wouldn't need to change, just what's underneath them.

## Next steps worth considering

- Replace the placeholder phone/email/social links with the real ones.
- Add real project photos/case studies once available.
- Add a "forgot password" flow.
- Add a privacy policy page — accounts and requests are stored
  indefinitely right now, which matters if this collects data from EU
  visitors (GDPR).
- A custom domain + HTTPS (most hosts above provision free HTTPS
  certificates automatically once you point a domain at them).
