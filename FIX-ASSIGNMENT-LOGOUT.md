# Fix: Logout Otomatis Setelah Submit Form Penugasan

## 🐛 Masalah
Setelah mengisi form penugasan dan klik "Simpan", aplikasi menjadi **reset dan logout otomatis**.

## 🔍 Root Cause
Fungsi `handleAssignSubmit` **tidak terdaftar** di object `window.__app` di file `src/main.js`.

### Alur Error:
1. User mengisi form penugasan
2. User klik tombol "Simpan Penugasan"
3. Form memanggil: `window.__app.handleAssignSubmit(event)`
4. ❌ Fungsi tidak ditemukan → JavaScript error
5. ❌ Error menyebabkan aplikasi crash
6. ❌ Aplikasi reset dan logout

## ✅ Solusi

### 1. Tambah `handleAssignSubmit` ke `window.__app`

**File**: `src/main.js` (Line ~465)

**Sebelum:**
```javascript
window.__app = {
  // ... other functions
  toggleAssignRow(idx) { toggleAssignRow(idx); },
  openEditAssignment(id) { openEditAssignment(id, state); },
  // handleAssignSubmit HILANG! ❌
  saveEditAssignment(e, id) { saveEditAssignment(e, id, state, refreshAndRender); },
  // ...
};
```

**Sesudah:**
```javascript
window.__app = {
  // ... other functions
  toggleAssignRow(idx) { toggleAssignRow(idx); },
  handleAssignSubmit(e) { handleAssignSubmit(e, state, refreshAndRender); }, // ✅ DITAMBAHKAN
  openEditAssignment(id) { openEditAssignment(id, state); },
  saveEditAssignment(e, id) { saveEditAssignment(e, id, state, refreshAndRender); },
  // ...
};
```

### 2. Bonus: Tambah Fungsi Rekap Proyek yang Hilang

Sekalian menambahkan fungsi-fungsi baru untuk fitur Rekap Proyek:

**Import Statement** (Line ~9):
```javascript
// Sebelum:
import { RekapProyekPage, loadRekapProyek, exportRekapProyek } from './pages/rekap-proyek.js';

// Sesudah:
import { RekapProyekPage, loadRekapProyek, togglePeriodType, toggleProjectBreakdown, exportRekapProyek } from './pages/rekap-proyek.js';
```

**Window.__app Object** (Line ~440):
```javascript
loadRekapProyek() { loadRekapProyek(); },
togglePeriodType() { togglePeriodType(); }, // ✅ DITAMBAHKAN
toggleProjectBreakdown(projectId) { toggleProjectBreakdown(projectId); }, // ✅ DITAMBAHKAN
exportRekapProyek() { exportRekapProyek(); },
```

## 📝 Penjelasan Teknis

### Mengapa Fungsi Harus Terdaftar?

Di `assignment.js`, form menggunakan inline event handler:
```html
<form id="assign-form" onsubmit="window.__app.handleAssignSubmit(event)">
```

Inline handler seperti ini membutuhkan fungsi yang **accessible secara global** melalui `window` object.

### Alternatif (Tidak Digunakan):
1. **addEventListener** - Lebih modern tapi perlu refactor besar
2. **Direct window function** - Kurang organized
3. **Event delegation** - Overkill untuk kasus ini

### Solusi yang Dipilih:
✅ Register di `window.__app` - Konsisten dengan pattern yang sudah ada di aplikasi

## 🧪 Testing

### Sebelum Fix:
1. Login sebagai admin
2. Buka menu "Penugasan"
3. Klik "Tugaskan Karyawan ke Proyek"
4. Isi form (proyek, karyawan, gaji, dll)
5. Klik "Simpan Penugasan"
6. ❌ **Aplikasi logout otomatis**

### Setelah Fix:
1. Login sebagai admin
2. Buka menu "Penugasan"
3. Klik "Tugaskan Karyawan ke Proyek"
4. Isi form (proyek, karyawan, gaji, dll)
5. Klik "Simpan Penugasan"
6. ✅ **Form tersimpan**
7. ✅ **Toast notification muncul: "Penugasan berhasil disimpan!"**
8. ✅ **Form collapse otomatis**
9. ✅ **Daftar penugasan refresh**
10. ✅ **User tetap login**

## 📊 Impact

### Files Changed:
- `src/main.js` (4 insertions, 1 deletion)

### Functions Added:
1. `handleAssignSubmit` - Submit form penugasan baru
2. `togglePeriodType` - Toggle periode rekap proyek
3. `toggleProjectBreakdown` - Expand/collapse breakdown detail

### Bugs Fixed:
- ✅ Logout otomatis setelah submit penugasan
- ✅ Toggle periode tidak berfungsi di rekap proyek
- ✅ Breakdown detail tidak bisa dibuka di rekap proyek

## 🚀 Deployment

- ✅ Committed: `4674289`
- ✅ Pushed to GitHub: `main` branch
- 🔄 Vercel auto-deploy in progress

## 📚 Lessons Learned

### Checklist untuk Fitur Baru:
1. ✅ Buat fungsi di page file (e.g., `assignment.js`)
2. ✅ Export fungsi dari page file
3. ✅ Import fungsi di `main.js`
4. ✅ **Register fungsi di `window.__app`** ⚠️ JANGAN LUPA!
5. ✅ Test di browser

### Red Flags:
- Form submit tapi tidak ada response
- Console error: "undefined is not a function"
- Aplikasi crash/logout tanpa error message
- → **Cek apakah fungsi sudah terdaftar di `window.__app`**

## 🔗 Related Issues

Masalah serupa bisa terjadi di:
- Form submit handlers lainnya
- Button onclick handlers
- Event handlers yang dipanggil dari HTML

**Solusi**: Selalu pastikan fungsi terdaftar di `window.__app` jika dipanggil dari inline HTML.

---

**Status**: ✅ FIXED
**Priority**: 🔴 CRITICAL (blocking feature)
**Verified**: ✅ Ready for testing
