/* =========================================================
   JREX TECH — auth helpers (shared across every page)
   ========================================================= */
window.JrexAuth = (function () {
  "use strict";

  var API_BASE = window.JREX_API_BASE || "";
  var TOKEN_KEY = "jrex_token";
  var USER_KEY = "jrex_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /** Merges new fields into the locally stored user (after a Settings save) without needing a fresh login. */
  function updateUser(patch) {
    var user = getUser() || {};
    var merged = Object.assign({}, user, patch);
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
    return merged;
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function isAdmin() {
    var user = getUser();
    return !!(user && user.role === "admin");
  }

  /** Wraps fetch with the Authorization header already set. */
  function authFetch(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {}, {
      Authorization: "Bearer " + getToken()
    });
    return fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
  }

  /** Shows/hides nav items based on login state, on every page. */
  function paintNav() {
    var loggedIn = isLoggedIn();
    var admin = isAdmin();
    var user = getUser();

    document.querySelectorAll('[data-auth="guest"]').forEach(function (el) {
      el.style.display = loggedIn ? "none" : "";
    });
    document.querySelectorAll('[data-auth="user"]').forEach(function (el) {
      el.style.display = loggedIn ? "" : "none";
    });
    document.querySelectorAll('[data-auth="admin"]').forEach(function (el) {
      el.style.display = admin ? "" : "none";
    });
    document.querySelectorAll("[data-auth-name]").forEach(function (el) {
      if (user) el.textContent = user.name.split(" ")[0];
    });

    document.querySelectorAll("[data-logout]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        clearSession();
        window.location.href = "index.html";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", paintNav);

  return {
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    updateUser: updateUser,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    authFetch: authFetch,
    API_BASE: API_BASE
  };
})();
