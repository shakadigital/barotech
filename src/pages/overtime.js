import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, showToast, esc, getGeoLocation, fmtGeoNote, compressImage } from '../lib/helpers.js';

/**
 * Halaman Lembur
 * Admin/Owner/Superadmin : input lembur + approve/reject permintaan
 * Karyawan               : ajukan lembur (pending) + lihat riwayat sendiri
 * Kepala Proyek/Lapangan : lihat lembur (read-only keuangan)
 */
export function OvertimePage(state) {
  const { projects, employees, user } = state;
  const isAdmin = ['superadmin','owner','admin'].includes(user.role);
  const isKaryawan = user.role === 'karyawan';

  const activeProjects = projects.filter(p => p.status !== 'selesai');
  const karyawanList   = employees.filter(e => e.role === 'karyawan');

  // Karyawan: form ajukan lembur (sederhana)
  function karyawanRequestForm() {
    if (!isKaryawan) return '';
    return `
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('ot-req-form-body'),i=document.getElementById('ot-req-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-clock"></i> Ajukan Lembur</div>
          <i id="ot-req-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="ot-req-form-body" style="display:none;">
        <form id="ot-request-form" onsubmit="window.__app.handleOvertimeRequest(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Proyek</label>
              <select class="form-select" id="ot-req-project" required>
                <option value="">Pilih Proyek</option>
                ${activeProjects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal Lembur</label>
              <input type="date" class="form-input" id="ot-req-date"
                value="${new Date().toISOString().slice(0,10)}" required />
            </div>
          </div>

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Jam Mulai</label>
              <input type="time" class="form-input" id="ot-req-start" value="17:00"
                oninput="window.__ot_reqCalcDuration()" />
            </div>
            <div class="form-group">
              <label class="form-label">Jam Selesai</label>
              <input type="time" class="form-input" id="ot-req-end" value="20:00"
                oninput="window.__ot_reqCalcDuration()" />
            </div>
            <div class="form-group">
              <label class="form-label">Durasi</label>
              <input type="text" class="form-input" id="ot-req-duration-display" value="3 jam" readonly
                style="background:var(--surface-2,#f3f4f6);cursor:default;" />
              <input type="hidden" id="ot-req-duration" value="3" />
            </div>
          </div>

          <div class="form-group mb-16">
            <label class="form-label">Deskripsi Pekerjaan</label>
            <textarea class="form-textarea" id="ot-req-desc" rows="2"
              placeholder="Pekerjaan yang dilakukan saat lembur..."></textarea>
          </div>

          <div class="form-group mb-24">
            <label class="form-label">Foto Bukti Lembur</label>
            <div class="file-upload" onclick="document.getElementById('ot-req-photo').click()">
              <i class="fas fa-camera"></i>
              <p>Klik untuk upload foto bukti</p>
              <input type="file" id="ot-req-photo" accept="image/*" capture="environment"
                onchange="window.__ot_previewReqPhoto(this)" />
            </div>
            <img id="ot-req-photo-preview" class="preview-img hidden" alt="Preview" />
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="ot-req-submit-btn">
            <i class="fas fa-paper-plane"></i> Ajukan Lembur
          </button>
          <div class="text-xs text-secondary mt-8" style="text-align:center;">
            Permintaan akan diverifikasi oleh Admin
          </div>
        </form>
        </div>
      </div>`;
  }

  // Admin: form input lembur (existing)
  function adminInputForm() {
    if (!isAdmin) return '';
    return `
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('overtime-form-body'),i=document.getElementById('overtime-form-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-clock"></i> Input Lembur</div>
          <i id="overtime-form-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="overtime-form-body" style="display:none;">
        <form id="overtime-form" onsubmit="window.__app.handleOvertimeSubmit(event)">

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Proyek</label>
              <select class="form-select" id="ot-project" required>
                <option value="">Pilih Proyek</option>
                ${activeProjects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Karyawan</label>
              <select class="form-select" id="ot-employee" required>
                <option value="">Pilih Karyawan</option>
                ${karyawanList.map(e => `<option value="${e.id}">${esc(e.full_name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Tanggal Lembur</label>
              <input type="date" class="form-input" id="ot-date"
                value="${new Date().toISOString().slice(0,10)}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Lokasi</label>
              <input type="text" class="form-input" id="ot-location" placeholder="Lokasi lembur" />
            </div>
          </div>

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Jam Mulai</label>
              <input type="time" class="form-input" id="ot-start" value="17:00"
                oninput="window.__ot_calcDuration()" />
            </div>
            <div class="form-group">
              <label class="form-label">Jam Selesai</label>
              <input type="time" class="form-input" id="ot-end" value="20:00"
                oninput="window.__ot_calcDuration()" />
            </div>
            <div class="form-group">
              <label class="form-label">Durasi</label>
              <input type="text" class="form-input" id="ot-duration-display" value="3 jam" readonly
                style="background:var(--surface-2,#f3f4f6);cursor:default;" />
              <input type="hidden" id="ot-duration" value="3" />
            </div>
          </div>

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Upah Lembur / Jam (Rp)</label>
              <input type="number" class="form-input" id="ot-rate" value="0" min="0"
                oninput="window.__ot_calcPay()" />
            </div>
            <div class="form-group">
              <label class="form-label">Total Upah Lembur</label>
              <input type="text" class="form-input" id="ot-pay-display" value="Rp 0" readonly
                style="background:var(--surface-2,#f3f4f6);cursor:default;" />
              <input type="hidden" id="ot-pay" value="0" />
            </div>
          </div>

          <div class="form-group mb-16">
            <label class="form-label">Deskripsi Pekerjaan</label>
            <textarea class="form-textarea" id="ot-desc" rows="2"
              placeholder="Pekerjaan yang dilakukan saat lembur..."></textarea>
          </div>

          <div class="form-group mb-24">
            <label class="form-label">Foto Bukti Lembur</label>
            <div class="file-upload" onclick="document.getElementById('ot-photo').click()">
              <i class="fas fa-camera"></i>
              <p>Klik untuk upload foto bukti</p>
              <input type="file" id="ot-photo" accept="image/*" capture="environment"
                onchange="window.__ot_previewPhoto(this)" />
            </div>
            <img id="ot-photo-preview" class="preview-img hidden" alt="Preview" />
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="ot-submit-btn">
            <i class="fas fa-save"></i> Simpan Data Lembur
          </button>
        </form>
        </div>
      </div>`;
  }

  // Non-admin, non-karyawan: info banner
  function infoBanner() {
    if (isAdmin || isKaryawan) return '';
    return `
      <div class="card mb-16" style="background:var(--surface-2,#f8f9fa);border-left:4px solid var(--primary,#19D2C1);padding:12px 16px;">
        <div class="flex gap-8 align-center">
          <i class="fas fa-info-circle text-primary"></i>
          <span class="text-sm">Data lembur diinput oleh Admin. Anda dapat melihat riwayat lembur di bawah.</span>
        </div>
      </div>`;
  }

  return `
    <div class="fade-in">
      ${karyawanRequestForm()}
      ${adminInputForm()}
      ${infoBanner()}

      <!-- Riwayat Lembur -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-history"></i> Riwayat Lembur</div>
        </div>
        <div id="overtime-list-content">
          <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Memuat data...</p>
          </div>
        </div>
      </div>
    </div>`;
}

/** Load dan render daftar lembur */
export async function loadOvertimeList(state) {
  const content = document.getElementById('overtime-list-content');
  if (!content) return;

  try {
    let query = supabase
      .from('overtime_logs')
      .select('*')
      .order('overtime_date', { ascending: false })
      .limit(50);

    // karyawan hanya lihat milik sendiri
    if (state.user.role === 'karyawan') {
      query = query.eq('employee_id', state.user.id);
    }
    // kepala_lapangan hanya lihat proyeknya
    if (state.user.role === 'kepala_lapangan') {
      const myIds = state.projects
        .filter(p => p.lead_id === state.user.id)
        .map(p => p.id);
      if (myIds.length > 0) query = query.in('project_id', myIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>Belum ada data lembur.</p></div>';
      return;
    }

    const isFinance = ['superadmin','owner','admin'].includes(state.user.role);

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Karyawan</th>
              <th>Proyek</th>
              <th>Durasi</th>
              ${isFinance ? '<th class="text-right">Upah</th>' : ''}
              <th>Status</th>
              <th>Keterangan</th>
              <th class="text-center">Foto</th>
              ${isFinance ? '<th class="text-center">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.map(ot => {
              const emp = state.employees.find(e => e.id === ot.employee_id);
              const prj = state.projects.find(p => p.id === ot.project_id);
              const otStatus = ot.status || 'approved';
              // Status badge
              let statusBadge = '';
              if (otStatus === 'pending') {
                statusBadge = '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">PENDING</span>';
              } else if (otStatus === 'approved') {
                statusBadge = '<span class="badge badge-online">APPROVED</span>';
              } else {
                statusBadge = '<span class="badge badge-offline">DITOLAK</span>';
              }
              // Admin actions: approve/reject for pending, delete for all
              let adminActions = '';
              if (isFinance) {
                if (otStatus === 'pending') {
                  adminActions = `
                    <div class="flex gap-4 justify-center">
                      <button class="btn btn-success btn-sm" onclick="window.__app.approveOvertime('${ot.id}')" title="Approve">
                        <i class="fas fa-check"></i>
                      </button>
                      <button class="btn btn-danger btn-sm" onclick="window.__app.rejectOvertime('${ot.id}')" title="Tolak">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>`;
                } else if (['superadmin','owner'].includes(state.user.role)) {
                  adminActions = `
                    <button class="btn btn-danger btn-sm" onclick="window.__app.deleteOvertime('${ot.id}')">
                      <i class="fas fa-trash"></i>
                    </button>`;
                }
              }
              return `<tr>
                <td class="text-xs">${fmtDate(ot.overtime_date)}</td>
                <td class="fw-bold">${esc(emp?.full_name || '-')}</td>
                <td class="text-xs text-secondary">${esc(prj?.name || '-')}</td>
                <td class="text-xs">
                  <div>${ot.start_time?.slice(0,5)||'-'} – ${ot.end_time?.slice(0,5)||'-'}</div>
                  <div class="text-secondary">${ot.duration_hours} jam</div>
                </td>
                ${isFinance ? `<td class="text-right text-xs fw-bold text-success">${fmtIdr(ot.overtime_pay)}</td>` : ''}
                <td>${statusBadge}</td>
                <td class="text-xs text-secondary">${esc(ot.work_description || '-')}</td>
                <td class="text-center">
                  ${ot.photo_url
                    ? `<a href="${ot.photo_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-image"></i></a>`
                    : '<span class="text-muted text-xs">—</span>'}
                </td>
                ${isFinance ? `<td class="text-center">${adminActions}</td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat: ${esc(err.message)}</p></div>`;
  }
}

/** Submit lembur oleh karyawan (status: pending) */
export async function handleOvertimeRequest(e, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('ot-req-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Mengajukan...';

  try {
    const startTime = document.getElementById('ot-req-start').value;
    const endTime   = document.getElementById('ot-req-end').value;
    const duration  = parseFloat(document.getElementById('ot-req-duration').value) || 0;

    // Upload foto jika ada
    let photoUrl = null;
    const photoInput = document.getElementById('ot-req-photo');
    if (photoInput.files?.[0]) {
      const file     = photoInput.files[0];
      const compressedFile = await compressImage(file, 1024, 0.7);
      const fileName = `overtime/${Date.now()}_${compressedFile.name}`;
      const { error: ue } = await supabase.storage.from('project-photos').upload(fileName, compressedFile);
      if (ue) throw ue;
      const { data: ud } = supabase.storage.from('project-photos').getPublicUrl(fileName);
      photoUrl = ud.publicUrl;
    }

    // Ambil lokasi otomatis
    const geo = await getGeoLocation();
    const descInput = document.getElementById('ot-req-desc').value.trim();

    const { error } = await supabase.from('overtime_logs').insert({
      project_id:       document.getElementById('ot-req-project').value,
      employee_id:      state.user.id,
      overtime_date:    document.getElementById('ot-req-date').value,
      start_time:       startTime + ':00',
      end_time:         endTime + ':00',
      duration_hours:   duration,
      overtime_rate:    0,       // akan diisi admin saat approve
      overtime_pay:     0,
      location_name:    geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : null,
      work_description: descInput + fmtGeoNote(geo, descInput ? ' \n' : ''),
      photo_url:        photoUrl,
      created_by:       state.user.id,
      status:           'pending',
    });
    if (error) throw error;

    showToast('Permintaan lembur berhasil diajukan!', 'success');
    document.getElementById('ot-request-form').reset();
    document.getElementById('ot-req-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('ot-req-start').value = '17:00';
    document.getElementById('ot-req-end').value = '20:00';
    document.getElementById('ot-req-duration-display').value = '3 jam';
    document.getElementById('ot-req-duration').value = '3';
    document.getElementById('ot-req-photo-preview')?.classList.add('hidden');
    await refreshFn();
    await loadOvertimeList(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Ajukan Lembur';
  }
}

/** Approve lembur — admin set status + overtime_rate */
export async function approveOvertime(id, state, refreshFn) {
  // Get the overtime record + employee overtime_rate
  const { data: ot, error: fetchErr } = await supabase
    .from('overtime_logs')
    .select('*, employee_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr || !ot) { showToast('Data tidak ditemukan', 'error'); return; }

  // Get employee's overtime_rate from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('overtime_rate')
    .eq('id', ot.employee_id)
    .maybeSingle();

  const rate = profile?.overtime_rate || 0;
  const pay  = Math.round(ot.duration_hours * rate);

  const { error } = await supabase
    .from('overtime_logs')
    .update({
      status: 'approved',
      overtime_rate: rate,
      overtime_pay: pay,
      verified_by: state.user.id,
    })
    .eq('id', id);

  if (error) { showToast('Gagal approve: ' + error.message, 'error'); return; }
  showToast(`Lembur approved — ${ot.duration_hours} jam × ${fmtIdr(rate)} = ${fmtIdr(pay)}`, 'success');
  await loadOvertimeList(state);
}

/** Reject lembur — admin */
export async function rejectOvertime(id, state, refreshFn) {
  if (!confirm('Tolak permintaan lembur ini?')) return;
  const { error } = await supabase
    .from('overtime_logs')
    .update({
      status: 'rejected',
      verified_by: state.user.id,
    })
    .eq('id', id);
  if (error) { showToast('Gagal: ' + error.message, 'error'); return; }
  showToast('Permintaan lembur ditolak', 'info');
  await loadOvertimeList(state);
}

/** Submit lembur oleh admin */
export async function handleOvertimeSubmit(e, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('ot-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const startTime = document.getElementById('ot-start').value;
    const endTime   = document.getElementById('ot-end').value;
    const duration  = parseFloat(document.getElementById('ot-duration').value) || 0;
    const rate      = parseFloat(document.getElementById('ot-rate').value) || 0;

    // Upload foto jika ada dengan kompresi
    let photoUrl = null;
    const photoInput = document.getElementById('ot-photo');
    if (photoInput.files?.[0]) {
      const file     = photoInput.files[0];
      const compressedFile = await compressImage(file, 1024, 0.7);
      const fileName = `overtime/${Date.now()}_${compressedFile.name}`;
      const { error: ue } = await supabase.storage.from('project-photos').upload(fileName, compressedFile);
      if (ue) throw ue;
      const { data: ud } = supabase.storage.from('project-photos').getPublicUrl(fileName);
      photoUrl = ud.publicUrl;
    }

    // Ambil lokasi otomatis
    const geo = await getGeoLocation();
    const locInput = document.getElementById('ot-location').value.trim();
    const descInput = document.getElementById('ot-desc').value.trim();

    const { error } = await supabase.from('overtime_logs').insert({
      project_id:       document.getElementById('ot-project').value,
      employee_id:      document.getElementById('ot-employee').value,
      overtime_date:    document.getElementById('ot-date').value,
      start_time:       startTime + ':00',
      end_time:         endTime + ':00',
      duration_hours:   duration,
      overtime_rate:    rate,
      overtime_pay:     duration * rate,
      location_name:    locInput || (geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : null),
      work_description: descInput + fmtGeoNote(geo, descInput ? ' \n' : ''),
      photo_url:        photoUrl,
      created_by:       state.user.id,
    });
    if (error) throw error;

    showToast('Data lembur berhasil disimpan!', 'success');
    document.getElementById('overtime-form').reset();
    document.getElementById('ot-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('ot-start').value = '17:00';
    document.getElementById('ot-end').value = '20:00';
    document.getElementById('ot-duration-display').value = '3 jam';
    document.getElementById('ot-duration').value = '3';
    document.getElementById('ot-pay-display').value = 'Rp 0';
    document.getElementById('ot-pay').value = '0';
    document.getElementById('ot-photo-preview').classList.add('hidden');
    await refreshFn();
    await loadOvertimeList(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Data Lembur';
  }
}

/** Hapus lembur — superadmin & owner */
export async function deleteOvertime(id, state, refreshFn) {
  if (!confirm('Hapus data lembur ini?')) return;
  const { error } = await supabase.from('overtime_logs').delete().eq('id', id);
  if (error) showToast(error.message, 'error');
  else { showToast('Data lembur dihapus', 'success'); await loadOvertimeList(state); }
}

/** Kalkulasi durasi & upah otomatis */
if (typeof window !== 'undefined') {
  // Karyawan request form helpers
  window.__ot_reqCalcDuration = function () {
    const start = document.getElementById('ot-req-start')?.value;
    const end   = document.getElementById('ot-req-end')?.value;
    if (!start || !end) return;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    const hours = Math.round(diff / 60 * 10) / 10;
    const display = document.getElementById('ot-req-duration-display');
    const hidden  = document.getElementById('ot-req-duration');
    if (display) display.value = hours + ' jam';
    if (hidden)  hidden.value  = hours;
  };

  window.__ot_previewReqPhoto = function (input) {
    const preview = document.getElementById('ot-req-photo-preview');
    if (input.files?.[0] && preview) {
      const r = new FileReader();
      r.onload = (e) => { preview.src = e.target.result; preview.classList.remove('hidden'); };
      r.readAsDataURL(input.files[0]);
    }
  };

  // Admin form helpers
  window.__ot_calcDuration = function () {
    const start = document.getElementById('ot-start')?.value;
    const end   = document.getElementById('ot-end')?.value;
    if (!start || !end) return;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60; // lewat tengah malam
    const hours = Math.round(diff / 60 * 10) / 10;
    const display = document.getElementById('ot-duration-display');
    const hidden  = document.getElementById('ot-duration');
    if (display) display.value = hours + ' jam';
    if (hidden)  hidden.value  = hours;
    window.__ot_calcPay();
  };

  window.__ot_calcPay = function () {
    const hours = parseFloat(document.getElementById('ot-duration')?.value) || 0;
    const rate  = parseFloat(document.getElementById('ot-rate')?.value) || 0;
    const total = hours * rate;
    const display = document.getElementById('ot-pay-display');
    const hidden  = document.getElementById('ot-pay');
    if (display) display.value = 'Rp ' + total.toLocaleString('id-ID');
    if (hidden)  hidden.value  = total;
  };

  window.__ot_previewPhoto = function (input) {
    const preview = document.getElementById('ot-photo-preview');
    if (input.files?.[0] && preview) {
      const r = new FileReader();
      r.onload = (e) => { preview.src = e.target.result; preview.classList.remove('hidden'); };
      r.readAsDataURL(input.files[0]);
    }
  };
}
