import { supabase } from '../lib/supabase.js';
import { fmtDate, showToast, esc, getGeoLocation, fmtGeoNote, compressImage, validateImageFile } from '../lib/helpers.js';

const MAX_PHOTOS = 4;

export function LaporanPage(state) {
  const { projects, user } = state;

  // kepala_lapangan hanya lihat proyeknya sendiri
  const myProjects = user.role === 'kepala_lapangan'
    ? projects.filter(p => p.lead_id === user.id)
    : projects;

  return `
    <div class="fade-in">
      <button class="btn btn-ghost btn-sm mb-16" onclick="window.__app.navigateTo('laporan')" style="padding:6px 12px;">
        <i class="fas fa-arrow-left"></i> Laporan
      </button>
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('laporan-form-body'),i=document.getElementById('laporan-form-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-camera"></i> Laporan Progress</div>
          <i id="laporan-form-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="laporan-form-body" style="display:none;">
        <form id="laporan-form" onsubmit="window.__app.handleLaporanSubmit(event)">

          <div class="form-group mb-16">
            <label class="form-label">Proyek</label>
            <select class="form-select" id="lap-project" required
              onchange="window.__app.loadProjectUpdates(this.value)">
              <option value="">Pilih Proyek</option>
              ${myProjects.map(p => `<option value="${p.id}">${esc(p.name)} (${p.progress_pct||0}%)</option>`).join('')}
            </select>
          </div>

          <div class="form-group mb-16">
            <label class="form-label">Progress: <span id="lap-pct-label">0</span>%</label>
            <input type="hidden" id="lap-pct" value="0" />
            <!-- Tombol per 5% -->
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
              ${Array.from({length: 21}, (_, i) => i * 5).map(v => `
                <button type="button"
                  id="lap-pct-btn-${v}"
                  onclick="window.__setProgress(${v})"
                  style="min-width:44px;padding:5px 4px;font-size:0.72rem;font-weight:600;border-radius:6px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--text-secondary);cursor:pointer;transition:all 0.15s;">
                  ${v}%
                </button>`).join('')}
            </div>
            <div class="progress-bar-wrap mt-12">
              <div class="progress-bar-fill" id="lap-pct-bar" style="width:0%;transition:width 0.3s;"></div>
            </div>
          </div>

          <div class="form-group mb-16">
            <label class="form-label">Deskripsi</label>
            <textarea class="form-textarea" id="lap-desc" placeholder="Jelaskan progress pekerjaan hari ini..." rows="3" required></textarea>
          </div>

          <!-- Multiple foto (maks ${MAX_PHOTOS}) -->
          <div class="form-group mb-24">
            <label class="form-label">Foto Progress (maks ${MAX_PHOTOS} foto)</label>
            <div id="lap-photos-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:10px;">
              <!-- slot foto akan dirender oleh JS -->
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="lap-add-photo-btn"
              onclick="window.__lap_addPhotoSlot()">
              <i class="fas fa-plus"></i> Tambah Foto
            </button>
            <div class="form-hint">Minimal 1 foto, maksimal ${MAX_PHOTOS} foto per laporan</div>
          </div>

          <button type="submit" class="btn btn-success btn-block" id="lap-submit-btn">
            <i class="fas fa-paper-plane"></i> Kirim Laporan
          </button>
        </form>
        </div>
      </div>

      <!-- Riwayat Laporan per Proyek -->
      <div class="card" id="lap-history-card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-history"></i> Riwayat Laporan</div>
        </div>
        <div id="lap-history-content">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>
    </div>`;
}

