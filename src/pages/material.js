import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, showToast, esc } from '../lib/helpers.js';
import { canFinance, FINANCE_ROLES } from '../lib/roles.js';

const TYPE_LABELS = {
  gudang:     'Dari Gudang',
  customer:   'Dari Customer',
  beli_lokasi:'Beli di Lokasi',
};
const STATUS_LABELS = {
  pending:   { text: 'Pending',     cls: 'badge-role' },
  approved:  { text: 'Disetujui',   cls: 'badge-online' },
  rejected:  { text: 'Ditolak',     cls: 'badge-offline' },
  completed: { text: 'Selesai',     cls: 'badge-online' },
};

/**
 * Halaman Material Orders
 * - Kepala Gudang: Input order material
 * - Admin/Owner/Superadmin: Verifikasi order dari Kepala Gudang, atau input langsung
 * - Kepala Lapangan: Verifikasi tambahan untuk semua order
 */
export function MaterialPage(state) {
  const { projects, user } = state;
  const role = user.role;
  const isAdmin = ['superadmin','owner','admin'].includes(role);
  const isGudang = role === 'kepala_gudang';
  const isLapangan = role === 'kepala_lapangan';
  const canInput = isAdmin || isGudang; // Kepala Gudang & Admin bisa input

  const activeProjects = projects.filter(p => p.status === 'aktif');

  return `
    <div class="fade-in">
      ${isLapangan ? `
      <div class="alert alert-info mb-24">
        <i class="fas fa-info-circle"></i> <strong>Workflow Material:</strong> Kepala Gudang input order → Admin verifikasi → Anda (Kepala Lapangan) verifikasi tambahan
      </div>` : ''}
      ${canInput ? `
      <!-- Form Order Material -->
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('material-form-body'),i=document.getElementById('material-form-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-box"></i> Input Order Material</div>
          <i id="material-form-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="material-form-body" style="display:none;">
        ${isGudang ? `<div class="alert alert-info mb-16" style="margin:16px 16px 0;">
          <i class="fas fa-info-circle"></i> Order yang Anda buat akan diverifikasi oleh Admin, kemudian Kepala Lapangan.
        </div>` : ''}
        ${isAdmin ? `<div class="alert alert-info mb-16" style="margin:16px 16px 0;">
          <i class="fas fa-info-circle"></i> Order yang Anda buat akan diverifikasi oleh Kepala Lapangan.
        </div>` : ''}
        <form id="material-form" onsubmit="window.__app.handleMaterialSubmit(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Proyek</label>
              <select class="form-select" id="mat-project" required>
                <option value="">Pilih Proyek</option>
                ${activeProjects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Jenis Order</label>
              <select class="form-select" id="mat-type" required>
                <option value="gudang">Dari Gudang</option>
                <option value="customer">Dari Customer</option>
                <option value="beli_lokasi">Beli di Lokasi</option>
              </select>
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Nama Material</label>
              <input type="text" class="form-input" id="mat-name" placeholder="Contoh: Semen, Besi, dll" required />
            </div>
            <div class="form-group">
              <label class="form-label">Supplier</label>
              <input type="text" class="form-input" id="mat-supplier" placeholder="Nama supplier" />
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Jumlah</label>
              <input type="number" class="form-input" id="mat-qty" min="0" step="0.01" required placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Satuan</label>
              <input type="text" class="form-input" id="mat-unit" placeholder="contoh: kg, sak, meter" required />
            </div>
            <div class="form-group">
              <label class="form-label">Harga Satuan (Rp)</label>
              <input type="number" class="form-input" id="mat-unit-price" min="0" required placeholder="0" />
            </div>
          </div>
          <div class="form-group mb-16">
            <label class="form-label">Keterangan</label>
            <input type="text" class="form-input" id="mat-desc" placeholder="Keterangan tambahan" />
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="mat-submit-btn">
            <i class="fas fa-save"></i> Simpan Order
          </button>
        </form>
        </div>
      </div>` : ''}

      <!-- Daftar Order Material -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-list"></i> Daftar Order Material</div>
        </div>

        <!-- Filter -->
        <div class="form-row mb-16" style="padding:0 16px 8px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Bulan</label>
            <input type="month" class="form-input" id="mat-filter-month"
              value="${new Date().toISOString().slice(0,7)}"
              onchange="window.__app.loadFilteredMaterials?.()" />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Proyek</label>
            <select class="form-select" id="mat-filter-project"
              onchange="window.__app.loadFilteredMaterials?.()">
              <option value="">Semua Proyek</option>
              ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="material-list">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>
    </div>`;
}

/** Load daftar material orders (dengan filter opsional) */
export async function loadMaterialList(state, containerId = 'material-list', opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    let q = supabase
      .from('material_orders')
      .select('*, projects(name), profiles:ordered_by(full_name)')
      .order('created_at', { ascending: false });

    if (opts.month) {
      const [y, m] = opts.month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      q = q.gte('order_date', start).lte('order_date', end);
    }
    if (opts.projectId) {
      q = q.eq('project_id', opts.projectId);
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada order material.</p></div>';
      return;
    }
    const isDeleter = ['superadmin','owner'].includes(state.user.role);
    const isAdmin = ['superadmin','owner','admin'].includes(state.user.role);
    const isLapangan = state.user.role === 'kepala_lapangan';
    const isGudang = state.user.role === 'kepala_gudang';
    
    // Kepala Gudang hanya bisa lihat, Admin bisa approve/reject, Kepala Lapangan bisa verifikasi tambahan
    const canUpdateStatus = isAdmin || isLapangan;

    el.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;">No.</th>
              <th>Tanggal</th>
              <th>Proyek</th>
              <th>Material</th>
              <th>Jenis</th>
              <th>Jumlah</th>
              <th>Total</th>
              <th>Status</th>
              <th>Dibuat Oleh</th>
              ${canUpdateStatus ? '<th class="text-center">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.map((m, idx) => {
              const st = STATUS_LABELS[m.status] || STATUS_LABELS.pending;
              const creatorName = m.profiles?.full_name || 'Unknown';
              
              return `<tr>
                <td class="text-xs text-secondary">${idx + 1}</td>
                <td class="text-xs">${fmtDate(m.order_date)}</td>
                <td class="text-xs">${esc(m.projects?.name || '-')}</td>
                <td class="fw-bold">${esc(m.material_name)}</td>
                <td class="text-xs">${TYPE_LABELS[m.order_type] || m.order_type}</td>
                <td class="text-xs">${m.quantity} ${esc(m.unit)}</td>
                <td class="fw-bold">${fmtIdr(m.total_price)}</td>
                <td><span class="badge ${st.cls}">${st.text}</span></td>
                <td class="text-xs">${esc(creatorName)}</td>
                ${canUpdateStatus ? `<td class="text-center">
                  <select class="form-select form-select-sm" style="min-width:110px"
                    onchange="window.__app.updateMaterialStatus('${m.id}', this.value)">
                    <option value="pending" ${m.status==='pending'?'selected':''}>Pending</option>
                    <option value="approved" ${m.status==='approved'?'selected':''}>Disetujui</option>
                    <option value="rejected" ${m.status==='rejected'?'selected':''}>Ditolak</option>
                    <option value="completed" ${m.status==='completed'?'selected':''}>Selesai</option>
                  </select>
                  ${isDeleter ? `<button class="btn btn-danger btn-sm ml-8"
                    onclick="window.__app.deleteMaterial('${m.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                  </button>` : ''}
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${esc(e.message)}</p></div>`;
  }
}

/** Submit form material */
export async function handleMaterialSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('mat-submit-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      project_id:    document.getElementById('mat-project').value,
      order_type:    document.getElementById('mat-type').value,
      material_name: document.getElementById('mat-name').value.trim(),
      supplier_name: document.getElementById('mat-supplier').value.trim() || null,
      quantity:      Number(document.getElementById('mat-qty').value),
      unit:          document.getElementById('mat-unit').value.trim(),
      unit_price:    Number(document.getElementById('mat-unit-price').value),
      description:   document.getElementById('mat-desc').value.trim() || null,
      ordered_by:    user.id,
    };
    const { error } = await supabase.from('material_orders').insert(payload);
    if (error) throw error;
    showToast('Order material tersimpan ✓', 'success');
    document.getElementById('material-form').reset();
    window.__app.refreshPage?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan Order';
  }
}

/** Update status material */
export async function updateMaterialStatus(id, status) {
  try {
    const { error } = await supabase.from('material_orders').update({ status }).eq('id', id);
    if (error) throw error;
    showToast('Status diperbarui ✓', 'success');
    window.__app.refreshPage?.();
  } catch (e) {
    showToast('Gagal: ' + e.message, 'error');
  }
}

/** Delete material order */
export async function deleteMaterial(id) {
  if (!confirm('Yakin hapus order material ini?')) return;
  try {
    const { error } = await supabase.from('material_orders').delete().eq('id', id);
    if (error) throw error;
    showToast('Order dihapus ✓', 'success');
    window.__app.refreshPage?.();
  } catch (e) {
    showToast('Gagal: ' + e.message, 'error');
  }
}
