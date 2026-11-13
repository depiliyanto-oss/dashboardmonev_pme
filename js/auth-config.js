/* ==========================================================================
   Konfigurasi autentikasi Dashboard CARE-I
   --------------------------------------------------------------------------
   sheetUrl:
     Tempel URL Google Sheet yang memiliki tab "login", contoh:
     https://docs.google.com/spreadsheets/d/xxxxxxxxxxxxxxxx/edit#gid=0
     Sheet harus bisa diakses publik ("Siapa saja yang memiliki link").
     Biarkan kosong ("") untuk memakai data/login.json.

   Kolom yang didukung pada sheet:
     id, name (atau nama), email, password
     atau password_hash + salt + iterations, atau satu kolom password berisi
     string "pbkdf2$<iterations>$<salt>$<hash>" / "sha256:<hash>".

   Untuk membuat hash password:
     python scripts/hash_password.py "password-anda"
   ========================================================================== */

window.PME_AUTH_CONFIG = {
  sheetUrl: "https://docs.google.com/spreadsheets/d/1dmzjHShz84nrRlt5TEk-yakhsZ415rY68tSy7LL65iU/edit",
  sheetName: "login",
  usersFile: "data/login.json",
  sessionKey: "pme.auth.v1",
  sessionHours: 8,
  loginPath: "login.html",
  homePath: "index.html",
  allowLocalFallback: true,
  // URL Web App Google Apps Script untuk mencatat log_login / log_logout ke sheet "login"
  logEndpoint: "https://script.google.com/macros/s/AKfycbztg8xGqVybpJdzYbEOZb6bER7-lqRmxnFQ9z0-AiNEsXT-b1FgeBjqXG7GYfx6jseZjg/exec",
  // Token sederhana (harus sama dengan token di Apps Script) untuk proteksi dasar
  logToken: "Sukses58!@#gunakanlogic!EgoYES",
};
