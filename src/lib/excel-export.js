import * as XLSX from 'xlsx';
import { fmtDate, fmtIdr, showToast } from './helpers.js';

/**
 * Excel Export Functions for Admin/Superadmin
 * Uses SheetJS (xlsx) library to generate Excel files
 */

// Helper: Format date for Excel (YYYY-MM-DD to DD/MM/YYYY)
function formatExcelDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper: Format time for Excel (HH:MM:SS to HH:MM)
function formatExcelTime(timeStr) {
  if (!timeStr) return '-';
  return timeStr.slice(0, 5);
}

// Helper: Auto-fit column width
function autoFitColumns(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const colWidths = [];

  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push({ wch: Math.min(maxLen + 2, 50) });
  }

  ws['!cols'] = colWidths;
}

/**
 * Export Laporan Gaji ke Excel
 * @param {Array} data - Array dari hasil filterLaporanGaji
 * @param {Object} filters - Filter yang digunakan { month, employeeId, projectId }
 */
export function exportLaporanGaji(data, filters = {}) {
  try {
    console.log('exportLaporanGaji called with data:', data);
    
    if (!Array.isArray(data)) {
      console.error('exportLaporanGaji expects an array, got:', typeof data, data);
      showToast('Format data tidak valid untuk export', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan per Karyawan - use array of arrays instead of json_to_sheet
    const header = ['Nama Karyawan', 'Jabatan', 'Total Hari', 'Gaji Pokok', 'Lembur', 'Uang Makan', 'Transport', 'Tunjangan Lain', 'Kasbon', 'Total Bersih'];
    const summaryRowsAoA = data.map(emp => [
      String(emp.full_name || ''),
      String(emp.jabatan || ''),
      Number(emp.total_hari || 0),
      Number(emp.gaji_pokok || 0),
      Number(emp.lembur || 0),
      Number(emp.uang_makan || 0),
      Number(emp.transport || 0),
      Number(emp.tunjangan_lain || 0),
      Number(emp.kasbon || 0),
      Number(emp.total_bersih || 0),
    ]);
    const summaryRows = [header, ...summaryRowsAoA];

    console.log('Summary rows (AoA):', summaryRows);

    if (summaryRows.length === 0) {
      showToast('Tidak ada data untuk diexport', 'error');
      return;
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    autoFitColumns(wsSummary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

    // Sheet 2: Detail per Karyawan (semua log dengan tanggal)
    const detailHeader = [
      'Nama Karyawan', 'Jabatan', 'Tanggal', 'Proyek',
      'Gaji Pokok', 'Lembur', 'Uang Makan', 'Transport', 'Tunjangan Lain', 'Kasbon', 'Total Bersih',
    ];
    const detailRows = [];
    data.forEach(emp => {
      (emp.logs || []).forEach(l => {
        const total =
          (l.basic_salary || 0) + (l.overtime_pay || 0) +
          (l.uang_makan || 0) + (l.transport || 0) + (l.tunjangan_lain || 0) -
          (l.cash_advance || 0);
        detailRows.push([
          String(emp.full_name || ''),
          String(emp.jabatan || ''),
          formatExcelDate(l.created_at),
          String(l.project_name || '-'),
          Number(l.basic_salary || 0),
          Number(l.overtime_pay || 0),
          Number(l.uang_makan || 0),
          Number(l.transport || 0),
          Number(l.tunjangan_lain || 0),
          Number(l.cash_advance || 0),
          Number(total),
        ]);
      });
    });
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    autoFitColumns(wsDetail);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');

    // Generate filename
    const dateStr = filters.month || new Date().toISOString().slice(0, 7);
    const filename = `Laporan-Gaji-${dateStr}.xlsx`;

    console.log('About to write file:', filename);

    // Download
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error('Excel export error:', err);
    showToast('Gagal export Excel: ' + err.message, 'error');
  }
}

/**
 * Export Laporan Absensi ke Excel
 * @param {Array} logs - Array attendance_logs dengan join profiles + projects
 * @param {Object} filters - Filter yang digunakan { month, projectId }
 */
export function exportLaporanAbsensi(logs, filters = {}) {
  const wb = XLSX.utils.book_new();
  
  const rows = logs.map(l => ({
    'Nama Karyawan': l.employee_name,
    'Jabatan': l.jabatan_snapshot,
    'Proyek': l.project_name,
    'Tanggal': formatExcelDate(l.created_at),
    'Jam Masuk': formatExcelTime(l.check_in),
    'Jam Keluar': formatExcelTime(l.check_out),
    'Status': l.status === 'verified' ? 'Hadir' : l.status === 'absent' ? 'Tidak Hadir' : 'Pending',
    'Gaji Pokok': l.basic_salary,
    'Lembur': l.overtime_pay,
    'Kasbon': l.cash_advance,
    'Total': (l.basic_salary || 0) + (l.overtime_pay || 0) - (l.cash_advance || 0),
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Absensi');
  
  const dateStr = filters.month || new Date().toISOString().slice(0, 7);
  const filename = `Laporan-Absensi-${dateStr}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

/**
 * Export Laporan Lembur ke Excel
 * @param {Array} logs - Array overtime_logs dengan join profiles + projects
 * @param {Object} filters - Filter yang digunakan { month, status }
 */
export function exportLaporanLembur(logs, filters = {}) {
  const wb = XLSX.utils.book_new();
  
  const rows = logs.map(l => ({
    'Nama Karyawan': l.employee_name,
    'Jabatan': l.employee_jabatan,
    'Proyek': l.project_name,
    'Tanggal': formatExcelDate(l.created_at),
    'Jam Lembur': l.overtime_hours,
    'Rate per Jam': l.overtime_rate,
    'Total Lembur': l.total_pay,
    'Status': l.status === 'approved' ? 'Disetujui' : l.status === 'rejected' ? 'Ditolak' : 'Pending',
    'Catatan': l.notes || '-',
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Lembur');
  
  const dateStr = filters.month || new Date().toISOString().slice(0, 7);
  const filename = `Laporan-Lembur-${dateStr}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

/**
 * Export Laporan Material ke Excel
 * @param {Array} materials - Array materials dengan join projects
 * @param {Object} filters - Filter yang digunakan { month, projectId }
 */
export function exportLaporanMaterial(materials, filters = {}) {
  const wb = XLSX.utils.book_new();
  
  const rows = materials.map(m => ({
    'Nama Material': m.name,
    'Proyek': m.project_name,
    'Jumlah': m.quantity,
    'Satuan': m.unit,
    'Harga Satuan': m.price,
    'Total': m.quantity * m.price,
    'Tanggal': formatExcelDate(m.created_at),
    'Status': m.status,
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Material');
  
  const dateStr = filters.month || new Date().toISOString().slice(0, 7);
  const filename = `Laporan-Material-${dateStr}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

/**
 * Export Laporan Pengeluaran ke Excel
 * @param {Array} expenses - Array expenses dengan join projects
 * @param {Object} filters - Filter yang digunakan { month, projectId }
 */
export function exportLaporanPengeluaran(expenses, filters = {}) {
  const wb = XLSX.utils.book_new();
  
  const rows = expenses.map(e => ({
    'Deskripsi': e.description,
    'Proyek': e.project_name,
    'Jumlah': e.amount,
    'Tanggal': formatExcelDate(e.created_at),
    'Kategori': e.category || '-',
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pengeluaran');
  
  const dateStr = filters.month || new Date().toISOString().slice(0, 7);
  const filename = `Laporan-Pengeluaran-${dateStr}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

/**
 * Export Laporan Penugasan ke Excel
 * @param {Array} assignments - Array project_assignments dengan join profiles + projects
 * @param {Object} filters - Filter yang digunakan { status, projectId }
 */
export function exportLaporanPenugasan(assignments, filters = {}) {
  const wb = XLSX.utils.book_new();
  
  const rows = assignments.map(a => ({
    'Nama Karyawan': a.employee_name,
    'Jabatan': a.employee_jabatan,
    'Proyek': a.project_name,
    'Tanggal Mulai': formatExcelDate(a.start_date),
    'Tanggal Selesai': a.end_date ? formatExcelDate(a.end_date) : '-',
    'Gaji per Hari': a.basic_salary,
    'Uang Makan': a.uang_makan,
    'Transport': a.transport,
    'Tunjangan Lain': a.tunjangan_lain,
    'Status': a.status === 'active' ? 'Aktif' : a.status === 'paused' ? 'Ditunda' : a.status === 'ended' ? 'Selesai' : a.status,
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penugasan');
  
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Laporan-Penugasan-${dateStr}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

/**
 * Export Rekap Biaya Proyek ke Excel
 * @param {Array} data   - Array hasil RPC get_rekap_biaya_proyek
 * @param {Object} filters - { month, projectId }
 */
export function exportRekapProyekExcel(data, filters = {}) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      showToast('Tidak ada data untuk diexport', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan per Proyek
    const header = [
      'Proyek', 'Status',
      'Gaji Karyawan', 'Lembur', 'Material', 'Pengeluaran Operasional', 'Grand Total',
    ];
    const rows = data.map(r => [
      String(r.project_name || ''),
      String(r.project_status || ''),
      Number(r.total_gaji || 0),
      Number(r.total_lembur || 0),
      Number(r.total_material || 0),
      Number(r.total_pengeluaran || 0),
      Number(r.grand_total || 0),
    ]);

    // Baris total
    const totalRow = [
      'TOTAL KESELURUHAN', '',
      rows.reduce((s, r) => s + r[2], 0),
      rows.reduce((s, r) => s + r[3], 0),
      rows.reduce((s, r) => s + r[4], 0),
      rows.reduce((s, r) => s + r[5], 0),
      rows.reduce((s, r) => s + r[6], 0),
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
    autoFitColumns(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Biaya Proyek');

    const dateStr = filters.month || new Date().toISOString().slice(0, 7);
    const filename = `Rekap-Biaya-Proyek-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error('Export rekap proyek error:', err);
    showToast('Gagal export Excel: ' + err.message, 'error');
  }
}

/**
 * Export Rekap Gaji Lengkap ke Excel
 * @param {Array} data    - Hasil RPC get_rekap_gaji_lengkap
 * @param {Object} filters
 */
export function exportRekapGajiExcel(data, filters = {}) {
  try {
    const wb = XLSX.utils.book_new();

    const header = [
      'Karyawan', 'Jabatan', 'Hari Kerja',
      'Gaji Pokok', 'Uang Makan', 'Transport', 'Tunjangan Lain',
      'Lembur (Absensi)', 'Lembur (Overtime)', 'Total Lembur',
      'Kasbon', 'Total Bersih',
    ];
    const rows = data.map(r => [
      String(r.full_name || ''),
      String(r.jabatan || ''),
      Number(r.hari_kerja || 0),
      Number(r.total_gaji_pokok || 0),
      Number(r.total_uang_makan || 0),
      Number(r.total_transport || 0),
      Number(r.total_tunjangan || 0),
      Number(r.total_lembur_att || 0),
      Number(r.total_lembur_ot || 0),
      Number(r.total_lembur_att || 0) + Number(r.total_lembur_ot || 0),
      Number(r.total_kasbon || 0),
      Number(r.total_bersih || 0),
    ]);

    const totalRow = [
      'TOTAL', '',
      rows.reduce((s, r) => s + r[2], 0),
      rows.reduce((s, r) => s + r[3], 0),
      rows.reduce((s, r) => s + r[4], 0),
      rows.reduce((s, r) => s + r[5], 0),
      rows.reduce((s, r) => s + r[6], 0),
      rows.reduce((s, r) => s + r[7], 0),
      rows.reduce((s, r) => s + r[8], 0),
      rows.reduce((s, r) => s + r[9], 0),
      rows.reduce((s, r) => s + r[10], 0),
      rows.reduce((s, r) => s + r[11], 0),
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
    autoFitColumns(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Gaji');

    const dateStr = filters.month || new Date().toISOString().slice(0, 7);
    XLSX.writeFile(wb, `Rekap-Gaji-Lengkap-${dateStr}.xlsx`);
  } catch (err) {
    showToast('Gagal export: ' + err.message, 'error');
  }
}

/**
 * Export Laporan Bon ke Excel
 * @param {Array} data    - Hasil RPC get_rekap_bon
 * @param {Object} filters
 */
export function exportLaporanBonExcel(data, filters = {}) {
  try {
    const wb = XLSX.utils.book_new();

    const header = [
      'Karyawan', 'Jabatan', 'Saldo Hutang',
      'Total Pinjam (periode)', 'Total Bayar (periode)',
      'Jumlah Transaksi', 'Transaksi Terakhir',
    ];
    const rows = data.map(r => [
      String(r.full_name || ''),
      String(r.jabatan || ''),
      Number(r.saldo_hutang || 0),
      Number(r.total_pinjam || 0),
      Number(r.total_bayar || 0),
      Number(r.jumlah_transaksi || 0),
      r.transaksi_terakhir
        ? new Date(r.transaksi_terakhir).toLocaleDateString('id-ID')
        : '-',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    autoFitColumns(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bon');

    const dateStr = filters.month || new Date().toISOString().slice(0, 7);
    XLSX.writeFile(wb, `Laporan-Bon-${dateStr}.xlsx`);
  } catch (err) {
    showToast('Gagal export: ' + err.message, 'error');
  }
}

/**
 * Export Laporan Kegiatan Harian ke Excel
 * @param {Array} logs        - attendance_logs
 * @param {Array} activities  - daily_activities
 * @param {Object} filters
 * @param {Object} stateRef   - { employees, projects }
 */
export function exportLaporanKegiatanExcel(logs, activities, filters = {}, stateRef = {}) {
  try {
    const wb = XLSX.utils.book_new();

    // Map activities by attendance_id
    const actByAtt = new Map();
    (activities || []).forEach(a => {
      if (!actByAtt.has(a.attendance_id)) actByAtt.set(a.attendance_id, []);
      actByAtt.get(a.attendance_id).push(a);
    });

    const header = ['Tanggal', 'Karyawan', 'Proyek', 'Kegiatan', 'Status Kegiatan'];
    const rows = [];

    logs.forEach(l => {
      const empName = stateRef?.employees?.find(e => e.id === l.employee_id)?.full_name || l.employee_id;
      const prjName = stateRef?.projects?.find(p => p.id === l.project_id)?.name || '-';
      const acts    = actByAtt.get(l.id) || [];
      const dateStr = formatExcelDate(l.created_at);

      if (acts.length === 0) {
        rows.push([dateStr, String(empName), String(prjName), '-', '-']);
      } else {
        acts.forEach(a => {
          rows.push([
            dateStr,
            String(empName),
            String(prjName),
            String(a.description || ''),
            a.status === 'done' ? 'Selesai' : 'Dalam Proses',
          ]);
        });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    autoFitColumns(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Kegiatan Harian');

    const dateStr = filters.month || new Date().toISOString().slice(0, 7);
    XLSX.writeFile(wb, `Laporan-Kegiatan-${dateStr}.xlsx`);
  } catch (err) {
    showToast('Gagal export: ' + err.message, 'error');
  }
}
