import { fmtTime, fmtDate, fmtIdr, esc } from '../lib/helpers.js';

/**
 * Riwayat Absensi & Pendapatan — Karyawan only
 * Menampilkan kehadiran, kegiatan, dan rincian pendapatan harian.
 */
export function RiwayatPage(state) {
  const { user, attendanceLogs, projects, dailyActivities } = state;

  // Guard: halaman ini hanya untuk karyawan
  if (user.role !== 'karyawan') {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i>
      <p>Halaman ini hanya dapat diakses oleh karyawan.</p>
    </div></div>`;
  }

  // Filter frontend — hanya data milik sendiri
  const myLogs = attendanceLogs
    .filter(l => l.employee_id === user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // ── Ringkasan kehadiran ──
  const totalHadir      = myLogs.filter(l => l.status === 'verified').length;
  const totalTidakHadir = myLogs.filter(l => l.status === 'absent').length;
  const totalPending    = myLogs.filter(l => l.status === 'draft' || !l.status).length;
  const totalOtHours    = myLogs.reduce((s, l) => s + (l.overtime_hours || 0), 0);

  // ── Ringkasan keuangan (hanya dari record verified) ──
  const verifiedLogs = myLogs.filter(l => l.status === 'verified');
  const totalGajiPokok = verifiedLogs.reduce((s, l) => s + (l.basic_salary || 0), 0);
  const totalLembur    = verifiedLogs.reduce((s, l) => s + (l.overtime_pay || 0), 0);
  const totalKasbon    = verifiedLogs.reduce((s, l) => s + (l.cash_advance || 0), 0);
  const totalLain      = verifiedLogs.reduce((s, l) => s + (l.misc_amount || 0), 0);
  const totalPinjam    = verifiedLogs.reduce((s, l) => s + (l.cash_payout || 0), 0);
  const saldoBersih    = totalGajiPokok + totalLembur + totalLain + totalPinjam - totalKasbon;

  // ── Group by project untuk subtotal ──
  const byProject = new Map();
  verifiedLogs.forEach(l => {
    const prj = projects.find(p => p.id === l.project_id);
    const prjName = prj?.name || 'Tidak ada proyek';
    if (!byProject.has(prjName)) {
      byProject.set(prjName, { count: 0, total: 0 });
    }
    byProject.get(prjName).count += 1;
    byProject.get(prjName).total += calcTotal(l);
  });

  // ── Detect project changes ──
  const logsWithProjectChange = myLogs.map((l, idx) => {
    const prevPrj = idx > 0 ? projects.find(p => p.id === myLogs[idx - 1].project_id) : null;
    const currPrj = projects.find(p => p.id === l.project_id);
    const projectChanged = prevPrj && currPrj && prevPrj.id !== currPrj.id;
    return { ...l, projectChanged, prevPrjName: prevPrj?.name, currPrjName: currPrj?.name };
  });

  // ── Helper: hitung total_terima per baris ──
  function calcTotal(l) {
    return (l.basic_salary || 0) + (l.overtime_pay || 0) + (l.misc_amount || 0)
         - (l.cash_advance || 0) + (l.cash_payout || 0);
  }

  return `
    <div class="fade-in">

      <!-- Ringkasan Kehadiran -->
      ${myLogs.length > 0 ? `
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-chart-pie"></i> Ringkasan Kehadiran</div>
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

      <!-- Ringkasan Keuangan -->
      ${verifiedLogs.length > 0 ? `
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-wallet"></i> Ringkasan Pendapatan</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;padding:8px 0;">
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Gaji Pokok</div>
            <div class="fw-bold" style="font-size:1.1rem;">${fmtIdr(totalGajiPokok)}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Upah Lembur</div>
            <div class="fw-bold text-success" style="font-size:1.1rem;">${fmtIdr(totalLembur)}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Potongan Kasbon</div>
            <div class="fw-bold text-danger" style="font-size:1.1rem;">-${fmtIdr(totalKasbon)}</div>
          </div>
          <div class="text-center">
            <div class="text-xs text-secondary mb-4">Saldo Bersih</div>
            <div class="fw-bold text-success" style="font-size:1.2rem;">${fmtIdr(saldoBersih)}</div>
          </div>
        </div>
      </div>

      <!-- Breakdown per Proyek -->
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-building"></i> Pendapatan per Proyek</div>
        </div>
        <div style="padding:8px 0;">
          ${Array.from(byProject.entries()).map(([prjName, data]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:4px;background:var(--bg-hover);border-radius:var(--radius);">
              <div>
                <div class="fw-bold text-sm">${esc(prjName)}</div>
                <div class="text-xs text-secondary">${data.count} hari kerja</div>
              </div>
              <div class="text-right">
                <div class="fw-bold text-success">${fmtIdr(data.total)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- Tabel Riwayat -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-history"></i> Riwayat Kehadiran & Pendapatan</div>
          <span class="badge badge-role">${myLogs.length} data</span>
        </div>

        ${myLogs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-calendar-xmark"></i>
            <p>Belum ada data absensi</p>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table" id="riwayat-table">
              <thead>
                <tr>
                  <th style="width:40px;">No.</th>
                  <th style="width:30px;"></th>
                  <th>Tanggal</th>
                  <th>Proyek</th>
                  <th>Kegiatan</th>
                  <th>Masuk</th>
                  <th>Keluar</th>
                  <th class="text-right">Pendapatan</th>
                </tr>
              </thead>
              <tbody>
                ${logsWithProjectChange.map((l, idx) => {
                  const prj = projects.find(p => p.id === l.project_id);
                  const isVerified = l.status === 'verified';
                  const totalTerima = calcTotal(l);

                  // Status badge
                  let statusBadge = '';
                  if (isVerified) {
                    statusBadge = '<span class="badge badge-online">HADIR</span>';
                  } else if (l.status === 'absent') {
                    statusBadge = '<span class="badge badge-offline">TIDAK HADIR</span>';
                  } else {
                    statusBadge = '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">PENDING</span>';
                  }

                  // Project change indicator
                  const projectChangeBadge = l.projectChanged ? `
                    <div class="text-xs text-warning" style="margin-top:2px;">
                      <i class="fas fa-exchange-alt"></i> Pindah: ${esc(l.prevPrjName)} → ${esc(l.currPrjName)}
                    </div>` : '';

                  // Breakdown keuangan untuk detail row
                  const hasBreakdown = (l.uang_makan||0) > 0 || (l.transport||0) > 0 || (l.tunjangan_lain||0) > 0;
                  const acts = dailyActivities.filter(a => a.attendance_id === l.id);
                  const detailHtml = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:0.78rem;">
                      <div><span class="text-secondary">Status:</span> ${statusBadge}</div>
                      <div><span class="text-secondary">Jabatan:</span> ${esc(l.jabatan_snapshot || '-')}</div>
                      ${hasBreakdown ? `
                      <div style="grid-column:1/-1;border-bottom:1px solid var(--border,#e5e7eb);margin:4px 0;"></div>
                      <div><span class="text-secondary">Uang Makan:</span> ${fmtIdr(l.uang_makan||0)}</div>
                      <div><span class="text-secondary">Transport:</span> ${fmtIdr(l.transport||0)}</div>
                      ${l.tunjangan_lain ? `<div><span class="text-secondary">Tunjangan:</span> ${fmtIdr(l.tunjangan_lain)}</div>` : ''}
                      ` : ''}
                      <div><span class="text-secondary">Gaji Pokok:</span> <strong>${fmtIdr(l.basic_salary||0)}</strong></div>
                      <div><span class="text-secondary">Rate:</span> ${fmtIdr(l.hourly_rate||0)}/jam</div>
                      ${(l.overtime_hours||0) > 0 ? `
                      <div><span class="text-secondary">Lembur:</span> ${l.overtime_hours}j × ${fmtIdr(l.overtime_rate||0)} = <strong class="text-success">${fmtIdr(l.overtime_pay||0)}</strong></div>
                      ` : ''}
                      ${(l.misc_amount||0) > 0 ? `
                      <div><span class="text-secondary">Lain-lain:</span> ${fmtIdr(l.misc_amount)}${l.misc_description ? ` (${esc(l.misc_description)})` : ''}</div>
                      ` : ''}
                      ${(l.cash_advance||0) > 0 ? `
                      <div><span class="text-secondary">Kasbon:</span> <span class="text-danger">-${fmtIdr(l.cash_advance)}</span></div>
                      ` : ''}
                      ${(l.cash_payout||0) > 0 ? `
                      <div><span class="text-secondary">Pinjam:</span> <span class="text-warning">+${fmtIdr(l.cash_payout)}</span></div>
                      ` : ''}
                      <div style="grid-column:1/-1;border-top:1px solid var(--border,#e5e7eb);margin-top:4px;padding-top:4px;">
                        <span class="text-secondary">Total Diterima:</span>
                        <strong class="text-success" style="font-size:0.9rem;">${fmtIdr(totalTerima)}</strong>
                      </div>
                      ${acts.length > 0 ? `
                      <div style="grid-column:1/-1;border-top:1px solid var(--border,#e5e7eb);margin-top:8px;padding-top:8px;">
                        <div class="text-xs fw-bold mb-4" style="color:var(--text-secondary);"><i class="fas fa-tasks"></i> Kegiatan Hari Ini</div>
                        ${acts.map(a => `
                          <div style="padding:4px 8px;background:var(--bg-input);border-radius:var(--radius);margin-bottom:4px;">
                            <span class="text-sm">✓ ${esc(a.description)}</span>
                          </div>
                        `).join('')}
                      </div>` : ''}
                    </div>`;

                  return `
                  <tr class="riwayat-row" data-index="${idx}" style="cursor:pointer;">
                    <td class="text-xs text-secondary">${idx + 1}</td>
                    <td style="width:30px;cursor:pointer;" onclick="event.stopPropagation();window.__app.toggleRiwayatRow(${idx})">
                      <i class="fas fa-chevron-right text-secondary" id="riwayat-chevron-${idx}"></i>
                    </td>
                    <td class="text-xs">${fmtDate(l.created_at)}</td>
                    <td>
                      <div class="fw-bold">${esc(prj?.name || '-')}</div>
                      ${projectChangeBadge}
                    </td>
                    <td class="text-xs text-secondary">${esc(l.work_items || '—')}</td>
                    <td class="text-xs">${fmtTime(l.check_in)}</td>
                    <td class="text-xs">${fmtTime(l.check_out)}</td>
                    <td class="text-right fw-bold ${isVerified ? 'text-success' : 'text-secondary'}">${isVerified ? fmtIdr(totalTerima) : '—'}</td>
                  </tr>
                  <tr id="riwayat-detail-${idx}" style="display:none;background:var(--bg-hover);">
                    <td colspan="8" style="padding:12px 16px;">${detailHtml}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>`;
}

/** Toggle detail row di tabel riwayat */
if (typeof window !== 'undefined') {
  window.__app = window.__app || {};
  window.__app.toggleRiwayatRow = function (idx) {
    const detail = document.getElementById(`riwayat-detail-${idx}`);
    const chevron = document.getElementById(`riwayat-chevron-${idx}`);
    if (!detail) return;
    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'table-row';
    if (chevron) {
      chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
      chevron.style.transition = 'transform 0.2s';
    }
  };
}
