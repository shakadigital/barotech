# Barotech Management System

Sistem manajemen proyek konstruksi berbasis web untuk mengelola karyawan, proyek, absensi, lembur, gaji, dan pengeluaran.

## 🚀 Features

### Core Modules
- **👥 Employee Management** - Kelola data karyawan dengan role-based access
- **🏗️ Project Management** - Manajemen proyek konstruksi dengan assignment
- **📍 Attendance Tracking** - Absensi dengan GPS dan foto bukti
- **⏰ Overtime Management** - Pengajuan dan approval lembur (workflow sederhana)
- **💰 Salary & Payment** - Tracking gaji dan pembayaran karyawan
- **💳 Bon (Advance)** - Manajemen bon/kasbon karyawan
- **📦 Material & Expenses** - Tracking material dan pengeluaran proyek
- **📊 Reporting** - Laporan komprehensif (gaji, bon, kegiatan, rekap proyek)
- **📝 Daily Activities** - Log kegiatan harian karyawan

### User Roles
1. **Owner** - Akses penuh ke semua fitur
2. **Superadmin** - Akses penuh ke semua fitur
3. **Admin** - Akses administratif (input data, approval)
4. **Kepala Proyek** - Manajemen proyek dan tim
5. **Kepala Gudang** - Manajemen material dan gudang
6. **Kepala Lapangan** - Supervisi lapangan dan absensi
7. **Karyawan** - Akses terbatas (absensi, pengajuan lembur, lihat data sendiri)

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (untuk foto)
- **Authentication**: Custom authentication system
- **Deployment**: Vercel
- **PWA**: Progressive Web App ready

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm atau yarn
- Supabase account
- Vercel account (untuk deployment)

## 🔧 Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/shakadigital/barotech.git
   cd barotech
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   
   Copy `.env.example` ke `.env` dan isi dengan credentials Supabase:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Setup database**
   
   Jalankan SQL migrations di Supabase SQL Editor:
   ```bash
   # Jalankan file-file SQL secara berurutan dari folder sql/
   sql/v1-initial-setup.sql
   sql/v2-kepala-teknik-patch.sql
   # ... dan seterusnya
   ```
   
   Atau gunakan file lengkap:
   ```bash
   database-setup.sql
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
barotech/
├── src/
│   ├── lib/
│   │   ├── supabase.js      # Supabase client
│   │   ├── helpers.js       # Helper functions
│   │   ├── roles.js         # Role definitions
│   │   └── excel-export.js  # Excel export utility
│   ├── pages/
│   │   ├── dashboard.js     # Dashboard page
│   │   ├── attendance.js    # Attendance management
│   │   ├── overtime.js      # Overtime management
│   │   ├── assignment.js    # Project assignments
│   │   ├── users.js         # User management
│   │   ├── project.js       # Project management
│   │   ├── bon.js           # Bon/advance management
│   │   ├── material.js      # Material tracking
│   │   ├── expense.js       # Expense tracking
│   │   ├── salary-payment.js # Salary payments
│   │   └── laporan-*.js     # Various reports
│   ├── main.js              # Main application logic
│   └── style.css            # Global styles
├── sql/                     # Database migrations
├── public/                  # Static assets
├── index.html               # Entry point
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies

```

## 📖 Documentation

- **[DATABASE-SCHEMA.md](DATABASE-SCHEMA.md)** - Complete database schema
- **[STRUKTUR-APLIKASI.md](STRUKTUR-APLIKASI.md)** - Application architecture
- **[OVERTIME-WORKFLOW-UPDATE.md](OVERTIME-WORKFLOW-UPDATE.md)** - Overtime workflow details
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

## 🔐 Authentication

Aplikasi menggunakan **custom authentication system** (bukan Supabase Auth):
- Password di-hash menggunakan bcrypt
- Session disimpan di localStorage
- RLS policies menggunakan custom auth context

### Default Admin Account
Setelah setup database, buat admin account dengan menjalankan:
```sql
-- Lihat file: scratch/bootstrap_admin.js
```

## 🚦 Workflow Overview

### Attendance Workflow
1. Kepala Lapangan/Admin generate attendance untuk proyek
2. Karyawan check-in dengan GPS dan foto
3. Karyawan check-out di akhir hari
4. Admin verifikasi attendance

### Overtime Workflow (Simplified)
1. **Karyawan** mengajukan lembur (tanggal, proyek, keterangan, foto)
2. **Admin** review dan approve dengan input durasi
3. Sistem otomatis hitung upah: durasi × overtime_rate
4. **Admin** bisa edit durasi jika diperlukan

### Salary Payment Workflow
1. Admin lihat rekap gaji karyawan (gaji pokok + lembur - bon)
2. Admin input pembayaran gaji
3. Sistem update saldo bon dan status pembayaran

## 🎨 Features Highlights

### Dashboard
- Role-based views
- Quick stats (personil, proyek aktif, hadir, belum absen)
- Notifikasi bon mendekati batas (role-specific)
- Pengeluaran hari ini (admin only)

### Attendance
- GPS tracking
- Photo evidence
- Self check-in untuk kepala lapangan/proyek
- Bulk attendance generation
- Status: hadir, tidak hadir, izin, sakit, libur

### Overtime
- Simplified request form untuk karyawan
- Admin approval dengan input durasi
- Edit durasi untuk koreksi
- Photo evidence support

### Reporting
- Laporan Gaji (per karyawan, per periode)
- Laporan Bon (history bon karyawan)
- Laporan Kegiatan (daily activities)
- Rekap Gaji (summary gaji + lembur - bon)
- Rekap Proyek (biaya proyek lengkap)

## 🔒 Security

- Custom authentication dengan password hashing
- Row Level Security (RLS) policies
- Role-based access control
- Input validation dan sanitization
- Secure file upload dengan compression

## 🚀 Deployment

### Vercel Deployment
1. Push code ke GitHub
2. Import project di Vercel
3. Set environment variables
4. Deploy

### Environment Variables (Vercel)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🐛 Troubleshooting

### Database Connection Issues
- Pastikan Supabase URL dan Anon Key benar
- Cek RLS policies sudah aktif
- Verifikasi custom auth context

### Authentication Issues
- Clear localStorage dan login ulang
- Pastikan password di-hash dengan benar
- Cek role user di database

### Performance Issues
- Pastikan indexes sudah dibuat (lihat sql/v21-performance-optimization.sql)
- Gunakan RPC functions untuk query kompleks
- Enable caching di browser

## 📝 License

Proprietary - All rights reserved

## 👥 Contributors

- Development Team - Shaka Digital

## 📞 Support

Untuk support dan pertanyaan, hubungi tim development.

---

**Version**: Latest (7 Mei 2026)  
**Status**: Production Ready ✅
