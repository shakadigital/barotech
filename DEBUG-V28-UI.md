# 🔍 Debug V28 UI - Tombol Tidak Muncul

## Kemungkinan Penyebab:

### 1. ❌ Server Belum Di-restart
**Solusi:**
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 2. ❌ Browser Cache Belum Di-clear
**Solusi:**
- Tekan `Ctrl + Shift + R` (hard reload)
- Atau buka Incognito/Private window

### 3. ❌ Semua Karyawan Sudah Diverifikasi
**Cek:**
- Apakah semua karyawan di tabel sudah ada badge hijau "HADIR"?
- Jika ya, tombol tidak muncul karena sudah diverifikasi
- **Solusi:** Generate attendance baru atau tunggu besok

### 4. ❌ Tidak Ada Karyawan di Daftar Hari Ini
**Cek:**
- Apakah tabel kosong dengan pesan "Belum ada data absensi hari ini"?
- **Solusi:** Klik tombol "Generate Sekarang" untuk membuat attendance hari ini

### 5. ❌ Login Bukan sebagai Admin/Owner/Superadmin
**Cek:**
- Lihat badge role di kanan atas (sebelah nama)
- Jika role = "karyawan" atau "kepala_gudang", tombol tidak muncul
- **Solusi:** Login sebagai admin/owner/superadmin

---

## 📸 Screenshot Ekspektasi UI

### Tampilan untuk Karyawan BELUM DIVERIFIKASI:

```
┌──────────────────────────────────────────────────────────────────┐
│ No. │ Karyawan      │ Proyek        │ Status              │ Tindakan │
├──────────────────────────────────────────────────────────────────┤
│ 1   │ Budi Santoso  │ Proyek Villa  │ BELUM VERIFIKASI   │          │
│     │               │               │                     │ ┌─────────────────────────┐ │
│     │               │               │                     │ │ Kegiatan hari ini...    │ │
│     │               │               │                     │ ├─────────────────────────┤ │
│     │               │               │                     │ │ Pekerjaan hari ini...   │ │
│     │               │               │                     │ ├─────────────────────────┤ │
│     │               │               │                     │ │ ✅ Hadir  │ ❌ Tidak    │ │
│     │               │               │                     │ ├─────────────────────────┤ │
│     │               │               │                     │ │🏖️Libur│📝Izin│🤒Sakit │ │ ← INI TOMBOL BARU
│     │               │               │                     │ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Tampilan untuk Karyawan SUDAH DIVERIFIKASI:

```
┌──────────────────────────────────────────────────────────────────┐
│ No. │ Karyawan      │ Proyek        │ Status    │ Tindakan        │
├──────────────────────────────────────────────────────────────────┤
│ 1   │ Andi Wijaya   │ Proyek Ruko   │ HADIR     │ ✓ Sudah Diverifikasi │
│     │               │               │ (hijau)   │ [Edit kegiatan...]   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Cara Test Manual:

### Test 1: Buat Attendance Baru
1. Login sebagai **admin**
2. Buka menu **Absensi**
3. Jika tabel kosong, klik tombol **"Generate Sekarang"**
4. Setelah generate, akan muncul daftar karyawan dengan status "BELUM VERIFIKASI"
5. Di kolom "Tindakan", Anda akan melihat 5 tombol

### Test 2: Verifikasi dengan Status Baru
1. Pilih karyawan yang belum diverifikasi
2. Isi kolom "Kegiatan hari ini" (contoh: "Pasang keramik")
3. Klik tombol **🏖️ Libur**
4. Status berubah menjadi badge biru "LIBUR"
5. Toast notification muncul: "Libur ✓"

### Test 3: Cek di Database
Buka Supabase Dashboard → Table Editor → attendance_logs:
```sql
SELECT employee_id, status, kegiatan, created_at 
FROM attendance_logs 
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;
```

Anda akan melihat:
- `status` = 'libur' (bukan 'verified' atau 'absent')
- `kegiatan` = teks yang Anda input

---

## 🔧 Quick Fix - Jika Masih Tidak Muncul

Jalankan command ini untuk memastikan file sudah ter-update:

```bash
# Cek apakah file sudah ter-update
git status

# Jika ada "modified" files, berarti belum ter-save
# Pull latest dari GitHub
git pull origin main

# Restart server
npm run dev
```

---

## 📞 Informasi untuk Debug

Jika masih tidak muncul, berikan informasi berikut:

1. **Role user yang login:** ___________
2. **Apakah ada karyawan di tabel?** Ya / Tidak
3. **Status karyawan di tabel:** (BELUM VERIFIKASI / HADIR / TIDAK HADIR)
4. **Screenshot kolom "Tindakan":** (jika bisa)
5. **Console error di browser?** (F12 → Console tab)

---

## 🎯 Ekspektasi Akhir

Setelah semua langkah di atas, Anda akan melihat:

✅ **5 tombol verifikasi:**
1. ✅ Hadir (hijau)
2. ❌ Tidak (merah)
3. 🏖️ Libur (biru)
4. 📝 Izin (kuning)
5. 🤒 Sakit (merah muda)

✅ **2 input field:**
1. Kegiatan hari ini
2. Pekerjaan hari ini

✅ **Badge status berwarna:**
- HADIR (hijau)
- LIBUR (biru)
- IZIN (kuning)
- SAKIT (merah muda)
- TIDAK HADIR (merah)
- BELUM VERIFIKASI (abu-abu)
