# 🏗️ Struktur Aplikasi Barotech Management System

> **Last Updated**: 7 Mei 2026 (v33)  
> Dokumen lengkap arsitektur, fitur, dan struktur kode aplikasi.

## 📌 Status Fitur

| Simbol | Arti |
|--------|------|
| ✅ | Sudah selesai & berjalan |
| 🔧 | Sudah ada tapi perlu perbaikan |
| ❌ | Belum ada, perlu dibangun |

---

## 📁 Struktur File

\\\
barotech/
│
├── 📄 index.html                       ✅ Entry point, layout sidebar & bottom nav
├── 📄 package.json                     ✅ Dependencies: vite, @supabase/supabase-js
├── 📄 .env                             ✅ Credentials Supabase (tidak di-commit)
├── 📄 .env.example                     ✅ Template credentials
├── 📄 .gitignore                       ✅
├── 📄 database-setup.sql               ✅ Index file SQL migrations
├── 📄 README.md                        ✅ Dokumentasi utama
├── 📄 CHANGELOG.md                     ✅ Version history
├── 📄 DATABASE-SCHEMA.md               ✅ Schema database lengkap
├── 📄 STRUKTUR-APLIKASI.md             ✅ File ini
├── 📄 OVERTIME-WORKFLOW-UPDATE.md      ✅ Detail workflow lembur
│
├── 📁 sql/                             ✅ Migration files (v1-v33)
│   ├── 📄 README.md                    ✅ Panduan urutan & status migration
│   ├── 📄 v1-initial-setup.sql         ✅ Setup awal
│   ├── ...                             ✅ v2-v27 (lihat DATABASE-SCHEMA.md)
│   ├── 📄 v28-add-leave-status-and-activities.sql ✅ Status baru + kegiatan
│   ├── 📄 v29-salary-payment-and-budget.sql ✅ Salary payments + budget
│   ├── 📄 v30-fix-rekap-gaji-rpc.sql   ✅ Fix RPC rekap gaji
│   ├── 📄 v31-fix-attendance-status-data.sql ✅ Fix data status
│   ├── 📄 v32-fix-generate-attendance-status.sql ✅ Fix generate function
│   └── 📄 v33-fix-auto-sync-attendance-status.sql ✅ Fix auto sync trigger
│
├── 📁 src/
│   ├── 📄 main.js                      ✅ Entry point app, state, routing
│   ├── 📄 style.css                    ✅ Tema teal-green glassmorphism
│   ├── 📁 lib/
│   │   ├── 📄 supabase.js              ✅ Supabase client
│   │   ├── 📄 roles.js                 ✅ Konstanta & helper akses per role
│   │   ├── 📄 helpers.js               ✅ Helper format & toast
│   │   ├── 📄 excel-export.js          ✅ Export Excel utility
│   │   └── 📄 map-picker.js            ✅ Map picker utility
│   └── 📁 pages/
│       ├── 📄 dashboard.js             ✅ Beranda (role-based views)
│       ├── 📄 attendance.js            ✅ Absensi (plotting + verifikasi + edit)
│       ├── 📄 attendance-patch.js      ✅ Patch attendance utility
│       ├── 📄 overtime.js              ✅ Lembur (simplified workflow)
│       ├── 📄 laporan.js               ✅ Laporan progress (multi-foto)
│       ├── 📄 project.js               ✅ Kelola proyek + status
│       ├── 📄 bon.js                   ✅ Bon / Kasbon
│       ├── 📄 users.js                 ✅ Kelola user
│       ├── 📄 riwayat.js               ✅ Riwayat absensi karyawan
│       ├── 📄 assignment.js            ✅ Penugasan karyawan ke proyek
│       ├── 📄 material.js              ✅ Material orders
│       ├── 📄 expense.js               ✅ Pengeluaran proyek
│       ├── 📄 salary-payment.js        ✅ Pembayaran gaji
│       ├── 📄 laporan-gaji.js          ✅ Laporan gaji
│       ├── 📄 laporan-bon.js           ✅ Laporan bon
│       ├── 📄 laporan-kegiatan.js      ✅ Laporan kegiatan
│       ├── 📄 laporan-rekap-gaji.js    ✅ Rekap gaji lengkap
│       └── 📄 rekap-proyek.js          ✅ Rekap biaya proyek
│
└── 📁 public/
    ├── 🖼️ bg.png / splash.png          ✅ Background & splash
    ├── 🖼️ favicon.*                    ✅ Icon set
    ├── 📄 manifest.json                ✅ PWA manifest
    └── 📄 site.webmanifest             ✅ PWA webmanifest
