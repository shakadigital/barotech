# Fix Material Page - Workflow & Permissions

## Masalah
- Error: "Cannot read properties of null (reading 'id')"
- Variabel `isLapangan` tidak terdefinisi di fungsi `loadMaterialList`
- User object tidak di-validasi sebelum diakses
- Workflow dan permission tidak jelas

## Solusi

### 1. Fix Error di loadMaterialList
Menambahkan definisi variabel yang hilang dan validasi state:
```javascript
// Validasi state dan user
if (!state || !state.user) {
  console.error('State atau user tidak tersedia:', state);
  el.innerHTML = '<div class="empty-state">Error: User tidak ditemukan...</div>';
  return;
}

// Definisi variabel role
const userRole = state.user.role || '';
const isLapangan = userRole === 'kepala_lapangan';
const isGudang = userRole === 'kepala_gudang';
```

### 2. Fix Error di handleMaterialSubmit
Menambahkan validasi user sebelum akses user.id:
```javascript
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  throw new Error('User tidak ditemukan. Silakan login kembali.');
}

// Baru akses user.id setelah validasi
ordered_by: user.id,
```

### 3. Klarifikasi Workflow Material Order

**Alur Kerja:**
1. **Kepala Gudang** → Input order material
2. **Admin/Owner/Superadmin** → Verifikasi/approve order dari Kepala Gudang, ATAU bisa input langsung
3. **Kepala Lapangan** → Verifikasi tambahan untuk semua order

**Permission:**
- **Input Order**: Kepala Gudang & Admin
- **Update Status**: Admin & Kepala Lapangan
- **Delete Order**: Superadmin & Owner saja
- **View Only**: Kepala Gudang (hanya bisa lihat order yang sudah dibuat)

### 4. UI Improvements

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

## Git Commits
1. `a27a55b` - Fix error & workflow permissions
2. `3af8a9f` - Add null check for state.user in loadMaterialList
3. `e655390` - Add null check for user in handleMaterialSubmit

## Testing
1. Login sebagai Kepala Gudang → Bisa input, tidak bisa update status
2. Login sebagai Admin → Bisa input & update status
3. Login sebagai Kepala Lapangan → Tidak bisa input, bisa update status
4. Verifikasi kolom "Dibuat Oleh" muncul dengan benar
5. Verifikasi info workflow muncul sesuai role
6. Test submit form → Tidak ada error "Cannot read properties of null"
7. Hard refresh browser (Ctrl+Shift+R) untuk clear cache

## Cara Deploy
1. Build: `npm run build`
2. Hard refresh browser untuk clear cache
3. Test semua fungsi material order

## Tanggal
7 Mei 2026
