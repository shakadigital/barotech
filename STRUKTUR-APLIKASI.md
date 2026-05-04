# 🏗️ Struktur Aplikasi Absensi Barotech (Lengkap)

> Dokumen ini mencakup fitur yang **sudah ada** dan yang **belum ada (target pengembangan)**.

## 📌 Legenda

| Simbol | Arti |
|--------|------|
| ✅ | Sudah selesai & berjalan |
| 🔧 | Sudah ada tapi perlu perbaikan/tambahan |
| ❌ | Belum ada, perlu dibangun |
| 🛠️ | Baru diperbaiki / dikoreksi |

---

## 📁 Struktur File

```
absensi-barotech/
│
├── 📄 index.html                       ✅ Entry point, layout sidebar & bottom nav
├── 📄 package.json                     ✅ Dependencies: vite, @supabase/supabase-js
├── 📄 .env                             ✅ Credentials Supabase (tidak di-commit)
├── 📄 .env.example                     ✅ Template credentials
├── 📄 .gitignore                       ✅
├── 📄 database-setup.sql               ✅ Index file SQL migrations
├── 📄 STRUKTUR-APLIKASI.md             ✅ File ini
│
├── 📁 sql/                             ✅ Migration files terpisah per versi
│   ├── 📄 README.md                    ✅ Panduan urutan & status migration
│   ├── 📄 v1-initial-setup.sql         ✅ Setup awal
│   ├── 📄 v2-kepala-teknik-patch.sql   ✅ Patch RLS kepala teknik
│   ├── 📄 v3-fase1-jabatan-bon.sql     ✅ Jabatan, bon_balance, bon_transactions
│   ├── 📄 v4-role-restructure.sql      ✅ Role baru, RLS update, status proyek
│   ├── 📄 v5-fase2-overtime-photos.sql ✅ SUDAH DIJALANKAN — overtime_logs, project_photos
│   ├── 📄 v6-work-items.sql            ✅ SUDAH DIJALANKAN — kolom work_items di attendance_logs
│   ├── 📄 v7-project-assignments.sql   ✅ SUDAH DIJALANKAN — tabel project_assignments
│   ├── 📄 v7b-fix-assignment-trigger.sql ✅ SUDAH DIJALANKAN — fix trigger penugasan
│   ├── 📄 v8-attendance-edit.sql         ✅ SUDAH DIJALANKAN — hourly_rate & edit absensi
│   ├── 📄 v8b-fix-generate-function.sql  ✅ SUDAH DIJALANKAN — fix generate_daily_attendance
│   ├── 📄 v9-material-expenses.sql       ✅ SUDAH DIJALANKAN — material_orders, material_photos, project_expenses
│   └── 📄 v10-role-rename.sql            ✅ SUDAH — rename role: kepala_teknik→kepala_proyek, kepala_proyek→kepala_lapangan
│
├── 📁 src/
│   ├── 📄 main.js                      ✅ Entry point app, state, routing
│   ├── 📄 style.css                    ✅ Tema teal-green glassmorphism
│   ├── 📄 style.css.backup             ✅ Backup tema lama (ungu)
│   ├── 📁 lib/
│   │   ├── 📄 supabase.js              ✅ Supabase client (anon + admin)
│   │   ├── 📄 roles.js                 ✅ Konstanta & helper akses per role
│   │   └── 📄 helpers.js               ✅ Helper format & toast (fmtIdr, fmtDate, showToast)
│   └── 📁 pages/
│       ├── 📄 dashboard.js             ✅ Beranda
│       ├── 📄 attendance.js            ✅ Absensi (plotting + verifikasi + edit)
│       ├── 📄 overtime.js              ✅ Lembur terpisah
│       ├── 📄 laporan.js               ✅ Laporan progress (multi-foto)
│       ├── 📄 project.js               ✅ Kelola proyek + status
│       ├── 📄 bon.js                   ✅ Bon / Kasbon
│       ├── 📄 users.js                 ✅ Kelola user
│       ├── 📄 riwayat.js               ✅ Riwayat absensi karyawan
│       └── 📄 assignment.js            ✅ Penugasan karyawan ke proyek (gaji, tanggal, auto-pause)
│
└── 📁 public/
    ├── 🖼️ bg.png / splash.png          ✅ Background & splash
    ├── 🖼️ favicon.*                    ✅ Icon set
    ├── 📄 manifest.json                ✅ PWA manifest
    └── 📄 site.webmanifest             ✅ PWA webmanifest
```

