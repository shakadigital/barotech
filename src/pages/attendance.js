import { supabase } from '../lib/supabase.js';
import { fmtTime, fmtDate, fmtIdr, esc, showToast } from '../lib/helpers.js';
import { canFinance, FINANCE_ROLES, canVerify, canDelete, canVerifyAll, canVerifyOwn } from '../lib/roles.js';
import { exportLaporanAbsensi } from '../lib/excel-export.js';

const WORK_HOURS_STANDARD = 8; // jam kerja standar per hari

/**
 * Attendance Page
 *
 * Admin/Owner/Superadmin : lihat daftar + detail keuangan + delete
 * Kepala Proyek          : auto-generate dari assignment, verifikasi semua proyek
 * Kepala Gudang          : lihat semua proyek, read-only
 * Kepala Lapangan        : auto-generate proyeknya, verifikasi proyeknya sendiri
 */
export function AttendancePage(state) {
  const { projects, employees, attendanceLogs, user } = state;
  const role = user.role;

  const isFinance    = canFinance(role);
  const isDeleter    = canDelete(role);
  const isVerifyAll  = canVerifyAll(role);
  const isVerifyOwn  = canVerifyOwn(role);
  const isReadOnly   = role === 'kepala_gudang';
  const isAdmin      = ['superadmin','owner','admin'].includes(role);

  const myProjectIds = projects.filter(p => p.lead_id === user.id).map(p => p.id);

  const todayStr = new Date().toISOString().slice(0, 10);
  let todayLogs  = attendanceLogs.filter(l => l.created_at?.startsWith(todayStr));

  if (isVerifyOwn) {
    todayLogs = todayLogs.filter(l => myProjectIds.includes(l.project_id));
  }

  // Filter non-karyawan attendance based on role
  // Admin: can see kepala_gudang, kepala_proyek, kepala_lapangan
  // Owner: can see admin
  // Superadmin: can see all
  if (role === 'admin') {
    const adminIds = employees.filter(e => e.role === 'admin').map(e => e.id);
    todayLogs = todayLogs.filter(l => !adminIds.includes(l.employee_id)); // Hide admin from admin
  } else if (role === 'owner') {
    const otherNonKaryawanIds = employees.filter(e => ['kepala_gudang', 'kepala_proyek', 'kepala_lapangan'].includes(e.role)).map(e => e.id);
    // Owner can see admin, but hide kepala_gudang/kepala_proyek/kepala_lapangan from owner's view
    // Actually, owner should see admin only, not the others
    const adminIds = employees.filter(e => e.role === 'admin').map(e => e.id);
    todayLogs = todayLogs.filter(l => adminIds.includes(l.employee_id) || !['admin', 'kepala_gudang', 'kepala_proyek', 'kepala_lapangan'].includes(employees.find(e => e.id === l.employee_id)?.role));
  }

  // ── Info banner ─────────────────────────────────────────────────────────
  function infoBanner() {
    let msg = '';
    if (isVerifyAll) msg = 'Daftar kehadiran otomatis tersinkron saat admin menempatkan karyawan ke proyek. Silakan verifikasi kehadiran di bawah.';
    if (isVerifyOwn) msg = 'Daftar kehadiran otomatis tersinkron dari penugasan proyek Anda. Silakan verifikasi kehadiran di bawah.';
    if (isReadOnly)  msg = 'Daftar kehadiran semua proyek hari ini (read-only).';
    if (!msg) return '';
    return `
      <div class="card mb-16" style="background:rgba(25,210,193,0.06);border-left:4px solid var(--primary);padding:12px 16px;">
        <div class="flex gap-8 align-center" style="flex-wrap:wrap;gap:12px;">
          <span class="text-sm"><i class="fas fa-info-circle text-primary"></i> ${msg}</span>
        </div>
      </div>`;
  }

  // ── Render baris tabel ──────────────────────────────────────────────────
  function renderRow(l, idx) {
    const emp = employees.find(e => e.id === l.employee_id);
    const prj = projects.find(p => p.id === l.project_id);
    const isDraft    = l.status === 'draft';
    const isVerified = l.status === 'verified';
    const isAbsent   = l.status === 'absent';

    // Deteksi "Pindah Tugas" dari notes
    const isPindah = l.notes?.startsWith('Pindah Tugas');
    // Deteksi non-karyawan (Office attendance)
    const isOfficeStaff = l.notes?.includes('Office attendance');
    const empRole = emp?.role || 'karyawan';
    const isNonKaryawan = ['admin', 'kepala_gudang', 'kepala_proyek', 'kepala_lapangan'].includes(empRole);

    // Status badge
    let statusBadge = '';
    if (isPindah && isDraft) {
      statusBadge = '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">PINDAH TUGAS</span>';
    } else if (isVerified) {
      statusBadge = '<span class="badge badge-online">HADIR</span>';
    } else if (isAbsent) {
      statusBadge = '<span class="badge badge-offline">TIDAK HADIR</span>';
    } else {
      statusBadge = '<span class="badge badge-offline">BELUM VERIFIKASI</span>';
    }

    // Aksi verifikasi
    // Admin dapat verifikasi kepala_gudang, kepala_proyek, kepala_lapangan
    // Owner dapat verifikasi admin
    // Superadmin dapat verifikasi semua
    const canVerifyThis = (isVerifyAll) || (isVerifyOwn && myProjectIds.includes(l.project_id));
    let canVerifyNonKaryawan = false;

    if (role === 'admin' && ['kepala_gudang', 'kepala_proyek', 'kepala_lapangan'].includes(empRole)) {
      canVerifyNonKaryawan = true;
    } else if (role === 'owner' && empRole === 'admin') {
      canVerifyNonKaryawan = true;
    } else if (role === 'superadmin') {
      canVerifyNonKaryawan = true;
    }

    const finalCanVerify = canVerifyThis || (isNonKaryawan && canVerifyNonKaryawan);
    let actions = '';

    if (finalCanVerify && isDraft) {
      actions = `
        <div style="display:flex;flex-direction:column;gap:6px;min-width:200px;">
          ${isPindah ? `<div class="text-xs text-warning mb-4"><i class="fas fa-info-circle"></i> ${esc(l.notes)}</div>` : ''}
          ${isOfficeStaff ? `<div class="text-xs text-primary mb-4"><i class="fas fa-building"></i> Office staff</div>` : ''}
          <input type="text" class="form-input" id="wi-${l.id}"
            placeholder="Pekerjaan hari ini..."
            value="${esc(l.work_items || '')}"
            style="font-size:0.78rem;padding:6px 10px;" />
          <div class="flex gap-6">
            <button class="btn btn-success btn-sm" style="flex:1;"
              onclick="window.__app.verifyAttendance('${l.id}','verified')">
              <i class="fas fa-check"></i> Hadir
            </button>
            <button class="btn btn-danger btn-sm" style="flex:1;"
              onclick="window.__app.verifyAttendance('${l.id}','absent')">
              <i class="fas fa-times"></i> Tidak Hadir
            </button>
          </div>
        </div>`;
    } else if (finalCanVerify && isVerified) {
      actions = `
        <div style="display:flex;flex-direction:column;gap:4px;min-width:180px;">
          <div class="text-xs text-success mb-4">
            <i class="fas fa-check-double"></i> Sudah Diverifikasi
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            <input type="text" class="form-input" id="wi-${l.id}"
              placeholder="Tambah pekerjaan..."
              value="${esc(l.work_items || '')}"
              style="font-size:0.78rem;padding:5px 8px;flex:1;" />
            <button class="btn btn-ghost btn-sm"
              onclick="window.__app.saveWorkItems('${l.id}')" title="Simpan">
              <i class="fas fa-save"></i>
            </button>
          </div>
        </div>`;
    } else if (isNonKaryawan && !canVerifyNonKaryawan) {
      // Non-karyawan tapi tidak punya izin verifikasi
      if (empRole === 'admin' && role === 'admin') {
        actions = '<span class="text-xs text-warning">Owner only</span>';
      } else if (['kepala_gudang', 'kepala_proyek', 'kepala_lapangan'].includes(empRole) && role === 'owner') {
        actions = '<span class="text-xs text-warning">Admin only</span>';
      } else {
        actions = '<span class="text-xs text-muted">—</span>';
      }
    } else if (!canVerifyThis && !isAdmin) {
      actions = '<span class="text-xs text-muted">—</span>';
    }

    // Tombol delete untuk admin
    if (isDeleter) {
      actions += `
        <button class="btn btn-ghost btn-sm" onclick="window.__app.deleteAttendance('${l.id}')" title="Hapus">
          <i class="fas fa-trash"></i>
        </button>`;
    }

    // Kolom keuangan
    let financeCell = '';
    if (isFinance) {
      const totalTerima = (l.basic_salary||0) + (l.overtime_pay||0) + (l.misc_amount||0)
                        - (l.cash_advance||0) + (l.cash_payout||0);
      const durasi = calcDuration(l.check_in, l.check_out);
      const hasBreakdown = (l.uang_makan||0) > 0 || (l.transport||0) > 0 || (l.tunjangan_lain||0) > 0;
      // Location tag — only visible to admin+ (icon only, data saved in DB)
      const locTag = (l.checkin_lat || l.checkout_lat) ? `
        <div class="text-secondary" style="font-size:0.65rem;margin-top:2px;">
          <i class="fas fa-map-marker-alt"></i> Lokasi tercatat
        </div>` : '';
      financeCell = `
        <td>
          <div class="text-xs">
            <div class="text-secondary mb-4">
              <i class="fas fa-clock"></i> ${fmtTime(l.check_in)}–${fmtTime(l.check_out)}
              <span style="margin-left:4px;">(${durasi} jam)</span>
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px;margin-left:4px;"
                onclick="window.__app.openEditAttendance('${l.id}')"
                title="Edit jam & keuangan">
                <i class="fas fa-edit" style="font-size:0.7rem;"></i>
              </button>
            </div>
            ${locTag}
            ${hasBreakdown ? `
            <div style="margin-bottom:2px;">
              ${l.uang_makan ? `<div>Makan: ${fmtIdr(l.uang_makan)}</div>` : ''}
              ${l.transport ? `<div>Transport: ${fmtIdr(l.transport)}</div>` : ''}
              ${l.tunjangan_lain ? `<div>Tunjangan: ${fmtIdr(l.tunjangan_lain)}</div>` : ''}
            </div>` : ''}
            <div>Total/Hari: <strong>${fmtIdr(l.basic_salary)}</strong>
              <span class="text-secondary" style="font-size:0.7rem;"> (${fmtIdr(l.hourly_rate||0)}/jam)</span>
            </div>
            ${(l.overtime_hours||0) > 0 ? `<div>Lembur: ${l.overtime_hours}j × ${fmtIdr(l.overtime_rate)} = <strong>${fmtIdr(l.overtime_pay)}</strong></div>` : ''}
            ${(l.misc_amount||0) > 0 ? `<div>Lain-lain: <strong>${fmtIdr(l.misc_amount)}</strong>${l.misc_description ? ` (${esc(l.misc_description)})` : ''}</div>` : ''}
            ${(l.cash_advance||0) > 0 ? `<div class="text-danger">Kasbon: -${fmtIdr(l.cash_advance)}</div>` : ''}
            ${(l.cash_payout||0) > 0 ? `<div class="text-warning">Pinjam: +${fmtIdr(l.cash_payout)}</div>` : ''}
            <div style="border-top:1px solid var(--border,#e5e7eb);margin-top:4px;padding-top:4px;">
              Total: <strong class="text-success">${fmtIdr(totalTerima)}</strong>
            </div>
          </div>
        </td>`;
    }

    return `
      <tr>
        <td class="text-xs text-secondary">${idx !== undefined ? idx + 1 : ''}</td>
        <td>
          <div class="fw-bold">${esc(emp?.full_name || '-')}</div>
          ${l.jabatan_snapshot ? `<div class="text-xs text-secondary">${esc(l.jabatan_snapshot)}</div>` : ''}
        </td>
        <td><span class="text-xs text-secondary">${esc(prj?.name || '-')}</span></td>
        <td>${statusBadge}</td>
        ${financeCell}
        <td>${actions}</td>
      </tr>`;
  }

  const pageTitle = isAdmin      ? 'Daftar Absensi Hari Ini'
    : isVerifyAll                ? 'Verifikasi Kehadiran — Semua Proyek'
    : isVerifyOwn                ? 'Verifikasi Kehadiran — Proyek Saya'
    : isReadOnly                 ? 'Daftar Kehadiran Hari Ini'
    : 'Absensi';

  // Self-attendance for ALL roles
  function selfAttendanceSection() {
    // Find today's own attendance
    const myTodayLog = attendanceLogs.find(l =>
      l.employee_id === user.id && l.created_at?.startsWith(todayStr)
    );
    const hasClockedIn  = !!myTodayLog?.check_in;
    const hasClockedOut = !!myTodayLog?.check_out;

    return `
      <div class="card mb-16" style="background:rgba(25,210,193,0.08);border-left:4px solid var(--primary);padding:16px;">
        <div class="flex gap-16 align-center" style="flex-wrap:wrap;gap:12px;">
          <div>
            <div class="fw-bold mb-4"><i class="fas fa-user-clock text-primary"></i> Absensi Diri Sendiri</div>
            <div class="text-xs text-secondary">Absen masuk/pulang untuk ${esc(user.full_name)}</div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-success" id="btn-clockin" onclick="window.__app.clockIn()"
              ${hasClockedIn ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              <i class="fas fa-sign-in-alt"></i> <span class="text-xs">${hasClockedIn ? fmtTime(myTodayLog.check_in) : 'Masuk'}</span>
            </button>
            <button class="btn btn-danger" id="btn-clockout" onclick="window.__app.clockOut()"
              ${!hasClockedIn || hasClockedOut ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              <i class="fas fa-sign-out-alt"></i> <span class="text-xs">${hasClockedOut ? fmtTime(myTodayLog.check_out) : 'Pulang'}</span>
            </button>
          </div>
        </div>
        <div id="self-att-status" class="mt-12 text-xs">
          ${hasClockedIn && !hasClockedOut ? '<span class="text-warning"><i class="fas fa-clock"></i> Sudah masuk, menunggu check-out</span>' : ''}
          ${hasClockedIn && hasClockedOut ? '<span class="text-success"><i class="fas fa-check-double"></i> Absensi hari ini selesai</span>' : ''}
          ${!hasClockedIn ? '<span class="text-secondary"><i class="fas fa-info-circle"></i> Lokasi GPS akan direkam saat check-in/out</span>' : ''}
        </div>

        <!-- Kegiatan Hari Ini (Multi-Item) -->
        ${hasClockedIn && !hasClockedOut ? `
        <div class="mt-16" style="border-top:1px solid var(--border);padding-top:12px;">
          <div class="text-xs fw-bold mb-8"><i class="fas fa-tasks text-primary"></i> Kegiatan Hari Ini</div>
          <div class="flex gap-8 mb-8">
            <input type="text" class="form-input" id="self-activity-input"
              placeholder="Tambah kegiatan..." style="flex:1;" />
            <button type="button" class="btn btn-sm btn-ghost" onclick="window.__addSelfActivity()">
              <i class="fas fa-plus"></i> Tambah
            </button>
          </div>
          <div id="self-activities-list"></div>
        </div>` : ''}
      </div>
    `;
  }

  return `
    <div class="fade-in">
      ${selfAttendanceSection()}
      ${!isAdmin ? infoBanner() : ''}

      ${isAdmin ? `
      <!-- Admin: info auto-sync -->
      <div class="card mb-16" style="background:rgba(25,210,193,0.06);border-left:4px solid var(--primary);padding:12px 16px;">
        <div class="flex gap-8 align-center" style="flex-wrap:wrap;gap:12px;">
          <span class="text-sm"><i class="fas fa-info-circle text-primary"></i>
            Admin: penugasan karyawan otomatis tersinkron ke absensi. Gunakan menu <strong>Assignment</strong> untuk mengatur penugasan.
          </span>
        </div>
      </div>` : ''}

      <!-- Tabel Absensi -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-clipboard-list"></i> ${pageTitle}</div>
          <div class="flex gap-8 align-center">
            <span class="badge badge-role">${todayLogs.length} orang</span>
            ${isAdmin ? `<button class="btn btn-sm btn-success" onclick="window.__app.exportAbsensiToExcel()" title="Download Excel">
              <i class="fas fa-file-excel"></i>
            </button>` : ''}
          </div>
        </div>

        ${todayLogs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-user-clock"></i>
            <p>Belum ada data absensi hari ini.</p>
            ${(isVerifyAll || isVerifyOwn || isAdmin) ? `
            <button class="btn btn-primary btn-sm mt-16"
              onclick="window.__app.generateDailyAttendance()">
              <i class="fas fa-sync-alt"></i> Generate Sekarang
            </button>` : ''}
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:40px;">No.</th>
                  <th>Karyawan</th>
                  <th>Proyek</th>
                  <th>Status</th>
                  ${isFinance ? '<th>Keuangan</th>' : ''}
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                ${todayLogs.map((l, idx) => renderRow(l, idx)).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>`;
}

