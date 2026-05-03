import { supabase } from '../lib/supabase.js';
import { fmtIdr, fmtDate, showToast, esc } from '../lib/helpers.js';

const CAT_LABELS = {
  material:     'Material',
  operasional:  'Operasional',
  jasa:         'Jasa',
  lainnya:      'Lainnya',
};

/**
 * Halaman Pengeluaran Proyek — Admin / Owner / Superadmin
 */
export function ExpensePage(state) {
  const { projects, user } = state;
  const role = user.role;
  const isAdmin = ['superadmin','owner','admin'].includes(role);

  if (!isAdmin) {
    return `<div class="fade-in"><div class="empty-state">
      <i class="fas fa-lock"></i>
      <p>Halaman ini hanya dapat diakses oleh Admin.</p>
    </div></div>`;
  }

  const activeProjects = projects.filter(p => p.status === 'aktif');

  return `
    <div class="fade-in">
      <!-- Form Input Pengeluaran -->
      <div class="card mb-24">
        <div class="card-header" style="justify-content:space-between;cursor:pointer;" onclick="const p=document.getElementById('expense-form-body'),i=document.getElementById('expense-form-chevron');p.style.display=p.style.display==='none'?'block':'none';i.style.transform=p.style.display==='none'?'rotate(0deg)':'rotate(180deg)';">
          <div class="card-title"><i class="fas fa-receipt"></i> Input Pengeluaran Proyek</div>
          <i id="expense-form-chevron" class="fas fa-chevron-down" style="transition:transform 0.2s ease;"></i>
        </div>
        <div id="expense-form-body" style="display:none;">
        <form id="expense-form" onsubmit="window.__app.handleExpenseSubmit(event)">
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Proyek</label>
              <select class="form-select" id="exp-project" required>
                <option value="">Pilih Proyek</option>
                ${activeProjects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal</label>
              <input type="date" class="form-input" id="exp-date"
                value="${new Date().toISOString().slice(0,10)}" required />
            </div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select class="form-select" id="exp-category" required>
                <option value="material">Material</option>
                <option value="operasional">Operasional</option>
                <option value="jasa">Jasa</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Jumlah (Rp)</label>
              <input type="number" class="form-input" id="exp-amount" min="0" required placeholder="0" />
            </div>
          </div>
          <div class="form-group mb-16">
            <label class="form-label">Deskripsi</label>
            <input type="text" class="form-input" id="exp-desc"
              placeholder="Contoh: Pembayaran sewa alat, beli semen, dll" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="exp-submit-btn">
            <i class="fas fa-save"></i> Simpan Pengeluaran
          </button>
        </form>
        </div>
      </div>

      <!-- Daftar Pengeluaran per Proyek -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-chart-bar"></i> Rekap Pengeluaran per Proyek</div>
        </div>

        <!-- Filter -->
        <div class="form-row mb-16" style="padding:0 16px 8px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Bulan</label>
            <input type="month" class="form-input" id="exp-filter-month"
              value="${new Date().toISOString().slice(0,7)}"
              onchange="window.__app.loadFilteredExpenses?.()" />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Proyek</label>
            <select class="form-select" id="exp-filter-project"
              onchange="window.__app.loadFilteredExpenses?.()">
              <option value="">Semua Proyek</option>
              ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="expense-list">
          <div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>
        </div>
      </div>
    </div>`;
}

/** Load daftar pengeluaran (dengan filter opsional) */
export async function loadExpenseList(state, containerId = 'expense-list', opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    let q = supabase
      .from('project_expenses')
      .select('*, projects(name), profiles:recorded_by(full_name)')
      .order('expense_date', { ascending: false });

    if (opts.month) {
      const [y, m] = opts.month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      q = q.gte('expense_date', start).lte('expense_date', end);
    }
    if (opts.projectId) {
      q = q.eq('project_id', opts.projectId);
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada pengeluaran.</p></div>';
      return;
    }
    const isDeleter = ['superadmin','owner'].includes(state.user.role);

    el.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Proyek</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Jumlah</th>
              <th>Total Akumulasi</th>
              <th>Oleh</th>
              ${isDeleter ? '<th class="text-center">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.map(x => {
              return `<tr>
                <td class="text-xs">${fmtDate(x.expense_date)}</td>
                <td class="text-xs">${esc(x.projects?.name || '-')}</td>
                <td class="text-xs">${CAT_LABELS[x.category] || x.category}</td>
                <td>${esc(x.description)}</td>
                <td class="fw-bold">${fmtIdr(x.amount)}</td>
                <td class="fw-bold text-primary">${fmtIdr(x.running_total)}</td>
                <td class="text-xs">${esc(x.profiles?.full_name || '-')}</td>
                ${isDeleter ? `<td class="text-center">
                  <button class="btn btn-danger btn-sm"
                    onclick="window.__app.deleteExpense('${x.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                  </button>
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

/** Load ringkasan pengeluaran per proyek */
export async function loadExpenseSummary(projects, containerId = 'expense-summary') {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const { data, error } = await supabase
      .rpc('get_project_total_expense');
    if (error) throw error;

    el.innerHTML = projects.map(p => {
      const total = (data && data[p.id]) || 0;
      return `<div class="card mb-8" style="padding:10px 14px;">
        <div class="flex justify-between align-center">
          <span class="fw-bold">${esc(p.name)}</span>
          <span class="fw-bold text-primary">${fmtIdr(total)}</span>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<p class="text-xs text-secondary">Gagal memuat ringkasan: ${esc(e.message)}</p>`;
  }
}

/** Submit form pengeluaran */
export async function handleExpenseSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('exp-submit-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      project_id:   document.getElementById('exp-project').value,
      expense_date: document.getElementById('exp-date').value,
      category:     document.getElementById('exp-category').value,
      amount:       Number(document.getElementById('exp-amount').value),
      description:  document.getElementById('exp-desc').value.trim(),
      recorded_by:  user.id,
    };
    const { error } = await supabase.from('project_expenses').insert(payload);
    if (error) throw error;
    showToast('Pengeluaran tersimpan ✓', 'success');
    document.getElementById('expense-form').reset();
    document.getElementById('exp-date').value = new Date().toISOString().slice(0,10);
    window.__app.refreshPage?.();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan Pengeluaran';
  }
}

/** Delete expense */
export async function deleteExpense(id) {
  if (!confirm('Yakin hapus pengeluaran ini?')) return;
  try {
    const { error } = await supabase.from('project_expenses').delete().eq('id', id);
    if (error) throw error;
    showToast('Pengeluaran dihapus ✓', 'success');
    window.__app.refreshPage?.();
  } catch (e) {
    showToast('Gagal: ' + e.message, 'error');
  }
}
