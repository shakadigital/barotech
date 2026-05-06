# Changelog V28 — Status Libur & Kolom Kegiatan

## 📋 Ringkasan Perubahan

Versi 28 menambahkan fitur untuk:
1. **Status baru** untuk attendance: Libur, Izin, Sakit
2. **Kolom kegiatan** untuk mencatat aktivitas user yang hadir

## 🗄️ Perubahan Database

### File: `sql/v28-add-leave-status-and-activities.sql`

**Perubahan:**
- Tambah kolom `kegiatan` di tabel `attendance_logs`
- Update constraint `status` untuk menambah: `'libur'`, `'izin'`, `'sakit'`
- Tambah index untuk performa query

**Status yang didukung:**
- `hadir` - Karyawan hadir
- `tidak_hadir` - Karyawan tidak hadir
- `pending` - Belum diverifikasi
- `libur` - Karyawan libur (tidak dihitung sebagai tidak hadir)
- `izin` - Karyawan izin
- `sakit` - Karyawan sakit

## 🎨 Perubahan UI

### File: `src/pages/attendance.js`

**Fungsi yang diupdate:**
1. `verifyAttendance()` - Mendukung status baru (libur, izin, sakit)
2. `renderRow()` - Menampilkan tombol verifikasi baru dan input kegiatan
3. Status badge - Menampilkan badge dengan warna berbeda untuk setiap status

**Fungsi baru:**
- `saveKegiatan()` - Menyimpan kegiatan user tanpa mengubah status

**Tombol verifikasi baru:**
- ✅ **Hadir** (hijau)
- ❌ **Tidak** (merah)
- 🏖️ **Libur** (biru)
- 📝 **Izin** (kuning)
- 🤒 **Sakit** (merah muda)

**Input baru:**
- **Kegiatan** - Input untuk mencatat aktivitas user yang hadir
- **Pekerjaan** - Input existing (work_items) untuk backward compatibility

### File: `src/main.js`

**Perubahan:**
- Import fungsi `saveKegiatan` dari attendance.js
- Tambah `saveKegiatan()` ke `window.__app`

## 📝 Cara Menggunakan

### 1. Jalankan Migration Database

```bash
# Login ke Supabase Dashboard
# Buka SQL Editor
# Copy-paste isi file sql/v28-add-leave-status-and-activities.sql
# Jalankan query
```

### 2. Update Status di database-setup.sql

Ubah status v28 dari `⚠️ BELUM` menjadi `✅ SUDAH DIJALANKAN`

### 3. Restart Development Server

```bash
npm run dev
```

## 🎯 Use Case

### Admin/Owner verifikasi attendance:

1. **Karyawan Hadir:**
   - Isi kolom "Kegiatan hari ini"
   - Klik tombol "Hadir"
   - Status: `hadir` (badge hijau)

2. **Karyawan Libur:**
   - Klik tombol "Libur"
   - Status: `libur` (badge biru)
   - Tidak dihitung sebagai tidak hadir di laporan

3. **Karyawan Izin:**
   - Klik tombol "Izin"
   - Status: `izin` (badge kuning)

4. **Karyawan Sakit:**
   - Klik tombol "Sakit"
   - Status: `sakit` (badge merah muda)

### Filter di Laporan:

```sql
-- Hanya karyawan yang hadir (exclude libur, izin, sakit)
SELECT * FROM attendance_logs 
WHERE status = 'hadir' 
AND created_at >= '2026-05-01';

-- Exclude libur dari perhitungan gaji
SELECT * FROM attendance_logs 
WHERE status != 'libur' 
AND created_at >= '2026-05-01';
```

## 🔄 Backward Compatibility

- Status lama (`verified`, `absent`, `draft`) tetap didukung
- Mapping otomatis:
  - `verified` → `hadir`
  - `absent` → `tidak_hadir`
  - `draft` → `pending`

## 📊 Manfaat

1. **Identifikasi jelas** - Admin bisa membedakan "tidak hadir" vs "libur"
2. **Laporan akurat** - Filter berdasarkan status untuk perhitungan gaji
3. **Tracking kegiatan** - Mencatat aktivitas user yang hadir
4. **Fleksibel** - Mendukung berbagai jenis ketidakhadiran (libur, izin, sakit)

## 🐛 Testing

Setelah implementasi, test:
1. ✅ Verifikasi attendance dengan status baru
2. ✅ Input kegiatan untuk user yang hadir
3. ✅ Badge status tampil dengan warna yang benar
4. ✅ Filter laporan berdasarkan status
5. ✅ Backward compatibility dengan status lama

---

**Tanggal:** 6 Mei 2026  
**Versi:** v28  
**Status:** ✅ Siap digunakan
