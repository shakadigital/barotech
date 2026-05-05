import { fmtIdr, fmtDate, esc, showToast } from '../lib/helpers.js';
import { supabase } from '../lib/supabase.js';
import { exportLaporanBonExcel } from '../lib/excel-export.js';

/**
 * Laporan Bon — RPC-based
 * Rekap saldo hutang + riwayat transaksi bon per karyawan
 */
export function LaporanBonPage(state) {
  const { user, employees } = state;

  if (!['superadmin', 'owner', 'admin'].includes(user.role)) {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i><p>Akses terbatas admin/owner/superadmin.</p>
    </div></div>`;
  }

  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);

  return `
    <div class="fade-in" style="padding:20px;max-width:1200px;margin:0 auto;">
      <div class="mb-16" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h1 class="fw-bold" style="font-size:1.5rem;margin:0;">
            <i class="fas fa-hand-holding-usd"></i> Laporan Bon / Kasbon
          </h1>
          <div class="text-xs text-secondary">Saldo hutang & riwayat transaksi bon karyawan</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success" onclick="window.__app.exportLaporanBon()">
            <i class="fas fa-file-excel"></i> Download Excel
          </button>
          <button class="btn btn-primary" onclick="window.print()">
            <i class="fas fa-print"></i> Cetak
          </button>
        </div>
      </div>

      <!-- Filter -->
      <div class="card mb-16">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <div>
            <label class="form-label">Bulan Transaksi</label>
            <input type="month" class="form-input" id="lb-month"
              value="${defaultMonth}" onchange="window.__app.loadLaporanBon()" />
          </div>
          <div>
            <label class="form-label">Karyawan</label>
            <select class="form-select" id="lb-employee" onchange="window.__app.loadLaporanBon()">
              <option value="">Semua Karyawan</option>
              ${employees.filter(e => e.role === 'karyawan').map(e =>
                `<option value="${e.id}">${esc(e.full_name)}</option>`
              ).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem;">
              <input type="checkbox" id="lb-all-time" onchange="window.__app.loadLaporanBon()" />
              Semua Waktu
            </label>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="lb-summary-cards" class="mb-16"
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
      </div>

      <!-- Tabel Ringkasan -->
      <div class="card mb-16" id="lb-container">
        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>
      </div>

      <!-- Detail Transaksi (muncul saat klik baris) -->
      <div class="card" id="lb-detail-container" style="display:none;">
        <div class="card-header" style="justify-content:space-between;">
          <div class="card-title" id="lb-detail-title">
            <i class="fas fa-list"></i> Detail Transaksi
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('lb-detail-container').style.display='none'">
            <i class="fas fa-times"></i> Tutup
          </button>
        </div>
        <div id="lb-detail-content"></div>
      </div>
    </div>

    <script>window.__app.loadLaporanBon();</script>

    <style>
      @media print {
        body { background: white !important; }
        .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        button { display: none !important; }
      }
    </style>
  `;
}

export async function loadLaporanBon() {
  const container = document.getElementById('lb-container');
  const cardsEl   = document.getElementById('lb-summary-cards');
  if (!container) return;

  const month      = document.getElementById('lb-month')?.value || null;
  const employeeId = document.getElementById('lb-employee')?.value || null;
  const allTime    = document.getElementById('lb-all-time')?.checked || false;

  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>';
  if (cardsEl) cardsEl.innerHTML = '';

  // Sembunyikan detail saat reload
  const detailEl = document.getElementById('lb-detail-container');
  if (detailEl) detailEl.style.display = 'none';

  try {
    const { data, error } = await supabase.rpc('get_rekap_bon', {
      p_employee_id: employeeId || null,
      p_bulan:       allTime ? null : (month || null),
    });
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data bon.</p></div>';
      return;
    }

    window.__laporanBonData = { data, filters: { month: allTime ? null : month, employeeId } };

    // Totals
    const totalHutang  = data.reduce((s, r) => s + Number(r.saldo_hutang), 0);
    const totalPinjam  = data.reduce((s, r) => s + Number(r.total_pinjam), 0);
    const totalBayar   = data.reduce((s, r) => s + Number(r.total_bayar), 0);
    const adaHutang    = data.filter(r => Number(r.saldo_hutang) > 0).length;

    // Summary cards
    if (cardsEl) {
      cardsEl.innerHTML = [
        { label: 'Total Karyawan Berhutang', value: adaHutang + ' orang',  icon: 'fa-user-times',    color: 'var(--danger)' },
        { label: 'Total Saldo Hutang',        value: fmtIdr(totalHutang),   icon: 'fa-exclamation-circle', color: 'var(--danger)' },
        { label: 'Total Pinjam (periode)',    value: fmtIdr(totalPinjam),   icon: 'fa-arrow-down',    color: 'var(--warning)' },
        { label: 'Total Bayar (periode)',     value: fmtIdr(totalBayar),    icon: 'fa-arrow-up',      color: 'var(--success)' },
      ].map(c => `
        <div class="card" style="padding:14px 16px;border-left:4px solid ${c.color};">
          <div class="text-xs text-secondary mb-4"><i class="fas ${c.icon}"></i> ${c.label}</div>
          <div class="fw-bold" style="font-size:1rem;color:${c.color};">${c.value}</div>
        </div>
      `).join('');
    }

    // Tabel ringkasan
    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Jabatan</th>
              <th class="text-right">Saldo Hutang</th>
              <th class="text-right">Pinjam (periode)</th>
              <th class="text-right">Bayar (periode)</th>
              <th class="text-right">Jml Transaksi</th>
              <th class="text-right">Transaksi Terakhir</th>
              <th class="text-center">Detail</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => {
              const hutangColor = Number(r.saldo_hutang) > 0 ? 'color:var(--danger);' : 'color:var(--success);';
              return `
              <tr>
                <td class="fw-bold">${esc(r.full_name)}</td>
                <td class="text-xs text-secondary">${esc(r.jabatan || '-')}</td>
                <td class="text-right fw-bold" style="${hutangColor}">${fmtIdr(r.saldo_hutang)}</td>
                <td class="text-right">${fmtIdr(r.total_pinjam)}</td>
                <td class="text-right">${fmtIdr(r.total_bayar)}</td>
                <td class="text-right">${r.jumlah_transaksi}</td>
                <td class="text-right text-xs text-secondary">
                  ${r.transaksi_terakhir ? new Date(r.transaksi_terakhir).toLocaleDateString('id-ID') : '-'}
                </td>
                <td class="text-center">
                  <button class="btn btn-ghost btn-sm"
                    onclick="window.__app.loadDetailBon('${r.employee_id}', '${esc(r.full_name)}')">
                    <i class="fas fa-list"></i>
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;background:var(--bg-hover);">
              <td colspan="2">TOTAL</td>
              <td class="text-right text-danger">${fmtIdr(totalHutang)}</td>
              <td class="text-right">${fmtIdr(totalPinjam)}</td>
              <td class="text-right">${fmtIdr(totalBayar)}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

/** Load detail transaksi bon per karyawan */
export async function loadDetailBon(employeeId, employeeName) {
  const detailEl  = document.getElementById('lb-detail-container');
  const titleEl   = document.getElementById('lb-detail-title');
  const contentEl = document.getElementById('lb-detail-content');
  if (!detailEl || !contentEl) return;

  detailEl.style.display = 'block';
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-list"></i> Detail Transaksi — ${esc(employeeName)}`;
  contentEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';

  // Scroll ke detail
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const { data, error } = await supabase
      .from('bon_transactions')
      .select('type, amount, balance_after, description, created_at, projects(name)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    if (!data || data.length === 0) {
      contentEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada transaksi.</p></div>';
      return;
    }

    contentEl.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Proyek</th>
              <th>Keterangan</th>
              <th class="text-right">Jumlah</th>
              <th class="text-right">Saldo Setelah</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(t => {
              const isPinjam = t.type === 'pinjam';
              return `
              <tr>
                <td class="text-xs">${new Date(t.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</td>
                <td>
                  <span class="badge ${isPinjam ? 'badge-danger' : 'badge-success'}">
                    ${isPinjam ? 'Pinjam' : 'Bayar'}
                  </span>
                </td>
                <td class="text-xs">${esc(t.projects?.name || '-')}</td>
                <td class="text-xs">${esc(t.description || '-')}</td>
                <td class="text-right fw-bold ${isPinjam ? 'text-danger' : 'text-success'}">
                  ${isPinjam ? '+' : '-'}${fmtIdr(t.amount)}
                </td>
                <td class="text-right">${fmtIdr(t.balance_after)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    contentEl.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

export function exportLaporanBon() {
  const stored = window.__laporanBonData;
  if (!stored?.data?.length) {
    showToast('Silakan muat data terlebih dahulu', 'error');
    return;
  }
  exportLaporanBonExcel(stored.data, stored.filters);
}
