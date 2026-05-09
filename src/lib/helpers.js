// ========== Helpers ==========

/** Format angka ke Rupiah */
export function fmtIdr(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/** Format waktu HH:MM — handle string TIME, datetime lokal, maupun TIMESTAMPTZ */
export function fmtTime(t) {
  if (!t) return '-';
  const s = String(t).trim();

  // Format TIME murni: "HH:MM" atau "HH:MM:SS"
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);

  // Format datetime lokal: "YYYY-MM-DD HH:MM:SS" atau ISO "YYYY-MM-DDTHH:MM..."
  const d = new Date(s);
  if (!isNaN(d)) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return '-';
}

/** Format tanggal lokal Indonesia — responsive (desktop: lengkap, mobile: singkat) */
export function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  const long = dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const short = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `<span class="fmt-date-desktop">${long}</span><span class="fmt-date-mobile">${short}</span>`;
}

/** Tampilkan toast notification */
export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

/** Escape HTML */
export function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Kembalikan datetime lokal dalam format "YYYY-MM-DD HH:MM:SS+07:00"
 * agar Supabase menyimpan waktu WIB dengan benar (bukan UTC).
 *
 * Masalah tanpa ini:
 *   "2026-05-06 08:30:00" → Supabase anggap UTC → tersimpan sebagai 08:30 UTC
 *   → saat dibaca browser (WIB) → tampil 15:30 WIB (selisih +7 jam)
 *
 * @param {Date} [date] - opsional, default = sekarang
 * @returns {{ dateStr: string, timeStr: string, datetimeStr: string }}
 *   dateStr     = "YYYY-MM-DD" (tanggal lokal)
 *   timeStr     = "HH:MM:SS"   (jam lokal)
 *   datetimeStr = "YYYY-MM-DD HH:MM:SS+07:00" (siap kirim ke Supabase)
 */
export function localNow(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const Y   = date.getFullYear();
  const M   = pad(date.getMonth() + 1);
  const D   = pad(date.getDate());
  const h   = pad(date.getHours());
  const m   = pad(date.getMinutes());
  const s   = pad(date.getSeconds());
  return {
    dateStr:     `${Y}-${M}-${D}`,
    timeStr:     `${h}:${m}:${s}`,
    datetimeStr: `${Y}-${M}-${D} ${h}:${m}:${s}+07:00`,
  };
}

/** Ambil lokasi GPS (Promise wrapper) */
export function getGeoLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    // Timeout diperpanjang ke 10 detik, fallback null agar tidak blokir proses lain
    const timer = setTimeout(() => resolve(null), 10000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 }
    );
  });
}

/** Format lokasi untuk dimasukkan ke deskripsi */
export function fmtGeoNote(geo, prefix = '') {
  if (!geo) return '';
  return `${prefix}[📍 ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} — akurasi ${Math.round(geo.accuracy)}m]`;
}

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

/**
 * Validasi file sebelum upload — cek tipe dan ukuran
 * Throw Error jika tidak valid
 */
export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`File harus berupa foto (JPEG, PNG, WebP, GIF). Tipe "${file.type}" tidak diizinkan.`);
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`Ukuran foto terlalu besar (${sizeMB}MB). Maksimal 2MB.`);
  }
}

/** Compress image before upload */
export async function compressImage(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Resize jika terlalu besar
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => resolve(file); // Fallback kalau gagal
    img.src = URL.createObjectURL(file);
  });
}

/** Print preview — tampilkan konten dalam overlay fullscreen, ada tombol X dan Print */
export function printPreview(contentSelector = '#laporan-container, #rp-container, #rg-container, #lb-container, #lk-container') {
  // Cari container yang ada di DOM
  let contentEl = null;
  const selectors = contentSelector.split(',').map(s => s.trim());
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) { contentEl = el; break; }
  }
  if (!contentEl) {
    // Fallback: ambil main-content
    contentEl = document.querySelector('.main-content') || document.body;
  }

  // Buat overlay
  const overlay = document.createElement('div');
  overlay.id = 'print-preview-overlay';
  overlay.innerHTML = `
    <div id="print-preview-toolbar">
      <span style="font-weight:600;font-size:0.95rem;"><i class="fas fa-print"></i> Preview Cetak</span>
      <div style="display:flex;gap:8px;">
        <button id="btn-do-print" onclick="window.print()">
          <i class="fas fa-print"></i> Cetak
        </button>
        <button id="btn-close-preview" onclick="document.getElementById('print-preview-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    <div id="print-preview-body">
      ${contentEl.innerHTML}
    </div>
  `;
  document.body.appendChild(overlay);

  // Scroll ke atas
  overlay.querySelector('#print-preview-body').scrollTop = 0;
}