---

## 🗄️ Struktur Database

### Tabel `profiles` — Data User
```
id                UUID PK     ✅ Sama dengan auth.users.id
email             TEXT UNIQUE ✅ Saat ini: username@barotech.com (🔧 Rencana: input email sungguhan, opsional)
username          TEXT UNIQUE ✅ Untuk login (bukan email)
password_hash     TEXT        ✅ Password plain (custom auth)
full_name         TEXT        ✅ Nama lengkap
role              TEXT        ✅ 7 role (lihat daftar role)
whatsapp_number   TEXT        ✅ Nomor WhatsApp
jabatan           TEXT        ✅ Jabatan lapangan (Mandor, Tukang, Kenek, dll)
bon_balance       NUMERIC     ✅ Saldo bon/kasbon saat ini (auto-update via trigger)
created_at        TIMESTAMP   ✅ Auto
```

**Role sistem (7 level):**
| # | Role | Akses Keuangan | Delete | Keterangan |
|---|------|:-:|:-:|---|
| 1 | `superadmin` | ✅ | ✅ | Akses penuh |
| 2 | `owner` | ✅ | ✅ | Akses penuh |
| 3 | `admin` | ✅ | ❌ | CRUD kecuali delete, bisa update status proyek |
| 4 | `kepala_proyek` | ❌ | ❌ | Verifikasi absensi semua proyek, lihat lembur |
| 5 | `kepala_gudang` | ❌ | ❌ | Lihat absensi semua proyek (read-only) |
| 6 | `kepala_lapangan` | ❌ | ❌ | Verifikasi absensi proyeknya sendiri, laporan |
| 7 | `karyawan` | ❌ | ❌ | Hanya lihat riwayat absensi sendiri |

---

### Tabel `projects` — Data Proyek
```
id                UUID PK     ✅
name              TEXT        ✅ Nama proyek
location_name     TEXT        ✅ Lokasi proyek
lead_id           UUID FK     ✅ → profiles.id (kepala_proyek / kepala_lapangan)
progress_pct      INTEGER     ✅ Progress 0–100%
status            TEXT        ✅ "aktif" | "selesai" | "pending"
created_at        TIMESTAMP   ✅ Auto

── BELUM ADA (target) ───────────────────────
total_expense     NUMERIC     ✅ Total pengeluaran proyek (computed via query project_expenses)
```

---

### Tabel `attendance_logs` — Absensi & Keuangan Harian
```
id                UUID PK     ✅
employee_id       UUID FK     ✅ → profiles.id
project_id        UUID FK     ✅ → projects.id
status            TEXT        ✅ "draft" | "verified" | "absent"
check_in          TIME        ✅ Jam masuk
check_out         TIME        ✅ Jam keluar
notes             TEXT        ✅ "Hadir" / "Tidak Hadir" / "Pending"
basic_salary      NUMERIC     ✅ Gaji dasar (Rp)
overtime_hours    NUMERIC     ✅ Jam lembur inline
overtime_rate     NUMERIC     ✅ Upah lembur/jam inline (Rp)
overtime_pay      NUMERIC     ✅ Total lembur inline
misc_amount       NUMERIC     ✅ Tunjangan lain-lain (Rp)
misc_description  TEXT        ✅ Keterangan lain-lain
cash_advance      NUMERIC     ✅ Potongan kasbon (Rp)
cash_payout       NUMERIC     ✅ Pinjam baru / uang keluar (Rp)
jabatan_snapshot  TEXT        ✅ Jabatan saat absensi (snapshot)
work_items        TEXT        ✅ Item pekerjaan yang dikerjakan (v6)
hourly_rate       NUMERIC     ✅ Upah per jam (v8 — auto dari basic_salary÷8)
created_at        TIMESTAMP   ✅ Auto
```

