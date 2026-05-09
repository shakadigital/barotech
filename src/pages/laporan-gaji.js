import { fmtDate, fmtIdr, esc, showToast } from '../lib/helpers.js';
import { supabase } from '../lib/supabase.js';
import { exportLaporanGaji } from '../lib/excel-export.js';

/**
 * Laporan Gaji — Admin/Owner/Superadmin only
 * Halaman full screen untuk mencetak laporan gaji karyawan
 */
export function LaporanGajiPage(state) {
  const { user, employees, projects, attendanceLogs, dailyActivities } = state;

  // Guard: hanya admin/owner/superadmin
  if (!['superadmin', 'owner', 'admin'].includes(user.role)) {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i>
      <p>Halaman ini hanya dapat diakses oleh admin/owner/superadmin.</p>
    </div></div>`;
  }

  // Default filter: bulan ini
  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7); // YYYY-MM

  return `
    <div class="fade-in" style="padding:20px;max-width:1200px;margin:0 auto;">
      <!-- Header -->
      <div class="mb-16" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <button class="btn btn-ghost btn-sm mb-8" onclick="window.__app.navigateTo('laporan')" style="padding:6px 12px;">
            <i class="fas fa-arrow-left"></i> Laporan
          </button>
          <h1 class="fw-bold" style="font-size:1.5rem;margin:0;"><i class="fas fa-file-invoice-dollar"></i> Laporan Gaji</h1>
          <div class="text-xs text-secondary">Cetak laporan gaji karyawan per periode</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success" onclick="window.__app.exportLaporanGajiToExcel()">
            <i class="fas fa-file-excel"></i> Download Excel
          </button>
          <button class="btn btn-primary" onclick="window.__app.printLaporanGaji()">
            <i class="fas fa-print"></i> Cetak
          </button>
        </div>
      </div>

      <!-- Filter -->
      <div class="card mb-16">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <div>
            <label class="form-label">Karyawan</label>
            <select class="form-select" id="lg-employee" onchange="window.__app.filterLaporanGaji()">
              <option value="">Semua Karyawan</option>
              ${employees.filter(e => e.role === 'karyawan').map(e =>
                `<option value="${e.id}">${esc(e.full_name)}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Bulan</label>
            <input type="month" class="form-input" id="lg-month" value="${defaultMonth}" onchange="window.__app.filterLaporanGaji()" />
          </div>
          <div>
            <label class="form-label">Proyek</label>
            <select class="form-select" id="lg-project" onchange="window.__app.filterLaporanGaji()">
              <option value="">Semua Proyek</option>
              ${projects.map(p =>
                `<option value="${p.id}">${esc(p.name)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Laporan Container -->
      <div id="laporan-container" class="card" style="padding:24px;">
        <div class="empty-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Memuat data...</p>
        </div>
      </div>
    </div>

    <script>
      // Auto load initial data
      window.__app.filterLaporanGaji();
    </script>

    <style>
      @media print {
        body { background: white !important; }
        .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        button { display: none !important; }
        select, input { border: 1px solid #ddd !important; }
      }
    </style>
  `;
}

/** Generate laporan gaji berdasarkan filter */
export async function filterLaporanGaji(state) {
  const employeeId = document.getElementById('lg-employee')?.value || '';
  const month = document.getElementById('lg-month')?.value || '';
  const projectId = document.getElementById('lg-project')?.value || '';

  const container = document.getElementById('laporan-container');
  if (!container) return;

  // Show loading indicator
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>';

  // Add timeout to detect slow queries
  const timeoutId = setTimeout(() => {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Memuat data memakan waktu lama. Silakan filter berdasarkan karyawan atau periode yang lebih spesifik.</p></div>';
  }, 10000); // 10 second timeout

  try {
    // Build query - select only needed columns with limit
    let query = supabase
      .from('attendance_logs')
      .select('id, employee_id, project_id, created_at, basic_salary, overtime_pay, cash_advance, uang_makan, transport, tunjangan_lain')
      .eq('status', 'hadir')
      .limit(1000); // Limit to 1000 records max

    // Use date range filtering instead of .like() for better performance
    if (month) {
      const startDate = `${month}-01T00:00:00`;
      // Get last day of the month
      const [year, monthNum] = month.split('-');
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    if (employeeId) query = query.eq('employee_id', employeeId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data: logs, error } = await query.order('created_at', { ascending: true });

    clearTimeout(timeoutId);

    if (error) throw error;

    // Check if we hit the limit
    if (logs.length >= 1000) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Terlalu banyak data. Silakan filter berdasarkan karyawan atau periode yang lebih spesifik.</p></div>';
      return;
    }

    // Fetch daily activities only if there are logs
    let activities = [];
    if (logs.length > 0) {
      const attIds = logs.map(l => l.id);
      const { data: acts } = await supabase
        .from('daily_activities')
        .select('attendance_id, description')
        .in('attendance_id', attIds);
      activities = acts || [];
    }

    // Group by employee
    const byEmployee = new Map();
    logs.forEach(l => {
      if (!byEmployee.has(l.employee_id)) {
        byEmployee.set(l.employee_id, { logs: [], total: 0 });
      }
      byEmployee.get(l.employee_id).logs.push(l);
      byEmployee.get(l.employee_id).total +=
        (l.basic_salary || 0) + (l.overtime_pay || 0) +
        (l.uang_makan || 0) + (l.transport || 0) + (l.tunjangan_lain || 0) -
        (l.cash_advance || 0);
    });

    // Store current data for export
    window.__laporanGajiData = {
      byEmployee,
      employees: state.employees,
      projects: state.projects,
      filters: { employeeId, month, projectId },
    };

    // Generate report
    let html = '';

    if (byEmployee.size === 0) {
      html = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data untuk filter ini.</p></div>';
    } else {
      html = Array.from(byEmployee.entries()).map(([empId, data]) => {
        const emp = state.employees.find(e => e.id === empId);
        const empLogs = data.logs;

        // Group by project for this employee
        const byProject = new Map();
        empLogs.forEach(l => {
          const prj = state.projects.find(p => p.id === l.project_id);
          const prjName = prj?.name || 'Tidak ada proyek';
          if (!byProject.has(prjName)) {
            byProject.set(prjName, { count: 0, total: 0, logs: [] });
          }
          byProject.get(prjName).count += 1;
          byProject.get(prjName).total +=
            (l.basic_salary || 0) + (l.overtime_pay || 0) +
            (l.uang_makan || 0) + (l.transport || 0) + (l.tunjangan_lain || 0) -
            (l.cash_advance || 0);
          byProject.get(prjName).logs.push(l);
        });

        return `
          <div style="margin-bottom:24px;padding:16px;border:1px solid var(--border);border-radius:var(--radius);">
            <!-- Employee Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);">
              <div>
                <div class="fw-bold" style="font-size:1.1rem;">${esc(emp?.full_name || '-')}</div>
                <div class="text-xs text-secondary">${esc(emp?.jabatan || 'Karyawan')}</div>
              </div>
              <div class="text-right">
                <div class="text-xs text-secondary">Total Bersih</div>
                <div class="fw-bold text-success" style="font-size:1.2rem;">${fmtIdr(data.total)}</div>
              </div>
            </div>

            <!-- Per Proyek -->
            <div style="margin-bottom:12px;">
              <div class="text-xs fw-bold mb-8" style="color:var(--text-secondary);">Rincian per Proyek</div>
              ${Array.from(byProject.entries()).map(([prjName, prjData]) => `
                <div style="display:flex;justify-content:space-between;padding:6px 10px;margin-bottom:4px;background:var(--bg-hover);border-radius:var(--radius);">
                  <span class="text-sm">${esc(prjName)} (${prjData.count} hari)</span>
                  <span class="fw-bold">${fmtIdr(prjData.total)}</span>
                </div>
              `).join('')}
            </div>

            <!-- Detail Table -->
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
              <thead>
                <tr style="background:var(--bg-hover);">
                  <th style="padding:8px;text-align:left;border-bottom:1px solid var(--border);">Tanggal</th>
                  <th style="padding:8px;text-align:left;border-bottom:1px solid var(--border);">Proyek</th>
                  <th style="padding:8px;text-align:right;border-bottom:1px solid var(--border);">Gaji</th>
                  <th style="padding:8px;text-align:right;border-bottom:1px solid var(--border);">Lembur</th>
                  <th style="padding:8px;text-align:right;border-bottom:1px solid var(--border);">Kasbon</th>
                  <th style="padding:8px;text-align:right;border-bottom:1px solid var(--border);">Total</th>
                </tr>
              </thead>
              <tbody>
                ${empLogs.map(l => {
                  const prj = state.projects.find(p => p.id === l.project_id);
                  const total = (l.basic_salary || 0) + (l.overtime_pay || 0) +
                    (l.uang_makan || 0) + (l.transport || 0) + (l.tunjangan_lain || 0) -
                    (l.cash_advance || 0);
                  return `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:8px;">${fmtDate(l.created_at)}</td>
                      <td style="padding:8px;">${esc(prj?.name || '-')}</td>
                      <td style="padding:8px;text-align:right;">${fmtIdr(l.basic_salary || 0)}</td>
                      <td style="padding:8px;text-align:right;">${fmtIdr(l.overtime_pay || 0)}</td>
                      <td style="padding:8px;text-align:right;">${fmtIdr(l.cash_advance || 0)}</td>
                      <td style="padding:8px;text-align:right;fw-bold;">${fmtIdr(total)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:var(--bg-hover);font-weight:700;">
                  <td colspan="5" style="padding:8px;text-align:right;">Total:</td>
                  <td style="padding:8px;text-align:right;">${fmtIdr(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
      }).join('');
    }

    container.innerHTML = html;
  } catch (err) {
    clearTimeout(timeoutId);
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

/** Export laporan gaji to Excel */
export function exportLaporanGajiToExcel() {
  try {
    const data = window.__laporanGajiData;
    console.log('Export data:', data);
    if (!data) {
      showToast('Silakan filter data terlebih dahulu', 'error');
      return;
    }
    if (data.byEmployee.size === 0) {
      showToast('Tidak ada data untuk diexport', 'error');
      return;
    }

    // Format data for export
    const exportData = Array.from(data.byEmployee.entries()).map(([empId, empData]) => {
      const emp = data.employees.find(e => e.id === empId);
      const logs = empData.logs.map(l => {
        const prj = data.projects.find(p => p.id === l.project_id);
        return {
          ...l,
          employee_name: emp?.full_name,
          employee_jabatan: emp?.jabatan,
          project_name: prj?.name,
        };
      });

      const totalGaji = logs.reduce((s, l) => s + (l.basic_salary || 0), 0);
      const totalLembur = logs.reduce((s, l) => s + (l.overtime_pay || 0), 0);
      const totalUangMakan = logs.reduce((s, l) => s + (l.uang_makan || 0), 0);
      const totalTransport = logs.reduce((s, l) => s + (l.transport || 0), 0);
      const totalTunjangan = logs.reduce((s, l) => s + (l.tunjangan_lain || 0), 0);
      const totalKasbon = logs.reduce((s, l) => s + (l.cash_advance || 0), 0);

      return {
        full_name: emp?.full_name,
        jabatan: emp?.jabatan,
        total_hari: logs.length,
        gaji_pokok: totalGaji,
        lembur: totalLembur,
        uang_makan: totalUangMakan,
        transport: totalTransport,
        tunjangan_lain: totalTunjangan,
        kasbon: totalKasbon,
        total_bersih: totalGaji + totalLembur + totalUangMakan + totalTransport + totalTunjangan - totalKasbon,
        logs,
      };
    });

    console.log('Export data prepared:', exportData);
    console.log('Export data type:', typeof exportData);
    console.log('Is array:', Array.isArray(exportData));
    console.log('First item:', exportData[0]);

    exportLaporanGaji(exportData, data.filters);
  } catch (err) {
    console.error('Export error:', err);
    showToast('Gagal export: ' + err.message, 'error');
  }
}

/** Print preview laporan gaji — fullscreen overlay dengan logo resmi */
export function printLaporanGaji() {
  const container = document.getElementById('laporan-container');
  if (!container || container.querySelector('.empty-state')) {
    showToast('Silakan muat data terlebih dahulu', 'error');
    return;
  }

  const month       = document.getElementById('lg-month')?.value || '';
  const empName     = document.getElementById('lg-employee')?.selectedOptions?.[0]?.text || 'Semua Karyawan';
  const projectName = document.getElementById('lg-project')?.selectedOptions?.[0]?.text || 'Semua Proyek';

  const bulanLabel = month
    ? new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : 'Semua Periode';

  const printDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  document.getElementById('lg-print-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lg-print-overlay';

  overlay.innerHTML = `
    <style>
      #lg-print-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: #eef0f3;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #1a1a1a;
        -webkit-overflow-scrolling: touch;
      }

      /* ── Toolbar ── */
      #lg-print-toolbar {
        position: sticky; top: 0; z-index: 10;
        background: #0f172a; color: #fff;
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 16px; gap: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      }
      #lg-print-toolbar .tb-title {
        font-weight: 600; font-size: 0.88rem; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
      }
      #lg-print-toolbar .tb-actions { display: flex; gap: 8px; flex-shrink: 0; }
      #btn-lg-print {
        background: #19d2c1; color: #fff; border: none; border-radius: 6px;
        padding: 7px 14px; font-size: 0.82rem; cursor: pointer; font-weight: 700;
        white-space: nowrap;
      }
      #btn-lg-close {
        background: rgba(255,255,255,0.12); color: #fff; border: none;
        border-radius: 6px; padding: 7px 11px; font-size: 0.82rem; cursor: pointer;
      }

      /* ── Paper ── */
      #lg-print-content {
        max-width: 860px; margin: 20px auto 40px;
        background: #fff; border-radius: 10px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
        padding: 28px 28px 24px;
        overflow: visible;
      }

      /* ── Kop ── */
      .lg-kop {
        padding-bottom: 14px;
        border-bottom: 2.5px solid #19d2c1;
        margin-bottom: 18px;
        text-align: center;
      }
      .lg-kop-logo {
        width: 72px; height: 72px; border-radius: 12px;
        object-fit: contain; display: block; margin: 0 auto 10px;
      }
      .lg-kop-header {
        font-size: 1.05rem; font-weight: 800;
        color: #0f172a; letter-spacing: 0.8px;
        margin-bottom: 10px;
      }
      .lg-kop-meta {
        font-size: 0.78rem; color: #444; line-height: 1.8;
        text-align: left; display: inline-block;
      }
      .lg-kop-meta span { display: block; }

      /* ── Isi laporan: override style dari app ── */
      #lg-print-body {
        overflow: visible;
      }
      #lg-print-body > div {
        margin-bottom: 18px !important;
        padding: 14px !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        overflow: visible !important;
      }
      #lg-print-body table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 0.78rem !important;
        table-layout: auto !important;
        overflow: visible !important;
      }
      #lg-print-body th, #lg-print-body td {
        padding: 6px 8px !important;
        border-bottom: 1px solid #e2e8f0 !important;
        white-space: nowrap !important;
        font-size: 0.78rem !important;
      }
      #lg-print-body thead tr {
        background: #f1f5f9 !important;
      }
      #lg-print-body tfoot tr {
        background: #f8fafc !important;
        font-weight: 700 !important;
      }
      /* Employee header */
      #lg-print-body .fw-bold { font-weight: 700 !important; }
      #lg-print-body .text-success { color: #16a34a !important; }
      #lg-print-body .text-secondary, #lg-print-body .text-xs { color: #64748b !important; }

      /* ── Footer ── */
      .lg-footer {
        margin-top: 24px; padding-top: 10px;
        border-top: 1px solid #e2e8f0;
        display: flex; justify-content: space-between;
        font-size: 0.72rem; color: #94a3b8;
      }

      /* ── Mobile ── */
      @media (max-width: 600px) {
        #lg-print-content { margin: 12px; padding: 16px 12px; border-radius: 8px; }
        .lg-kop-logo { width: 56px; height: 56px; }
        .lg-kop-header { font-size: 0.9rem; }
        .lg-kop-meta { font-size: 0.72rem; }
        #lg-print-body table { font-size: 0.7rem !important; }
        #lg-print-body th, #lg-print-body td { padding: 4px 5px !important; font-size: 0.7rem !important; }
        #lg-print-toolbar .tb-title { font-size: 0.78rem; }
      }

      /* ── Print media ── */
      @media print {
        #lg-print-toolbar { display: none !important; }
        #lg-print-overlay {
          position: absolute !important;
          background: white !important;
          overflow: visible !important;
        }
        #lg-print-content {
          box-shadow: none !important; border-radius: 0 !important;
          margin: 0 !important; max-width: 100% !important;
          padding: 16px !important;
        }
        body > *:not(#lg-print-overlay) { display: none !important; }
        #lg-print-body table { font-size: 0.72rem !important; }
        #lg-print-body th, #lg-print-body td { padding: 5px 6px !important; }
      }
    </style>

    <!-- Toolbar -->
    <div id="lg-print-toolbar">
      <div class="tb-title">
        <i class="fas fa-print"></i> Preview — Laporan Gaji ${esc(bulanLabel)}
      </div>
      <div class="tb-actions">
        <button id="btn-lg-print" onclick="window.print()">
          <i class="fas fa-print"></i> Cetak / PDF
        </button>
        <button id="btn-lg-close" onclick="document.getElementById('lg-print-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- Paper -->
    <div id="lg-print-content">

      <!-- Kop Surat -->
      <div class="lg-kop">
        <img src="/apple-touch-icon.png" alt="Logo" class="lg-kop-logo" />
        <div class="lg-kop-header">LAPORAN GAJI KARYAWAN</div>
        <div class="lg-kop-meta">
          <span>Periode &nbsp;: <strong>${esc(bulanLabel)}</strong></span>
          <span>Karyawan : <strong>${esc(empName)}</strong></span>
          <span>Proyek &nbsp;&nbsp;: <strong>${esc(projectName)}</strong></span>
          <span style="color:#94a3b8;font-size:0.72rem;">Dicetak: ${printDate}</span>
        </div>
      </div>

      <!-- Isi Laporan -->
      <div id="lg-print-body">${container.innerHTML}</div>

      <!-- Footer -->
      <div class="lg-footer">
        <span>Barotech — Laporan Gaji ${esc(bulanLabel)}</span>
        <span>${printDate}</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.scrollTop = 0;
}

