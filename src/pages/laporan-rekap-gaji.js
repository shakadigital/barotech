import { fmtIdr, esc, showToast } from '../lib/helpers.js';
import { supabase } from '../lib/supabase.js';
import { exportRekapGajiExcel } from '../lib/excel-export.js';

/**
 * Rekap Gaji Lengkap — RPC-based
 * Menggabungkan attendance_logs + overtime_logs per karyawan
 */
export function LaporanRekapGajiPage(state) {
  const { user, employees, projects } = state;

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
            <i class="fas fa-money-bill-wave"></i> Rekap Gaji Lengkap
          </h1>
          <div class="text-xs text-secondary">Gaji pokok + tunjangan + lembur − kasbon per karyawan</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success" onclick="window.__app.exportRekapGaji()">
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
            <input type="month" class="form-input" id="rg-month"
              value="${defaultMonth}" onchange="window.__app.loadRekapGaji()" />
          </div>
          <div>
            <label class="form-label">Karyawan</label>
            <select class="form-select" id="rg-employee" onchange="window.__app.loadRekapGaji()">
              <option value="">Semua Karyawan</option>
              ${employees.filter(e => e.role === 'karyawan').map(e =>
                `<option value="${e.id}">${esc(e.full_name)}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Proyek</label>
            <select class="form-select" id="rg-project" onchange="window.__app.loadRekapGaji()">
              <option value="">Semua Proyek</option>
              ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="rg-summary-cards" class="mb-16"
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
      </div>

      <!-- Tabel -->
      <div class="card" id="rg-container">
        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>
      </div>
    </div>

    <script>window.__app.loadRekapGaji();</script>

    <style>
      @media print {
        body { background: white !important; }
        .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        button { display: none !important; }
      }
    </style>
  `;
}

export async function loadRekapGaji() {
  const container = document.getElementById('rg-container');
  const cardsEl   = document.getElementById('rg-summary-cards');
  if (!container) return;

  const month      = document.getElementById('rg-month')?.value || null;
  const employeeId = document.getElementById('rg-employee')?.value || null;
  const projectId  = document.getElementById('rg-project')?.value || null;

  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>';
  if (cardsEl) cardsEl.innerHTML = '';

  try {
    const { data, error } = await supabase.rpc('get_rekap_gaji_lengkap', {
      p_employee_id: employeeId || null,
      p_project_id:  projectId  || null,
      p_bulan:       month      || null,
    });
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data untuk filter ini.</p></div>';
      return;
    }

    window.__rekapGajiData = { data, filters: { month, employeeId, projectId } };

    // Totals
    const totHari    = data.reduce((s, r) => s + Number(r.hari_kerja), 0);
    const totGaji    = data.reduce((s, r) => s + Number(r.total_gaji_pokok), 0);
    const totMakan   = data.reduce((s, r) => s + Number(r.total_uang_makan), 0);
    const totTransp  = data.reduce((s, r) => s + Number(r.total_transport), 0);
    const totTunj    = data.reduce((s, r) => s + Number(r.total_tunjangan), 0);
    const totLembur  = data.reduce((s, r) => s + Number(r.total_lembur_att) + Number(r.total_lembur_ot), 0);
    const totKasbon  = data.reduce((s, r) => s + Number(r.total_kasbon), 0);
    const totBersih  = data.reduce((s, r) => s + Number(r.total_bersih), 0);

    // Summary cards
    if (cardsEl) {
      cardsEl.innerHTML = [
        { label: 'Total Karyawan', value: data.length + ' orang',  icon: 'fa-users',        color: 'var(--primary)',  raw: false },
        { label: 'Total Hari Kerja', value: totHari + ' hari',     icon: 'fa-calendar-check',color: 'var(--info, #3b82f6)', raw: false },
        { label: 'Total Gaji Pokok', value: fmtIdr(totGaji),       icon: 'fa-wallet',        color: 'var(--warning)' },
        { label: 'Total Lembur',     value: fmtIdr(totLembur),     icon: 'fa-clock',         color: 'var(--secondary, #6b7280)' },
        { label: 'Total Kasbon',     value: fmtIdr(totKasbon),     icon: 'fa-minus-circle',  color: 'var(--danger)' },
        { label: 'Total Bersih',     value: fmtIdr(totBersih),     icon: 'fa-check-circle',  color: 'var(--success)' },
      ].map(c => `
        <div class="card" style="padding:14px 16px;border-left:4px solid ${c.color};">
          <div class="text-xs text-secondary mb-4"><i class="fas ${c.icon}"></i> ${c.label}</div>
          <div class="fw-bold" style="font-size:1rem;color:${c.color};">${c.value}</div>
        </div>
      `).join('');
    }

    // Tabel
    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Jabatan</th>
              <th class="text-right">Hari</th>
              <th class="text-right">Gaji Pokok</th>
              <th class="text-right">Uang Makan</th>
              <th class="text-right">Transport</th>
              <th class="text-right">Tunjangan</th>
              <th class="text-right">Lembur</th>
              <th class="text-right">Kasbon</th>
              <th class="text-right" style="background:var(--bg-hover);">Total Bersih</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => `
              <tr>
                <td class="fw-bold">${esc(r.full_name)}</td>
                <td class="text-xs text-secondary">${esc(r.jabatan || '-')}</td>
                <td class="text-right">${r.hari_kerja}</td>
                <td class="text-right">${fmtIdr(r.total_gaji_pokok)}</td>
                <td class="text-right">${fmtIdr(r.total_uang_makan)}</td>
                <td class="text-right">${fmtIdr(r.total_transport)}</td>
                <td class="text-right">${fmtIdr(r.total_tunjangan)}</td>
                <td class="text-right">${fmtIdr(Number(r.total_lembur_att) + Number(r.total_lembur_ot))}</td>
                <td class="text-right text-danger">${fmtIdr(r.total_kasbon)}</td>
                <td class="text-right fw-bold text-success" style="background:var(--bg-hover);">
                  ${fmtIdr(r.total_bersih)}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;background:var(--bg-hover);">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${totHari}</td>
              <td class="text-right">${fmtIdr(totGaji)}</td>
              <td class="text-right">${fmtIdr(totMakan)}</td>
              <td class="text-right">${fmtIdr(totTransp)}</td>
              <td class="text-right">${fmtIdr(totTunj)}</td>
              <td class="text-right">${fmtIdr(totLembur)}</td>
              <td class="text-right text-danger">${fmtIdr(totKasbon)}</td>
              <td class="text-right text-success">${fmtIdr(totBersih)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Gagal: ${esc(err.message)}</p></div>`;
  }
}

export function exportRekapGaji() {
  const stored = window.__rekapGajiData;
  if (!stored?.data?.length) {
    showToast('Silakan muat data terlebih dahulu', 'error');
    return;
  }
  exportRekapGajiExcel(stored.data, stored.filters);
}