---

### Tabel `overtime_logs` — Lembur Terpisah ✅ BARU
```
id                UUID PK     ✅
attendance_id     UUID FK     ✅ → attendance_logs.id (nullable)
employee_id       UUID FK     ✅ → profiles.id
project_id        UUID FK     ✅ → projects.id
overtime_date     DATE        ✅ Tanggal lembur
start_time        TIME        ✅ Jam mulai lembur
end_time          TIME        ✅ Jam selesai lembur
duration_hours    NUMERIC     ✅ Total jam lembur (auto-kalkulasi)
overtime_rate     NUMERIC     ✅ Upah lembur/jam (Rp)
overtime_pay      NUMERIC     ✅ Total upah lembur
location_name     TEXT        ✅ Lokasi lembur
work_description  TEXT        ✅ Pekerjaan yang dilakukan
photo_url         TEXT        ✅ Foto bukti lembur
created_by        UUID FK     ✅ → profiles.id
created_at        TIMESTAMP   ✅ Auto
```

---

### Tabel `project_updates` — Laporan Progress
```
id                UUID PK     ✅
project_id        UUID FK     ✅ → projects.id
reported_by       UUID FK     ✅ → profiles.id
percentage        INTEGER     ✅ Progress (0–100%)
description       TEXT        ✅ Deskripsi laporan
photo_url         TEXT        🔧 Legacy — digantikan project_photos
created_at        TIMESTAMP   ✅ Auto
```

---

### Tabel `project_photos` — Multiple Foto Progress ✅ BARU
```
id                UUID PK     ✅
project_id        UUID FK     ✅ → projects.id
update_id         UUID FK     ✅ → project_updates.id
uploaded_by       UUID FK     ✅ → profiles.id
photo_url         TEXT        ✅ URL foto di Supabase Storage
caption           TEXT        ✅ Keterangan foto
photo_order       INTEGER     ✅ Urutan foto (1–4)
taken_at          TIMESTAMP   ✅ Waktu foto diambil
created_at        TIMESTAMP   ✅ Auto
```

---

### Tabel `project_assignments` — Penugasan Karyawan ke Proyek ✅ BARU (v7)
```
id                UUID PK     ✅
employee_id       UUID FK     ✅ → profiles.id
project_id        UUID FK     ✅ → projects.id
basic_salary      NUMERIC     ✅ Gaji dasar per hari
start_date        DATE        ✅ Tanggal mulai
end_date          DATE        ✅ Tanggal selesai (NULL = sampai proyek selesai)
status            TEXT        ✅ active | paused | ended
notes             TEXT        ✅ Keterangan penugasan
paused_by_id      UUID FK     ✅ Penugasan yang mem-pause ini (nullable)
created_by        UUID FK     ✅ → profiles.id
created_at        TIMESTAMP   ✅ Auto
updated_at        TIMESTAMP   ✅ Auto
```

**Trigger:**
- `auto_pause_previous_assignment` — pause penugasan lama saat karyawan ditugaskan ke proyek baru
- `auto_resume_paused_assignment` — resume penugasan lama saat penugasan sementara berakhir
- `end_project_assignments` — auto-end semua penugasan saat proyek ditandai selesai

**Function:**
- `generate_daily_attendance(p_date)` — auto-generate baris attendance_logs dari penugasan aktif hari itu

---

