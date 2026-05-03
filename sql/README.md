# SQL Migrations — Barotech V2

Setiap file adalah migration terpisah. Jalankan **hanya file yang belum dijalankan** secara berurutan di Supabase SQL Editor.

| File | Isi | Status |
|------|-----|--------|
| `v1-initial-setup.sql` | Tabel awal, RLS, trigger user | ✅ Sudah |
| `v2-kepala-teknik-patch.sql` | Koreksi RLS kepala teknik (UPDATE only) | ✅ Sudah |
| `v3-fase1-jabatan-bon.sql` | Kolom jabatan, bon_balance, tabel bon_transactions | ✅ Sudah |
| `v4-role-restructure.sql` | Role baru (kepala_gudang, kepala_proyek), RLS update, status proyek | ✅ Sudah |
| `v4b-fix-trigger-role.sql` | Fix trigger handle_new_user untuk support role baru | ✅ Sudah |
| `v4c-seed-test-accounts.sql` | Seed akun test kepala_gudang & kepala_proyek | ✅ Sudah |
| `v5-fase2-overtime-photos.sql` | Tabel overtime_logs, project_photos, kolom status attendance | ✅ Sudah |
| `v6-work-items.sql` | Kolom work_items di attendance_logs | ✅ Sudah |
| `v7-project-assignments.sql` | Tabel project_assignments, triggers auto-pause/resume/end, function generate_daily_attendance | ✅ Sudah |
| `v7b-fix-assignment-trigger.sql` | Fix trigger BEFORE→AFTER INSERT untuk foreign key paused_by_id | ✅ Sudah |
| `v8-attendance-edit.sql` | Kolom hourly_rate, trigger recalc gaji, update generate_daily_attendance | ✅ Sudah |
| `v8b-fix-generate-function.sql` | Fix ambiguous column di generate_daily_attendance | ✅ Sudah |

## Aturan
- File yang sudah ✅ **jangan dijalankan ulang** — akan error karena policy/tabel sudah ada
- File baru selalu diberi prefix `v{n}-` sesuai urutan
- Setelah dijalankan, ubah status di tabel ini menjadi ✅
