/**
 * PATCH FILE — Update Attendance UI
 * 
 * Menambahkan:
 * 1. Tombol verifikasi dengan status: Hadir, Tidak Hadir, Libur, Izin, Sakit
 * 2. Input kegiatan untuk user yang hadir
 * 
 * Cara pakai:
 * 1. Jalankan sql/v28-add-leave-status-and-activities.sql di database
 * 2. Update fungsi verifyAttendance di attendance.js dengan kode di bawah
 * 3. Update renderRow untuk menambah tombol status baru
 */

// ============================================
// REPLACE fungsi verifyAttendance dengan ini:
// ============================================

export async function verifyAttendance(id, result, refreshFn) {
  try {
    // result bisa: 'hadir', 'tidak_hadir', 'libur', 'izin', 'sakit'
    const statusMap = {
      'hadir': { status: 'hadir', notes: 'Hadir' },
      'tidak_hadir': { status: 'tidak_hadir', notes: 'Tidak Hadir' },
      'libur': { status: 'libur', notes: 'Libur' },
      'izin': { status: 'izin', notes: 'Izin' },
      'sakit': { status: 'sakit', notes: 'Sakit' },
      // Backward compatibility
      'verified': { status: 'hadir', notes: 'Hadir' },
      'absent': { status: 'tidak_hadir', notes: 'Tidak Hadir' },
    };

    const { status, notes } = statusMap[result] || { status: 'pending', notes: '' };
    
    const wiInput = document.getElementById(`wi-${id}`);
    const workItems = wiInput?.value.trim() || null;

    const kegiatanInput = document.getElementById(`kegiatan-${id}`);
    const kegiatan = kegiatanInput?.value.trim() || null;

    const updateData = { 
      status, 
      notes,
      ...(workItems ? { work_items: workItems } : {}),
      ...(kegiatan ? { kegiatan: kegiatan } : {}),
    };

    const { error } = await supabase.from('attendance_logs')
      .update(updateData)
      .eq('id', id);
      
    if (error) throw error;

    const messages = {
      'hadir': 'Hadir ✓',
      'tidak_hadir': 'Tidak Hadir ✓',
      'libur': 'Libur ✓',
      'izin': 'Izin ✓',
      'sakit': 'Sakit ✓',
      'verified': 'Hadir ✓',
      'absent': 'Tidak Hadir ✓',
    };
    
    showToast(messages[result] || 'Tersimpan ✓', 'success');
    await refreshFn?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ============================================
// UPDATE bagian actions di renderRow dengan ini:
// ============================================

function renderVerificationActions(l, finalCanVerify, isPindah, isOfficeStaff) {
  const isDraft = l.status === 'draft' || l.status === 'pending';
  const isVerified = l.status === 'hadir' || l.status === 'verified';
  
  if (finalCanVerify && isDraft) {
    return `
      <div style="display:flex;flex-direction:column;gap:6px;min-width:240px;">
        ${isPindah ? `<div class="text-xs text-warning mb-4"><i class="fas fa-info-circle"></i> ${esc(l.notes)}</div>` : ''}
        ${isOfficeStaff ? `<div class="text-xs text-primary mb-4"><i class="fas fa-building"></i> Office staff</div>` : ''}
        
        <!-- Input Kegiatan -->
        <input type="text" class="form-input" id="kegiatan-${l.id}"
          placeholder="Kegiatan hari ini..."
          value="${esc(l.kegiatan || '')}"
          style="font-size:0.78rem;padding:6px 10px;margin-bottom:4px;" />
        
        <!-- Input Work Items (untuk backward compatibility) -->
        <input type="text" class="form-input" id="wi-${l.id}"
          placeholder="Pekerjaan hari ini..."
          value="${esc(l.work_items || '')}"
          style="font-size:0.78rem;padding:6px 10px;" />
        
        <!-- Tombol Verifikasi -->
        <div class="flex gap-4" style="flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" style="flex:1;min-width:80px;"
            onclick="window.__app.verifyAttendance('${l.id}','hadir')"
            title="Hadir">
            <i class="fas fa-check"></i> Hadir
          </button>
          <button class="btn btn-danger btn-sm" style="flex:1;min-width:80px;"
            onclick="window.__app.verifyAttendance('${l.id}','tidak_hadir')"
            title="Tidak Hadir">
            <i class="fas fa-times"></i> Tidak
          </button>
        </div>
        
        <!-- Tombol Status Lainnya -->
        <div class="flex gap-4" style="flex-wrap:wrap;">
          <button class="btn btn-sm" style="flex:1;background:rgba(59,130,246,0.1);color:#3b82f6;min-width:60px;"
            onclick="window.__app.verifyAttendance('${l.id}','libur')"
            title="Libur">
            <i class="fas fa-umbrella-beach"></i> Libur
          </button>
          <button class="btn btn-sm" style="flex:1;background:rgba(245,158,11,0.1);color:#f59e0b;min-width:60px;"
            onclick="window.__app.verifyAttendance('${l.id}','izin')"
            title="Izin">
            <i class="fas fa-file-signature"></i> Izin
          </button>
          <button class="btn btn-sm" style="flex:1;background:rgba(239,68,68,0.1);color:#ef4444;min-width:60px;"
            onclick="window.__app.verifyAttendance('${l.id}','sakit')"
            title="Sakit">
            <i class="fas fa-notes-medical"></i> Sakit
          </button>
        </div>
      </div>`;
  } else if (finalCanVerify && isVerified) {
    return `
      <div style="display:flex;flex-direction:column;gap:4px;min-width:180px;">
        <div class="text-xs text-success mb-4">
          <i class="fas fa-check-double"></i> Sudah Diverifikasi
        </div>
        
        <!-- Edit Kegiatan -->
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;">
          <input type="text" class="form-input" id="kegiatan-${l.id}"
            placeholder="Kegiatan..."
            value="${esc(l.kegiatan || '')}"
            style="font-size:0.78rem;padding:5px 8px;flex:1;" />
          <button class="btn btn-ghost btn-sm"
            onclick="window.__app.saveKegiatan('${l.id}')" title="Simpan Kegiatan">
            <i class="fas fa-save"></i>
          </button>
        </div>
        
        <!-- Edit Work Items -->
        <div style="display:flex;gap:4px;align-items:center;">
          <input type="text" class="form-input" id="wi-${l.id}"
            placeholder="Pekerjaan..."
            value="${esc(l.work_items || '')}"
            style="font-size:0.78rem;padding:5px 8px;flex:1;" />
          <button class="btn btn-ghost btn-sm"
            onclick="window.__app.saveWorkItems('${l.id}')" title="Simpan Pekerjaan">
            <i class="fas fa-save"></i>
          </button>
        </div>
      </div>`;
  }
  
  return '<span class="text-xs text-muted">—</span>';
}

// ============================================
// TAMBAHKAN fungsi baru untuk save kegiatan:
// ============================================

export async function saveKegiatan(id, refreshFn) {
  const kegiatanInput = document.getElementById(`kegiatan-${id}`);
  if (!kegiatanInput) return;
  try {
    const { error } = await supabase.from('attendance_logs')
      .update({ kegiatan: kegiatanInput.value.trim() || null })
      .eq('id', id);
    if (error) throw error;
    showToast('Kegiatan disimpan ✓', 'success');
    await refreshFn?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ============================================
// UPDATE status badge di renderRow:
// ============================================

function getStatusBadge(l) {
  const statusConfig = {
    'hadir': { label: 'HADIR', class: 'badge-online' },
    'verified': { label: 'HADIR', class: 'badge-online' },
    'tidak_hadir': { label: 'TIDAK HADIR', class: 'badge-offline' },
    'absent': { label: 'TIDAK HADIR', class: 'badge-offline' },
    'libur': { label: 'LIBUR', class: 'badge', style: 'background:rgba(59,130,246,0.2);color:#3b82f6;' },
    'izin': { label: 'IZIN', class: 'badge', style: 'background:rgba(245,158,11,0.2);color:#f59e0b;' },
    'sakit': { label: 'SAKIT', class: 'badge', style: 'background:rgba(239,68,68,0.2);color:#ef4444;' },
    'pending': { label: 'BELUM VERIFIKASI', class: 'badge-offline' },
    'draft': { label: 'BELUM VERIFIKASI', class: 'badge-offline' },
  };

  const isPindah = l.notes?.startsWith('Pindah Tugas');
  if (isPindah && (l.status === 'draft' || l.status === 'pending')) {
    return '<span class="badge" style="background:rgba(245,158,11,0.2);color:var(--warning);">PINDAH TUGAS</span>';
  }

  const config = statusConfig[l.status] || statusConfig['pending'];
  const styleAttr = config.style ? ` style="${config.style}"` : '';
  return `<span class="${config.class}"${styleAttr}>${config.label}</span>`;
}

// ============================================
// EXPORT fungsi baru di main.js:
// ============================================

// Tambahkan di window.__app:
// saveKegiatan(id) { saveKegiatan(id, refreshAndRender); },
