import './style.css';
import { supabase, hasCredentials } from './lib/supabase.js';
import { showToast, esc } from './lib/helpers.js';
import { DashboardPage, loadBonNotifications, loadTodayExpenses } from './pages/dashboard.js';
import { AttendancePage, verifyAttendance, deleteAttendance, saveWorkItems, saveKegiatan, addAdminActivity, generateDailyAttendance, openEditAttendance, saveEditAttendance, clockIn, clockOut, autoCheckoutStale, createAttendanceWithStatus } from './pages/attendance.js';
import { RiwayatPage } from './pages/riwayat.js';
import { LaporanPage, previewPhoto, handleLaporanSubmit, editProjectUpdate, saveProjectUpdate, deleteProjectUpdate } from './pages/laporan.js';
import { LaporanIndexPage } from './pages/laporan-index.js';
import { LaporanGajiPage, filterLaporanGaji, exportLaporanGajiToExcel, printLaporanGaji } from './pages/laporan-gaji.js';
import { RekapProyekPage, loadRekapProyek, togglePeriodType, toggleProjectBreakdown, exportRekapProyek } from './pages/rekap-proyek.js';
import { LaporanRekapGajiPage, loadRekapGaji, exportRekapGaji } from './pages/laporan-rekap-gaji.js';
import { LaporanBonPage, loadLaporanBon, loadDetailBon, exportLaporanBon } from './pages/laporan-bon.js';
import { LaporanKegiatanPage, loadLaporanKegiatan, exportLaporanKegiatan } from './pages/laporan-kegiatan.js';
import { SalaryPaymentPage, loadUnpaidSalaries, openPaymentModal, paySelectedSalaries, processPayment, toggleSelectAllSalary, loadPaymentHistory, printSalarySlip } from './pages/salary-payment.js';
import { ProjectPage, handleProjectSubmit, deleteProject, updateProjectStatus, openProjectDetail } from './pages/project.js';
import { UsersPage, handleUserSubmit, deleteUser, openEditUser, saveEditUser } from './pages/users.js';
import { BonPage, handleBonSubmit, showBonHistory, loadSelfBonHistory } from './pages/bon.js';
import { AssignmentPage, loadAssignments, loadUnassignedEmployees, handleAssignSubmit, toggleAssignRow, openEditAssignment, saveEditAssignment, editAssignmentSalary, endAssignment, resumeAssignment, deleteAssignment, openAdminCheckIn, saveAdminCheckIn } from './pages/assignment.js';
import { OvertimePage, handleOvertimeSubmit, handleOvertimeRequest, loadOvertimeList, approveOvertime, rejectOvertime, deleteOvertime, editOvertime } from './pages/overtime.js';
import { MaterialPage, handleMaterialSubmit, loadMaterialList, updateMaterialStatus, deleteMaterial } from './pages/material.js';
import { ExpensePage, handleExpenseSubmit, loadExpenseList, deleteExpense } from './pages/expense.js';
import { loadProjectUpdates } from './pages/laporan.js';

// ========== UPDATE CHECKER ==========
const APP_VERSION = '2.1.2';

function checkForUpdate() {
  // Cek versi yang tersimpan di localStorage
  const savedVersion = localStorage.getItem('app_version');
  if (savedVersion && savedVersion !== APP_VERSION) {
    // Ada versi baru — tampilkan banner
    showUpdateBanner(savedVersion, APP_VERSION);
  }
  // Simpan versi saat ini
  localStorage.setItem('app_version', APP_VERSION);
}

