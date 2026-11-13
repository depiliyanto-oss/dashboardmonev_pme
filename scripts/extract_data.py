import argparse
import json
import os
import re
from collections import OrderedDict

import openpyxl

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.join(BASE, "dashboard PME.xlsx")
OUT_JSON = os.path.join(BASE, "data", "monev.json")
OUT_JS = os.path.join(BASE, "js", "monev-data.js")

parser = argparse.ArgumentParser(description="Ekstrak data dashboard CARE-I dari workbook Excel.")
parser.add_argument("--source", default=DEFAULT_SRC, help="Path file Excel sumber")
parser.add_argument("--source-label", default="dashboard PME.xlsx", help="Label sumber yang ditampilkan di dashboard")
parser.add_argument("--synced-at", default="", help="Waktu sinkronisasi (opsional)")
ARGS = parser.parse_args()
SRC = os.path.abspath(ARGS.source)

SHEET_BY_SATKER = {
    "Kemenko PM": "kemenkoPM",
    "Kemenko PMK": "kemenkoPMK",
    "Kemenhut": "Kemenhut",
    "Kementan": "Kementan",
    "BRIN": "BRIN",
    "Pusdatin": "Pusdatin",
    "Takel PKP": "TakelPKP",
    "CPMU CAREI": "CPMU",
    "Dit Zoo": "DitZoo",
    "Dit. ISPA": "DitISPA",
    "Dit. SKK": "DitSKK",
}

COMPONENTS = OrderedDict([
    ("LAB", {"name": "Penguatan Sistem Laboratorium", "short": "Laboratory System", "color": "#0d9488"}),
    ("SURV", {"name": "Penguatan Sistem Surveilans Terpadu", "short": "Surveillance", "color": "#2563eb"}),
    ("RESP", {"name": "Penguatan Kesiapsiagaan & Respons", "short": "Health Response", "color": "#f59e0b"}),
    ("CROSS", {"name": "Komponen Lintas Sektor", "short": "Cross-Cutting", "color": "#8b5cf6"}),
])

SATKER_COMPONENT = {
    "Kemenko PM": "CROSS",
    "Kemenko PMK": "SURV",
    "Kemenhut": "CROSS",
    "Kementan": "SURV",
    "BRIN": "LAB",
    "Pusdatin": "SURV",
    "Takel PKP": "LAB",
    "CPMU CAREI": "CROSS",
    "Dit Zoo": "SURV",
    "Dit. ISPA": "SURV",
    "Dit. SKK": "SURV",
}


