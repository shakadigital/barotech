import { fmtIdr, esc, showToast } from '../lib/helpers.js';
import { supabase } from '../lib/supabase.js';
import { exportRekapProyekExcel } from '../lib/excel-export.js';

/**
 * Rekap Biaya Proyek — Admin/Owner/Superadmin only
 * Menggunakan RPC get_rekap_biaya_proyek untuk kalkulasi di sisi DB
 */
export function RekapProyekPage(state) {
  const { user, projects } = state;

  if (!['superadmin', 'owner', 'admin'].includes(user.role)) {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i>
      <p>Halaman ini hanya dapat diakses oleh admin/owner/superadmin.</p>
    </div></div>`;
  }

  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);

  return `
    <div class="fade-in" style="padding:20px;max-width:1200px;margin:0 auto;">

      <!-- Header -->
      <div class="mb-16" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h1 class="fw-bold" style="font-size:1.5rem;margin:0;">
            <i class="fas fa-chart-pie"></i> Rekap Biaya Proyek
          </h1>
          <div class="text-xs text-secondary">Total biaya per proyek: gaji + lembur + material + pengeluaran</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success" onclick="window.__app.exportRekapProyek()">
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
            <label class="form-label">Bulan</label>
            <input type="month" class="form-input" id="rp-month"
              value="${defaultMonth}"
              onchange="window.__app.loadRekapProyek()" />
          </div>
          <div>
            <label class="form-label">Proyek</label>
            <select class="form-select" id="rp-project"
              onchange="window.__app.loadRekapProyek()">
              <option value="">Semua Proyek</option>
              ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem;">
              <input type="checkbox" id="rp-all-time"
                onchange="window.__app.loadRekapProyek()" />
              Semua Waktu (abaikan filter bulan)
            </label>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="rp-summary-cards" class="mb-16" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        <!-- diisi oleh loadRekapProyek -->
      </div>

      <!-- Tabel Rekap -->
      <div class="card" id="rp-container">
        <div class="empty-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Memuat data...</p>
        </div>
      </div>

    </div>

    <script>
      window.__app.loadRekapProyek();
    </script>

    <style>
      @media print {
        body { background: white !important; }
        .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        button { display: none !important; }
        select, input { border: 1px solid #ddd !important; }
      }
    </style>
  `;
}

/** Load rekap via RPC, render tabel + summary cards */
export async function loadRekapProyek() {
  const container   = document.getElementById('rp-container');
  const cardsEl     = document.getElementById('rp-summary-cards');
  if (!container) return;

  const month     = document.getElementById('rp-month')?.value || '';
  const projectId = document.getElementById('rp-project')?.value || '';
  const allTime   = document.getElementById('rp-all-time')?.checked || false;

  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>';
  if (cardsEl) cardsEl.innerHTML = '';

  try {
    // Panggil RPC — kalkulasi berat dilakukan di PostgreSQL
    const params = {
      p_project_id: projectId || null,
      p_bulan:      allTime ? null : (month || null),
    };

    const { data, error } = await supabase.rpc('get_rekap_biaya_proyek', params);
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data untuk filter ini.</p></div>';
      return;
    }

    // Simpan untuk export
    window.__rekapProyekData = { data, filters: { month: allTime ? null : month, projectId } };

    // Hitung grand total semua proyek
    const totalGaji        = data.reduce((s, r) => s + Number(r.total_gaji), 0);
    const totalLembur      = data.reduce((s, r) => s + Number(r.total_lembur), 0);
    const totalMaterial    = data.reduce((s, r) => s + Number(r.total_material), 0);
    const totalPengeluaran = data.reduce((s, r) => s + Number(r.total_pengeluaran), 0);
    const grandTotal       = data.reduce((s, r) => s + Number(r.grand_total), 0);

    // Render summary cards
    if (cardsEl) {
      cardsEl.innerHTML = [
        { label: 'Total Gaji',        value: totalGaji,        icon: 'fa-users',        color: 'var(--primary)' },
        { label: 'Total Lembur',      value: totalLembur,      icon: 'fa-clock',        color: 'var(--warning)' },
        { label: 'Total Material',    value: totalMaterial,    icon: 'fa-box',          color: 'var(--info, #3b82f6)' },
        { label: 'Total Pengeluaran', value: totalPengeluaran, icon: 'fa-receipt',      color: 'var(--danger)' },
        { label: 'Grand Total',       value: grandTotal,       icon: 'fa-chart-pie',    color: 'var(--success)' },
      ].map(c => `
        <div class="card" style="padding:14px 16px;border-left:4px solid ${c.color};">
          <div class="text-xs text-secondary mb-4"><i class="fas ${c.icon}"></i> ${c.label}</div>
          <div class="fw-bold" style="font-size:1.05rem;color:${c.color};">${fmtIdr(c.value)}</div>
        </div>
      `).join('');
    }

    // Render tabel
    const statusBadge = s => {
      const map = { aktif: 'badge-success', selesai: 'badge-secondary', pending: 'badge-warning' };
      return `<span class="badge ${map[s] || 'badge-secondary'}">${esc(s)}</span>`;
    };

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Proyek</th>
              <th>Status</th>
              <th class="text-right">Gaji Karyawan</th>
              <th class="text-right">Lembur</th>
              <th class="text-right">Material</th>
              <th class="text-right">Pengeluaran</th>
              <th class="text-right" style="background:var(--bg-hover);">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => `
              <tr>
                <td class="fw-bold">${esc(r.project_name)}</td>
                <td>${statusBadge(r.project_status)}</td>
                <td class="text-right">${fmtIdr(r.total_gaji)}</td>
                <td class="text-right">${fmtIdr(r.total_lembur)}</td>
                <td class="text-right">${fmtIdr(r.total_material)}</td>
                <td class="text-right">${fmtIdr(r.total_pengeluaran)}</td>
                <td class="text-right fw-bold text-success" style="background:var(--bg-hover);">
                  ${fmtIdr(r.grand_total)}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;background:var(--bg-hover);">
              <td colspan="2">TOTAL KESELURUHAN</td>
              <td class="text-right">${fmtIdr(totalGaji)}</td>
              <td class="text-right">${fmtIdr(totalLembur)}</td>
              <td class="text-right">${fmtIdr(totalMaterial)}</td>
              <td class="text-right">${fmtIdr(totalPengeluaran)}</td>
              <td class="text-right text-success" style="background:var(--bg-hover);">${fmtIdr(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

/** Export rekap proyek ke Excel */
export function exportRekapProyek() {
  const stored = window.__rekapProyekData;
  if (!stored || !stored.data?.length) {
    showToast('Silakan muat data terlebih dahulu', 'error');
    return;
  }
  exportRekapProyekExcel(stored.data, stored.filters);
}