/** Load riwayat laporan + foto per proyek */
export async function loadProjectUpdates(projectId, state) {
  const card    = document.getElementById('lap-history-card');
  const content = document.getElementById('lap-history-content');
  if (!card || !content) return;

  card.style.display = 'block';
  content.innerHTML  = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';

  if (projectId) {
    const prj = state?.projects?.find(p => p.id === projectId);
    if (prj) {
      const currentPct = Math.round((prj.progress_pct || 0) / 5) * 5;
      window.__setProgress?.(currentPct);
    }
  }

  const isAdmin = state?.user && ['superadmin','owner','admin'].includes(state.user.role);

  try {
    let updQuery   = supabase.from('project_updates').select('*, projects(name)').order('created_at', { ascending: false }).limit(100);
    let photoQuery = supabase.from('project_photos').select('*').order('photo_order');

    if (projectId) {
      updQuery   = updQuery.eq('project_id', projectId);
      photoQuery = photoQuery.eq('project_id', projectId);
    } else if (state?.projects?.length) {
      const ids = state.projects.map(p => p.id);
      updQuery   = updQuery.in('project_id', ids);
      photoQuery = photoQuery.in('project_id', ids);
    }

    const [updRes, photoRes] = await Promise.all([updQuery, photoQuery]);

    const updates = updRes.data || [];
    const photos  = photoRes.data || [];

    if (updates.length === 0) {
      content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada laporan progress.</p></div>';
      return;
    }

    content.innerHTML = updates.map(u => {
      const updatePhotos = photos.filter(p => p.update_id === u.id);
      const allPhotos = updatePhotos.length > 0
        ? updatePhotos
        : (u.photo_url ? [{ photo_url: u.photo_url, caption: '' }] : []);
      const proyekLabel = !projectId && u.projects?.name
        ? `<span class="badge badge-role" style="margin-right:4px;">${esc(u.projects.name)}</span>` : '';

      return `
        <div id="update-row-${u.id}" style="border-bottom:1px solid var(--border,#e5e7eb);padding:16px 0;">
          <div class="flex gap-8 align-center mb-8" style="flex-wrap:wrap;justify-content:space-between;">
            <div class="flex gap-8 align-center" style="flex-wrap:wrap;">
              ${proyekLabel}
              <span class="text-xs text-secondary">${fmtDate(u.created_at)}</span>
              <span class="badge badge-role">${u.percentage}%</span>
            </div>
            ${isAdmin ? `
            <div class="flex gap-4">
              <button class="btn btn-ghost btn-sm" title="Edit"
                onclick="window.__app.editProjectUpdate('${u.id}','${u.project_id}',${u.percentage},${JSON.stringify(esc(u.description||''))})">
                <i class="fas fa-edit" style="font-size:0.75rem;"></i>
              </button>
              <button class="btn btn-ghost btn-sm" title="Hapus"
                onclick="window.__app.deleteProjectUpdate('${u.id}','${u.project_id}')">
                <i class="fas fa-trash" style="font-size:0.75rem;color:var(--danger);"></i>
              </button>
            </div>` : ''}
          </div>
          <p class="text-sm mb-8" id="update-desc-${u.id}">${esc(u.description || '')}</p>
          ${allPhotos.length > 0 ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">
              ${allPhotos.map(ph => `
                <div>
                  <img src="${ph.photo_url}" alt="${esc(ph.caption||'Foto')}"
                    onclick="document.getElementById('lightbox-img').src='${ph.photo_url}';document.getElementById('lightbox').classList.add('active')"
                    style="width:100%;height:90px;object-fit:cover;border-radius:8px;cursor:pointer;" />
                  ${ph.caption ? `<div class="text-xs text-secondary mt-4">${esc(ph.caption)}</div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    }).join('');
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

/** Edit laporan progress — admin/owner/superadmin */
export async function editProjectUpdate(updateId, projectId, currentPct, currentDesc, state) {
  // Buat modal edit inline
  document.getElementById('lap-edit-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'lap-edit-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:480px;">
      <div class="card-header" style="padding:0 0 16px 0;border-bottom:1px solid var(--border);margin-bottom:16px;">
        <div class="card-title"><i class="fas fa-edit"></i> Edit Laporan Progress</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('lap-edit-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="form-group mb-16">
        <label class="form-label">Progress (%)</label>
        <input type="number" class="form-input" id="lap-edit-pct"
          value="${currentPct}" min="0" max="100" step="5" />
      </div>
      <div class="form-group mb-24">
        <label class="form-label">Deskripsi</label>
        <textarea class="form-textarea" id="lap-edit-desc" rows="4">${currentDesc}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="document.getElementById('lap-edit-modal').remove()">Batal</button>
        <button class="btn btn-primary" onclick="window.__app.saveProjectUpdate('${updateId}','${projectId}')">
          <i class="fas fa-save"></i> Simpan
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

/** Simpan edit laporan progress */
export async function saveProjectUpdate(updateId, projectId, state, refreshFn) {
  const pct  = parseInt(document.getElementById('lap-edit-pct')?.value) || 0;
  const desc = document.getElementById('lap-edit-desc')?.value.trim() || '';
  try {
    const { error } = await supabase.from('project_updates')
      .update({ percentage: pct, description: desc })
      .eq('id', updateId);
    if (error) throw error;

    // Update progress proyek jika ini laporan terbaru
    await supabase.from('projects').update({ progress_pct: pct }).eq('id', projectId);

    showToast('Laporan diperbarui ✓', 'success');
    document.getElementById('lap-edit-modal')?.remove();
    await loadProjectUpdates(projectId, state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

/** Hapus laporan progress + foto terkait */
export async function deleteProjectUpdate(updateId, projectId, state, refreshFn) {
  if (!confirm('Hapus laporan ini? Foto terkait juga akan dihapus.')) return;
  try {
    // Hapus foto dari storage
    const { data: photos } = await supabase
      .from('project_photos')
      .select('photo_url')
      .eq('update_id', updateId);

    if (photos?.length) {
      const paths = photos.map(p => {
        const url = new URL(p.photo_url);
        // Ambil path setelah /object/public/project-photos/
        return url.pathname.replace(/.*\/object\/public\/project-photos\//, '');
      });
      await supabase.storage.from('project-photos').remove(paths);
    }

    // Hapus foto records
    await supabase.from('project_photos').delete().eq('update_id', updateId);

    // Hapus update record
    const { error } = await supabase.from('project_updates').delete().eq('id', updateId);
    if (error) throw error;

    showToast('Laporan dihapus ✓', 'success');
    await loadProjectUpdates(projectId, state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

export function previewPhoto(input) {
  const p = document.getElementById('lap-preview');
  if (input.files?.[0] && p) {
    const r = new FileReader();
    r.onload = (e) => { p.src = e.target.result; p.classList.remove('hidden'); };
    r.readAsDataURL(input.files[0]);
  }
}

export async function handleLaporanSubmit(e, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('lap-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Mengirim...';

  try {
    const projectId  = document.getElementById('lap-project').value;
    const percentage = parseInt(document.getElementById('lap-pct').value);
    const description = document.getElementById('lap-desc').value;

    // Kumpulkan semua file foto dari slot
    const photoSlots = document.querySelectorAll('.lap-photo-input');
    const photoFiles = Array.from(photoSlots)
      .map((inp, i) => ({ file: inp.files?.[0], caption: document.getElementById(`lap-caption-${i}`)?.value || '' }))
      .filter(p => p.file);

    if (photoFiles.length === 0) {
      showToast('Minimal 1 foto harus diupload', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Laporan';
      return;
    }

    // Ambil lokasi otomatis + timestamp sudah otomatis (created_at)
    const geo = await getGeoLocation();
    const descWithGeo = description + fmtGeoNote(geo, description ? ' \n' : '');

    // Insert project_update dulu
    const { data: updateData, error: updateErr } = await supabase
      .from('project_updates')
      .insert({ project_id: projectId, reported_by: state.user.id, percentage, description: descWithGeo })
      .select()
      .maybeSingle();
    if (updateErr) throw updateErr;

    // Upload semua foto dengan kompresi
    const uploadedPhotos = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const { file, caption } = photoFiles[i];
      validateImageFile(file); // validasi tipe & ukuran (max 2MB, hanya image)
      const compressedFile = await compressImage(file, 1024, 0.7);
      const safeName = compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `progress/${projectId}/${Date.now()}_${i}_${safeName}`;
      const { error: ue } = await supabase.storage.from('project-photos').upload(fileName, compressedFile);
      if (ue) throw ue;
      const { data: ud } = supabase.storage.from('project-photos').getPublicUrl(fileName);
      uploadedPhotos.push({
        project_id:  projectId,
        update_id:   updateData.id,
        uploaded_by: state.user.id,
        photo_url:   ud.publicUrl,
        caption:     caption || null,
        photo_order: i + 1,
      });
    }

    // Insert semua foto ke project_photos
    const { error: photoErr } = await supabase.from('project_photos').insert(uploadedPhotos);
    if (photoErr) throw photoErr;

    // Update progress proyek
    await supabase.from('projects').update({ progress_pct: percentage }).eq('id', projectId);

    showToast(`Laporan berhasil dikirim! (${uploadedPhotos.length} foto)`, 'success');

    // Reset form
    document.getElementById('laporan-form').reset();
    window.__setProgress?.(0);
    window.__lap_resetPhotoSlots();

    await refreshFn();
    await loadProjectUpdates(projectId, state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Laporan';
  }
}

/** Manajemen slot foto */
if (typeof window !== 'undefined') {
  let _slotCount = 0;

  // Set progress via tombol — highlight tombol aktif
  window.__setProgress = function (val) {
    const hidden = document.getElementById('lap-pct');
    const label  = document.getElementById('lap-pct-label');
    const bar    = document.getElementById('lap-pct-bar');
    if (hidden) hidden.value = val;
    if (label)  label.textContent = val;
    if (bar)    bar.style.width = val + '%';

    // Highlight tombol yang dipilih
    for (let i = 0; i <= 100; i += 5) {
      const btn = document.getElementById(`lap-pct-btn-${i}`);
      if (!btn) continue;
      if (i === val) {
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--primary)';
      } else {
        btn.style.background = 'var(--bg-input)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border)';
      }
    }
  };

  window.__lap_resetPhotoSlots = function () {
    _slotCount = 0;
    const grid = document.getElementById('lap-photos-grid');
    const addBtn = document.getElementById('lap-add-photo-btn');
    if (grid) grid.innerHTML = '';
    if (addBtn) addBtn.style.display = 'inline-flex';
    window.__lap_addPhotoSlot(); // tambah 1 slot awal
  };

  window.__lap_addPhotoSlot = function () {
    const grid   = document.getElementById('lap-photos-grid');
    const addBtn = document.getElementById('lap-add-photo-btn');
    if (!grid) return;
    if (_slotCount >= MAX_PHOTOS) return;

    const idx = _slotCount++;
    const slot = document.createElement('div');
    slot.id = `lap-slot-${idx}`;
    slot.style.cssText = 'position:relative;';
    slot.innerHTML = `
      <div class="file-upload" style="padding:12px;min-height:100px;"
        onclick="document.getElementById('lap-photo-${idx}').click()">
        <i class="fas fa-camera" style="font-size:1.4rem;"></i>
        <p style="font-size:0.75rem;">Foto ${idx + 1}</p>
        <input type="file" id="lap-photo-${idx}" class="lap-photo-input"
          accept="image/*" capture="environment"
          onchange="window.__lap_onPhotoChange(this, ${idx})" />
      </div>
      <img id="lap-thumb-${idx}" class="hidden"
        style="width:100%;height:100px;object-fit:cover;border-radius:8px;" />
      <input type="text" id="lap-caption-${idx}" class="form-input"
        placeholder="Keterangan foto..." style="margin-top:4px;font-size:0.75rem;padding:6px 8px;" />
      <button type="button" onclick="window.__lap_removeSlot(${idx})"
        style="position:absolute;top:4px;right:4px;background:rgba(239,68,68,0.8);border:none;border-radius:50%;width:22px;height:22px;color:white;cursor:pointer;font-size:0.7rem;display:none;"
        id="lap-remove-${idx}">✕</button>`;
    grid.appendChild(slot);

    if (_slotCount >= MAX_PHOTOS && addBtn) addBtn.style.display = 'none';
  };

  window.__lap_onPhotoChange = function (input, idx) {
    const thumb  = document.getElementById(`lap-thumb-${idx}`);
    const upload = input.closest('.file-upload');
    const removeBtn = document.getElementById(`lap-remove-${idx}`);
    if (input.files?.[0] && thumb) {
      const r = new FileReader();
      r.onload = (e) => {
        thumb.src = e.target.result;
        thumb.classList.remove('hidden');
        if (upload) upload.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'block';
      };
      r.readAsDataURL(input.files[0]);
    }
  };

  window.__lap_removeSlot = function (idx) {
    const slot   = document.getElementById(`lap-slot-${idx}`);
    const addBtn = document.getElementById('lap-add-photo-btn');
    if (slot) slot.remove();
    _slotCount--;
    if (addBtn && _slotCount < MAX_PHOTOS) addBtn.style.display = 'inline-flex';
  };

  // Init slot pertama saat halaman dimuat
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('lap-photos-grid')) window.__lap_addPhotoSlot();
  });
}