def clean(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def num(v):
    if v is None or v == "":
        return 0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0


def pct(part, whole):
    return round((part / whole * 100), 2) if whole else 0.0


def assign_component(satker_code, activity_text):
    t = activity_text.lower()
    if "kontinjensi" in t or "kontijensi" in t:
        return "RESP"
    return SATKER_COMPONENT.get(satker_code, "SURV")


MONTHS = {
    "august": ("Agustus", 8), "agustus": ("Agustus", 8), "aug": ("Agustus", 8),
    "september": ("September", 9), "sep": ("September", 9),
    "october": ("Oktober", 10), "oktober": ("Oktober", 10), "oct": ("Oktober", 10),
    "november": ("November", 11), "nov": ("November", 11),
    "december": ("Desember", 12), "desember": ("Desember", 12), "dec": ("Desember", 12),
}


def parse_period(month_raw, week_raw):
    month = clean(month_raw).lower()
    week = clean(week_raw)
    month_name, month_no = MONTHS.get(month, (clean(month_raw) or "Periode", 9))
    m = re.search(r"W\s*(\d+)", week, re.I)
    week_no = int(m.group(1)) if m else 1
    inner = re.sub(r"W\s*\d+", "", week, flags=re.I)
    day_m = re.search(r"(\d{1,2})", inner)
    day = int(day_m.group(1)) if day_m else None
    if day is None:
        day = 1 + (week_no - 1) * 7
    day = max(1, min(day, 28))
    key = f"2026-{month_no:02d}-{day:02d}"
    label = f"{day} {month_name[:3]}"
    month_label = f"{month_name} 2026"
    return key, label, month_label


wb = openpyxl.load_workbook(SRC, data_only=True)

# --- Totals (sheet A1) ---
ws = wb["A1"]
totals = {
    "pagu": num(ws["A2"].value),
    "realisasi": num(ws["B2"].value),
    "sisa": num(ws["C2"].value),
    "capaian": round(num(ws["D2"].value) * 100, 2),
}

# --- Satker summary (sheet M-KLDT) ---
ws = wb["M-KLDT"]
satkers = []
for r in range(2, ws.max_row + 1):
    code = clean(ws.cell(row=r, column=2).value)
    name = clean(ws.cell(row=r, column=3).value)
    if not code or not name:
        continue
    pagu = num(ws.cell(row=r, column=4).value)
    realisasi = num(ws.cell(row=r, column=5).value)
    capaian = round(num(ws.cell(row=r, column=6).value) * 100, 2)
    if pagu == 0 and realisasi == 0:
        continue
    satkers.append({
        "code": code,
        "name": name,
        "pagu": pagu,
        "realisasi": realisasi,
        "sisa": max(0, pagu - realisasi),
        "capaian": capaian,
        "sheet": SHEET_BY_SATKER.get(code, ""),
    })

# --- Activities (sheet Transc) ---
ws = wb["Transc"]
activities = []
for r in range(3, ws.max_row + 1):
    all_cd = clean(ws.cell(row=r, column=10).value)
    if not all_cd:
        continue
    realisasi = num(ws.cell(row=r, column=11).value)
    sisa = num(ws.cell(row=r, column=14).value)
    pagu = realisasi + sisa
    program = clean(ws.cell(row=r, column=5).value)
    aktivitas = clean(ws.cell(row=r, column=7).value)
    sub = clean(ws.cell(row=r, column=9).value)
    satker_code = clean(ws.cell(row=r, column=2).value)
    comp = assign_component(satker_code, " ".join([program, aktivitas, sub]))
    activities.append({
        "no": int(num(ws.cell(row=r, column=1).value)) if num(ws.cell(row=r, column=1).value) else len(activities) + 1,
        "satkerCode": satker_code,
        "satker": clean(ws.cell(row=r, column=3).value),
        "programCode": clean(ws.cell(row=r, column=4).value),
        "program": program,
        "activityCode": clean(ws.cell(row=r, column=6).value),
        "activity": aktivitas,
        "subActivityCode": clean(ws.cell(row=r, column=8).value),
        "subActivity": sub,
        "code": all_cd,
        "pagu": pagu,
        "realisasi": realisasi,
        "sisa": sisa,
        "capaian": pct(realisasi, pagu),
        "periode": clean(ws.cell(row=r, column=12).value),
        "component": comp,
    })

# --- Weekly time series from each satker sheet ---
timeline = {}
period_meta = {}
for satker in satkers:
    sheet_name = satker["sheet"]
    if not sheet_name or sheet_name not in wb.sheetnames:
        continue
    ws = wb[sheet_name]
    for r in range(1, ws.max_row + 1):
        if clean(ws.cell(row=r, column=8).value) != "Code":
            continue
        header_row = r
        break
    else:
        continue
    s_data = timeline.setdefault(satker["code"], {})
    for r in range(header_row + 1, ws.max_row + 1):
        code = clean(ws.cell(row=r, column=8).value)
        if not code:
            continue
        cum = num(ws.cell(row=r, column=10).value)
        key, label, month_label = parse_period(ws.cell(row=r, column=6).value, ws.cell(row=r, column=7).value)
        period_meta[key] = {"label": label, "month": month_label}
        bucket = s_data.setdefault(key, {})
        bucket[code] = max(bucket.get(code, 0), cum)

date_keys = sorted(period_meta.keys())
trend_labels = [period_meta[k]["label"] for k in date_keys]

trend_cumulative = []
for key in date_keys:
    total = 0
    for satker in satkers:
        s_data = timeline.get(satker["code"], {})
        codes = set()
        for k2 in date_keys:
            if k2 <= key:
                codes.update(s_data.get(k2, {}).keys())
        for code in codes:
            val = 0
            for k2 in date_keys:
                if k2 > key:
                    break
                if code in s_data.get(k2, {}):
                    val = s_data[k2][code]
            total += val
    if trend_cumulative:
        total = max(total, trend_cumulative[-1])
    trend_cumulative.append(total)

months = []
for key in date_keys:
    m = period_meta[key]["month"]
    if not months or months[-1]["month"] != m:
        months.append({"month": m, "endKey": key})
    else:
        months[-1]["endKey"] = key
monthly = []
prev = 0
for mo in months:
    idx = date_keys.index(mo["endKey"])
    end_val = trend_cumulative[idx]
    monthly.append({"month": mo["month"], "realisasi": max(0, end_val - prev)})
    prev = end_val

# --- Component aggregation from activities ---
component_map = {cid: {"id": cid, **meta, "pagu": 0.0, "realisasi": 0.0, "sisa": 0.0, "activities": 0} for cid, meta in COMPONENTS.items()}
satker_base = {}
for s in satkers:
    base = SATKER_COMPONENT.get(s["code"], "SURV")
    satker_base[s["code"]] = base
    component_map[base]["pagu"] += s["pagu"]
for a in activities:
    base = satker_base.get(a["satkerCode"], "SURV")
    cid = a["component"]
    if cid != base:
        component_map[base]["pagu"] -= a["pagu"]
        component_map[cid]["pagu"] += a["pagu"]
    component_map[cid]["realisasi"] += a["realisasi"]
    component_map[cid]["activities"] += 1
components = []
for c in component_map.values():
    c["sisa"] = max(0, c["pagu"] - c["realisasi"])
    c["capaian"] = pct(c["realisasi"], c["pagu"])
    c["share"] = pct(c["pagu"], totals["pagu"])
    components.append(c)

# --- Status summary by activity capaian ---
status_counts = {"Tercapai": 0, "Berprogres": 0, "Perlu Perhatian": 0, "Belum Realisasi": 0}
for a in activities:
    if a["realisasi"] <= 0:
        status_counts["Belum Realisasi"] += 1
    elif a["capaian"] >= 90:
        status_counts["Tercapai"] += 1
    elif a["capaian"] >= 60:
        status_counts["Berprogres"] += 1
    else:
        status_counts["Perlu Perhatian"] += 1
status_summary = {
    "total": len(activities),
    "items": [
        {"label": "Tercapai", "count": status_counts["Tercapai"], "share": pct(status_counts["Tercapai"], len(activities)), "color": "#10b981", "hint": "Realisasi >= 90%"},
        {"label": "Berprogres", "count": status_counts["Berprogres"], "share": pct(status_counts["Berprogres"], len(activities)), "color": "#3b82f6", "hint": "Realisasi 60% - 89%"},
        {"label": "Perlu Perhatian", "count": status_counts["Perlu Perhatian"], "share": pct(status_counts["Perlu Perhatian"], len(activities)), "color": "#f59e0b", "hint": "Realisasi < 60%"},
        {"label": "Belum Realisasi", "count": status_counts["Belum Realisasi"], "share": pct(status_counts["Belum Realisasi"], len(activities)), "color": "#94a3b8", "hint": "Belum ada realisasi"},
    ],
}

# --- 3 DIPA Summary (derived from sheet M-KLDT) ---
satker_lookup = {s["code"]: s for s in satkers}


def group_sum(codes):
    pagu = sum(satker_lookup[c]["pagu"] for c in codes if c in satker_lookup)
    realisasi = sum(satker_lookup[c]["realisasi"] for c in codes if c in satker_lookup)
    return pagu, realisasi, max(0, pagu - realisasi), pct(realisasi, pagu)


DIPA_GROUPS = [
    ("p2", "DIPA P2", ["CPMU CAREI", "Dit. SKK", "Dit. ISPA", "Dit Zoo", "Kemenko PM", "Kemenko PMK", "Kemenhut", "Kementan", "BRIN"]),
    ("kesprimkom", "DIPA Kesprimkom", ["Takel PKP"]),
    ("sekjen", "DIPA Sekjen", ["Pusdatin"]),
]
dipa_items = []
for gid, gname, codes in DIPA_GROUPS:
    pagu, realisasi, sisa, capaian = group_sum(codes)
    dipa_items.append({
        "id": gid,
        "name": gname,
        "pagu": pagu,
        "realisasi": realisasi,
        "sisa": sisa,
        "capaian": capaian,
        "satkers": codes,
    })
dipa_summary = {
    "cutoff": "01 Oktober 2026",
    "totalPagu": totals["pagu"],
    "totalRealisasi": totals["realisasi"],
    "totalSisa": totals["sisa"],
    "totalCapaian": totals["capaian"],
    "items": dipa_items,
}

# --- K/L Swakelola Tipe II Summary (derived from sheet M-KLDT) ---
KL_META = {
    "Kemenko PM": {
        "kontrak": "9 Juli 2026",
        "transfer": "23 Juli 2026",
        "kegiatan": "Assesment PSA, Pembayaran tenaga Social Protection Specialist, Diseminasi Hasil Asesmen Implementasi PSA, Pembahasan Penyusunan Konsep Kebijakan PSA",
        "ket": "Kontrak Swakelola per tgl 9 Juli 2026",
    },
    "Kemenko PMK": {
        "kontrak": "22 Juli 2026",
        "transfer": "31 Juli 2026",
        "kegiatan": "Rapat Koordinasi SIZE, Clearance SIZE, Penyusunan dan Pembahasan Modul Surveilans Berbasis Masyarakat untuk Forum PRB, Simulasi Respon Zoonosis",
        "ket": "Kontrak Swakelola per tgl 22 Juli 2026",
    },
    "Kemenhut": {
        "kontrak": "8 Sept 2026",
        "transfer": "15 September 2026",
        "kegiatan": "Surveilans satwa liar dan koordinasi perlindungan biodiversitas antarmuka habitat",
        "ket": "Kontrak Swakelola per tgl 8 Sept 2026",
    },
    "Kementan": {
        "kontrak": "14 Ags 2026",
        "transfer": "26 Agustus 2026",
        "kegiatan": "Kick Off Program CARE-I Tahun 2026 dan Rapat Koordinasi Laboratorium, Lokakarya Reviu dan Pemuktahiran Kurikulum PELVI, Pelatihan Assesor Laboratory",
        "ket": "Kontrak Swakelola per tgl 14 Ags 2026",
    },
    "BRIN": {
        "kontrak": "19 Ags 2026",
        "transfer": "2 September 2026",
        "kegiatan": "Kick Off Meeting Penelitian dan penguatan surveilans genomik patogen prioritas",
        "ket": "Kontrak Swakelola per tgl 19 Ags 2026",
    },
}
KL_CODES = ["Kemenko PM", "Kemenko PMK", "Kemenhut", "Kementan", "BRIN"]
kl_items = []
for code in KL_CODES:
    s = satker_lookup.get(code)
    if not s:
        continue
    item = {
        "satker": code,
        "pagu": s["pagu"],
        "realisasi": s["realisasi"],
        "sisa": s["sisa"],
        "capaian": s["capaian"],
    }
    item.update(KL_META.get(code, {}))
    kl_items.append(item)
kl_pagu = sum(i["pagu"] for i in kl_items)
kl_realisasi = sum(i["realisasi"] for i in kl_items)
kl_swakelola = {
    "totalPagu": kl_pagu,
    "totalRealisasi": kl_realisasi,
    "totalSisa": max(0, kl_pagu - kl_realisasi),
    "totalCapaian": pct(kl_realisasi, kl_pagu),
    "items": kl_items,
}

# --- Ditjen P2 Internal Detail (derived from sheet M-KLDT) ---
DITJEN_P2_CODES = [
    ("Dit. SKK", "Dit. SKK"),
    ("Dit. ISPA", "Dit. ISPA"),
    ("Dit Zoo", "Dit. Zoonosis"),
    ("CPMU CAREI", "CPMU"),
]
ditjen_items = []
for code, label in DITJEN_P2_CODES:
    s = satker_lookup.get(code)
    if not s:
        continue
    ditjen_items.append({
        "satker": label,
        "pagu": s["pagu"],
        "realisasi": s["realisasi"],
        "sisa": s["sisa"],
        "capaian": s["capaian"],
    })
p2_pagu = sum(i["pagu"] for i in ditjen_items)
p2_realisasi = sum(i["realisasi"] for i in ditjen_items)
ditjen_p2_detail = {
    "totalPagu": p2_pagu,
    "totalRealisasi": p2_realisasi,
    "totalSisa": max(0, p2_pagu - p2_realisasi),
    "totalCapaian": pct(p2_realisasi, p2_pagu),
    "cutoff": "15 September 2026 (SP2D)",
    "items": ditjen_items,
}

# --- M&E Indicators CARE-I (Slide 12 & Dasbor Kinerja CARE-I 2026.png) ---
indicators_data = {
    "summary": {
        "total": 51,
        "target2026": 40,
        "tercapai": 12,
        "berprogres": 22,
        "perluPerhatian": 5,
        "tanpaTarget": 11,
        "tanpaPic": 1,
        "tercapaiPct": 58,
        "berprogresPct": 19,
        "perluPerhatianPct": 3,
        "tanpaPicPct": 20,
    },
    "resultsFramework": {
        "total": 11,
        "tercapai": 2,
        "berprogres": 9,
        "perluPerhatian": 0,
        "items": [
            {"code": "PDO-1", "name": "Persentase sinyal kejadian luar biasa / potensi pandemi yang terverifikasi dan ditindaklanjuti dalam waktu 48 jam", "satker": "Dit. SKK & Dit. ISPA", "baseline": "45%", "target2026": "70%", "achievement": "74%", "status": "Tercapai", "mov": "Laporan Sistem Verifikasi Sinyal SKDR / EWARS"},
            {"code": "PDO-2", "name": "Jumlah laboratorium kesehatan dan veteriner terakreditasi yang memenuhi standar One Health untuk deteksi patogen prioritas", "satker": "BRIN & Takel PKP", "baseline": "12 Lab", "target2026": "24 Lab", "achievement": "20 Lab", "status": "Berprogres", "mov": "Sertifikat akreditasi ISO/IEC 17025 & audit lab"},
            {"code": "PDO-3", "name": "Indeks kesiapsiagaan darurat kesehatan masyarakat lintas sektor di provinsi percontohan", "satker": "CPMU CAREI", "baseline": "52.0", "target2026": "65.0", "achievement": "63.5", "status": "Berprogres", "mov": "Survei kesiapsiagaan IHR & One Health scorecard"},
            {"code": "PDO-4", "name": "Tingkat integrasi platform surveilans multisektor (Kemenkes, Kementan, Kemenhut, BRIN)", "satker": "Pusdatin & Kemenko PMK", "baseline": "Terpisah", "target2026": "Interoperabel", "achievement": "Pilot Terintegrasi", "status": "Berprogres", "mov": "Dokumen integrasi API SATUSEHAT & SIZE"},
            {"code": "IRI-1", "name": "Jumlah tenaga surveilans dan respon cepat yang terlatih epidemiologi lapangan (FETP / PELVI)", "satker": "Kementan & Dit. SKK", "baseline": "240 orang", "target2026": "500 orang", "achievement": "525 orang", "status": "Tercapai", "mov": "Database alumni pelatihan & sertifikat Bapelkes"},
            {"code": "IRI-2", "name": "Penyusunan modul dan pelaksanaan simulasi meja (TTX) kesiapsiagaan pandemi tingkat nasional", "satker": "Kemenko PMK", "baseline": "Draft konsep", "target2026": "1 Simulasi TTX", "achievement": "Pelaksanaan 1 TTX", "status": "Berprogres", "mov": "Laporan AAR (After Action Review) simulasi"},
            {"code": "IRI-3", "name": "Adopsi kerangka Perlindungan Sosial Adaptif (PSA) untuk respon pandemi di kementerian teknis", "satker": "Kemenko PM", "baseline": "Belum ada", "target2026": "Dokumen Kebijakan", "achievement": "Konsep Draft Final", "status": "Berprogres", "mov": "Naskah kebijakan PSA dan rekomendasi Menko"},
            {"code": "IRI-4", "name": "Peningkatan surveilans aktif zoonosis prioritas di satwa liar dan antarmuka habitat", "satker": "Kemenhut & Dit. Zoo", "baseline": "5 Wilayah", "target2026": "12 Wilayah", "achievement": "9 Wilayah", "status": "Berprogres", "mov": "Laporan surveilans lapangan BKSDA & Dit. Zoo"},
            {"code": "IRI-5", "name": "SOP bersama investigasi wabah zoonosis dan resistensi antimikroba (AMR)", "satker": "Dit. Zoo & Kementan", "baseline": "2 SOP", "target2026": "6 SOP", "achievement": "5 SOP", "status": "Berprogres", "mov": "SK penetapan SOP lintas kementerian"},
            {"code": "IRI-6", "name": "Operasionalisasi sekretariat One Health nasional dan dasbor pemantauan terpadu", "satker": "CPMU CAREI", "baseline": "Fasilitasi awal", "target2026": "Aktif Berkala", "achievement": "Aktif Berkala", "status": "Berprogres", "mov": "Notula rapat sekretariat & Dashboard Monev"},
            {"code": "IRI-7", "name": "Pelaksanaan surveilans genomik patogen emerging di laboratorium jejaring rujukan", "satker": "BRIN & Dit. SKK", "baseline": "150 isolat/bln", "target2026": "400 isolat/bln", "achievement": "360 isolat/bln", "status": "Berprogres", "mov": "Data repositori GISAID / INA-Genomik"},
        ],
    },
    "specificIndicators": {
        "total": 40,
        "target2026": 29,
        "tercapai": 10,
        "berprogres": 13,
        "perluPerhatian": 5,
        "tanpaTarget": 11,
        "tanpaPic": 1,
        "items": [
            {"code": "IND-01", "name": "Pelatihan assesor laboratory biosafety dan biosecurity", "satker": "Kementan", "baseline": "0 batch", "target2026": "2 batch", "achievement": "2 batch", "status": "Tercapai", "mov": "Laporan kegiatan dan sertifikat"},
            {"code": "IND-02", "name": "Pemutakhiran kurikulum PELVI One Health veteriner", "satker": "Kementan", "baseline": "Kurikulum lama", "target2026": "Kurikulum baru", "achievement": "Reviu selesai", "status": "Tercapai", "mov": "Buku kurikulum PELVI 2026"},
            {"code": "IND-03", "name": "Surveilans sindromik ISPA/ILI berbasis fasilitas pelayanan kesehatan", "satker": "Dit. ISPA", "baseline": "120 faskes", "target2026": "300 faskes", "achievement": "315 faskes", "status": "Tercapai", "mov": "Data faskes aktif di SKDR"},
            {"code": "IND-04", "name": "Rapat koordinasi teknis jejaring laboratorium One Health", "satker": "Takel PKP", "baseline": "1 kali", "target2026": "4 kali", "achievement": "4 kali", "status": "Tercapai", "mov": "Notula rakor laboratorium"},
            {"code": "IND-05", "name": "Penyusunan modul surveilans berbasis masyarakat untuk Forum PRB", "satker": "Kemenko PMK", "baseline": "Belum ada", "target2026": "1 Modul", "achievement": "Modul selesai", "status": "Tercapai", "mov": "Dokumen modul final"},
            {"code": "IND-06", "name": "Clearance dan standarisasi arsitektur Sistem Informasi Zoonosis (SIZE)", "satker": "Kemenko PMK", "baseline": "Tahap review", "target2026": "Clearance terbit", "achievement": "Clearance terbit", "status": "Tercapai", "mov": "Surat persetujuan arsitektur"},
            {"code": "IND-07", "name": "Diseminasi hasil asesmen implementasi PSA", "satker": "Kemenko PM", "baseline": "0 sesi", "target2026": "1 sesi", "achievement": "1 sesi", "status": "Tercapai", "mov": "Dokumen diseminasi"},
            {"code": "IND-08", "name": "Penyusunan pedoman surveilans penyakit infeksi emerging pada satwa liar", "satker": "Kemenhut", "baseline": "Draft awal", "target2026": "Pedoman selesai", "achievement": "Pedoman selesai", "status": "Tercapai", "mov": "Buku pedoman Kemenhut"},
            {"code": "IND-09", "name": "Pengadaan reagen dan biomarker laboratorium rujukan nasional", "satker": "Takel PKP", "baseline": "30%", "target2026": "80%", "achievement": "88%", "status": "Tercapai", "mov": "Berita Acara Serah Terima (BAST)"},
            {"code": "IND-10", "name": "Kick-off meeting penelitian kolaboratif riset pandemi CARE-I", "satker": "BRIN", "baseline": "Belum terlaksana", "target2026": "Terlaksana", "achievement": "Terlaksana 19 Ags", "status": "Tercapai", "mov": "Laporan kick-off & MoA"},
            {"code": "IND-11", "name": "Simulasi respons cepat zoonosis terintegrasi di daerah berisiko tinggi", "satker": "Dit. Zoo & Kemenko PMK", "baseline": "0 wilayah", "target2026": "3 wilayah", "achievement": "2 wilayah", "status": "Berprogres", "mov": "Laporan simulasi lapangan"},
            {"code": "IND-12", "name": "Surveilans genomik avian influenza dan patogen pernapasan emerging", "satker": "Dit. ISPA & BRIN", "baseline": "50 sekuens", "target2026": "200 sekuens", "achievement": "175 sekuens", "status": "Berprogres", "mov": "Log data INA-Genomik"},
            {"code": "IND-13", "name": "Implementasi sistem peringatan dini EWARS/SKDR di daerah 3T", "satker": "Dit. SKK", "baseline": "40 faskes", "target2026": "100 faskes", "achievement": "82 faskes", "status": "Berprogres", "mov": "Laporan mingguan SKDR"},
            {"code": "IND-14", "name": "Pengembangan modul integrasi SatuSehat dengan SIZE", "satker": "Pusdatin", "baseline": "Tahap desain", "target2026": "Beta Testing", "achievement": "Desain API siap", "status": "Berprogres", "mov": "Dokumen spesifikasi API"},
            {"code": "IND-15", "name": "Pelatihan biosafety level 2/3 bagi pranata laboratorium daerah", "satker": "Takel PKP & BRIN", "baseline": "50 analis", "target2026": "150 analis", "achievement": "110 analis", "status": "Berprogres", "mov": "Daftar hadir & nilai uji"},
            {"code": "IND-16", "name": "Pembentukan Tim Gerak Cepat (TGC) One Health kabupaten/kota percontohan", "satker": "Dit. SKK", "baseline": "10 TGC", "target2026": "30 TGC", "achievement": "22 TGC", "status": "Berprogres", "mov": "SK Tim Gerak Cepat daerah"},
            {"code": "IND-17", "name": "Surveilans AMR pada rantai pangan hewani dan lingkungan", "satker": "Kementan", "baseline": "100 sampel", "target2026": "400 sampel", "achievement": "285 sampel", "status": "Berprogres", "mov": "Laporan lab isolasi AMR"},
            {"code": "IND-18", "name": "Penguatan logistik dan rantai dingin spesimen darurat kesehatan", "satker": "CPMU CAREI", "baseline": "Kapasitas dasar", "target2026": "Peralatan tiba", "achievement": "Dalam pengadaan", "status": "Berprogres", "mov": "Dokumen PO pengadaan"},
            {"code": "IND-19", "name": "Penyusunan policy brief rekomendasi perlindungan sosial pandemi", "satker": "Kemenko PM", "baseline": "Kajian", "target2026": "1 Policy Brief", "achievement": "Draft final", "status": "Berprogres", "mov": "Dokumen policy brief"},
            {"code": "IND-20", "name": "Uji petik dan monitoring mutu eksternal (PME) lab daerah", "satker": "Takel PKP", "baseline": "20 lab", "target2026": "60 lab", "achievement": "45 lab", "status": "Berprogres", "mov": "Sertifikat hasil PME"},
            {"code": "IND-21", "name": "Kemitraan riset zoonosis dengan universitas dan lembaga riset internasional", "satker": "BRIN", "baseline": "1 MoU", "target2026": "3 MoU", "achievement": "2 MoU aktif", "status": "Berprogres", "mov": "Naskah MoU kolaborasi"},
            {"code": "IND-22", "name": "Penyusunan rencana kontinjensi KLB/pandemi tingkat provinsi", "satker": "Dit. SKK", "baseline": "2 provinsi", "target2026": "6 provinsi", "achievement": "4 provinsi", "status": "Berprogres", "mov": "Dokumen Renkon Daerah"},
            {"code": "IND-23", "name": "Sosialisasi dan komunikasi risiko kesehatan One Health ke komunitas", "satker": "CPMU CAREI", "baseline": "5 konten", "target2026": "25 konten", "achievement": "19 konten", "status": "Berprogres", "mov": "Publikasi media & kanal Kemenkes"},
            {"code": "IND-24", "name": "Akreditasi laboratorium biosafety level 3 (BSL-3) rujukan nasional", "satker": "BRIN", "baseline": "Pra-akreditasi", "target2026": "Sertifikat terbit", "achievement": "Audit tertunda", "status": "Perlu Perhatian", "mov": "Laporan audit KAN"},
            {"code": "IND-25", "name": "Interkoneksi data surveilans satwa liar dengan platform nasional", "satker": "Kemenhut & Pusdatin", "baseline": "Sistem terisolasi", "target2026": "Bridge API aktif", "achievement": "Koneksi terkendala", "status": "Perlu Perhatian", "mov": "Uji konektivitas gateway"},
            {"code": "IND-26", "name": "Pengadaan mobil laboratorium bergerak (Mobile Lab PCR One Health)", "satker": "Dit. SKK", "baseline": "0 unit", "target2026": "2 unit", "achievement": "Proses lelang ulang", "status": "Perlu Perhatian", "mov": "Berita acara tender LPSE"},
            {"code": "IND-27", "name": "Distribusi biomarker diagnostik cepat ke puskesmas daerah perbatasan", "satker": "Takel PKP", "baseline": "0%", "target2026": "70%", "achievement": "28%", "status": "Perlu Perhatian", "mov": "Surat jalan ekspedisi logistik"},
            {"code": "IND-28", "name": "Penyusunan regulasi perlindungan nakes garis depan saat krisis", "satker": "CPMU CAREI", "baseline": "Draft inisiasi", "target2026": "Permenkes disahkan", "achievement": "Harmonisasi hukum", "status": "Perlu Perhatian", "mov": "Naskah harmonisasi Kemenkumham"},
            {"code": "IND-29", "name": "Standarisasi biobank nasional spesimen zoonosis dan emerging disease", "satker": "BRIN & Kemenkes", "baseline": "Protokol awal", "target2026": "Target 2027", "achievement": "Kesiapan fasilitas", "status": "Tanpa Target 2026", "mov": "Rencana kerja 2027"},
            {"code": "IND-30", "name": "Sertifikasi keahlian One Health berskala internasional bagi 100 narasumber", "satker": "Kemenkes", "baseline": "0 orang", "target2026": "Target 2027", "achievement": "Persiapan silabus", "status": "Tanpa Target 2026", "mov": "PKS lembaga sertifikasi"},
            {"code": "IND-31", "name": "Penerapan AI/Machine Learning untuk peramalan wabah penyakit emerging", "satker": "Pusdatin & BRIN", "baseline": "Model konsep", "target2026": "Target 2027", "achievement": "Pengumpulan dataset", "status": "Tanpa Target 2026", "mov": "Dokumen arsitektur model AI"},
            {"code": "IND-32", "name": "Evaluasi dampak komprehensif implementasi proyek CARE-I paruh waktu (MTR)", "satker": "CPMU CAREI", "baseline": "Belum terjadwal", "target2026": "Target 2027", "achievement": "Jadwal WB ISM 2027", "status": "Tanpa Target 2026", "mov": "Term of Reference MTR"},
            {"code": "IND-33", "name": "Kajian kesenjangan infrastruktur IHR tingkat pelabuhan dan bandara", "satker": "Dit. SKK", "baseline": "Survei awal", "target2026": "Target 2028", "achievement": "Instrumen asesmen", "status": "Tanpa Target 2026", "mov": "Laporan asesmen pelabuhan"},
            {"code": "IND-34", "name": "Penguatan kapasitas produksi kit diagnostik mandiri dalam negeri", "satker": "BRIN", "baseline": "Riset lab", "target2026": "Target 2027", "achievement": "Uji validasi klinis", "status": "Tanpa Target 2026", "mov": "Protokol validasi kit"},
            {"code": "IND-35", "name": "Ekspansi jaringan surveillance sentinel vektor di 34 provinsi", "satker": "Dit. Zoo", "baseline": "15 provinsi", "target2026": "Target 2028", "achievement": "Pemetaan lokus", "status": "Tanpa Target 2026", "mov": "Peta titik sentinel"},
            {"code": "IND-36", "name": "Platform partisipasi publik pelaporan morbiditas satwa liar berbasis warga", "satker": "Kemenhut", "baseline": "Konsep ide", "target2026": "Target 2027", "achievement": "Prototype mobile app", "status": "Tanpa Target 2026", "mov": "Demo aplikasi citizen science"},
            {"code": "IND-37", "name": "Penyusunan Rencana Tindak Lanjut Keberlanjutan Hibah Pasca 2028", "satker": "CPMU CAREI", "baseline": "Belum ada", "target2026": "Target 2028", "achievement": "Belum dimulai", "status": "Tanpa Target 2026", "mov": "Dokumen Sustainability Plan"},
            {"code": "IND-38", "name": "Kajian komparatif respon pandemi One Health antar-negara ASEAN", "satker": "Kemenko PMK", "baseline": "Belum ada", "target2026": "Target 2027", "achievement": "Penyusunan proposal", "status": "Tanpa Target 2026", "mov": "Proposal kajian ASEAN"},
            {"code": "IND-39", "name": "Pembangunan repository terbuka metadata riset genomik patogen nasional", "satker": "BRIN", "baseline": "Rancangan", "target2026": "Target 2027", "achievement": "Penyusunan server", "status": "Tanpa Target 2026", "mov": "Portal data repositori"},
            {"code": "IND-40", "name": "Surveilans sindromik limbah lingkungan (Wastewater-Based Epidemiology)", "satker": "Belum Ditentukan", "baseline": "0 lokasi", "target2026": "Tahap Kajian", "achievement": "Kajian awal", "status": "Tanpa PIC", "mov": "Kajian kelayakan WBE"},
        ],
    },
}

# --- DA Replenishment & AWPB (Slide 13 & 16) ---
replenishment_data = {
    "cutoff": "11 September 2026",
    "rkbi": {
        "initialDepositUSD": 2989416.49,
        "initialDepositIDR": 53459735090.67,
        "sufUSD": 2526293.49,
        "sufIDR": 45303675937.67,
    },
    "needs": {
        "kebutuhanTermin2KL_IDR": 4082642748.0,
        "perkiraanKebutuhanSatker_IDR": 22352068161.0,
        "totalKebutuhan_IDR": 26434710909.0,
        "totalKebutuhan_USD": 1652169.43,
    },
    "awpb2027": {
        "status": "Usulan AWPB TA 2027 Sedang Difinalisasi",
        "prioritas": [
            "Akselerasi Penguatan Jejaring Laboratorium BSL-2 dan BSL-3 Terakreditasi",
            "Ekspansi Integrasi Sistem Surveilans Antar K/L (SATUSEHAT, SIZE, ISIKHNAS)",
            "Penguatan Surveilans Lapangan Antarmuka Satwa Liar dan Lingkungan (One Health)",
            "Pelatihan Berkelanjutan FETP dan Tenaga Surveilans Lapangan",
        ],
    },
}

# --- Sinergisitas Indikator Renstra Kemenkes (Slide 17) ---
renstra_data = {
    "title": "Sinergisitas Indikator Renstra Kemenkes dengan Indikator CARE-I",
    "mappings": [
        {"satker": "Kementan", "indicators": [3, 4, 5, 7, 9], "focus": "Surveilans Zoonosis, Kurikulum PELVI, Standarisasi Lab Veteriner"},
        {"satker": "Kemenhut", "indicators": [7, 9, 10], "focus": "Surveilans Satwa Liar, Antarmuka Habitat, Perlindungan Biodiversitas"},
        {"satker": "Kemenko PM", "indicators": [9, 10, 11], "focus": "Perlindungan Sosial Adaptif (PSA), Kebijakan Sosial Respons Pandemi"},
        {"satker": "Kemenko PMK", "indicators": [6, 8, 9, 10, 11], "focus": "Koordinasi Kebijakan SIZE, Simulasi TTX, Forum PRB Berbasis Masyarakat"},
        {"satker": "BRIN", "indicators": [2, 10], "focus": "Riset Pandemi Kolaboratif, Jejaring Surveilans Genomik Patogen Emerging"},
    ],
}

# --- Layanan Pengaduan Halo Kemenkes (Slide 15) ---
helpdesk_data = {
    "title": "Layanan Pengaduan Proyek CARE-I",
    "subtitle": "Punya keluhan, masukan, atau pertanyaan terkait kegiatan ini? Sampaikan kepada kami melalui Halo Kemenkes.",
    "hotline": "1500-567",
    "email": "kontak@kemkes.go.id",
    "format": 'Mohon sebutkan "Proyek CARE-I" dan nama kegiatan saat menyampaikan pengaduan.',
    "channels": [
        {"name": "Telepon Hotline", "value": "1500-567", "desc": "Layanan resmi 24/7 Halo Kemenkes"},
        {"name": "Email Resmi", "value": "kontak@kemkes.go.id", "desc": "Sertakan subjek: Proyek CARE-I"},
        {"name": "Formulir Dashboard", "value": "Online Ticketing", "desc": "Kirim pengaduan langsung melalui dashboard ini"},
    ],
}

latest_key = date_keys[-1] if date_keys else None
latest_label = period_meta[latest_key]["label"] if latest_key else "-"
latest_month = period_meta[latest_key]["month"] if latest_key else "-"

data = {
    "metadata": {
        "title": "Monitoring dan Evaluasi Kinerja CARE-I Project Tahun 2026",
        "shortTitle": "Dasbor Kinerja CARE-I 2026",
        "subtitle": "Bersama untuk Indonesia lebih sehat dan siap menghadapi pandemi",
        "institution": "Kementerian Kesehatan RI - Direktorat Jenderal P2P",
        "project": "CARE-I Project",
        "program": "Collaborative Approach and Pandemic Preparedness in Indonesia",
        "partner": "The World Bank",
        "fiscalYear": 2026,
        "projectYears": [2026, 2027, 2028],
        "dataAsOf": "01 Oktober 2026",
        "latestPeriod": latest_label,
        "latestMonth": latest_month,
        "grantUSD": 20.72,
        "grantIDR": 331560000000,
        "period": "2025 - 2028",
        "signedGrantDate": "8 Desember 2025",
        "supportMissionDate": "12-14 Januari 2026",
        "closingDate": "31 Agustus 2028",
        "executingAgency": "Kementerian Kesehatan (Kemenkes) sebagai Executing Agency",
        "implementers": ["Kemenkes", "BRIN", "Kementan", "Kemenko PMK", "Kemenko PM", "Kemenhut"],
        "source": ARGS.source_label,
    },
    "totals": totals,
    "satkers": satkers,
    "components": components,
    "activities": activities,
    "trend": {
        "labels": trend_labels,
        "dates": date_keys,
        "cumulative": trend_cumulative,
        "monthly": monthly,
    },
    "statusSummary": status_summary,
    "dipa": dipa_summary,
    "klSwakelola": kl_swakelola,
    "ditjenP2": ditjen_p2_detail,
    "indicators": indicators_data,
    "replenishment": replenishment_data,
    "renstra": renstra_data,
    "helpdesk": helpdesk_data,
}

if ARGS.synced_at:
    data["metadata"]["syncedAt"] = ARGS.synced_at

os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
with open(OUT_JS, "w", encoding="utf-8") as f:
    f.write("window.MONEV_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print("WROTE", OUT_JSON)
print("WROTE", OUT_JS)
print(f"SATKERS: {len(satkers)} | ACTIVITIES: {len(activities)} | INDICATORS: {indicators_data['summary']['total']}")