\\\

---

## 🗄️ Database Schema (Ringkasan)

Lihat **DATABASE-SCHEMA.md** untuk detail lengkap. Berikut ringkasan tabel utama:

| # | Tabel | Deskripsi | Status |
|---|-------|-----------|--------|
| 1 | \profiles\ | Data user / karyawan | ✅ |
| 2 | \projects\ | Data proyek + budget | ✅ |
| 3 | \ttendance_logs\ | Absensi harian + keuangan | ✅ |
| 4 | \overtime_logs\ | Lembur terpisah (simplified workflow) | ✅ |
| 5 | \project_updates\ | Laporan progress proyek | ✅ |
| 6 | \project_photos\ | Foto progress (multi) | ✅ |
| 7 | \project_assignments\ | Penugasan karyawan ke proyek | ✅ |
| 8 | \on_transactions\ | Riwayat bon / kasbon | ✅ |
| 9 | \material_orders\ | Order material | ✅ |
| 10 | \material_photos\ | Foto nota material | ✅ |
| 11 | \project_expenses\ | Pengeluaran proyek | ✅ |
| 12 | \salary_payments\ | History pembayaran gaji | ✅ |
| 13 | \daily_activities\ | Log kegiatan harian | ✅ |

### Role Sistem (7 Level)

| # | Role | Akses Keuangan | Delete | Keterangan |
|---|------|:-:|:-:|---|
| 1 | \superadmin\ | ✅ | ✅ | Akses penuh |
| 2 | \owner\ | ✅ | ✅ | Akses penuh |
| 3 | \dmin\ | ✅ | ❌ | CRUD kecuali delete |
| 4 | \kepala_proyek\ | ❌ | ❌ | Verifikasi absensi semua proyek |
| 5 | \kepala_gudang\ | ❌ | ❌ | Lihat absensi semua proyek (read-only) |
| 6 | \kepala_lapangan\ | ❌ | ❌ | Verifikasi absensi proyeknya sendiri |
| 7 | \karyawan\ | ❌ | ❌ | Lihat riwayat sendiri, ajukan lembur |

---

## 📱 Halaman Aplikasi

### 🔐 Login
\\\
✅ Form username & password (custom auth)
✅ Splash screen animasi dengan orbs warna teal-green
✅ Auto-login jika session masih aktif
✅ Password hashing dengan bcrypt
\\\

### 🏠 Beranda (Dashboard)
\\\
✅ Greeting + role badge
✅ Status DATABASE ONLINE / OFFLINE
✅ Role-based views:
   - Owner/Admin/Superadmin: semua karyawan + semua proyek
   - Kepala Proyek/Gudang: karyawan s/d kepala_lapangan + semua proyek
   - Kepala Lapangan: karyawan s/d kepala_lapangan + proyek sendiri
   - Karyawan: karyawan s/d kepala_lapangan + tanpa quick action
✅ Quick stats: Personil, Proyek Aktif, Hadir, Belum Absen
✅ Klik stat → tampilkan detail list
✅ Aktivitas hari ini (tabel absensi)
✅ Notifikasi bon mendekati batas (role-specific):
   - Owner/Admin/Superadmin: lihat semua karyawan
   - User lain: hanya bon sendiri
✅ Pengeluaran hari ini (owner/admin/superadmin only)
\\\

### 📋 Absensi
\\\
✅ Admin: Plotting absensi lengkap (jam, gaji, lembur, kasbon)
✅ Kepala Proyek: Verifikasi semua proyek
✅ Kepala Lapangan: Verifikasi proyek sendiri + self check-in
✅ Kepala Gudang: Read-only semua proyek
✅ Generate attendance otomatis dari assignment
✅ Edit jam & keuangan (modal inline)
✅ Status: hadir, tidak_hadir, pending, libur, izin, sakit
✅ Kolom kegiatan untuk log aktivitas
✅ Auto-sync dengan assignment (triggers)
\\\

