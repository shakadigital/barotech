# Changelog v32 - Auto-Verify Attendance untuk Owner/Admin/Superadmin

## 🎯 Tujuan
Memberikan kemudahan bagi Owner, Admin, dan Superadmin untuk check-in/check-out tanpa perlu verifikasi manual. Status langsung `'hadir'` saat mereka absen.

## ✨ Fitur Baru

### Auto-Verify untuk Role Tertentu
**Role yang mendapat auto-verify:**
- `owner`
- `admin`
- `superadmin`

**Behavior:**
1. **Check-in**: Langsung mendapat status `'hadir'` (tidak perlu verifikasi manual)
2. **Check-out**: Jika status masih `'pending'`, otomatis diubah ke `'hadir'`

**Role lain tetap seperti biasa:**
- Karyawan, Kepala Teknik, Kepala Lapangan, dll.
- Check-in: Status `'pending'`
- Perlu verifikasi admin dengan pilihan: `'hadir'`, `'tidak_hadir'`, `'libur'`, `'izin'`, `'sakit'`

## 🔧 Perubahan Kode

### 1. `src/pages/attendance.js` - Fungsi `clockIn()`
```javascript
// Owner/Admin/Superadmin langsung 'hadir', role lain 'pending'
const autoVerifyRoles = ['owner', 'admin', 'superadmin'];
const initialStatus = autoVerifyRoles.includes(state.user.role) ? 'hadir' : 'pending';

const { error } = await supabase.from('attendance_logs').insert({
  employee_id: state.user.id,
  project_id: null,
  check_in: checkinDatetime,
  check_out: null,
  status: initialStatus, // 'hadir' untuk owner/admin/superadmin, 'pending' untuk lainnya
  // ... field lainnya
});
```

### 2. `src/pages/attendance.js` - Fungsi `clockOut()`
```javascript
// Owner/Admin/Superadmin langsung 'hadir' saat check-out, role lain tetap status awal
const autoVerifyRoles = ['owner', 'admin', 'superadmin'];
const shouldAutoVerify = autoVerifyRoles.includes(state.user.role);

const updateData = {
  check_out: checkoutDatetime,
  checkout_lat: geo?.lat || null,
  checkout_lng: geo?.lng || null,
};

// Jika auto-verify dan status masih pending, ubah ke hadir
if (shouldAutoVerify && existing.status === 'pending') {
  updateData.status = 'hadir';
}
```

### 3. `src/pages/assignment.js` - Admin Check-in
```javascript
// Ubah dari 'verified' ke 'hadir'
const { data: attData, error: attError } = await supabase.from('attendance_logs').insert({
  // ...
  status: 'hadir', // Admin check-in = auto verified
  // ...
});
```

## 🗃️ Migrasi Database

### Script: `sql/v31-fix-attendance-status-data.sql`
Membersihkan data lama yang masih menggunakan status tidak valid:

```sql
-- Update status lama ke status baru
UPDATE attendance_logs SET status = 'hadir' WHERE status = 'verified';
UPDATE attendance_logs SET status = 'tidak_hadir' WHERE status = 'absent';
UPDATE attendance_logs SET status = 'pending' WHERE status = 'draft';
UPDATE attendance_logs SET status = 'pending' WHERE status IS NULL;
UPDATE attendance_logs SET status = 'pending' 
WHERE status NOT IN ('hadir', 'tidak_hadir', 'pending', 'libur', 'izin', 'sakit');
```

**⚠️ PENTING:** Jalankan script ini di Supabase SQL Editor sebelum menggunakan aplikasi!

## 📊 Status Mapping

| Status Lama | Status Baru | Keterangan |
|-------------|-------------|------------|
| `verified` | `hadir` | Sudah diverifikasi hadir |
| `absent` | `tidak_hadir` | Sudah diverifikasi tidak hadir |
| `draft` | `pending` | Belum diverifikasi |
| `NULL` | `pending` | Belum ada status |

## ✅ Status Valid (Constraint v28)
Hanya status berikut yang diperbolehkan di database:
- `hadir` - Sudah diverifikasi hadir
- `tidak_hadir` - Sudah diverifikasi tidak hadir
- `pending` - Menunggu verifikasi
- `libur` - Hari libur
- `izin` - Izin tidak masuk
- `sakit` - Sakit

## 🧪 Testing Checklist

- [ ] Check-in sebagai Owner → status langsung `'hadir'` ✅
- [ ] Check-out sebagai Owner → status tetap `'hadir'` ✅
- [ ] Check-in sebagai Admin → status langsung `'hadir'` ✅
- [ ] Check-out sebagai Admin → status tetap `'hadir'` ✅
- [ ] Check-in sebagai Superadmin → status langsung `'hadir'` ✅
- [ ] Check-out sebagai Superadmin → status tetap `'hadir'` ✅
- [ ] Check-in sebagai Karyawan → status `'pending'` ✅
- [ ] Check-out sebagai Karyawan → status tetap `'pending'` ✅
- [ ] Admin verifikasi attendance → bisa pilih semua status ✅
- [ ] Dashboard tidak ada error merah ✅
- [ ] Laporan gaji hanya hitung status `'hadir'` ✅

## 📝 Catatan Tambahan

### Backward Compatibility
Semua kode sudah mendukung backward compatibility dengan memeriksa kedua status:
```javascript
const isVerified = l.status === 'verified' || l.status === 'hadir';
const isDraft = l.status === 'draft' || l.status === 'pending';
const isAbsent = l.status === 'absent' || l.status === 'tidak_hadir';
```

### Laporan dan Export
- Laporan gaji tetap hanya menghitung record dengan status `'hadir'` (atau `'verified'` untuk data lama)
- Export Excel sudah menangani mapping status lama ke baru
- Dashboard menampilkan semua status dengan badge yang sesuai

## 🔗 File Terkait
- `src/pages/attendance.js` - Logika check-in/check-out
- `src/pages/assignment.js` - Admin check-in karyawan
- `sql/v31-fix-attendance-status-data.sql` - Migrasi data
- `FIX-ATTENDANCE-STATUS.md` - Dokumentasi lengkap perbaikan

## 🚀 Deployment

1. **Backup database** terlebih dahulu
2. **Jalankan migrasi SQL**: `sql/v31-fix-attendance-status-data.sql`
3. **Deploy kode baru** ke production
4. **Test** semua fungsi attendance
5. **Monitor** error logs untuk 24 jam pertama

---

**Versi:** v32  
**Tanggal:** 2026-05-07  
**Author:** Kiro AI Assistant
