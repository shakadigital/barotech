# Update Rekap Biaya Proyek - Budget Alert & Breakdown Detail

## Fitur Baru yang Ditambahkan

### 1. **Toggle Periode: Per Bulan vs Total Akumulatif** ✅
- Radio button untuk memilih mode tampilan:
  - **Per Bulan**: Menampilkan biaya untuk bulan tertentu (filter by month)
  - **Total Akumulatif**: Menampilkan total biaya sejak proyek dimulai (all time)
- Input bulan otomatis disabled saat mode "Total Akumulatif"
- Filter tetap berfungsi untuk memilih proyek spesifik

### 2. **Budget Alert di Header Proyek** ✅
Setiap proyek menampilkan status budget dengan warna:
- **🟢 Hijau (<70%)**: Budget aman
  - Icon: ✓ (check-circle)
  - Text: "✓ XX.X% dari budget"
- **🟡 Kuning (70-90%)**: Mendekati limit
  - Icon: ⚠ (exclamation-circle)
  - Text: "⚠ XX.X% dari budget"
- **🔴 Merah (>90%)**: Over budget atau hampir over
  - Icon: ⚠️ (exclamation-triangle)
  - Text: "⚠️ XX.X% dari budget"

**Catatan:**
- Alert hanya muncul jika proyek punya `budget_limit > 0`
- Threshold default: 80% (dari kolom `budget_alert_threshold`)
- Menampilkan limit budget: "(Limit: Rp XXX)"

### 3. **Breakdown Detail per Proyek** ✅
Setiap baris proyek bisa di-expand untuk melihat detail:

**Tombol Expand:**
- Icon chevron-down/up di kolom pertama
- Klik untuk toggle tampilan breakdown

**Isi Breakdown (3 Kategori):**

#### a. **Material** 📦
- Sumber: Tabel `materials`
- Menampilkan:
  - Nama item
  - Quantity × Unit Price
  - Total Price
- Total: Sum dari `total_price`

#### b. **Pengeluaran Umum** 🧾
- Sumber: Tabel `expenses`
- Menampilkan:
  - Nama item
  - Description (jika ada)
  - Amount
- Total: Sum dari `amount`

#### c. **Gaji Karyawan** 👥
- Sumber: Tabel `attendance_logs`
- Menampilkan:
  - Nama karyawan
  - Gaji pokok
  - Lembur (jika ada)
  - Total per karyawan
- Total: Sum dari `basic_salary + overtime_pay`

**Fitur Breakdown:**
- Scrollable (max-height: 200px) jika data banyak
- Font size kecil (0.8rem) untuk efisiensi ruang
- Warna berbeda per kategori untuk visual clarity
- Menampilkan "Tidak ada data" jika kategori kosong

### 4. **Responsive Filter Period** ✅
- Filter bulan otomatis disabled saat mode "Total Akumulatif"
- Visual feedback: opacity 0.5 saat disabled
- Reload otomatis saat toggle mode

## Perubahan Teknis

### File yang Diubah:
- `src/pages/rekap-proyek.js`

### Fungsi Baru:
1. **`togglePeriodType()`**
   - Handle toggle antara "Per Bulan" dan "Total Akumulatif"
   - Disable/enable input bulan
   - Trigger reload data

2. **`toggleProjectBreakdown(projectId)`**
   - Toggle expand/collapse breakdown row
   - Rotate chevron icon
   - Load breakdown data on first expand

3. **`loadProjectBreakdown(projectId, contentEl)`**
   - Query data dari 3 tabel: materials, expenses, attendance_logs
   - Filter by month jika mode "Per Bulan"
   - Group salary by employee
   - Render breakdown HTML

### Fungsi yang Diupdate:
1. **`loadRekapProyek()`**
   - Tambah parameter `periodType` (monthly/cumulative)
   - Fetch project budget info dari tabel `projects`
   - Pass budget data ke render function
   - Update RPC call parameter

2. **`RekapProyekPage()`**
   - Update UI filter dengan radio button
   - Hapus checkbox "Semua Waktu" (diganti toggle)
   - Tambah kolom chevron di tabel

### Query Database:
```javascript
// Budget info
supabase.from('projects')
  .select('id, name, budget_limit, budget_alert_threshold')
  .in('id', projectIds)

// Materials breakdown
supabase.from('materials')
  .select('item_name, quantity, unit_price, total_price, created_at')
  .eq('project_id', projectId)
  .gte('created_at', startDate)  // jika per bulan
  .lte('created_at', endDate)

// Expenses breakdown
supabase.from('expenses')
  .select('item_name, amount, description, created_at')
  .eq('project_id', projectId)
  .gte('created_at', startDate)  // jika per bulan
  .lte('created_at', endDate)

// Attendance breakdown
supabase.from('attendance_logs')
  .select('employee_id, basic_salary, overtime_pay, profiles!inner(full_name)')
  .eq('project_id', projectId)
  .in('status', ['hadir', 'verified'])
  .gte('created_at', startDate)  // jika per bulan
  .lte('created_at', endDate)
```

## UI/UX Improvements

### Visual Hierarchy:
- Budget alert dengan warna semantik (hijau/kuning/merah)
- Icon yang jelas untuk setiap status
- Breakdown dengan background berbeda (--bg-secondary)
- Scrollable content untuk data panjang

### Interactivity:
- Chevron icon berputar saat expand/collapse
- Loading spinner saat fetch breakdown data
- Smooth toggle dengan display: none/table-row

### Accessibility:
- Label yang jelas untuk radio button
- Title attribute pada tombol
- Color + icon untuk status (tidak hanya warna)

## Data Flow

```
User Action → Toggle Period Type
  ↓
loadRekapProyek()
  ↓
RPC: get_rekap_biaya_proyek (with period filter)
  ↓
Fetch project budgets
  ↓
Render table with budget alerts
  ↓
User clicks chevron → toggleProjectBreakdown()
  ↓
loadProjectBreakdown()
  ↓
Query: materials + expenses + attendance
  ↓
Render breakdown detail (3 categories)
```

## Testing Checklist

- [x] Toggle "Per Bulan" → Input bulan enabled
- [x] Toggle "Total Akumulatif" → Input bulan disabled
- [x] Budget alert warna hijau (<70%)
- [x] Budget alert warna kuning (70-90%)
- [x] Budget alert warna merah (>90%)
- [x] Budget alert tidak muncul jika limit = 0
- [x] Chevron icon rotate saat expand
- [x] Breakdown material tampil dengan benar
- [x] Breakdown pengeluaran tampil dengan benar
- [x] Breakdown gaji tampil dengan benar
- [x] Scrollable jika data banyak
- [x] "Tidak ada data" jika kategori kosong
- [x] Filter bulan bekerja di breakdown
- [x] Total akumulatif bekerja di breakdown

## Catatan Penting

1. **Budget Limit Optional**: Jika proyek tidak punya budget limit (0 atau null), alert tidak ditampilkan
2. **Threshold Default**: 80% (bisa diubah per proyek di kolom `budget_alert_threshold`)
3. **Kategori dari Data Existing**: Tidak perlu tabel kategori baru, langsung ambil dari `item_name` di materials/expenses
4. **Performance**: Breakdown di-load on-demand (saat expand), bukan di awal
5. **Filter Konsisten**: Filter bulan dan proyek berlaku untuk summary DAN breakdown

## Next Steps (Opsional)

- [ ] Export Excel dengan multiple sheets (Material, Pengeluaran, Gaji)
- [ ] Chart visualization untuk breakdown
- [ ] Budget history tracking
- [ ] Email notification saat budget >90%
- [ ] Bulk edit budget limit
