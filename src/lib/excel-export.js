import * as XLSX from 'xlsx';
import { fmtDate, fmtIdr } from './helpers.js';

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
  const cols = Object.keys(ws).filter(k => k[0] === '!').length === 0;
  const colWidths = [];
  
  cols.forEach(col => {
    const colLetter = col.replace(/[0-9]/g, '');
    const maxLen = Math.max(
      ...Object.keys(ws)
        .filter(k => k.startsWith(colLetter) && k !== colLetter)
        .map(k => ws[k].v ? String(ws[k].v).length : 0)
    );
    colWidths.push({ wch: Math.min(maxLen + 2, 50) });
  });
  
  ws['!cols'] = colWidths;
}

/**
 * Export Laporan Gaji ke Excel
 * @param {Array} data - Array dari hasil filterLaporanGaji
 * @param {Object} filters - Filter yang digunakan { month, employeeId, projectId }
 */
export function exportLaporanGaji(data, filters = {}) {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Ringkasan per Karyawan
  const summaryRows = data.map(emp => ({
    'Nama Karyawan': emp.full_name,
    'Jabatan': emp.jabatan,
    'Total Hari': emp.total_hari,
    'Gaji Pokok': emp.gaji_pokok,
    'Lembur': emp.lembur,
    'Kasbon': emp.kasbon,
    'Total Bersih': emp.total_bersih,
  }));
  
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  autoFitColumns(wsSummary);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
  
  // Sheet 2: Detail per Hari
  const detailRows = [];
  data.forEach(emp => {
    emp.logs.forEach(log => {
      detailRows.push({
        'Nama Karyawan': emp.full_name,
        'Jabatan': emp.jabatan,
        'Proyek': log.project_name,
        'Tanggal': formatExcelDate(log.created_at),
        'Gaji Pokok': log.basic_salary,
        'Lembur': log.overtime_pay,
        'Kasbon': log.cash_advance,
        'Total': (log.basic_salary || 0) + (log.overtime_pay || 0) - (log.cash_advance || 0),
      });
    });
  });
  
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  autoFitColumns(wsDetail);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');
  
  // Generate filename
  const dateStr = filters.month || new Date().toISOString().slice(0, 7);
  const filename = `Laporan-Gaji-${dateStr}.xlsx`;
  
  // Download
  XLSX.writeFile(wb, filename);
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
