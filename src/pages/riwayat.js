import { fmtTime, fmtDate, esc } from '../lib/helpers.js';

/**
 * Riwayat Absensi — Karyawan only
 * Karyawan TIDAK boleh lihat data keuangan (gaji, lembur, kasbon, total).
 * Hanya tampil: tanggal, proyek, status, jam kerja, durasi lembur, jabatan.
 */
export function RiwayatPage(state) {
  const { user, attendanceLogs, projects } = state;

  // Guard: halaman ini hanya untuk karyawan
  if (user.role !== 'karyawan') {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i>
      <p>Halaman ini hanya dapat diakses oleh karyawan.</p>
    </div></div>`;
  }

  // Filter frontend (lapisan ketiga) — hanya data milik sendiri
  const myLogs = attendanceLogs
    .filter(l => l.employee_id === user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Ringkasan: hanya kehadiran, tanpa keuangan
  const totalHadir      = myLogs.filter(l => l.status === 'verified').length;
  const totalTidakHadir = myLogs.filter(l => l.status === 'absent').length;
  const totalPending    = myLogs.filter(l => l.status === 'draft' || !l.status).length;

  // Total jam lembur (durasi saja, tanpa nilai uang)
  const totalOtHours = myLogs.reduce((s, l) => s + (l.overtime_hours || 0), 0);

  return `
    <div class="fade-in">

      <!-- Ringkasan kehadiran (tanpa keuangan) -->
      ${myLogs.length > 0 ? `
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-chart-pie"></i> Ringkasan</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;padding:8px 0;">
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Hadir</div>
            <div class="fw-bold text-success" style="font-size:1.4rem;">${totalHadir}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Tidak Hadir</div>
            <div class="fw-bold text-danger" style="font-size:1.4rem;">${totalTidakHadir}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Pending</div>
            <div class="fw-bold text-secondary" style="font-size:1.4rem;">${totalPending}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Total Lembur</div>
            <div class="fw-bold" style="font-size:1.2rem;">${totalOtHours} <span class="text-xs text-secondary">jam</span></div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Total Hari</div>
            <div class="fw-bold" style="font-size:1.4rem;">${myLogs.length}</div>
          </div>
        </div>
      </div>` : ''}

      <!-- Tabel Riwayat -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-history"></i> Riwayat Absensi Saya</div>
          <span class="badge badge-role">${myLogs.length} data</span>
        </div>

        ${myLogs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-calendar-xmark"></i>
            <p>Belum ada data absensi</p>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:40px;">No.</th>
                  <th>Tanggal</th>
                  <th>Proyek</th>
                  <th>Status</th>
                  <th>Jam Kerja</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                ${myLogs.map((l, idx) => {
                  const prj = projects.find(p => p.id === l.project_id);

                  // Status badge
                  let statusBadge = '';
                  if (l.status === 'verified') {
                    statusBadge = '<span class="badge badge-online">HADIR</span>';
                  } else if (l.status === 'absent') {
                    statusBadge = '<span class="badge badge-offline">TIDAK HADIR</span>';
                  } else {
                    statusBadge = '<span class="badge badge-offline">PENDING</span>';
                  }

                  return `<tr>
                    <td class="text-xs text-secondary">${idx + 1}</td>
                    <td class="text-xs">${fmtDate(l.created_at)}</td>
                    <td class="fw-bold">${esc(prj?.name || '-')}</td>
                    <td>${statusBadge}</td>
                    <td class="text-xs">
                      <div>${fmtTime(l.check_in)} – ${fmtTime(l.check_out)}</div>
                      ${(l.overtime_hours || 0) > 0
                        ? `<div class="text-secondary" style="margin-top:2px;">
                             <i class="fas fa-clock"></i> Lembur: <strong>${l.overtime_hours} jam</strong>
                           </div>`
                        : ''}
                    </td>
                    <td class="text-xs text-secondary">
                      ${l.jabatan_snapshot ? `<div><i class="fas fa-hard-hat"></i> ${esc(l.jabatan_snapshot)}</div>` : ''}
                      ${l.work_items
                        ? `<div style="margin-top:2px;"><i class="fas fa-tasks"></i> ${esc(l.work_items)}</div>`
                        : '<div class="text-muted">—</div>'}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>`;
}
