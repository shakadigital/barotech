import { supabase } from '../lib/supabase.js';
import { showToast, esc, fmtIdr, fmtDate } from '../lib/helpers.js';
import { canManageProject, canDelete } from '../lib/roles.js';

const STATUS_LABELS = { aktif: 'Aktif', selesai: 'Selesai', pending: 'Pending' };
const STATUS_BADGE  = { aktif: 'badge-online', selesai: 'badge-offline', pending: 'badge-role' };

export function ProjectPage(state) {
  const { projects, employees, user } = state;
  const role      = user.role;
  const isManager = canManageProject(role);   // superadmin, owner, admin
  const isDeleter = canDelete(role);          // superadmin, owner only
  const isViewer  = role === 'kepala_proyek'; // lihat semua, tidak bisa CRUD

  // Kepala proyek lihat semua proyek; admin+ bisa manage
  const visibleProjects = projects;

  // Dropdown lead: kepala_proyek & kepala_lapangan
  const leads = employees.filter(e => ['kepala_proyek','kepala_lapangan'].includes(e.role));

  return `
    <div class="fade-in">

      ${isManager ? `
      <!-- Form Buat Proyek -->
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('project-form-body'),i=document.getElementById('project-form-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-plus-circle"></i> Buat Proyek Baru</div>
          <i id="project-form-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="project-form-body" style="display:none;">
        <form id="project-form" onsubmit="window.__app.handleProjectSubmit(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Nama Proyek</label>
              <input type="text" class="form-input" id="prj-name" placeholder="Nama proyek" required />
            </div>
            <div class="form-group">
              <label class="form-label">Lokasi</label>
              <input type="text" class="form-input" id="prj-location" placeholder="Lokasi proyek" required />
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Penanggung Jawab</label>
              <select class="form-select" id="prj-lead" required>
                <option value="">Pilih Kepala Teknik / Kepala Proyek</option>
                ${leads.map(e => `<option value="${e.id}">${esc(e.full_name)} (${esc(e.role)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="prj-status">
                <option value="aktif">Aktif</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="prj-submit-btn">
            <i class="fas fa-save"></i> Simpan Proyek
          </button>
        </form>
        </div>
      </div>` : ''}

      <!-- Daftar Proyek -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-building"></i> Daftar Proyek</div>
          <span class="badge badge-role">${visibleProjects.length}</span>
        </div>
        ${visibleProjects.length === 0
          ? '<div class="empty-state"><i class="fas fa-building"></i><p>Belum ada proyek</p></div>'
          : `<div class="table-wrapper"><table class="data-table">
              <thead>
                <tr>
                  <th style="width:40px;">No.</th>
                  <th>Nama</th>
                  <th>Lokasi</th>
                  <th>Penanggung Jawab</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th class="text-center">Detail</th>
                  ${isManager ? '<th class="text-center">Aksi</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${visibleProjects.map((p, idx) => {
                  const lead = employees.find(e => e.id === p.lead_id);
                  const statusKey = p.status || 'aktif';
                  return `<tr>
                    <td class="text-xs text-secondary">${idx + 1}</td>
                    <td class="fw-bold">${esc(p.name)}</td>
                    <td class="text-xs">${esc(p.location_name)||'-'}</td>
                    <td class="text-xs">${esc(lead?.full_name||'-')}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div class="progress-bar-wrap" style="width:70px">
                          <div class="progress-bar-fill" style="width:${p.progress_pct||0}%"></div>
                        </div>
                        <span class="text-xs">${p.progress_pct||0}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${STATUS_BADGE[statusKey]||'badge-role'}">
                        ${STATUS_LABELS[statusKey]||statusKey}
                      </span>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-ghost btn-sm" title="Detail Proyek"
                        onclick="window.__app.openProjectDetail('${p.id}')">
                        <i class="fas fa-info-circle"></i>
                      </button>
                    </td>
                    ${isManager ? `
                    <td class="text-center">
                      <div class="flex gap-8 justify-center">
                        ${statusKey !== 'selesai' ? `
                          <button class="btn btn-success btn-sm" title="Tandai Selesai"
                            onclick="window.__app.updateProjectStatus('${p.id}','selesai')">
                            <i class="fas fa-flag-checkered"></i>
                          </button>` : `
                          <button class="btn btn-ghost btn-sm" title="Aktifkan Kembali"
                            onclick="window.__app.updateProjectStatus('${p.id}','aktif')">
                            <i class="fas fa-redo"></i>
                          </button>`}
                        ${isDeleter ? `
                          <button class="btn btn-danger btn-sm" title="Hapus"
                            onclick="window.__app.deleteProject('${p.id}')">
                            <i class="fas fa-trash"></i>
                          </button>` : ''}
                      </div>
                    </td>` : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>`}
      </div>
    </div>`;
}

export async function handleProjectSubmit(e, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('prj-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
  try {
    const { error } = await supabase.from('projects').insert({
      name:          document.getElementById('prj-name').value.trim(),
      location_name: document.getElementById('prj-location').value.trim(),
      lead_id:       document.getElementById('prj-lead').value,
      status:        document.getElementById('prj-status').value,
      progress_pct:  0,
    });
    if (error) throw error;
    showToast('Proyek berhasil dibuat!', 'success');
    document.getElementById('project-form').reset();
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Proyek';
  }
}

/** Update status proyek — admin/owner/superadmin */
export async function updateProjectStatus(id, status, refreshFn) {
  const label = status === 'selesai' ? 'selesai/finish' : 'aktif kembali';
  if (!confirm(`Tandai proyek ini sebagai ${label}?`)) return;
  try {
    const { error } = await supabase.from('projects').update({ status }).eq('id', id);
    if (error) throw error;
    showToast(`Proyek ditandai ${label}`, 'success');
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

/** Hapus proyek — hanya superadmin & owner */
export async function deleteProject(id, refreshFn) {
  if (!confirm('Yakin hapus proyek ini? Semua data absensi terkait akan terpengaruh.')) return;
  try {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    showToast('Proyek dihapus', 'success');
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error'); }
}

/** Buka modal detail proyek: karyawan, pengeluaran, timeline */
export async function openProjectDetail(projectId, employees, projects) {
  const project = projects.find(p => p.id === projectId);
  if (!project) { showToast('Proyek tidak ditemukan', 'error'); return; }

  // Remove existing modal
  document.getElementById('project-detail-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'project-detail-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:640px;max-height:85vh;overflow:auto;">
      <div class="card-header" style="padding:0 0 16px 0;border-bottom:1px solid var(--border);margin-bottom:16px;">
        <div class="card-title"><i class="fas fa-building"></i> ${esc(project.name)}</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('project-detail-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div id="project-detail-content">
        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat detail...</p></div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const content = document.getElementById('project-detail-content');
  try {
    const lead = employees.find(e => e.id === project.lead_id);

    // Fetch semua data paralel
    const [assignRes, expenseRes, updateRes, rekapRes] = await Promise.all([
      supabase
        .from('project_assignments')
        .select('id, status, employee_id, profiles!project_assignments_employee_id_fkey(full_name, role, jabatan)')
        .eq('project_id', projectId)
        .eq('status', 'active'),
      supabase
        .from('project_expenses')
        .select('amount')
        .eq('project_id', projectId),
      supabase
        .from('project_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_rekap_biaya_proyek', { p_project_id: projectId, p_bulan: null }),
    ]);

    const assignments  = assignRes.data  || [];
    const expenses     = expenseRes.data || [];
    const updates      = updateRes.data  || [];
    const rekapData    = rekapRes.data?.[0] || null;

    const totalExpense = expenses.reduce((s, x) => s + (x.amount || 0), 0);

    // Build timeline HTML
    const timelineHtml = updates.length === 0
      ? '<p class="text-xs text-secondary italic">Belum ada update progress.</p>'
      : `<div style="position:relative;padding-left:20px;">
          <div style="position:absolute;left:7px;top:4px;bottom:4px;width:2px;background:var(--primary);opacity:0.3;"></div>
          ${updates.map((u, i) => `
            <div style="position:relative;margin-bottom:16px;">
              <div style="position:absolute;left:-16px;top:6px;width:10px;height:10px;border-radius:50%;background:${i===0?'var(--success)':'var(--primary)'};border:2px solid white;"></div>
              <div class="text-xs text-secondary">${fmtDate(u.created_at)}</div>
              <div class="flex items-center gap-8 mt-4">
                <span class="badge badge-role">${u.percentage}%</span>
                <span class="text-sm">${esc(u.description || '')}</span>
              </div>
            </div>
          `).join('')}
        </div>`;

    content.innerHTML = `
      <!-- Info Proyek -->
      <div class="mb-16">
        <div class="flex gap-16 flex-wrap mb-8">
          <div><span class="text-xs text-secondary">Lokasi:</span> <strong>${esc(project.location_name || '-')}</strong></div>
          <div><span class="text-xs text-secondary">Penanggung Jawab:</span> <strong>${esc(lead?.full_name || '-')}</strong></div>
          <div><span class="text-xs text-secondary">Progress:</span> <strong>${project.progress_pct || 0}%</strong></div>
        </div>
        <div class="progress-bar-wrap mb-8"><div class="progress-bar-fill" style="width:${project.progress_pct || 0}%"></div></div>
      </div>

      <!-- Ringkasan Biaya (dari RPC) -->
      ${rekapData ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px;">
        ${[
          { label: 'Gaji',        val: rekapData.total_gaji,        color: 'var(--primary)' },
          { label: 'Lembur',      val: rekapData.total_lembur,      color: 'var(--warning)' },
          { label: 'Material',    val: rekapData.total_material,    color: 'var(--info,#3b82f6)' },
          { label: 'Pengeluaran', val: rekapData.total_pengeluaran, color: 'var(--danger)' },
          { label: 'Grand Total', val: rekapData.grand_total,       color: 'var(--success)' },
        ].map(c => `
          <div class="card" style="padding:10px 12px;border-left:3px solid ${c.color};">
            <div class="text-xs text-secondary">${c.label}</div>
            <div class="fw-bold text-sm" style="color:${c.color};">${fmtIdr(c.val)}</div>
          </div>
        `).join('')}
      </div>` : ''}

      <!-- Karyawan Terlibat -->
      <div class="card mb-16" style="padding:12px 14px;">
        <div class="card-title" style="font-size:0.85rem;margin-bottom:8px;"><i class="fas fa-users"></i> Karyawan Terlibat (${assignments.length})</div>
        ${assignments.length === 0
          ? '<p class="text-xs text-secondary italic">Belum ada penugasan aktif.</p>'
          : `<div class="flex flex-wrap gap-8">
              ${assignments.map(a => `<span class="badge badge-role">${esc(a.profiles?.full_name || '-')} <span class="text-secondary">(${esc(a.profiles?.jabatan || a.profiles?.role || '-')})</span></span>`).join('')}
            </div>`}
      </div>

      <!-- Timeline Progress -->
      <div class="card" style="padding:12px 14px;">
        <div class="card-title" style="font-size:0.85rem;margin-bottom:12px;"><i class="fas fa-stream"></i> Timeline Progress (${updates.length} update)</div>
        ${timelineHtml}
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle text-danger"></i><p class="text-danger">Gagal memuat detail: ${esc(err.message)}</p></div>`;
    console.error('openProjectDetail error:', err);
  }
}
