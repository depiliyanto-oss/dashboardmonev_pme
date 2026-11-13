(function () {
  "use strict";

  let DATA = window.MONEV_DATA;

  if (!DATA) {
    const main = document.getElementById("main");
    if (main) {
      main.innerHTML =
        '<div class="card" style="margin-top:32px"><h3>Data tidak ditemukan</h3><p>Jalankan <code>python scripts/extract_data.py</code> untuk membuat <code>js/monev-data.js</code> dari <code>dashboard PME.xlsx</code>.</p></div>';
    }
    return;
  }

  const state = {
    filters: { satker: "ALL", component: "ALL", status: "ALL", search: "" },
    sort: { key: "no", dir: "asc" },
    dipaDetail: null,
    dipaP2Scope: "p2",
    charts: {},
    chartsRegistered: false,
  };

  let dataYear = String(DATA.metadata.fiscalYear || 2026);
  const YEAR_RANGE = (DATA.metadata && DATA.metadata.projectYears) || [2026, 2027, 2028];
  const YEAR_DATA = {};
  YEAR_DATA[dataYear] = DATA;
  if (DATA.metadata && DATA.metadata.years && typeof DATA.metadata.years === "object") {
    Object.keys(DATA.metadata.years).forEach(function (year) {
      YEAR_DATA[String(year)] = DATA.metadata.years[year];
    });
  }

  let componentById = {};
  let satkerByCode = {};

  function indexData() {
    componentById = Object.fromEntries(DATA.components.map((c) => [c.id, c]));
    satkerByCode = Object.fromEntries(DATA.satkers.map((s) => [s.code, s]));
  }

  indexData();

  const DIPA_GROUPS = [
    {
      id: "p2",
      name: "DIPA P2",
      members: ["CPMU CAREI", "Dit. SKK", "Dit. ISPA", "Dit Zoo"],
      klMembers: ["Kemenko PM", "Kemenko PMK", "Kemenhut", "Kementan", "BRIN"],
    },
    { id: "kesprimkom", name: "DIPA Kesprimkom", members: ["Takel PKP"] },
    { id: "sekjen", name: "DIPA Sekjen", members: ["Pusdatin"] },
  ];

  const STATUS_CLASS = {
    Tercapai: "badge-tercapai",
    Berprogres: "badge-berprogres",
    "Perlu Perhatian": "badge-perhatian",
    "Belum Realisasi": "badge-belum",
  };

  const nf = new Intl.NumberFormat("id-ID");

  /* ------------------------------------------------------------------------
     USD/IDR rate settings
     ---------------------------------------------------------------------- */

  const USD_IDR_RATE_KEY = "monev-carei-usd-idr-rate";
  const DEFAULT_USD_IDR_RATE = 16000;

  function getUsdIdrRate() {
    try {
      const raw = localStorage.getItem(USD_IDR_RATE_KEY);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_IDR_RATE;
    } catch (e) {
      return DEFAULT_USD_IDR_RATE;
    }
  }

  function setUsdIdrRate(rate) {
    try {
      localStorage.setItem(USD_IDR_RATE_KEY, String(rate));
    } catch (e) {}
  }

  function computeGrantIdr() {
    const grantUsdMillions = Number(DATA && DATA.metadata && DATA.metadata.grantUSD) || 0;
    return Math.round(grantUsdMillions * 1000000 * getUsdIdrRate());
  }

  function updateKursPreview() {
    const input = document.getElementById("kursUsdIdrInput");
    const preview = document.getElementById("kursPreview");
    if (!input || !preview) return;
    const rate = Number(input.value);
    if (!Number.isFinite(rate) || rate <= 0) {
      preview.textContent = "Masukkan kurs yang valid.";
      return;
    }
    const grantUsdMillions = Number(DATA && DATA.metadata && DATA.metadata.grantUSD) || 0;
    const idr = Math.round(grantUsdMillions * 1000000 * rate);
    preview.textContent = "Perkiraan hibah: USD " +
      grantUsdMillions.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      " Juta ≈ " + formatCompact(idr) + " (1 USD = Rp " + Math.round(rate).toLocaleString("id-ID") + ").";
  }

  function openKursModal() {
    const modal = document.getElementById("kursModal");
    const input = document.getElementById("kursUsdIdrInput");
    if (!modal) return;
    if (input) input.value = String(getUsdIdrRate());
    updateKursPreview();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (input) input.focus();
  }

  function applyGrantDisplay() {
    if (!DATA || !DATA.metadata) return;
    const meta = DATA.metadata;
    const grantIdr = computeGrantIdr();
    setText(
      "profileGrant",
      "USD " + Number(meta.grantUSD).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        " Juta (≈ Rp " + formatMiliarLong(grantIdr) + " · total " + YEAR_RANGE.length + " tahun " + YEAR_RANGE[0] + "–" + YEAR_RANGE[YEAR_RANGE.length - 1] + ")"
    );
    setText("berandaGrantIDR", "(&approx; " + formatCompact(grantIdr) + ")");
  }

  /* ------------------------------------------------------------------------
     Input realisasi per satker
     ---------------------------------------------------------------------- */

  const REALISASI_ENTRIES_KEY = "monev-carei-realisasi-entries";

  function pctVal(part, whole) {
    return whole ? Math.round((part / whole) * 10000) / 100 : 0;
  }

  function getRealisasiEntries() {
    try {
      const raw = localStorage.getItem(REALISASI_ENTRIES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveRealisasiEntries(entries) {
    try {
      localStorage.setItem(REALISASI_ENTRIES_KEY, JSON.stringify(entries));
    } catch (e) {}
  }

  function makeRealisasiPeriodKey(bulan, minggu, tanggal) {
    return [String(bulan || ""), String(minggu || ""), String(tanggal || "")].join("|");
  }

  function showRealisasiAlert(message) {
    const el = document.getElementById("realisasiInputAlert");
    if (!el) return;
    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = message;
  }

  function getRealisasiFormData() {
    return {
      satkerCode: (document.getElementById("realisasiSatker")?.value || "").trim(),
      code: (document.getElementById("realisasiKode")?.value || "").trim(),
      jenisKegiatan: (document.getElementById("realisasiJenisKegiatan")?.value || "").trim(),
      bulan: (document.getElementById("realisasiBulan")?.value || "").trim(),
      minggu: (document.getElementById("realisasiMinggu")?.value || "").trim(),
      tanggal: (document.getElementById("realisasiTanggal")?.value || "").trim(),
      jumlahRaw: (document.getElementById("realisasiJumlah")?.value || "").trim(),
    };
  }

  function validateRealisasiForm(showAlert) {
    const d = getRealisasiFormData();
    const jumlah = Number(d.jumlahRaw);
    const hasPeriod = !!(d.minggu || d.tanggal);
    const complete = !!(d.satkerCode && d.code && d.jenisKegiatan && d.bulan && hasPeriod && d.jumlahRaw !== "" && Number.isFinite(jumlah) && jumlah >= 0);
    if (showAlert) showRealisasiAlert("");
    return complete;
  }

  function updateRealisasiSaveState() {
    const btn = document.getElementById("btnSaveRealisasiInput");
    if (btn) btn.disabled = !validateRealisasiForm(false);
  }

  function populateRealisasiSatkerOptions() {
    const sel = document.getElementById("realisasiSatker");
    if (!sel || !DATA || !Array.isArray(DATA.satkers)) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Pilih satker —</option>' +
      DATA.satkers.map(function (s) {
        return '<option value="' + escapeHtml(s.code) + '">' + escapeHtml(s.code) + " — " + escapeHtml(s.name) + "</option>";
      }).join("");
    if (current) sel.value = current;
  }

  function populateRealisasiKegiatanOptions(satkerCode) {
    const sel = document.getElementById("realisasiJenisKegiatan");
    const kode = document.getElementById("realisasiKode");
    if (!sel) return;
    if (kode) kode.value = "";
    if (!satkerCode) {
      sel.disabled = true;
      sel.innerHTML = '<option value="">— Pilih satker terlebih dahulu —</option>';
      return;
    }
    const acts = (DATA.activities || []).filter(function (a) { return a.satkerCode === satkerCode; });
    sel.disabled = false;
    sel.innerHTML = '<option value="">— Pilih jenis kegiatan —</option>' +
      acts.map(function (a) {
        const label = (a.activity || a.program || a.code || "").trim();
        const short = label.length > 110 ? label.slice(0, 107) + "..." : label;
        return '<option value="' + escapeHtml(a.code) + '">' + escapeHtml(short) + "</option>";
      }).join("");
  }

  function recomputeAggregates() {
    if (!DATA || !Array.isArray(DATA.activities)) return;
    const activities = DATA.activities;

    // totals
    let totalPagu = 0, totalReal = 0;
    activities.forEach(function (a) {
      a.pagu = Number(a.pagu) || 0;
      a.realisasi = Number(a.realisasi) || 0;
      if (a.realisasi > a.pagu && a.pagu > 0) a.realisasi = a.pagu; // guard
      a.sisa = Math.max(0, a.pagu - a.realisasi);
      a.capaian = pctVal(a.realisasi, a.pagu);
      totalPagu += a.pagu;
      totalReal += a.realisasi;
    });
    DATA.totals = DATA.totals || {};
    DATA.totals.pagu = totalPagu;
    DATA.totals.realisasi = totalReal;
    DATA.totals.sisa = Math.max(0, totalPagu - totalReal);
    DATA.totals.capaian = pctVal(totalReal, totalPagu);

    // satkers
    if (Array.isArray(DATA.satkers)) {
      DATA.satkers.forEach(function (s) {
        const acts = activities.filter(function (a) { return a.satkerCode === s.code; });
        const p = acts.reduce(function (n, a) { return n + (Number(a.pagu) || 0); }, 0);
        const r = acts.reduce(function (n, a) { return n + (Number(a.realisasi) || 0); }, 0);
        s.pagu = p; s.realisasi = r; s.sisa = Math.max(0, p - r); s.capaian = pctVal(r, p);
      });
    }

    // components
    if (Array.isArray(DATA.components)) {
      DATA.components.forEach(function (c) {
        const acts = activities.filter(function (a) { return a.component === c.id; });
        const p = acts.reduce(function (n, a) { return n + (Number(a.pagu) || 0); }, 0);
        const r = acts.reduce(function (n, a) { return n + (Number(a.realisasi) || 0); }, 0);
        c.pagu = p; c.realisasi = r; c.sisa = Math.max(0, p - r);
        c.activities = acts.length;
        c.capaian = pctVal(r, p);
        c.share = pctVal(p, totalPagu);
      });
    }

    // status summary
    let tercapai = 0, berprogres = 0, perhatian = 0, belum = 0;
    activities.forEach(function (a) {
      const real = Number(a.realisasi) || 0;
      const cap = Number(a.capaian) || 0;
      if (real <= 0) belum++;
      else if (cap >= 90) tercapai++;
      else if (cap >= 60) berprogres++;
      else perhatian++;
    });
    const total = activities.length || 1;
    DATA.statusSummary = {
      total: activities.length,
      items: [
        { label: "Tercapai", count: tercapai, share: pctVal(tercapai, total), color: "#10b981", hint: "Realisasi >= 90%" },
        { label: "Berprogres", count: berprogres, share: pctVal(berprogres, total), color: "#3b82f6", hint: "Realisasi 60% - 89%" },
        { label: "Perlu Perhatian", count: perhatian, share: pctVal(perhatian, total), color: "#f59e0b", hint: "Realisasi < 60%" },
        { label: "Belum Realisasi", count: belum, share: pctVal(belum, total), color: "#94a3b8", hint: "Belum ada realisasi" },
      ],
    };

    indexData();
  }

  function applyRealisasiEntry(entry, persist) {
    if (!entry || !DATA || !Array.isArray(DATA.activities)) return { ok: false, reason: "Data tidak tersedia." };
    const activity = DATA.activities.find(function (a) { return a.code === entry.code && a.satkerCode === entry.satkerCode; }) ||
      DATA.activities.find(function (a) { return a.code === entry.code; });
    if (!activity) return { ok: false, reason: "Kegiatan tidak ditemukan." };
    const amount = Number(entry.jumlah);
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: "Jumlah realisasi tidak valid." };
    activity.realisasi = (Number(activity.realisasi) || 0) + amount;
    recomputeAggregates();
    if (persist) {
      const entries = getRealisasiEntries();
      entries.push(entry);
      saveRealisasiEntries(entries);
    }
    return { ok: true };
  }

  function applyStoredRealisasiEntries() {
    const entries = getRealisasiEntries();
    if (!entries.length) return;
    entries.forEach(function (entry) {
      applyRealisasiEntry(entry, false);
    });
  }

  function refreshDashboard() {
    renderMetadata();
    renderBeranda();
    renderHero();
    renderKPIs();
    renderFinancialBreakdown();
    renderComponentLegend();
    renderStatusLegend();
    renderComponentProgress();
    renderAttentionList();
    renderSatkerTable();
    renderSwakelolaTable();
    renderIndicators();
    renderDipaList();
    renderActivityTable();
    renderCharts();
  }

  function openRealisasiInputModal() {
    const modal = document.getElementById("realisasiInputModal");
    if (!modal) return;
    populateRealisasiSatkerOptions();
    showRealisasiAlert("");
    updateRealisasiSaveState();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const first = document.getElementById("realisasiSatker");
    if (first) first.focus();
  }

  function resetRealisasiInputForm() {
    ["realisasiSatker", "realisasiJenisKegiatan", "realisasiBulan", "realisasiMinggu", "realisasiTanggal", "realisasiJumlah"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const kode = document.getElementById("realisasiKode");
    if (kode) kode.value = "";
    populateRealisasiKegiatanOptions("");
    showRealisasiAlert("");
    updateRealisasiSaveState();
  }

  /* ------------------------------------------------------------------------
     Helpers
     ---------------------------------------------------------------------- */

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatRupiahFull(value) {
    return "Rp " + nf.format(Math.round(Number(value) || 0));
  }

  function formatCompact(value) {
    const v = Number(value) || 0;
    const abs = Math.abs(v);
    if (abs >= 1e12) {
      return "Rp " + (v / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " T";
    }
    if (abs >= 1e9) {
      return "Rp " + (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
    }
    if (abs >= 1e6) {
      return "Rp " + (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " Jt";
    }
    return "Rp " + nf.format(Math.round(v));
  }

  function formatMiliarLong(value) {
    const v = (Number(value) || 0) / 1e9;
    return v.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " Miliar";
  }

  function formatPercent(value, digits) {
    const d = typeof digits === "number" ? digits : 1;
    return (Number(value) || 0).toLocaleString("id-ID", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }) + "%";
  }

  function formatNumber(value) {
    return nf.format(Number(value) || 0);
  }

  function axisMoney(value) {
    const v = Number(value) || 0;
    const abs = Math.abs(v);
    if (abs >= 1e9) {
      return (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " M";
    }
    if (abs >= 1e6) {
      return (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " Jt";
    }
    if (abs === 0) return "0";
    return nf.format(v);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHtml(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  function activityStatus(activity) {
    if (!activity.realisasi || activity.realisasi <= 0) return "Belum Realisasi";
    if (activity.capaian >= 90) return "Tercapai";
    if (activity.capaian >= 60) return "Berprogres";
    return "Perlu Perhatian";
  }

  function statusBadgeHtml(status) {
    const cls = STATUS_CLASS[status] || "badge-belum";
    return '<span class="badge ' + cls + '">' + escapeHtml(status) + "</span>";
  }

  function progressCell(percent, color) {
    const width = Math.max(0, Math.min(100, Number(percent) || 0));
    return (
      '<div class="progress-cell">' +
      '<div class="bar"><span style="width:' + width + "%;" +
      (color ? "background:" + color + ";" : "") +
      '"></span></div>' +
      '<span class="pct">' + formatPercent(percent) + "</span>" +
      "</div>"
    );
  }

  function sumBy(list, key) {
    return list.reduce(function (acc, item) {
      return acc + (Number(item[key]) || 0);
    }, 0);
  }

  function getDipaGroups() {
    return DIPA_GROUPS.map(function (group) {
      const satkers = group.members
        .map(function (code) { return satkerByCode[code]; })
        .filter(Boolean);
      const pagu = sumBy(satkers, "pagu");
      const realisasi = sumBy(satkers, "realisasi");
      return {
        id: group.id,
        name: group.name,
        members: group.members,
        klMembers: group.klMembers || [],
        pagu: pagu,
        realisasi: realisasi,
        sisa: Math.max(0, pagu - realisasi),
        capaian: pagu > 0 ? (realisasi / pagu) * 100 : 0,
      };
    });
  }

  function debounce(fn, delay) {
    let timer;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, delay);
    };
  }

  function componentOf(activity) {
    return componentById[activity.component] || DATA.components[0];
  }

  /* ------------------------------------------------------------------------
     Theme
     ---------------------------------------------------------------------- */

  function setTheme(theme, persist) {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    if (persist !== false) {
      try {
        localStorage.setItem("monev-carei-theme", theme);
      } catch (e) {
        /* ignore */
      }
    }
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap"
      );
    }
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem("monev-carei-theme");
    } catch (e) {
      saved = null;
    }
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(saved === "dark" || (!saved && prefersDark) ? "dark" : "light", false);
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next, true);
    renderCharts();
  }

  function themeColors() {
    const dark = document.documentElement.dataset.theme === "dark";
    return {
      dark: dark,
      text: cssVar("--text-2") || "#344e47",
      muted: cssVar("--muted") || "#6b7f7a",
      grid: dark ? "rgba(94, 234, 212, 0.10)" : "rgba(15, 118, 110, 0.10)",
      surface: cssVar("--surface") || "#ffffff",
      border: cssVar("--border") || "#dfe9e6",
      tooltipBg: cssVar("--surface") || "#ffffff",
      tooltipText: cssVar("--text") || "#0b1f1a",
      tooltipBorder: cssVar("--border") || "#dfe9e6",
      primary: cssVar("--primary-2") || "#0d9488",
      pagu: dark ? "rgba(148, 163, 184, 0.34)" : "#cbd5e1",
    };
  }

  /* ------------------------------------------------------------------------
     Metadata & KPI
     ---------------------------------------------------------------------- */

  function toggleYearNav(available) {
    document.querySelectorAll(".nav-link").forEach(function (link) {
      if (link.getAttribute("href") === "#profil") return;
      if (available) link.removeAttribute("hidden");
      else link.setAttribute("hidden", "");
    });
  }

  function renderYearOptions() {
    const select = document.getElementById("filterYear");
    if (!select) return;
    select.innerHTML = YEAR_RANGE.map(function (year) {
      const available = Boolean(YEAR_DATA[String(year)]);
      return '<option value="' + year + '"' + (available ? "" : ' title="Data belum tersedia"') + ">" + year + "</option>";
    }).join("");
    select.value = dataYear;
  }

  function setYear(year) {
    const nextYear = String(year);
    if (nextYear === dataYear) return;
    dataYear = nextYear;

    const main = document.getElementById("main");
    const empty = document.getElementById("yearEmpty");
    const next = YEAR_DATA[nextYear];

    setText("heroYearLabel", dataYear);
    setText("profilePaguLabel", dataYear);

    if (!next) {
      if (main) main.classList.add("year-unavailable");
      toggleYearNav(false);
      if (empty) {
        const title = document.getElementById("yearEmptyTitle");
        const text = document.getElementById("yearEmptyText");
        if (title) title.textContent = "Data tahun " + nextYear + " belum tersedia";
        if (text) {
          text.textContent =
            "Transaksi dan realisasi tahun anggaran " + nextYear +
            " belum tersedia. Pilih tahun 2026 untuk melihat data terbaru.";
        }
        empty.hidden = false;
      }
      setText("profilePaguYear", "Belum tersedia");
      setText("heroPercent", "\u2014");
      setText("heroPagu", "\u2014");
      setText("heroRealisasi", "\u2014");
      setText("heroSisa", "\u2014");
      const ring = document.getElementById("heroRing");
      if (ring) ring.style.strokeDashoffset = String(2 * Math.PI * 52);
      destroyCharts();
      return;
    }

    DATA = next;
    indexData();

    if (main) main.classList.remove("year-unavailable");
    toggleYearNav(true);
    if (empty) empty.hidden = true;

    state.filters = { satker: "ALL", component: "ALL", status: "ALL", search: "" };
    state.sort = { key: "no", dir: "asc" };
    const search = document.getElementById("searchActivity");
    if (search) search.value = "";

    renderMetadata();
    renderHero();
    renderKPIs();
    renderComponentLegend();
    renderStatusLegend();
    renderComponentProgress();
    renderAttentionList();
    renderSatkerTable();
    renderDipaList();
    populateFilters();
    renderActivityTable();
    renderCharts();
  }

  function renderMetadata() {
    const meta = DATA.metadata;
    setText("dataAsOfTop", meta.dataAsOf);
    setText("dataAsOfNote", meta.dataAsOf);
    setText("footerDataAsOf", meta.dataAsOf);
    setText("sourceNameNote", meta.source);
    setText("infoSource", meta.source);
    setText("footerSource", meta.source);

    setText("heroPeriod", meta.period);
    setText("heroGrant", "USD " + meta.grantUSD.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Juta");
    setText("heroYearLabel", dataYear);

    setText("profileInstitution", meta.institution);
    setText("profilePartner", meta.partner);
    setText(
      "profileGrant",
      "USD " + Number(meta.grantUSD).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        " Juta (≈ Rp " + formatMiliarLong(computeGrantIdr()) + " · total " + YEAR_RANGE.length + " tahun " + YEAR_RANGE[0] + "–" + YEAR_RANGE[YEAR_RANGE.length - 1] + ")"
    );
    setText("profilePaguLabel", dataYear);
    setText("profilePaguYear", formatCompact(DATA.totals.pagu));
    setText("profilePeriod", meta.period);
    setText("profileClosing", meta.closingDate);
    setText("profileEA", meta.executingAgency);
    setText("profileSatkers", meta.implementers.join(", "));
    setText(
      "profileSource",
      meta.source + " · data per " + meta.dataAsOf + (meta.syncedAt ? " · sinkron " + meta.syncedAt : "")
    );

    setText("anggaranTotalPagu", formatCompact(DATA.totals.pagu));
    setText("activityTotalNote", String(DATA.activities.length));
  }

  function renderHero() {
    const total = DATA.totals;
    const capaian = total.capaian || 0;
    setText("heroPercent", formatPercent(capaian));
    setText("heroPagu", formatCompact(total.pagu));
    setText("heroRealisasi", formatCompact(total.realisasi));
    setText("heroSisa", formatCompact(total.sisa));

    const ring = document.getElementById("heroRing");
    if (ring) {
      const circumference = 2 * Math.PI * 52;
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = String(circumference * (1 - Math.min(100, Math.max(0, capaian)) / 100));
    }
  }

  function renderKPIs() {
    const total = DATA.totals;
    const capaian = total.capaian || 0;
    const sisaShare = total.pagu > 0 ? (total.sisa / total.pagu) * 100 : 0;

    setText("kpiPagu", formatCompact(total.pagu));
    setText("kpiPaguSub", DATA.satkers.length + " satker pelaksana");
    setText("kpiSatkerCount", DATA.activities.length + " kegiatan");

    setText("kpiRealisasi", formatCompact(total.realisasi));
    setText("kpiRealisasiSub", "Capaian " + formatPercent(capaian));
    setText("kpiRealisasiShare", dataYear);

    setText("kpiSisa", formatCompact(total.sisa));
    setText("kpiSisaSub", formatPercent(sisaShare) + " dari pagu");
    setText("kpiSisaShare", "Sisa");

    setText("kpiCapaian", formatPercent(capaian));
    setText("kpiCapaianSub", "Data per " + DATA.metadata.dataAsOf);
    const bar = document.getElementById("kpiProgressBar");
    if (bar) bar.style.width = Math.max(0, Math.min(100, capaian)) + "%";

    const statusEl = document.getElementById("kpiStatus");
    if (statusEl) {
      let label = "Perlu Perhatian";
      let cls = "chip-danger";
      if (capaian >= 80) {
        label = "Sangat Baik";
        cls = "chip-green";
      } else if (capaian >= 60) {
        label = "On Track";
        cls = "chip-teal";
      } else if (capaian >= 40) {
        label = "Waspada";
        cls = "chip-amber";
      }
      statusEl.textContent = label;
      statusEl.className = "chip " + cls;
    }
  }

  /* ------------------------------------------------------------------------
     HTML legends, progress, attention
     ---------------------------------------------------------------------- */


  /* ------------------------------------------------------------------------
     Beranda Executive Dashboard (Matching Dasbor Kinerja CARE-I 2026.png)
     ---------------------------------------------------------------------- */

  function renderBeranda() {
    const dSummary = DATA.dipa || {};
    const totals = DATA.totals || {};
    const totalPagu = totals.pagu || dSummary.totalPagu || 79894446000;
    const totalReal = totals.realisasi || dSummary.totalRealisasi || 49136446245;
    const totalSisa = totals.sisa || dSummary.totalSisa || 30757999755;
    const capaian = totals.capaian || dSummary.totalCapaian || 61.5;
    const sisaPct = 100 - capaian;

    setText("berandaPagu", formatCompact(totalPagu));
    setText("berandaRealisasi", formatCompact(totalReal));
    setText("berandaRealisasiPct", formatPercent(capaian));
    const prog = document.getElementById("berandaRealisasiProg");
    if (prog) prog.style.width = Math.min(100, Math.max(0, capaian)) + "%";

    setText("berandaSisa", formatCompact(totalSisa));
    setText("berandaSisaPct", formatPercent(sisaPct));
    setText("berandaCapaian", formatPercent(capaian));

    const ring = document.getElementById("berandaCapaianRing");
    if (ring) {
      ring.setAttribute("stroke-dasharray", capaian.toFixed(2) + ", 100");
    }

    if (DATA.metadata) {
      setText("berandaGrantUSD", "USD " + Number(DATA.metadata.grantUSD).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Juta");
      setText("berandaGrantIDR", "(&approx; " + formatCompact(computeGrantIdr()) + ")");
      setText("berandaPeriod", DATA.metadata.period);
    }
  }

  function renderFinancialBreakdown() {
    const dSummary = DATA.dipa || {};
    const klSummary = DATA.klSwakelola || {};
    const p2Detail = DATA.ditjenP2 || {};

    setText("kpiDipaTotal", formatCompact(dSummary.totalRealisasi || 49136446245));
    const dP2 = (dSummary.items && dSummary.items.find(i => i.id === "p2")) || {};
    setText("kpiDipaP2", formatCompact(dP2.realisasi || 48690515583));
    setText("kpiKlSwakelola", formatCompact(klSummary.totalRealisasi || 35379792252));
    setText("kpiDitjenP2", formatCompact(p2Detail.totalRealisasi || 13310723331));
    setText("kpiDipaTotalPct", formatPercent(dSummary.totalCapaian || 61.5, 2));
    setText("kpiDipaP2Pct", formatPercent(dP2.capaian || 65.59, 2));
    setText("kpiKlSwakelolaPct", formatPercent(klSummary.totalCapaian || 89.65, 2));
    setText("kpiDitjenP2Pct", formatPercent(p2Detail.totalCapaian || 38.28, 2));
  }

  function renderSwakelolaTable() {
    const tbody = document.getElementById("swakelolaTableBody");
    if (!tbody) return;
    const items = (DATA.klSwakelola && DATA.klSwakelola.items) || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">Data kontrak swakelola belum tersedia.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(function (item) {
      const paguFormatted = formatRupiahFull(item.pagu);
      const realFormatted = formatRupiahFull(item.realisasi);
      const capPct = item.capaian;
      return (
        '<tr>' +
        '<td><strong>' + escapeHtml(item.satker) + '</strong><br><small style="color:var(--muted);">' + escapeHtml(item.ket || "") + '</small></td>' +
        '<td>' + escapeHtml(item.kontrak) + '</td>' +
        '<td>' + escapeHtml(item.transfer) + '</td>' +
        '<td class="num">' + paguFormatted + '</td>' +
        '<td class="num" style="color:var(--primary); font-weight:700;">' + realFormatted + '</td>' +
        '<td class="progress-col">' + progressCell(capPct, capPct >= 90 ? "#10b981" : "#0d9488") + '</td>' +
        '<td><span style="font-size:11.5px; line-height:1.4; color:var(--text-2);">' + escapeHtml(item.kegiatan) + '</span></td>' +
        '</tr>'
      );
    }).join("");
  }

  /* ------------------------------------------------------------------------
     Indicators (Slide 12 Framework)
     ---------------------------------------------------------------------- */

  const indicatorState = {
    category: "ALL",
    status: "ALL",
    search: "",
  };

  function renderIndicators() {
    const container = document.getElementById("indicatorTableBody");
    const countEl = document.getElementById("indicatorCount");
    if (!container) return;

    const indData = DATA.indicators;
    if (!indData) return;

    setText("indicatorTotal", indData.summary.total);
    setText("indicatorTercapai", indData.summary.tercapai);
    setText("indicatorBerprogres", indData.summary.berprogres);
    setText("indicatorPerhatian", indData.summary.perluPerhatian);
    setText("indicatorTanpa", indData.summary.tanpaTarget + indData.summary.tanpaPic);
    setText("berandaIndicatorCount", indData.summary.total);

    const allIndicators = [].concat(
      indData.resultsFramework.items.map(function (item) {
        return Object.assign({}, item, { categoryType: "Results Framework" });
      }),
      indData.specificIndicators.items.map(function (item) {
        return Object.assign({}, item, { categoryType: "Spesifik" });
      })
    );

    const q = indicatorState.search.toLowerCase().trim();
    const filtered = allIndicators.filter(function (ind) {
      if (indicatorState.category !== "ALL") {
        if (indicatorState.category === "Results Framework" && ind.categoryType !== "Results Framework") return false;
        if (indicatorState.category === "Spesifik" && ind.categoryType !== "Spesifik") return false;
      }
      if (indicatorState.status !== "ALL") {
        if (indicatorState.status === "Tanpa Target" && ind.status !== "Tanpa Target 2026" && ind.status !== "Tanpa PIC") return false;
        else if (indicatorState.status !== "Tanpa Target" && ind.status !== indicatorState.status) return false;
      }
      if (q) {
        const text = (ind.code + " " + ind.name + " " + ind.satker + " " + ind.status + " " + ind.mov).toLowerCase();
        if (text.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (countEl) countEl.textContent = "Menampilkan " + filtered.length + " dari " + allIndicators.length + " indikator";

    if (!filtered.length) {
      container.innerHTML = '<tr><td colspan="8" class="empty">Tidak ada indikator yang sesuai kriteria filter.</td></tr>';
      return;
    }

    const badgeClass = {
      "Tercapai": "chip-teal",
      "Berprogres": "chip-blue",
      "Perlu Perhatian": "chip-amber",
      "Tanpa Target 2026": "chip-slate",
      "Tanpa PIC": "chip-slate",
    };

    container.innerHTML = filtered.map(function (ind) {
      const cls = badgeClass[ind.status] || "chip-slate";
      return (
        '<tr>' +
        '<td><strong>' + escapeHtml(ind.code) + '</strong></td>' +
        '<td><div style="font-weight:600;">' + escapeHtml(ind.name) + '</div><small style="color:var(--muted);">' + escapeHtml(ind.categoryType) + '</small></td>' +
        '<td><span class="chip chip-ghost">' + escapeHtml(ind.satker) + '</span></td>' +
        '<td>' + escapeHtml(ind.baseline) + '</td>' +
        '<td><strong>' + escapeHtml(ind.target2026) + '</strong></td>' +
        '<td>' + escapeHtml(ind.achievement) + '</td>' +
        '<td class="center"><span class="chip ' + cls + '">' + escapeHtml(ind.status) + '</span></td>' +
        '<td><small style="color:var(--text-2);">' + escapeHtml(ind.mov) + '</small></td>' +
        '</tr>'
      );
    }).join("");
  }

  function renderComponentLegend() {
    const html = DATA.components
      .map(function (c) {
        return (
          '<li class="legend-item" title="' +
          escapeHtml(c.name + " · " + formatRupiahFull(c.pagu) + " · capaian " + formatPercent(c.capaian)) +
          '">' +
          '<i class="dot" style="background:' + c.color + '"></i>' +
          '<span class="legend-name">' + escapeHtml(c.name) + "</span>" +
          '<span class="legend-value">' + formatPercent(c.share) + "</span>" +
          "</li>"
        );
      })
      .join("");
    setHtml("componentLegend", html);
    setText("componentCenter", formatCompact(DATA.totals.pagu));
  }

  function renderStatusLegend() {
    const html = DATA.statusSummary.items
      .map(function (item) {
        return (
          '<li class="legend-item">' +
          '<i class="dot" style="background:' + item.color + '"></i>' +
          '<span class="legend-name">' + escapeHtml(item.label) + "</span>" +
          '<span class="legend-value">' +
          formatNumber(item.count) +
          ' <small>(' + formatPercent(item.share) + ")</small></span>" +
          "</li>"
        );
      })
      .join("");
    setHtml("statusLegend", html);
    setText("statusCenter", formatNumber(DATA.statusSummary.total));
  }

  function renderComponentProgress() {
    const html = DATA.components
      .map(function (c) {
        return (
          '<div class="progress-item">' +
          '<div class="progress-item-head">' +
          '<span class="progress-item-title"><i class="dot" style="background:' + c.color + '"></i><span>' +
          escapeHtml(c.name) +
          "</span></span>" +
          '<span class="progress-item-value">' + formatPercent(c.capaian) + "</span>" +
          "</div>" +
          '<div class="bar"><span style="width:' + Math.max(0, Math.min(100, c.capaian)) +
          "%;background:" + c.color + '"></span></div>' +
          '<div class="progress-item-foot"><span>' +
          formatCompact(c.realisasi) + " / " + formatCompact(c.pagu) +
          "</span><span>" + formatPercent(c.share) + " pagu</span></div>" +
          "</div>"
        );
      })
      .join("");
    setHtml("componentProgress", html);
  }

  function renderAttentionList() {
    const lowest = DATA.activities
      .slice()
      .sort(function (a, b) {
        return a.capaian - b.capaian || b.pagu - a.pagu;
      })
      .slice(0, 5);

    if (!lowest.length) {
      setHtml("attentionList", '<li class="attention-item">Tidak ada data kegiatan.</li>');
      return;
    }

    const html = lowest
      .map(function (a) {
        const status = activityStatus(a);
        return (
          '<li class="attention-item" role="button" tabindex="0" data-code="' + escapeHtml(a.code) +
          '" aria-label="Lihat detail ' + escapeHtml(a.activity) + '">' +
          '<span class="attention-body">' +
          '<span class="attention-title">' + escapeHtml(a.activity) + "</span>" +
          '<span class="attention-meta">' + escapeHtml(a.satkerCode) + " · " + escapeHtml(componentOf(a).short) + "</span>" +
          "</span>" +
          '<span class="attention-value">' + (status === "Belum Realisasi" ? "Belum" : formatPercent(a.capaian)) + "</span>" +
          "</li>"
        );
      })
      .join("");
    setHtml("attentionList", html);
  }

  /* ------------------------------------------------------------------------
     Tables
     ---------------------------------------------------------------------- */

  function renderSatkerTable() {
    const tbody = document.getElementById("satkerTableBody");
    if (!tbody) return;
    const totalPagu = DATA.totals.pagu || 1;
    const list = DATA.satkers.slice().sort(function (a, b) {
      return b.pagu - a.pagu;
    });

    tbody.innerHTML = list
      .map(function (s) {
        const status = activityStatus({ realisasi: s.realisasi, capaian: s.capaian });
        return (
          '<tr title="' + escapeHtml(s.name) + '">' +
          '<td><span class="cell-satker">' + escapeHtml(s.name) + "<small>" + escapeHtml(s.code) + "</small></span></td>" +
          '<td class="num"><span class="money">' + formatCompact(s.pagu) +
          "<small>" + formatPercent((s.pagu / totalPagu) * 100) + " dari total</small></span></td>" +
          '<td class="num"><span class="money">' + formatCompact(s.realisasi) +
          "<small>" + formatPercent(s.capaian) + " dari pagu</small></span></td>" +
          '<td class="progress-col">' + progressCell(s.capaian) + "</td>" +
          '<td class="num"><span class="money money-muted">' + formatCompact(s.sisa) + "</span></td>" +
          '<td class="center">' + statusBadgeHtml(status) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function populateFilters() {
    const satkerSelect = document.getElementById("filterSatker");
    if (satkerSelect) {
      const codes = Array.from(new Set(DATA.activities.map(function (a) { return a.satkerCode; }))).sort();
      satkerSelect.innerHTML =
        '<option value="ALL">Semua Satker</option>' +
        codes.map(function (code) {
          return '<option value="' + escapeHtml(code) + '">' + escapeHtml(code) + "</option>";
        }).join("");
    }

    const componentSelect = document.getElementById("filterComponent");
    if (componentSelect) {
      componentSelect.innerHTML =
        '<option value="ALL">Semua Komponen</option>' +
        DATA.components.map(function (c) {
          return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + "</option>";
        }).join("");
    }

    const statusSelect = document.getElementById("filterStatus");
    if (statusSelect) {
      statusSelect.innerHTML =
        '<option value="ALL">Semua Status</option>' +
        DATA.statusSummary.items.map(function (item) {
          return '<option value="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) + " (" + item.count + ")</option>";
        }).join("");
    }
  }

  function getFilteredActivities() {
    const f = state.filters;
    const query = f.search.toLowerCase();
    return DATA.activities.filter(function (a) {
      if (f.satker !== "ALL" && a.satkerCode !== f.satker) return false;
      if (f.component !== "ALL" && a.component !== f.component) return false;
      if (f.status !== "ALL" && activityStatus(a) !== f.status) return false;
      if (query) {
        const haystack = [
          a.activity,
          a.subActivity,
          a.program,
          a.code,
          a.satkerCode,
          a.satker,
          componentOf(a).name,
        ].join(" ").toLowerCase();
        if (haystack.indexOf(query) === -1) return false;
      }
      return true;
    });
  }

  function sortActivities(list) {
    const key = state.sort.key;
    const dir = state.sort.dir === "asc" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      if (key === "no") return (a.no - b.no) * dir;
      return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * dir;
    });
  }

  function getVisibleActivities() {
    return sortActivities(getFilteredActivities());
  }

  function renderActivityTable() {
    const tbody = document.getElementById("activityTableBody");
    if (!tbody) return;
    const visible = getVisibleActivities();

    setText(
      "activityCount",
      "Menampilkan " + visible.length + " dari " + DATA.activities.length + " kegiatan"
    );

    if (!visible.length) {
      tbody.innerHTML =
        '<tr><td colspan="8"><div class="table-empty">' +
        '<svg class="icon"><use href="#i-search"></use></svg>' +
        "<strong>Tidak ada kegiatan yang sesuai filter.</strong>" +
        "<div>Coba ubah kata kunci atau reset filter.</div>" +
        "</div></td></tr>";
      renderTableFoot(visible);
      return;
    }

    tbody.innerHTML = visible
      .map(function (a) {
        const comp = componentOf(a);
        const status = activityStatus(a);
        return (
          '<tr data-code="' + escapeHtml(a.code) + '" tabindex="0" aria-label="Lihat detail ' + escapeHtml(a.activity) + '">' +
          '<td class="col-activity">' +
          '<span class="cell-title">' + escapeHtml(a.activity) + "</span>" +
          '<span class="cell-sub"><i class="dot" style="background:' + comp.color + '"></i>' +
          '<span class="cell-code">' + escapeHtml(a.code) + "</span>" +
          "<span>" + escapeHtml(a.programCode) + "</span></span>" +
          "</td>" +
          '<td class="col-satker"><span class="cell-satker">' + escapeHtml(a.satkerCode) +
          "<small>" + escapeHtml(a.satker) + "</small></span></td>" +
          '<td class="num"><span class="money">' + formatCompact(a.pagu) +
          "<small>" + formatRupiahFull(a.pagu) + "</small></span></td>" +
          '<td class="num"><span class="money">' + formatCompact(a.realisasi) +
          "<small>" + formatPercent(a.capaian) + " dari pagu</small></span></td>" +
          '<td class="progress-col">' + progressCell(a.capaian) + "</td>" +
          '<td class="num col-sisa"><span class="money money-muted">' + formatCompact(a.sisa) + "</span></td>" +
          '<td class="center">' + statusBadgeHtml(status) + "</td>" +
          '<td class="center col-action"><button class="row-action" type="button" aria-label="Buka detail">' +
          '<svg class="icon"><use href="#i-chevron-right"></use></svg></button></td>' +
          "</tr>"
        );
      })
      .join("");

    renderTableFoot(visible);
    updateSortIndicators();
  }

  function renderTableFoot(visible) {
    const foot = document.getElementById("activityFoot");
    if (!foot) return;
    const filteredPagu = sumBy(visible, "pagu");
    const filteredReal = sumBy(visible, "realisasi");
    const allActivityPagu = sumBy(DATA.activities, "pagu");
    const diff = DATA.totals.pagu - allActivityPagu;

    let note = "Pagu kegiatan sesuai total dashboard.";
    if (Math.abs(diff) > 1e6) {
      note =
        "Pagu kegiatan terinci <strong>" + formatCompact(allActivityPagu) + "</strong> dari total <strong>" +
        formatCompact(DATA.totals.pagu) + "</strong>; selisih <strong>" + formatCompact(diff) +
        "</strong> merupakan pagu yang belum terinci pada data sumber.";
    }

    foot.innerHTML =
      "<div>Total terfilter: <strong>" + formatCompact(filteredPagu) +
      "</strong> pagu · <strong>" + formatCompact(filteredReal) + "</strong> realisasi</div>" +
      "<div>" + note + "</div>";
    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll("th.sortable").forEach(function (th) {
      const key = th.getAttribute("data-sort");
      const active = state.sort.key === key;
      th.setAttribute("data-order", active ? state.sort.dir : "");
      th.setAttribute("aria-sort", active ? (state.sort.dir === "asc" ? "ascending" : "descending") : "none");
    });
  }

  /* ------------------------------------------------------------------------
     Charts
     ---------------------------------------------------------------------- */

  function destroyCharts() {
    Object.keys(state.charts).forEach(function (key) {
      const chart = state.charts[key];
      if (chart && typeof chart.destroy === "function") chart.destroy();
    });
    state.charts = {};
  }

  function registerChartDefaults() {
    if (state.chartsRegistered || typeof window.Chart === "undefined") return;
    const Chart = window.Chart;
    Chart.defaults.font.family = cssVar("--font") || "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = cssVar("--muted") || "#6b7f7a";
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    state.chartsRegistered = true;
  }

  function baseTooltip(col) {
    return {
      backgroundColor: col.tooltipBg,
      titleColor: col.tooltipText,
      bodyColor: col.tooltipText,
      footerColor: col.muted,
      borderColor: col.tooltipBorder,
      borderWidth: 1,
      displayColors: true,
      boxPadding: 4,
    };
  }


  function renderBerandaDipaChart() {
    const canvas = document.getElementById("berandaDipaChart");
    if (!canvas) return;
    destroyChart("berandaDipa");

    const dipaData = DATA.dipa || {
      items: [
        { name: "DIPA P2", pagu: 74233432000, realisasi: 48690515583, sisa: 25542916417 },
        { name: "DIPA Kesprimkom", pagu: 2510702000, realisasi: 128690000, sisa: 2382012000 },
        { name: "DIPA Sekjen", pagu: 3150312000, realisasi: 317240662, sisa: 2833071338 },
      ]
    };

    const labels = dipaData.items.map(function (d) { return d.name; });
    const paguMiliar = dipaData.items.map(function (d) { return +(d.pagu / 1e9).toFixed(2); });
    const realisasiMiliar = dipaData.items.map(function (d) { return +(d.realisasi / 1e9).toFixed(2); });
    const sisaMiliar = dipaData.items.map(function (d) { return +(d.sisa / 1e9).toFixed(2); });

    state.charts.berandaDipa = new window.Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Pagu",
            data: paguMiliar,
            backgroundColor: "#0f4c47",
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.8,
            categoryPercentage: 0.7,
          },
          {
            label: "Realisasi",
            data: realisasiMiliar,
            backgroundColor: "#0d9488",
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.8,
            categoryPercentage: 0.7,
          },
          {
            label: "Sisa",
            data: sisaMiliar,
            backgroundColor: "#84cc16",
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.8,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return " " + ctx.dataset.label + ": Rp " + ctx.parsed.y.toLocaleString("id-ID") + " Miliar";
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: cssVar("--font"), size: 11, weight: "bold" }, color: cssVar("--text") },
          },
          y: {
            beginAtZero: true,
            max: 80,
            ticks: {
              stepSize: 20,
              callback: function (val) { return val + " M"; },
              font: { family: cssVar("--font"), size: 10 },
              color: cssVar("--muted"),
            },
            title: {
              display: true,
              text: "Miliar Rupiah",
              font: { family: cssVar("--font"), size: 10, weight: "600" },
              color: cssVar("--muted"),
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
      },
    });
  }

  function renderBerandaIndicatorChart() {
    const canvas = document.getElementById("indicatorStatusChart");
    if (!canvas) return;
    destroyChart("berandaIndicator");

    state.charts.berandaIndicator = new window.Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Tercapai", "Berprogres", "Perlu Perhatian", "Tanpa PIC / >2026"],
        datasets: [
          {
            data: [12, 22, 5, 12],
            backgroundColor: ["#10b981", "#0284c7", "#f59e0b", "#94a3b8"],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const total = 51;
                const val = ctx.parsed;
                const pct = Math.round((val / total) * 100);
                return " " + ctx.label + ": " + val + " indikator (" + pct + "%)";
              },
            },
          },
        },
      },
    });
  }

  function renderCharts() {
    if (typeof window.Chart === "undefined") return;
    registerChartDefaults();
    destroyCharts();
    renderBerandaDipaChart();
    renderBerandaIndicatorChart();
    renderTrendChart();
    renderComponentChart();
    renderDipaSection();
    renderStatusChart();
  }

  function _unusedRenderCharts() {
    if (typeof window.Chart === "undefined") {
      // Chart.js belum termuat; dashboard tetap menampilkan angka & tabel.
      return;
    }
    registerChartDefaults();
    destroyCharts();
    renderTrendChart();
    renderComponentChart();
    renderDipaSection();
    renderStatusChart();
  }

  function renderTrendChart() {
    const canvas = document.getElementById("trendChart");
    if (!canvas) return;
    const Chart = window.Chart;
    const col = themeColors();
    const labels = DATA.trend.labels;
    const cumulative = DATA.trend.cumulative;
    const paguLine = labels.map(function () { return DATA.totals.pagu; });

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, col.dark ? "rgba(45, 212, 191, 0.32)" : "rgba(13, 148, 136, 0.26)");
    gradient.addColorStop(1, col.dark ? "rgba(45, 212, 191, 0.02)" : "rgba(13, 148, 136, 0.01)");

    state.charts.trend = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Realisasi Kumulatif",
            data: cumulative,
            borderColor: col.primary,
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: col.primary,
            pointBorderColor: col.surface,
            pointBorderWidth: 1.5,
          },
          {
            label: "Pagu Total",
            data: paguLine,
            borderColor: col.pagu,
            borderWidth: 1.5,
            borderDash: [6, 6],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(col), {
            callbacks: {
              label: function (context) {
                return " " + context.dataset.label + ": " + formatCompact(context.parsed.y);
              },
              footer: function (items) {
                if (!items.length) return "";
                const index = items[0].dataIndex;
                const real = cumulative[index] || 0;
                const pct = DATA.totals.pagu > 0 ? (real / DATA.totals.pagu) * 100 : 0;
                return "Capaian kumulatif: " + formatPercent(pct);
              },
            },
          }),
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: col.muted,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              font: { size: 10, weight: 600 },
            },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: { color: col.grid, drawTicks: false },
            ticks: {
              color: col.muted,
              padding: 6,
              callback: axisMoney,
              font: { size: 10 },
            },
            border: { display: false },
          },
        },
      },
    });

    const monthly = DATA.trend.monthly || [];
    const foot = monthly
      .map(function (m) {
        return (
          '<span class="chart-foot-item"><i class="dot dot-teal"></i>' +
          escapeHtml(m.month.replace(" 2026", "")) + ": <strong>" + formatCompact(m.realisasi) + "</strong></span>"
        );
      })
      .join("");
    setHtml(
      "trendFoot",
      foot +
        '<span class="chart-foot-item"><i class="dot dot-slate"></i>Sisa pagu: <strong>' +
        formatCompact(DATA.totals.sisa) + "</strong></span>" +
        '<span class="chart-foot-item">Capaian: <strong>' + formatPercent(DATA.totals.capaian) + "</strong></span>"
    );
  }

  function renderComponentChart() {
    const canvas = document.getElementById("componentChart");
    if (!canvas) return;
    const Chart = window.Chart;
    const col = themeColors();

    state.charts.component = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: DATA.components.map(function (c) { return c.name; }),
        datasets: [
          {
            data: DATA.components.map(function (c) { return c.pagu; }),
            backgroundColor: DATA.components.map(function (c) { return c.color; }),
            borderColor: col.surface,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(col), {
            callbacks: {
              label: function (context) {
                const item = DATA.components[context.dataIndex];
                return " " + item.name + ": " + formatCompact(context.parsed) + " (" + formatPercent(item.share) + ")";
              },
              afterLabel: function (context) {
                const item = DATA.components[context.dataIndex];
                return "Capaian: " + formatPercent(item.capaian);
              },
            },
          }),
        },
      },
    });
  }

  function dipaChipClass(capaian) {
    if (capaian >= 60) return "chip-teal";
    if (capaian >= 30) return "chip-amber";
    return "chip-danger";
  }

  function destroyChart(key) {
    const chart = state.charts[key];
    if (chart && typeof chart.destroy === "function") chart.destroy();
    delete state.charts[key];
  }

  function openDipa(id) {
    const exists = DIPA_GROUPS.some(function (group) { return group.id === id; });
    if (!exists) return;
    const opening = state.dipaDetail !== id;
    state.dipaDetail = opening ? id : null;
    if (state.dipaDetail !== "p2") state.dipaP2Scope = "p2";
    renderDipaSection();
    if (!opening) return;
    const subhead = document.querySelector(".dipa-subhead");
    if (subhead) subhead.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closeDipa() {
    const previous = state.dipaDetail;
    if (!previous) return;
    state.dipaDetail = null;
    state.dipaP2Scope = "p2";
    renderDipaSection();
    const item = document.querySelector('#dipaList [data-dipa="' + previous + '"]');
    if (item) item.focus();
  }

  function syncDipaListActive() {
    document.querySelectorAll("#dipaList [data-dipa]").forEach(function (item) {
      const active = item.getAttribute("data-dipa") === state.dipaDetail;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
      const hint = item.querySelector(".dipa-open");
      if (hint) hint.innerHTML = active ? "&#10003; Terpilih" : "Lihat satker &rsaquo;";
    });
  }

  function renderDipaSection() {
    const groups = getDipaGroups();
    const group = state.dipaDetail
      ? groups.find(function (item) { return item.id === state.dipaDetail; })
      : null;

    destroyChart("dipa");
    destroyChart("satker");

    syncDipaListActive();
    renderDipaChart(groups);
    renderSatkerChart(group);
    updateDipaSatkerHeader(group);
  }

  function dipaScopeMembers(group) {
    if (!group) return null;
    if (group.id !== "p2") return group.members;
    if (state.dipaP2Scope === "kl") return group.klMembers;
    if (state.dipaP2Scope === "all") return group.members.concat(group.klMembers);
    return group.members;
  }

  function updateDipaSatkerHeader(group) {
    const isP2 = Boolean(group && group.id === "p2");
    const scopeMode = isP2 ? state.dipaP2Scope : "p2";
    const scope = document.getElementById("dipaScope");
    if (scope) scope.hidden = !isP2;
    document.querySelectorAll("#dipaScope [data-scope]").forEach(function (btn) {
      const active = btn.getAttribute("data-scope") === scopeMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    let title = group
      ? "Satker dalam " + group.name
      : "Perbandingan Pagu dan Realisasi per Satker";
    let note;
    if (!group) {
      note = DATA.satkers.length + " satker · diurutkan berdasarkan pagu terbesar";
    } else if (!isP2) {
      note = group.members.length + " satker · diurutkan berdasarkan pagu terbesar";
    } else if (scopeMode === "kl") {
      title = "Satker K/L dalam DIPA P2";
      note = group.klMembers.length + " satker K/L mitra · diurutkan berdasarkan pagu terbesar";
    } else if (scopeMode === "all") {
      const total = group.members.length + group.klMembers.length;
      title = "Satker P2 + K/L dalam DIPA P2";
      note =
        total +
        " satker (" +
        group.members.length +
        " P2 + " +
        group.klMembers.length +
        " K/L mitra) · diurutkan berdasarkan pagu terbesar";
    } else {
      note = group.members.length + " satker · diurutkan berdasarkan pagu terbesar";
    }

    setText("dipaSatkerTitle", title);
    setText("dipaSatkerNote", note);

    const reset = document.getElementById("dipaReset");
    if (reset) reset.hidden = !group;
    const canvas = document.getElementById("satkerChart");
    if (canvas) {
      let aria = group
        ? "Grafik batang pagu dan realisasi satker dalam " + group.name
        : "Grafik batang pagu dan realisasi per satker";
      if (isP2 && scopeMode === "kl") aria += " (Kementerian/Lembaga)";
      else if (isP2 && scopeMode === "all") aria += " (P2 dan K/L mitra)";
      canvas.setAttribute("aria-label", aria);
    }
  }

  function renderDipaList() {
    const list = document.getElementById("dipaList");
    if (!list) return;
    const groups = getDipaGroups();
    setText("dipaYearLabel", dataYear);

    const dipaPagu = sumBy(groups, "pagu");
    const outside = Math.max(0, (DATA.totals.pagu || 0) - dipaPagu);

    list.innerHTML =
      groups.map(function (group) {
        const width = Math.min(100, Math.max(0, group.capaian));
        const active = state.dipaDetail === group.id;
        return (
          '<li class="dipa-item' + (active ? " is-active" : "") + '" data-dipa="' + group.id + '" role="button" tabindex="0" aria-pressed="' + (active ? "true" : "false") + '" aria-label="' + (active ? "Tampilkan semua satker" : "Saring satker untuk " + escapeHtml(group.name)) + '">' +
            '<div class="dipa-item-head">' +
              '<strong>' + escapeHtml(group.name) + '</strong>' +
              '<span class="chip ' + dipaChipClass(group.capaian) + '">' + formatPercent(group.capaian) + '</span>' +
            '</div>' +
            '<div class="dipa-item-values">' +
              '<span>' + formatCompact(group.pagu) + '</span>' +
              '<small>Realisasi ' + formatCompact(group.realisasi) + '</small>' +
            '</div>' +
            '<div class="dipa-bar"><span style="width:' + width + '%"></span></div>' +
            '<div class="dipa-item-foot">' +
              '<p class="dipa-members">' + group.members.map(escapeHtml).join(" · ") + '</p>' +
              '<span class="dipa-open" aria-hidden="true">' + (active ? "&#10003; Terpilih" : "Lihat satker &rsaquo;") + '</span>' +
            '</div>' +
          '</li>'
        );
      }).join("") +
      (outside > 0
        ? '<li class="dipa-outside">Di luar 3 DIPA (K/L mitra): ' + formatCompact(outside) + ' pagu</li>'
        : "");
  }

  function renderDipaChart(groups) {
    const canvas = document.getElementById("dipaChart");
    if (!canvas) return;
    const Chart = window.Chart;
    const col = themeColors();
    groups = groups || getDipaGroups();
    const activeId = state.dipaDetail;
    const mutedPagu = col.dark ? "rgba(148, 163, 184, 0.18)" : "#e7eceb";
    const mutedRealisasi = col.dark ? "rgba(20, 184, 166, 0.22)" : "#c9e9e3";
    const paguColors = groups.map(function (group) {
      return !activeId || group.id === activeId ? col.pagu : mutedPagu;
    });
    const realisasiColors = groups.map(function (group) {
      return !activeId || group.id === activeId ? col.primary : mutedRealisasi;
    });

    state.charts.dipa = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: groups.map(function (group) { return group.name; }),
        datasets: [
          {
            label: "Pagu",
            data: groups.map(function (group) { return group.pagu; }),
            backgroundColor: paguColors,
            borderRadius: 6,
            maxBarThickness: 28,
            categoryPercentage: 0.62,
            barPercentage: 0.9,
          },
          {
            label: "Realisasi",
            data: groups.map(function (group) { return group.realisasi; }),
            backgroundColor: realisasiColors,
            borderRadius: 6,
            maxBarThickness: 28,
            categoryPercentage: 0.62,
            barPercentage: 0.9,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        onClick: function (event, elements) {
          if (!elements.length) return;
          const group = groups[elements[0].index];
          if (group) openDipa(group.id);
        },
        onHover: function (event, elements) {
          const target = event.native ? event.native.target : null;
          if (target) target.style.cursor = elements.length ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(col), {
            callbacks: {
              label: function (context) {
                return " " + context.dataset.label + ": " + formatCompact(context.parsed.y);
              },
              afterBody: function (items) {
                if (!items.length) return "";
                const group = groups[items[0].dataIndex];
                return "Capaian: " + formatPercent(group.capaian) + " · Sisa: " + formatCompact(group.sisa);
              },
            },
          }),
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: col.text,
              font: { size: 10, weight: 600 },
            },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: { color: col.grid, drawTicks: false },
            ticks: {
              color: col.muted,
              callback: axisMoney,
              font: { size: 10 },
            },
            border: { display: false },
          },
        },
      },
    });
  }

  function renderSatkerChart(group) {
    const canvas = document.getElementById("satkerChart");
    if (!canvas) return;
    const Chart = window.Chart;
    const col = themeColors();
    const scopeMembers = dipaScopeMembers(group);
    const list = DATA.satkers
      .filter(function (satker) {
        return !scopeMembers || scopeMembers.indexOf(satker.code) !== -1;
      })
      .slice()
      .sort(function (a, b) {
        return b.pagu - a.pagu;
      });

    const box = document.getElementById("dipaSatkerBox");
    if (box) box.style.height = Math.max(210, 94 + list.length * 34) + "px";

    state.charts.satker = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: list.map(function (s) { return s.code; }),
        datasets: [
          {
            label: "Pagu",
            data: list.map(function (s) { return s.pagu; }),
            backgroundColor: col.pagu,
            borderRadius: 6,
            maxBarThickness: 16,
            categoryPercentage: 0.72,
            barPercentage: 0.88,
          },
          {
            label: "Realisasi",
            data: list.map(function (s) { return s.realisasi; }),
            backgroundColor: col.primary,
            borderRadius: 6,
            maxBarThickness: 16,
            categoryPercentage: 0.72,
            barPercentage: 0.88,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(col), {
            callbacks: {
              title: function (items) {
                return items.length ? list[items[0].dataIndex].name : "";
              },
              label: function (context) {
                return " " + context.dataset.label + ": " + formatCompact(context.parsed.x);
              },
              afterBody: function (items) {
                if (!items.length) return "";
                const s = list[items[0].dataIndex];
                return "Capaian: " + formatPercent(s.capaian) + " · Sisa: " + formatCompact(s.sisa);
              },
            },
          }),
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: col.grid, drawTicks: false },
            ticks: {
              color: col.muted,
              callback: axisMoney,
              font: { size: 10 },
            },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: col.text,
              font: { size: 10, weight: 600 },
            },
            border: { display: false },
          },
        },
      },
    });
  }

  function renderStatusChart() {
    const canvas = document.getElementById("statusChart");
    if (!canvas) return;
    const Chart = window.Chart;
    const col = themeColors();
    const items = DATA.statusSummary.items;

    state.charts.status = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: items.map(function (item) { return item.label; }),
        datasets: [
          {
            data: items.map(function (item) { return item.count; }),
            backgroundColor: items.map(function (item) { return item.color; }),
            borderColor: col.surface,
            borderWidth: 2,
            hoverOffset: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(col), {
            callbacks: {
              label: function (context) {
                const item = items[context.dataIndex];
                return " " + item.label + ": " + item.count + " kegiatan (" + formatPercent(item.share) + ")";
              },
              afterLabel: function (context) {
                return items[context.dataIndex].hint;
              },
            },
          }),
        },
      },
    });
  }

  /* ------------------------------------------------------------------------
     Modal
     ---------------------------------------------------------------------- */

  function findActivity(code) {
    return DATA.activities.find(function (a) { return a.code === code; });
  }

  function openModal(code) {
    const a = findActivity(code);
    if (!a) return;
    const comp = componentOf(a);
    const status = activityStatus(a);

    setText("modalCode", a.code);
    setText("modalTitle", a.activity || "Kegiatan tanpa judul");
    setText("modalSatker", a.satkerCode + " · " + comp.name);
    setText("modalPagu", formatRupiahFull(a.pagu));
    setText("modalRealisasi", formatRupiahFull(a.realisasi));
    setText("modalSisa", formatRupiahFull(a.sisa));
    setText("modalCapaian", formatPercent(a.capaian));
    setText("modalProgram", a.program || "-");
    setText("modalActivity", a.activity || "-");
    setText("modalSub", a.subActivity || "-");
    setText("modalComponent", comp.name);
    setText("modalPeriode", a.periode || "-");
    setText("modalAllCode", a.code);

    const bar = document.getElementById("modalProgressBar");
    if (bar) bar.style.width = Math.max(0, Math.min(100, a.capaian)) + "%";

    const statusEl = document.getElementById("modalStatus");
    if (statusEl) statusEl.innerHTML = statusBadgeHtml(status);

    const modal = document.getElementById("activityModal");
    if (modal) {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      const close = document.getElementById("modalClose");
      if (close) close.focus();
    }
  }

  function closeModal(modalOrId) {
    const modal = typeof modalOrId === "string"
      ? document.getElementById(modalOrId)
      : (modalOrId && modalOrId.nodeType ? modalOrId : null);
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      if (!document.querySelector(".modal.is-open")) document.body.style.overflow = "";
      return;
    }
    document.querySelectorAll(".modal.is-open").forEach(function (m) {
      m.classList.remove("is-open");
      m.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "";
  }

  /* ------------------------------------------------------------------------
     Export
     ---------------------------------------------------------------------- */

  function csvCell(value) {
    if (value == null) return '""';
    if (typeof value === "number") return String(value);
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function exportCSV() {
    if (!YEAR_DATA[dataYear]) {
      showToast("Data tahun " + dataYear + " belum tersedia untuk diekspor.");
      return;
    }
    const list = getVisibleActivities();
    if (!list.length) {
      showToast("Tidak ada kegiatan yang sesuai filter untuk diekspor.");
      return;
    }

    const header = [
      "No",
      "Kode",
      "Satker",
      "Program",
      "Aktivitas",
      "Sub Aktivitas",
      "Komponen",
      "Pagu (IDR)",
      "Realisasi (IDR)",
      "Sisa (IDR)",
      "Capaian (%)",
      "Periode",
      "Status",
    ];

    const rows = list.map(function (a) {
      return [
        a.no,
        a.code,
        a.satkerCode,
        a.program,
        a.activity,
        a.subActivity,
        componentOf(a).name,
        a.pagu,
        a.realisasi,
        a.sisa,
        a.capaian,
        a.periode,
        activityStatus(a),
      ];
    });

    const csv = [header].concat(rows)
      .map(function (row) { return row.map(csvCell).join(","); })
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "monev-care-i-2026-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Data kegiatan berhasil diekspor ke CSV.");
  }

  /* ------------------------------------------------------------------------
     Toast
     ---------------------------------------------------------------------- */

  let toastTimer = null;

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerHTML =
      '<svg class="icon"><use href="#i-check"></use></svg><span>' + escapeHtml(message) + "</span>";
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  /* ------------------------------------------------------------------------
     Navigation
     ---------------------------------------------------------------------- */


  function initNav() {
    const sidebar = document.getElementById("appSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const toggle = document.getElementById("navToggle");
    const sideLinks = Array.from(document.querySelectorAll(".side-nav-link"));

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-open");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Buka menu navigasi");
      }
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        const isOpen = sidebar.classList.toggle("is-open");
        if (backdrop) backdrop.classList.toggle("is-open", isOpen);
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        toggle.setAttribute("aria-label", isOpen ? "Tutup menu" : "Buka menu navigasi");
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", closeSidebar);
    }

    sideLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        closeSidebar();
        sideLinks.forEach(function (l) { l.classList.remove("is-active"); });
        link.classList.add("is-active");
      });
    });

    const sections = ["beranda", "profil", "anggaran", "kegiatan"];
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            sideLinks.forEach(function (link) {
              const sec = link.getAttribute("data-section");
              if (sec === id) {
                link.classList.add("is-active");
              } else {
                link.classList.remove("is-active");
              }
            });
          }
        });
      }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });

      sections.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }
  }

  /* ------------------------------------------------------------------------
     Events
     ---------------------------------------------------------------------- */

  function bindEvents() {
    const indSearch = document.getElementById("indicatorSearch");
    if (indSearch) {
      indSearch.addEventListener("input", debounce(function () {
        indicatorState.search = indSearch.value;
        renderIndicators();
      }, 150));
    }

    const indCat = document.getElementById("indicatorFilterCat");
    if (indCat) {
      indCat.addEventListener("change", function () {
        indicatorState.category = indCat.value;
        renderIndicators();
      });
    }

    const indStatus = document.getElementById("indicatorFilterStatus");
    if (indStatus) {
      indStatus.addEventListener("change", function () {
        indicatorState.status = indStatus.value;
        renderIndicators();
      });
    }

    const indReset = document.getElementById("btnResetIndicators");
    if (indReset) {
      indReset.addEventListener("click", function () {
        indicatorState.category = "ALL";
        indicatorState.status = "ALL";
        indicatorState.search = "";
        if (indSearch) indSearch.value = "";
        if (indCat) indCat.value = "ALL";
        if (indStatus) indStatus.value = "ALL";
        renderIndicators();
      });
    }

    document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
    document.getElementById("btnExport")?.addEventListener("click", exportCSV);
    document.getElementById("btnPrint")?.addEventListener("click", function () { window.print(); });

    const yearSelect = document.getElementById("filterYear");
    if (yearSelect) {
      yearSelect.addEventListener("change", function () {
        setYear(yearSelect.value);
      });
    }

    const satkerFilter = document.getElementById("filterSatker");
    if (satkerFilter) {
      satkerFilter.addEventListener("change", function () {
        state.filters.satker = satkerFilter.value;
        renderActivityTable();
      });
    }

    const componentFilter = document.getElementById("filterComponent");
    if (componentFilter) {
      componentFilter.addEventListener("change", function () {
        state.filters.component = componentFilter.value;
        renderActivityTable();
      });
    }

    const statusFilter = document.getElementById("filterStatus");
    if (statusFilter) {
      statusFilter.addEventListener("change", function () {
        state.filters.status = statusFilter.value;
        renderActivityTable();
      });
    }

    const search = document.getElementById("searchActivity");
    if (search) {
      search.addEventListener(
        "input",
        debounce(function () {
          state.filters.search = search.value.trim();
          renderActivityTable();
        }, 150)
      );
    }

    document.getElementById("btnResetTable")?.addEventListener("click", function () {
      state.filters = { satker: "ALL", component: "ALL", status: "ALL", search: "" };
      state.sort = { key: "no", dir: "asc" };
      if (satkerFilter) satkerFilter.value = "ALL";
      if (componentFilter) componentFilter.value = "ALL";
      if (statusFilter) statusFilter.value = "ALL";
      if (search) search.value = "";
      renderActivityTable();
      showToast("Filter dan urutan kegiatan telah direset.");
    });

    document.querySelectorAll("th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        const key = th.getAttribute("data-sort");
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        } else {
          state.sort.key = key;
          state.sort.dir = "desc";
        }
        renderActivityTable();
      });
      th.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          th.click();
        }
      });
      th.setAttribute("tabindex", "0");
    });

    const tbody = document.getElementById("activityTableBody");
    if (tbody) {
      tbody.addEventListener("click", function (event) {
        const row = event.target.closest("tr[data-code]");
        if (row) openModal(row.getAttribute("data-code"));
      });
      tbody.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        const row = event.target.closest("tr[data-code]");
        if (!row) return;
        event.preventDefault();
        openModal(row.getAttribute("data-code"));
      });
    }

    const attention = document.getElementById("attentionList");
    if (attention) {
      const openFromAttention = function (event) {
        const item = event.target.closest("[data-code]");
        if (item) openModal(item.getAttribute("data-code"));
      };
      attention.addEventListener("click", openFromAttention);
      attention.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFromAttention(event);
        }
      });
    }

    const dipaList = document.getElementById("dipaList");
    if (dipaList) {
      dipaList.addEventListener("click", function (event) {
        const item = event.target.closest("[data-dipa]");
        if (item) openDipa(item.getAttribute("data-dipa"));
      });
      dipaList.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        const item = event.target.closest("[data-dipa]");
        if (!item) return;
        event.preventDefault();
        openDipa(item.getAttribute("data-dipa"));
      });
    }

    const dipaScope = document.getElementById("dipaScope");
    if (dipaScope) {
      dipaScope.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-scope]");
        if (!btn || state.dipaDetail !== "p2") return;
        const scope = btn.getAttribute("data-scope");
        if (["p2", "kl", "all"].indexOf(scope) === -1) return;
        if (scope === state.dipaP2Scope) return;
        state.dipaP2Scope = scope;
        renderDipaSection();
      });
    }

    document.getElementById("dipaReset")?.addEventListener("click", closeDipa);

    document.getElementById("btnOpenKurs")?.addEventListener("click", function (event) {
      event.preventDefault();
      openKursModal();
    });

    document.getElementById("btnOpenRealisasiInput")?.addEventListener("click", function (event) {
      event.preventDefault();
      openRealisasiInputModal();
    });

    document.getElementById("realisasiSatker")?.addEventListener("change", function () {
      populateRealisasiKegiatanOptions(this.value);
      showRealisasiAlert("");
      updateRealisasiSaveState();
    });

    document.getElementById("realisasiJenisKegiatan")?.addEventListener("change", function () {
      const kode = document.getElementById("realisasiKode");
      if (kode) kode.value = this.value || "";
      showRealisasiAlert("");
      updateRealisasiSaveState();
    });

    ["realisasiBulan", "realisasiMinggu", "realisasiTanggal", "realisasiJumlah"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () { showRealisasiAlert(""); updateRealisasiSaveState(); });
      el.addEventListener("change", function () { showRealisasiAlert(""); updateRealisasiSaveState(); });
    });

    document.getElementById("btnResetRealisasiInput")?.addEventListener("click", resetRealisasiInputForm);

    document.getElementById("btnSaveRealisasiInput")?.addEventListener("click", function () {
      showRealisasiAlert("");
      const d = getRealisasiFormData();
      const jumlah = Number(d.jumlahRaw);
      const hasPeriod = !!(d.minggu || d.tanggal);
      if (!(d.satkerCode && d.code && d.bulan && hasPeriod && d.jumlahRaw !== "" && Number.isFinite(jumlah) && jumlah >= 0)) {
        showRealisasiAlert("Mohon lengkapi seluruh kolom input sebelum menyimpan data realisasi.");
        updateRealisasiSaveState();
        return;
      }

      const periodKey = makeRealisasiPeriodKey(d.bulan, d.minggu, d.tanggal);
      const duplicate = getRealisasiEntries().some(function (e) {
        return e.code === d.code && e.satkerCode === d.satkerCode && e.periodKey === periodKey;
      });
      if (duplicate) {
        showRealisasiAlert("Data realisasi untuk kombinasi tanggal/minggu tersebut sudah tercatat sebelumnya. Mohon periksa kembali periode input sebelum menyimpan.");
        return;
      }

      const act = (DATA.activities || []).find(function (a) { return a.code === d.code; });
      const entry = {
        id: "rlz-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        satkerCode: d.satkerCode,
        code: d.code,
        activityLabel: act ? (act.activity || act.program || d.code) : d.code,
        bulan: d.bulan,
        minggu: d.minggu,
        tanggal: d.tanggal,
        periodKey: periodKey,
        jumlah: Math.round(jumlah),
        createdAt: new Date().toISOString(),
        dataYear: dataYear,
      };

      const result = applyRealisasiEntry(entry, true);
      if (!result.ok) {
        showRealisasiAlert(result.reason || "Gagal menyimpan data realisasi. Silakan coba kembali.");
        return;
      }

      refreshDashboard();
      closeModal(document.getElementById("realisasiInputModal"));
      resetRealisasiInputForm();
      showToast("Data realisasi berhasil disimpan dan ditampilkan pada dashboard.");
    });

    document.getElementById("kursUsdIdrInput")?.addEventListener("input", updateKursPreview);

    document.getElementById("btnSaveKurs")?.addEventListener("click", function () {
      const input = document.getElementById("kursUsdIdrInput");
      const rate = Number(input && input.value);
      if (!Number.isFinite(rate) || rate <= 0) {
        showToast("Masukkan kurs USD/IDR yang valid.");
        return;
      }
      setUsdIdrRate(Math.round(rate));
      applyGrantDisplay();
      closeModal(document.getElementById("kursModal"));
      showToast("Kurs USD/IDR berhasil disimpan.");
    });

    document.getElementById("btnResetKurs")?.addEventListener("click", function () {
      setUsdIdrRate(DEFAULT_USD_IDR_RATE);
      const input = document.getElementById("kursUsdIdrInput");
      if (input) input.value = String(DEFAULT_USD_IDR_RATE);
      updateKursPreview();
      applyGrantDisplay();
      showToast("Kurs USD/IDR dikembalikan ke default.");
    });

    document.querySelectorAll("[data-close-modal]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal(el.closest(".modal"));
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeModal();
        if (state.dipaDetail) closeDipa();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Init
     ---------------------------------------------------------------------- */

  function init() {
    initTheme();
    applyStoredRealisasiEntries();
    renderYearOptions();
    renderMetadata();
    renderBeranda();
    renderHero();
    renderKPIs();
    renderFinancialBreakdown();
    renderComponentLegend();
    renderStatusLegend();
    renderComponentProgress();
    renderAttentionList();
    renderSatkerTable();
    renderSwakelolaTable();
    renderIndicators();
    renderDipaList();
    populateFilters();
    renderActivityTable();
    renderCharts();
    bindEvents();
    initNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
