import { fmtDate, fmtIdr, esc } from '../lib/helpers.js';
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
          <h1 class="fw-bold" style="font-size:1.5rem;margin:0;"><i class="fas fa-file-invoice-dollar"></i> Laporan Gaji</h1>
          <div class="text-xs text-secondary">Cetak laporan gaji karyawan per periode</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success" onclick="window.__app.exportLaporanGajiToExcel()">
            <i class="fas fa-file-excel"></i> Download Excel
          </button>
          <button class="btn btn-primary" onclick="window.print()">
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
      .eq('status', 'verified')
      .limit(1000); // Limit to 1000 records max

    // Use date range filtering instead of .like() for better performance
    if (month) {
      const startDate = `${month}-01`;
      // Get last day of the month
      const [year, monthNum] = month.split('-');
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
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
      byEmployee.get(l.employee_id).total += (l.basic_salary || 0) + (l.overtime_pay || 0) - (l.cash_advance || 0);
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
          byProject.get(prjName).total += (l.basic_salary || 0) + (l.overtime_pay || 0) - (l.cash_advance || 0);
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
                  const total = (l.basic_salary || 0) + (l.overtime_pay || 0) - (l.cash_advance || 0);
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
  const data = window.__laporanGajiData;
  if (!data || data.byEmployee.size === 0) {
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
    const totalKasbon = logs.reduce((s, l) => s + (l.cash_advance || 0), 0);

    return {
      full_name: emp?.full_name,
      jabatan: emp?.jabatan,
      total_hari: logs.length,
      gaji_pokok: totalGaji,
      lembur: totalLembur,
      kasbon: totalKasbon,
      total_bersih: totalGaji + totalLembur - totalKasbon,
      logs,
    };
  });

  exportLaporanGaji(exportData, data.filters);
}
