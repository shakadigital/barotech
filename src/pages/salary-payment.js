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
      <button class="btn btn-ghost btn-sm mb-16" onclick="window.__app.navigateTo('laporan')" style="padding:6px 12px;">
        <i class="fas fa-arrow-left"></i> Laporan
      </button>
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
          totalUangMakan: 0,
          totalTransport: 0,
          totalTunjangan: 0,
          totalOvertime: 0,
          totalBonus: 0,
          totalDeductions: 0,
          totalPayout: 0,
          attendances: []
        };
      }
      employeeMap[empId].days++;
      employeeMap[empId].totalSalary += (att.basic_salary || 0);
      employeeMap[empId].totalUangMakan += (att.uang_makan || 0);
      employeeMap[empId].totalTransport += (att.transport || 0);
      employeeMap[empId].totalTunjangan += (att.tunjangan_lain || 0);
      employeeMap[empId].totalOvertime += (att.overtime_pay || 0);
      employeeMap[empId].totalBonus += (att.misc_amount || 0);
      employeeMap[empId].totalDeductions += (att.cash_advance || 0);
      employeeMap[empId].totalPayout += (att.cash_payout || 0);
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
              <th>Tunjangan</th>
              <th>Lembur</th>
              <th>Bonus</th>
              <th>Kasbon</th>
              <th>Total Terima</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => {
              const totalTunjangan = emp.totalUangMakan + emp.totalTransport + emp.totalTunjangan;
              const netSalary = emp.totalSalary + totalTunjangan + emp.totalOvertime + emp.totalBonus - emp.totalDeductions + emp.totalPayout;
              return `
                <tr>
                  <td><input type="checkbox" class="salary-checkbox" data-employee-id="${emp.id}" /></td>
                  <td class="fw-bold">${esc(emp.name)}</td>
                  <td>${emp.days} hari</td>
                  <td>${fmtIdr(emp.totalSalary)}</td>
                  <td>
                    ${totalTunjangan > 0 ? `
                    <div class="text-xs">
                      ${emp.totalUangMakan > 0 ? `<div>Makan: ${fmtIdr(emp.totalUangMakan)}</div>` : ''}
                      ${emp.totalTransport > 0 ? `<div>Transport: ${fmtIdr(emp.totalTransport)}</div>` : ''}
                      ${emp.totalTunjangan > 0 ? `<div>Lain: ${fmtIdr(emp.totalTunjangan)}</div>` : ''}
                      <div class="fw-bold">${fmtIdr(totalTunjangan)}</div>
                    </div>` : '-'}
                  </td>
                  <td>${emp.totalOvertime > 0 ? fmtIdr(emp.totalOvertime) : '-'}</td>
                  <td>${emp.totalBonus > 0 ? fmtIdr(emp.totalBonus) : '-'}</td>
                  <td class="text-danger">${emp.totalDeductions > 0 ? fmtIdr(emp.totalDeductions) : '-'}</td>
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
export async function openPaymentModal(employeeId, startDate, endDate) {
  try {
    // Query attendance yang belum dibayar untuk karyawan ini
    const { data: attendances, error } = await supabase
      .from('attendance_logs')
      .select('*, profiles!inner(id, full_name, role, jabatan, bon_balance)')
      .is('payment_id', null)
      .eq('employee_id', employeeId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + ' 23:59:59');

    if (error) throw error;
    if (!attendances || attendances.length === 0) {
      showToast('Tidak ada data gaji untuk karyawan ini', 'warning');
      return;
    }

    // Calculate totals
    const employee = attendances[0].profiles;
    const days = attendances.length;
    const totalSalary = attendances.reduce((sum, a) => sum + (a.basic_salary || 0), 0);
    const totalUangMakan = attendances.reduce((sum, a) => sum + (a.uang_makan || 0), 0);
    const totalTransport = attendances.reduce((sum, a) => sum + (a.transport || 0), 0);
    const totalTunjangan = attendances.reduce((sum, a) => sum + (a.tunjangan_lain || 0), 0);
    const totalOvertime = attendances.reduce((sum, a) => sum + (a.overtime_pay || 0), 0);
    const totalBonus = attendances.reduce((sum, a) => sum + (a.misc_amount || 0), 0);
    const totalDeductions = attendances.reduce((sum, a) => sum + (a.cash_advance || 0), 0);
    const totalPayout = attendances.reduce((sum, a) => sum + (a.cash_payout || 0), 0);
    const bonBalance = employee.bon_balance || 0;
    const netSalary = totalSalary + totalUangMakan + totalTransport + totalTunjangan + totalOvertime + totalBonus - totalDeductions + totalPayout;

    // Remove existing modal
    document.getElementById('payment-modal')?.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:500px;">
        <div class="modal-title">
          <i class="fas fa-money-bill-wave"></i> Konfirmasi Pembayaran Gaji
          <button onclick="document.getElementById('payment-modal').remove()"
            style="margin-left:auto;background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:1.2rem;">✕</button>
        </div>

        <div class="mb-16" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px;color:var(--text);">
          <div class="fw-bold">${esc(employee.full_name)}</div>
          <div class="text-xs text-secondary">${esc(employee.jabatan || employee.role)}</div>
          <div class="text-xs text-secondary">Periode: ${fmtDate(startDate)} - ${fmtDate(endDate)}</div>
        </div>

        <div class="mb-16" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px;color:var(--text);">
          <div class="text-xs text-secondary mb-8">Rincian Gaji:</div>
          <div class="flex justify-between mb-4">
            <span class="text-sm">Gaji Pokok (${days} hari)</span>
            <span class="fw-bold">${fmtIdr(totalSalary)}</span>
          </div>
          ${totalUangMakan > 0 ? `
          <div class="flex justify-between mb-4">
            <span class="text-sm">Uang Makan</span>
            <span class="fw-bold">${fmtIdr(totalUangMakan)}</span>
          </div>` : ''}
          ${totalTransport > 0 ? `
          <div class="flex justify-between mb-4">
            <span class="text-sm">Transport</span>
            <span class="fw-bold">${fmtIdr(totalTransport)}</span>
          </div>` : ''}
          ${totalTunjangan > 0 ? `
          <div class="flex justify-between mb-4">
            <span class="text-sm">Tunjangan Lain</span>
            <span class="fw-bold">${fmtIdr(totalTunjangan)}</span>
          </div>` : ''}
          ${totalOvertime > 0 ? `
          <div class="flex justify-between mb-4">
            <span class="text-sm">Lembur</span>
            <span class="fw-bold">${fmtIdr(totalOvertime)}</span>
          </div>` : ''}
          ${totalBonus > 0 ? `
          <div class="flex justify-between mb-4">
            <span class="text-sm">Bonus/Lain-lain</span>
            <span class="fw-bold">${fmtIdr(totalBonus)}</span>
          </div>` : ''}
          ${totalDeductions > 0 ? `
          <div class="flex justify-between mb-8" style="color:var(--danger);">
            <span class="text-sm">Kasbon (potongan)</span>
            <span class="fw-bold">-${fmtIdr(totalDeductions)}</span>
          </div>` : ''}
          ${totalPayout > 0 ? `
          <div class="flex justify-between mb-8" style="color:var(--warning);">
            <span class="text-sm">Pinjaman</span>
            <span class="fw-bold">+${fmtIdr(totalPayout)}</span>
          </div>` : ''}
          <div class="flex justify-between pt-8" style="border-top:2px solid var(--border);font-size:1.1rem;">
            <span class="fw-bold">Total Terima:</span>
            <span class="fw-bold text-success" id="display-net-salary">${fmtIdr(netSalary)}</span>
          </div>
        </div>

        <!-- Potong Bon (Angsuran) -->
        ${bonBalance > 0 ? `
        <div class="mb-16" style="background:var(--bg-card);border:1px solid var(--warning,#ffc107);border-radius:var(--radius);padding:12px;color:var(--text);">
          <div class="flex align-center gap-8 mb-8">
            <input type="checkbox" id="potong-bon-checkbox" 
              onchange="window.__togglePotongBon(this.checked, ${bonBalance}, ${netSalary})" />
            <label for="potong-bon-checkbox" class="fw-bold" style="cursor:pointer;">
              <i class="fas fa-cut"></i> Potong Bon (Angsuran)
            </label>
          </div>
          <div class="text-xs text-secondary mb-8">
            Saldo hutang bon saat ini: <strong class="text-danger">${fmtIdr(bonBalance)}</strong>
          </div>
          <div id="potong-bon-fields" style="display:none;">
            <div class="form-group mb-8">
              <label class="form-label text-sm">Jumlah Angsuran (Rp)</label>
              <input type="number" class="form-input" id="potong-bon-amount" 
                min="0" max="${Math.min(bonBalance, netSalary)}" step="1000"
                placeholder="Masukkan jumlah angsuran"
                oninput="window.__updateNetSalary(${netSalary})" />
              <div class="text-xs text-secondary mt-4">
                Maksimal: ${fmtIdr(Math.min(bonBalance, netSalary))} 
                (${bonBalance > netSalary ? 'sesuai gaji' : 'sesuai saldo bon'})
              </div>
            </div>
            <div class="alert alert-info" style="padding:8px 10px;font-size:0.85rem;">
              <i class="fas fa-info-circle"></i>
              Angsuran akan otomatis dicatat sebagai transaksi bon "BAYAR" dan mengurangi saldo hutang karyawan.
            </div>
          </div>
        </div>` : ''}

        <div class="form-group mb-16">
          <label class="form-label">Metode Pembayaran</label>
          <div class="flex gap-8 mb-8">
            <label class="flex align-center gap-4" style="cursor:pointer;">
              <input type="radio" name="payment-method" value="cash" checked 
                onchange="window.__toggleBankFields(false)" />
              <span>💵 Cash</span>
            </label>
            <label class="flex align-center gap-4" style="cursor:pointer;">
              <input type="radio" name="payment-method" value="transfer" 
                onchange="window.__toggleBankFields(true)" />
              <span>🏦 Transfer</span>
            </label>
          </div>
        </div>

        <div id="bank-fields" style="display:none;">
          <div class="form-group mb-8">
            <label class="form-label">Nama Bank</label>
            <input type="text" class="form-input" id="payment-bank" placeholder="BCA, Mandiri, BRI, dll" />
          </div>
          <div class="form-group mb-16">
            <label class="form-label">No. Rekening</label>
            <input type="text" class="form-input" id="payment-account" placeholder="1234567890" />
          </div>
        </div>

        <div class="form-group mb-16">
          <label class="form-label">Catatan (Opsional)</label>
          <textarea class="form-input" id="payment-notes" rows="2" 
            placeholder="Catatan pembayaran..."></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="document.getElementById('payment-modal').remove()">
            Batal
          </button>
          <button class="btn btn-success" id="btn-confirm-payment"
            onclick="window.__app.processPayment('${employeeId}', '${startDate}', '${endDate}')">
            <i class="fas fa-check"></i> Bayar & Cetak Slip
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Helper function untuk toggle bank fields
    window.__toggleBankFields = (show) => {
      const bankFields = document.getElementById('bank-fields');
      if (bankFields) bankFields.style.display = show ? 'block' : 'none';
    };

    // Helper function untuk toggle potong bon
    window.__togglePotongBon = (checked, bonBalance, originalNetSalary) => {
      const fields = document.getElementById('potong-bon-fields');
      const amountInput = document.getElementById('potong-bon-amount');
      if (fields) fields.style.display = checked ? 'block' : 'none';
      if (!checked && amountInput) {
        amountInput.value = '';
        window.__updateNetSalary(originalNetSalary);
      }
    };

    // Helper function untuk update net salary display
    window.__updateNetSalary = (originalNetSalary) => {
      const potongBonCheckbox = document.getElementById('potong-bon-checkbox');
      const potongBonAmount = parseFloat(document.getElementById('potong-bon-amount')?.value) || 0;
      const displayNetSalary = document.getElementById('display-net-salary');
      
      if (potongBonCheckbox?.checked && potongBonAmount > 0) {
        const newNetSalary = originalNetSalary - potongBonAmount;
        if (displayNetSalary) {
          displayNetSalary.innerHTML = `
            <div style="text-decoration:line-through;font-size:0.9rem;color:var(--text-secondary);">${fmtIdr(originalNetSalary)}</div>
            <div>${fmtIdr(newNetSalary)}</div>
          `;
        }
      } else {
        if (displayNetSalary) displayNetSalary.textContent = fmtIdr(originalNetSalary);
      }
    };

  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

/** Pay selected salaries (bulk) */
export function paySelectedSalaries(startDate, endDate) {
  const checkboxes = document.querySelectorAll('.salary-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('Pilih minimal 1 karyawan', 'warning');
    return;
  }
  
  // Get first selected employee and open modal
  const firstEmployeeId = checkboxes[0].dataset.employeeId;
  
  if (checkboxes.length === 1) {
    // Single payment
    openPaymentModal(firstEmployeeId, startDate, endDate);
  } else {
    // Bulk payment - TODO: implement bulk modal
    showToast(`Bulk payment untuk ${checkboxes.length} karyawan akan dibuat di iterasi berikutnya`, 'info');
  }
}

/** Process payment untuk 1 karyawan */
export async function processPayment(employeeId, startDate, endDate, currentUserId) {
  const btn = document.getElementById('btn-confirm-payment');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Memproses...';
  }

  try {
    // Get form values
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'cash';
    const bankName = document.getElementById('payment-bank')?.value || null;
    const accountNumber = document.getElementById('payment-account')?.value || null;
    const notes = document.getElementById('payment-notes')?.value || null;
    
    // Get potong bon values
    const potongBonCheckbox = document.getElementById('potong-bon-checkbox');
    const potongBonEnabled = potongBonCheckbox?.checked || false;
    const potongBonAmount = potongBonEnabled ? (parseFloat(document.getElementById('potong-bon-amount')?.value) || 0) : 0;

    // Validate transfer fields
    if (paymentMethod === 'transfer' && (!bankName || !accountNumber)) {
      showToast('Nama bank dan no. rekening harus diisi untuk transfer', 'warning');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Bayar & Cetak Slip';
      }
      return;
    }

    // Validate potong bon amount
    if (potongBonEnabled && potongBonAmount <= 0) {
      showToast('Jumlah angsuran bon harus lebih dari 0', 'warning');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Bayar & Cetak Slip';
      }
      return;
    }

    // Query attendance yang belum dibayar
    const { data: attendances, error: attError } = await supabase
      .from('attendance_logs')
      .select('*, profiles!inner(bon_balance)')
      .is('payment_id', null)
      .eq('employee_id', employeeId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + ' 23:59:59');

    if (attError) throw attError;
    if (!attendances || attendances.length === 0) {
      throw new Error('Tidak ada data gaji untuk dibayar');
    }

    // Validate potong bon tidak melebihi saldo
    const bonBalance = attendances[0].profiles.bon_balance || 0;
    if (potongBonEnabled && potongBonAmount > bonBalance) {
      throw new Error(`Angsuran (${fmtIdr(potongBonAmount)}) melebihi saldo bon (${fmtIdr(bonBalance)})`);
    }

    // Calculate totals - include all salary components
    const days = attendances.length;
    const totalSalary = attendances.reduce((sum, a) => sum + (a.basic_salary || 0), 0);
    const totalUangMakan = attendances.reduce((sum, a) => sum + (a.uang_makan || 0), 0);
    const totalTransport = attendances.reduce((sum, a) => sum + (a.transport || 0), 0);
    const totalTunjangan = attendances.reduce((sum, a) => sum + (a.tunjangan_lain || 0), 0);
    const totalOvertime = attendances.reduce((sum, a) => sum + (a.overtime_pay || 0), 0);
    const totalBonus = attendances.reduce((sum, a) => sum + (a.misc_amount || 0), 0);
    const totalDeductions = attendances.reduce((sum, a) => sum + (a.cash_advance || 0), 0);
    const totalPayout = attendances.reduce((sum, a) => sum + (a.cash_payout || 0), 0);
    
    // Add potong bon to total deductions
    const finalTotalDeductions = totalDeductions + potongBonAmount;
    const netSalary = totalSalary + totalUangMakan + totalTransport + totalTunjangan + totalOvertime + totalBonus - finalTotalDeductions + totalPayout;

    // Validate net salary tidak negatif
    if (netSalary < 0) {
      throw new Error('Total gaji tidak mencukupi untuk potongan yang diinput');
    }

    // Get current user ID - diteruskan dari state.user.id via main.js
    if (!currentUserId) throw new Error('Sesi login tidak ditemukan, silakan refresh halaman');

    // Insert salary_payment record
    const { data: payment, error: payError } = await supabase
      .from('salary_payments')
      .insert({
        employee_id: employeeId,
        period_start: startDate,
        period_end: endDate,
        total_days_worked: days,
        total_salary: totalSalary,
        total_overtime: totalOvertime,
        total_bonus: totalBonus,
        total_deductions: finalTotalDeductions,
        net_salary: netSalary,
        payment_method: paymentMethod,
        bank_name: bankName,
        account_number: accountNumber,
        notes: notes,
        paid_by: currentUserId,
        payment_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (payError) throw payError;

    // Update attendance_logs dengan payment_id
    const { error: updateError } = await supabase
      .from('attendance_logs')
      .update({ payment_id: payment.id })
      .in('id', attendances.map(a => a.id));

    if (updateError) throw updateError;

    // Insert bon transaction jika potong bon enabled
    if (potongBonEnabled && potongBonAmount > 0) {
      const { error: bonError } = await supabase
        .from('bon_transactions')
        .insert({
          employee_id: employeeId,
          type: 'bayar',
          amount: potongBonAmount,
          description: `Potong gaji periode ${fmtDate(startDate)} - ${fmtDate(endDate)}`,
          created_by: user.id,
        });

      if (bonError) throw bonError;
    }

    // Close modal
    document.getElementById('payment-modal')?.remove();

    // Show success & print slip
    showToast(potongBonEnabled ? 
      `Pembayaran berhasil! Bon dipotong ${fmtIdr(potongBonAmount)}. Mencetak slip...` : 
      'Pembayaran berhasil! Mencetak slip...', 
      'success');
    
    // Reload data
    await loadUnpaidSalaries();
    await loadPaymentHistory();

    // Print slip
    setTimeout(() => {
      printSalarySlip(payment.id);
    }, 500);

  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Bayar & Cetak Slip';
    }
  }
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
export async function printSalarySlip(paymentId) {
  try {
    // Query payment data
    const { data: payment, error } = await supabase
      .from('salary_payments')
      .select('*, profiles!salary_payments_employee_id_fkey(full_name, jabatan, role)')
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    if (!payment) throw new Error('Data pembayaran tidak ditemukan');

    // Query attendance logs untuk mendapatkan breakdown detail
    const { data: attendances, error: attError } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('payment_id', paymentId);

    if (attError) throw attError;

    // Calculate breakdown from attendance logs
    const totalUangMakan = attendances?.reduce((sum, a) => sum + (a.uang_makan || 0), 0) || 0;
    const totalTransport = attendances?.reduce((sum, a) => sum + (a.transport || 0), 0) || 0;
    const totalTunjangan = attendances?.reduce((sum, a) => sum + (a.tunjangan_lain || 0), 0) || 0;
    const totalPayout = attendances?.reduce((sum, a) => sum + (a.cash_payout || 0), 0) || 0;
    const totalKasbon = attendances?.reduce((sum, a) => sum + (a.cash_advance || 0), 0) || 0;

    // Query bon transaction untuk periode ini (untuk melihat potong bon)
    const { data: bonTransactions } = await supabase
      .from('bon_transactions')
      .select('*')
      .eq('employee_id', payment.employee_id)
      .eq('type', 'bayar')
      .gte('created_at', payment.period_start)
      .lte('created_at', payment.period_end + ' 23:59:59')
      .ilike('description', '%Potong gaji%');
    
    const totalPotongBon = bonTransactions?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;

    const employee = payment.profiles;
    
    // Create print window
    const printWindow = document.createElement('div');
    printWindow.id = 'salary-slip-print';
    printWindow.innerHTML = `
      <div style="max-width:800px;margin:0 auto;padding:40px;font-family:Arial,sans-serif;background:white;">
        <!-- Header dengan Logo -->
        <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #333;padding-bottom:20px;">
          <img src="/apple-touch-icon.png" alt="Logo" style="width:80px;height:80px;margin-bottom:10px;" />
          <h1 style="margin:0;font-size:24px;color:#333;">SLIP GAJI</h1>
          <h2 style="margin:5px 0 0 0;font-size:18px;color:#666;">PT BAROTECH</h2>
        </div>

        <!-- Info Karyawan -->
        <table style="width:100%;margin-bottom:20px;font-size:14px;">
          <tr>
            <td style="width:150px;padding:5px 0;"><strong>Nama</strong></td>
            <td style="padding:5px 0;">: ${esc(employee.full_name)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;"><strong>Jabatan</strong></td>
            <td style="padding:5px 0;">: ${esc(employee.jabatan || employee.role)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;"><strong>Periode</strong></td>
            <td style="padding:5px 0;">: ${fmtDate(payment.period_start)} - ${fmtDate(payment.period_end)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;"><strong>Tanggal Bayar</strong></td>
            <td style="padding:5px 0;">: ${fmtDate(payment.payment_date)}</td>
          </tr>
        </table>

        <!-- Pendapatan -->
        <div style="margin-bottom:20px;">
          <div style="background:#f0f0f0;padding:8px;font-weight:bold;border-bottom:2px solid #333;">PENDAPATAN</div>
          <table style="width:100%;font-size:14px;">
            <tr>
              <td style="padding:8px 0;">Gaji Pokok (${payment.total_days_worked} hari)</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(payment.total_salary)}</td>
            </tr>
            ${totalUangMakan > 0 ? `
            <tr>
              <td style="padding:8px 0;">Uang Makan</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(totalUangMakan)}</td>
            </tr>` : ''}
            ${totalTransport > 0 ? `
            <tr>
              <td style="padding:8px 0;">Transport</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(totalTransport)}</td>
            </tr>` : ''}
            ${totalTunjangan > 0 ? `
            <tr>
              <td style="padding:8px 0;">Tunjangan Lain</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(totalTunjangan)}</td>
            </tr>` : ''}
            ${payment.total_overtime > 0 ? `
            <tr>
              <td style="padding:8px 0;">Lembur</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(payment.total_overtime)}</td>
            </tr>` : ''}
            ${payment.total_bonus > 0 ? `
            <tr>
              <td style="padding:8px 0;">Bonus/Tunjangan</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(payment.total_bonus)}</td>
            </tr>` : ''}
            ${totalPayout > 0 ? `
            <tr>
              <td style="padding:8px 0;">Pinjaman</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(totalPayout)}</td>
            </tr>` : ''}
            <tr style="border-top:1px solid #ddd;">
              <td style="padding:8px 0;font-weight:bold;">Total Pendapatan</td>
              <td style="text-align:right;padding:8px 0;font-weight:bold;">${fmtIdr(payment.total_salary + totalUangMakan + totalTransport + totalTunjangan + payment.total_overtime + payment.total_bonus + totalPayout)}</td>
            </tr>
          </table>
        </div>

        <!-- Potongan -->
        <div style="margin-bottom:20px;">
          <div style="background:#f0f0f0;padding:8px;font-weight:bold;border-bottom:2px solid #333;">POTONGAN</div>
          <table style="width:100%;font-size:14px;">
            ${totalKasbon > 0 ? `
            <tr>
              <td style="padding:8px 0;">Kasbon</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(totalKasbon)}</td>
            </tr>` : ''}
            ${totalPotongBon > 0 ? `
            <tr>
              <td style="padding:8px 0;">Angsuran Bon</td>
              <td style="text-align:right;padding:8px 0;">${fmtIdr(totalPotongBon)}</td>
            </tr>` : ''}
            ${payment.total_deductions === 0 ? `
            <tr>
              <td style="padding:8px 0;font-style:italic;color:#999;">Tidak ada potongan</td>
              <td style="text-align:right;padding:8px 0;">Rp 0</td>
            </tr>` : ''}
            <tr style="border-top:1px solid #ddd;">
              <td style="padding:8px 0;font-weight:bold;">Total Potongan</td>
              <td style="text-align:right;padding:8px 0;font-weight:bold;">${fmtIdr(payment.total_deductions)}</td>
            </tr>
          </table>
        </div>

        <!-- Total Diterima -->
        <div style="background:#e8f5e9;border:2px solid #4caf50;padding:15px;margin-bottom:30px;">
          <table style="width:100%;font-size:16px;">
            <tr>
              <td style="font-weight:bold;">TOTAL DITERIMA</td>
              <td style="text-align:right;font-weight:bold;font-size:20px;color:#4caf50;">${fmtIdr(payment.net_salary)}</td>
            </tr>
          </table>
        </div>

        <!-- Metode Pembayaran -->
        <div style="margin-bottom:30px;font-size:14px;">
          <strong>Metode Pembayaran:</strong> ${payment.payment_method === 'cash' ? '💵 Cash' : '🏦 Transfer'}
          ${payment.payment_method === 'transfer' ? `<br/><strong>Bank:</strong> ${esc(payment.bank_name)} - ${esc(payment.account_number)}` : ''}
          ${payment.notes ? `<br/><strong>Catatan:</strong> ${esc(payment.notes)}` : ''}
        </div>

        <!-- Tanda Tangan -->
        <table style="width:100%;margin-top:50px;font-size:14px;">
          <tr>
            <td style="width:50%;text-align:center;">
              <div style="margin-bottom:80px;">Diterima oleh,</div>
              <div style="border-top:1px solid #333;display:inline-block;padding-top:5px;min-width:200px;">
                (${esc(employee.full_name)})
              </div>
            </td>
            <td style="width:50%;text-align:center;">
              <div style="margin-bottom:80px;">Dibayar oleh,</div>
              <div style="border-top:1px solid #333;display:inline-block;padding-top:5px;min-width:200px;">
                (Admin)
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#666;">
          Dicetak: ${new Date().toLocaleString('id-ID')}
        </div>
      </div>
    `;

    // Append to body
    document.body.appendChild(printWindow);

    // Sembunyikan semua konten halaman kecuali slip, lalu print
    const style = document.createElement('style');
    style.id = 'print-slip-style';
    style.innerHTML = `
      @media print {
        body > *:not(#salary-slip-print) { display: none !important; }
        #salary-slip-print { display: block !important; position: static !important; }
      }
    `;
    document.head.appendChild(style);

    // Print
    setTimeout(() => {
      window.print();
      // Cleanup setelah print dialog ditutup
      setTimeout(() => {
        printWindow.remove();
        document.getElementById('print-slip-style')?.remove();
      }, 1000);
    }, 100);

  } catch (err) {
    showToast('Gagal cetak slip: ' + err.message, 'error');
  }
}
