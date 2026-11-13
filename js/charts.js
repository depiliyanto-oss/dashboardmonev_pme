/**
 * Chart.js 4.4.1 Visualizations Module
 * Dashboard MONEV Ditjen P2P
 */

const MonevCharts = {
  instances: {},

  // Color Palettes
  colors: {
    tealPrimary: '#0d9488',
    tealLight: 'rgba(13, 148, 136, 0.25)',
    blueAccent: '#3b82f6',
    blueLight: 'rgba(59, 130, 246, 0.25)',
    emerald: '#10b981',
    amber: '#f59e0b',
    purple: '#8b5cf6',
    rose: '#f43f5e',
    cyan: '#06b6d4',
    darkText: '#334155',
    darkMuted: '#64748b',
    darkBorder: '#e2e8f0',
    darkGrid: 'rgba(226, 232, 240, 0.8)'
  },

  isDark() {
    return document.documentElement.classList.contains('dark');
  },

  getThemeColors() {
    const dark = this.isDark();
    return {
      textColor: dark ? '#cbd5e1' : '#334155',
      mutedColor: dark ? '#94a3b8' : '#64748b',
      gridColor: dark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
      tooltipBg: dark ? '#0f172a' : '#ffffff',
      tooltipText: dark ? '#f8fafc' : '#0f172a',
      tooltipBorder: dark ? '#334155' : '#e2e8f0'
    };
  },

  // Setup Global Default Options
  initDefaults() {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js 4.4.1 not loaded');
      return;
    }

    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  },

  // Chart 1: Tren Realisasi Triwulanan (Multi-bar + Target Line)
  renderQuarterlyChart(data) {
    const ctx = document.getElementById('quarterlyChart');
    if (!ctx) return;

    if (this.instances.quarterly) {
      this.instances.quarterly.destroy();
    }

    const theme = this.getThemeColors();

    this.instances.quarterly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Realisasi Anggaran',
            data: data.actual,
            backgroundColor: this.colors.tealPrimary,
            borderRadius: 6,
            maxBarThickness: 42,
            order: 2
          },
          {
            type: 'bar',
            label: 'Target Pagu Triwulan',
            data: data.target,
            backgroundColor: this.isDark() ? 'rgba(148, 163, 184, 0.2)' : 'rgba(203, 213, 225, 0.5)',
            borderRadius: 6,
            maxBarThickness: 42,
            order: 3
          },
          {
            type: 'line',
            label: 'Capaian %',
            data: data.target.map((tgt, i) => tgt > 0 ? ((data.actual[i] / tgt) * 100).toFixed(1) : 0),
            borderColor: this.colors.amber,
            backgroundColor: this.colors.amber,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 7,
            yAxisID: 'yPercent',
            order: 1
          }
        ]
      },
      options: {
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: theme.textColor }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                if (context.dataset.yAxisID === 'yPercent') {
                  return ` % Capaian: ${context.parsed.y}%`;
                }
                return ` ${context.dataset.label}: ${formatRupiah(context.parsed.y)} (${formatMiliar(context.parsed.y)})`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.mutedColor }
          },
          y: {
            position: 'left',
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedColor,
              callback: value => formatMiliar(value)
            }
          },
          yPercent: {
            position: 'right',
            grid: { display: false },
            min: 0,
            max: 120,
            ticks: {
              color: theme.mutedColor,
              callback: val => val + '%'
            }
          }
        }
      }
    });
  },

  // Chart 2: Komposisi Pagu per Lembaga Donor / Lender
  renderLenderChart(projects) {
    const ctx = document.getElementById('lenderChart');
    if (!ctx) return;

    if (this.instances.lender) {
      this.instances.lender.destroy();
    }

    const theme = this.getThemeColors();

    // Grouping by lender
    const lenderMap = {};
    projects.forEach(p => {
      if (!lenderMap[p.lenderName]) {
        lenderMap[p.lenderName] = { allocation: 0, realization: 0 };
      }
      lenderMap[p.lenderName].allocation += p.allocation;
      lenderMap[p.lenderName].realization += p.realization;
    });

    const labels = Object.keys(lenderMap);
    const dataAllocations = labels.map(l => lenderMap[l].allocation);
    const backgroundColors = [
      '#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#10b981'
    ];

    this.instances.lender = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataAllocations,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: this.isDark() ? '#1e293b' : '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatMiliar(context.parsed)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  // Chart 3: Realisasi & Alokasi per Unit Kerja Ditjen P2P (Horizontal Bar)
  renderUnitChart(projects) {
    const ctx = document.getElementById('unitChart');
    if (!ctx) return;

    if (this.instances.unit) {
      this.instances.unit.destroy();
    }

    const theme = this.getThemeColors();

    const unitMap = {};
    projects.forEach(p => {
      if (!unitMap[p.unitName]) {
        unitMap[p.unitName] = { allocation: 0, realization: 0 };
      }
      unitMap[p.unitName].allocation += p.allocation;
      unitMap[p.unitName].realization += p.realization;
    });

    const labels = Object.keys(unitMap);
    const allocations = labels.map(u => unitMap[u].allocation);
    const realizations = labels.map(u => unitMap[u].realization);

    this.instances.unit = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Alokasi Pagu',
            data: allocations,
            backgroundColor: this.isDark() ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0',
            borderRadius: 6,
            maxBarThickness: 22
          },
          {
            label: 'Realisasi Anggaran',
            data: realizations,
            backgroundColor: this.colors.tealPrimary,
            borderRadius: 6,
            maxBarThickness: 22
          }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: {
            position: 'top',
            labels: { color: theme.textColor }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                return ` ${context.dataset.label}: ${formatRupiah(context.parsed.x)} (${formatMiliar(context.parsed.x)})`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedColor,
              callback: val => formatMiliar(val)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: theme.textColor }
          }
        }
      }
    });
  },

  // Chart 4: Proporsi Kategori Kegiatan (Polar Area / Doughnut)
  renderCategoryChart(projects) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (this.instances.category) {
      this.instances.category.destroy();
    }

    const theme = this.getThemeColors();

    const catMap = {
      'PENGADAAN': { label: 'Pengadaan Alkes & Vaksin', amount: 0, color: '#0d9488' },
      'SDM': { label: 'Kapasitas SDM & Pelatihan', amount: 0, color: '#3b82f6' },
      'DIGITAL': { label: 'Surveilans & Digitalisasi', amount: 0, color: '#8b5cf6' },
      'MONEV': { label: 'Operasional & MONEV', amount: 0, color: '#f59e0b' }
    };

    projects.forEach(p => {
      const catKey = p.category || 'MONEV';
      if (catMap[catKey]) {
        catMap[catKey].amount += p.realization;
      }
    });

    const labels = Object.values(catMap).map(c => c.label);
    const dataValues = Object.values(catMap).map(c => c.amount);
    const bgColors = Object.values(catMap).map(c => c.color);

    this.instances.category = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors.map(c => c + 'cc'), // add transparency
          borderWidth: 1,
          borderColor: this.isDark() ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: theme.textColor, padding: 10 }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((context.parsed.r / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatMiliar(context.parsed.r)} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          r: {
            grid: { color: theme.gridColor },
            ticks: { display: false }
          }
        }
      }
    });
  },

  // Refresh all charts when theme changes
  updateTheme() {
    Object.values(this.instances).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.instances = {};
  }
};