### Tabel `bon_transactions` — Riwayat Bon/Kasbon ✅
```
id                UUID PK     ✅
employee_id       UUID FK     ✅ → profiles.id
project_id        UUID FK     ✅ → projects.id (nullable)
type              TEXT        ✅ "pinjam" | "bayar"
amount            NUMERIC     ✅ Jumlah transaksi (Rp)
balance_after     NUMERIC     ✅ Saldo bon setelah transaksi (auto via trigger)
description       TEXT        ✅ Keterangan
attendance_id     UUID FK     ✅ → attendance_logs.id (nullable)
created_by        UUID FK     ✅ → profiles.id
created_at        TIMESTAMP   ✅ Auto
```

---

### Tabel `material_orders` — Order Material ✅ BARU (v9)
```
id              UUID PK     ✅
project_id      UUID FK     ✅ → projects.id
order_date      DATE        ✅ Tanggal order
order_type      TEXT        ✅ gudang | customer | beli_lokasi
material_name   TEXT        ✅ Nama material
quantity        NUMERIC     ✅ Jumlah
unit            TEXT        ✅ Satuan (kg, sak, meter, dll)
unit_price      NUMERIC     ✅ Harga satuan (Rp)
total_price     NUMERIC     ✅ Total harga (auto-calc qty × unit_price)
supplier_name   TEXT        ✅ Nama supplier
description     TEXT        ✅ Keterangan
status          TEXT        ✅ pending | approved | rejected | completed
ordered_by      UUID FK     ✅ → profiles.id
created_at      TIMESTAMP   ✅ Auto
```

---

### Tabel `material_photos` — Foto Nota Material ✅ BARU (v9)
```
id                UUID PK     ✅
material_order_id UUID FK     ✅ → material_orders.id
project_id        UUID FK     ✅ → projects.id
photo_url         TEXT        ✅ URL foto di Supabase Storage
caption           TEXT        ✅ Keterangan foto
photo_type        TEXT        ✅ nota | barang | lainnya
uploaded_by       UUID FK     ✅ → profiles.id
created_at        TIMESTAMP   ✅ Auto
```

---

### Tabel `project_expenses` — Pengeluaran Proyek ✅ BARU (v9)
```
id              UUID PK     ✅
project_id      UUID FK     ✅ → projects.id
expense_date    DATE        ✅ Tanggal pengeluaran
category        TEXT        ✅ material | operasional | jasa | lainnya
description     TEXT        ✅ Deskripsi pengeluaran
amount          NUMERIC     ✅ Jumlah (Rp)
prev_total      NUMERIC     ✅ Total sebelumnya
running_total   NUMERIC     ✅ Total akumulasi (auto-calc)
photo_url       TEXT        ✅ Foto nota (nullable)
recorded_by     UUID FK     ✅ → profiles.id
created_at      TIMESTAMP   ✅ Auto
```

---

## 📐 Relasi Antar Tabel

```
profiles ──────────────────────────────────────────────────┐
  │                                                         │
  ├──< attendance_logs >──────────< projects               │
  │         │                          │                    │
  │         └──< overtime_logs         ├──< project_updates │
  │         │                          │         │          │
  │         └──< bon_transactions      └──< project_photos  │
  │                                                         │
  ├──< material_orders >────< material_photos
  │
  └──< project_expenses
```

---

## 📱 Halaman Aplikasi

### 🔐 Login
```
✅ Form username & password (bukan email untuk login)
✅ Splash screen animasi dengan orbs warna teal-green
✅ Auto-login jika session masih aktif
🔧 Rencana: email field terpisah (email sungguhan, opsional) — saat ini auto-generate username@barotech.com
```

---

### 🏠 Beranda (semua role)
```
✅ Greeting + role badge
✅ Status DATABASE ONLINE / OFFLINE
✅ Statistik: jumlah karyawan & proyek aktif
✅ Klik stat → tampilkan daftar karyawan / proyek
✅ Aktivitas hari ini (ringkasan absensi)

✅ Notifikasi bon mendekati batas (threshold Rp 500.000)
✅ Ringkasan pengeluaran proyek hari ini
```

---

### 📋 Absensi

