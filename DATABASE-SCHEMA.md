# 📊 Ringkasan Schema Database — Barotech

> Dokumen referensi lengkap semua tabel, kolom, tipe data, constraint, dan relasi di database PostgreSQL (Supabase).

---

## 📋 Daftar Tabel

| # | Tabel | Deskripsi | Rows (est) |
|---|-------|-----------|------------|
| 1 | `profiles` | Data user / karyawan | ~50 |
| 2 | `projects` | Data proyek | ~20 |
| 3 | `attendance_logs` | Absensi harian + keuangan | ~1.000+/bln |
| 4 | `overtime_logs` | Lembur terpisah | ~100+/bln |
| 5 | `project_updates` | Laporan progress proyek | ~200 |
| 6 | `project_photos` | Foto progress (multi per laporan) | ~800 |
| 7 | `project_assignments` | Penugasan karyawan ke proyek | ~100 |
| 8 | `bon_transactions` | Riwayat bon / kasbon | ~500 |
| 9 | `material_orders` | Order material | ~300 |
| 10 | `material_photos` | Foto nota / barang material | ~600 |
| 11 | `project_expenses` | Pengeluaran proyek | ~500 |

---

## 1. `profiles` — Data User / Karyawan

```sql
CREATE TABLE profiles (
  id                UUID PRIMARY KEY,
  email             TEXT UNIQUE,
  username          TEXT UNIQUE NOT NULL,
  password_hash     TEXT,
  full_name         TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'karyawan',
  whatsapp_number   TEXT,
  jabatan           TEXT DEFAULT 'Karyawan',
  basic_salary      NUMERIC DEFAULT 0,      -- Gaji pokok / HARI
  overtime_rate     NUMERIC DEFAULT 0,      -- Ongkos lembur / JAM
  bon_balance       NUMERIC DEFAULT 0,      -- Saldo bon saat ini
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `role` ∈ (`superadmin`, `owner`, `admin`, `kepala_proyek`, `kepala_gudang`, `kepala_lapangan`, `karyawan`)

**Indexes:**
- `profiles_username_idx` (username) — untuk login

**Relasi:**
- Direferensi oleh hampir semua tabel (FK `employee_id`, `created_by`, `recorded_by`, dll)

---

## 2. `projects` — Data Proyek

```sql
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  location_name TEXT,
  lead_id       UUID REFERENCES profiles(id),
  progress_pct  INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  status        TEXT DEFAULT 'aktif',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `status` ∈ (`aktif`, `selesai`, `pending`)

**Relasi:**
- `lead_id` → `profiles.id` (Kepala Proyek / Kepala Lapangan)
- Direferensi oleh: `attendance_logs`, `project_assignments`, `project_updates`, `project_photos`, `material_orders`, `material_photos`, `project_expenses`, `bon_transactions`

**Trigger:**
- `end_project_assignments` — saat `status` = `selesai`, auto-end semua penugasan aktif

---

## 3. `attendance_logs` — Absensi Harian & Keuangan