function showUpdateBanner(oldVer, newVer) {
  // Hapus banner lama jika ada
  document.getElementById('update-banner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <i class="fas fa-rocket" style="color:var(--primary);"></i>
    <span>Aplikasi diperbarui ke <strong>v${newVer}</strong></span>
    <button onclick="location.reload(true)" style="
      background:var(--primary);color:#fff;border:none;border-radius:6px;
      padding:4px 12px;font-size:0.78rem;font-weight:600;cursor:pointer;margin-left:8px;">
      Muat Ulang
    </button>
    <button onclick="document.getElementById('update-banner').remove()" style="
      background:none;border:none;color:var(--text-secondary);cursor:pointer;
      font-size:1rem;margin-left:4px;padding:0 4px;">✕</button>
  `;
  document.body.appendChild(banner);
}

// Jalankan saat halaman dimuat
checkForUpdate();
const state = {
  isLoggedIn: false,
  showSplash: true,
  user: { id: null, name: '', role: '' },
  currentPage: 'home',
  dashboardView: null,
  employees: [],
  projects: [],
  attendanceLogs: [],
  dailyActivities: [],
  dbConnected: false,
  loading: false,
};

// Role-based menu config
const MENUS = {
  superadmin:    ['home','assignment','absensi','overtime','laporan','project','material','expense','bon','users'],
  owner:         ['home','assignment','absensi','overtime','laporan','project','material','expense','bon','users'],
  admin:         ['home','assignment','absensi','overtime','laporan','project','material','expense','bon','users'],
  kepala_proyek: ['home','absensi','overtime','lapor','project','material','expense','bon'],
  kepala_gudang: ['home','absensi','material'],
  kepala_lapangan: ['home','absensi','overtime','lapor','project','material','expense'],
  karyawan:      ['home','absensi','overtime','riwayat'],
};

// Sub-menu di bawah "Laporan" (hanya untuk admin/owner/superadmin)
const LAPORAN_SUBMENU = [
  { key: 'lapor',          icon: 'fa-camera',              label: 'Laporan Progress' },
  { key: 'rekap-gaji',     icon: 'fa-money-bill-wave',     label: 'Rekap Gaji Lengkap' },
  { key: 'rekap-proyek',   icon: 'fa-chart-pie',           label: 'Rekap Biaya Proyek' },
  { key: 'laporan-bon',    icon: 'fa-hand-holding-usd',    label: 'Laporan Bon' },
  { key: 'laporan-kegiatan', icon: 'fa-tasks',             label: 'Kegiatan Harian' },
  { key: 'salary-payment', icon: 'fa-money-check-alt',     label: 'Pembayaran Gaji' },
];

const MENU_META = {
  home:       { icon: 'fa-home',             label: 'Beranda' },
  assignment: { icon: 'fa-user-tag',         label: 'Penugasan' },
  absensi:    { icon: 'fa-clipboard-check',  label: 'Absensi' },
  overtime:   { icon: 'fa-clock',            label: 'Lembur' },
  riwayat:    { icon: 'fa-history',          label: 'Riwayat' },
  laporan:    { icon: 'fa-chart-bar',        label: 'Laporan' },
  lapor:      { icon: 'fa-camera',           label: 'Laporan Progress' },
  project:    { icon: 'fa-building',         label: 'Proyek' },
  material:   { icon: 'fa-box',              label: 'Material' },
  expense:    { icon: 'fa-receipt',          label: 'Pengeluaran' },
  bon:        { icon: 'fa-hand-holding-usd', label: 'Bon' },
  users:      { icon: 'fa-users-gear',       label: 'User' },
};

// ========== DATA ==========
async function fetchData() {
  try {
    const role = state.user.role;
    // karyawan fetch absensi milik sendiri + kolom keuangan (untuk halaman Riwayat)
    const attQuery = role === 'karyawan'
      ? supabase.from('attendance_logs')
          .select('id, employee_id, project_id, status, check_in, check_out, notes, kegiatan, overtime_hours, overtime_rate, overtime_pay, jabatan_snapshot, work_items, basic_salary, hourly_rate, uang_makan, transport, tunjangan_lain, misc_amount, misc_description, cash_advance, cash_payout, checkin_lat, checkin_lng, checkout_lat, checkout_lng, created_at')
          .eq('employee_id', state.user.id)
          .order('created_at', { ascending: false })
      : supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });

    const [empRes, prjRes, attRes, asgnRes, actRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      attQuery,
      supabase.from('project_assignments').select('id,employee_id,project_id,status').eq('status','active'),
      supabase.from('daily_activities').select('*').order('created_at', { ascending: false }),
    ]);
    state.employees       = empRes.data || [];
    state.projects        = prjRes.data || [];
    state.attendanceLogs  = attRes.data || [];
    state.assignments     = asgnRes.data || [];
    state.dailyActivities = actRes.data || [];
    state.dbConnected  = true;
  } catch {
    state.dbConnected = false;
  }
}

async function refreshAndRender() {
  await fetchData();
  render();
}

// ========== AUTH ==========
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Masuk...';

  const username = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .eq('password_hash', password)
      .maybeSingle();

    if (error) throw error;
    if (!profile) throw new Error('Username atau password salah');

    state.user = {
      id: profile.id,
      name: profile.full_name || username,
      username: profile.username || username,
      role: profile.role || 'karyawan',
    };
    state.isLoggedIn = true;
    state.currentPage = 'home';

    await fetchData();
    render();
    showToast(`Selamat datang, ${state.user.name}!`, 'success');
  } catch (err) {
    showToast('Login gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk';
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.isLoggedIn = false;
  state.user = { id: null, name: '', role: '' };
  state.currentPage = 'home';
  state.dashboardView = null;
  render();
}

// ========== NAVIGATION ==========
function navigate(page) {
  state.currentPage = page;
  state.dashboardView = null;
  render();
  // Close mobile sidebar
  document.querySelector('.sidebar')?.classList.remove('open');
  document.querySelector('.sidebar-overlay')?.classList.remove('show');
}

// ========== RENDER ==========
// Halaman yang termasuk grup "laporan"
const LAPORAN_PAGES = new Set(['laporan','lapor','laporan-gaji','rekap-gaji','rekap-proyek','laporan-bon','laporan-kegiatan','salary-payment']);

function renderSidebar() {
  const menus = MENUS[state.user.role] || ['home'];
  const isLaporanActive = LAPORAN_PAGES.has(state.currentPage);

  return menus.map(key => {
    if (key === 'laporan') {
      // Parent navigasi ke index, sub-menu tetap tersedia di sidebar
      const subOpen = isLaporanActive;
      return `
        <button class="nav-item ${state.currentPage === 'laporan' ? 'active' : (isLaporanActive ? 'active' : '')}"
          data-page="laporan" id="nav-laporan-parent">
          <i class="fas fa-chart-bar"></i> Laporan
          <i class="fas fa-chevron-${subOpen ? 'up' : 'down'}"
            style="margin-left:auto;font-size:0.7rem;pointer-events:none;" id="laporan-chevron"></i>
        </button>
        <div id="laporan-submenu" style="display:${subOpen ? 'block' : 'none'};">
          ${LAPORAN_SUBMENU.map(s => `
            <button class="nav-item nav-subitem ${state.currentPage === s.key ? 'active' : ''}"
              data-page="${s.key}">
              <i class="fas ${s.icon}"></i> ${s.label}
            </button>
          `).join('')}
        </div>`;
    }
    const m = MENU_META[key];
    return `<button class="nav-item ${state.currentPage === key ? 'active' : ''}" data-page="${key}">
      <i class="fas ${m.icon}"></i> ${m.label}
    </button>`;
  }).join('');
}

function renderBottomNav() {
  const menus = MENUS[state.user.role] || ['home'];
  const isLaporanActive = LAPORAN_PAGES.has(state.currentPage);

  return menus.map(key => {
    if (key === 'laporan') {
      return `<button class="bottom-nav-item ${isLaporanActive ? 'active' : ''}"
        onclick="window.__app.navigateTo('laporan')">
        <i class="fas fa-chart-bar"></i><span>Laporan</span>
      </button>`;
    }
    const m = MENU_META[key];
    return `<button class="bottom-nav-item ${state.currentPage === key ? 'active' : ''}" data-page="${key}">
      <i class="fas ${m.icon}"></i><span>${m.label}</span>
    </button>`;
  }).join('');
}

function renderPage() {
  switch (state.currentPage) {
    case 'home':       return DashboardPage(state);
    case 'assignment': return AssignmentPage(state);
    case 'absensi':    return AttendancePage(state);
    case 'overtime':   return OvertimePage(state);
    case 'riwayat':  return RiwayatPage(state);
    case 'lapor':      return LaporanPage(state);
    case 'laporan':      return LaporanIndexPage(state);
    case 'laporan-gaji': return LaporanGajiPage(state);
    case 'rekap-gaji':   return LaporanRekapGajiPage(state);
    case 'rekap-proyek': return RekapProyekPage(state);
    case 'laporan-bon':  return LaporanBonPage(state);
    case 'laporan-kegiatan': return LaporanKegiatanPage(state);
    case 'salary-payment': return SalaryPaymentPage(state);
    case 'project':    return ProjectPage(state);
    case 'material': return MaterialPage(state);
    case 'expense': return ExpensePage(state);
    case 'bon':     return BonPage(state);
    case 'users':   return UsersPage(state);
    default:        return DashboardPage(state);
  }
}

function render() {
  const app = document.getElementById('app');

  // Splash screen
  if (state.showSplash) {
    app.innerHTML = `
      <div class="splash-screen">
        <div class="splash-title">BAROTECH</div>
        <div class="splash-sub">Sistem Manajemen Absensi & Proyek</div>
        <div class="splash-dots"><span></span><span></span><span></span></div>
      </div>`;
    return;
  }

  // Missing credentials
  if (!hasCredentials) {
    app.innerHTML = `
      <div class="login-container">
        <div class="login-card" style="max-width: 500px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--warning); display: block; text-align: center; margin-bottom: 20px;"></i>
          <h1 class="login-title">Konfigurasi Diperlukan</h1>
          <p class="login-subtitle">Supabase URL atau API Key belum diatur.</p>
          <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: var(--radius); font-family: monospace; font-size: 0.85rem; margin-bottom: 20px; line-height: 1.6;">
            1. Buat file <span style="color: var(--primary-light)">.env</span> di root folder<br>
            2. Masukkan credentials berikut:<br>
            <span style="color: var(--accent)">VITE_SUPABASE_URL</span>=...<br>
            <span style="color: var(--accent)">VITE_SUPABASE_ANON_KEY</span>=...<br>
            <span style="color: var(--accent)">VITE_SUPABASE_SERVICE_KEY</span>=...
          </div>
          <p class="text-sm text-secondary" style="text-align: center;">
            Setelah mengisi file .env, jalankan kembali <br><code>npm run dev</code>
          </p>
        </div>
      </div>`;
    return;
  }

  // Login
  if (!state.isLoggedIn) {
    app.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <img src="/icon-pwa.png" alt="Logo" class="login-logo" />
          <h1 class="login-title">Absensi</h1>
          <p class="login-subtitle">Manajemen Proyek & Karyawan</p>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-input" id="login-email" placeholder="username" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-input" id="login-password" placeholder="••••••" required />
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="login-btn" style="margin-top:8px">
              <i class="fas fa-sign-in-alt"></i> Masuk
            </button>
          </form>
        </div>
      </div>
      <div class="login-app-info">
        <span class="login-app-info-name"><i class="fas fa-hard-hat"></i> Barotech ERP</span>
        <span class="login-app-info-version">v2.1.2</span>
      </div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    return;
  }

  // Main app shell
  app.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <img src="/icon-pwa.png" alt="Logo" class="sidebar-logo" />
        <span class="sidebar-brand">Barotech</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Menu</div>
        ${renderSidebar()}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-app-info">
          <div class="sidebar-app-info-name">
            <i class="fas fa-hard-hat"></i> Barotech ERP
          </div>
          <div class="sidebar-app-info-desc">Manajemen Proyek & Karyawan</div>
          <div class="sidebar-app-info-version">v2.1.2</div>
        </div>
        <button class="nav-item" id="btn-logout">
          <i class="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>
    </aside>
    <div class="app-shell">
      <main class="main-content">
        <!-- Pull to Refresh Indicator (Mobile Only) -->
        <div id="pull-refresh-indicator" class="pull-to-refresh" style="transform:translateY(-60px);opacity:0;">
          <i class="fas fa-arrow-down"></i> Tarik untuk refresh
        </div>
        
        <div class="header-bar">
          <div class="header-left">
            <button class="menu-toggle" id="menu-toggle"><i class="fas fa-bars"></i></button>
            <div class="header-greeting">
              <h1>Halo, ${esc(state.user.name)}! 👋</h1>
              <p class="text-xs text-primary">@${esc(state.user.username)}</p>
              <p class="text-xs text-secondary">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div class="header-right">
            <button class="btn btn-ghost btn-sm" onclick="window.__app.toggleTheme()" title="Ganti Tema">
              <i class="fas fa-moon" id="theme-icon"></i>
            </button>
            <span class="badge badge-role">${esc(state.user.role)}</span>
          </div>
        </div>
        <div id="page-content">${renderPage()}</div>
      </main>
      <nav class="bottom-nav" id="bottom-nav">${renderBottomNav()}</nav>
    </div>`;

  // Event listeners
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  });

  // Auto-close sidebar on mobile after navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('show');
      }
    });
  });

  // Nav delegation
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  // Post-render hooks
  if (state.currentPage === 'absensi') {
    autoCheckoutStale();
    // Load kegiatan dari DB setelah render
    setTimeout(() => {
      window.__loadSelfActivities?.('self-activities-list', false);
      window.__loadSelfActivities?.('self-activities-list-done', true);

      // Load kegiatan untuk setiap baris admin (admin-activities-{id})
      document.querySelectorAll('[id^="admin-activities-"]').forEach(el => {
        const attId = el.id.replace('admin-activities-', '');
        if (attId) window.__loadAdminActivities?.(attId);
      });
    }, 100);
  }
  if (state.currentPage === 'overtime') {
    loadOvertimeList(state);
    window.__ot_supabase = supabase; // expose untuk __ot_loadEmployeeRate
  }
  if (state.currentPage === 'assignment') {
    loadAssignments(state);
    loadUnassignedEmployees(state);
  }
  if (state.currentPage === 'lapor') {
    // Load riwayat semua proyek langsung saat halaman dibuka
    loadProjectUpdates(null, state);
    if (typeof window.__lap_resetPhotoSlots === 'function') {
      window.__lap_resetPhotoSlots();
    }
  }
  if (state.currentPage === 'material') {
    window.__app.loadFilteredMaterials();
  }
  if (state.currentPage === 'expense') {
    window.__app.loadFilteredExpenses();
  }
  if (state.currentPage === 'rekap-proyek') {
    loadRekapProyek();
  }
  if (state.currentPage === 'rekap-gaji') {
    loadRekapGaji();
  }
  if (state.currentPage === 'laporan-bon') {
    loadLaporanBon();
  }
  if (state.currentPage === 'laporan-kegiatan') {
    // Inject state reference untuk resolve nama karyawan/proyek
    window.__laporanKegiatanState = { employees: state.employees, projects: state.projects };
    loadLaporanKegiatan();
  }
  if (state.currentPage === 'salary-payment') {
    loadPaymentHistory();
  }
  if (state.currentPage === 'bon') {
    // Non-admin: auto-load riwayat bon milik sendiri
    const isAdmin = ['admin', 'owner', 'superadmin'].includes(state.user.role);
    if (!isAdmin) {
      setTimeout(() => loadSelfBonHistory(state.user.id), 100);
    }
  }
  if (state.currentPage === 'home') {
    loadBonNotifications(state.employees, state.user);
    loadTodayExpenses(state.projects, state.user);
  }
}

