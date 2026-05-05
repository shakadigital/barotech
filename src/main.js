import './style.css';
import { supabase, hasCredentials } from './lib/supabase.js';
import { showToast, esc } from './lib/helpers.js';
import { DashboardPage, loadBonNotifications, loadTodayExpenses } from './pages/dashboard.js';
import { AttendancePage, verifyAttendance, deleteAttendance, saveWorkItems, generateDailyAttendance, openEditAttendance, saveEditAttendance, clockIn, clockOut, autoCheckoutStale } from './pages/attendance.js';
import { RiwayatPage } from './pages/riwayat.js';
import { LaporanPage, previewPhoto, handleLaporanSubmit } from './pages/laporan.js';
import { LaporanGajiPage, filterLaporanGaji, exportLaporanGajiToExcel } from './pages/laporan-gaji.js';
import { ProjectPage, handleProjectSubmit, deleteProject, updateProjectStatus, openProjectDetail } from './pages/project.js';
import { UsersPage, handleUserSubmit, deleteUser, openEditUser, saveEditUser } from './pages/users.js';
import { BonPage, handleBonSubmit, showBonHistory } from './pages/bon.js';
import { AssignmentPage, loadAssignments, handleAssignSubmit, toggleAssignRow, openEditAssignment, saveEditAssignment, editAssignmentSalary, endAssignment, resumeAssignment, deleteAssignment, openAdminCheckIn, saveAdminCheckIn, exportPenugasanToExcel } from './pages/assignment.js';
import { OvertimePage, handleOvertimeSubmit, handleOvertimeRequest, loadOvertimeList, approveOvertime, rejectOvertime, deleteOvertime, exportLemburToExcel } from './pages/overtime.js';
import { MaterialPage, handleMaterialSubmit, loadMaterialList, updateMaterialStatus, deleteMaterial, exportMaterialToExcel } from './pages/material.js';
import { ExpensePage, handleExpenseSubmit, loadExpenseList, deleteExpense, exportExpenseToExcel } from './pages/expense.js';
import { loadProjectUpdates } from './pages/laporan.js';

// ========== STATE ==========
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
  superadmin:    ['home','assignment','absensi','overtime','lapor','laporan-gaji','project','material','expense','bon','users'],
  owner:         ['home','assignment','absensi','overtime','lapor','laporan-gaji','project','material','expense','bon','users'],
  admin:         ['home','assignment','absensi','overtime','lapor','laporan-gaji','project','material','expense','bon','users'],
  kepala_proyek: ['home','absensi','overtime','lapor','project','material','expense'],
  kepala_gudang: ['home','absensi','material'],
  kepala_lapangan: ['home','absensi','overtime','lapor','project','material','expense'],
  karyawan:      ['home','absensi','overtime','riwayat'],
};