/** Generate absensi harian dari assignment aktif */
export async function generateDailyAttendance(refreshFn) {
  const btn = document.getElementById('btn-generate-att');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating...'; }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc('generate_daily_attendance', { p_date: today });
    if (error) throw error;

    const newCount = data?.filter(r => r.is_new).length || 0;
    const totalCount = data?.length || 0;

    if (newCount > 0) {
      showToast(`${newCount} absensi baru di-generate (total ${totalCount} karyawan)`, 'success');
    } else {
      showToast(`Absensi sudah up-to-date (${totalCount} karyawan)`, 'info');
    }
    await refreshFn();
  } catch (err) {
    showToast('Gagal generate: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Generate Absensi Hari Ini'; }
  }
}

/** Verifikasi + simpan work items */
export async function verifyAttendance(id, result, refreshFn) {
  try {
    const status    = result === 'verified' ? 'verified' : 'absent';
    const notes     = result === 'verified' ? 'Hadir' : 'Tidak Hadir';
    const wiInput   = document.getElementById(`wi-${id}`);
    const workItems = wiInput?.value.trim() || null;

    const { error } = await supabase.from('attendance_logs')
      .update({ status, notes, ...(workItems ? { work_items: workItems } : {}) })
      .eq('id', id);
    if (error) throw error;
    showToast(result === 'verified' ? 'Hadir ✓' : 'Tidak Hadir ✓', 'success');
    await refreshFn?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

/** Simpan work items saja (tanpa ubah status) */
export async function saveWorkItems(id, refreshFn) {
  const wiInput = document.getElementById(`wi-${id}`);
  if (!wiInput) return;
  try {
    const { error } = await supabase.from('attendance_logs')
      .update({ work_items: wiInput.value.trim() || null })
      .eq('id', id);
    if (error) throw error;
    showToast('Pekerjaan disimpan ✓', 'success');
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

/** Hapus absensi — superadmin & owner */
export async function deleteAttendance(id, refreshFn) {
  if (!confirm('Hapus data absensi ini?')) return;
  const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
  if (error) showToast(error.message, 'error');
  else { showToast('Dihapus ✓', 'success'); refreshFn(); }
}

/** Helper: hitung durasi jam dari TIME string */
function calcDuration(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 8;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const diff = (oh * 60 + om) - (ih * 60 + im);
  return diff > 0 ? Math.round(diff / 60 * 10) / 10 : 8;
}

/** Buka modal edit absensi */
export async function openEditAttendance(id, state) {
  // Fetch data terbaru
  const { data: l, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { showToast('Gagal memuat data', 'error'); return; }

  const emp = state.employees.find(e => e.id === l.employee_id);
  const prj = state.projects.find(p => p.id === l.project_id);

  // Hapus modal lama jika ada
  document.getElementById('att-edit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'att-edit-modal';
  modal.className = 'modal-overlay';

  // Extract time from TIMESTAMPTZ
  const extractTime = (ts) => ts ? (ts.match(/\d{2}:\d{2}/)?.[0] || '08:00') : '08:00';
  const attDateVal  = l.check_in ? l.check_in.slice(0,10) : new Date().toISOString().slice(0,10);

  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px;">
      <div class="modal-title">
        <i class="fas fa-edit"></i> Edit Absensi
        <button onclick="document.getElementById('att-edit-modal').remove()"
          style="margin-left:auto;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:1.2rem;">✕</button>
      </div>

      <div class="mb-16" style="background:var(--bg-hover);border-radius:var(--radius);padding:10px 14px;">
        <div class="text-sm fw-bold">${esc(emp?.full_name||'-')}</div>
        <div class="text-xs text-secondary">${esc(prj?.name||'-')}</div>
      </div>

      <!-- Tanggal & Jam -->
      <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
        <i class="fas fa-calendar-clock"></i> Tanggal & Jam
      </div>
      <div class="form-row mb-8">
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input type="date" class="form-input" id="edit-att-date"
            value="${attDateVal}" />
        </div>
      </div>
      <div class="form-row mb-16">
        <div class="form-group">
          <label class="form-label">Jam Masuk</label>
          <input type="time" class="form-input" id="edit-checkin"
            value="${extractTime(l.check_in)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Jam Keluar</label>
          <input type="time" class="form-input" id="edit-checkout"
            value="${extractTime(l.check_out)}" />
        </div>
      </div>

      <!-- Gaji -->
      <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
        <i class="fas fa-coins"></i> Gaji
      </div>
      <div class="form-row mb-16">
        <div class="form-group">
          <label class="form-label">Gaji / Hari (Rp)</label>
          <input type="number" class="form-input" id="edit-salary"
            value="${l.basic_salary||0}" min="0"
            style="font-weight:700;" />
        </div>
      </div>

      <!-- Lembur -->
      <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
        <i class="fas fa-moon"></i> Lembur
      </div>
      <div class="form-row mb-8">
        <div class="form-group">
          <label class="form-label">Ongkos Lembur / Jam (Rp)</label>
          <input type="number" class="form-input" id="edit-ot-rate"
            value="${emp?.overtime_rate || l.overtime_rate || 0}" min="0"
            oninput="window.__att_editOTCalc()" />
        </div>
        <div class="form-group">
          <label class="form-label">Lama Lembur (jam)</label>
          <input type="number" class="form-input" id="edit-ot-hours"
            value="${l.overtime_hours||0}" min="0" step="0.5"
            oninput="window.__att_editOTCalc()" />
        </div>
      </div>
      <div class="form-row mb-16">
        <div class="form-group">
          <label class="form-label">Total Lembur (Rp)</label>
          <input type="text" class="form-input" id="edit-ot-pay-display"
            value="${fmtIdr(l.overtime_pay||0)}" readonly
            style="background:var(--bg-input);cursor:default;font-weight:700;" />
          <input type="hidden" id="edit-ot-pay" value="${l.overtime_pay||0}" />
        </div>
      </div>

      <!-- Komponen Lain -->
      <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
        <i class="fas fa-list"></i> Komponen Lain
      </div>
      <div class="form-row mb-8">
        <div class="form-group">
          <label class="form-label">Uang Makan (Rp)</label>
          <input type="number" class="form-input" id="edit-uang-makan"
            value="${l.uang_makan||0}" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Transport (Rp)</label>
          <input type="number" class="form-input" id="edit-transport"
            value="${l.transport||0}" min="0" />
        </div>
      </div>
      <div class="form-row mb-16">
        <div class="form-group">
          <label class="form-label">Lain-lain (Rp)</label>
          <input type="number" class="form-input" id="edit-misc-amount"
            value="${l.misc_amount||0}" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Keterangan</label>
          <input type="text" class="form-input" id="edit-misc-desc"
            value="${esc(l.misc_description||'')}" />
        </div>
      </div>

      <!-- Kasbon -->
      <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
        <i class="fas fa-hand-holding-dollar"></i> Kasbon
      </div>
      <div class="form-row mb-24">
        <div class="form-group">
          <label class="form-label">Potongan Kasbon (Rp)</label>
          <input type="number" class="form-input" id="edit-cash-advance"
            value="${l.cash_advance||0}" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Pinjam Baru (Rp)</label>
          <input type="number" class="form-input" id="edit-cash-payout"
            value="${l.cash_payout||0}" min="0" />
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="document.getElementById('att-edit-modal').remove()">
          Batal
        </button>
        <button class="btn btn-primary" onclick="window.__app.saveEditAttendance('${id}')">
          <i class="fas fa-save"></i> Simpan Perubahan
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Init lembur calc
  window.__att_editOTCalc();
}

/** Absen masuk untuk absensi mandiri */
export async function clockIn(state, refreshFn) {
  const btn = document.getElementById('btn-clockin');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> <span class="text-xs">Masuk...</span>'; }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 8);

    // Cek apakah sudah ada attendance hari ini
    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('employee_id', state.user.id)
      .gte('check_in', today + ' 00:00:00')
      .lt('check_in', (new Date(Date.now() + 86400000)).toISOString().slice(0, 10) + ' 00:00:00')
      .maybeSingle();

    if (existing) {
      throw new Error('Anda sudah absen masuk hari ini');
    }

    // Get user's basic salary from profiles
    let basicSalary = 0;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('basic_salary')
        .eq('id', state.user.id)
        .maybeSingle();
      basicSalary = profile?.basic_salary || 0;
    } catch (e) {
      console.log('basic_salary column may not exist yet, using 0');
    }

    const hourlyRate = basicSalary / 8;

    // Capture GPS location
    const geo = await getGeoLocation();

    // Insert attendance baru
    const { error } = await supabase.from('attendance_logs').insert({
      employee_id: state.user.id,
      project_id: null,
      check_in: today + ' ' + now,
      check_out: null,
      status: 'draft',
      hourly_rate: hourlyRate,
      basic_salary: basicSalary,
      notes: 'Absensi Mandiri',
      checkin_lat: geo?.lat || null,
      checkin_lng: geo?.lng || null,
    });

    if (error) throw error;

    const statusDiv = document.getElementById('self-att-status');
    if (statusDiv) {
      statusDiv.innerHTML = `<span class="text-success"><i class="fas fa-check-circle"></i> Absen masuk berhasil jam ${now.slice(0,5)}${geo ? ` 📍 ${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}` : ''}</span>`;
    }

    showToast('Absen masuk berhasil!', 'success');
    await refreshFn?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span class="text-xs">Masuk</span>'; }
  }
}

/** Absen pulang untuk absensi mandiri */
export async function clockOut(state, refreshFn) {
  const btn = document.getElementById('btn-clockout');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> <span class="text-xs">Pulang...</span>'; }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 8);

    // Cek attendance hari ini
    const { data: existing, error: fetchErr } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('employee_id', state.user.id)
      .gte('check_in', today + ' 00:00:00')
      .lt('check_in', (new Date(Date.now() + 86400000)).toISOString().slice(0, 10) + ' 00:00:00')
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new Error('Anda belum absen masuk hari ini');
    }

    if (existing.check_out) {
      throw new Error('Anda sudah absen pulang hari ini');
    }

    // Capture GPS location
    const geo = await getGeoLocation();

    // Update check_out + location
    const { error } = await supabase
      .from('attendance_logs')
      .update({
        check_out: today + ' ' + now,
        checkout_lat: geo?.lat || null,
        checkout_lng: geo?.lng || null,
      })
      .eq('id', existing.id);

    if (error) throw error;

    // Save self activities to daily_activities
    if (window.__selfActivities && window.__selfActivities.length > 0) {
      const activityInserts = window.__selfActivities.map(desc => ({
        attendance_id: existing.id,
        description: desc,
        status: 'done',
        created_by: state.user.id,
      }));
      const { error: actError } = await supabase.from('daily_activities').insert(activityInserts);
      if (actError) throw actError;
      window.__selfActivities = []; // Clear after save
    }

    const statusDiv = document.getElementById('self-att-status');
    if (statusDiv) {
      statusDiv.innerHTML = `<span class="text-success"><i class="fas fa-check-double"></i> Absen pulang berhasil jam ${now.slice(0,5)}${geo ? ` 📍 ${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}` : ''}</span>`;
    }

    showToast('Absen pulang berhasil!', 'success');
    await refreshFn?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span class="text-xs">Pulang</span>'; }
  }
}

/** Self activity management functions */
if (typeof window !== 'undefined') {
  window.__selfActivities = [];

  window.__addSelfActivity = function () {
    const input = document.getElementById('self-activity-input');
    const desc = input?.value.trim();
    if (!desc) return;
    window.__selfActivities.push(desc);
    input.value = '';
    renderSelfActivities();
  };

  function renderSelfActivities() {
    const list = document.getElementById('self-activities-list');
    if (!list) return;
    list.innerHTML = window.__selfActivities.map((desc, idx) => `
      <div class="flex align-center gap-8 mb-4" style="padding:6px 10px;background:var(--bg-input);border-radius:var(--radius);">
        <span class="text-sm">${esc(desc)}</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="window.__removeSelfActivity(${idx})" style="margin-left:auto;">
          <i class="fas fa-times" style="color:var(--danger)"></i>
        </button>
      </div>
    `).join('');
  }

  window.__removeSelfActivity = function (idx) {
    window.__selfActivities.splice(idx, 1);
    renderSelfActivities();
  };
}

/** Export Absensi ke Excel */
export async function exportAbsensiToExcel(state) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: logs, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('created_at', todayStr + ' 00:00:00')
      .lt('created_at', todayStr + ' 23:59:59');

    if (error) throw error;

    // Join with employees and projects
    const exportLogs = logs.map(l => {
      const emp = state.employees.find(e => e.id === l.employee_id);
      const prj = state.projects.find(p => p.id === l.project_id);
      return {
        ...l,
        employee_name: emp?.full_name,
        project_name: prj?.name,
      };
    });

    exportLaporanAbsensi(exportLogs, { month: todayStr.slice(0, 7) });
  } catch (err) {
    showToast('Gagal export: ' + err.message, 'error');
  }
}

