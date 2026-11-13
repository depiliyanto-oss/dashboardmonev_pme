/**
 * Data Store & Master Definition
 * Dashboard MONEV Hibah Luar Negeri (SIPHLN)
 * Direktorat Jenderal P2P - Kementerian Kesehatan RI
 */

const MONEV_DATA = {
  metadata: {
    systemName: "SIPHLN Executive MONEV",
    institution: "Direktorat Jenderal Pencegahan dan Pengendalian Penyakit (Ditjen P2P)",
    ministry: "Kementerian Kesehatan Republik Indonesia",
    fiscalYear: 2026,
    lastUpdated: "28 Oktober 2026, 21:45 WIB",
    currency: "IDR"
  },

  units: [
    { id: "ALL", name: "Semua Unit Kerja", code: "ALL" },
    { id: "SET_P2P", name: "Sekretariat Ditjen P2P", code: "SETDITJEN" },
    { id: "P2PM", name: "Direktorat Pencegahan & Pengendalian Penyakit Menular", code: "P2PM" },
    { id: "P2PTM", name: "Direktorat Pencegahan & Pengendalian Penyakit Tidak Menular", code: "P2PTM" },
    { id: "IMUNISASI", name: "Direktorat Pengelolaan Imunisasi", code: "IMUN" },
    { id: "SURKARKES", name: "Direktorat Surveilans & Karantina Kesehatan", code: "SKK" }
  ],

  lenders: [
    { id: "ALL", name: "Semua Lender / Donor", code: "ALL" },
    { id: "GF", name: "Global Fund (GFATM)", code: "GF", color: "#0ea5e9" },
    { id: "WB", name: "World Bank (Bank Dunia)", code: "WB", color: "#10b981" },
    { id: "ADB", name: "Asian Development Bank", code: "ADB", color: "#f59e0b" },
    { id: "GAVI", name: "Gavi, the Vaccine Alliance", code: "GAVI", color: "#8b5cf6" },
    { id: "WHO", name: "World Health Organization", code: "WHO", color: "#ec4899" },
    { id: "BMGF", name: "Bill & Melinda Gates Foundation", code: "BMGF", color: "#06b6d4" }
  ],

  years: [2026, 2027, 2028],

  categories: [
    { id: "PENGADAAN", name: "Pengadaan Alkes & Vaksin", icon: "fa-syringe", color: "#0d9488" },
    { id: "SDM", name: "Pelatihan & Capacity Building", icon: "fa-user-graduate", color: "#3b82f6" },
    { id: "DIGITAL", name: "Surveilans & Digitalisasi Sistem", icon: "fa-network-wired", color: "#8b5cf6" },
    { id: "MONEV", name: "Operasional, Supervisi & MONEV", icon: "fa-clipboard-check", color: "#f59e0b" }
  ],

  // Dataset Proyek PHLN Ditjen P2P
  projects: [
    {
      id: "PRJ-001",
      code: "GF-ATM-2026",
      name: "Penguatan Eliminasi Tuberkulosis, HIV & Malaria Lintas Wilayah",
      unitId: "P2PM",
      unitName: "Direktorat P2PM",
      lenderId: "GF",
      lenderName: "Global Fund",
      year: 2026,
      grantNo: "IDN-Z-MOH-2026",
      allocation: 485000000000, // Rp 485 M
      realization: 397700000000, // Rp 397.7 M (82%)
      status: "On Track",
      category: "PENGADAAN",
      tw1: 85000000000,
      tw2: 122000000000,
      tw3: 110700000000,
      tw4: 80000000000, // Proyeksi / Berjalan
      progressPhysical: 84.5,
      activitiesCount: 18,
      indicator: "Penemuan kasus TB sensitif obat & cakupan ARV 92%",
      activities: [
        { name: "Pengadaan Reagen TCM GeneXpert TB Multi-Catridge", budget: 185000000000, realized: 172000000000, progress: 93, status: "Selesai" },
        { name: "Penyediaan Obat ARV Lini 1 dan Lini 2 Pasien Dewasa/Anak", budget: 145000000000, realized: 120500000000, progress: 83, status: "On Track" },
        { name: "Distribusi Kelambu Berinsektisida Daerah Endemis Malaria", budget: 95000000000, realized: 72000000000, progress: 76, status: "On Track" },
        { name: "Supervisi Klinis Terpadu TB-HIV di 38 Provinsi", budget: 60000000000, realized: 33200000000, progress: 55, status: "On Track" }
      ]
    },
    {
      id: "PRJ-002",
      code: "WB-CAREI-01",
      name: "Strengthening Pandemic Preparedness & Health Security (CARE-I)",
      unitId: "SURKARKES",
      unitName: "Direktorat Surkarkes",
      lenderId: "WB",
      lenderName: "World Bank",
      year: 2026,
      grantNo: "WB-LOAN-9411-ID",
      allocation: 320000000000, // Rp 320 M
      realization: 246400000000, // Rp 246.4 M (77%)
      status: "On Track",
      category: "DIGITAL",
      tw1: 52000000000,
      tw2: 78000000000,
      tw3: 74400000000,
      tw4: 42000000000,
      progressPhysical: 79.2,
      activitiesCount: 14,
      indicator: "100% Pintu Masuk Negara Terkoneksi Sistem Early Warning SATUSEHAT",
      activities: [
        { name: "Modernisasi Thermal Scanner & Biosafety Lab di 15 Pelabuhan Internasional", budget: 120000000000, realized: 98000000000, progress: 82, status: "On Track" },
        { name: "Integrasi Pelaporan Real-Time Surveilans Vektor & Zoonosis", budget: 85000000000, realized: 68400000000, progress: 80, status: "On Track" },
        { name: "Pelatihan Simulasi Tabletop Tanggap Kedaruratan PHEIC Lintas Sektor", budget: 65000000000, realized: 50000000000, progress: 77, status: "On Track" },
        { name: "Pengembangan Dashboard Predictive AI Wabah Penyakit Menular", budget: 50000000000, realized: 30000000000, progress: 60, status: "On Track" }
      ]
    },
    {
      id: "PRJ-003",
      code: "GAVI-VAC-2026",
      name: "Perluasan Cakupan Imunisasi Rutin & Introduksi Vaksin Baru (HPV, PCV, Rotavirus)",
      unitId: "IMUNISASI",
      unitName: "Direktorat Pengelolaan Imunisasi",
      lenderId: "GAVI",
      lenderName: "GAVI",
      year: 2026,
      grantNo: "GAVI-HSS-2026-ID",
      allocation: 275000000000, // Rp 275 M
      realization: 228250000000, // Rp 228.25 M (83%)
      status: "On Track",
      category: "PENGADAAN",
      tw1: 65000000000,
      tw2: 71000000000,
      tw3: 56250000000,
      tw4: 36000000000,
      progressPhysical: 85.0,
      activitiesCount: 12,
      indicator: "Cakupan Imunisasi Dasar Lengkap (IDL) Nasional > 95%",
      activities: [
        { name: "Pengadaan Cold Chain Solar Direct Drive (SDD) Daerah Terpencil", budget: 110000000000, realized: 95000000000, progress: 86, status: "Selesai" },
        { name: "Sosialisasi & Edukasi Vaksinasi Human Papillomavirus (HPV) Nasional", budget: 70000000000, realized: 58000000000, progress: 82, status: "On Track" },
        { name: "Pelatihan Pengelola Rantai Dingin Vaksin di Puskesmas 3T", budget: 55000000000, realized: 45250000000, progress: 82, status: "On Track" },
        { name: "Sistem Logistik Vaksin Elektronik Terintegrasi SMILE", budget: 40000000000, realized: 30000000000, progress: 75, status: "On Track" }
      ]
    },
    {
      id: "PRJ-004",
      code: "WB-PTM-PREV",
      name: "Transformasi Skrining & Manajemen Penyakit Tidak Menular Berbasis Primer",
      unitId: "P2PTM",
      unitName: "Direktorat P2PTM",
      lenderId: "WB",
      lenderName: "World Bank",
      year: 2026,
      grantNo: "WB-PHC-2026-PTM",
      allocation: 190000000000, // Rp 190 M
      realization: 121600000000, // Rp 121.6 M (64%)
      status: "At Risk",
      category: "SDM",
      tw1: 25000000000,
      tw2: 41000000000,
      tw3: 35600000000,
      tw4: 20000000000,
      progressPhysical: 63.4,
      activitiesCount: 11,
      indicator: "Skrining Hipertensi & Diabetes Melitus menjangkau 70% Populasi Sasaran",
      activities: [
        { name: "Distribusi Paket Kit Skrining PTM (Tensimeter Digital, Glukometer) Posyandu", budget: 75000000000, realized: 50000000000, progress: 67, status: "At Risk" },
        { name: "Workshop Kader Kesehatan Primer untuk Layanan Pandu PTM", budget: 50000000000, realized: 32000000000, progress: 64, status: "At Risk" },
        { name: "Kampanye Masif 'CERDIK' dan Pengendalian Konsumsi Gula Garam Lemak", budget: 35000000000, realized: 24600000000, progress: 70, status: "On Track" },
        { name: "Sistem Pencatatan Kohort Faktor Risiko PTM di SATUSEHAT", budget: 30000000000, realized: 15000000000, progress: 50, status: "Delayed" }
      ]
    },
    {
      id: "PRJ-005",
      code: "ADB-RES-01",
      name: "Peningkatan Kapasitas Laboratorium Kesehatan Masyarakat (Labkesmas) P2P",
      unitId: "SET_P2P",
      unitName: "Sekretariat Ditjen P2P",
      lenderId: "ADB",
      lenderName: "ADB",
      year: 2026,
      grantNo: "ADB-GRANT-0811",
      allocation: 145000000000, // Rp 145 M
      realization: 105850000000, // Rp 105.85 M (73%)
      status: "On Track",
      category: "PENGADAAN",
      tw1: 22000000000,
      tw2: 36000000000,
      tw3: 31850000000,
      tw4: 16000000000,
      progressPhysical: 75.8,
      activitiesCount: 9,
      indicator: "12 Unit BBLK/BTKLPP Terakreditasi BSL-2 dan ISO 15189",
      activities: [
        { name: "Renovasi dan Pengadaan Alat Sekuensing Genomik Patogen (NGS)", budget: 68000000000, realized: 51000000000, progress: 75, status: "On Track" },
        { name: "Pelatihan Ahli Bioinformatika Labkesmas Ditjen P2P", budget: 32000000000, realized: 24000000000, progress: 75, status: "On Track" },
        { name: "Pengadaan Reagen dan Uji Profisiensi Antar Lab Nasional", budget: 25000000000, realized: 18850000000, progress: 75, status: "On Track" },
        { name: "Monitoring Kepatuhan Biosafety & Biosecurity Fasilitas Lab", budget: 20000000000, realized: 12000000000, progress: 60, status: "On Track" }
      ]
    },
    {
      id: "PRJ-006",
      code: "WHO-SURV-26",
      name: "Dukungan Teknis Eliminasi Arbovirosis (Demam Berdarah Dengue) & Zoonosis",
      unitId: "P2PM",
      unitName: "Direktorat P2PM",
      lenderId: "WHO",
      lenderName: "WHO",
      year: 2026,
      grantNo: "WHO-WP-2026-P2P",
      allocation: 65000000000, // Rp 65 M
      realization: 44200000000, // Rp 44.2 M (68%)
      status: "On Track",
      category: "MONEV",
      tw1: 11000000000,
      tw2: 15000000000,
      tw3: 12200000000,
      tw4: 6000000000,
      progressPhysical: 70.0,
      activitiesCount: 7,
      indicator: "Insidensi Kasus DBD di bawah 10 per 100.000 Penduduk",
      activities: [
        { name: "Penyebaran Nyamuk Ber-Wolbachia di 5 Kota Percontohan", budget: 30000000000, realized: 21000000000, progress: 70, status: "On Track" },
        { name: "Evaluasi Surveilans Entomologi Vektor Nyamuk Aedes", budget: 18000000000, realized: 12500000000, progress: 69, status: "On Track" },
        { name: "Penyusunan Pedoman Tatalaksana Klinis Dengue Terkini", budget: 10000000000, realized: 6700000000, progress: 67, status: "On Track" },
        { name: "Monev Lintas Sektor One Health Zoonosis (Rabies & Antraks)", budget: 7000000000, realized: 4000000000, progress: 57, status: "On Track" }
      ]
    },
    {
      id: "PRJ-007",
      code: "BMGF-DIGI-26",
      name: "Transformasi Digital Arsitektur Sistem Informasi MONEV PHLN P2P",
      unitId: "SET_P2P",
      unitName: "Sekretariat Ditjen P2P",
      lenderId: "BMGF",
      lenderName: "BMGF",
      year: 2026,
      grantNo: "BMGF-INV-0551",
      allocation: 48000000000, // Rp 48 M
      realization: 38880000000, // Rp 38.88 M (81%)
      status: "On Track",
      category: "DIGITAL",
      tw1: 10000000000,
      tw2: 13000000000,
      tw3: 11880000000,
      tw4: 4000000000,
      progressPhysical: 83.0,
      activitiesCount: 8,
      indicator: "Sentralisasi 100% Data Keuangan & Fisik MONEV Hibah Luar Negeri",
      activities: [
        { name: "Pengembangan Integrasi API SIPHLN dengan SPAN Kemenkeu", budget: 20000000000, realized: 17000000000, progress: 85, status: "Selesai" },
        { name: "Implementasi Modul Realisasi Triwulanan & Approval Workflow", budget: 15000000000, realized: 12500000000, progress: 83, status: "On Track" },
        { name: "Audit Keamanan Sistem Informasi & Uji Penetrasi (VAPT)", budget: 8000000000, realized: 6000000000, progress: 75, status: "On Track" },
        { name: "Bimtek Penggunaan Aplikasi bagi Admin Satker 38 Provinsi", budget: 5000000000, realized: 3380000000, progress: 68, status: "On Track" }
      ]
    },
    {
      id: "PRJ-008",
      code: "WB-P2P-2027",
      name: "Rencana Penguatan Deteksi Dini Kanker Serviks & Payudara (Multi-Year)",
      unitId: "P2PTM",
      unitName: "Direktorat P2PTM",
      lenderId: "WB",
      lenderName: "World Bank",
      year: 2027,
      grantNo: "WB-PLAN-2027-01",
      allocation: 210000000000,
      realization: 0,
      status: "Planning",
      category: "PENGADAAN",
      tw1: 0, tw2: 0, tw3: 0, tw4: 0,
      progressPhysical: 0,
      activitiesCount: 6,
      indicator: "Pengadaan Alat DNA HPV Polymerase Chain Reaction di 200 RSUD",
      activities: [
        { name: "Penyusunan Dokumen Project Appraisal Document (PAD)", budget: 15000000000, realized: 0, progress: 0, status: "Planning" },
        { name: "Pra-Kualifikasi Vendor Mesin Laboratorium Patologi", budget: 85000000000, realized: 0, progress: 0, status: "Planning" }
      ]
    },
    {
      id: "PRJ-009",
      code: "GF-ATM-2027",
      name: "Kelanjutan Hibah Global Fund New Funding Model 4 (NFM4)",
      unitId: "P2PM",
      unitName: "Direktorat P2PM",
      lenderId: "GF",
      lenderName: "Global Fund",
      year: 2027,
      grantNo: "GF-NFM4-2027",
      allocation: 520000000000,
      realization: 0,
      status: "Planning",
      category: "PENGADAAN",
      tw1: 0, tw2: 0, tw3: 0, tw4: 0,
      progressPhysical: 0,
      activitiesCount: 22,
      indicator: "Target Eliminasi TB 2030 & Reduksi Kasus Baru HIV 90%",
      activities: [
        { name: "Penyusunan Rencana Kerja Tahunan Multi-Sektor NFM4", budget: 25000000000, realized: 0, progress: 0, status: "Planning" }
      ]
    },
    {
      id: "PRJ-010",
      code: "WB-CAREI-2028",
      name: "Fase Akhir Evaluasi & Keberlanjutan Program CARE-I Ditjen P2P",
      unitId: "SURKARKES",
      unitName: "Direktorat Surkarkes",
      lenderId: "WB",
      lenderName: "World Bank",
      year: 2028,
      grantNo: "WB-LOAN-9411-CLOSING",
      allocation: 180000000000,
      realization: 0,
      status: "Planning",
      category: "MONEV",
      tw1: 0, tw2: 0, tw3: 0, tw4: 0,
      progressPhysical: 0,
      activitiesCount: 5,
      indicator: "Dokumen End of Project Evaluation & Penyerahan Aset Labkesmas ke Pemda",
      activities: [
        { name: "Audit Finansial Independen Akhir Hibah Luar Negeri", budget: 12000000000, realized: 0, progress: 0, status: "Planning" }
      ]
    }
  ],

  // Target vs Realisasi Triwulan 2026 (Agregat)
  quarterlySummary2026: {
    labels: ["Triwulan I (Jan-Mar)", "Triwulan II (Apr-Jun)", "Triwulan III (Jul-Sep)", "Triwulan IV (Okt-Des)"],
    target: [280000000000, 390000000000, 420000000000, 348000000000],
    actual: [255000000000, 360400000000, 321980000000, 198000000000] // TW4 estimasi sampai Okt
  }
};

// Helper Formatters
const MoneyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

function formatRupiah(value) {
  if (value === null || value === undefined) return 'Rp 0';
  return MoneyFormatter.format(value);
}

function formatMiliar(value) {
  if (!value) return '0 M';
  const inM = value / 1000000000;
  if (inM >= 1000) {
    return (inM / 1000).toFixed(2) + ' Triliun';
  }
  return inM.toFixed(1) + ' Miliar';
}

function formatPercent(value) {
  return (value || 0).toFixed(1) + '%';
}