const MENU_META = {
  home:       { icon: 'fa-home',             label: 'Beranda' },
  assignment: { icon: 'fa-user-tag',         label: 'Penugasan' },
  absensi:    { icon: 'fa-clipboard-check',  label: 'Absensi' },
  overtime:   { icon: 'fa-clock',            label: 'Lembur' },
  riwayat:    { icon: 'fa-history',          label: 'Riwayat' },
  lapor:      { icon: 'fa-camera',           label: 'Laporan' },
  'laporan-gaji': { icon: 'fa-file-invoice-dollar', label: 'Laporan Gaji' },
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
          .select('id, employee_id, project_id, status, check_in, check_out, notes, overtime_hours, overtime_rate, overtime_pay, jabatan_snapshot, work_items, basic_salary, hourly_rate, uang_makan, transport, tunjangan_lain, misc_amount, misc_description, cash_advance, cash_payout, checkin_lat, checkin_lng, checkout_lat, checkout_lng, created_at')
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
function renderSidebar() {
  const menus = MENUS[state.user.role] || ['home'];
  return menus.map(key => {
    const m = MENU_META[key];
    return `<button class="nav-item ${state.currentPage === key ? 'active' : ''}" data-page="${key}">
      <i class="fas ${m.icon}"></i> ${m.label}
    </button>`;
  }).join('');
}

function renderBottomNav() {
  const menus = MENUS[state.user.role] || ['home'];
  return menus.map(key => {
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
    case 'laporan-gaji': return LaporanGajiPage(state);
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
          <img src="/favicon.svg" alt="Logo" class="login-logo" />
          <h1 class="login-title">Absensi Barotech</h1>
          <p class="login-subtitle">Masuk dengan username</p>
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
      </div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    return;
  }

  // Main app shell
  app.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <img src="/favicon.svg" alt="Logo" class="sidebar-logo" />
        <span class="sidebar-brand">Barotech</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Menu</div>
        ${renderSidebar()}
      </nav>
      <div class="sidebar-footer">
        <button class="nav-item" id="btn-logout">
          <i class="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>
    </aside>
    <div class="app-shell">
      <main class="main-content">
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
  }
  if (state.currentPage === 'overtime') {
    loadOvertimeList(state);
  }
  if (state.currentPage === 'assignment') {
    loadAssignments(state);
  }
  if (state.currentPage === 'lapor') {
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
  if (state.currentPage === 'home') {
    loadBonNotifications(state.employees);
    loadTodayExpenses(state.projects);
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
  generateDailyAttendance() { generateDailyAttendance(refreshAndRender); },
  openEditAttendance(id) { openEditAttendance(id, state); },
  saveEditAttendance(id) { saveEditAttendance(id, refreshAndRender); },
  clockIn() { clockIn(state, refreshAndRender); },
  clockOut() { clockOut(state, refreshAndRender); },
  autoCheckoutStale() { autoCheckoutStale(); },
  filterLaporanGaji() { filterLaporanGaji(state); },
  exportLaporanGajiToExcel() { exportLaporanGajiToExcel(); },
  exportLemburToExcel() { exportLemburToExcel(state); },
  exportMaterialToExcel() { exportMaterialToExcel(state); },
  exportExpenseToExcel() { exportExpenseToExcel(state); },
  exportPenugasanToExcel() { exportPenugasanToExcel(state); },
  handleAssignSubmit(e) { handleAssignSubmit(e, state, refreshAndRender); },
  toggleAssignRow(idx) { toggleAssignRow(idx); },
  openEditAssignment(id) { openEditAssignment(id, state); },
  saveEditAssignment(e, id) { saveEditAssignment(e, id, state, refreshAndRender); },
  editAssignmentSalary(id, salary) { editAssignmentSalary(id, salary, state, refreshAndRender); },
  endAssignment(id) { endAssignment(id, state, refreshAndRender); },
  resumeAssignment(id) { resumeAssignment(id, state, refreshAndRender); },
  deleteAssignment(id) { deleteAssignment(id, state, refreshAndRender); },
  openAdminCheckIn(id) { openAdminCheckIn(id, state); },
  saveAdminCheckIn(e, id) { saveAdminCheckIn(e, id, state); },
  handleLaporanSubmit(e) { handleLaporanSubmit(e, state, refreshAndRender); },
  previewPhoto,
  filterLaporanGaji() { filterLaporanGaji(state); },
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
  handleOvertimeSubmit(e) { handleOvertimeSubmit(e, state, refreshAndRender); },
  handleOvertimeRequest(e) { handleOvertimeRequest(e, state, refreshAndRender); },
  approveOvertime(id) { approveOvertime(id, state, refreshAndRender); },
  rejectOvertime(id) { rejectOvertime(id, state, refreshAndRender); },
  deleteOvertime(id) { deleteOvertime(id, state, refreshAndRender); },
  handleMaterialSubmit(e) { handleMaterialSubmit(e); },
  updateMaterialStatus(id, status) { updateMaterialStatus(id, status, refreshAndRender); },
  deleteMaterial(id) { deleteMaterial(id, refreshAndRender); },
  loadFilteredMaterials() {
    const month = document.getElementById('mat-filter-month')?.value;
    const projectId = document.getElementById('mat-filter-project')?.value;
    loadMaterialList(state, 'material-list', { month, projectId });
  },
  handleExpenseSubmit(e) { handleExpenseSubmit(e); },
  deleteExpense(id) { deleteExpense(id, refreshAndRender); },
  loadFilteredExpenses() {
    const month = document.getElementById('exp-filter-month')?.value;
    const projectId = document.getElementById('exp-filter-project')?.value;
    loadExpenseList(state, 'expense-list', { month, projectId });
  },
  loadProjectUpdates(projectId) { loadProjectUpdates(projectId, state); },
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
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Hide splash after 3 seconds
  setTimeout(() => {
    state.showSplash = false;
    render();
  }, 3000);
}

init();
