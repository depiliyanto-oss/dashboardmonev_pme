(function () {
  "use strict";

  const DATA = window.MONEV_DATA;

  if (!DATA) {
    document.querySelectorAll("#presentations .pv-value, #presentations .pv-kpi-value, #presentations .pv-kpi-value-dark, #presentations .pv-bar-value, #presentations .pv-td").forEach(function (el) {
      el.textContent = "Data tidak tersedia";
    });
    return;
  }

  const nf = new Intl.NumberFormat("id-ID");

  function number(value) {
    return nf.format(Math.round(Number(value) || 0));
  }

  function miliar(value) {
    const text = ((Number(value) || 0) / 1e9).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return text + " Miliar";
  }

  function percent(value) {
    return (Number(value) || 0).toFixed(2) + "%";
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setWidth(id, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute("width", String(value));
  }

  /* Posisikan nilai persentase di dalam kotak bar, mengikuti lebar bar.
     Bar diberi lebar minimum agar angka tetap muat di dalamnya. */
  function setBarValue(valueId, width) {
    const el = document.getElementById(valueId);
    if (!el) return;
    el.setAttribute("x", (565 + width - 10).toFixed(1));
    el.setAttribute("text-anchor", "end");
  }

  const BAR_MIN = 88;  /* lebar minimum kotak bar supaya angka muat */
  const BAR_MAX = 530; /* lebar maksimum bar (chart lebih panjang & presisi) */

  function dipaItem(id) {
    return (DATA.dipa && DATA.dipa.items || []).find(function (item) { return item.id === id; }) || {};
  }

  function ditjenItem(name) {
    return (DATA.ditjenP2 && DATA.ditjenP2.items || []).find(function (item) { return item.satker === name; }) || {};
  }

  /* ----------------------------------------------------------------------
     Header / metadata
     -------------------------------------------------------------------- */
  const metadata = DATA.metadata || {};
  const cutoff = (DATA.dipa && DATA.dipa.cutoff) || metadata.dataAsOf || "-";

  setText("pvDataAsOf", metadata.dataAsOf || "-");
  setText("pvCutoff", "Cut off data: " + cutoff);
  setText("pvFootnote", "Cut off SAKTI (SP2D): " + cutoff);

  /* ----------------------------------------------------------------------
     Alokasi 2026 — dari totals, dipa, ditjenP2 dan klSwakelola
     -------------------------------------------------------------------- */
  const totals = DATA.totals || {};
  const p2 = dipaItem("p2");
  const kesprimkom = dipaItem("kesprimkom");
  const sekjen = dipaItem("sekjen");
  const ditjen = DATA.ditjenP2 || {};
  const swakelola = DATA.klSwakelola || {};

  setText("pvAlokasiTotal", miliar(totals.pagu));
  setText("pvAlokasiP2", miliar(p2.pagu));
  setText("pvAlokasiKesprimkom", miliar(kesprimkom.pagu));
  setText("pvAlokasiSekjen", miliar(sekjen.pagu));
  setText("pvAlokasiDitjenP2", miliar(ditjen.totalPagu));
  setText("pvAlokasiSwakelola", miliar(swakelola.totalPagu));
  setText("pvAlokasiCpmu", miliar(ditjenItem("CPMU").pagu));
  setText("pvAlokasiSkk", miliar(ditjenItem("Dit. SKK").pagu));
  setText("pvAlokasiIspa", miliar(ditjenItem("Dit. ISPA").pagu));
  setText("pvAlokasiZoonosis", miliar(ditjenItem("Dit. Zoonosis").pagu));

  /* ----------------------------------------------------------------------
     Realisasi 2026 — dari totals dan dipa.items
     -------------------------------------------------------------------- */
  setText("pvRealisasiPagu", miliar(totals.pagu));
  setText("pvRealisasiRealisasi", miliar(totals.realisasi));
  setText("pvRealisasiSisa", miliar(totals.sisa));

  const barScale = BAR_MAX / 100; /* 100% = BAR_MAX px pada viewBox */
  const rows = [
    { key: "P2", item: p2, bar: "pvBarP2", value: "pvBarP2Value" },
    { key: "Kesprimkom", item: kesprimkom, bar: "pvBarKesprimkom", value: "pvBarKesprimkomValue" },
    { key: "Sekjen", item: sekjen, bar: "pvBarSekjen", value: "pvBarSekjenValue" },
  ];

  rows.forEach(function (row) {
    const capaian = Number(row.item.capaian) || 0;
    const width = Math.max(BAR_MIN, Math.min(BAR_MAX, capaian * barScale));
    setWidth(row.bar, width.toFixed(1));
    setText(row.value, percent(capaian));
    setBarValue(row.value, width);
    setText("pvTablePagu" + row.key, number(row.item.pagu));
    setText("pvTableRealisasi" + row.key, number(row.item.realisasi));
    setText("pvTableSisa" + row.key, number(row.item.sisa));
    setText("pvTableCapaian" + row.key, percent(capaian));
  });

  const totalCapaian = Number(DATA.dipa && DATA.dipa.totalCapaian || totals.capaian) || 0;
  const totalWidth = Math.max(BAR_MIN, Math.min(BAR_MAX, totalCapaian * barScale));
  setWidth("pvBarTotal", totalWidth.toFixed(1));
  setText("pvBarTotalValue", percent(totalCapaian));
  setBarValue("pvBarTotalValue", totalWidth);
  setWidth("pvTotalHighlight", (565 + totalWidth + 24 - 490).toFixed(1));
  const capaianArrow = document.getElementById("pvCapaianArrow");
  if (capaianArrow) {
    /* Mulai tepat di tepi kanan kotak Total (x = 565 + lebar bar + 24),
       berhenti di border putus-putus luar (x=1117), tidak masuk ke dalam kotak. */
    capaianArrow.setAttribute(
      "d",
      "M" + (565 + totalWidth + 24).toFixed(1) + " 414 H1018 V268 H1117"
    );
  }
  setText("pvTotalCapaian", percent(totalCapaian));
  setText("pvTablePaguTotal", number((DATA.dipa && DATA.dipa.totalPagu) || totals.pagu));
  setText("pvTableRealisasiTotal", number((DATA.dipa && DATA.dipa.totalRealisasi) || totals.realisasi));
  setText("pvTableSisaTotal", number((DATA.dipa && DATA.dipa.totalSisa) || totals.sisa));
  setText("pvTableCapaianTotal", percent(totalCapaian));

  /* ----------------------------------------------------------------------
     Capaian seluruh unit — progress bar dari DATA.satkers
     -------------------------------------------------------------------- */
  const capLabels = {
    "Kementan": "Kementan",
    "Kemenko PMK": "Kemenko PMK",
    "Kemenhut": "Kemenhut",
    "BRIN": "BRIN",
    "Dit. ISPA": "Dit PM ISPA",
    "CPMU CAREI": "CPMU",
    "Dit Zoo": "Dit. PM Zoonosis",
    "Kemenko PM": "Kemenko PM",
    "Dit. SKK": "Dit. SKK",
    "Takel PKP": "Takel PKP",
    "Pusdatin": "Pusdatin",
  };

  const capPercent = function (value) {
    return (Number(value) || 0).toFixed(2).replace(".", ",") + "%";
  };

  const CAP_ROWS = 11;
  const CAP_TRACK = 896; /* lebar track progress bar pada viewBox */
  const satkers = (DATA.satkers || [])
    .slice()
    .sort(function (a, b) { return (Number(b.capaian) || 0) - (Number(a.capaian) || 0); })
    .slice(0, CAP_ROWS);

  for (let i = 1; i <= CAP_ROWS; i++) {
    const item = satkers[i - 1];
    const label = document.getElementById("pvCapLabel" + i);
    const bar = document.getElementById("pvCapBar" + i);
    const value = document.getElementById("pvCapValue" + i);

    if (!item) {
      if (label) label.textContent = "";
      if (bar) bar.setAttribute("width", "0");
      if (value) value.textContent = "";
      continue;
    }

    const capaian = Number(item.capaian) || 0;
    const width = Math.max(0, Math.min(CAP_TRACK, (capaian / 100) * CAP_TRACK));
    const color = capaian >= 60 ? "green" : (capaian >= 30 ? "yellow" : "red");

    if (label) label.textContent = capLabels[item.code] || item.code || item.name || "-";
    if (bar) {
      bar.setAttribute("width", width.toFixed(1));
      bar.setAttribute("class", "pv-cap-bar pv-cap-bar-" + color);
    }
    if (value) value.textContent = capPercent(capaian);
  }

  const capCutoff = String(metadata.dataAsOf || cutoff || "").replace("Oktober", "Okt");
  setText("pvCapCutoff", capCutoff);

  /* ----------------------------------------------------------------------
     Filter capaian: ALL memakai progress bar di atas; filter lainnya
     memakai model bar slide Realisasi 2026 (BAR_MIN/BAR_MAX, label di kiri,
     nilai di dalam bar).
     -------------------------------------------------------------------- */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ALT_X = 250;   /* titik awal bar: chart dirapatkan ke kiri */
  const ALT_MIN = 88;  /* BAR_MIN slide Realisasi */
  const ALT_MAX = 530; /* BAR_MAX slide Realisasi */
  const ALT_GAP = 52;
  const ALT_H = 32;

  const dipaItems = (DATA.dipa && DATA.dipa.items) || [];
  const satkerByCode = {};
  (DATA.satkers || []).forEach(function (item) { satkerByCode[item.code] = item; });

  function dipaById(id) {
    return dipaItems.find(function (item) { return item.id === id; }) || {};
  }

  const ditjenP2Labels = {
    "CPMU": "CPMU CARE-I",
    "Dit. Zoonosis": "Dit. PM Zoonosis",
    "Dit. ISPA": "Dit. PM ISPA",
    "Dit. SKK": "Dit. SKK",
  };

  const capTitles = {
    "p2": "Capaian DIPA P2 - Hanya P2",
    "p2kl": "Capaian DIPA P2 - K/L",
    "p2all": "Capaian DIPA P2 - ALL Satker",
    "kesprimkom": "Capaian DIPA Kesprimkom",
    "sekjen": "Capaian DIPA Sekjen",
  };

  function capAltRows(key) {
    if (key === "p2") {
      return ((DATA.ditjenP2 && DATA.ditjenP2.items) || [])
        .slice()
        .sort(function (a, b) { return (Number(b.capaian) || 0) - (Number(a.capaian) || 0); })
        .map(function (item) {
          return { label: ditjenP2Labels[item.satker] || item.satker, capaian: item.capaian };
        });
    }
    if (key === "p2kl") {
      return ((DATA.klSwakelola && DATA.klSwakelola.items) || [])
        .slice()
        .sort(function (a, b) { return (Number(b.capaian) || 0) - (Number(a.capaian) || 0); })
        .map(function (item) {
          return { label: item.satker, capaian: item.capaian };
        });
    }
    if (key === "p2all") {
      const item = dipaById("p2");
      return (item.satkers || [])
        .map(function (code) {
          return { label: capLabels[code] || code, capaian: (satkerByCode[code] || {}).capaian };
        })
        .sort(function (a, b) { return (Number(b.capaian) || 0) - (Number(a.capaian) || 0); });
    }
    if (key === "kesprimkom") {
      const item = dipaById("kesprimkom");
      return [{ label: "DIPA Kesprimkom", capaian: item.capaian }];
    }
    if (key === "sekjen") {
      const item = dipaById("sekjen");
      return [{ label: "DIPA Sekjen", capaian: item.capaian }];
    }
    return [];
  }

  function capAltTotal(key) {
    if (key === "p2") return (DATA.ditjenP2 && DATA.ditjenP2.totalCapaian);
    if (key === "p2kl") return (DATA.klSwakelola && DATA.klSwakelola.totalCapaian);
    if (key === "p2all") return dipaById("p2").capaian;
    return null;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }

  function renderCapAlt(key) {
    const container = document.getElementById("pvCapAltRows");
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    const rows = capAltRows(key);
    const totalCap = capAltTotal(key);
    const hasTotal = totalCap !== null && totalCap !== undefined;
    const scale = ALT_MAX / 100;
    const chartTop = 80;
    const chartHeight = 490;
    const rowCount = rows.length + (hasTotal ? 1 : 0);
    const stackHeight = rowCount ? (rowCount - 1) * ALT_GAP + ALT_H : 0;
    const top = chartTop + Math.max(0, (chartHeight - stackHeight) / 2);

    rows.forEach(function (row, index) {
      const capaian = Number(row.capaian) || 0;
      const width = Math.max(ALT_MIN, Math.min(ALT_MAX, capaian * scale));
      const y = top + index * ALT_GAP;
      const textY = y + 23;

      const label = svgEl("text", { "class": "pv-cap-alt-label", x: ALT_X - 20, y: textY });
      label.textContent = row.label;
      container.appendChild(label);

      container.appendChild(svgEl("rect", {
        "class": "pv-cap-alt-bar",
        x: ALT_X,
        y: y,
        width: width.toFixed(1),
        height: ALT_H,
      }));

      const value = svgEl("text", {
        "class": "pv-cap-alt-value",
        x: (ALT_X + width - 10).toFixed(1),
        y: textY,
      });
      value.textContent = percent(capaian);
      container.appendChild(value);
    });

    if (hasTotal) {
      const capaian = Number(totalCap) || 0;
      const width = Math.max(ALT_MIN, Math.min(ALT_MAX, capaian * scale));
      const y = top + rows.length * ALT_GAP;
      const textY = y + 23;

      container.appendChild(svgEl("rect", {
        "class": "pv-cap-alt-total-box",
        x: ALT_X - 75,
        y: y - 5,
        width: (width + 107).toFixed(1),
        height: ALT_H + 10,
      }));

      const label = svgEl("text", {
        "class": "pv-cap-alt-label pv-cap-alt-label-total",
        x: ALT_X - 20,
        y: textY,
      });
      label.textContent = "Total";
      container.appendChild(label);

      container.appendChild(svgEl("rect", {
        "class": "pv-cap-alt-bar",
        x: ALT_X,
        y: y,
        width: width.toFixed(1),
        height: ALT_H,
      }));

      const value = svgEl("text", {
        "class": "pv-cap-alt-value",
        x: (ALT_X + width - 10).toFixed(1),
        y: textY,
      });
      value.textContent = percent(capaian);
      container.appendChild(value);
    }
  }

  function applyCapFilter(key) {
    const isAll = key === "all";
    const allView = document.getElementById("pvCapAllView");
    const altView = document.getElementById("pvCapAltView");
    if (allView) allView.classList.toggle("pv-cap-hidden", !isAll);
    if (altView) altView.classList.toggle("pv-cap-hidden", isAll);

    document.querySelectorAll(".pv-filter-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-cap-filter") === key);
    });

    if (!isAll) {
      setText("pvCapAltTitle", capTitles[key] || "Capaian");
      setText("pvCapAltNote", "*Sumber: data dashboard (SP2D) - Cut off " + cutoff);
      renderCapAlt(key);
    }
  }

  document.querySelectorAll(".pv-filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyCapFilter(btn.getAttribute("data-cap-filter"));
    });
  });
  applyCapFilter("all");
})();
