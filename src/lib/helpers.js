// ========== Helpers ==========

/** Format angka ke Rupiah */
export function fmtIdr(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/** Format waktu HH:MM */
export function fmtTime(t) {
  if (!t) return '-';
  return t.slice(0, 5);
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

/** Ambil lokasi GPS (Promise wrapper) */
export function getGeoLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });
}

/** Format lokasi untuk dimasukkan ke deskripsi */
export function fmtGeoNote(geo, prefix = '') {
  if (!geo) return '';
  return `${prefix}[📍 ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} — akurasi ${Math.round(geo.accuracy)}m]`;
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
