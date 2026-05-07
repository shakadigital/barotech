# Migrasi ke Custom Authentication

## Overview
Aplikasi ini menggunakan **custom authentication system** (bukan Supabase Auth default). Oleh karena itu, semua halaman harus menggunakan `state.user.id` untuk mendapatkan user ID, bukan `supabase.auth.getUser()`.

## Masalah yang Diperbaiki
Beberapa halaman masih menggunakan `supabase.auth.getUser()` yang selalu return null karena aplikasi tidak menggunakan Supabase Auth. Ini menyebabkan error:
- "Cannot read properties of null (reading 'id')"
- "User tidak ditemukan. Silakan login kembali"

## Halaman yang Sudah Diperbaiki

### 1. ✅ Halaman Material (`src/pages/material.js`)
**Commit:** `0e03208`

**Perubahan:**
```javascript
// SEBELUM (SALAH)
export async function handleMaterialSubmit(e) {
  const { data: { user } } = await supabase.auth.getUser();
  ordered_by: user.id  // ❌ Error: user null
}

// SESUDAH (BENAR)
export async function handleMaterialSubmit(e, state, refreshFn) {
  if (!state || !state.user || !state.user.id) {
    throw new Error('User tidak ditemukan. Silakan login kembali.');
  }
  ordered_by: state.user.id  // ✅ Dari custom auth
}
```

**Fungsi yang diperbaiki:**
- `handleMaterialSubmit(e, state, refreshFn)`
- `updateMaterialStatus(id, status, refreshFn)`
- `deleteMaterial(id, refreshFn)`

### 2. ✅ Halaman Pengeluaran (`src/pages/expense.js`)
**Commit:** `83b6c55`

**Perubahan:**
```javascript
// SEBELUM (SALAH)
export async function handleExpenseSubmit(e) {
  const { data: { user } } = await supabase.auth.getUser();
  recorded_by: user.id  // ❌ Error: user null
}

// SESUDAH (BENAR)
export async function handleExpenseSubmit(e, state, refreshFn) {
  if (!state || !state.user || !state.user.id) {
    throw new Error('User tidak ditemukan. Silakan login kembali.');
  }
  recorded_by: state.user.id  // ✅ Dari custom auth
}
```

**Fungsi yang diperbaiki:**
- `handleExpenseSubmit(e, state, refreshFn)`
- `deleteExpense(id, refreshFn)`

## Pattern yang Benar

### ✅ Pattern untuk Submit Form
```javascript
export async function handleSubmit(e, state, refreshFn) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  
  try {
    // Validasi state dan user
    if (!state || !state.user || !state.user.id) {
      throw new Error('User tidak ditemukan. Silakan login kembali.');
    }
    
    const payload = {
      // ... field lainnya
      created_by: state.user.id,  // ✅ Gunakan state.user.id
    };
    
    const { error } = await supabase.from('table_name').insert(payload);
    if (error) throw error;
    
    showToast('Data tersimpan ✓', 'success');
    document.getElementById('form-id').reset();
    if (refreshFn) await refreshFn();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}
```

### ✅ Pattern untuk Update/Delete
```javascript
export async function updateData(id, data, refreshFn) {
  try {
    const { error } = await supabase.from('table_name').update(data).eq('id', id);
    if (error) throw error;
    showToast('Data diperbarui ✓', 'success');
    if (refreshFn) await refreshFn();
  } catch (e) {
    showToast('Gagal: ' + e.message, 'error');
  }
}

export async function deleteData(id, refreshFn) {
  if (!confirm('Yakin hapus data ini?')) return;
  try {
    const { error } = await supabase.from('table_name').delete().eq('id', id);
    if (error) throw error;
    showToast('Data dihapus ✓', 'success');
    if (refreshFn) await refreshFn();
  } catch (e) {
    showToast('Gagal: ' + e.message, 'error');
  }
}
```

### ✅ Pattern di main.js
```javascript
window.__app = {
  // ... fungsi lainnya
  handleSubmit(e) { handleSubmit(e, state, refreshAndRender); },
  updateData(id, data) { updateData(id, data, refreshAndRender); },
  deleteData(id) { deleteData(id, refreshAndRender); },
};
```

## Halaman yang Sudah Benar (Tidak Perlu Diubah)

### ✅ Halaman Bon (`src/pages/bon.js`)
Sudah menggunakan pattern yang benar sejak awal:
```javascript
export async function handleBonSubmit(e, state, refreshFn) {
  created_by: state.user.id,  // ✅ Benar
}
```

### ✅ Halaman Overtime (`src/pages/overtime.js`)
Sudah menggunakan pattern yang benar:
```javascript
export async function handleOvertimeSubmit(e, state, refreshFn) {
  requested_by: state.user.id,  // ✅ Benar
}
```

### ✅ Halaman Assignment (`src/pages/assignment.js`)
Sudah menggunakan pattern yang benar:
```javascript
export async function handleAssignSubmit(e, state, refreshFn) {
  assigned_by: state.user.id,  // ✅ Benar
}
```

## Checklist Verifikasi

Untuk memastikan halaman menggunakan custom auth dengan benar:

- [ ] Fungsi submit menerima parameter `(e, state, refreshFn)`
- [ ] Validasi `state.user.id` sebelum digunakan
- [ ] Gunakan `state.user.id` untuk field `created_by`, `recorded_by`, `ordered_by`, dll
- [ ] JANGAN gunakan `supabase.auth.getUser()`
- [ ] Fungsi update/delete menerima parameter `refreshFn`
- [ ] Di main.js, pass `state` dan `refreshAndRender` ke fungsi

## Testing

Setelah perubahan, test dengan:
1. Login sebagai user dengan role yang sesuai
2. Buka halaman yang diperbaiki
3. Isi form dan submit
4. Verifikasi data tersimpan dengan benar
5. Verifikasi tidak ada error di Console (F12)

## Git Commits

1. **Material Page** - `0e03208`: Pass state parameter to handleMaterialSubmit
2. **Expense Page** - `83b6c55`: Ganti auth ke custom di halaman Pengeluaran

## Tanggal
7 Mei 2026
