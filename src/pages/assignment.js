import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, fmtTime, showToast, esc, localNow } from '../lib/helpers.js';
import { canFinance, FINANCE_ROLES } from '../lib/roles.js';

/**
 * Halaman Penugasan — Admin / Owner / Superadmin
 * Penugasan karyawan ke proyek secara permanen atau sementara.
 * Gaji dasar disimpan di penugasan, bisa diedit.
 */
export function AssignmentPage(state) {
  const { projects, employees, user } = state;

  const activeProjects = projects.filter(p => p.status === 'aktif');
  const karyawanList   = employees.filter(e => e.role === 'karyawan');

  return `
    <div class="fade-in">

      <!-- Form Penugasan Baru (Collapsible) -->
      <div class="card mb-24">
        <div class="card-header" style="cursor:pointer;" onclick="window.__toggleAssignForm()">
          <div class="card-title">
            <i class="fas fa-user-tag"></i> Tugaskan Karyawan ke Proyek
          </div>
          <i class="fas fa-chevron-down" id="assign-form-chevron" style="transition:transform 0.2s;"></i>
        </div>
        <div id="assign-form-container" style="display:none;">
        <form id="assign-form" onsubmit="window.__app.handleAssignSubmit(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Proyek</label>
              <select class="form-select" id="asgn-project" required>
                <option value="">Pilih Proyek Aktif</option>
                ${activeProjects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Karyawan</label>
              <select class="form-select" id="asgn-employee" required
                onchange="window.__asgn_onEmployeeChange(this.value)">
                <option value="">Pilih Karyawan</option>
                ${karyawanList.map(e =>
                  `<option value="${e.id}" data-jabatan="${esc(e.jabatan||'Karyawan')}">${esc(e.full_name)}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <!-- Info karyawan yang dipilih -->
          <div id="asgn-emp-info" class="mb-16" style="display:none;
            background:rgba(25,210,193,0.08);border-left:4px solid var(--primary);
            border-radius:var(--radius);padding:10px 14px;">
            <div class="text-xs">
              <i class="fas fa-user-tag" style="color:var(--primary)"></i>
              <strong>Data Karyawan:</strong>
              <div id="asgn-emp-detail" class="mt-4"></div>
            </div>
          </div>

          <!-- Info penugasan aktif karyawan -->
          <div id="asgn-current-info" class="mb-16" style="display:none;
            background:rgba(245,158,11,0.1);border-left:4px solid var(--warning);
            border-radius:var(--radius);padding:10px 14px;">
            <div class="text-xs">
              <i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i>
              <strong>Karyawan ini sedang aktif di proyek lain.</strong>
              <div id="asgn-current-detail" class="text-secondary mt-4"></div>
              <div class="mt-4">Penugasan lama akan otomatis di-<strong>pause</strong> saat Anda simpan.</div>
            </div>
          </div>

          <!-- Breakdown Keuangan -->
          <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
            <i class="fas fa-coins"></i> Komponen Upah / Hari
          </div>
          <div class="form-row mb-8">
            <div class="form-group">
              <label class="form-label">Uang Makan (Rp)</label>
              <input type="number" class="form-input" id="asgn-uang-makan"
                value="50000" min="0" required
                oninput="window.__asgn_calcTotal()" />
            </div>
            <div class="form-group">
              <label class="form-label">Transport (Rp)</label>
              <input type="number" class="form-input" id="asgn-transport"
                value="50000" min="0" required
                oninput="window.__asgn_calcTotal()" />
            </div>
          </div>
          <div class="form-row mb-8">
            <div class="form-group">
              <label class="form-label">Tunjangan Lain (Rp)</label>
              <input type="number" class="form-input" id="asgn-tunjangan"
                value="50000" min="0" required
                oninput="window.__asgn_calcTotal()" />
            </div>
            <div class="form-group">
              <label class="form-label">Total / Hari (Rp)</label>
              <input type="number" class="form-input" id="asgn-salary"
                value="150000" min="0" readonly
                style="background:var(--bg-input);cursor:default;font-weight:700;" />
            </div>
          </div>

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Tanggal Mulai</label>
              <input type="date" class="form-input" id="asgn-start"
                value="${new Date().toISOString().slice(0,10)}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal Selesai <span class="text-muted">(kosongkan = sampai proyek selesai)</span></label>
              <input type="date" class="form-input" id="asgn-end" />
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Keterangan</label>
              <input type="text" class="form-input" id="asgn-notes"
                placeholder="Contoh: Pindah sementara, Tambahan tenaga, dll" />
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="asgn-submit-btn">
            <i class="fas fa-save"></i> Simpan Penugasan
          </button>
        </form>
        </div>
      </div>

      <!-- Daftar Penugasan Aktif -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-list-check"></i> Penugasan Aktif</div>
        </div>
        <div id="penugasan-list">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>

      <!-- Karyawan Belum Ditugaskan -->
      <div class="card mt-24">
        <div class="card-header" style="cursor:pointer;" onclick="window.__toggleUnassignedList()">
          <div class="card-title"><i class="fas fa-user-slash"></i> Karyawan Belum Ditugaskan</div>
          <div class="flex gap-8 align-center">
            <span class="badge badge-offline" id="unassigned-count-badge" style="display:none;"></span>
            <i class="fas fa-chevron-down" id="unassigned-chevron" style="transition:transform 0.2s;"></i>
          </div>
        </div>
        <div id="unassigned-list" style="display:none;">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>
    </div>`;
}

/** Load daftar penugasan — dengan row collapsible + check-in status */
export async function loadAssignments(state) {
  const el = document.getElementById('penugasan-list');
  if (!el) return;

  // Show skeleton loader
  el.innerHTML = `
    <div style="padding:16px;">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>`;

  try {
    const { data, error } = await supabase
      .from('project_assignments')
      .select('*')
      .in('status', ['active','paused'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada penugasan.</p></div>';
      return;
    }

    const isDeleter = ['superadmin','owner'].includes(state.user.role);

    // ── Fix: query attendance hari ini pakai range check_in WIB ──────────
    // Bug lama: .eq('created_at', todayStr) → tidak pernah match
    // Fix baru: filter check_in antara 00:00 dan 23:59 WIB hari ini
    const { dateStr: todayStr } = localNow();
    const { data: attData } = await supabase
      .from('attendance_logs')
      .select('employee_id, check_in, check_out, status')
      .gte('check_in', todayStr + ' 00:00:00+07:00')
      .lte('check_in', todayStr + ' 23:59:59+07:00');

    // Map: employee_id → { status, check_in, check_out }
    const todayAttendance = new Map();
    if (attData) {
      attData.forEach(att => {
        todayAttendance.set(att.employee_id, {
          status:    att.status,
          check_in:  att.check_in,
          check_out: att.check_out,
        });
      });
    }

    // ── Hitung ringkasan untuk banner ────────────────────────────────────
    const activeAssignments = data.filter(a => a.status === 'active');
    const sudahAbsen  = activeAssignments.filter(a => todayAttendance.has(a.employee_id)).length;
    const belumAbsen  = activeAssignments.length - sudahAbsen;

    el.innerHTML = `
      <!-- Ringkasan Status Absensi Hari Ini -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(16,185,129,0.1);border-radius:var(--radius);border:1px solid rgba(16,185,129,0.25);">
          <i class="fas fa-check-circle" style="color:var(--success);"></i>
          <div>
            <div class="text-xs text-secondary">Sudah Absen</div>
            <div class="fw-bold" style="font-size:1.2rem;color:var(--success);">${sudahAbsen}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(239,68,68,0.1);border-radius:var(--radius);border:1px solid rgba(239,68,68,0.25);">
          <i class="fas fa-clock" style="color:var(--danger);"></i>
          <div>
            <div class="text-xs text-secondary">Belum Absen</div>
            <div class="fw-bold" style="font-size:1.2rem;color:var(--danger);">${belumAbsen}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(25,210,193,0.08);border-radius:var(--radius);border:1px solid rgba(25,210,193,0.2);">
          <i class="fas fa-users" style="color:var(--primary);"></i>
          <div>
            <div class="text-xs text-secondary">Total Aktif</div>
            <div class="fw-bold" style="font-size:1.2rem;color:var(--primary);">${activeAssignments.length}</div>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;">
          <span class="text-xs text-secondary"><i class="fas fa-calendar-day"></i> ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</span>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table" id="assign-table">
          <thead>
            <tr>
              <th style="width:40px;">No.</th>
              <th style="width:30px;"></th>
              <th>Karyawan</th>
              <th>Proyek</th>
              <th>Gaji/Hari</th>
              <th>Mulai</th>
              <th>Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((a, idx) => {
              const emp = state.employees.find(e => e.id === a.employee_id);
              const prj = state.projects.find(p => p.id === a.project_id);
              const isActive = a.status === 'active';
              const attInfo = todayAttendance.get(a.employee_id);
              const hasCheckedIn = !!attInfo;
              const hasCheckedOut = !!attInfo?.check_out;

              // Badge absensi hari ini
              let absenBadge = '';
              if (!isActive) {
                absenBadge = '';
              } else if (!hasCheckedIn) {
                absenBadge = '<span class="badge badge-offline" style="font-size:0.65rem;">BELUM ABSEN</span>';
              } else if (hasCheckedIn && !hasCheckedOut) {
                absenBadge = '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);font-size:0.65rem;">SUDAH MASUK</span>';
              } else {
                absenBadge = '<span class="badge badge-online" style="font-size:0.65rem;">SUDAH PULANG</span>';
              }

              return `
              <tr class="assign-row" data-index="${idx}">
                <td class="text-xs text-secondary">${idx + 1}</td>
                <td style="width:30px;cursor:pointer;" onclick="window.__app.toggleAssignRow(${idx})">
                  <i class="fas fa-chevron-right text-secondary" id="assign-chevron-${idx}"></i>
                </td>
                <td>
                  <div class="fw-bold">${esc(emp?.full_name || '-')}</div>
                  <div class="mt-2">${absenBadge}</div>
                </td>
                <td class="text-xs">${esc(prj?.name || '-')}</td>
                <td class="text-xs">${fmtIdr(a.basic_salary)}</td>
                <td class="text-xs">${fmtDate(a.start_date)}</td>
                <td>
                  <span class="badge ${isActive ? 'badge-online' : 'badge-role'}">
                    ${isActive ? 'AKTIF' : 'PAUSE'}
                  </span>
                </td>
                <td style="padding:4px 8px;white-space:nowrap;">
                  <div style="display:flex;flex-direction:row;align-items:center;gap:4px;flex-wrap:nowrap;">
                    <button class="btn btn-ghost btn-sm" title="Edit Penugasan"
                      onclick="window.__app.openEditAssignment('${a.id}')">
                      <i class="fas fa-edit" style="font-size:0.75rem;"></i>
                    </button>
                    ${isActive && !hasCheckedIn ? `
                      <button class="btn btn-primary btn-sm" title="Check-In Karyawan"
                        onclick="window.__app.openAdminCheckIn('${a.id}')">
                        <i class="fas fa-sign-in-alt" style="font-size:0.75rem;"></i>
                      </button>` : ''}
                    ${isActive ? `
                      <button class="btn btn-danger btn-sm" title="Akhiri Penugasan"
                        onclick="window.__app.endAssignment('${a.id}')">
                        <i class="fas fa-stop" style="font-size:0.75rem;"></i>
                      </button>` : `
                      <button class="btn btn-success btn-sm" title="Aktifkan Kembali"
                        onclick="window.__app.resumeAssignment('${a.id}')">
                        <i class="fas fa-play" style="font-size:0.75rem;"></i>
                      </button>`}
                    ${isDeleter ? `
                      <button class="btn btn-ghost btn-sm" title="Hapus Penugasan"
                        onclick="window.__app.deleteAssignment('${a.id}')">
                        <i class="fas fa-trash" style="font-size:0.75rem;color:#ef4444;"></i>
                      </button>` : ''}
                  </div>
                </td>
              </tr>
              <tr id="assign-detail-${idx}" style="display:none;background:var(--bg-hover);">
                <td colspan="8" style="padding:12px 16px;">
                  <div class="text-xs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px 16px;">
                    <div><span class="text-secondary">Uang Makan:</span> ${fmtIdr(a.uang_makan||0)}</div>
                    <div><span class="text-secondary">Transport:</span> ${fmtIdr(a.transport||0)}</div>
                    <div><span class="text-secondary">Tunjangan:</span> ${fmtIdr(a.tunjangan_lain||0)}</div>
                    <div><span class="text-secondary">Selesai:</span> ${a.end_date ? fmtDate(a.end_date) : '<span class="text-secondary">s/d selesai</span>'}</div>
                    ${attInfo ? `<div><span class="text-secondary">Check-in:</span> ${fmtTime(attInfo.check_in)} | Check-out: ${fmtTime(attInfo.check_out)}</div>` : ''}
                    <div style="grid-column:1/-1;"><span class="text-secondary">Keterangan:</span> ${esc(a.notes || '-')}</div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    // Refresh daftar belum ditugaskan jika section sudah ada di DOM
    if (document.getElementById('unassigned-list')) {
      loadUnassignedEmployees(state);
    }
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

/** Load daftar karyawan yang belum ditugaskan ke proyek manapun */
export async function loadUnassignedEmployees(state) {
  const el = document.getElementById('unassigned-list');
  if (!el) return;

  try {
    // Ambil semua employee_id yang punya assignment active/paused
    const { data: activeAssignments, error } = await supabase
      .from('project_assignments')
      .select('employee_id')
      .in('status', ['active', 'paused']);

    if (error) throw error;

    const assignedIds = new Set((activeAssignments || []).map(a => a.employee_id));

    // Filter karyawan role 'karyawan' yang tidak ada di assignedIds
    const unassigned = state.employees.filter(e =>
      e.role === 'karyawan' && !assignedIds.has(e.id)
    );

    // Update badge count
    const badge = document.getElementById('unassigned-count-badge');
    if (badge) {
      badge.textContent = `${unassigned.length} orang`;
      badge.style.display = unassigned.length > 0 ? '' : 'none';
    }

    if (unassigned.length === 0) {
      el.innerHTML = `
        <div class="empty-state" style="padding:24px;">
          <i class="fas fa-check-circle" style="color:var(--success);font-size:2rem;"></i>
          <p style="color:var(--success);">Semua karyawan sudah ditugaskan 🎉</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;">No.</th>
              <th>Nama</th>
              <th>Jabatan</th>
              <th>WhatsApp</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${unassigned.map((emp, idx) => `
              <tr>
                <td class="text-xs text-secondary">${idx + 1}</td>
                <td class="fw-bold">${esc(emp.full_name)}</td>
                <td class="text-xs text-secondary">${esc(emp.jabatan || '-')}</td>
                <td class="text-xs">${esc(emp.whatsapp_number || '-')}</td>
                <td class="text-center">
                  <button class="btn btn-primary btn-sm" title="Tugaskan ke Proyek"
                    onclick="window.__app.prefillAssignEmployee('${emp.id}')">
                    <i class="fas fa-user-tag" style="font-size:0.75rem;"></i> Tugaskan
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

/** Toggle section karyawan belum ditugaskan */
if (typeof window !== 'undefined') {
  window.__toggleUnassignedList = function () {
    const el      = document.getElementById('unassigned-list');
    const chevron = document.getElementById('unassigned-chevron');
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  };
}

/** Toggle collapsible row */
export function toggleAssignRow(idx) {
  const detail = document.getElementById(`assign-detail-${idx}`);
  const chevron = document.getElementById(`assign-chevron-${idx}`);
  if (!detail) return;
  const isHidden = detail.style.display === 'none';
  detail.style.display = isHidden ? 'table-row' : 'none';
  if (chevron) {
    chevron.className = isHidden ? 'fas fa-chevron-down text-primary' : 'fas fa-chevron-right text-secondary';
  }
}

/** Buka modal edit penugasan — full form seperti input awal */
export async function openEditAssignment(id, state) {
  const { data: a, error } = await supabase
    .from('project_assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !a) { showToast('Gagal memuat data penugasan', 'error'); return; }

  const emp = state.employees.find(e => e.id === a.employee_id);
  const prj = state.projects.find(p => p.id === a.project_id);

  document.getElementById('assign-edit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'assign-edit-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px;">
      <div class="modal-title">
        <i class="fas fa-edit"></i> Edit Penugasan
        <button onclick="document.getElementById('assign-edit-modal').remove()"
          style="margin-left:auto;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:1.2rem;">✕</button>
      </div>

      <div class="mb-16" style="background:var(--bg-hover);border-radius:var(--radius);padding:10px 14px;">
        <div class="text-sm fw-bold">${esc(emp?.full_name||'-')}</div>
        <div class="text-xs text-secondary">${esc(prj?.name||'-')}</div>
      </div>

      <form id="assign-edit-form" onsubmit="window.__app.saveEditAssignment(event, '${id}')">
        <!-- Komponen Upah / Hari -->
        <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
          <i class="fas fa-coins"></i> Komponen Upah / Hari
        </div>
        <div class="form-row mb-8">
          <div class="form-group">
            <label class="form-label">Uang Makan (Rp)</label>
            <input type="number" class="form-input" id="edit-asgn-uang-makan"
              value="${a.uang_makan||0}" min="0"
              oninput="window.__asgn_editCalc()" />
          </div>
          <div class="form-group">
            <label class="form-label">Transport (Rp)</label>
            <input type="number" class="form-input" id="edit-asgn-transport"
              value="${a.transport||0}" min="0"
              oninput="window.__asgn_editCalc()" />
          </div>
        </div>
        <div class="form-row mb-8">
          <div class="form-group">
            <label class="form-label">Tunjangan Lain (Rp)</label>
            <input type="number" class="form-input" id="edit-asgn-tunjangan"
              value="${a.tunjangan_lain||0}" min="0"
              oninput="window.__asgn_editCalc()" />
          </div>
          <div class="form-group">
            <label class="form-label">Total / Hari (Rp)</label>
            <input type="number" class="form-input" id="edit-asgn-salary"
              value="${a.basic_salary||0}" min="0"
              style="font-weight:700;" />
          </div>
        </div>

        <div class="form-row mb-16">
          <div class="form-group">
            <label class="form-label">Tanggal Mulai</label>
            <input type="date" class="form-input" id="edit-asgn-start"
              value="${a.start_date || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Selesai <span class="text-muted">(kosongkan = terus berjalan)</span></label>
            <input type="date" class="form-input" id="edit-asgn-end"
              value="${a.end_date || ''}" />
          </div>
        </div>
        <div class="form-row mb-16">
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input type="text" class="form-input" id="edit-asgn-notes"
              value="${esc(a.notes || '')}" />
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('assign-edit-modal').remove()">
            Batal
          </button>
          <button type="submit" class="btn btn-primary" id="edit-asgn-submit-btn">
            <i class="fas fa-save"></i> Simpan Perubahan
          </button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
}

/** Simpan edit penugasan */
export async function saveEditAssignment(e, id, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('edit-asgn-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const uangMakan   = parseFloat(document.getElementById('edit-asgn-uang-makan').value) || 0;
    const transport   = parseFloat(document.getElementById('edit-asgn-transport').value) || 0;
    const tunjangan   = parseFloat(document.getElementById('edit-asgn-tunjangan').value) || 0;
    const manualSalary = parseFloat(document.getElementById('edit-asgn-salary').value) || 0;
    const totalSalary = manualSalary || (uangMakan + transport + tunjangan);

    const startVal = document.getElementById('edit-asgn-start').value || null;
    const endVal   = document.getElementById('edit-asgn-end').value || null;

    const { error } = await supabase.from('project_assignments').update({
      basic_salary:   totalSalary,
      uang_makan:     uangMakan,
      transport:      transport,
      tunjangan_lain: tunjangan,
      start_date:     startVal,
      end_date:       endVal,
      notes:          document.getElementById('edit-asgn-notes').value.trim() || null,
      updated_at:     new Date().toISOString(),
    }).eq('id', id);

    if (error) throw error;
    showToast('Penugasan berhasil diupdate!', 'success');
    document.getElementById('assign-edit-modal')?.remove();
    await loadAssignments(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Perubahan';
  }
}

/** Edit gaji penugasan (legacy — redirect ke modal full) */
export async function editAssignmentSalary(id, currentSalary, state, refreshFn) {
  window.__app.openEditAssignment(id);
}

/** Buka modal admin check-in dengan multi-item kegiatan */
export async function openAdminCheckIn(assignmentId, state) {
  const { data: a, error } = await supabase
    .from('project_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();
  if (error || !a) { showToast('Gagal memuat data penugasan', 'error'); return; }

  const emp = state.employees.find(e => e.id === a.employee_id);
  const prj = state.projects.find(p => p.id === a.project_id);

  document.getElementById('admin-checkin-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'admin-checkin-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:600px;">
      <div class="modal-title">
        <i class="fas fa-sign-in-alt"></i> Check-In Karyawan
        <button onclick="document.getElementById('admin-checkin-modal').remove()"
          style="margin-left:auto;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:1.2rem;">✕</button>
      </div>

      <div class="mb-16" style="background:var(--bg-hover);border-radius:var(--radius);padding:10px 14px;">
        <div class="text-sm fw-bold">${esc(emp?.full_name||'-')}</div>
        <div class="text-xs text-secondary">${esc(prj?.name||'-')}</div>
      </div>

      <form id="admin-checkin-form" onsubmit="window.__app.saveAdminCheckIn(event, '${assignmentId}')">
        <div class="form-row mb-16">
          <div class="form-group">
            <label class="form-label">Jam Check-In</label>
            <input type="time" class="form-input" id="admin-checkin-time" value="08:00" required />
          </div>
          <div class="form-group">
            <label class="form-label">Jam Check-Out (default 17:00)</label>
            <input type="time" class="form-input" id="admin-checkout-time" value="17:00" />
          </div>
        </div>

        <div class="form-section-label mb-8" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">
          <i class="fas fa-tasks"></i> Kegiatan Hari Ini
        </div>

        <div class="mb-16">
          <div class="form-group mb-8">
            <input type="text" class="form-input" id="admin-activity-input"
              placeholder="Tambah kegiatan..." />
          </div>
          <button type="button" class="btn btn-sm btn-ghost" onclick="window.__addAdminActivity()">
            <i class="fas fa-plus"></i> Tambah Kegiatan
          </button>
          <div id="admin-activities-list" class="mt-8"></div>
        </div>

        <div class="form-group mb-16">
          <label class="form-label">Catatan Tambahan</label>
          <input type="text" class="form-input" id="admin-checkin-notes" placeholder="Contoh: HP rusak, admin check-in" />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('admin-checkin-modal').remove()">
            Batal
          </button>
          <button type="submit" class="btn btn-primary" id="admin-checkin-submit-btn">
            <i class="fas fa-check"></i> Check-In & Verifikasi
          </button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  // Initialize activities array
  window.__adminActivities = [];
}

/** Tambah kegiatan ke list (admin check-in) */
if (typeof window !== 'undefined') {
  window.__addAdminActivity = function () {
    const input = document.getElementById('admin-activity-input');
    const desc = input?.value.trim();
    if (!desc) return;
    window.__adminActivities.push(desc);
    input.value = '';
    renderAdminActivities();
  };

  function renderAdminActivities() {
    const list = document.getElementById('admin-activities-list');
    if (!list) return;
    list.innerHTML = window.__adminActivities.map((desc, idx) => `
      <div class="flex align-center gap-8 mb-4" style="padding:6px 10px;background:var(--bg-input);border-radius:var(--radius);">
        <span class="text-sm">${esc(desc)}</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="window.__removeAdminActivity(${idx})" style="margin-left:auto;">
          <i class="fas fa-times" style="color:var(--danger)"></i>
        </button>
      </div>
    `).join('');
  }

  window.__removeAdminActivity = function (idx) {
    window.__adminActivities.splice(idx, 1);
    renderAdminActivities();
  };
}

/** Simpan admin check-in karyawan */
export async function saveAdminCheckIn(e, assignmentId, state) {
  e.preventDefault();
  const btn = document.getElementById('admin-checkin-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const { data: a, error: assignError } = await supabase
      .from('project_assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();
    if (assignError || !a) throw assignError || new Error('Penugasan tidak ditemukan');

    // Gunakan waktu lokal WIB agar tidak ada selisih +7 jam
    const { dateStr: todayStr } = localNow();
    const checkInTime  = document.getElementById('admin-checkin-time').value;
    const checkOutTime = document.getElementById('admin-checkout-time').value;
    const notes = document.getElementById('admin-checkin-notes').value.trim() || 'Check-in oleh admin';

    // Format dengan offset +07:00 agar Supabase simpan waktu WIB
    const checkInTs  = `${todayStr} ${checkInTime}:00+07:00`;
    const checkOutTs = checkOutTime ? `${todayStr} ${checkOutTime}:00+07:00` : null;

    const hourlyRate = Math.round(a.basic_salary / 8);

    // Create attendance_logs
    const { data: attData, error: attError } = await supabase.from('attendance_logs').insert({
      employee_id: a.employee_id,
      project_id: a.project_id,
      check_in: checkInTs,
      check_out: checkOutTs,
      status: 'hadir', // Admin check-in = auto verified
      hourly_rate: hourlyRate,
      basic_salary: a.basic_salary,
      uang_makan: a.uang_makan,
      transport: a.transport,
      tunjangan_lain: a.tunjangan_lain,
      notes: notes,
      jabatan_snapshot: state.employees.find(e => e.id === a.employee_id)?.jabatan || 'Karyawan',
    }).select().single();

    if (attError) throw attError;

    // Create daily_activities for each activity
    if (window.__adminActivities.length > 0) {
      const activityInserts = window.__adminActivities.map(desc => ({
        attendance_id: attData.id,
        description: desc,
        status: 'done',
        created_by: state.user.id,
      }));
      const { error: actError } = await supabase.from('daily_activities').insert(activityInserts);
      if (actError) throw actError;
    }

    showToast('Check-in berhasil disimpan!', 'success');
    document.getElementById('admin-checkin-modal')?.remove();
    window.__adminActivities = [];
    await loadAssignments(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Check-In & Verifikasi';
  }
}

/** Submit penugasan baru */
export async function handleAssignSubmit(e, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('asgn-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const endVal = document.getElementById('asgn-end').value;
    const uangMakan   = parseFloat(document.getElementById('asgn-uang-makan').value) || 0;
    const transport   = parseFloat(document.getElementById('asgn-transport').value) || 0;
    const tunjangan   = parseFloat(document.getElementById('asgn-tunjangan').value) || 0;
    const { error } = await supabase.from('project_assignments').insert({
      employee_id:     document.getElementById('asgn-employee').value,
      project_id:      document.getElementById('asgn-project').value,
      uang_makan:      uangMakan,
      transport:       transport,
      tunjangan_lain:  tunjangan,
      basic_salary:    uangMakan + transport + tunjangan,
      start_date:      document.getElementById('asgn-start').value,
      end_date:        endVal || null,
      notes:           document.getElementById('asgn-notes').value.trim() || null,
      created_by:      state.user.id,
    });
    if (error) throw error;

    showToast('Penugasan berhasil disimpan!', 'success');

    // Reset form ke nilai default (tanpa full page re-render)
    document.getElementById('assign-form')?.reset();
    const startEl = document.getElementById('asgn-start');
    if (startEl) startEl.value = new Date().toISOString().slice(0,10);
    const umEl = document.getElementById('asgn-uang-makan');
    const trEl = document.getElementById('asgn-transport');
    const tjEl = document.getElementById('asgn-tunjangan');
    const slEl = document.getElementById('asgn-salary');
    if (umEl) umEl.value = '50000';
    if (trEl) trEl.value = '50000';
    if (tjEl) tjEl.value = '50000';
    if (slEl) slEl.value = '150000';
    const infoEl = document.getElementById('asgn-current-info');
    if (infoEl) infoEl.style.display = 'none';
    const empInfoEl = document.getElementById('asgn-emp-info');
    if (empInfoEl) empInfoEl.style.display = 'none';

    // Collapse form kembali setelah simpan
    const container = document.getElementById('assign-form-container');
    const chevron   = document.getElementById('assign-form-chevron');
    if (container) container.style.display = 'none';
    if (chevron)   chevron.style.transform = 'rotate(0deg)';

    // Refresh hanya daftar penugasan — tidak perlu full page re-render
    await loadAssignments(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Penugasan';
  }
}

/** Akhiri penugasan */
export async function endAssignment(id, state, refreshFn) {
  if (!confirm('Akhiri penugasan ini? Karyawan tidak akan muncul di absensi proyek ini lagi.')) return;
  const { error } = await supabase.from('project_assignments')
    .update({ status: 'ended', end_date: new Date().toISOString().slice(0,10), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) showToast(error.message, 'error');
  else { showToast('Penugasan diakhiri', 'success'); await loadAssignments(state); }
}

/** Aktifkan kembali penugasan yang di-pause */
export async function resumeAssignment(id, state, refreshFn) {
  // Ambil data assignment yang akan di-resume
  const { data: asgn, error: fetchErr } = await supabase
    .from('project_assignments')
    .select('*, projects(name)')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !asgn) { showToast('Gagal memuat data penugasan', 'error'); return; }

  // Cek apakah karyawan sudah punya assignment active lain
  const { data: activeOther } = await supabase
    .from('project_assignments')
    .select('id, projects(name)')
    .eq('employee_id', asgn.employee_id)
    .eq('status', 'active')
    .neq('id', id)
    .maybeSingle();

  const emp = state.employees.find(e => e.id === asgn.employee_id);
  const empName = emp?.full_name || 'Karyawan ini';

  if (activeOther) {
    // Ada assignment active lain — konfirmasi dengan info lengkap
    const activeProjectName = activeOther.projects?.name || 'proyek lain';
    const resumeProjectName = asgn.projects?.name || 'proyek ini';
    const ok = confirm(
      `⚠️ ${empName} saat ini masih aktif di proyek "${activeProjectName}".\n\n` +
      `Mengaktifkan kembali penugasan di "${resumeProjectName}" akan mem-pause penugasan di "${activeProjectName}" secara otomatis.\n\n` +
      `Lanjutkan?`
    );
    if (!ok) return;
  } else {
    if (!confirm(`Aktifkan kembali penugasan ${empName} di proyek ${asgn.projects?.name || ''}?`)) return;
  }

  // Resume: set active + hapus end_date
  // PENTING: paused_by_id TIDAK dihapus agar relasi auto-resume tetap terjaga
  // jika assignment sementara (yang mem-pause ini) nanti diakhiri
  const { error } = await supabase.from('project_assignments')
    .update({ status: 'active', end_date: null, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) showToast(error.message, 'error');
  else { showToast('Penugasan diaktifkan kembali', 'success'); await loadAssignments(state); }
}

/** Hapus penugasan — superadmin & owner */
export async function deleteAssignment(id, state, refreshFn) {
  if (!confirm('Hapus penugasan ini permanen?')) return;
  const { error } = await supabase.from('project_assignments').delete().eq('id', id);
  if (error) showToast(error.message, 'error');
  else { showToast('Penugasan dihapus', 'success'); await loadAssignments(state); }
}

/** Cek penugasan aktif karyawan saat pilih di form */
if (typeof window !== 'undefined') {
  window.__asgn_calcTotal = function () {
    const um  = parseFloat(document.getElementById('asgn-uang-makan')?.value) || 0;
    const tr  = parseFloat(document.getElementById('asgn-transport')?.value) || 0;
    const tj  = parseFloat(document.getElementById('asgn-tunjangan')?.value) || 0;
    const el  = document.getElementById('asgn-salary');
    if (el) el.value = um + tr + tj;
  };

  window.__toggleAssignForm = function () {
    const container = document.getElementById('assign-form-container');
    const chevron   = document.getElementById('assign-form-chevron');
    if (!container) return;
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  };

  window.__asgn_editCalc = function () {
    const um  = parseFloat(document.getElementById('edit-asgn-uang-makan')?.value) || 0;
    const tr  = parseFloat(document.getElementById('edit-asgn-transport')?.value) || 0;
    const tj  = parseFloat(document.getElementById('edit-asgn-tunjangan')?.value) || 0;
    const el  = document.getElementById('edit-asgn-salary');
    if (el) el.value = um + tr + tj;
  };

  window.__asgn_onEmployeeChange = async function (empId) {
    const infoEl   = document.getElementById('asgn-current-info');
    const detailEl = document.getElementById('asgn-current-detail');
    const empInfoEl  = document.getElementById('asgn-emp-info');
    const empDetailEl = document.getElementById('asgn-emp-detail');

    if (!empId) {
      if (infoEl) infoEl.style.display = 'none';
      if (empInfoEl) empInfoEl.style.display = 'none';
      return;
    }

    // Fetch profile data (basic_salary & overtime_rate)
    const { data: emp } = await supabase
      .from('profiles')
      .select('full_name, basic_salary, overtime_rate, jabatan')
      .eq('id', empId)
      .maybeSingle();

    if (empInfoEl && empDetailEl && emp) {
      empDetailEl.innerHTML = `
        <span class="text-secondary">${esc(emp.jabatan || 'Karyawan')}</span> |
        Gaji Pokok: <strong>${fmtIdr(emp.basic_salary || 0)}</strong> |
        Ongkos Lembur/jam: <strong>${fmtIdr(emp.overtime_rate || 0)}</strong>
      `;
      empInfoEl.style.display = 'block';
    } else if (empInfoEl) {
      empInfoEl.style.display = 'none';
    }

    if (!infoEl) return;
    const { data } = await supabase
      .from('project_assignments')
      .select('*, projects(name)')
      .eq('employee_id', empId)
      .eq('status', 'active')
      .maybeSingle();

    if (data) {
      detailEl.innerHTML = `Proyek: ${data.projects?.name || '-'} | Mulai: ${fmtDate(data.start_date)} | Gaji: ${fmtIdr(data.basic_salary)}`;
      infoEl.style.display = 'block';
      // Auto-fill breakdown dari assignment aktif
      const umEl = document.getElementById('asgn-uang-makan');
      const trEl = document.getElementById('asgn-transport');
      const tjEl = document.getElementById('asgn-tunjangan');
      if (umEl) umEl.value = data.uang_makan || 0;
      if (trEl) trEl.value = data.transport || 0;
      if (tjEl) tjEl.value = data.tunjangan_lain || 0;
      window.__asgn_calcTotal();
    } else {
      infoEl.style.display = 'none';
    }
  };
}
