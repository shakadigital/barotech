# Fix: Attendance Status Constraint Error

## Masalah
Error muncul saat melakukan check-in/check-out:
```
Gagal: new row for relation "attendance_logs" violates check constraint "attendance_logs_status_check"
```

## Penyebab
1. **Constraint v28** hanya menerima status: `'hadir', 'tidak_hadir', 'pending', 'libur', 'izin', 'sakit'`
2. **Kode lama** masih menggunakan status: `'draft'`, `'verified'`, `'absent'`
3. **Data lama** di database masih ada yang menggunakan status lama

## Solusi

### 1. Update Kode JavaScript ✅
File yang diperbaiki:
- `src/pages/attendance.js` - Ubah `status: 'draft'` → `status: 'pending'` saat check-in
- `src/pages/attendance.js` - **Owner/Admin/Superadmin** langsung `status: 'hadir'` (auto-verified)
- `src/pages/attendance.js` - Check-out untuk Owner/Admin/Superadmin otomatis set status `'hadir'`
- `src/pages/assignment.js` - Ubah `status: 'verified'` → `status: 'hadir'` saat admin check-in

### 2. Migrasi Data Database
Jalankan script SQL untuk membersihkan data lama:
```bash
# Jalankan di Supabase SQL Editor
sql/v31-fix-attendance-status-data.sql
```

Script ini akan:
- Mengubah `'verified'` → `'hadir'`
- Mengubah `'absent'` → `'tidak_hadir'`
- Mengubah `'draft'` → `'pending'`
- Mengubah `NULL` → `'pending'`
- Mengubah status tidak dikenali → `'pending'`

### 3. Verifikasi
Setelah menjalankan script, cek hasil dengan query:
```sql
SELECT status, COUNT(*) as jumlah 
FROM attendance_logs 
GROUP BY status 
ORDER BY status;
```

Hasilnya harus hanya menampilkan status yang valid:
- `hadir`
- `tidak_hadir`
- `pending`
- `libur`
- `izin`
- `sakit`

## Status Mapping

| Status Lama | Status Baru | Keterangan |
|-------------|-------------|------------|
| `verified` | `hadir` | Sudah diverifikasi hadir |
| `absent` | `tidak_hadir` | Sudah diverifikasi tidak hadir |
| `draft` | `pending` | Belum diverifikasi |
| `NULL` | `pending` | Belum ada status |

## Auto-Verify untuk Owner/Admin/Superadmin ✨

**Role yang mendapat auto-verify:**
- `owner`
- `admin`
- `superadmin`

**Behavior:**
1. **Check-in**: Langsung mendapat status `'hadir'` (tidak perlu verifikasi manual)
2. **Check-out**: Jika status masih `'pending'`, otomatis diubah ke `'hadir'`

**Role lain (Karyawan, Kepala Teknik, dll):**
- Check-in: Status `'pending'` (perlu verifikasi admin)
- Check-out: Status tetap `'pending'` sampai diverifikasi
- Admin bisa verifikasi dengan status: `'hadir'`, `'tidak_hadir'`, `'libur'`, `'izin'`, `'sakit'`

## Backward Compatibility
Fungsi `verifyAttendance()` sudah mendukung backward compatibility:
```javascript
const statusMap = {
  'hadir': { status: 'hadir', notes: 'Hadir' },
  'tidak_hadir': { status: 'tidak_hadir', notes: 'Tidak Hadir' },
  // Backward compatibility
  'verified': { status: 'hadir', notes: 'Hadir' },
  'absent': { status: 'tidak_hadir', notes: 'Tidak Hadir' },
};
```

## Testing
1. ✅ Check-in sebagai Owner/Admin/Superadmin → status langsung `'hadir'`
2. ✅ Check-out sebagai Owner/Admin/Superadmin → status tetap `'hadir'`
3. ✅ Check-in sebagai Karyawan → status `'pending'`
4. ✅ Check-out sebagai Karyawan → status tetap `'pending'`
5. ✅ Verifikasi attendance sebagai admin → bisa pilih semua status
6. ✅ Cek dashboard → tidak ada error merah

## Referensi
- Constraint definition: `sql/v28-add-leave-status-and-activities.sql`
- Data migration: `sql/v31-fix-attendance-status-data.sql`
- Code changes: `src/pages/attendance.js`, `src/pages/assignment.js`
