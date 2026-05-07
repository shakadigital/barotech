# Fix Material Page - Workflow & Permissions

## Masalah
- Error: "Cannot read properties of null (reading 'id')"
- Variabel `isLapangan` tidak terdefinisi di fungsi `loadMaterialList`
- Workflow dan permission tidak jelas

## Solusi

### 1. Fix Error
Menambahkan definisi variabel yang hilang di fungsi `loadMaterialList`:
```javascript
const isLapangan = state.user.role === 'kepala_lapangan';
const isGudang = state.user.role === 'kepala_gudang';
```

### 2. Klarifikasi Workflow Material Order

**Alur Kerja:**
1. **Kepala Gudang** → Input order material
2. **Admin/Owner/Superadmin** → Verifikasi/approve order dari Kepala Gudang, ATAU bisa input langsung
3. **Kepala Lapangan** → Verifikasi tambahan untuk semua order

**Permission:**
- **Input Order**: Kepala Gudang & Admin
- **Update Status**: Admin & Kepala Lapangan
- **Delete Order**: Superadmin & Owner saja
- **View Only**: Kepala Gudang (hanya bisa lihat order yang sudah dibuat)

### 3. UI Improvements

**Untuk Kepala Gudang:**
- Info box di form: "Order yang Anda buat akan diverifikasi oleh Admin, kemudian Kepala Lapangan."

**Untuk Admin:**
- Info box di form: "Order yang Anda buat akan diverifikasi oleh Kepala Lapangan."

**Untuk Kepala Lapangan:**
- Alert di atas halaman: "Workflow Material: Kepala Gudang input order → Admin verifikasi → Anda (Kepala Lapangan) verifikasi tambahan"

**Tabel Material:**
- Menambahkan kolom "Dibuat Oleh" untuk transparansi
- Dropdown status hanya muncul untuk Admin & Kepala Lapangan
- Tombol hapus hanya untuk Superadmin & Owner

## Status Labels
- **Pending** (abu-abu) - Menunggu verifikasi
- **Disetujui** (hijau) - Sudah disetujui
- **Ditolak** (merah) - Ditolak
- **Selesai** (hijau) - Sudah selesai/diterima

## File yang Diubah
- `src/pages/material.js`

## Testing
1. Login sebagai Kepala Gudang → Bisa input, tidak bisa update status
2. Login sebagai Admin → Bisa input & update status
3. Login sebagai Kepala Lapangan → Tidak bisa input, bisa update status
4. Verifikasi kolom "Dibuat Oleh" muncul dengan benar
5. Verifikasi info workflow muncul sesuai role

## Tanggal
7 Mei 2026