/** Simpan edit absensi */
export async function saveEditAttendance(id, refreshFn) {
  try {
    const checkIn  = document.getElementById('edit-checkin').value;
    const checkOut = document.getElementById('edit-checkout').value;
    const attDate  = document.getElementById('edit-att-date')?.value || new Date().toISOString().slice(0,10);
    const dailySalary = parseFloat(document.getElementById('edit-salary').value) || 0;

    const otRate  = parseFloat(document.getElementById('edit-ot-rate').value) || 0;
    const otHours = parseFloat(document.getElementById('edit-ot-hours').value) || 0;
    const otPay   = Math.round(otHours * otRate);

    const uangMakan    = parseFloat(document.getElementById('edit-uang-makan')?.value) || 0;
    const transportVal = parseFloat(document.getElementById('edit-transport')?.value) || 0;

    // Keep hourly_rate for DB compatibility (daily / 8)
    const hourlyRate = Math.round(dailySalary / 8);

    const { error } = await supabase.from('attendance_logs').update({
      check_in:         attDate + ' ' + checkIn + ':00',
      check_out:        attDate + ' ' + checkOut + ':00',
      hourly_rate:      hourlyRate,
      basic_salary:     dailySalary,
      uang_makan:       uangMakan,
      transport:        transportVal,
      overtime_hours:   otHours,
      overtime_rate:    otRate,
      overtime_pay:     otPay,
      misc_amount:      parseFloat(document.getElementById('edit-misc-amount').value) || 0,
      misc_description: document.getElementById('edit-misc-desc').value.trim() || null,
      cash_advance:     parseFloat(document.getElementById('edit-cash-advance').value) || 0,
      cash_payout:      parseFloat(document.getElementById('edit-cash-payout').value) || 0,
    }).eq('id', id);

    if (error) throw error;
    showToast('Absensi berhasil diupdate ✓', 'success');
    document.getElementById('att-edit-modal')?.remove();
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

/** Kalkulasi realtime di modal edit */
if (typeof window !== 'undefined') {
  window.__att_editOTCalc = function () {
    const hours = parseFloat(document.getElementById('edit-ot-hours')?.value) || 0;
    const rate  = parseFloat(document.getElementById('edit-ot-rate')?.value) || 0;
    const total = Math.round(hours * rate);
    const disp  = document.getElementById('edit-ot-pay-display');
    const hid   = document.getElementById('edit-ot-pay');
    if (disp) disp.value = 'Rp ' + total.toLocaleString('id-ID');
    if (hid)  hid.value  = total;
  };
}

/** Auto check-out stale records (>15 jam tanpa check-out) */
export async function autoCheckoutStale() {
  try {
    const { data, error } = await supabase.rpc('auto_checkout_stale');
    if (error) throw error;
    if (data > 0) {
      showToast(`${data} absensi di-auto check-out (lebih dari 15 jam)`, 'info');
    }
  } catch (err) {
    console.log('auto_checkout_stale:', err.message);
  }
}
