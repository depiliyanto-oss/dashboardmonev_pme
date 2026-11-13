(function () {
  "use strict";

  var MEMORY_CACHE = null;

  function config() {
    return window.PME_AUTH_CONFIG || {};
  }

  function sessionKey() {
    return config().sessionKey || "pme.auth.v1";
  }

  function loginPath() {
    return config().loginPath || "login.html";
  }

  function homePath() {
    return config().homePath || "index.html";
  }

  function usersFile() {
    return config().usersFile || "data/login.json";
  }

  function sessionHours() {
    var hours = Number(config().sessionHours);
    return hours > 0 ? hours : 8;
  }

  function makeError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function schemaError(message) {
    return makeError("schema", message);
  }

  function networkError(message) {
    return makeError("network", message);
  }

  function readSession() {
    var stores = [window.sessionStorage, window.localStorage];
    for (var i = 0; i < stores.length; i++) {
      var store = stores[i];
      try {
        var raw = store.getItem(sessionKey());
        if (!raw) continue;
        var session = JSON.parse(raw);
        if (!session || !session.exp || session.exp <= Date.now()) {
          store.removeItem(sessionKey());
          continue;
        }
        return session;
      } catch (error) {
        try {
          store.removeItem(sessionKey());
        } catch (ignored) {}
      }
    }
    return null;
  }

  function clearSession() {
    [window.sessionStorage, window.localStorage].forEach(function (store) {
      try {
        store.removeItem(sessionKey());
      } catch (ignored) {}
    });
  }

  function writeSession(user, remember) {
    var session = {
      id: user.id == null ? "" : String(user.id),
      name: user.name || "",
      email: user.email || "",
      exp: Date.now() + sessionHours() * 60 * 60 * 1000,
    };
    clearSession();
    try {
      (remember ? window.localStorage : window.sessionStorage).setItem(sessionKey(), JSON.stringify(session));
    } catch (error) {}
    return session;
  }

  function requireSession() {
    var session = readSession();
    if (session) return session;
    var next = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace(loginPath() + "?next=" + encodeURIComponent(next));
    return null;
  }

  function nextPath() {
    var next = "";
    try {
      next = new URLSearchParams(window.location.search).get("next") || "";
    } catch (error) {}
    if (!next) return homePath();
    try {
      var url = new URL(next, window.location.href);
      if (url.origin !== window.location.origin) return homePath();
      if (/\/login\.html$/i.test(url.pathname)) return homePath();
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return homePath();
    }
  }

  function normalizeHeader(value) {
    return String(value == null ? "" : value)
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function usersFromRows(rows) {
    if (!rows || !rows.length) return [];
    var headers = rows[0].map(normalizeHeader);
    var rowsBody = rows.slice(1);
    var labels = headers.filter(Boolean).length;
    if (labels < 2 && rowsBody.length) {
      headers = rowsBody.shift().map(normalizeHeader);
    }
    var index = {};
    headers.forEach(function (header, position) {
      if (header && index[header] == null) index[header] = position;
    });

    function has(aliases) {
      return aliases.some(function (alias) {
        return index[alias] != null;
      });
    }

    function get(row, aliases, trim) {
      for (var i = 0; i < aliases.length; i++) {
        var position = index[aliases[i]];
        if (position == null) continue;
        var value = row[position];
        if (value == null) continue;
        value = String(value);
        if (trim !== false) value = value.trim();
        if (value !== "") return value;
      }
      return "";
    }

    var hasIdentity = has(["email", "e_mail", "surel", "name", "nama", "nama_lengkap", "full_name"]);
    var hasSecret = has(["password", "kata_sandi", "sandi", "pass", "password_hash", "hash", "sha256"]);
    if (!hasIdentity || !hasSecret) {
      throw schemaError(
        'Kolom login tidak ditemukan. Pastikan tab "' +
          (config().sheetName || "login") +
          '" memiliki kolom id, name, email, dan password (atau password_hash + salt).'
      );
    }

    var users = [];
    rowsBody.forEach(function (row, rowIndex) {
      if (!row) return;
      var empty = row.every(function (cell) {
        return String(cell == null ? "" : cell).trim() === "";
      });
      if (empty) return;
      var email = get(row, ["email", "e_mail", "surel"]);
      var name = get(row, ["name", "nama", "nama_lengkap", "full_name"]);
      var id = get(row, ["id", "no", "nomor"]);
      var plain = get(row, ["password", "kata_sandi", "sandi", "pass"], false);
      var hash = get(row, ["password_hash", "hash"], false);
      var salt = get(row, ["salt", "password_salt"], false);
      var iterations = parseInt(get(row, ["iterations", "iteration", "iterasi"]), 10);
      var sha = get(row, ["sha256"], false);
      if (!email && !name) return;
      if (!plain && !hash && !sha) return;

      var user = { id: id || String(rowIndex + 1), name: name, email: email };
      if (plain && plain.indexOf("pbkdf2$") === 0) {
        var parts = plain.split("$");
        if (parts.length >= 4) {
          user.iterations = parseInt(parts[1], 10) || 210000;
          user.salt = parts[2] || "";
          user.passwordHash = parts[3] || "";
        }
      } else if (plain && plain.indexOf("sha256:") === 0) {
        user.sha256 = plain.slice(7);
      } else if (hash && hash.indexOf("pbkdf2$") === 0) {
        var hashParts = hash.split("$");
        if (hashParts.length >= 4) {
          user.iterations = parseInt(hashParts[1], 10) || 210000;
          user.salt = hashParts[2] || "";
          user.passwordHash = hashParts[3] || "";
        }
      } else if (hash) {
        user.passwordHash = hash;
        user.salt = salt;
        user.iterations = iterations > 0 ? iterations : 210000;
      } else if (sha) {
        user.sha256 = sha.indexOf("sha256:") === 0 ? sha.slice(7) : sha;
      } else {
        user.password = plain;
      }
      users.push(normalizeUser(user));
    });
    return users;
  }

  function normalizeUser(input) {
    var user = Object.assign({}, input);
    if (user.passwordHash && String(user.passwordHash).indexOf("pbkdf2$") === 0) {
      var parts = String(user.passwordHash).split("$");
      if (parts.length >= 4) {
        user.iterations = parseInt(parts[1], 10) || 210000;
        user.salt = parts[2] || user.salt || "";
        user.passwordHash = parts[3] || "";
      }
    }
    if (user.passwordHash) user.passwordHash = String(user.passwordHash).toLowerCase();
    if (user.sha256) user.sha256 = String(user.sha256).toLowerCase().replace(/^sha256:/, "");
    if (user.iterations) user.iterations = parseInt(user.iterations, 10) || 210000;
    if (user.passwordHash && !user.salt && /^[a-f0-9]{64}$/.test(user.passwordHash)) {
      user.sha256 = user.passwordHash;
      delete user.passwordHash;
    }
    return user;
  }

  function usersFromTable(table) {
    if (!table || !table.cols) throw schemaError("Format sheet login tidak dikenali.");
    var headers = table.cols.map(function (col) {
      return normalizeHeader(col.label || col.id || "");
    });
    var rows = (table.rows || []).map(function (row) {
      return (row.c || []).map(function (cell) {
        if (!cell) return "";
        if (cell.v != null) return String(cell.v);
        if (cell.f != null) return String(cell.f);
        return "";
      });
    });
    return usersFromRows([headers].concat(rows));
  }

  function sheetJsonpUrl() {
    var raw = String(config().sheetUrl || "").trim();
    if (!raw) return "";
    var match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
    if (!match) return "";
    var url =
      "https://docs.google.com/spreadsheets/d/" +
      match[1] +
      "/gviz/tq?sheet=" +
      encodeURIComponent(config().sheetName || "login");
    var gid = raw.match(/[#&?]gid=([0-9]+)/);
    if (gid) url += "&gid=" + gid[1];
    return url;
  }

  function loadSheetUsers() {
    var url = sheetJsonpUrl();
    if (!url) {
      return Promise.reject(
        schemaError(
          "URL sheet login belum valid. Tempel link Google Sheets berbentuk https://docs.google.com/spreadsheets/d/.../edit di js/auth-config.js."
        )
      );
    }
    return new Promise(function (resolve, reject) {
      var callback = "__pmeAuth" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      var script = document.createElement("script");
      var done = false;
      var timer = setTimeout(function () {
        finish();
        reject(networkError("Waktu memuat sheet login habis. Periksa koneksi dan izin akses sheet."));
      }, 15000);

      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          delete window[callback];
        } catch (error) {
          window[callback] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callback] = function (payload) {
        finish();
        try {
          if (!payload || payload.status !== "ok") {
            var detail =
              payload && payload.errors && payload.errors[0] && payload.errors[0].detailed_message;
            reject(schemaError("Google Sheet menolak permintaan" + (detail ? ": " + detail : ".")));
            return;
          }
          resolve(usersFromTable(payload.table));
        } catch (error) {
          reject(error);
        }
      };

      script.onerror = function () {
        finish();
        reject(networkError("Tidak dapat memuat sheet login. Pastikan sheet dibagikan publik."));
      };

      script.src =
        url +
        (url.indexOf("?") === -1 ? "?" : "&") +
        "tqx=responseHandler:" +
        encodeURIComponent(callback) +
        "&_=" +
        Date.now();
      document.head.appendChild(script);
    });
  }

  function loadLocalUsers() {
    return fetch(usersFile(), { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw networkError("Data akun lokal tidak ditemukan (" + usersFile() + ").");
      }
      return response.json();
    }).then(function (data) {
      var list = Array.isArray(data) ? data : data && data.users;
      if (!Array.isArray(list)) throw schemaError("Format data akun lokal tidak valid.");
      return list.map(normalizeUser);
    });
  }

  function loadUsers(force) {
    if (MEMORY_CACHE && !force) return Promise.resolve(MEMORY_CACHE);
    var fromSheet = !!sheetJsonpUrl();
    var task = fromSheet
      ? loadSheetUsers().catch(function (error) {
          if (config().allowLocalFallback === false || error.code === "schema") throw error;
          console.warn("[auth] Sheet login gagal dimuat, memakai akun lokal:", error.message);
          return loadLocalUsers();
        })
      : loadLocalUsers();

    return task.then(function (users) {
      var valid = (users || []).filter(function (user) {
        return user && (user.email || user.name) && (user.password || user.passwordHash || user.sha256);
      });
      if (!valid.length) {
        throw schemaError("Tidak ada akun yang valid pada sumber login.");
      }
      MEMORY_CACHE = valid;
      return valid;
    });
  }

  function toHex(buffer) {
    return Array.prototype.map
      .call(new Uint8Array(buffer), function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function subtle() {
    var value = window.crypto && window.crypto.subtle;
    if (!value) {
      throw networkError(
        "Browser tidak mendukung verifikasi password. Gunakan HTTPS atau akses melalui localhost."
      );
    }
    return value;
  }

  function sha256Hex(text) {
    return subtle()
      .digest("SHA-256", new TextEncoder().encode(text))
      .then(toHex);
  }

  function pbkdf2Hex(password, salt, iterations) {
    var encoder = new TextEncoder();
    return subtle()
      .importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"])
      .then(function (key) {
        return subtle().deriveBits(
          {
            name: "PBKDF2",
            salt: encoder.encode(salt || ""),
            iterations: iterations || 210000,
            hash: "SHA-256",
          },
          key,
          256
        );
      })
      .then(toHex);
  }

  function safeEqual(left, right) {
    left = String(left);
    right = String(right);
    if (left.length !== right.length) return false;
    var difference = 0;
    for (var i = 0; i < left.length; i++) {
      difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return difference === 0;
  }

  function findUser(users, identifier) {
    var needle = String(identifier || "").trim().toLowerCase();
    if (!needle) return null;
    var i;
    for (i = 0; i < users.length; i++) {
      if (users[i].email && users[i].email.toLowerCase() === needle) return users[i];
    }
    for (i = 0; i < users.length; i++) {
      if (users[i].name && users[i].name.toLowerCase() === needle) return users[i];
    }
    return null;
  }

  function verifyPassword(password, user) {
    if (!user || typeof password !== "string") return Promise.resolve(false);
    if (user.passwordHash && user.salt) {
      return pbkdf2Hex(password, user.salt, user.iterations).then(function (digest) {
        return safeEqual(digest, user.passwordHash);
      });
    }
    if (user.passwordHash && /^[a-f0-9]{64}$/.test(user.passwordHash)) {
      return sha256Hex(password).then(function (digest) {
        return safeEqual(digest, user.passwordHash);
      });
    }
    if (user.sha256) {
      return sha256Hex(password).then(function (digest) {
        return safeEqual(digest, user.sha256);
      });
    }
    if (typeof user.password === "string") {
      return Promise.resolve(safeEqual(password, user.password));
    }
    return Promise.resolve(false);
  }

  function logAuthEvent(event, session) {
    var endpoint = String((config().logEndpoint || "")).trim();
    if (!endpoint) return Promise.resolve();
    var payload = {
      event: event,
      token: String(config().logToken || ""),
      id: session && session.id != null ? String(session.id) : "",
      name: session && session.name ? String(session.name) : "",
      email: session && session.email ? String(session.email) : "",
      at: new Date().toISOString(),
    };
    var body = JSON.stringify(payload);
    try {
      if (typeof fetch === "function") {
        return fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: body,
        }).then(function () {}).catch(function () {});
      }
      if (navigator && typeof navigator.sendBeacon === "function") {
        var blob = new Blob([body], { type: "text/plain;charset=utf-8" });
        navigator.sendBeacon(endpoint, blob);
      }
    } catch (error) {}
    return Promise.resolve();
  }

  function login(identifier, password, remember) {
    return loadUsers().then(function (users) {
      var user = findUser(users, identifier);
      if (!user) return null;
      return verifyPassword(password, user).then(function (valid) {
        if (!valid) return null;
        return writeSession(user, !!remember);
      });
    });
  }

  function initials(value) {
    var parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var first = parts[0].charAt(0);
    var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  function initLoginPage() {
    var form = document.getElementById("loginForm");
    var emailInput = document.getElementById("loginEmail");
    var passwordInput = document.getElementById("loginPassword");
    var rememberInput = document.getElementById("rememberMe");
    var errorBox = document.getElementById("loginError");
    var submitButton = document.getElementById("loginSubmit");
    var submitLabel = submitButton && submitButton.querySelector(".login-submit-label");
    var toggleButton = document.getElementById("togglePassword");
    var quickButton = document.getElementById("btnQuickLogin");
    if (!form || !emailInput || !passwordInput) return;

    if (quickButton) {
      quickButton.addEventListener("click", function () {
        emailInput.value = "admin@pme.go.id";
        passwordInput.value = "admin123";
        if (rememberInput) rememberInput.checked = true;
        clearError();
        if (submitButton) submitButton.focus();
      });
    }

    if (readSession()) {
      window.location.replace(nextPath());
      return;
    }

    function showError(message) {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    function clearError() {
      if (!errorBox) return;
      errorBox.textContent = "";
      errorBox.hidden = true;
    }

    if (toggleButton) {
      toggleButton.addEventListener("click", function () {
        var show = passwordInput.type === "password";
        passwordInput.type = show ? "text" : "password";
        toggleButton.textContent = show ? "Sembunyikan" : "Lihat";
        toggleButton.setAttribute("aria-label", show ? "Sembunyikan password" : "Lihat password");
        toggleButton.setAttribute("aria-pressed", show ? "true" : "false");
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearError();
      var identifier = emailInput.value.trim();
      var password = passwordInput.value;
      if (!identifier) {
        showError("Email atau nama wajib diisi.");
        emailInput.focus();
        return;
      }
      if (!password) {
        showError("Password wajib diisi.");
        passwordInput.focus();
        return;
      }

      form.classList.add("is-loading");
      if (submitButton) submitButton.disabled = true;
      if (submitLabel) submitLabel.textContent = "Memeriksa...";

      login(identifier, password, rememberInput && rememberInput.checked)
        .then(function (session) {
          if (!session) {
            showError("Email atau password tidak sesuai.");
            passwordInput.value = "";
            passwordInput.focus();
            return;
          }
          return logAuthEvent("login", session).then(function () {
            window.location.replace(nextPath());
          });
        })
        .catch(function (error) {
          showError(
            error && error.message
              ? error.message
              : "Tidak dapat memuat data akun. Periksa koneksi lalu coba lagi."
          );
        })
        .then(function () {
          form.classList.remove("is-loading");
          if (submitButton) submitButton.disabled = false;
          if (submitLabel) submitLabel.textContent = "Masuk";
        });
    });
  }

  function initDashboardAuth() {
    var session = readSession();
    if (!session) {
      requireSession();
      return;
    }

    var box = document.getElementById("topbarUser");
    var displayName = session.name || session.email || "Pengguna";
    var displayEmail = session.email || "";
    var displayInitials = initials(session.name || session.email);
    var name = document.getElementById("userName");
    var email = document.getElementById("userEmail");
    var avatar = document.getElementById("userAvatar");
    var namePop = document.getElementById("userNamePop");
    var emailPop = document.getElementById("userEmailPop");
    var avatarPop = document.getElementById("userAvatarPop");
    var logout = document.getElementById("logoutBtn");

    if (box) box.hidden = false;
    var summary = box ? box.querySelector("summary") : null;
    if (summary) {
      summary.setAttribute("aria-label", "Menu akun " + displayName);
      summary.setAttribute("title", displayName);
    }
    if (name) name.textContent = displayName;
    if (email) email.textContent = displayEmail;
    if (avatar) avatar.textContent = displayInitials;
    if (namePop) namePop.textContent = displayName;
    if (emailPop) emailPop.textContent = displayEmail;
    if (avatarPop) avatarPop.textContent = displayInitials;

    if (logout) {
      logout.addEventListener("click", function () {
        var current = readSession();
        logAuthEvent("logout", current).then(function () {
          clearSession();
          window.location.replace(loginPath());
        });
      });
    }

    if (box) {
      document.addEventListener("click", function (event) {
        if (box.open && !box.contains(event.target)) box.open = false;
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") box.open = false;
      });
    }
  }

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  ready(function () {
    if (document.getElementById("loginForm")) {
      initLoginPage();
    } else if (document.getElementById("topbarUser")) {
      initDashboardAuth();
    }
  });

  window.PMEAuth = {
    login: login,
    logout: function () {
      var current = readSession();
      return logAuthEvent("logout", current).then(function () {
        clearSession();
        window.location.replace(loginPath());
      });
    },
    readSession: readSession,
    requireSession: requireSession,
    loadUsers: loadUsers,
    findUser: findUser,
    verifyPassword: verifyPassword,
    usersFromTable: usersFromTable,
    config: config,
    resetCache: function () {
      MEMORY_CACHE = null;
    },
  };
})();