#### Admin / Owner / Superadmin — Plotting
```
✅ Pilih proyek (hanya proyek aktif) & karyawan
✅ Auto-fill jabatan & saldo bon saat pilih karyawan
✅ Jam masuk & keluar (time picker)
✅ Gaji dasar (Rp)
✅ Lembur inline: jam × upah, total otomatis
✅ Tunjangan/lain-lain + keterangan
✅ Kasbon: potongan + pinjam baru
✅ Status awal: Draft / Langsung Verifikasi
✅ Tabel hari ini + detail keuangan per baris
✅ Form reset otomatis setelah submit
✅ Item pekerjaan yang dikerjakan (work_items per baris)
✅ Auto-update saldo bon via trigger bon_transactions
✅ Dark mode / Light mode toggle (kanan atas header)
✅ Preference tema disimpan di localStorage
✅ Mobile-first untuk tenaga lapangan (kepala_lapangan/karyawan)
✅ Touch target besar di mobile (44px+) untuk kemudahan tap
✅ Bottom navigation prominent di mobile
✅ Tabel scrollable horizontal di mobile
```

#### Kepala Teknik — Verifikasi Semua Proyek
```
✅ Lihat absensi semua proyek hari ini
✅ Generate absensi harian otomatis dari penugasan aktif
✅ Tombol Hadir / Tidak Hadir (tanpa data keuangan)
✅ Input item pekerjaan per karyawan
✅ Status badge: HADIR | TIDAK HADIR | BELUM DIVERIFIKASI
✅ Info banner peran verifikasi
✅ Edit jam & keuangan (admin+) — modal inline
```

#### Kepala Gudang — Read-Only Semua Proyek
```
✅ Lihat daftar kehadiran semua proyek (tanpa keuangan)
✅ Tidak ada tombol aksi
```

#### Kepala Proyek — Verifikasi Proyeknya Sendiri
```
✅ Lihat & verifikasi absensi proyeknya sendiri
✅ Generate absensi harian otomatis dari penugasan aktif
✅ Tombol Hadir / Tidak Hadir (tanpa data keuangan)
✅ Input item pekerjaan per karyawan
```

---

### ⏰ Lembur ✅ BARU
```
✅ Form input: proyek, karyawan, tanggal, lokasi
✅ Jam mulai & selesai → durasi dihitung otomatis
✅ Upah/jam → total upah dihitung otomatis
✅ Deskripsi pekerjaan lembur
✅ Upload foto bukti lembur
✅ Tabel riwayat lembur (filter per role)
✅ Kolom keuangan hanya tampil untuk admin+
✅ Delete hanya superadmin & owner
```

---

### 📊 Riwayat Absensi (Karyawan)
```
✅ Tabel: Tanggal | Proyek | Status | Jam | Keuangan
✅ Kolom keuangan: Gaji | Lembur | Lain-lain | Kasbon | Total Terima
✅ Ringkasan total di atas tabel
✅ 3 lapisan keamanan: RLS + query filter + frontend guard
✅ Jabatan snapshot per baris

✅ Filter per bulan / per proyek (expense, material, bon)
✅ Saldo bon berjalan (ditampilkan di riwayat bon per karyawan)
```

---

### 📸 Laporan Progress ✅ DIPERBARUI
```
✅ Pilih proyek (kepala_lapangan hanya proyeknya)
✅ Slider progress (%)
✅ Deskripsi laporan
✅ Multiple foto: maks 4 foto + caption per foto
✅ Galeri riwayat laporan per proyek
✅ Foto lama (1 foto) tetap ditampilkan sebagai fallback

✅ Timestamp & lokasi otomatis (geolocation capture di overtime & laporan)
✅ Lightbox / zoom foto (overlay modal global)
```

---

