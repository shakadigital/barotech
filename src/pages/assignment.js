import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, showToast, esc } from '../lib/helpers.js';

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

      <!-- Form Penugasan Baru -->
      <div class="card mb-24">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-user-tag"></i> Tugaskan Karyawan ke Proyek</div>
        </div>
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

      <!-- Daftar Penugasan Aktif -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-list-check"></i> Penugasan Aktif</div>
        </div>
        <div id="penugasan-list">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>
    </div>`;
}

/** Load daftar penugasan */
export async function loadAssignments(state) {
  const el = document.getElementById('penugasan-list');
  if (!el) return;

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

    el.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Proyek</th>
              <th>Gaji/Hari</th>
              <th>Mulai</th>
              <th>Selesai</th>
              <th>Status</th>
              <th>Keterangan</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(a => {
              const emp = state.employees.find(e => e.id === a.employee_id);
              const prj = state.projects.find(p => p.id === a.project_id);
              const isActive = a.status === 'active';
              return `<tr>
                <td class="fw-bold">${esc(emp?.full_name || '-')}</td>
                <td class="text-xs">${esc(prj?.name || '-')}</td>
                <td class="text-xs">${fmtIdr(a.basic_salary)}</td>
                <td class="text-xs">${fmtDate(a.start_date)}</td>
                <td class="text-xs">${a.end_date ? fmtDate(a.end_date) : '<span class="text-secondary">s/d selesai</span>'}</td>
                <td>
                  <span class="badge ${isActive ? 'badge-online' : 'badge-role'}">
                    ${isActive ? 'AKTIF' : 'PAUSE'}
                  </span>
                </td>
                <td class="text-xs text-secondary">${esc(a.notes || '-')}</td>
                <td class="text-center">
                  <div class="flex gap-6 justify-center">
                    <button class="btn btn-ghost btn-sm" title="Edit Gaji"
                      onclick="window.__app.editAssignmentSalary('${a.id}', ${a.basic_salary})">
                      <i class="fas fa-edit"></i>
                    </button>
                    ${isActive ? `
                    <button class="btn btn-danger btn-sm" title="Akhiri Assignment"
                      onclick="window.__app.endAssignment('${a.id}')">
                      <i class="fas fa-stop"></i>
                    </button>` : `
                    <button class="btn btn-success btn-sm" title="Aktifkan Kembali"
                      onclick="window.__app.resumeAssignment('${a.id}')">
                      <i class="fas fa-play"></i>
                    </button>`}
                    ${isDeleter ? `
                    <button class="btn btn-danger btn-sm" title="Hapus"
                      onclick="window.__app.deleteAssignment('${a.id}')">
                      <i class="fas fa-trash" style="color:#ef4444"></i>
                    </button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
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
    document.getElementById('assign-form').reset();
    document.getElementById('asgn-start').value = new Date().toISOString().slice(0,10);
    document.getElementById('asgn-uang-makan').value = '50000';
    document.getElementById('asgn-transport').value = '50000';
    document.getElementById('asgn-tunjangan').value = '50000';
    document.getElementById('asgn-salary').value = '150000';
    document.getElementById('asgn-current-info').style.display = 'none';
    await refreshFn();
    await loadAssignments(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Penugasan';
  }
}

/** Edit gaji penugasan */
export async function editAssignmentSalary(id, currentSalary, state, refreshFn) {
  const newSalary = prompt(`Gaji baru (Rp):\nSaat ini: ${Number(currentSalary).toLocaleString('id-ID')}`, currentSalary);
  if (newSalary === null) return;
  const val = parseFloat(newSalary);
  if (isNaN(val) || val < 0) { showToast('Nilai tidak valid', 'error'); return; }

  const { error } = await supabase.from('project_assignments')
    .update({ basic_salary: val, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) showToast(error.message, 'error');
  else { showToast('Gaji berhasil diupdate', 'success'); await loadAssignments(state); }
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
  if (!confirm('Aktifkan kembali penugasan ini?')) return;
  const { error } = await supabase.from('project_assignments')
    .update({ status: 'active', end_date: null, paused_by_id: null, updated_at: new Date().toISOString() })
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
