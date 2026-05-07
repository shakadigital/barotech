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
            <label class="form-label">Periode</label>
            <div class="flex gap-8 mb-8">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.875rem;">
                <input type="radio" name="rp-period-type" value="monthly" checked
                  onchange="window.__app.togglePeriodType()" />
                <span>Per Bulan</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.875rem;">
                <input type="radio" name="rp-period-type" value="cumulative"
                  onchange="window.__app.togglePeriodType()" />
                <span>Total Akumulatif</span>
              </label>
            </div>
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

/** Toggle period type */
export function togglePeriodType() {
  const monthInput = document.getElementById('rp-month');
  const periodType = document.querySelector('input[name="rp-period-type"]:checked')?.value;
  
  if (monthInput) {
    monthInput.disabled = (periodType === 'cumulative');
    if (periodType === 'cumulative') {
      monthInput.style.opacity = '0.5';
    } else {
      monthInput.style.opacity = '1';
    }
  }
  
  window.__app.loadRekapProyek();
}

/** Load rekap via RPC, render tabel + summary cards */
export async function loadRekapProyek() {
  const container   = document.getElementById('rp-container');
  const cardsEl     = document.getElementById('rp-summary-cards');
  if (!container) return;

  const month      = document.getElementById('rp-month')?.value || '';
  const projectId  = document.getElementById('rp-project')?.value || '';
  const periodType = document.querySelector('input[name="rp-period-type"]:checked')?.value || 'monthly';
  const isCumulative = periodType === 'cumulative';

  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat data...</p></div>';
  if (cardsEl) cardsEl.innerHTML = '';

  try {
    // Panggil RPC — kalkulasi berat dilakukan di PostgreSQL
    const params = {
      p_project_id: projectId || null,
      p_bulan:      isCumulative ? null : (month || null),
    };

    const { data, error } = await supabase.rpc('get_rekap_biaya_proyek', params);
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada data untuk filter ini.</p></div>';
      return;
    }

    // Fetch project budget info untuk alert
    const projectIds = data.map(r => r.project_id).filter(Boolean);
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name, budget_limit, budget_alert_threshold')
      .in('id', projectIds);
    
    const projectBudgets = {};
    projectsData?.forEach(p => {
      projectBudgets[p.id] = {
        limit: p.budget_limit || 0,
        threshold: p.budget_alert_threshold || 0.8
      };
    });

    // Simpan untuk export
    window.__rekapProyekData = { 
      data, 
      filters: { month: isCumulative ? null : month, projectId, periodType },
      projectBudgets
    };

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

    // Budget alert helper
    const getBudgetAlert = (projectId, grandTotal) => {
      const budget = projectBudgets[projectId];
      if (!budget || budget.limit === 0) return '';
      
      const percentage = (grandTotal / budget.limit) * 100;
      const threshold = budget.threshold * 100;
      
      let color, icon, text;
      if (percentage >= 90) {
        color = 'var(--danger)';
        icon = 'fa-exclamation-triangle';
        text = `⚠️ ${percentage.toFixed(1)}% dari budget`;
      } else if (percentage >= threshold) {
        color = 'var(--warning)';
        icon = 'fa-exclamation-circle';
        text = `⚠ ${percentage.toFixed(1)}% dari budget`;
      } else {
        color = 'var(--success)';
        icon = 'fa-check-circle';
        text = `✓ ${percentage.toFixed(1)}% dari budget`;
      }
      
      return `
        <div style="margin-top:4px;font-size:0.75rem;color:${color};">
          <i class="fas ${icon}"></i> ${text} (Limit: ${fmtIdr(budget.limit)})
        </div>`;
    };

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;"></th>
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
            ${data.map((r, idx) => `
              <tr>
                <td>
                  <button class="btn btn-ghost btn-sm" 
                    onclick="window.__app.toggleProjectBreakdown('${r.project_id}')"
                    title="Lihat Detail">
                    <i class="fas fa-chevron-down" id="chevron-${r.project_id}"></i>
                  </button>
                </td>
                <td>
                  <div class="fw-bold">${esc(r.project_name)}</div>
                  ${getBudgetAlert(r.project_id, r.grand_total)}
                </td>
                <td>${statusBadge(r.project_status)}</td>
                <td class="text-right">${fmtIdr(r.total_gaji)}</td>
                <td class="text-right">${fmtIdr(r.total_lembur)}</td>
                <td class="text-right">${fmtIdr(r.total_material)}</td>
                <td class="text-right">${fmtIdr(r.total_pengeluaran)}</td>
                <td class="text-right fw-bold text-success" style="background:var(--bg-hover);">
                  ${fmtIdr(r.grand_total)}
                </td>
              </tr>
              <tr id="breakdown-${r.project_id}" style="display:none;">
                <td colspan="8" style="background:var(--bg-secondary,#f9fafb);padding:16px;">
                  <div class="text-xs fw-bold mb-12">📊 Breakdown Detail - ${esc(r.project_name)}</div>
                  <div id="breakdown-content-${r.project_id}">
                    <div class="text-center text-secondary py-16">
                      <i class="fas fa-spinner fa-spin"></i> Memuat detail...
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;background:var(--bg-hover);">
              <td colspan="3">TOTAL KESELURUHAN</td>
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

/** Toggle project breakdown detail */
export async function toggleProjectBreakdown(projectId) {
  const row = document.getElementById(`breakdown-${projectId}`);
  const chevron = document.getElementById(`chevron-${projectId}`);
  const content = document.getElementById(`breakdown-content-${projectId}`);
  
  if (!row) return;
  
  if (row.style.display === 'none') {
    // Show and load data
    row.style.display = 'table-row';
    if (chevron) chevron.className = 'fas fa-chevron-up';
    
    // Load breakdown detail
    await loadProjectBreakdown(projectId, content);
  } else {
    // Hide
    row.style.display = 'none';
    if (chevron) chevron.className = 'fas fa-chevron-down';
  }
}

/** Load detailed breakdown for a project */
async function loadProjectBreakdown(projectId, contentEl) {
  if (!contentEl) return;
  
  try {
    const month = document.getElementById('rp-month')?.value || '';
    const periodType = document.querySelector('input[name="rp-period-type"]:checked')?.value || 'monthly';
    const isCumulative = periodType === 'cumulative';
    
    // Query materials
    const materialsQuery = supabase
      .from('materials')
      .select('item_name, quantity, unit_price, total_price, created_at')
      .eq('project_id', projectId);
    
    if (!isCumulative && month) {
      const [year, mon] = month.split('-');
      const startDate = `${year}-${mon}-01`;
      const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().slice(0, 10);
      materialsQuery.gte('created_at', startDate).lte('created_at', endDate + ' 23:59:59');
    }
    
    const { data: materials } = await materialsQuery;
    
    // Query expenses
    const expensesQuery = supabase
      .from('expenses')
      .select('item_name, amount, description, created_at')
      .eq('project_id', projectId);
    
    if (!isCumulative && month) {
      const [year, mon] = month.split('-');
      const startDate = `${year}-${mon}-01`;
      const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().slice(0, 10);
      expensesQuery.gte('created_at', startDate).lte('created_at', endDate + ' 23:59:59');
    }
    
    const { data: expenses } = await expensesQuery;
    
    // Query attendance (for salary breakdown)
    const attendanceQuery = supabase
      .from('attendance_logs')
      .select('employee_id, basic_salary, overtime_pay, profiles!inner(full_name)')
      .eq('project_id', projectId)
      .in('status', ['hadir', 'verified']);
    
    if (!isCumulative && month) {
      const [year, mon] = month.split('-');
      const startDate = `${year}-${mon}-01`;
      const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().slice(0, 10);
      attendanceQuery.gte('created_at', startDate).lte('created_at', endDate + ' 23:59:59');
    }
    
    const { data: attendance } = await attendanceQuery;
    
    // Group salary by employee
    const salaryByEmployee = {};
    attendance?.forEach(a => {
      if (!salaryByEmployee[a.employee_id]) {
        salaryByEmployee[a.employee_id] = {
          name: a.profiles.full_name,
          salary: 0,
          overtime: 0
        };
      }
      salaryByEmployee[a.employee_id].salary += (a.basic_salary || 0);
      salaryByEmployee[a.employee_id].overtime += (a.overtime_pay || 0);
    });
    
    const salaryList = Object.values(salaryByEmployee);
    
    // Render breakdown
    const totalMaterial = materials?.reduce((sum, m) => sum + (m.total_price || 0), 0) || 0;
    const totalExpense = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const totalSalary = salaryList.reduce((sum, s) => sum + s.salary, 0);
    const totalOvertime = salaryList.reduce((sum, s) => sum + s.overtime, 0);
    
    contentEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;">
        
        <!-- Material -->
        <div>
          <div class="fw-bold mb-8" style="color:var(--info,#3b82f6);">
            <i class="fas fa-box"></i> Material (${fmtIdr(totalMaterial)})
          </div>
          ${materials && materials.length > 0 ? `
            <div style="max-height:200px;overflow-y:auto;font-size:0.8rem;">
              ${materials.map(m => `
                <div style="padding:4px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;">
                  <span>${esc(m.item_name)} (${m.quantity} ${esc(m.unit_price ? 'x ' + fmtIdr(m.unit_price) : '')})</span>
                  <span class="fw-bold">${fmtIdr(m.total_price)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-xs text-secondary">Tidak ada data material</div>'}
        </div>
        
        <!-- Pengeluaran Umum -->
        <div>
          <div class="fw-bold mb-8" style="color:var(--danger);">
            <i class="fas fa-receipt"></i> Pengeluaran Umum (${fmtIdr(totalExpense)})
          </div>
          ${expenses && expenses.length > 0 ? `
            <div style="max-height:200px;overflow-y:auto;font-size:0.8rem;">
              ${expenses.map(e => `
                <div style="padding:4px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;">
                  <span>${esc(e.item_name)}${e.description ? ` (${esc(e.description)})` : ''}</span>
                  <span class="fw-bold">${fmtIdr(e.amount)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-xs text-secondary">Tidak ada data pengeluaran</div>'}
        </div>
        
        <!-- Gaji Karyawan -->
        <div>
          <div class="fw-bold mb-8" style="color:var(--primary);">
            <i class="fas fa-users"></i> Gaji Karyawan (${fmtIdr(totalSalary + totalOvertime)})
          </div>
          ${salaryList.length > 0 ? `
            <div style="max-height:200px;overflow-y:auto;font-size:0.8rem;">
              ${salaryList.map(s => `
                <div style="padding:4px 0;border-bottom:1px solid var(--border);">
                  <div style="display:flex;justify-content:space-between;">
                    <span class="fw-bold">${esc(s.name)}</span>
                    <span class="fw-bold">${fmtIdr(s.salary + s.overtime)}</span>
                  </div>
                  ${s.overtime > 0 ? `
                    <div class="text-xs text-secondary" style="margin-top:2px;">
                      Gaji: ${fmtIdr(s.salary)} + Lembur: ${fmtIdr(s.overtime)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-xs text-secondary">Tidak ada data gaji</div>'}
        </div>
        
      </div>
    `;
    
  } catch (err) {
    contentEl.innerHTML = `<div class="text-danger text-xs">Gagal memuat detail: ${esc(err.message)}</div>`;
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
