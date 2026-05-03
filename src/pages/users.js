import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { fmtIdr, showToast, esc } from '../lib/helpers.js';
import { canDelete, ROLES, ROLE_LABELS } from '../lib/roles.js';

const JABATAN_OPTIONS = ['Mandor', 'Tukang', 'Kenek', 'Operator', 'Supir', 'Karyawan'];

export function UsersPage(state) {
  const { employees, user } = state;
  const isDeleter = canDelete(user.role);

  return `
    <div class="fade-in">
      <div class="card mb-24">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-user-plus"></i> Tambah User Baru</div>
        </div>
        <form id="user-form" onsubmit="window.__app.handleUserSubmit(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Nama Lengkap</label>
              <input type="text" class="form-input" id="usr-name" placeholder="Nama lengkap" required />
            </div>
            <div class="form-group">
              <label class="form-label">No. WhatsApp</label>
              <input type="text" class="form-input" id="usr-wa" placeholder="08xxxxxxxxxx" />
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-select" id="usr-role" required
                onchange="document.getElementById('usr-jabatan-group').style.display=this.value==='karyawan'?'block':'none'">
                ${ROLES.map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" id="usr-jabatan-group">
              <label class="form-label">Jabatan Lapangan</label>
              <select class="form-select" id="usr-jabatan">
                ${JABATAN_OPTIONS.map(j => `<option value="${j}">${j}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-input" id="usr-username" placeholder="username" required
                oninput="document.getElementById('usr-email-preview').textContent=this.value+'@barotech.com'" />
              <div class="form-hint">Email: <strong id="usr-email-preview">username@barotech.com</strong></div>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-input" id="usr-password" placeholder="Min. 6 karakter" required minlength="6" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="usr-submit-btn">
            <i class="fas fa-user-plus"></i> Buat User
          </button>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-users-gear"></i> Daftar User</div>
          <span class="badge badge-role">${employees.length}</span>
        </div>
        ${employees.length === 0 ? '<div class="empty-state"><i class="fas fa-users"></i><p>Belum ada user</p></div>' : `
        <div class="table-wrapper"><table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Jabatan</th>
              <th class="text-right">Saldo Bon</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(e => `<tr>
              <td class="fw-bold">${esc(e.full_name)}</td>
              <td class="text-xs">${esc(e.email||'-')}</td>
              <td><span class="badge badge-role">${esc(ROLE_LABELS[e.role]||e.role)}</span></td>
              <td class="text-xs text-secondary">${esc(e.jabatan||'-')}</td>
              <td class="text-right text-xs ${(e.bon_balance||0)>0?'text-danger fw-bold':'text-secondary'}">
                ${e.role==='karyawan' ? fmtIdr(e.bon_balance||0) : '-'}
              </td>
              <td class="text-center">
                <div class="flex gap-8 justify-center">
                  <button class="btn btn-ghost btn-sm" onclick="window.__app.openEditUser('${e.id}')" title="Edit">
                    <i class="fas fa-pen"></i>
                  </button>
                  ${isDeleter
                    ? `<button class="btn btn-danger btn-sm" onclick="window.__app.deleteUser('${e.id}')"><i class="fas fa-trash"></i></button>`
                    : ''}
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`}
      </div>
    </div>`;
}

export async function handleUserSubmit(e, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('usr-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Membuat...';
  try {
    const username        = document.getElementById('usr-username').value.trim();
    const password        = document.getElementById('usr-password').value;
    const full_name       = document.getElementById('usr-name').value.trim();
    const role            = document.getElementById('usr-role').value;
    const whatsapp_number = document.getElementById('usr-wa').value.trim();
    const jabatan         = role === 'karyawan'
      ? (document.getElementById('usr-jabatan').value || 'Karyawan')
      : null;

    // Insert directly into profiles table (custom auth)
    const { error } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      username,
      password_hash: password,
      email: username + '@barotech.com',
      full_name,
      role,
      whatsapp_number,
      jabatan,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    showToast(`User ${full_name} berhasil dibuat!`, 'success');
    document.getElementById('user-form').reset();
    document.getElementById('usr-email-preview').textContent = 'username@barotech.com';
    document.getElementById('usr-jabatan-group').style.display = 'block';
    await refreshFn();
  } catch (err) {
    console.error('handleUserSubmit error:', err);
    const msg = err?.message || err?.error_description || JSON.stringify(err);
    showToast('Gagal: ' + msg, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Buat User';
  }
}

export async function deleteUser(id, refreshFn) {
  if (!confirm('Yakin hapus user ini?')) return;
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    showToast('User dihapus', 'success');
    await refreshFn();
  } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
}

/** Open edit user modal */
export function openEditUser(employee, refreshFn) {
  const id = typeof employee === 'string' ? employee : employee.id;
  const e = typeof employee === 'string' ? null : employee;
  if (!e) return showToast('Data user tidak tersedia', 'error');

  // Remove existing modal
  document.getElementById('user-edit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'user-edit-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:480px;">
      <div class="card-header" style="padding:0 0 16px 0;border-bottom:1px solid var(--border);margin-bottom:16px;">
        <div class="card-title"><i class="fas fa-pen"></i> Edit User: ${esc(e.full_name)}</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('user-edit-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <form id="user-edit-form" onsubmit="window.__app.saveEditUser(event, '${e.id}')">
        <div class="form-row mb-16">
          <div class="form-group">
            <label class="form-label">Nama Lengkap</label>
            <input type="text" class="form-input" id="edit-usr-name" value="${esc(e.full_name)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">No. WhatsApp</label>
            <input type="text" class="form-input" id="edit-usr-wa" value="${esc(e.whatsapp_number || '')}" />
          </div>
        </div>
        <div class="form-row mb-16">
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="edit-usr-role" required
              onchange="document.getElementById('edit-usr-jabatan-group').style.display=this.value==='karyawan'?'block':'none'">
              ${ROLES.map(r => `<option value="${r}" ${e.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="edit-usr-jabatan-group" style="display:${e.role === 'karyawan' ? 'block' : 'none'};">
            <label class="form-label">Jabatan Lapangan</label>
            <select class="form-select" id="edit-usr-jabatan">
              ${JABATAN_OPTIONS.map(j => `<option value="${j}" ${e.jabatan === j ? 'selected' : ''}>${j}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group mb-16">
          <label class="form-label">Password Baru (kosongkan jika tidak diubah)</label>
          <input type="password" class="form-input" id="edit-usr-password" placeholder="Min. 6 karakter" minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="edit-usr-submit-btn">
          <i class="fas fa-save"></i> Simpan Perubahan
        </button>
      </form>
    </div>`;
  document.body.appendChild(modal);
}

/** Save edited user */
export async function saveEditUser(e, userId, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('edit-usr-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
  try {
    const full_name       = document.getElementById('edit-usr-name').value.trim();
    const whatsapp_number = document.getElementById('edit-usr-wa').value.trim();
    const role            = document.getElementById('edit-usr-role').value;
    const jabatan         = role === 'karyawan'
      ? (document.getElementById('edit-usr-jabatan').value || 'Karyawan')
      : null;
    const newPassword     = document.getElementById('edit-usr-password').value;

    // Update profile with password if provided
    const updateData = { full_name, whatsapp_number, role, jabatan };
    if (newPassword) {
      updateData.password_hash = newPassword;
    }

    const { error: profileErr } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (profileErr) throw profileErr;

    showToast('User berhasil diperbarui!', 'success');
    document.getElementById('user-edit-modal').remove();
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Perubahan';
  }
}