### 🏗️ Kelola Proyek (Admin / Owner / Superadmin + Kepala Proyek lihat)
```
✅ Buat proyek baru (nama, lokasi, penanggung jawab, status awal)
✅ Penanggung jawab: kepala_proyek atau kepala_lapangan
✅ Daftar proyek + progress % + status badge
✅ Tombol Tandai Selesai / Aktifkan Kembali (admin+)
✅ Hapus proyek (superadmin & owner only)
✅ Kepala proyek bisa lihat semua proyek (read-only)

✅ Detail proyek (modal: karyawan terlibat via penugasan + pengeluaran)
✅ Timeline progress (visual timeline di modal detail proyek)
```

---

### 💰 Bon / Kasbon (Admin / Owner / Superadmin)
```
✅ Input pinjam baru + input pembayaran bon
✅ Daftar karyawan + saldo bon saat ini
✅ Riwayat transaksi per karyawan (jumlah, saldo setelah, keterangan)
✅ Validasi: bayar tidak boleh melebihi saldo
✅ Trigger DB: saldo bon di profiles terupdate otomatis
```

### 📋 Penugasan Karyawan (Admin / Owner / Superadmin)
```
✅ Tugaskan karyawan ke proyek aktif
✅ Tentukan gaji dasar per hari per penugasan
✅ Tanggal mulai & selesai (nullable = sampai proyek selesai)
✅ Auto-pause penugasan lama saat karyawan dipindah proyek
✅ Auto-resume penugasan sebelumnya saat penugasan sementara berakhir
✅ Daftar penugasan aktif + status (active/paused/ended)
✅ Edit gaji dasar penugasan yang sedang berjalan
✅ End / resume penugasan manual
✅ Delete penugasan (superadmin & owner only)
✅ Auto-end penugasan saat proyek ditandai selesai
✅ Generate absensi harian otomatis dari penugasan aktif
```

---

### 📦 Material Orders (Admin / Owner / Superadmin / Kepala Gudang / Kepala Lapangan)
```
✅ Input order material: proyek, jenis (gudang/customer/beli_lokasi)
✅ Nama material, jumlah, satuan, harga satuan, total auto-calc
✅ Nama supplier & keterangan
✅ Status order: Pending → Disetujui / Ditolak / Selesai
✅ Daftar semua order material per proyek
✅ Update status langsung dari tabel (admin, kepala_gudang, kepala_lapangan)
✅ Delete order (superadmin & owner)
```

---

### 📊 Pengeluaran Proyek (Admin / Owner / Superadmin)
```
✅ Input pengeluaran: proyek, tanggal, kategori, jumlah, deskripsi
✅ Kategori: Material, Operasional, Jasa, Lainnya
✅ Daftar pengeluaran per proyek dengan running_total akumulasi
✅ Total akumulasi otomatis (prev_total + amount)
✅ Delete pengeluaran (superadmin & owner)
```

---

### 👥 Kelola User (Admin / Owner / Superadmin)
```
✅ Form tambah user: nama, WA, role (7 pilihan), jabatan, username, password
✅ Field jabatan hanya muncul jika role = karyawan
🔧 Rencana: tambah input Email sungguhan (opsional), hapus auto-generate username@barotech.com
   - Login tetap pakai username + password (tidak berubah)
   - Email untuk keperluan notifikasi / reset password di masa depan
   - Kolom email di DB sudah UNIQUE & mendukung NULL, tidak perlu ubah skema
   - User lama yang sudah punya email @barotech.com bisa di-update saat mereka mengisi email asli
✅ Auto-confirm (tidak perlu verifikasi email)
✅ Daftar user: nama, email, role (label), jabatan, saldo bon
✅ Delete user (superadmin & owner only)

✅ Edit user (modal edit: nama, WA, role, password, jabatan)
```

---

## 🧭 Navigasi per Role

