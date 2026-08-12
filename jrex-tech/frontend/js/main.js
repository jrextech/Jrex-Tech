/* =========================================================
   JREX TECH — site scripts
   ========================================================= */
(function () {
  "use strict";

  /* ---- Mobile nav toggle ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Contact form ---- */
  var form = document.getElementById("contact-form");
  if (!form) return;

  // Where the backend API lives. Same-origin by default (works once the
  // Express server in /backend serves this frontend). Override by setting
  // window.JREX_API_BASE before this script runs (e.g. in a <script> tag)
  // if the API is hosted on a different domain.
  var API_BASE = window.JREX_API_BASE || "";

  var statusBox = document.getElementById("form-status");
  var submitBtn = form.querySelector('button[type="submit"]');

  var fields = {
    name: { el: form.querySelector("#name"), validate: function (v) { return v.trim().length >= 2; }, msg: "Please enter your full name." },
    email: { el: form.querySelector("#email"), validate: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }, msg: "Please enter a valid email address." },
    subject: { el: form.querySelector("#subject"), validate: function (v) { return v.trim().length >= 3; }, msg: "Please enter a subject." },
    message: { el: form.querySelector("#message"), validate: function (v) { return v.trim().length >= 10; }, msg: "Please write a message (10+ characters)." }
  };

  function setFieldState(key, valid) {
    var wrap = fields[key].el.closest(".field");
    wrap.classList.toggle("invalid", !valid);
  }

  function validateAll() {
    var ok = true;
    Object.keys(fields).forEach(function (key) {
      var valid = fields[key].validate(fields[key].el.value);
      setFieldState(key, valid);
      if (!valid) ok = false;
    });
    return ok;
  }

  Object.keys(fields).forEach(function (key) {
    fields[key].el.addEventListener("blur", function () {
      setFieldState(key, fields[key].validate(fields[key].el.value));
    });
  });

  function showStatus(kind, message) {
    statusBox.textContent = message;
    statusBox.className = "form-status show " + kind;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusBox.className = "form-status";

    if (!validateAll()) {
      showStatus("err", "Please fix the highlighted fields and try again.");
      return;
    }

    var payload = {
      name: fields.name.el.value.trim(),
      email: fields.email.el.value.trim(),
      subject: fields.subject.el.value.trim(),
      message: fields.message.el.value.trim(),
      // honeypot — real users never fill this in
      company: form.querySelector('input[name="company"]').value
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    fetch(API_BASE + "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok) {
          showStatus("ok", "Thanks, " + payload.name.split(" ")[0] + "! Your message has been sent — we'll reply within one business day.");
          form.reset();
        } else {
          showStatus("err", (result.data && result.data.error) || "Something went wrong. Please try again or email us directly.");
        }
      })
      .catch(function () {
        showStatus("err", "We couldn't reach the server. Check your connection, or email info@jrextech.com directly.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      });
  });
})();
