/**
 * Definisi role dan helper — satu tempat untuk semua aturan akses
 */

// Urutan hierarki role
export const ROLES = ['superadmin','owner','admin','kepala_proyek','kepala_gudang','kepala_lapangan','karyawan'];

// Label tampilan per role
export const ROLE_LABELS = {
  superadmin:       'Superadmin',
  owner:            'Owner',
  admin:            'Admin',
  kepala_proyek:    'Kepala Proyek',
  kepala_gudang:    'Kepala Gudang',
  kepala_lapangan:  'Kepala Lapangan',
  karyawan:         'Karyawan',
};

// Role yang bisa akses data keuangan (gaji, lembur, kasbon, bon)
export const FINANCE_ROLES = ['superadmin','owner','admin'];

// Role yang bisa plotting absensi
export const PLOT_ROLES = ['superadmin','owner','admin'];

// Role yang bisa verifikasi absensi (semua proyek)
export const VERIFY_ALL_ROLES = ['superadmin','owner','admin','kepala_proyek'];

// Role yang bisa verifikasi absensi (hanya proyek sendiri)
export const VERIFY_OWN_ROLES = ['kepala_lapangan'];

// Role yang bisa lihat absensi tanpa keuangan (semua proyek)
export const VIEW_ALL_ATT_ROLES = ['superadmin','owner','admin','kepala_proyek','kepala_gudang'];

// Role yang bisa delete
export const DELETE_ROLES = ['superadmin','owner'];

// Role yang bisa akses halaman proyek (CRUD)
export const PROJECT_MANAGE_ROLES = ['superadmin','owner','admin'];

// Role yang bisa lihat halaman proyek (read)
export const PROJECT_VIEW_ROLES = ['superadmin','owner','admin','kepala_proyek'];

// Helper functions
export const canFinance   = (role) => FINANCE_ROLES.includes(role);
export const canPlot      = (role) => PLOT_ROLES.includes(role);
export const canDelete    = (role) => DELETE_ROLES.includes(role);
export const canVerifyAll = (role) => VERIFY_ALL_ROLES.includes(role);
export const canVerifyOwn = (role) => VERIFY_OWN_ROLES.includes(role);
export const canVerify    = (role) => VERIFY_ALL_ROLES.includes(role) || VERIFY_OWN_ROLES.includes(role);
export const canViewAllAtt= (role) => VIEW_ALL_ATT_ROLES.includes(role);
export const canManageProject = (role) => PROJECT_MANAGE_ROLES.includes(role);
