import { fmtDate, esc, showToast } from '../lib/helpers.js';
import { supabase } from '../lib/supabase.js';
import { exportLaporanKegiatanExcel } from '../lib/excel-export.js';

/**
 * Laporan Kegiatan Harian — Opsi B (query langsung, data ringan)
 * Rekap daily_activities per karyawan per hari
 */
export function LaporanKegiatanPage(state) {
  const { user, employees, projects } = state;

  if (!['superadmin', 'owner', 'admin'].includes(user.role)) {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i><p>Akses terbatas admin/owner/superadmin.</p>
    </div></div>`;
  }

  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);

  return `
    <div class="fade-in" style="padding:20px;max-width:1200px;margin:0 auto;">
      <div class="mb-16" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h1 class="fw-bold" style="font-size:1.5rem;margin:0;">
            <i class="fas fa-tasks"></i> Laporan Kegiatan Harian
          </h1>
          <div class="text-xs text-secondary">Rekap kegiatan karyawan per hari dari absensi</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success" onclick="window.__app.exportLaporanKegiatan()">
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
            <label class="form-label">Bulan</label>
            <input type="month" class="form-input" id="lk-month"
              value="${defaultMonth}" onchange="window.__app.loadLaporanKegiatan()" />
          </div>
          <div>
            <label class="form-label">Karyawan</label>
            <select class="form-select" id="lk-employee" onchange="window.__app.loadLaporanKegiatan()">
              <option value="">Semua Karyawan</option>
              ${employees.filter(e => e.role === 'karyawan').map(e =>
                `<option value="${e.id}">${esc(e.full_name)}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Proyek</label>
            <select class="form-select" id="lk-project" onchange="window.__app.loadLaporanKegiatan()">
              <option value="">Semua Proyek</option>
              ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Tabel -->
      <div class="card" id="lk-container">
        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>
      </div>
    </div>

    <script>window.__app.loadLaporanKegiatan();</script>

    <style>
      @media print {
        body { background: white !important; }
        .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        button { display: none !important; }
      }
    </style>
  `;
}

export async function loadLaporanKegiatan() {
  const container = document.getElementById('lk-container');
  if (!container) return;

  const month      = document.getElementById('lk-month')?.value || '';
  const employeeId = document.getElementById('lk-employee')?.value || '';
  const projectId  = document.getElementById('lk-project')?.value || '';

  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>';

  try {
    // Query Opsi B: langsung ke tabel, join di JS
    let attQuery = supabase
      .from('attendance_logs')
      .select('id, employee_id, project_id, created_at, status')
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(500);

    if (month) {
      const [y, m] = month.split('-');
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      attQuery = attQuery
        .gte('created_at', `${month}-01T00:00:00`)
        .lte('created_at', `${month}-${String(lastDay).padStart(2,'0')}T23:59:59`);
    }
    if (employeeId) attQuery = attQuery.eq('employee_id', employeeId);
    if (projectId)  attQuery = attQuery.eq('project_id', projectId);

    const { data: logs, error: logErr } = await attQuery;
    if (logErr) throw logErr;

    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data untuk filter ini.</p></div>';
      return;
    }

    // Ambil daily_activities untuk attendance yang ditemukan
    const attIds = logs.map(l => l.id);
    const { data: activities, error: actErr } = await supabase
      .from('daily_activities')
      .select('attendance_id, description, status')
      .in('attendance_id', attIds)
      .order('created_at', { ascending: true });

    if (actErr) throw actErr;

    // Simpan untuk export
    window.__laporanKegiatanData = { logs, activities: activities || [], filters: { month, employeeId, projectId } };

    // Group activities by attendance_id
    const actByAtt = new Map();
    (activities || []).forEach(a => {
      if (!actByAtt.has(a.attendance_id)) actByAtt.set(a.attendance_id, []);
      actByAtt.get(a.attendance_id).push(a);
    });

    // Render tabel — satu baris per attendance, kegiatan di-list
    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Karyawan</th>
              <th>Proyek</th>
              <th>Kegiatan</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => {
              const acts = actByAtt.get(l.id) || [];
              const kegiatanHtml = acts.length > 0
                ? acts.map(a => `
                    <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;">
                      <span class="badge ${a.status === 'done' ? 'badge-success' : 'badge-warning'}"
                        style="font-size:0.65rem;margin-top:2px;flex-shrink:0;">
                        ${a.status === 'done' ? 'Selesai' : 'Proses'}
                      </span>
                      <span class="text-sm">${esc(a.description)}</span>
                    </div>`).join('')
                : '<span class="text-xs text-secondary">— tidak ada kegiatan —</span>';

              // Resolve names from state (passed via window.__laporanKegiatanState)
              const empName  = window.__laporanKegiatanState?.employees?.find(e => e.id === l.employee_id)?.full_name || l.employee_id;
              const prjName  = window.__laporanKegiatanState?.projects?.find(p => p.id === l.project_id)?.name || '-';

              return `
                <tr>
                  <td class="text-xs" style="white-space:nowrap;">${fmtDate(l.created_at)}</td>
                  <td class="fw-bold text-sm">${esc(empName)}</td>
                  <td class="text-xs text-secondary">${esc(prjName)}</td>
                  <td>${kegiatanHtml}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="text-xs text-secondary" style="padding:8px 16px;">
        Menampilkan ${logs.length} hari kerja, ${(activities||[]).length} kegiatan
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

export function exportLaporanKegiatan() {
  const stored = window.__laporanKegiatanData;
  if (!stored?.logs?.length) {
    showToast('Silakan muat data terlebih dahulu', 'error');
    return;
  }
  exportLaporanKegiatanExcel(stored.logs, stored.activities, stored.filters, window.__laporanKegiatanState);
}