### ⏰ Lembur (Simplified Workflow)
\\\
✅ Karyawan: Ajukan lembur (tanggal, proyek, keterangan, foto)
✅ Admin: Approve dengan input durasi
✅ Sistem auto-calc upah: durasi × overtime_rate
✅ Admin: Edit durasi setelah approved
✅ Status: pending → approved / rejected
✅ Tombol edit & delete (role-based)
✅ Riwayat lembur dengan filter per role
\\\

### 📊 Riwayat Absensi (Karyawan)
\\\
✅ Tabel: Tanggal | Proyek | Status | Jam | Keuangan
✅ Kolom keuangan: Gaji | Lembur | Lain-lain | Kasbon | Total
✅ Ringkasan total di atas tabel
✅ 3 lapisan keamanan: RLS + query filter + frontend guard
✅ Filter per bulan / per proyek
\\\

### 📸 Laporan Progress
\\\
✅ Pilih proyek (kepala_lapangan hanya proyeknya)
✅ Slider progress (%)
✅ Deskripsi laporan
✅ Multiple foto: maks 4 foto + caption per foto
✅ Galeri riwayat laporan per proyek
✅ Geolocation capture otomatis
✅ Lightbox / zoom foto
\\\

### 🏗️ Kelola Proyek
\\\
✅ CRUD proyek (nama, lokasi, penanggung jawab, status)
✅ Budget limit & alert threshold (v29)
✅ Penanggung jawab: kepala_proyek atau kepala_lapangan
✅ Status: aktif / selesai / pending
✅ Tombol Tandai Selesai / Aktifkan Kembali
✅ Hapus proyek (superadmin & owner only)
✅ Detail proyek: karyawan terlibat + pengeluaran
✅ Auto-end assignments saat proyek selesai
\\\

### 💰 Bon / Kasbon
\\\
✅ Input pinjam baru + pembayaran bon
✅ Daftar karyawan + saldo bon saat ini
✅ Riwayat transaksi per karyawan
✅ Validasi: bayar tidak boleh melebihi saldo
✅ Trigger DB: saldo bon auto-update
✅ Filter per bulan
\\\

### 📋 Penugasan Karyawan
\\\
✅ Tugaskan karyawan ke proyek aktif
✅ Gaji breakdown: uang_makan, transport, tunjangan_lain
✅ Auto-calc basic_salary dari komponen
✅ Tanggal mulai & selesai (nullable)
✅ Auto-pause penugasan lama saat pindah proyek
✅ Auto-resume penugasan sebelumnya
✅ Status: active / paused / ended
✅ Edit gaji, end, resume, delete (role-based)
✅ Auto-sync dengan attendance_logs (triggers)
\\\

### 📦 Material Orders
\\\
✅ Input order: proyek, jenis, material, qty, harga
✅ Jenis: gudang / customer / beli_lokasi
✅ Auto-calc total_price
✅ Upload foto nota (multiple)
✅ Status: pending → approved / rejected / completed
✅ Update status langsung dari tabel
✅ Delete (superadmin & owner only)
\\\

### �� Pengeluaran Proyek
\\\
✅ Input pengeluaran: proyek, tanggal, kategori, jumlah
✅ Kategori: material, operasional, jasa, lainnya
✅ Running total akumulasi otomatis
✅ Upload foto nota
✅ Delete (superadmin & owner only)
✅ Filter per bulan
\\\

### 💵 Pembayaran Gaji (v29)
\\\
✅ Rekap gaji karyawan per periode
✅ Breakdown: gaji pokok, lembur, bonus, potongan
✅ Tandai sudah dibayar (payment_id di attendance)
✅ History pembayaran lengkap
✅ Payment method: cash / transfer
✅ Export slip gaji
\\\

### 📊 Laporan
\\\
✅ Laporan Gaji (per karyawan, per periode)
✅ Laporan Bon (history bon karyawan)
✅ Laporan Kegiatan (daily activities)
✅ Rekap Gaji Lengkap (gaji + lembur - bon)
✅ Rekap Biaya Proyek (semua pengeluaran)
✅ Export Excel (semua laporan)
✅ Filter per bulan / per proyek
\\\

