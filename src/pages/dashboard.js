import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, esc } from '../lib/helpers.js';

const BON_WARNING_THRESHOLD = 500000; // Rp 500.000

/**
 * Dashboard / Beranda page
 */
export function DashboardPage(state) {
  const { user, employees, projects, attendanceLogs, dbConnected, dashboardView } = state;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = attendanceLogs.filter(l => l.created_at?.startsWith(todayStr));
  const hadirLogs = todayLogs.filter(l => l.status === 'verified');
  const absenLogs = todayLogs.filter(l => l.status === 'absent');
  const hadirCount = hadirLogs.length;
  const absenCount = absenLogs.length;

  const statsHtml = `
    <div class="stats-grid">
      <div class="stat-card" onclick="window.__app.switchDashboardView('employees')" id="stat-employees">
        <div class="stat-icon purple"><i class="fas fa-users"></i></div>
        <div class="stat-value">${employees.length}</div>
        <div class="stat-label">Total Karyawan</div>
      </div>
      <div class="stat-card" onclick="window.__app.switchDashboardView('projects')" id="stat-projects">
        <div class="stat-icon cyan"><i class="fas fa-building"></i></div>
        <div class="stat-value">${projects.length}</div>
        <div class="stat-label">Proyek Aktif</div>
      </div>
      <div class="stat-card" onclick="window.__app.switchDashboardView('hadir')" id="stat-hadir">
        <div class="stat-icon green"><i class="fas fa-user-check"></i></div>
        <div class="stat-value">${hadirCount}</div>
        <div class="stat-label">Hadir Hari Ini</div>
      </div>
      <div class="stat-card" onclick="window.__app.switchDashboardView('absen')" id="stat-absen">
        <div class="stat-icon amber"><i class="fas fa-user-xmark"></i></div>
        <div class="stat-value">${absenCount}</div>
        <div class="stat-label">Tidak Hadir</div>
      </div>
    </div>`;

  function attendanceTable(logs, title, emptyText) {
    return `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-clipboard-list"></i> ${title}</div>
          <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Nama</th><th>Role</th><th>Proyek</th><th>Masuk</th><th>Keluar</th></tr></thead>
            <tbody>
              ${logs.length === 0 ? `<tr><td colspan="5" class="text-center text-muted">${emptyText}</td></tr>` :
                logs.map(l => {
                  const emp = employees.find(e => e.id === l.employee_id);
                  const prj = projects.find(p => p.id === l.project_id);
                  return `<tr>
                    <td class="fw-bold">${esc(emp?.full_name || '-')}</td>
                    <td><span class="badge badge-role">${esc(emp?.role || '-')}</span></td>
                    <td>${esc(prj?.name || 'Absensi Mandiri')}</td>
                    <td>${l.check_in ? l.check_in.slice(0,5) : '-'}</td>
                    <td>${l.check_out ? l.check_out.slice(0,5) : '-'}</td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  let detailHtml = '';
  if (dashboardView === 'employees') {
    detailHtml = `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-users"></i> Daftar Karyawan</div>
          <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Nama</th><th>Role</th><th>WhatsApp</th></tr></thead>
            <tbody>
              ${employees.length === 0 ? '<tr><td colspan="3" class="text-center text-muted">Belum ada karyawan</td></tr>' :
                employees.map(e => `<tr>
                  <td class="fw-bold">${esc(e.full_name)}</td>
                  <td><span class="badge badge-role">${esc(e.role)}</span></td>
                  <td>${esc(e.whatsapp_number) || '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } else if (dashboardView === 'projects') {
    detailHtml = `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-building"></i> Daftar Proyek</div>
          <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Proyek</th><th>Lokasi</th><th>Progress</th></tr></thead>
            <tbody>
              ${projects.length === 0 ? '<tr><td colspan="3" class="text-center text-muted">Belum ada proyek</td></tr>' :
                projects.map(p => `<tr>
                  <td class="fw-bold">${esc(p.name)}</td>
                  <td>${esc(p.location_name) || '-'}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="progress-bar-wrap" style="width:80px"><div class="progress-bar-fill" style="width:${p.progress_pct||0}%"></div></div>
                      <span class="text-sm">${p.progress_pct||0}%</span>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } else if (dashboardView === 'hadir') {
    detailHtml = attendanceTable(hadirLogs, 'Daftar Hadir Hari Ini', 'Belum ada yang hadir hari ini');
  } else if (dashboardView === 'absen') {
    detailHtml = attendanceTable(absenLogs, 'Daftar Tidak Hadir Hari Ini', 'Belum ada yang tidak hadir hari ini');
  }

  if (!dashboardView) {
    detailHtml = `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-clipboard-list"></i> Aktivitas Hari Ini</div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Karyawan</th><th>Proyek</th><th>Status</th><th>Masuk</th><th>Keluar</th></tr></thead>
            <tbody>
              ${todayLogs.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">Belum ada aktivitas hari ini</td></tr>' :
                todayLogs.map(l => {
                const emp = employees.find(e => e.id === l.employee_id);
                const prj = projects.find(p => p.id === l.project_id);
                const isHadir = l.status === 'verified';
                const statusText = isHadir ? 'Hadir' : l.status === 'absent' ? 'Tidak Hadir' : 'Belum Verifikasi';
                return `<tr>
                  <td class="fw-bold">${esc(emp?.full_name || '-')}</td>
                  <td>${esc(prj?.name || 'Absensi Mandiri')}</td>
                  <td><span class="${isHadir ? 'text-success' : 'text-danger'}">${esc(statusText)}</span></td>
                  <td>${l.check_in ? l.check_in.slice(0,5) : '-'}</td>
                  <td>${l.check_out ? l.check_out.slice(0,5) : '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  return `
    <div class="fade-in">
      <div class="flex items-center gap-8 mb-16">
        <span class="badge ${dbConnected ? 'badge-online' : 'badge-offline'}">
          <i class="fas fa-${dbConnected ? 'wifi' : 'wifi-slash'}" style="margin-right:4px"></i>
          ${dbConnected ? 'DATABASE ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <!-- Notifikasi Bon -->
      <div id="bon-notifications"></div>

      <!-- Ringkasan Pengeluaran Hari Ini -->
      <div id="today-expenses"></div>

      ${statsHtml}
      ${detailHtml}
    </div>`;
}

/** Load notifikasi bon: tampilkan warning jika ada karyawan dengan bon tinggi */
export async function loadBonNotifications(employees) {
  const container = document.getElementById('bon-notifications');
  if (!container) return;

  const flagged = employees.filter(e => (e.bon_balance || 0) >= BON_WARNING_THRESHOLD);
  if (flagged.length === 0) { container.innerHTML = ''; return; }

  const list = flagged.map(e =>
    `<div class="flex items-center gap-8 mt-4" style="font-size:0.85rem;">
      <i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i>
      <span><strong>${esc(e.full_name)}</strong> — Bon: <strong class="text-danger">${fmtIdr(e.bon_balance)}</strong></span>
    </div>`
  ).join('');

  container.innerHTML = `
    <div class="card mb-16" style="background:rgba(245,158,11,0.08);border-left:4px solid #f59e0b;padding:12px 16px;">
      <div style="font-weight:700;font-size:0.9rem;color:#f59e0b;margin-bottom:4px;">
        <i class="fas fa-bell"></i> ${flagged.length} Karyawan Bon Mendekati Batas
      </div>
      ${list}
    </div>`;
}

/** Load ringkasan pengeluaran proyek hari ini */
export async function loadTodayExpenses(projects) {
  const container = document.getElementById('today-expenses');
  if (!container) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('project_expenses')
      .select('project_id, amount, category, description')
      .eq('expense_date', today)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) { container.innerHTML = ''; return; }

    const total = data.reduce((sum, d) => sum + (d.amount || 0), 0);
    const rows = data.slice(0, 5).map(d => {
      const p = projects.find(pr => pr.id === d.project_id);
      return `<div class="flex items-center gap-8 mt-4" style="font-size:0.85rem;">
        <span class="badge badge-role">${esc(d.category)}</span>
        <span>${esc(p?.name || 'Proyek')}</span>
        <strong>${fmtIdr(d.amount)}</strong>
        <span class="text-secondary">${esc(d.description || '')}</span>
      </div>`;
    }).join('');

    const more = data.length > 5 ? `<div class="text-xs text-secondary mt-8">+${data.length - 5} pengeluaran lainnya</div>` : '';

    container.innerHTML = `
      <div class="card mb-16" style="background:rgba(25,210,193,0.06);border-left:4px solid var(--primary);padding:12px 16px;">
        <div class="flex items-center justify-between" style="font-weight:700;font-size:0.9rem;color:var(--primary);">
          <span><i class="fas fa-receipt"></i> Pengeluaran Hari Ini — ${fmtDate(today)}</span>
          <span class="text-success">${fmtIdr(total)}</span>
        </div>
        ${rows}
        ${more}
      </div>`;
  } catch (e) {
    container.innerHTML = '';
  }
}
