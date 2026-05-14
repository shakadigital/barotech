/**
 * Laporan Index Page
 * Halaman pilihan sub-menu laporan — tampil sebagai kartu grid
 * Digunakan sebagai entry point dari bottom nav "Laporan"
 */
export function LaporanIndexPage(state) {
  const { user } = state;
  const isAdmin = ['superadmin', 'owner', 'admin'].includes(user.role);

  // Sub-menu laporan untuk admin
  const adminMenus = [
    {
      key: 'lapor',
      icon: 'fa-camera',
      color: 'var(--primary)',
      bg: 'rgba(25,210,193,0.1)',
      label: 'Laporan Progress',
      desc: 'Kirim laporan & foto progress proyek',
    },
    {
      key: 'rekap-gaji',
      icon: 'fa-money-bill-wave',
      color: '#10b981',
      bg: 'rgba(16,185,129,0.1)',
      label: 'Rekap Gaji Lengkap',
      desc: 'Gaji pokok + tunjangan + lembur − kasbon',
    },
    {
      key: 'gaji-bulanan',
      icon: 'fa-calendar-check',
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.1)',
      label: 'Gaji Bulanan',
      desc: 'Input & kelola gaji tetap bulanan Superadmin & Admin',
    },
    {
      key: 'rekap-proyek',
      icon: 'fa-chart-pie',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      label: 'Rekap Biaya Proyek',
      desc: 'Total biaya gaji, lembur, material & pengeluaran per proyek',
    },
    {
      key: 'laporan-bon',
      icon: 'fa-hand-holding-usd',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      label: 'Laporan Bon',
      desc: 'Saldo hutang & riwayat transaksi bon karyawan',
    },
    {
      key: 'laporan-kegiatan',
      icon: 'fa-tasks',
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.1)',
      label: 'Kegiatan Harian',
      desc: 'Rekap kegiatan karyawan per hari dari absensi',
    },
    {
      key: 'salary-payment',
      icon: 'fa-money-check-alt',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      label: 'Pembayaran Gaji',
      desc: 'Tandai gaji sudah dibayar & cetak slip gaji',
    },
  ];

  // Sub-menu laporan untuk kepala proyek / kepala lapangan
  const kepalaMenus = [
    {
      key: 'lapor',
      icon: 'fa-camera',
      color: 'var(--primary)',
      bg: 'rgba(25,210,193,0.1)',
      label: 'Laporan Progress',
      desc: 'Kirim laporan & foto progress proyek',
    },
  ];

  const menus = isAdmin ? adminMenus : kepalaMenus;

  return `
    <div class="fade-in">
      <div class="mb-20">
        <h2 style="font-size:1.2rem;font-weight:700;margin:0 0 4px;">
          <i class="fas fa-chart-bar" style="color:var(--primary);margin-right:8px;"></i>Laporan
        </h2>
        <div class="text-xs text-secondary">Pilih jenis laporan yang ingin ditampilkan</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
        ${menus.map(m => `
          <button
            onclick="window.__app.navigateTo('${m.key}')"
            style="
              display:flex;align-items:center;gap:16px;
              background:var(--surface,var(--bg-card));
              border:1px solid var(--border);
              border-radius:var(--radius);
              padding:18px 20px;
              cursor:pointer;
              text-align:left;
              transition:transform 0.15s,box-shadow 0.15s;
              width:100%;
            "
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'"
            onmouseout="this.style.transform='';this.style.boxShadow=''"
          >
            <div style="
              width:48px;height:48px;border-radius:12px;
              background:${m.bg};
              display:flex;align-items:center;justify-content:center;
              flex-shrink:0;
            ">
              <i class="fas ${m.icon}" style="font-size:1.3rem;color:${m.color};"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px;color:var(--text);">
                ${m.label}
              </div>
              <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.4;">
                ${m.desc}
              </div>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-secondary);font-size:0.8rem;flex-shrink:0;"></i>
          </button>
        `).join('')}
      </div>
    </div>`;
}