// ========== GLOBAL API (for inline handlers) ==========
window.__app = {
  refreshPage() { refreshAndRender(); },
  toggleTheme() { toggleTheme(); },
  switchDashboardView(view) { state.dashboardView = view; render(); },
  verifyAttendance(id, result) { verifyAttendance(id, result, refreshAndRender); },
  deleteAttendance(id) { deleteAttendance(id, refreshAndRender); },
  saveWorkItems(id) { saveWorkItems(id, refreshAndRender); },
  saveKegiatan(id) { saveKegiatan(id, refreshAndRender); },
  addAdminActivity(id) { addAdminActivity(id, refreshAndRender); },
  generateDailyAttendance() { generateDailyAttendance(refreshAndRender); },
  openEditAttendance(id) { openEditAttendance(id, state); },
  saveEditAttendance(id) { saveEditAttendance(id, refreshAndRender); },
  clockIn() { clockIn(state, refreshAndRender); },
  clockOut() { clockOut(state, refreshAndRender); },
  autoCheckoutStale() { autoCheckoutStale(); },
  createAttendanceWithStatus(employeeId, status) { createAttendanceWithStatus(employeeId, status, refreshAndRender); },
  filterLaporanGaji() { filterLaporanGaji(state); },
  exportLaporanGajiToExcel() { exportLaporanGajiToExcel(); },
  printLaporanGaji() { printLaporanGaji(); },
  loadRekapProyek() { loadRekapProyek(); },
  togglePeriodType() { togglePeriodType(); },
  toggleProjectBreakdown(projectId) { toggleProjectBreakdown(projectId); },
  exportRekapProyek() { exportRekapProyek(); },
  loadRekapGaji() { loadRekapGaji(); },
  exportRekapGaji() { exportRekapGaji(); },
  loadLaporanBon() { loadLaporanBon(); },
  loadDetailBon(id, name) { loadDetailBon(id, name); },
  exportLaporanBon() { exportLaporanBon(); },
  loadLaporanKegiatan() { loadLaporanKegiatan(); },
  exportLaporanKegiatan() { exportLaporanKegiatan(); },
  loadUnpaidSalaries() { loadUnpaidSalaries(); },
  openPaymentModal(employeeId, startDate, endDate) { openPaymentModal(employeeId, startDate, endDate); },
  paySelectedSalaries(startDate, endDate) { paySelectedSalaries(startDate, endDate); },
  processPayment(employeeId, startDate, endDate) { processPayment(employeeId, startDate, endDate); },
  toggleSelectAllSalary(checked) { toggleSelectAllSalary(checked); },
  loadPaymentHistory() { loadPaymentHistory(); },
  printSalarySlip(paymentId) { printSalarySlip(paymentId); },
  navigateTo(page) { navigate(page); },
  toggleLaporanMenu() {
    const sub      = document.getElementById('laporan-submenu');
    const chevron  = document.getElementById('laporan-chevron');
    if (!sub) return;
    const isOpen = sub.style.display !== 'none';
    sub.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.className = `fas fa-chevron-${isOpen ? 'down' : 'up'}`;
  },
  toggleAssignRow(idx) { toggleAssignRow(idx); },
  handleAssignSubmit(e) { handleAssignSubmit(e, state, refreshAndRender); },
  openEditAssignment(id) { openEditAssignment(id, state); },
  saveEditAssignment(e, id) { saveEditAssignment(e, id, state, refreshAndRender); },
  editAssignmentSalary(id, salary) { editAssignmentSalary(id, salary, state, refreshAndRender); },
  endAssignment(id) { endAssignment(id, state, refreshAndRender); },
  resumeAssignment(id) { resumeAssignment(id, state, refreshAndRender); },
  deleteAssignment(id) { deleteAssignment(id, state, refreshAndRender); },
  openAdminCheckIn(id) { openAdminCheckIn(id, state); },
  saveAdminCheckIn(e, id) { saveAdminCheckIn(e, id, state); },
  prefillAssignEmployee(empId) {
    // Buka form penugasan dan pre-select karyawan
    const container = document.getElementById('assign-form-container');
    const chevron   = document.getElementById('assign-form-chevron');
    if (container && container.style.display === 'none') {
      container.style.display = 'block';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
    const empSelect = document.getElementById('asgn-employee');
    if (empSelect) {
      empSelect.value = empId;
      empSelect.dispatchEvent(new Event('change'));
      window.__asgn_onEmployeeChange(empId);
    }
    // Scroll ke form
    container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  handleLaporanSubmit(e) { handleLaporanSubmit(e, state, refreshAndRender); },
  previewPhoto,
  handleProjectSubmit(e) { handleProjectSubmit(e, refreshAndRender); },
  deleteProject(id) { deleteProject(id, refreshAndRender); },
  updateProjectStatus(id, status) { updateProjectStatus(id, status, refreshAndRender); },
  openProjectDetail(id) { openProjectDetail(id, state.employees, state.projects); },
  handleUserSubmit(e) { handleUserSubmit(e, refreshAndRender); },
  deleteUser(id) { deleteUser(id, refreshAndRender); },
  openEditUser(id) {
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return showToast('User tidak ditemukan', 'error');
    openEditUser(emp, refreshAndRender);
  },
  saveEditUser(e, id) { saveEditUser(e, id, refreshAndRender); },
  handleBonSubmit(e) { handleBonSubmit(e, state, refreshAndRender); },
  showBonHistory(id, name) { showBonHistory(id, name); },
  reloadBonHistory() {
    const panel = document.getElementById('bon-history-panel');
    const empId = panel?.dataset.empId;
    const month = document.getElementById('bon-filter-month')?.value;
    if (empId) showBonHistory(empId, null, month);
  },
  loadSelfBonHistory() { loadSelfBonHistory(state.user.id); },
  handleOvertimeSubmit(e) { handleOvertimeSubmit(e, state, refreshAndRender); },
  handleOvertimeRequest(e) { handleOvertimeRequest(e, state, refreshAndRender); },
  approveOvertime(id) { approveOvertime(id, state, refreshAndRender); },
  rejectOvertime(id) { rejectOvertime(id, state, refreshAndRender); },
  editOvertime(id) { editOvertime(id, state, refreshAndRender); },
  deleteOvertime(id) { deleteOvertime(id, state, refreshAndRender); },
  handleMaterialSubmit(e) { handleMaterialSubmit(e, state, refreshAndRender); },
  updateMaterialStatus(id, status) { updateMaterialStatus(id, status, refreshAndRender); },
  deleteMaterial(id) { deleteMaterial(id, refreshAndRender); },
  loadFilteredMaterials() {
    const month = document.getElementById('mat-filter-month')?.value;
    const projectId = document.getElementById('mat-filter-project')?.value;
    loadMaterialList(state, 'material-list', { month, projectId });
  },
  handleExpenseSubmit(e) { handleExpenseSubmit(e, state, refreshAndRender); },
  deleteExpense(id) { deleteExpense(id, refreshAndRender); },
  loadFilteredExpenses() {
    const month = document.getElementById('exp-filter-month')?.value;
    const projectId = document.getElementById('exp-filter-project')?.value;
    loadExpenseList(state, 'expense-list', { month, projectId });
  },
  loadProjectUpdates(projectId) { loadProjectUpdates(projectId, state); },
  editProjectUpdate(id, pid, pct, desc) { editProjectUpdate(id, pid, pct, desc, state); },
  saveProjectUpdate(id, pid) { saveProjectUpdate(id, pid, state, refreshAndRender); },
  deleteProjectUpdate(id, pid) { deleteProjectUpdate(id, pid, state, refreshAndRender); },
  // Helper: Set button loading state
  setButtonLoading(btnId, isLoading, loadingText = 'Memproses...', originalText = null) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = originalText || btn.dataset.originalText || btn.innerHTML;
    }
  },
};