| Menu                  | superadmin | owner | admin | kepala_proyek | kepala_gudang | kepala_lapangan | karyawan |
|-----------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 🏠 Beranda            | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📋 Penugasan          | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📋 Absensi (plotting) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📋 Absensi (verifikasi)| ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | ❌ |
| ⏰ Lembur             | ✅ | ✅ | ✅ | 👁️ | ❌ | 👁️ | ❌ |
| 📊 Riwayat Absensi    | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 📸 Laporan Progress   | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 🏗️ Proyek             | ✅ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ |
| � Material Orders    | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| �� Bon / Kasbon       | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📊 Pengeluaran Proyek | ✅ | ✅ | ✅ | �️ | ❌ | 👁️ | ❌ |
| �� User               | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> 👁️ = Read-only (lihat tanpa aksi)

---

## ⚙️ Arsitektur Kode

```
src/
├── main.js                  ← State, routing, render, global API
├── style.css                ← Tema teal-green glassmorphism + orbs background
├── lib/
│   ├── supabase.js          ← Client anon + admin
│   ├── roles.js             ← Konstanta & helper: canFinance, canPlot, canDelete, dll
│   └── helpers.js           ← fmtIdr, fmtDate, fmtTime, showToast, esc
└── pages/
    ├── dashboard.js         ← Beranda (stats, aktivitas hari ini)
    ├── attendance.js        ← Absensi (plotting + verifikasi + edit jam/keuangan + generate)
    ├── assignment.js        ← Penugasan karyawan ke proyek (auto-pause/resume)
    ├── overtime.js          ← Lembur (form input + riwayat)
    ├── laporan.js           ← Laporan progress (multi-foto + galeri)
    ├── project.js           ← Proyek (CRUD + status selesai/aktif)
    ├── bon.js               ← Bon/Kasbon (pinjam/bayar + riwayat)
    ├── users.js             ← User management (7 role)
    ├── riwayat.js           ← Riwayat absensi karyawan
    ├── material.js          ← Material Orders (input + daftar + status)
    └── expense.js           ← Pengeluaran Proyek (input + rekap akumulasi)
```

---

## 🔐 RLS Policies Database

| Tabel              | karyawan | kepala_proyek | kepala_gudang | kepala_lapangan | admin | owner/superadmin |
|--------------------|:---:|:---:|:---:|:---:|:---:|:---:|
| `profiles`         | SELECT | SELECT | SELECT | SELECT | INSERT/UPDATE | ALL |
| `projects`         | SELECT | SELECT | SELECT | SELECT | INSERT/UPDATE | ALL |
| `attendance_logs`  | SELECT own | SELECT+UPDATE all | SELECT all | SELECT+UPDATE own | INSERT/UPDATE | ALL |
| `overtime_logs`    | SELECT own | SELECT all | ❌ | SELECT own | INSERT/UPDATE | ALL |
| `project_updates`  | SELECT | SELECT+INSERT | SELECT | SELECT+INSERT | ALL | ALL |
| `project_photos`   | SELECT | SELECT+INSERT | SELECT | SELECT+INSERT | ALL | ALL |
| `project_assignments`| SELECT own | SELECT all | SELECT own | SELECT own | ALL | ALL |
| `bon_transactions` | SELECT own | ❌ | ❌ | ❌ | INSERT/UPDATE | ALL |

---

## 🛠️ Tech Stack

| Komponen   | Teknologi |
|------------|-----------|
| Frontend   | Vanilla JavaScript (ES Modules) |
| Build Tool | Vite 6 |
| Backend    | Supabase (PostgreSQL) |
| Auth       | Custom Auth (username + password di tabel profiles) |
| Storage    | Supabase Storage (`project-photos` bucket) |
| Styling    | Custom CSS — Dark/Light mode toggle, CSS variables, mobile-first (touch targets 44px+), tema teal-green glassmorphism |
| Icons      | Font Awesome 6 |
| PWA        | Web App Manifest |

---

## 🌐 Environment Variables

| Variable | Status | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon key (operasi normal) |
| `VITE_SUPABASE_SERVICE_KEY` | ✅ | Service role key (buat user baru) |

---

## 🚀 Roadmap Pengembangan

### ✅ Fase 0 — Setup Awal (V1)
- Login & session, CRUD user, absensi dasar, proyek, laporan 1 foto, riwayat karyawan, RLS

