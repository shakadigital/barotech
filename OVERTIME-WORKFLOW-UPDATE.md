# Update Workflow Pengajuan Lembur

## Tanggal: 7 Mei 2026

## Perubahan

### Form Pengajuan Lembur untuk Karyawan

**Sebelumnya:**
- Karyawan mengisi: Tanggal, Proyek, Jam Mulai, Jam Selesai, Durasi (otomatis), Keterangan, Foto
- Durasi dihitung otomatis dari jam mulai dan selesai

**Sekarang:**
- Karyawan hanya mengisi: **Tanggal, Proyek, Keterangan, Foto**
- Durasi dan biaya **TIDAK** diisi oleh karyawan
- Durasi dan biaya akan diisi oleh Admin saat approve

### Workflow Baru

#### 1. Karyawan Mengajukan Lembur
- Buka halaman **Lembur**
- Klik **Ajukan Lembur**
- Isi form:
  - **Tanggal Lembur**: Pilih tanggal
  - **Proyek**: Pilih proyek yang sedang dikerjakan
  - **Keterangan Pekerjaan Lembur**: Jelaskan pekerjaan yang dilakukan (wajib)
  - **Foto Bukti Lembur**: Upload foto (opsional)
- Klik **Ajukan Lembur**
- Status: **PENDING** (menunggu verifikasi admin)

#### 2. Admin Approve Lembur
- Admin melihat daftar lembur dengan status **PENDING**
- Klik tombol **✓** (Approve) pada lembur yang akan disetujui
- Sistem akan menampilkan popup:
  - Nama karyawan
  - Upah lembur per jam (dari profil karyawan)
  - Input durasi lembur (dalam jam)
- Admin memasukkan durasi lembur (contoh: 3 atau 3.5)
- Sistem otomatis menghitung: **Total Upah = Durasi × Upah/Jam**
- Status berubah menjadi **APPROVED**
- Durasi dan biaya tersimpan di database

#### 3. Admin Reject Lembur
- Klik tombol **✗** (Tolak) pada lembur yang ditolak
- Konfirmasi penolakan
- Status berubah menjadi **DITOLAK**

### Tampilan Riwayat Lembur

| Status | Durasi | Upah |
|--------|--------|------|
| **PENDING** | "Belum diisi" | "—" |
| **APPROVED** | "3 jam" | "Rp 45.000" |
| **DITOLAK** | "Belum diisi" | "—" |

### Keuntungan Workflow Baru

1. **Lebih Sederhana untuk Karyawan**
   - Karyawan tidak perlu menghitung durasi
   - Fokus pada keterangan pekerjaan yang dilakukan

2. **Kontrol Lebih Baik untuk Admin**
   - Admin yang menentukan durasi lembur berdasarkan verifikasi
   - Mencegah klaim lembur yang tidak sesuai
   - Admin bisa menyesuaikan durasi berdasarkan bukti foto dan keterangan

3. **Transparansi**
   - Karyawan tetap bisa melihat status pengajuan mereka
   - Setelah approved, karyawan bisa melihat durasi dan upah yang disetujui

## File yang Dimodifikasi

- `src/pages/overtime.js`
  - Simplified `karyawanRequestForm()` - hapus input jam mulai, jam selesai, durasi
  - Modified `handleOvertimeRequest()` - simpan dengan durasi 0 dan status pending
  - Modified `approveOvertime()` - tambah prompt input durasi untuk admin
  - Modified `loadOvertimeList()` - tampilkan "Belum diisi" untuk durasi yang masih 0
  - Removed `window.__ot_reqCalcDuration()` - tidak diperlukan lagi

## Testing Checklist

- [ ] Karyawan bisa mengajukan lembur dengan form sederhana
- [ ] Pengajuan tersimpan dengan status PENDING dan durasi 0
- [ ] Admin melihat tombol Approve/Reject untuk lembur PENDING
- [ ] Admin bisa input durasi saat approve
- [ ] Sistem menghitung upah otomatis: durasi × rate
- [ ] Status berubah menjadi APPROVED setelah approve
- [ ] Durasi dan upah tampil di riwayat setelah approved
- [ ] Admin bisa reject lembur
- [ ] Karyawan hanya melihat riwayat lembur sendiri
- [ ] Admin melihat semua riwayat lembur

## Catatan

- Upah lembur per jam diambil dari field `overtime_rate` di tabel `profiles`
- Pastikan setiap karyawan sudah memiliki `overtime_rate` yang diset di halaman Users
- Jika `overtime_rate` = 0, maka upah lembur akan 0 (admin perlu update profil karyawan)
