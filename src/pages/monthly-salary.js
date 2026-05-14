import { supabase } from '../lib/supabase.js';
import { fmtIdr, esc, showToast } from '../lib/helpers.js';

/**
 * Halaman Gaji Bulanan — untuk role superadmin & admin
 * - Owner/Superadmin: bisa input & lihat semua
 * - Admin: hanya bisa lihat gajinya sendiri
 */

const MONTHLY_ROLES = ['superadmin', 'admin'];

export function MonthlySalaryPage(state) {
  const { user, employees } = state;
  const isOwner = ['superadmin', 'owner'].includes(user.role);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i><p>Akses terbatas.</p>
    </div></div>`;
  }

  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);

  // Admin hanya lihat dirinya sendiri
  const targetEmployees = isOwner
    ? employees.filter(e => MONTHLY_ROLES.includes(e.role))
    : employees.filter(e => e.id === user.id);

  return `
    <div class="fade-in" style="padding:20px;max-width:900px;margin:0 auto;">
      <div class="mb-16">
        <button class="btn btn-ghost btn-sm mb-8" onclick="window.__app.navigateTo('laporan')" style="padding:6px 12px;">
          <i class="fas fa-arrow-left"></i> Laporan
        </button>
        <h1 class="fw-bold" style="font-size:1.5rem;margin:0;">
          <i class="fas fa-calendar-check"></i> Gaji Bulanan
        </h1>
        <div class="text-xs text-secondary">Manajemen gaji tetap untuk Superadmin & Admin</div>
      </div>

      <!-- Filter Bulan -->
      <div class="card mb-16">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <div>
            <label class="form-label">Bulan</label>
            <input type="month" class="form-input" id="ms-month"
              value="${defaultMonth}" onchange="window.__app.loadMonthlySalaries()" />
          </div>
          <button class="btn btn-primary" onclick="window.__app.loadMonthlySalaries()">
            <i class="fas fa-search"></i> Tampilkan
          </button>
        </div>
      </div>

      <!-- Tabel Gaji Bulanan -->
      <div class="card" id="ms-container">
        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>
      </div>
    </div>
  `;
}

export async function loadMonthlySalaries(state) {
  const container = document.getElementById('ms-container');
  if (!container) return;

  const bulan = document.getElementById('ms-month')?.value;
  if (!bulan) return;

  const isOwner = ['superadmin', 'owner'].includes(state.user.role);

  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';

  try {
    // Ambil data monthly_salaries bulan ini
    let msQuery = supabase
      .from('monthly_salaries')
      .select('*')
      .eq('bulan', bulan);

    if (!isOwner) {
      msQuery = msQuery.eq('employee_id', state.user.id);
    }

    const { data: msData, error: msErr } = await msQuery;
    if (msErr) throw msErr;

    // Buat map employee_id → monthly_salary
    const msMap = {};
    (msData || []).forEach(ms => { msMap[ms.employee_id] = ms; });

    // Daftar karyawan yang relevan
    const targetEmployees = isOwner
      ? state.employees.filter(e => ['superadmin', 'admin'].includes(e.role))
      : state.employees.filter(e => e.id === state.user.id);

    if (targetEmployees.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data.</p></div>';
      return;
    }

    const rows = targetEmployees.map(emp => {
      const ms = msMap[emp.id];
      const gajiPokok  = ms ? ms.gaji_pokok  : (emp.basic_salary || 0);
      const tunjangan  = ms ? ms.tunjangan   : 0;
      const potongan   = ms ? ms.potongan    : 0;
      const total      = gajiPokok + tunjangan - potongan;
      const sudahInput = !!ms;

      return `
        <tr>
          <td class="fw-bold">${esc(emp.full_name)}</td>
          <td><span class="badge badge-role" style="font-size:0.65rem;">${esc(emp.role)}</span></td>
          <td class="text-right">${fmtIdr(gajiPokok)}</td>
          <td class="text-right">${fmtIdr(tunjangan)}</td>
          <td class="text-right text-danger">${fmtIdr(potongan)}</td>
          <td class="text-right fw-bold text-success">${fmtIdr(total)}</td>
          <td class="text-center">
            ${sudahInput
              ? `<span class="badge" style="background:var(--success,#22c55e);color:#fff;font-size:0.65rem;">
                  <i class="fas fa-check"></i> Sudah Input
                </span>`
              : `<span class="badge" style="background:var(--warning,#f59e0b);color:#fff;font-size:0.65rem;">
                  <i class="fas fa-clock"></i> Default
                </span>`
            }
          </td>
          ${isOwner ? `
          <td class="text-center">
            <button class="btn btn-ghost btn-sm"
              onclick="window.__app.openMonthlySalaryModal('${emp.id}', '${bulan}')"
              title="${sudahInput ? 'Edit' : 'Input'} gaji bulan ini">
              <i class="fas fa-${sudahInput ? 'pen' : 'plus'}"></i>
            </button>
          </td>` : '<td></td>'}
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Role</th>
              <th class="text-right">Gaji Pokok</th>
              <th class="text-right">Tunjangan</th>
              <th class="text-right">Potongan</th>
              <th class="text-right">Total Bersih</th>
              <th class="text-center">Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      ${isOwner ? `
      <div class="mt-12 text-xs text-secondary" style="padding:0 4px;">
        <i class="fas fa-info-circle"></i>
        Status "Default" berarti menggunakan gaji pokok dari profil karyawan.
        Klik <i class="fas fa-plus"></i> untuk input/override gaji bulan ini.
      </div>` : ''}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

export async function openMonthlySalaryModal(employeeId, bulan, state) {
  const emp = state.employees.find(e => e.id === employeeId);
  if (!emp) return showToast('Data karyawan tidak ditemukan', 'error');

  // Cek apakah sudah ada entry bulan ini
  const { data: existing } = await supabase
    .from('monthly_salaries')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('bulan', bulan)
    .maybeSingle();

  document.getElementById('ms-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'ms-modal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:460px;">
      <div class="card-header" style="padding:0 0 16px 0;border-bottom:1px solid var(--border);margin-bottom:16px;">
        <div class="card-title">
          <i class="fas fa-calendar-check"></i>
          ${existing ? 'Edit' : 'Input'} Gaji Bulanan — ${esc(emp.full_name)}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ms-modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="mb-16 text-xs text-secondary">
        <i class="fas fa-calendar"></i> Bulan: <strong>${bulan}</strong>
        &nbsp;|&nbsp;
        <i class="fas fa-user"></i> Role: <strong>${esc(emp.role)}</strong>
      </div>

      <form id="ms-form" onsubmit="window.__app.saveMonthlySalary(event, '${employeeId}', '${bulan}')">
        <div class="form-group mb-16">
          <label class="form-label">Gaji Pokok (Rp)</label>
          <input type="number" class="form-input" id="ms-gaji-pokok"
            value="${existing ? existing.gaji_pokok : (emp.basic_salary || 0)}"
            min="0" required
            oninput="window.__updateMsTotal()" />
          <div class="form-hint">
            Default dari profil: <strong>${fmtIdr(emp.basic_salary || 0)}</strong>
          </div>
        </div>

        <div class="form-group mb-16">
          <label class="form-label">Tunjangan (Rp)</label>
          <input type="number" class="form-input" id="ms-tunjangan"
            value="${existing ? existing.tunjangan : 0}"
            min="0"
            oninput="window.__updateMsTotal()" />
          <div class="form-hint">Tunjangan tambahan bulan ini (transport, makan, dll)</div>
        </div>

        <div class="form-group mb-16">
          <label class="form-label">Potongan (Rp)</label>
          <input type="number" class="form-input" id="ms-potongan"
            value="${existing ? existing.potongan : 0}"
            min="0"
            oninput="window.__updateMsTotal()" />
          <div class="form-hint">Potongan bulan ini (kasbon, izin, dll)</div>
        </div>

        <div class="form-group mb-16">
          <label class="form-label">Keterangan</label>
          <input type="text" class="form-input" id="ms-keterangan"
            value="${existing ? esc(existing.keterangan || '') : ''}"
            placeholder="Catatan opsional (misal: kenaikan gaji, bonus, dll)" />
        </div>

        <!-- Preview Total -->
        <div class="mb-16" style="background:var(--bg-hover);border-radius:var(--radius);padding:12px;">
          <div class="flex justify-between text-sm mb-4">
            <span>Gaji Pokok</span>
            <span id="ms-preview-pokok">${fmtIdr(existing ? existing.gaji_pokok : (emp.basic_salary || 0))}</span>
          </div>
          <div class="flex justify-between text-sm mb-4">
            <span>Tunjangan</span>
            <span id="ms-preview-tunj">${fmtIdr(existing ? existing.tunjangan : 0)}</span>
          </div>
          <div class="flex justify-between text-sm mb-4 text-danger">
            <span>Potongan</span>
            <span id="ms-preview-pot">- ${fmtIdr(existing ? existing.potongan : 0)}</span>
          </div>
          <div class="flex justify-between fw-bold" style="border-top:1px solid var(--border);padding-top:8px;">
            <span>Total Bersih</span>
            <span id="ms-preview-total" class="text-success">${fmtIdr(
              (existing ? existing.gaji_pokok : (emp.basic_salary || 0))
              + (existing ? existing.tunjangan : 0)
              - (existing ? existing.potongan : 0)
            )}</span>
          </div>
        </div>

        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('ms-modal').remove()">
            Batal
          </button>
          <button type="submit" class="btn btn-primary" id="ms-submit-btn" style="flex:1;">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Live preview total
  window.__updateMsTotal = () => {
    const pokok = parseFloat(document.getElementById('ms-gaji-pokok')?.value) || 0;
    const tunj  = parseFloat(document.getElementById('ms-tunjangan')?.value)  || 0;
    const pot   = parseFloat(document.getElementById('ms-potongan')?.value)   || 0;
    const total = pokok + tunj - pot;
    const fmt = (n) => 'Rp ' + n.toLocaleString('id-ID');
    document.getElementById('ms-preview-pokok').textContent = fmt(pokok);
    document.getElementById('ms-preview-tunj').textContent  = fmt(tunj);
    document.getElementById('ms-preview-pot').textContent   = '- ' + fmt(pot);
    document.getElementById('ms-preview-total').textContent = fmt(total);
  };
}

export async function saveMonthlySalary(e, employeeId, bulan, state) {
  e.preventDefault();
  const btn = document.getElementById('ms-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const gaji_pokok  = parseFloat(document.getElementById('ms-gaji-pokok').value)  || 0;
    const tunjangan   = parseFloat(document.getElementById('ms-tunjangan').value)   || 0;
    const potongan    = parseFloat(document.getElementById('ms-potongan').value)    || 0;
    const keterangan  = document.getElementById('ms-keterangan').value.trim() || null;

    const payload = {
      employee_id: employeeId,
      bulan,
      gaji_pokok,
      tunjangan,
      potongan,
      keterangan,
      created_by: state.user.id,
    };

    // Upsert: insert atau update kalau sudah ada
    const { error } = await supabase
      .from('monthly_salaries')
      .upsert(payload, { onConflict: 'employee_id,bulan' });

    if (error) throw error;

    showToast('Gaji bulanan berhasil disimpan', 'success');
    document.getElementById('ms-modal').remove();
    await loadMonthlySalaries(state);
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
  }
}
