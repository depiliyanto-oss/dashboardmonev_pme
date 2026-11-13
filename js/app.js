/**
 * Main Application Controller
 * Dashboard MONEV Ditjen P2P Kemenkes
 */

const MonevApp = {
  state: {
    year: 2026,
    unitId: 'ALL',
    lenderId: 'ALL',
    statusFilter: 'ALL',
    searchQuery: '',
    selectedProject: null,
    darkMode: false,
    goatcounterEndpoint: 'https://siphln-p2p.goatcounter.com/count'
  },

  init() {
    this.initTheme();
    this.populateDropdowns();
    this.bindEvents();
    this.applyFilters();
    this.initGoatCounter();
    console.log('SIPHLN Executive MONEV Dashboard initialized.');
  },

  // 1. Dark Mode
  initTheme() {
    const saved = localStorage.getItem('monev_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      this.setTheme(true);
    } else {
      this.setTheme(false);
    }
  },

  setTheme(isDark) {
    this.state.darkMode = isDark;
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');

    if (isDark) {
      html.classList.add('dark');
      localStorage.setItem('monev_theme', 'dark');
      if (themeIcon) themeIcon.className = 'fa-solid fa-sun text-amber-400';
      if (themeText) themeText.textContent = 'Light Mode';
    } else {
      html.classList.remove('dark');
      localStorage.setItem('monev_theme', 'light');
      if (themeIcon) themeIcon.className = 'fa-solid fa-moon text-slate-600';
      if (themeText) themeText.textContent = 'Dark Mode';
    }

    if (typeof MonevCharts !== 'undefined') {
      MonevCharts.updateTheme();
      this.refreshCharts(this.getFilteredProjects());
    }
  },

  toggleTheme() {
    this.setTheme(!this.state.darkMode);
  },

  // 2. Populate Dropdowns
  populateDropdowns() {
    const yearSelect = document.getElementById('filterYear');
    if (yearSelect) {
      yearSelect.innerHTML = `
        <option value="ALL">Semua Tahun (2026-2028)</option>
        ${MONEV_DATA.years.map(y => `<option value="${y}" ${y === 2026 ? 'selected' : ''}>Tahun Anggaran ${y}</option>`).join('')}
      `;
    }

    const unitSelect = document.getElementById('filterUnit');
    if (unitSelect) {
      unitSelect.innerHTML = MONEV_DATA.units.map(u => `
        <option value="${u.id}">${u.name}</option>
      `).join('');
    }

    const lenderSelect = document.getElementById('filterLender');
    if (lenderSelect) {
      lenderSelect.innerHTML = MONEV_DATA.lenders.map(l => `
        <option value="${l.id}">${l.name}</option>
      `).join('');
    }
  },

  // 3. Event Listeners
  bindEvents() {
    // Filter controls
    document.getElementById('filterYear')?.addEventListener('change', (e) => {
      this.state.year = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value);
      this.trackEvent('filter_year', { year: this.state.year });
      this.applyFilters();
    });

    document.getElementById('filterUnit')?.addEventListener('change', (e) => {
      this.state.unitId = e.target.value;
      this.trackEvent('filter_unit', { unit: this.state.unitId });
      this.applyFilters();
    });

    document.getElementById('filterLender')?.addEventListener('change', (e) => {
      this.state.lenderId = e.target.value;
      this.trackEvent('filter_lender', { lender: this.state.lenderId });
      this.applyFilters();
    });

    // Search Box
    const searchInput = document.getElementById('searchProjects');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.toLowerCase().trim();
      this.applyFilters();
    });

    // Quick Status Filter Pills
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-status-filter]').forEach(b => {
          b.classList.remove('bg-teal-600', 'text-white', 'shadow-sm');
          b.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        });
        const target = e.currentTarget;
        target.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        target.classList.add('bg-teal-600', 'text-white', 'shadow-sm');
        this.state.statusFilter = target.getAttribute('data-status-filter');
        this.applyFilters();
      });
    });

    // Reset Filter Button
    document.getElementById('btnResetFilter')?.addEventListener('click', () => {
      this.resetFilters();
    });

    // Theme Toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Export Buttons
    document.getElementById('btnExportCSV')?.addEventListener('click', () => {
      this.exportCSV();
    });
    document.getElementById('btnExportJSON')?.addEventListener('click', () => {
      this.exportJSON();
    });
    document.getElementById('btnPrint')?.addEventListener('click', () => {
      window.print();
    });

    // Close Modal on backdrop click or close button
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
      this.closeModal();
    });
    document.getElementById('projectModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'projectModal') {
        this.closeModal();
      }
    });

    // ESC key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  resetFilters() {
    this.state.year = 2026;
    this.state.unitId = 'ALL';
    this.state.lenderId = 'ALL';
    this.state.statusFilter = 'ALL';
    this.state.searchQuery = '';

    const filterYear = document.getElementById('filterYear');
    if (filterYear) filterYear.value = "2026";
    const filterUnit = document.getElementById('filterUnit');
    if (filterUnit) filterUnit.value = "ALL";
    const filterLender = document.getElementById('filterLender');
    if (filterLender) filterLender.value = "ALL";
    const searchInput = document.getElementById('searchProjects');
    if (searchInput) searchInput.value = "";

    // Reset status pills
    document.querySelectorAll('[data-status-filter]').forEach(b => {
      b.classList.remove('bg-teal-600', 'text-white', 'shadow-sm');
      b.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
    });
    const defaultPill = document.querySelector('[data-status-filter="ALL"]');
    if (defaultPill) {
      defaultPill.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
      defaultPill.classList.add('bg-teal-600', 'text-white', 'shadow-sm');
    }

    this.showToast('Filter telah di-reset ke default 2026.');
    this.applyFilters();
  },

  // 4. Data Filtering Logic
  getFilteredProjects() {
    return MONEV_DATA.projects.filter(project => {
      // Year filter
      if (this.state.year !== 'ALL' && project.year !== this.state.year) {
        return false;
      }
      // Unit filter
      if (this.state.unitId !== 'ALL' && project.unitId !== this.state.unitId) {
        return false;
      }
      // Lender filter
      if (this.state.lenderId !== 'ALL' && project.lenderId !== this.state.lenderId) {
        return false;
      }
      // Status pill filter
      if (this.state.statusFilter !== 'ALL' && project.status !== this.state.statusFilter) {
        return false;
      }
      // Search text query
      if (this.state.searchQuery) {
        const query = this.state.searchQuery;
        const matchName = project.name.toLowerCase().includes(query);
        const matchCode = project.code.toLowerCase().includes(query);
        const matchGrant = project.grantNo.toLowerCase().includes(query);
        const matchUnit = project.unitName.toLowerCase().includes(query);
        const matchLender = project.lenderName.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchGrant && !matchUnit && !matchLender) {
          return false;
        }
      }
      return true;
    });
  },

  applyFilters() {
    const filtered = this.getFilteredProjects();
    this.renderKPIs(filtered);
    this.renderProjectTable(filtered);
    this.refreshCharts(filtered);
  },

  // 5. Render KPIs
  renderKPIs(projects) {
    const totalPagu = projects.reduce((acc, p) => acc + p.allocation, 0);
    const totalRealisasi = projects.reduce((acc, p) => acc + p.realization, 0);
    const sisaPagu = Math.max(0, totalPagu - totalRealisasi);
    const percentage = totalPagu > 0 ? (totalRealisasi / totalPagu) * 100 : 0;
    const avgPhysical = projects.length > 0 
      ? projects.reduce((acc, p) => acc + p.progressPhysical, 0) / projects.length 
      : 0;
    const totalActivities = projects.reduce((acc, p) => acc + p.activitiesCount, 0);

    // Update DOM
    const elPagu = document.getElementById('kpiTotalPagu');
    const elRealisasi = document.getElementById('kpiTotalRealisasi');
    const elPercent = document.getElementById('kpiPercent');
    const elProgressBar = document.getElementById('kpiProgressBar');
    const elSisa = document.getElementById('kpiSisaAnggaran');
    const elCount = document.getElementById('kpiProjectCount');
    const elActivities = document.getElementById('kpiTotalActivities');
    const elPhysical = document.getElementById('kpiAvgPhysical');

    if (elPagu) elPagu.textContent = formatMiliar(totalPagu);
    if (elRealisasi) elRealisasi.textContent = formatMiliar(totalRealisasi);
    if (elPercent) elPercent.textContent = percentage.toFixed(1) + '%';
    if (elProgressBar) elProgressBar.style.width = Math.min(percentage, 100) + '%';
    if (elSisa) elSisa.textContent = formatMiliar(sisaPagu);
    if (elCount) elCount.textContent = projects.length;
    if (elActivities) elActivities.textContent = totalActivities;
    if (elPhysical) elPhysical.textContent = avgPhysical.toFixed(1) + '%';
  },

  // 6. Refresh Charts
  refreshCharts(projects) {
    MonevCharts.initDefaults();

    // Chart 1: Quarterly Chart
    // If year 2026, use aggregate summary, else calculate from projects
    const qSummary = {
      labels: ["Triwulan I", "Triwulan II", "Triwulan III", "Triwulan IV"],
      actual: [
        projects.reduce((sum, p) => sum + (p.tw1 || 0), 0),
        projects.reduce((sum, p) => sum + (p.tw2 || 0), 0),
        projects.reduce((sum, p) => sum + (p.tw3 || 0), 0),
        projects.reduce((sum, p) => sum + (p.tw4 || 0), 0)
      ],
      target: [
        projects.reduce((sum, p) => sum + (p.allocation * 0.20), 0),
        projects.reduce((sum, p) => sum + (p.allocation * 0.30), 0),
        projects.reduce((sum, p) => sum + (p.allocation * 0.30), 0),
        projects.reduce((sum, p) => sum + (p.allocation * 0.20), 0)
      ]
    };

    MonevCharts.renderQuarterlyChart(qSummary);
    MonevCharts.renderLenderChart(projects);
    MonevCharts.renderUnitChart(projects);
    MonevCharts.renderCategoryChart(projects);
  },

  // 7. Render Project Table
  renderProjectTable(projects) {
    const tbody = document.getElementById('projectTableBody');
    const countEl = document.getElementById('tableRowCount');
    if (countEl) countEl.textContent = `Menampilkan ${projects.length} proyek`;

    if (!tbody) return;

    if (projects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-12 text-slate-400 dark:text-slate-500">
            <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
            Tidak ada proyek yang sesuai dengan kriteria filter saat ini.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = projects.map(p => {
      const pct = p.allocation > 0 ? ((p.realization / p.allocation) * 100) : 0;
      
      let badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800';
      if (p.status === 'At Risk') {
        badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800';
      } else if (p.status === 'Planning') {
        badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-blue-300 dark:border-blue-800';
      }

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer group" onclick="MonevApp.showModal('${p.id}')">
          <td class="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
            <div class="font-semibold text-slate-800 dark:text-slate-200">${p.code}</div>
            <div class="text-[11px] text-slate-400">${p.grantNo}</div>
          </td>
          <td class="py-3 px-4 max-w-xs">
            <div class="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
              ${p.name}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span class="inline-flex items-center"><i class="fa-regular fa-building mr-1"></i> ${p.unitName}</span>
              <span>•</span>
              <span class="inline-flex items-center"><i class="fa-solid fa-hand-holding-dollar mr-1"></i> ${p.lenderName}</span>
              <span>•</span>
              <span class="badge bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">${p.year}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-right font-semibold text-slate-800 dark:text-slate-200">
            ${formatMiliar(p.allocation)}
            <div class="text-[11px] font-normal text-slate-400">${formatRupiah(p.allocation)}</div>
          </td>
          <td class="py-3 px-4 text-right font-semibold text-teal-600 dark:text-teal-400">
            ${formatMiliar(p.realization)}
            <div class="text-[11px] font-normal text-slate-400">${formatRupiah(p.realization)}</div>
          </td>
          <td class="py-3 px-4 w-44">
            <div class="flex items-center justify-between text-xs font-semibold mb-1">
              <span class="text-slate-700 dark:text-slate-300">${pct.toFixed(1)}%</span>
              <span class="text-slate-400 text-[11px]">Fisik: ${p.progressPhysical}%</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div class="bg-teal-500 h-full rounded-full transition-all duration-500" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}">
              ${p.status}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <button class="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition" title="Lihat Rincian Kegiatan">
              <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 8. Project Detail Modal
  showModal(projectId) {
    const project = MONEV_DATA.projects.find(p => p.id === projectId);
    if (!project) return;

    this.state.selectedProject = project;
    this.trackEvent('view_project_detail', { projectId: project.id, code: project.code });

    const modal = document.getElementById('projectModal');
    const titleEl = document.getElementById('modalTitle');
    const codeEl = document.getElementById('modalCode');
    const unitEl = document.getElementById('modalUnit');
    const lenderEl = document.getElementById('modalLender');
    const paguEl = document.getElementById('modalPagu');
    const realEl = document.getElementById('modalReal');
    const pctEl = document.getElementById('modalPct');
    const sisaEl = document.getElementById('modalSisa');
    const indicatorEl = document.getElementById('modalIndicator');
    const activitiesTbody = document.getElementById('modalActivitiesBody');

    if (titleEl) titleEl.textContent = project.name;
    if (codeEl) codeEl.textContent = `${project.code} | No: ${project.grantNo}`;
    if (unitEl) unitEl.textContent = project.unitName;
    if (lenderEl) lenderEl.textContent = project.lenderName;
    if (paguEl) paguEl.textContent = formatRupiah(project.allocation);
    if (realEl) realEl.textContent = formatRupiah(project.realization);
    
    const pct = project.allocation > 0 ? ((project.realization / project.allocation) * 100).toFixed(1) : '0';
    if (pctEl) pctEl.textContent = pct + '%';
    const sisa = Math.max(0, project.allocation - project.realization);
    if (sisaEl) sisaEl.textContent = formatRupiah(sisa);
    if (indicatorEl) indicatorEl.textContent = project.indicator || 'Indikator kinerja sesuai perjanjian hibah.';

    // Render activity list
    if (activitiesTbody) {
      if (project.activities && project.activities.length > 0) {
        activitiesTbody.innerHTML = project.activities.map((act, index) => {
          return `
            <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
              <td class="py-2.5 px-3 text-slate-500 font-mono">${index + 1}</td>
              <td class="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">${act.name}</td>
              <td class="py-2.5 px-3 text-right font-mono">${formatRupiah(act.budget)}</td>
              <td class="py-2.5 px-3 text-right font-mono text-teal-600 dark:text-teal-400">${formatRupiah(act.realized)}</td>
              <td class="py-2.5 px-3">
                <div class="flex items-center gap-2">
                  <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-teal-500 h-full" style="width: ${act.progress}%"></div>
                  </div>
                  <span class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 w-8 text-right">${act.progress}%</span>
                </div>
              </td>
              <td class="py-2.5 px-3 text-center">
                <span class="px-2 py-0.5 rounded text-[10px] font-medium ${
                  act.status === 'Selesai' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                  act.status === 'At Risk' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                  'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300'
                }">
                  ${act.status}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        activitiesTbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-6 text-slate-400">Belum ada rincian sub-kegiatan untuk proyek ini.</td>
          </tr>
        `;
      }
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeModal() {
    const modal = document.getElementById('projectModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.state.selectedProject = null;
  },

  // 9. Export Functions
  exportCSV() {
    const projects = this.getFilteredProjects();
    if (projects.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    let csv = "Kode Proyek,Nomor Hibah,Nama Proyek,Unit Kerja,Lender / Donor,Tahun,Alokasi Pagu (IDR),Realisasi (IDR),Persentase Serapan,Progres Fisik,Status\n";
    projects.forEach(p => {
      const pct = p.allocation > 0 ? ((p.realization / p.allocation) * 100).toFixed(2) : 0;
      csv += `"${p.code}","${p.grantNo}","${p.name.replace(/"/g, '""')}","${p.unitName}","${p.lenderName}",${p.year},${p.allocation},${p.realization},"${pct}%","${p.progressPhysical}%","${p.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monev-phln-p2p-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.trackEvent('export_csv');
    this.showToast('Data berhasil diexport ke CSV.');
  },

  exportJSON() {
    const projects = this.getFilteredProjects();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      metadata: MONEV_DATA.metadata,
      exportedAt: new Date().toISOString(),
      filtersApplied: {
        year: this.state.year,
        unit: this.state.unitId,
        lender: this.state.lenderId,
        status: this.state.statusFilter
      },
      projects: projects
    }, null, 2));

    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `monev-phln-p2p-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    this.trackEvent('export_json');
    this.showToast('Data berhasil diexport ke format JSON.');
  },

  // 10. Toast Notification
  showToast(message) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-3 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-none';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-teal-400"></i> <span>${message}</span>`;
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-10', 'opacity-0');
    }, 2800);
  },

  // 11. GoatCounter Integration
  initGoatCounter() {
    // Check if GoatCounter is available on window
    if (window.goatcounter && window.goatcounter.count) {
      console.log('GoatCounter analytics active.');
    }
  },

  trackEvent(eventName, eventData = {}) {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({
        path: `event/${eventName}`,
        title: `Dashboard Action: ${eventName}`,
        event: true
      });
    }
    console.log(`[Event Tracked] ${eventName}`, eventData);
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  MonevApp.init();
});