### ✅ Patch — Koreksi & Lengkapi Absensi *(2 Mei 2026)*
- Koreksi alur kepala teknik (verifikasi, bukan input)
- Form absensi lengkap: jam, lembur, lain-lain, kasbon
- Riwayat karyawan: kolom keuangan + ringkasan total
- Keamanan 3 lapisan untuk data riwayat

### ✅ Fase 1 — Jabatan & Bon/Kasbon *(2 Mei 2026)*
- Kolom `jabatan` & `bon_balance` di profiles
- Tabel `bon_transactions` + trigger auto-update saldo
- Halaman Bon/Kasbon lengkap
- Form user: field jabatan lapangan

### ✅ Patch — Role Restructure *(2 Mei 2026)*
- 7 role: superadmin, owner, admin, kepala_proyek, kepala_gudang, kepala_lapangan, karyawan
- RLS diperbarui: admin tidak bisa delete, kepala_proyek akses semua proyek
- Status proyek: aktif / selesai / pending
- `src/lib/roles.js` — helper akses terpusat

### ✅ Patch — Tema Warna Teal-Green *(2 Mei 2026)*
- Palet: `#2AF598` → `#19D2C1` → `#08AEEA`
- Orbs cahaya animasi di background
- Backup tema lama di `style.css.backup`

### ✅ Fase 2 — Lembur & Foto Multiple *(2 Mei 2026)*
- Tabel `overtime_logs` + `project_photos` + RLS
- Halaman Lembur: form input + kalkulasi otomatis + foto bukti + riwayat
- Laporan progress: maks 4 foto + caption + galeri riwayat

### ✅ Patch — Work Items & Helper Library *(2 Mei 2026)*
- Kolom `work_items` di `attendance_logs`
- Input pekerjaan per baris absensi (admin & kepala)
- `src/lib/helpers.js` — fmtIdr, fmtDate, fmtTime, showToast, esc

### ✅ Patch — Project Assignments *(2 Mei 2026)*
- Tabel `project_assignments` + trigger auto-pause/resume
- Halaman Penugasan: tugaskan karyawan ke proyek dengan gaji per hari
- Generate absensi harian otomatis dari penugasan aktif
- Auto-end penugasan saat proyek selesai

### ✅ Patch — Edit Absensi & Hourly Rate *(2 Mei 2026)*
- Kolom `hourly_rate` di `attendance_logs`
- Modal edit absensi inline (jam masuk/keluar, upah/jam, lembur, lain-lain)
- Recalculate basic_salary otomatis saat jam atau hourly_rate berubah
- Function `calc_work_hours` & `recalc_attendance_salary`

### ✅ Fase 3 — Material & Pengeluaran Proyek *(3 Mei 2026)*
- Tabel `material_orders`, `material_photos`, `project_expenses` + RLS
- Trigger auto-calc total_price di material_orders
- Trigger auto-update running_total di project_expenses
- Halaman Material Orders: input + daftar + update status
- Halaman Pengeluaran Proyek: input + rekap akumulasi

### 🔲 Fase 4 — Optimasi & Fitur Tambahan
- Filter & pencarian di semua tabel
- Export data (PDF / Excel)
✅ Edit user (nama, WA, role, password, jabatan)
✅ Notifikasi bon mendekati batas
✅ Detail proyek (karyawan terlibat, timeline progress)

---

## 📊 Ringkasan Progress

| Kategori               | Selesai | Belum | Total |
|------------------------|:-------:|:-----:|:-----:|
| Auth & User            | 7       | 1     | 8     |
| Absensi & Keuangan     | 16      | 1     | 17    |
| Penugasan & Proyek      | 10      | 2     | 12    |
| Lembur                 | 7       | 0     | 7     |
| Bon / Kasbon           | 5       | 0     | 5     |
| Material & Pengeluaran | 9       | 0     | 9     |
| **TOTAL**              | **54**  | **7** | **61**|
