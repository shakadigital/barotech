# 📖 Cara Pakai Fitur Baru V28

## ✨ Fitur Baru

### 1. Status Libur, Izin, Sakit
Admin sekarang bisa menandai karyawan yang tidak hadir dengan alasan yang jelas:
- 🏖️ **Libur** - Hari libur (tidak dihitung sebagai tidak hadir)
- 📝 **Izin** - Karyawan izin
- 🤒 **Sakit** - Karyawan sakit

### 2. Kolom Kegiatan
User yang hadir bisa mencatat kegiatan yang dilakukan hari itu.

---

## 🚀 Langkah Instalasi

### Step 1: Jalankan Migration Database

1. Buka **Supabase Dashboard** → https://supabase.com/dashboard
2. Pilih project Anda
3. Klik **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy-paste isi file `sql/v28-add-leave-status-and-activities.sql`
6. Klik **Run** atau tekan `Ctrl+Enter`
7. Pastikan muncul pesan sukses

### Step 2: Update Status di database-setup.sql

Edit file `database-setup.sql`, ubah baris:
```
│  sql/v28-add-leave-status-and-activities.sql ⚠️ BELUM  │
```

Menjadi:
```
│  sql/v28-add-leave-status-and-activities.sql ✅ SUDAH DIJALANKAN │
```

### Step 3: Restart Server (jika sedang running)

```bash
# Stop server (Ctrl+C)
# Start lagi
npm run dev
```

---

## 💡 Cara Menggunakan

### Untuk Admin/Owner:

#### Verifikasi Karyawan Hadir:
1. Buka menu **Absensi**
2. Lihat daftar karyawan hari ini
3. Isi kolom **"Kegiatan hari ini"** (contoh: "Pasang keramik lantai 2")
4. Klik tombol **Hadir** (hijau)
5. Status berubah menjadi badge hijau "HADIR"

#### Tandai Karyawan Libur:
1. Buka menu **Absensi**
2. Lihat karyawan yang tidak hadir
3. Klik tombol **Libur** (biru)
4. Status berubah menjadi badge biru "LIBUR"
5. Karyawan ini tidak akan dihitung sebagai "tidak hadir" di laporan

#### Tandai Karyawan Izin/Sakit:
- Klik tombol **Izin** (kuning) untuk karyawan yang izin
- Klik tombol **Sakit** (merah muda) untuk karyawan yang sakit

### Edit Kegiatan Setelah Verifikasi:
1. Setelah karyawan diverifikasi "Hadir"
2. Anda masih bisa edit kolom **Kegiatan**
3. Klik icon **💾 Save** di sebelah input kegiatan

---

## 📊 Contoh Penggunaan

### Skenario 1: Hari Kerja Normal
- **Budi** → Hadir, kegiatan: "Cor beton lantai 1"
- **Andi** → Hadir, kegiatan: "Pasang besi tulangan"
- **Citra** → Tidak (tidak ada keterangan)

### Skenario 2: Hari Libur Nasional
- **Budi** → Libur (17 Agustus)
- **Andi** → Libur (17 Agustus)
- **Citra** → Libur (17 Agustus)

### Skenario 3: Karyawan Sakit
- **Budi** → Hadir, kegiatan: "Finishing cat"
- **Andi** → Sakit (demam)
- **Citra** → Izin (urusan keluarga)

---

## 🎨 Tampilan UI

### Tombol Verifikasi (untuk karyawan yang belum diverifikasi):

```
┌─────────────────────────────────────┐
│ Kegiatan hari ini...                │ ← Input kegiatan
├─────────────────────────────────────┤
│ Pekerjaan hari ini...               │ ← Input pekerjaan (lama)
├─────────────────────────────────────┤
│  ✅ Hadir    │  ❌ Tidak            │ ← Tombol utama
├─────────────────────────────────────┤
│ 🏖️ Libur │ 📝 Izin │ 🤒 Sakit      │ ← Tombol status
└─────────────────────────────────────┘
```

### Badge Status:

- **HADIR** → Badge hijau
- **TIDAK HADIR** → Badge merah
- **LIBUR** → Badge biru
- **IZIN** → Badge kuning
- **SAKIT** → Badge merah muda
- **BELUM VERIFIKASI** → Badge abu-abu

---

## 📈 Filter di Laporan

Untuk membuat laporan yang akurat, Anda bisa filter berdasarkan status:

### Hanya karyawan yang hadir:
```sql
SELECT * FROM attendance_logs 
WHERE status = 'hadir' 
AND created_at >= '2026-05-01';
```

### Exclude libur dari perhitungan gaji:
```sql
SELECT * FROM attendance_logs 
WHERE status NOT IN ('libur', 'izin', 'sakit')
AND created_at >= '2026-05-01';
```

### Hitung total hari kerja (exclude libur):
```sql
SELECT employee_id, COUNT(*) as total_hari_kerja
FROM attendance_logs 
WHERE status = 'hadir'
AND created_at >= '2026-05-01'
GROUP BY employee_id;
```

---

## ❓ FAQ

**Q: Apakah status lama (verified, absent) masih bisa digunakan?**  
A: Ya, sistem otomatis convert:
- `verified` → `hadir`
- `absent` → `tidak_hadir`
- `draft` → `pending`

**Q: Apakah kolom "Pekerjaan" dan "Kegiatan" berbeda?**  
A: Ya, tapi keduanya opsional:
- **Kegiatan** (baru) → Untuk mencatat aktivitas user
- **Pekerjaan** (lama/work_items) → Untuk backward compatibility

**Q: Bagaimana cara membedakan "Tidak Hadir" vs "Libur"?**  
A: 
- **Tidak Hadir** → Karyawan seharusnya hadir tapi tidak datang (tanpa keterangan)
- **Libur** → Karyawan memang tidak perlu hadir (hari libur, cuti, dll)

**Q: Apakah status "Libur" mempengaruhi perhitungan gaji?**  
A: Tergantung kebijakan perusahaan. Anda bisa filter di laporan:
- Include libur → Hitung semua hari
- Exclude libur → Hanya hitung hari kerja aktif

---

## 🐛 Troubleshooting

### Error: "column kegiatan does not exist"
→ Anda belum menjalankan migration v28. Jalankan Step 1 di atas.

### Error: "new row violates check constraint"
→ Status yang Anda gunakan tidak valid. Gunakan salah satu: hadir, tidak_hadir, pending, libur, izin, sakit

### Tombol tidak muncul
→ Clear cache browser (Ctrl+Shift+R) atau restart dev server

---

## 📞 Support

Jika ada masalah, cek:
1. File `CHANGELOG-v28.md` untuk detail teknis
2. File `sql/v28-add-leave-status-and-activities.sql` untuk struktur database
3. File `src/pages/attendance-patch.js` untuk contoh kode

---

**Selamat menggunakan fitur baru! 🎉**