### 👥 Kelola User
\\\
✅ Form tambah user: nama, WA, role, jabatan, username, password
✅ Auto-confirm (tidak perlu verifikasi email)
✅ Daftar user: nama, email, role, jabatan, saldo bon
✅ Edit user: nama, WA, role, password, jabatan, overtime_rate
✅ Delete user (superadmin & owner only)
✅ Field overtime_rate untuk perhitungan lembur
\\\

---

## 🧭 Navigasi per Role

| Menu | superadmin | owner | admin | kepala_proyek | kepala_gudang | kepala_lapangan | karyawan |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 🏠 Beranda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📋 Penugasan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📋 Absensi | ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | ❌ |
| ⏰ Lembur | ✅ | ✅ | ✅ | 👁️ | ❌ | 👁️ | ✅ |
| 📊 Riwayat | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 📸 Laporan | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 🏗️ Proyek | ✅ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ |
| 📦 Material | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 💸 Pengeluaran | ✅ | ✅ | ✅ | 👁️ | ❌ | 👁️ | ❌ |
| 💰 Bon | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 💵 Gaji | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📊 Laporan | ✅ | ✅ | ✅ | 👁️ | ❌ | 👁️ | ❌ |
| 👥 User | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> 👁️ = Read-only (lihat tanpa aksi)  
> ✅ = Full access (CRUD sesuai role)

---

## ⚙️ Arsitektur Kode

### State Management
\\\javascript
// Global state di main.js
const state = {
  user: null,              // Current logged-in user
  employees: [],           // All employees
  projects: [],            // All projects
  attendanceLogs: [],      // Attendance logs
  assignments: [],         // Project assignments
  currentPage: 'home',     // Current active page
  dashboardView: null,     // Dashboard detail view
  dbConnected: true        // Database connection status
};
\\\

### Routing
\\\javascript
// Simple hash-based routing
window.addEventListener('hashchange', () => {
  const page = window.location.hash.slice(1) || 'home';
  state.currentPage = page;
  render();
});
\\\

### Helper Libraries
\\\javascript
// src/lib/helpers.js
- fmtIdr(amount)           // Format currency
- fmtDate(date)            // Format date
- fmtTime(time)            // Format time
- showToast(msg, type)     // Toast notification
- esc(str)                 // HTML escape
- getGeoLocation()         // Get GPS coordinates
- compressImage(file)      // Compress image before upload

// src/lib/roles.js
- canFinance(role)         // Check financial access
- canPlot(role)            // Check plotting access
- canDelete(role)          // Check delete access
- canApproveOvertime(role) // Check overtime approval
- ROLE_LABELS              // Role display names
- FINANCE_ROLES            // Roles with financial access

// src/lib/excel-export.js
- exportToExcel(data, filename) // Export data to Excel
\\\

---

## 🛡️ Security & RLS

### Authentication
\\\
✅ Custom auth (username + password_hash)
✅ Password hashing dengan bcrypt
✅ Session management dengan localStorage
✅ Auto-logout on session expire
✅ No Supabase Auth dependency
\\\

### Row Level Security (RLS)
\\\
✅ All tables have RLS enabled
✅ Policies based on custom auth (profiles.id)
✅ Role-based access control
✅ Own data access for karyawan
✅ Project-based access for kepala_lapangan
✅ Full access for admin/owner/superadmin
\\\

### Frontend Guards
\\\javascript
// Triple-layer security
1. RLS policies (database level)
2. Query filters (application level)
3. Frontend guards (UI level)

// Example
if (!canFinance(user.role)) {
  // Hide financial columns
  // Disable financial actions
}
\\\

---

## 🛠️ Tech Stack

| Komponen | Teknologi | Version |
|----------|-----------|---------|
| Frontend | Vanilla JavaScript (ES Modules) | ES2020+ |
| Build Tool | Vite | 6.x |
| Backend | Supabase (PostgreSQL) | Latest |
| Auth | Custom (bcrypt) | — |
| Storage | Supabase Storage | — |
| Styling | Custom CSS | — |
| Icons | Font Awesome | 6.x |
| PWA | Web App Manifest | — |

