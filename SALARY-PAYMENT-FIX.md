# Fix Slip Gaji - Menampilkan Semua Komponen Gaji

## Masalah
Slip gaji hanya menampilkan:
- Jumlah hari kerja
- Total gaji

Yang hilang:
- Uang makan
- Transport
- Tunjangan lain
- Lembur (overtime)
- Bonus
- Kasbon (potongan)
- Pinjaman (cash_payout)

## Solusi yang Diterapkan

### 1. Update Fungsi `processPayment()` (Line ~450-460)
**Sebelum:**
```javascript
const totalSalary = attendances.reduce((sum, a) => sum + (a.basic_salary || 0), 0);
const totalOvertime = attendances.reduce((sum, a) => sum + (a.overtime_pay || 0), 0);
const totalBonus = attendances.reduce((sum, a) => sum + (a.misc_amount || 0), 0);
const totalDeductions = attendances.reduce((sum, a) => sum + (a.cash_advance || 0), 0);
const netSalary = totalSalary + totalOvertime + totalBonus - totalDeductions;
```

**Sesudah:**
```javascript
const totalSalary = attendances.reduce((sum, a) => sum + (a.basic_salary || 0), 0);
const totalUangMakan = attendances.reduce((sum, a) => sum + (a.uang_makan || 0), 0);
const totalTransport = attendances.reduce((sum, a) => sum + (a.transport || 0), 0);
const totalTunjangan = attendances.reduce((sum, a) => sum + (a.tunjangan_lain || 0), 0);
const totalOvertime = attendances.reduce((sum, a) => sum + (a.overtime_pay || 0), 0);
const totalBonus = attendances.reduce((sum, a) => sum + (a.misc_amount || 0), 0);
const totalDeductions = attendances.reduce((sum, a) => sum + (a.cash_advance || 0), 0);
const totalPayout = attendances.reduce((sum, a) => sum + (a.cash_payout || 0), 0);
const netSalary = totalSalary + totalUangMakan + totalTransport + totalTunjangan + totalOvertime + totalBonus - totalDeductions + totalPayout;
```

### 2. Update Modal Pembayaran (Line ~240-280)
Menambahkan tampilan untuk semua komponen gaji:
- Uang Makan (jika > 0)
- Transport (jika > 0)
- Tunjangan Lain (jika > 0)
- Lembur (jika > 0)
- Bonus (jika > 0)
- Kasbon/Potongan (jika > 0)
- Pinjaman (jika > 0)

### 3. Update Fungsi `openPaymentModal()` (Line ~220-240)
Menghitung semua komponen breakdown dari attendance_logs:
```javascript
const totalUangMakan = attendances.reduce((sum, a) => sum + (a.uang_makan || 0), 0);
const totalTransport = attendances.reduce((sum, a) => sum + (a.transport || 0), 0);
const totalTunjangan = attendances.reduce((sum, a) => sum + (a.tunjangan_lain || 0), 0);
const totalPayout = attendances.reduce((sum, a) => sum + (a.cash_payout || 0), 0);
```

### 4. Update Fungsi `printSalarySlip()` (Line ~610-650)
**Menambahkan query untuk breakdown:**
```javascript
// Query attendance logs untuk mendapatkan breakdown detail
const { data: attendances, error: attError } = await supabase
  .from('attendance_logs')
  .select('*')
  .eq('payment_id', paymentId);

// Calculate breakdown from attendance logs
const totalUangMakan = attendances?.reduce((sum, a) => sum + (a.uang_makan || 0), 0) || 0;
const totalTransport = attendances?.reduce((sum, a) => sum + (a.transport || 0), 0) || 0;
const totalTunjangan = attendances?.reduce((sum, a) => sum + (a.tunjangan_lain || 0), 0) || 0;
const totalPayout = attendances?.reduce((sum, a) => sum + (a.cash_payout || 0), 0) || 0;
```

**Update HTML slip untuk menampilkan semua komponen:**
- Gaji Pokok
- Uang Makan (conditional)
- Transport (conditional)
- Tunjangan Lain (conditional)
- Lembur (conditional)
- Bonus (conditional)
- Pinjaman (conditional)
- Total Pendapatan (sum semua)
- Kasbon (potongan)
- Total Diterima (net_salary)

### 5. Update Tabel Unpaid Salaries (Line ~120-180)
**Menambahkan kolom "Tunjangan" dengan breakdown:**
```javascript
const totalTunjangan = emp.totalUangMakan + emp.totalTransport + emp.totalTunjangan;
```

Menampilkan detail:
- Makan: Rp xxx
- Transport: Rp xxx
- Lain: Rp xxx
- **Total: Rp xxx**

### 6. Update `loadUnpaidSalaries()` - Employee Map (Line ~110-140)
Menambahkan tracking untuk semua komponen:
```javascript
employeeMap[empId] = {
  // ... existing fields
  totalUangMakan: 0,
  totalTransport: 0,
  totalTunjangan: 0,
  totalBonus: 0,
  totalPayout: 0,
  // ...
};
```

## Struktur Data attendance_logs
Kolom yang digunakan untuk perhitungan gaji:
- `basic_salary` - Gaji pokok per hari
- `uang_makan` - Uang makan per hari
- `transport` - Transport per hari
- `tunjangan_lain` - Tunjangan lain per hari
- `overtime_pay` - Uang lembur (calculated)
- `misc_amount` - Bonus/tunjangan tambahan
- `cash_advance` - Kasbon (potongan)
- `cash_payout` - Pinjaman (tambahan)

## Formula Perhitungan
```
Total Pendapatan = basic_salary + uang_makan + transport + tunjangan_lain + overtime_pay + misc_amount + cash_payout

Total Potongan = cash_advance

Net Salary (Total Terima) = Total Pendapatan - Total Potongan
```

## Testing Checklist
- [x] Modal pembayaran menampilkan semua komponen
- [x] Slip gaji menampilkan semua komponen
- [x] Tabel unpaid salaries menampilkan breakdown tunjangan
- [x] Perhitungan net_salary sudah benar
- [x] Conditional rendering (hanya tampilkan jika > 0)
- [x] Format currency (fmtIdr) untuk semua angka

## File yang Diubah
- `src/pages/salary-payment.js`
  - `loadUnpaidSalaries()` - Line ~110-180
  - `openPaymentModal()` - Line ~220-280
  - `processPayment()` - Line ~410-480
  - `printSalarySlip()` - Line ~610-720

## Catatan
- Tidak perlu menambah kolom baru di tabel `salary_payments`
- Breakdown detail selalu bisa dihitung ulang dari `attendance_logs` menggunakan `payment_id`
- Slip gaji akan menampilkan komponen secara conditional (hanya yang > 0)
- Logo PT BAROTECH sudah ada di slip
- Tidak ada tanda tangan digital (sesuai requirement)
