import { supabase } from '../lib/supabase.js';
import { fmtDate, fmtIdr, esc, showToast } from '../lib/helpers.js';

/**
 * Salary Payment Page
 * Admin/Owner/Superadmin only
 * Fitur:
 * - List karyawan dengan gaji yang belum dibayar
 * - Tandai sudah dibayar (manual reset)
 * - Generate slip gaji (print)
 * - History pembayaran
 */

export function SalaryPaymentPage(state) {
  const { employees, attendanceLogs, user } = state;
  const role = user.role;
  const isAdmin = ['superadmin', 'owner', 'admin'].includes(role);

  if (!isAdmin) {
    return `<div class="empty-state">
      <i class="fas fa-lock"></i>
      <p>Akses ditolak. Halaman ini hanya untuk Admin/Owner/Superadmin.</p>
    </div>`;
  }

  return `
    <div class="fade-in">
      <div class="card mb-16">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-money-bill-wave"></i> Pembayaran Gaji Karyawan</div>
        </div>
        <div class="card-body">
          <!-- Filter Periode -->
          <div class="form-row mb-16">
            <div class="form-group">
              <label class="form-label">Dari Tanggal</label>
              <input type="date" class="form-input" id="salary-period-start" 
                value="${getDefaultPeriodStart()}" />
            </div>
            <div class="form-group">
              <label class="form-label">Sampai Tanggal</label>
              <input type="date" class="form-input" id="salary-period-end" 
                value="${getDefaultPeriodEnd()}" />
            </div>
            <div class="form-group" style="align-self:flex-end;">
              <button class="btn btn-primary" onclick="window.__app.loadUnpaidSalaries()">
                <i class="fas fa-search"></i> Tampilkan
              </button>
            </div>
          </div>

          <!-- Info Banner -->
          <div class="alert alert-info mb-16">
            <i class="fas fa-info-circle"></i>
            Sistem akan menampilkan daftar karyawan dengan gaji yang <strong>belum dibayar</strong> dalam periode yang dipilih.
            Setelah ditandai "Sudah Dibayar", gaji tersebut tidak akan muncul lagi di periode berikutnya.
          </div>

          <!-- Tabel Karyawan -->
          <div id="unpaid-salaries-container">
            <div class="text-center text-muted py-32">
              <i class="fas fa-search"></i>
              <p>Pilih periode dan klik "Tampilkan" untuk melihat daftar gaji yang belum dibayar</p>
            </div>
          </div>
        </div>
      </div>

      <!-- History Pembayaran -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-history"></i> History Pembayaran</div>
        </div>
        <div class="card-body">
          <div id="payment-history-container">
            <div class="text-center text-muted py-32">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Memuat history...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/** Get default period start (tanggal 1 bulan ini) */
function getDefaultPeriodStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Get default period end (hari ini) */
function getDefaultPeriodEnd() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/** Load unpaid salaries untuk periode tertentu */
export async function loadUnpaidSalaries() {
  const startDate = document.getElementById('salary-period-start')?.value;
  const endDate = document.getElementById('salary-period-end')?.value;
  const container = document.getElementById('unpaid-salaries-container');

  if (!startDate || !endDate) {
    showToast('Pilih periode terlebih dahulu', 'warning');
    return;
  }

  container.innerHTML = '<div class="text-center py-32"><i class="fas fa-spinner fa-spin"></i> Memuat data...</div>';

  try {
    // Query attendance yang belum dibayar (payment_id IS NULL)
    const { data: attendances, error } = await supabase
      .from('attendance_logs')
      .select('*, profiles!inner(id, full_name, role)')
      .is('payment_id', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate + ' 23:59:59')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!attendances || attendances.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-check-circle"></i>
          <p>Semua gaji dalam periode ini sudah dibayar!</p>
        </div>`;
      return;
    }

    // Group by employee
    const employeeMap = {};
    attendances.forEach(att => {
      const empId = att.employee_id;
      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          id: empId,
          name: att.profiles.full_name,
          role: att.profiles.role,
          days: 0,
          totalSalary: 0,
          totalOvertime: 0,
          totalDeductions: 0,
          attendances: []
        };
      }
      employeeMap[empId].days++;
      employeeMap[empId].totalSalary += (att.basic_salary || 0);
      employeeMap[empId].totalOvertime += (att.overtime_pay || 0);
      employeeMap[empId].totalDeductions += (att.cash_advance || 0);
      employeeMap[empId].attendances.push(att);
    });

    const employees = Object.values(employeeMap);

    // Render table
    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;"><input type="checkbox" id="select-all-salary" onchange="window.__app.toggleSelectAllSalary(this.checked)" /></th>
              <th>Nama Karyawan</th>
              <th>Hari Kerja</th>
              <th>Gaji Pokok</th>
              <th>Lembur</th>
              <th>Kasbon</th>
              <th>Total Terima</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => {
              const netSalary = emp.totalSalary + emp.totalOvertime - emp.totalDeductions;
              return `
                <tr>
                  <td><input type="checkbox" class="salary-checkbox" data-employee-id="${emp.id}" /></td>
                  <td class="fw-bold">${esc(emp.name)}</td>
                  <td>${emp.days} hari</td>
                  <td>${fmtIdr(emp.totalSalary)}</td>
                  <td>${fmtIdr(emp.totalOvertime)}</td>
                  <td class="text-danger">${fmtIdr(emp.totalDeductions)}</td>
                  <td class="fw-bold text-success">${fmtIdr(netSalary)}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" 
                      onclick="window.__app.openPaymentModal('${emp.id}', '${startDate}', '${endDate}')">
                      <i class="fas fa-money-bill-wave"></i> Bayar
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-16">
        <button class="btn btn-success" onclick="window.__app.paySelectedSalaries('${startDate}', '${endDate}')">
          <i class="fas fa-check"></i> Bayar yang Dipilih
        </button>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

/** Open payment modal untuk 1 karyawan */
export function openPaymentModal(employeeId, startDate, endDate) {
  showToast('Modal pembayaran akan dibuat di iterasi berikutnya', 'info');
  // TODO: Implement modal dengan form payment method, bank, dll
}

/** Pay selected salaries (bulk) */
export function paySelectedSalaries(startDate, endDate) {
  const checkboxes = document.querySelectorAll('.salary-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('Pilih minimal 1 karyawan', 'warning');
    return;
  }
  showToast(`Akan bayar ${checkboxes.length} karyawan (implementasi berikutnya)`, 'info');
  // TODO: Implement bulk payment
}

/** Toggle select all */
export function toggleSelectAllSalary(checked) {
  document.querySelectorAll('.salary-checkbox').forEach(cb => cb.checked = checked);
}

/** Load payment history */
export async function loadPaymentHistory() {
  const container = document.getElementById('payment-history-container');
  
  try {
    const { data: payments, error } = await supabase
      .from('salary_payments')
      .select('*, profiles!salary_payments_employee_id_fkey(full_name)')
      .order('payment_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!payments || payments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>Belum ada history pembayaran</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Karyawan</th>
              <th>Periode</th>
              <th>Total Dibayar</th>
              <th>Metode</th>
              <th>Tanggal Bayar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((p, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="fw-bold">${esc(p.profiles?.full_name || '-')}</td>
                <td>${fmtDate(p.period_start)} - ${fmtDate(p.period_end)}</td>
                <td class="fw-bold">${fmtIdr(p.net_salary)}</td>
                <td><span class="badge">${p.payment_method === 'cash' ? '💵 Cash' : '🏦 Transfer'}</span></td>
                <td>${fmtDate(p.payment_date)}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="window.__app.printSalarySlip('${p.id}')" title="Cetak Slip">
                    <i class="fas fa-print"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

/** Print salary slip */
export function printSalarySlip(paymentId) {
  showToast('Print slip gaji akan dibuat di iterasi berikutnya', 'info');
  // TODO: Implement print slip
}