// ========== THEME TOGGLE ==========
function applyTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ========== KEYBOARD SHORTCUTS ==========
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in input/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    
    // Ctrl/Cmd + K: Focus search (if exists)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="Cari"]');
      searchInput?.focus();
    }
    
    // Ctrl/Cmd + R: Refresh data
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      refreshAndRender();
      showToast('Data diperbarui!', 'info');
    }
    
    // Escape: Close modals
    if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.modal-overlay');
      modals.forEach(modal => modal.remove());
    }
    
    // Number keys 1-9: Quick navigation (only for admin+)
    if (state.isLoggedIn && ['superadmin', 'owner', 'admin'].includes(state.user.role)) {
      const navMap = {
        '1': 'home',
        '2': 'assignment',
        '3': 'absensi',
        '4': 'overtime',
        '5': 'laporan',
        '6': 'project',
        '7': 'material',
        '8': 'expense',
        '9': 'bon',
      };
      
      if (navMap[e.key]) {
        e.preventDefault();
        navigate(navMap[e.key]);
      }
    }
  });
}

// ========== PULL TO REFRESH ==========
let pullStartY = 0;
let pullCurrentY = 0;
let isPulling = false;

function initPullToRefresh() {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  mainContent.addEventListener('touchstart', (e) => {
    if (mainContent.scrollTop === 0) {
      pullStartY = e.touches[0].clientY;
      isPulling = true;
    }
  }, { passive: true });

  mainContent.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    pullCurrentY = e.touches[0].clientY;
    const pullDistance = pullCurrentY - pullStartY;
    
    if (pullDistance > 0 && pullDistance < 100) {
      // Show pull indicator
      const indicator = document.getElementById('pull-refresh-indicator');
      if (indicator) {
        indicator.style.transform = `translateY(${pullDistance}px)`;
        indicator.style.opacity = pullDistance / 100;
      }
    }
  }, { passive: true });

  mainContent.addEventListener('touchend', async () => {
    if (!isPulling) return;
    const pullDistance = pullCurrentY - pullStartY;
    
    if (pullDistance > 80) {
      // Trigger refresh
      const indicator = document.getElementById('pull-refresh-indicator');
      if (indicator) {
        indicator.classList.add('pulling');
        indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat...';
      }
      
      await refreshAndRender();
      showToast('Data diperbarui!', 'success');
      
      if (indicator) {
        indicator.classList.remove('pulling');
        indicator.style.transform = 'translateY(-60px)';
        indicator.style.opacity = '0';
        setTimeout(() => {
          indicator.innerHTML = '<i class="fas fa-arrow-down"></i> Tarik untuk refresh';
        }, 300);
      }
    } else {
      // Reset indicator
      const indicator = document.getElementById('pull-refresh-indicator');
      if (indicator) {
        indicator.style.transform = 'translateY(-60px)';
        indicator.style.opacity = '0';
      }
    }
    
    isPulling = false;
    pullStartY = 0;
    pullCurrentY = 0;
  });
}

// ========== INIT ==========
async function init() {
  render(); // show splash

  // Check existing session
  if (hasCredentials) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      state.user = {
        id: session.user.id,
        name: profile?.full_name || session.user.email,
        role: profile?.role || 'karyawan',
      };
      state.isLoggedIn = true;
      state.currentPage = 'home';
      await fetchData();
    }
  }

  render(); // render full app
  applyTheme();
  initKeyboardShortcuts();
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Hide splash after 3 seconds
  setTimeout(() => {
    state.showSplash = false;
    render();
    // Initialize pull-to-refresh after splash
    if (window.innerWidth <= 768) {
      initPullToRefresh();
    }
  }, 3000);
}

init();
