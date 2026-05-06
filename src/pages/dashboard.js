import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, fmtTime, esc } from '../lib/helpers.js';
import { ROLE_LABELS } from '../lib/roles.js';

const BON_WARNING_THRESHOLD = 500000; // Rp 500.000

/**
 * Dashboard / Beranda page — role-based views
 *
 * Owner/Admin/Superadmin  : semua karyawan + semua proyek + hadir/tidak hadir
 * Kepala Proyek/Gudang    : karyawan s/d kepala_lapangan + semua proyek + hadir/tidak hadir
 * Kepala Lapangan         : karyawan s/d kepala_lapangan + proyek sendiri + hadir/tidak hadir
 * Karyawan                : karyawan s/d kepala_lapangan + tanpa quick action card
 */
export function DashboardPage(state) {
  const { user, employees, projects, attendanceLogs, dbConnected, dashboardView } = state;
  const role = user.role;
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Role-based employee filter ──
  // Owner/Admin/Superadmin: lihat semua role
  // Lainnya: hanya karyawan, kepala_proyek, kepala_gudang, kepala_lapangan
  const showAdminRoles = ['owner', 'admin', 'superadmin'].includes(role);
  const visibleRoles = showAdminRoles
    ? ['karyawan','kepala_proyek','kepala_gudang','kepala_lapangan','admin','superadmin']
    : ['karyawan','kepala_proyek','kepala_gudang','kepala_lapangan'];
  const visibleEmps = employees.filter(e => visibleRoles.includes(e.role));
  const visibleEmpIds = new Set(visibleEmps.map(e => e.id));

  // ── Role-based project filter ──
  // Kepala Lapangan: hanya proyeknya
  const isKepalaLapangan = role === 'kepala_lapangan';
  const activeProjects = projects.filter(p => p.status !== 'selesai');
  const visibleProjects = isKepalaLapangan
    ? activeProjects.filter(p => p.lead_id === user.id)
    : activeProjects;

  // ── Today's attendance ──
  const todayLogs = attendanceLogs.filter(l =>
    l.created_at?.startsWith(todayStr) && visibleEmpIds.has(l.employee_id)
  );
  const hadirLogs  = todayLogs.filter(l => l.status === 'verified');
  const hadirCount = hadirLogs.length;

  // Hitung yang BELUM absen (tidak ada record sama sekali) — dikurangi owner & superadmin
  const sudahAbsenIds = new Set(todayLogs.map(l => l.employee_id));
  const belumAbsenCount = visibleEmps.filter(e =>
    !sudahAbsenIds.has(e.id) &&
    e.role !== 'owner' &&
    e.role !== 'superadmin'
  ).length;

  // ── Karyawan: no quick action stats ──
  const isKaryawan = role === 'karyawan';

  // ── Stats cards ──
  const statsHtml = isKaryawan ? '' : `
    <div class="stats-grid">
      <div class="stat-card" onclick="window.__app.switchDashboardView('employees')" id="stat-employees">
        <div class="stat-icon purple"><i class="fas fa-users"></i></div>
        <div class="stat-value">${visibleEmps.length}</div>
        <div class="stat-label">Personil</div>
      </div>
      <div class="stat-card" onclick="window.__app.switchDashboardView('projects')" id="stat-projects">
        <div class="stat-icon cyan"><i class="fas fa-building"></i></div>
        <div class="stat-value">${visibleProjects.length}</div>
        <div class="stat-label">Proyek Aktif</div>
      </div>
      <div class="stat-card" onclick="window.__app.switchDashboardView('hadir')" id="stat-hadir">
        <div class="stat-icon green"><i class="fas fa-user-check"></i></div>
        <div class="stat-value">${hadirCount}</div>
        <div class="stat-label">Hadir</div>
      </div>
      <div class="stat-card" onclick="window.__app.switchDashboardView('absen')" id="stat-absen">
        <div class="stat-icon amber"><i class="fas fa-user-xmark"></i></div>
        <div class="stat-value">${belumAbsenCount}</div>
        <div class="stat-label">Belum Absen</div>
      </div>
    </div>`;

  // ── Shared: attendance table ──
  function attendanceTable(logs, title, emptyText) {
    return `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-clipboard-list"></i> ${title}</div>
          <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th style="width:40px;">No.</th><th>Nama</th><th>Role</th><th>Proyek</th><th>Status</th><th>Masuk</th><th>Keluar</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${logs.length === 0 ? `<tr><td colspan="8" class="text-center text-muted">${emptyText}</td></tr>` :
                logs.map((l, idx) => {
                  const emp = employees.find(e => e.id === l.employee_id);
                  const prj = projects.find(p => p.id === l.project_id);
                  const isHadir = l.status === 'verified';
                  const statusBadge = isHadir
                    ? '<span class="badge badge-online">Hadir</span>'
                    : l.status === 'absent'
                      ? '<span class="badge badge-offline">Tidak Hadir</span>'
                      : '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">Pending</span>';
                  return `<tr>
                    <td class="text-xs text-secondary">${idx + 1}</td>
                    <td class="fw-bold">${esc(emp?.full_name || '-')}</td>
                    <td><span class="badge badge-role">${esc(ROLE_LABELS[emp?.role] || emp?.role || '-')}</span></td>
                    <td>${esc(prj?.name || 'Absensi Mandiri')}</td>
                    <td>${statusBadge}</td>
                    <td>${l.check_in ? fmtTime(l.check_in) : '-'}</td>
                    <td>${l.check_out ? fmtTime(l.check_out) : '-'}</td>
                    <td class="text-xs text-secondary">${esc(l.work_items || l.notes || '-')}</td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Detail views ──
  let detailHtml = '';
  if (dashboardView === 'employees') {
    detailHtml = `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-users"></i> Daftar Personil</div>
          <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th style="width:40px;">No.</th><th>Nama</th><th>Role</th><th>WhatsApp</th></tr></thead>
            <tbody>
              ${visibleEmps.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">Belum ada personil</td></tr>' :
                visibleEmps.map((e, idx) => `<tr>
                  <td class="text-xs text-secondary">${idx + 1}</td>
                  <td class="fw-bold">${esc(e.full_name)}</td>
                  <td><span class="badge badge-role">${esc(ROLE_LABELS[e.role] || e.role)}</span></td>
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
          <div class="card-title"><i class="fas fa-building"></i> Proyek Aktif</div>
          <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th style="width:40px;">No.</th><th>Proyek</th><th>Kepala Lapangan</th><th>Personel</th><th>Progres</th></tr></thead>
            <tbody>
              ${visibleProjects.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">Belum ada proyek aktif</td></tr>' :
                visibleProjects.map((p, idx) => {
                  const lead = employees.find(e => e.id === p.lead_id);
                  // Count personnel assigned to this project
                  const personnel = employees.filter(e => {
                    return state.assignments?.some(a =>
                      a.project_id === p.id && a.employee_id === e.id && a.status === 'active'
                    );
                  }).length;
                  return `<tr>
                    <td class="text-xs text-secondary">${idx + 1}</td>
                    <td class="fw-bold">${esc(p.name)}</td>
                    <td>${esc(lead?.full_name || '-')}</td>
                    <td class="text-center">${personnel}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div class="progress-bar-wrap" style="width:80px"><div class="progress-bar-fill" style="width:${p.progress_pct||0}%"></div></div>
                        <span class="text-sm">${p.progress_pct||0}%</span>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } else if (dashboardView === 'hadir') {
    detailHtml = attendanceTable(hadirLogs, 'Daftar Hadir Hari Ini', 'Belum ada yang hadir hari ini');
  } else if (dashboardView === 'absen') {
    // Tampilkan semua user yang BELUM absen hari ini (tidak ada record attendance)
    // dikurangi role 'owner' dan 'superadmin'
    const sudahAbsenIds = new Set(todayLogs.map(l => l.employee_id));
    const belumAbsen = visibleEmps.filter(e =>
      !sudahAbsenIds.has(e.id) &&
      e.role !== 'owner' &&
      e.role !== 'superadmin'
    );

    detailHtml = `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-user-xmark"></i> Belum Absen Hari Ini</div>
          <div class="flex gap-8 align-center">
            <span class="badge badge-offline">${belumAbsen.length} orang</span>
            <button class="btn btn-ghost btn-sm" onclick="window.__app.switchDashboardView(null)"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:40px;">No.</th>
                <th>Nama</th>
                <th>Role</th>
                <th>Proyek</th>
              </tr>
            </thead>
            <tbody>
              ${belumAbsen.length === 0
                ? '<tr><td colspan="4" class="text-center text-muted">Semua sudah absen hari ini 🎉</td></tr>'
                : belumAbsen.map((emp, idx) => {
                    // Cari proyek aktif karyawan dari assignments
                    const asgn = state.assignments?.find(a =>
                      a.employee_id === emp.id && a.status === 'active'
                    );
                    const prj = asgn ? projects.find(p => p.id === asgn.project_id) : null;
                    return `<tr>
                      <td class="text-xs text-secondary">${idx + 1}</td>
                      <td class="fw-bold">${esc(emp.full_name)}</td>
                      <td><span class="badge badge-role">${esc(ROLE_LABELS[emp.role] || emp.role)}</span></td>
                      <td class="text-xs text-secondary">${esc(prj?.name || '—')}</td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Default view: aktivitas hari ini ──
  if (!dashboardView) {
    detailHtml = `
      <div class="card slide-up">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-clipboard-list"></i> Aktivitas Hari Ini</div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th style="width:40px;">No.</th><th>Nama</th><th>Role</th><th>Proyek</th><th>Status</th><th>Masuk</th><th>Keluar</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${todayLogs.length === 0 ? '<tr><td colspan="8" class="text-center text-muted">Belum ada aktivitas hari ini</td></tr>' :
                todayLogs.map((l, idx) => {
                const emp = employees.find(e => e.id === l.employee_id);
                const prj = projects.find(p => p.id === l.project_id);
                const isHadir = l.status === 'verified';
                const statusBadge = isHadir
                  ? '<span class="badge badge-online">Hadir</span>'
                  : l.status === 'absent'
                    ? '<span class="badge badge-offline">Tidak Hadir</span>'
                    : '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">Pending</span>';
                return `<tr>
                  <td class="text-xs text-secondary">${idx + 1}</td>
                  <td class="fw-bold">${esc(emp?.full_name || '-')}</td>
                  <td><span class="badge badge-role">${esc(ROLE_LABELS[emp?.role] || emp?.role || '-')}</span></td>
                  <td>${esc(prj?.name || 'Absensi Mandiri')}</td>
                  <td>${statusBadge}</td>
                  <td>${l.check_in ? fmtTime(l.check_in) : '-'}</td>
                  <td>${l.check_out ? fmtTime(l.check_out) : '-'}</td>
                  <td class="text-xs text-secondary">${esc(l.work_items || l.notes || '-')}</td>
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