```sql
CREATE TABLE attendance_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID REFERENCES profiles(id),
  project_id        UUID REFERENCES projects(id),
  status            TEXT DEFAULT 'draft',     -- draft | verified | absent
  check_in          TIMESTAMPTZ,               -- Jam masuk (dulu TIME, sekarang TIMESTAMPTZ)
  check_out         TIMESTAMPTZ,               -- Jam keluar
  notes             TEXT DEFAULT 'Hadir',
  basic_salary      NUMERIC DEFAULT 0,         -- Gaji dasar / HARI (total dari komponen)
  hourly_rate       NUMERIC DEFAULT 0,         -- Upah per jam (basic_salary ÷ 8)
  overtime_hours    NUMERIC DEFAULT 0,         -- Lama lembur (jam)
  overtime_rate     NUMERIC DEFAULT 0,         -- Ongkos lembur / jam
  overtime_pay      NUMERIC DEFAULT 0,         -- Total lembur (hours × rate)
  uang_makan        NUMERIC DEFAULT 0,         -- Komponen: uang makan
  transport         NUMERIC DEFAULT 0,         -- Komponen: transport
  tunjangan_lain    NUMERIC DEFAULT 0,         -- Komponen: tunjangan lain
  misc_amount       NUMERIC DEFAULT 0,         -- Lain-lain (manual input)
  misc_description  TEXT,                      -- Keterangan lain-lain
  cash_advance      NUMERIC DEFAULT 0,         -- Potongan kasbon
  cash_payout       NUMERIC DEFAULT 0,         -- Pinjam baru
  jabatan_snapshot  TEXT,                      -- Jabatan saat absensi
  work_items        TEXT,                      -- Item pekerjaan
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `status` ∈ (`draft`, `verified`, `absent`)

**Trigger:**
- `recalc_attendance_salary` — saat `check_in`/`check_out`/`hourly_rate` berubah, auto-recalc `basic_salary` dari durasi kerja

**Relasi:**
- `employee_id` → `profiles.id`
- `project_id` → `projects.id` (nullable — untuk non-karyawan office)

---

## 4. `overtime_logs` — Lembur Terpisah

```sql
CREATE TABLE overtime_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id    UUID REFERENCES attendance_logs(id) ON DELETE SET NULL,
  employee_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  overtime_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time       TIME,
  end_time         TIME,
  duration_hours   NUMERIC DEFAULT 0,
  overtime_rate    NUMERIC DEFAULT 0,
  overtime_pay     NUMERIC DEFAULT 0,
  location_name    TEXT,
  work_description TEXT,
  photo_url        TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Relasi:**
- `attendance_id` → `attendance_logs.id` (nullable — lembur bisa tanpa absensi harian)
- `employee_id` → `profiles.id`
- `project_id` → `projects.id`
- `created_by` → `profiles.id`

---

## 5. `project_updates` — Laporan Progress

