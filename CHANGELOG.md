# Changelog - Barotech Management System

## [Latest] - 7 Mei 2026

### Added
- **Simplifikasi Workflow Pengajuan Lembur**
  - Karyawan hanya input: tanggal, proyek, keterangan, foto
  - Durasi dan biaya diisi oleh admin saat approve
  - Admin input durasi via prompt saat approve lembur
  - Sistem otomatis hitung upah: durasi × overtime_rate

- **Fitur Edit Lembur untuk Admin**
  - Admin bisa edit durasi dan upah lembur yang sudah approved/rejected
  - Tombol edit muncul di kolom aksi untuk lembur non-pending
  - Delete tetap hanya untuk superadmin & owner

- **Pembatasan Akses Dashboard**
  - Notifikasi bon hanya tampil untuk owner/admin/superadmin (semua karyawan) dan user bersangkutan (bon sendiri)
  - Pengeluaran hari ini hanya tampil untuk owner/admin/superadmin
  - Role lain tidak melihat pengeluaran hari ini di dashboard

### Changed
- Form pengajuan lembur karyawan disederhanakan
- Kolom aksi di riwayat lembur sekarang menampilkan tombol edit untuk admin

### Documentation
- `OVERTIME-WORKFLOW-UPDATE.md` - Dokumentasi workflow lembur baru
- `DATABASE-SCHEMA.md` - Skema database lengkap
- `STRUKTUR-APLIKASI.md` - Struktur aplikasi dan arsitektur

---

## [v32] - Sebelumnya

### Fixed
- Fix generate attendance status function
- Fix auto sync attendance status trigger
- Perbaikan data attendance status

### Added
- Salary payment and budget tracking
- Fix rekap gaji RPC function
- Leave status and daily activities tracking

---

## [v28] - Sebelumnya

### Added
- Custom authentication system (non-Supabase Auth)
- Role-based access control (RLS) dengan custom auth
- Daily activities tracking
- Performance optimization (indexes, RPC functions)
- Material workflow improvements
- Assignment logout fix
- Attendance status improvements

### Changed
- Migrasi dari Supabase Auth ke custom authentication
- Optimasi query dengan indexes
- Perbaikan RLS policies untuk custom auth

---

## Features Overview

### Core Features
- ✅ Custom Authentication System
- ✅ Role-Based Access Control (7 roles)
- ✅ Project Management
- ✅ Employee Management
- ✅ Attendance Tracking (with GPS)
- ✅ Overtime Management (simplified workflow)
- ✅ Salary & Payment Tracking
- ✅ Bon (Advance) Management
- ✅ Material & Expense Tracking
- ✅ Daily Activities Log
- ✅ Comprehensive Reporting

### User Roles
1. **Owner** - Full access
2. **Superadmin** - Full access
3. **Admin** - Administrative access
4. **Kepala Proyek** - Project head access
5. **Kepala Gudang** - Warehouse head access
6. **Kepala Lapangan** - Field supervisor access
7. **Karyawan** - Employee access

### Recent Improvements
- Simplified overtime request workflow
- Enhanced admin controls for overtime management
- Dashboard access restrictions by role
- Performance optimizations
- Better RLS policies

---

## Technical Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Custom (non-Supabase Auth)
- **Deployment**: Vercel

---

## Migration Notes

### Custom Auth Migration (v28)
- Aplikasi tidak lagi menggunakan Supabase Auth
- Semua autentikasi menggunakan tabel `profiles` dengan password hash
- RLS policies disesuaikan untuk custom auth
- Session management menggunakan localStorage

### Database Optimizations (v21-v23)
- Added indexes untuk performa query
- RPC functions untuk rekap data
- Optimasi attendance status generation

---

## Known Issues & Solutions

### Resolved
- ✅ Assignment logout issue - Fixed
- ✅ Attendance status data inconsistency - Fixed
- ✅ Material workflow - Fixed
- ✅ Salary payment calculation - Fixed
- ✅ RLS policies for custom auth - Fixed
- ✅ Overtime workflow complexity - Simplified

---

## Future Enhancements
- [ ] Mobile app (PWA improvements)
- [ ] Advanced reporting & analytics
- [ ] Notification system
- [ ] Document management
- [ ] Inventory management
- [ ] Multi-project dashboard

---

For detailed technical documentation, see:
- `DATABASE-SCHEMA.md` - Complete database schema
- `STRUKTUR-APLIKASI.md` - Application structure
- `OVERTIME-WORKFLOW-UPDATE.md` - Overtime workflow details
