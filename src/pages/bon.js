import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, showToast, esc } from '../lib/helpers.js';
import { ROLE_LABELS } from '../lib/roles.js';

/**
 * Halaman Bon / Kasbon
 * - Admin/Owner/Superadmin: kelola bon semua karyawan
 * - Kepala Proyek/Lapangan/Gudang & Karyawan: lihat bon milik sendiri
 */
export function BonPage(state) {
  const { employees, user } = state;
  const isAdmin = ['admin', 'owner', 'superadmin'].includes(user.role);
  const canViewOwnBon = !isAdmin; // semua non-admin bisa lihat bon sendiri

  // Tampilan self-service untuk non-admin
  if (canViewOwnBon) {
    const self = employees.find(e => e.id === user.id);
    const bonBalance = self?.bon_balance || 0;
    return `
      <div class="fade-in">
        <div class="card mb-24">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-hand-holding-usd"></i> Bon Saya</div>
          </div>
          <div style="padding:16px;">
            <div style="background:var(--surface-2,#f3f4f6);border-radius:var(--radius,8px);padding:16px 20px;margin-bottom:16px;">
              <div class="text-xs text-secondary mb-4">Saldo Bon Saat Ini</div>
              <div class="fw-bold" style="font-size:1.4rem;color:${bonBalance > 0 ? 'var(--danger,#ef4444)' : 'var(--success,#22c55e)'};">
                ${fmtIdr(bonBalance)}
              </div>
              ${bonBalance > 0 ? `<div class="text-xs text-secondary mt-4">Hutang bon yang belum lunas</div>` : `<div class="text-xs text-secondary mt-4">Tidak ada hutang bon</div>`}
            </div>
            <p class="text-xs text-secondary">
              <i class="fas fa-info-circle"></i>
              Untuk mengajukan bon, hubungi Admin. Riwayat transaksi bon Anda ditampilkan di bawah.
            </p>
          </div>
        </div>

        <!-- Riwayat bon milik sendiri -->
        <div class="card">
          <div class="card-header" style="justify-content:space-between;">
            <div class="card-title"><i class="fas fa-history"></i> Riwayat Bon Saya</div>
            <input type="month" class="form-input" id="bon-self-month"
              value="${new Date().toISOString().slice(0,7)}"
              style="width:auto;"
              onchange="window.__app.loadSelfBonHistory()" />
          </div>
          <div id="bon-self-history">
            <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
          </div>
        </div>
      </div>`;
  }

  // Tampilan admin: kelola bon semua personil
  // Semua personil (karyawan + kepala lapangan + kepala proyek + kepala gudang) bisa punya bon
  const NON_BON_ROLES = ['superadmin', 'owner', 'admin'];
  const karyawanList = employees.filter(e => !NON_BON_ROLES.includes(e.role));

  return `
    <div class="fade-in">

      <!-- Form Input Transaksi Bon -->
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('bon-form-body'),i=document.getElementById('bon-form-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-hand-holding-usd"></i> Input Transaksi Bon</div>
          <i id="bon-form-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="bon-form-body" style="display:none;">
        <form id="bon-form" onsubmit="window.__app.handleBonSubmit(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Karyawan</label>
              <select class="form-select" id="bon-employee" required
                onchange="window.__bon_onEmployeeChange(this.value)">
                <option value="">Pilih Karyawan</option>
                ${karyawanList.map(e =>
                  `<option value="${e.id}" data-bon="${e.bon_balance || 0}">${esc(e.full_name)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Jenis Transaksi</label>
              <select class="form-select" id="bon-type" required>
                <option value="pinjam">Pinjam (Tambah Hutang)</option>
                <option value="bayar">Bayar (Kurangi Hutang)</option>
              </select>
            </div>
          </div>

          <!-- Info saldo saat ini -->
          <div id="bon-employee-info" class="mb-16" style="display:none;background:var(--surface-2,#f3f4f6);border-radius:var(--radius,8px);padding:10px 14px;">
            <span class="text-xs"><i class="fas fa-wallet"></i> Saldo Bon Saat Ini:
              <strong id="bon-info-saldo" class="text-danger">Rp 0</strong>
            </span>
          </div>

          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Jumlah (Rp)</label>
              <input type="number" class="form-input" id="bon-amount" min="1" required placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Keterangan</label>
              <input type="text" class="form-input" id="bon-desc" placeholder="Contoh: Pinjam untuk kebutuhan keluarga" />
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="bon-submit-btn">
            <i class="fas fa-save"></i> Simpan Transaksi
          </button>
        </form>
        </div>
      </div>

      <!-- Daftar Saldo Bon Karyawan -->
      <div class="card mb-24">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-users"></i> Saldo Bon Karyawan</div>
          <span class="badge badge-role">${karyawanList.length} orang</span>
        </div>
        ${karyawanList.length === 0 ? `
          <div class="empty-state"><i class="fas fa-users"></i><p>Belum ada karyawan.</p></div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:40px;">No.</th>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th class="text-right">Saldo Bon</th>
                  <th class="text-center">Riwayat</th>
                </tr>
              </thead>
              <tbody>
                ${karyawanList.map((e, idx) => `
                  <tr>
                    <td class="text-xs text-secondary">${idx + 1}</td>
                    <td class="fw-bold">${esc(e.full_name)}</td>
                    <td class="text-xs text-secondary">${esc(e.jabatan || ROLE_LABELS[e.role] || 'Karyawan')}</td>
                    <td class="text-right">
                      <span class="${(e.bon_balance || 0) > 0 ? 'text-danger fw-bold' : 'text-success'}">
                        ${fmtIdr(e.bon_balance || 0)}
                      </span>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-ghost btn-sm" onclick="window.__app.showBonHistory('${e.id}', '${esc(e.full_name)}')">
                        <i class="fas fa-history"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Riwayat Transaksi (muncul setelah klik tombol riwayat) -->
      <div id="bon-history-panel" class="card" style="display:none;">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-history"></i> Riwayat Bon: <span id="bon-history-name"></span></div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('bon-history-panel').style.display='none'">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="form-group" style="padding:0 16px 8px;">
          <input type="month" class="form-input" id="bon-filter-month"
            value="${new Date().toISOString().slice(0,7)}"
            onchange="window.__app.reloadBonHistory?.()" />
        </div>
        <div id="bon-history-content">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>

    </div>`;
}

/** Submit transaksi bon */
export async function handleBonSubmit(e, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('bon-submit-btn');
  btn.disabled = true;

  try {
    const employeeId = document.getElementById('bon-employee').value;
    const type       = document.getElementById('bon-type').value;
    const amount     = parseFloat(document.getElementById('bon-amount').value) || 0;
    const desc       = document.getElementById('bon-desc').value.trim();

    if (amount <= 0) throw new Error('Jumlah harus lebih dari 0');

    // Cek saldo jika bayar — tidak boleh melebihi saldo
    if (type === 'bayar') {
      const emp = state.employees.find(e => e.id === employeeId);
      if (emp && amount > (emp.bon_balance || 0)) {
        throw new Error(`Jumlah bayar (${fmtIdr(amount)}) melebihi saldo bon (${fmtIdr(emp.bon_balance || 0)})`);
      }
    }

    const { error } = await supabase.from('bon_transactions').insert({
      employee_id:  employeeId,
      type:         type,
      amount:       amount,
      balance_after: 0, // akan diupdate oleh trigger
      description:  desc || null,
      created_by:   state.user.id,
    });

    if (error) throw error;

    showToast(type === 'pinjam' ? 'Pinjaman berhasil dicatat' : 'Pembayaran bon berhasil dicatat', 'success');
    document.getElementById('bon-form').reset();
    document.getElementById('bon-employee-info').style.display = 'none';
    await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

let _bonHistoryEmpId = null;
let _bonHistoryName  = '';

/** Tampilkan riwayat bon per karyawan (dengan filter bulan opsional) */
export async function showBonHistory(employeeId, name, month) {
  const panel   = document.getElementById('bon-history-panel');
  const nameEl  = document.getElementById('bon-history-name');
  const content = document.getElementById('bon-history-content');

  _bonHistoryEmpId = employeeId;
  _bonHistoryName  = name;
  if (name) nameEl.textContent = name;
  panel.dataset.empId = employeeId;

  panel.style.display = 'block';
  content.innerHTML   = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';

  // Scroll ke panel
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    let q = supabase
      .from('bon_transactions')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      q = q.gte('created_at', start).lte('created_at', end + 'T23:59:59');
    }

    const { data, error } = await q;

    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada transaksi bon.</p></div>';
      return;
    }

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;">No.</th>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th class="text-right">Jumlah</th>
              <th class="text-right">Saldo Setelah</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((t, idx) => `
              <tr>
                <td class="text-xs text-secondary">${idx + 1}</td>
                <td class="text-xs">${fmtDate(t.created_at)}</td>
                <td>
                  <span class="badge ${t.type === 'pinjam' ? 'badge-offline' : 'badge-online'}">
                    ${t.type === 'pinjam' ? 'PINJAM' : 'BAYAR'}
                  </span>
                </td>
                <td class="text-right ${t.type === 'pinjam' ? 'text-danger' : 'text-success'} fw-bold">
                  ${t.type === 'pinjam' ? '+' : '-'}${fmtIdr(t.amount)}
                </td>
                <td class="text-right text-xs">${fmtIdr(t.balance_after)}</td>
                <td class="text-xs text-secondary">${esc(t.description || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat: ${esc(err.message)}</p></div>`;
  }
}

/** Auto-fill info saldo saat pilih karyawan di form bon */
if (typeof window !== 'undefined') {
  window.__bon_onEmployeeChange = function (empId) {
    const sel    = document.getElementById('bon-employee');
    const opt    = sel?.querySelector(`option[value="${empId}"]`);
    const info   = document.getElementById('bon-employee-info');
    const saldoEl = document.getElementById('bon-info-saldo');

    if (!opt || !empId) {
      if (info) info.style.display = 'none';
      return;
    }
    const bon = parseFloat(opt.dataset.bon) || 0;
    if (saldoEl) saldoEl.textContent = 'Rp ' + bon.toLocaleString('id-ID');
    if (info)    info.style.display  = 'block';
  };
}

/** Load riwayat bon milik sendiri (untuk non-admin) */
export async function loadSelfBonHistory(userId) {
  const content = document.getElementById('bon-self-history');
  if (!content) return;

  content.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';

  const monthInput = document.getElementById('bon-self-month');
  const month = monthInput?.value;

  try {
    let q = supabase
      .from('bon_transactions')
      .select('*')
      .eq('employee_id', userId)
      .order('created_at', { ascending: false });

    if (month) {
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      q = q.gte('created_at', start).lte('created_at', end + 'T23:59:59');
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada transaksi bon pada periode ini.</p></div>';
      return;
    }

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;">No.</th>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th class="text-right">Jumlah</th>
              <th class="text-right">Saldo Setelah</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((t, idx) => `
              <tr>
                <td class="text-xs text-secondary">${idx + 1}</td>
                <td class="text-xs">${fmtDate(t.created_at)}</td>
                <td>
                  <span class="badge ${t.type === 'pinjam' ? 'badge-offline' : 'badge-online'}">
                    ${t.type === 'pinjam' ? 'PINJAM' : 'BAYAR'}
                  </span>
                </td>
                <td class="text-right ${t.type === 'pinjam' ? 'text-danger' : 'text-success'} fw-bold">
                  ${t.type === 'pinjam' ? '+' : '-'}${fmtIdr(t.amount)}
                </td>
                <td class="text-right text-xs">${fmtIdr(t.balance_after)}</td>
                <td class="text-xs text-secondary">${esc(t.description || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat: ${esc(err.message)}</p></div>`;
  }
}