```sql
CREATE TABLE project_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id),
  reported_by UUID REFERENCES profiles(id),
  percentage  INTEGER DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  description TEXT,
  photo_url   TEXT,                            -- Legacy (1 foto)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Relasi:**
- `project_id` → `projects.id`
- `reported_by` → `profiles.id`

---

## 6. `project_photos` — Foto Progress (Multi)

```sql
CREATE TABLE project_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  update_id   UUID REFERENCES project_updates(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  photo_order INTEGER DEFAULT 1,
  taken_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Relasi:**
- `project_id` → `projects.id`
- `update_id` → `project_updates.id`
- `uploaded_by` → `profiles.id`

---

## 7. `project_assignments` — Penugasan Karyawan ke Proyek

```sql
CREATE TABLE project_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  basic_salary  NUMERIC NOT NULL DEFAULT 0,  -- Total / HARI (auto-calc dari komponen)
  uang_makan    NUMERIC NOT NULL DEFAULT 0,
  transport     NUMERIC NOT NULL DEFAULT 0,
  tunjangan_lain NUMERIC NOT NULL DEFAULT 0,
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date      DATE,                         -- NULL = sampai proyek selesai
  status        TEXT NOT NULL DEFAULT 'active',
  notes         TEXT,
  paused_by_id  UUID REFERENCES project_assignments(id),
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `status` ∈ (`active`, `paused`, `ended`)

**Indexes:**
- `idx_assignments_employee` (employee_id)
- `idx_assignments_project` (project_id)
- `idx_assignments_status` (status)
- `idx_assignments_dates` (start_date, end_date)

**Relasi:**
- `employee_id` → `profiles.id`
- `project_id` → `projects.id`
- `paused_by_id` → `project_assignments.id` (self-ref: assignment baru yang mem-pause ini)
- `created_by` → `profiles.id`

**Trigger:**
- `auto_pause_previous_assignment` — saat insert baru, pause assignment lama karyawan tersebut
- `auto_resume_paused_assignment` — saat assignment di-ended/paused, resume assignment yang di-pause-nya
- `trg_calc_assignment_salary` — auto-calc `basic_salary` = uang_makan + transport + tunjangan_lain
- `trg_sync_attendance_insert` — sync ke `attendance_logs` saat assignment aktif dibuat
- `trg_sync_attendance_update` — sync ke `attendance_logs` saat assignment di-update
- `trg_sync_attendance_delete` — hapus draft attendance saat assignment dihapus

---

## 8. `bon_transactions` — Riwayat Bon / Kasbon

```sql
CREATE TABLE bon_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,                 -- pinjam | bayar
  amount        NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,   -- Auto via trigger
  description   TEXT,
  attendance_id UUID REFERENCES attendance_logs(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `type` ∈ (`pinjam`, `bayar`)

**Relasi:**
- `employee_id` → `profiles.id`
- `project_id` → `projects.id` (nullable)
- `attendance_id` → `attendance_logs.id` (nullable)
- `created_by` → `profiles.id`

**Trigger:**
- `update_bon_balance` — update `profiles.bon_balance` saat insert (`pinjam` = +, `bayar` = -)

---

## 9. `material_orders` — Order Material

```sql
CREATE TABLE material_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  order_type    TEXT NOT NULL DEFAULT 'gudang',   -- gudang | customer | beli_lokasi
  material_name TEXT NOT NULL,
  quantity      NUMERIC NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'unit',
  unit_price    NUMERIC NOT NULL DEFAULT 0,
  total_price   NUMERIC NOT NULL DEFAULT 0,       -- Auto-calc qty × unit_price
  supplier_name TEXT,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | completed
  ordered_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraints:**
- `order_type` ∈ (`gudang`, `customer`, `beli_lokasi`)
- `status` ∈ (`pending`, `approved`, `rejected`, `completed`)

**Indexes:**
- `idx_material_orders_project` (project_id)
- `idx_material_orders_status` (status)

**Trigger:**
- `on_material_order_calc` — auto-calc `total_price` = quantity × unit_price

**Relasi:**
- `project_id` → `projects.id`
- `ordered_by` → `profiles.id`

---

## 10. `material_photos` — Foto Nota / Barang Material

```sql
CREATE TABLE material_photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_order_id UUID NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  photo_url         TEXT NOT NULL,
  caption           TEXT,
  photo_type        TEXT NOT NULL DEFAULT 'nota',  -- nota | barang | lainnya
  uploaded_by       UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `photo_type` ∈ (`nota`, `barang`, `lainnya`)

**Indexes:**
- `idx_material_photos_order` (material_order_id)

**Relasi:**
- `material_order_id` → `material_orders.id`
- `project_id` → `projects.id`
- `uploaded_by` → `profiles.id`

---

## 11. `project_expenses` — Pengeluaran Proyek

```sql
CREATE TABLE project_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  category      TEXT NOT NULL DEFAULT 'lainnya',  -- material | operasional | jasa | lainnya
  description   TEXT NOT NULL,
  amount        NUMERIC NOT NULL DEFAULT 0,
  prev_total    NUMERIC NOT NULL DEFAULT 0,         -- Total sebelum transaksi ini
  running_total NUMERIC NOT NULL DEFAULT 0,         -- prev_total + amount (auto-calc)
  photo_url     TEXT,
  recorded_by   UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Check Constraint:**
- `category` ∈ (`material`, `operasional`, `jasa`, `lainnya`)

**Indexes:**
- `idx_project_expenses_project` (project_id)
- `idx_project_expenses_date` (expense_date)

**Trigger:**
- `on_expense_running_total` — auto-calc `prev_total` & `running_total` per proyek

**Relasi:**
- `project_id` → `projects.id`
- `recorded_by` → `profiles.id`

---

## 🔗 Relasi Antar Tabel (Diagram Tekstual)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           profiles (users)                                │
│  PK: id                                                                 │
│  Fields: username, password_hash, full_name, role, jabatan              │
│          basic_salary, overtime_rate, bon_balance                       │
└────────┬────────────────────────────────────────────────────────────────┘
         │ 1:N
         │
         ├───────────────┬───────────────┬───────────────┬──────────────────┐
         ▼               ▼               ▼               ▼                  ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         ┌──────────┐
   │ projects │   │attendance│   │ overtime │   │  bon_    │   ...   │ material │
   │ (lead_id)│   │  _logs   │   │  _logs   │   │transactns│         │  orders  │
   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘         └────┬─────┘
        │              │              │              │                    │
        │              │              │              │                    │
        │              │              │              │                    ▼
        │              │              │              │              ┌──────────┐
        │              │              │              │              │ material │
        │              │              │              │              │  photos  │
        │              │              │              │              └──────────┘
        │              │              │              │
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ project_ │   │ project_ │   │ project_ │   │ project_ │
   │ updates  │   │  photos  │   │ expenses │   │assignmnts│
   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

### Foreign Key Summary

| Tabel | FK Column | References | On Delete |
|-------|-----------|------------|-----------|
| `projects` | `lead_id` | `profiles.id` | SET NULL |
| `attendance_logs` | `employee_id` | `profiles.id` | — |
| `attendance_logs` | `project_id` | `projects.id` | — |
| `overtime_logs` | `attendance_id` | `attendance_logs.id` | SET NULL |
| `overtime_logs` | `employee_id` | `profiles.id` | CASCADE |
| `overtime_logs` | `project_id` | `projects.id` | SET NULL |
| `overtime_logs` | `created_by` | `profiles.id` | — |
| `project_updates` | `project_id` | `projects.id` | — |
| `project_updates` | `reported_by` | `profiles.id` | — |
| `project_photos` | `project_id` | `projects.id` | CASCADE |
| `project_photos` | `update_id` | `project_updates.id` | CASCADE |
| `project_photos` | `uploaded_by` | `profiles.id` | — |
| `project_assignments` | `employee_id` | `profiles.id` | CASCADE |
| `project_assignments` | `project_id` | `projects.id` | CASCADE |
| `project_assignments` | `paused_by_id` | `project_assignments.id` | — |
| `project_assignments` | `created_by` | `profiles.id` | — |
| `bon_transactions` | `employee_id` | `profiles.id` | CASCADE |
| `bon_transactions` | `project_id` | `projects.id` | SET NULL |
| `bon_transactions` | `attendance_id` | `attendance_logs.id` | SET NULL |
| `bon_transactions` | `created_by` | `profiles.id` | — |
| `material_orders` | `project_id` | `projects.id` | CASCADE |
| `material_orders` | `ordered_by` | `profiles.id` | — |
| `material_photos` | `material_order_id` | `material_orders.id` | CASCADE |
| `material_photos` | `project_id` | `projects.id` | CASCADE |
| `material_photos` | `uploaded_by` | `profiles.id` | — |
| `project_expenses` | `project_id` | `projects.id` | CASCADE |
| `project_expenses` | `recorded_by` | `profiles.id` | — |

---

## ⚙️ Functions & Triggers Database

### Functions

| Nama | Tabel | Kapan Dipanggil | Fungsi |
|------|-------|-----------------|--------|
| `get_my_role()` | — | RLS policies | Ambil role user login saat ini |
| `calc_work_hours(TIMESTAMPTZ, TIMESTAMPTZ)` | — | Trigger | Hitung durasi kerja dalam jam |
| `recalc_attendance_salary()` | `attendance_logs` | BEFORE UPDATE check_in/check_out/hourly_rate | Recalc `basic_salary` dari durasi × hourly_rate |
| `fn_calc_assignment_salary()` | `project_assignments` | BEFORE INSERT/UPDATE uang_makan/transport/tunjangan | Auto-calc `basic_salary` dari komponen |
| `fn_sync_attendance_on_assign_insert()` | `project_assignments` | AFTER INSERT | Insert draft `attendance_logs` dari assignment baru |
| `fn_sync_attendance_on_assign_update()` | `project_assignments` | AFTER UPDATE | Update/delete/insert draft `attendance_logs` |
| `fn_sync_attendance_on_assign_delete()` | `project_assignments` | AFTER DELETE | Hapus draft `attendance_logs` hari ini |
| `auto_pause_previous_assignment()` | `project_assignments` | BEFORE INSERT | Pause assignment lama saat karyawan ditugaskan baru |
| `auto_resume_paused_assignment()` | `project_assignments` | AFTER UPDATE status | Resume assignment yang di-pause saat assignment sementara berakhir |
| `end_project_assignments()` | `projects` | AFTER UPDATE status | End semua assignment saat proyek selesai |
| `generate_daily_attendance(DATE)` | — | Dipanggil manual / otomatis | Generate attendance_logs dari assignment aktif + non-karyawan |
| `update_bon_balance()` | `bon_transactions` | BEFORE INSERT | Update `profiles.bon_balance` (pinjam=+, bayar=-) |
| `calc_material_total()` | `material_orders` | BEFORE INSERT/UPDATE qty, unit_price | Auto-calc `total_price` |
| `calc_expense_running_total()` | `project_expenses` | BEFORE INSERT/UPDATE amount | Auto-calc `prev_total` & `running_total` |
| `get_project_total_expense(UUID)` | — | Query | SUM(amount) project_expenses per proyek |

---

## 🛡️ RLS Policies (Ringkasan)

| Tabel | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | All | superadmin/owner/admin | superadmin/owner/admin | superadmin/owner |
| `projects` | All | superadmin/owner/admin | superadmin/owner/admin | superadmin/owner |
| `attendance_logs` | Own / Role-based | superadmin/owner/admin | Role-based | superadmin/owner |
| `overtime_logs` | Own / Role-based | superadmin/owner/admin | superadmin/owner/admin | superadmin/owner |
| `project_updates` | All | Role-based | superadmin/owner/admin | superadmin/owner |
| `project_photos` | All | Role-based | — | superadmin/owner |
| `project_assignments` | Own / Role-based | superadmin/owner/admin | superadmin/owner/admin | superadmin/owner |
| `bon_transactions` | Own / superadmin/owner/admin | superadmin/owner/admin | — | superadmin/owner |
| `material_orders` | Role-based | superadmin/owner/admin/kepala_gudang | superadmin/owner/admin/kepala_gudang | superadmin/owner |
| `material_photos` | Role-based | superadmin/owner/admin/kepala_gudang | — | superadmin/owner/admin |
| `project_expenses` | Role-based | superadmin/owner/admin | superadmin/owner/admin | superadmin/owner |

---

## 📜 Migrasi SQL (Urutan)

| File | Versi | Deskripsi |
|------|-------|-----------|
| `v1-initial-setup.sql` | V1 | Setup awal: profiles, projects, attendance_logs, project_updates, RLS |
| `v2-kepala-teknik-patch.sql` | V2 | Patch RLS kepala teknik |
| `v3-fase1-jabatan-bon.sql` | V3 | jabatan, bon_balance, bon_transactions, trigger saldo |
| `v4-role-restructure.sql` | V4 | 7 role baru, status proyek, RLS update |
| `v4b-fix-trigger-role.sql` | V4b | Fix trigger role |
| `v4c-seed-test-accounts.sql` | V4c | Seed data test |
| `v5-fase2-overtime-photos.sql` | V5 | overtime_logs, project_photos, status attendance |
| `v6-work-items.sql` | V6 | Kolom work_items di attendance_logs |
| `v7-project-assignments.sql` | V7 | project_assignments + trigger auto-pause/resume |
| `v7b-fix-assignment-trigger.sql` | V7b | Fix trigger assignment |
| `v8-attendance-edit.sql` | V8 | hourly_rate, edit absensi, recalc trigger |
| `v8b-fix-generate-function.sql` | V8b | Fix generate_daily_attendance |
| `v9-material-expenses.sql` | V9 | material_orders, material_photos, project_expenses |
| `v10-custom-auth.sql` | V10 | Custom auth: username, password_hash (drop FK auth.users) |
| `v10-role-rename.sql` | V10 | Rename role: kepala_teknik→kepala_proyek, kepala_proyek→kepala_lapangan |
| `v11-fix-rls-custom-auth.sql` | V11 | Fix RLS custom auth |
| `v12-disable-rls-custom-auth.sql` | V12 | Disable RLS sementara |
| `v12-fix-custom-auth-rls.sql` | V12 | Fix custom auth RLS |
| `v13-extend-attendance-non-karyawan.sql` | V13 | Extend attendance untuk non-karyawan roles |
| `v14-add-basic-salary-profiles.sql` | V14 | Tambah basic_salary di profiles |
| `v15-attendance-logs-project-id-nullable.sql` | V15 | project_id nullable di attendance_logs |
| `v15-auto-sync-attendance.sql` | V15 | Auto-sync attendance dari assignment (triggers) |
| `v16-breakdown-keuangan.sql` | V16 | uang_makan, transport, tunjangan_lain + fix TIME→TIMESTAMPTZ |
| `v17-fix-timestamp-cast.sql` | V17 | Fix explicit timestamp cast di functions |
| `v18-add-overtime-rate-profiles.sql` | V18 | Tambah overtime_rate di profiles |

---

> **Catatan:** Dokumen ini disusun dari hasil agregasi semua file migrasi SQL (`sql/v1` sampai `sql/v18`). Jika ada perubahan schema baru, update file ini.