### CSS Features
\\\
✅ Dark/Light mode toggle
✅ CSS variables for theming
✅ Mobile-first responsive design
✅ Touch targets 44px+ for mobile
✅ Glassmorphism effects
✅ Animated orbs background
✅ Smooth transitions
✅ Bottom navigation for mobile
\\\

---

## 🚀 Recent Updates (v28-v33 + Latest)

### V28 - Leave Status & Activities
\\\
✅ Status baru: libur, izin, sakit
✅ Kolom kegiatan untuk log aktivitas
✅ Migrasi data lama ke status baru
✅ Indexes untuk performa
\\\

### V29 - Salary Payment & Budget
\\\
✅ Tabel salary_payments
✅ Kolom payment_id di attendance_logs
✅ Budget limit & alert threshold di projects
✅ RLS policies untuk salary_payments
\\\

### V30 - RPC Function Fix
\\\
✅ Fix get_rekap_gaji_lengkap()
✅ Support status baru (hadir vs verified)
✅ Backward compatibility
\\\

### V31-V33 - Attendance Status Fixes
\\\
✅ Fix data attendance status inconsistency
✅ Fix generate attendance status function
✅ Fix auto sync attendance status trigger
\\\

### Latest - Overtime Workflow Simplification (7 Mei 2026)
\\\
✅ Karyawan: input tanggal, proyek, keterangan, foto
✅ Admin: approve dengan input durasi
✅ Sistem auto-calc upah
✅ Admin: edit durasi setelah approved
✅ Status: pending → approved / rejected
✅ Kolom verified_by untuk tracking
\\\

### Latest - Dashboard Access Control (7 Mei 2026)
\\\
✅ Notifikasi bon role-specific
✅ Pengeluaran hari ini admin-only
✅ Role-based views untuk stats
\\\

---

## 📊 Progress Summary

| Kategori | Fitur | Status |
|----------|-------|--------|
| **Auth & User** | 8 | ✅ 100% |
| **Dashboard** | 6 | ✅ 100% |
| **Absensi** | 12 | ✅ 100% |
| **Lembur** | 8 | ✅ 100% |
| **Penugasan** | 10 | ✅ 100% |
| **Proyek** | 8 | ✅ 100% |
| **Bon/Kasbon** | 6 | ✅ 100% |
| **Material** | 7 | ✅ 100% |
| **Pengeluaran** | 6 | ✅ 100% |
| **Gaji** | 7 | ✅ 100% |
| **Laporan** | 10 | ✅ 100% |
| **TOTAL** | **88** | **✅ 100%** |

---

## 🌐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| \VITE_SUPABASE_URL\ | ✅ | Supabase project URL |
| \VITE_SUPABASE_ANON_KEY\ | ✅ | Supabase anon key |
| \VITE_SUPABASE_SERVICE_KEY\ | ✅ | Supabase service role key |

---

## 📚 Documentation

- **README.md** - Main documentation & setup guide
- **CHANGELOG.md** - Version history & changes
- **DATABASE-SCHEMA.md** - Complete database schema (v30)
- **STRUKTUR-APLIKASI.md** - This file (application structure)
- **OVERTIME-WORKFLOW-UPDATE.md** - Overtime workflow details

---

## 🎯 Future Enhancements

### Planned Features
\\\
🔲 Advanced analytics & charts
🔲 Notification system (push notifications)
🔲 Document management
🔲 Inventory management
🔲 Multi-project dashboard
🔲 Mobile app (native)
🔲 Offline mode (PWA improvements)
🔲 Real-time updates (WebSocket)
\\\

### Optimization Opportunities
\\\
🔲 Code splitting for faster load
🔲 Image lazy loading
🔲 Service worker for offline
🔲 Database query optimization
🔲 Caching strategy
\\\

---

> **Note**: Aplikasi ini production-ready dan aktif digunakan untuk manajemen proyek konstruksi.  
> Untuk detail teknis schema database, lihat **DATABASE-SCHEMA.md**.  
> Untuk setup & deployment, lihat **README.md**.

