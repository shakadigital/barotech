/**
 * Map Picker Component
 * Menggunakan Leaflet.js untuk memilih lokasi di map
 * - Auto-detect lokasi perangkat
 * - Drag pin untuk ubah lokasi
 * - Reverse geocoding untuk nama lokasi
 */

let mapInstance = null;
let markerInstance = null;
let currentCallback = null;

/**
 * Inisialisasi map picker
 * @param {string} containerId - ID container untuk map
 * @param {function} onLocationSelect - Callback saat lokasi dipilih (lat, lng, address)
 * @param {object} initialLocation - Lokasi awal {lat, lng}
 */
export function initMapPicker(containerId, onLocationSelect, initialLocation = null) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Map container tidak ditemukan:', containerId);
    return;
  }

  currentCallback = onLocationSelect;

  // Destroy map lama jika ada
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    markerInstance = null;
  }

  // Default lokasi (Indonesia)
  const defaultLat = initialLocation?.lat || -6.2088;
  const defaultLng = initialLocation?.lng || 106.8456;

  // Inisialisasi map
  mapInstance = L.map(containerId).setView([defaultLat, defaultLng], 13);

  // Tambah tile layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapInstance);

  // Tambah marker yang bisa di-drag
  markerInstance = L.marker([defaultLat, defaultLng], {
    draggable: true,
    autoPan: true,
  }).addTo(mapInstance);

  // Event saat marker di-drag
  markerInstance.on('dragend', function(e) {
    const position = e.target.getLatLng();
    updateLocation(position.lat, position.lng);
  });

  // Event saat map di-klik
  mapInstance.on('click', function(e) {
    const { lat, lng } = e.latlng;
    markerInstance.setLatLng([lat, lng]);
    updateLocation(lat, lng);
  });

  // Auto-detect lokasi perangkat
  if (!initialLocation) {
    detectCurrentLocation();
  } else {
    updateLocation(defaultLat, defaultLng);
  }
}

/**
 * Detect lokasi perangkat saat ini
 */
function detectCurrentLocation() {
  if (!navigator.geolocation) {
    console.warn('Geolocation tidak didukung browser');
    return;
  }

  const loadingPopup = L.popup()
    .setLatLng(markerInstance.getLatLng())
    .setContent('<i class="fas fa-spinner fa-spin"></i> Mendeteksi lokasi...')
    .openOn(mapInstance);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Update map dan marker
      mapInstance.setView([lat, lng], 15);
      markerInstance.setLatLng([lat, lng]);
      
      loadingPopup.remove();
      updateLocation(lat, lng);
    },
    (error) => {
      console.warn('Gagal mendeteksi lokasi:', error.message);
      loadingPopup.setContent('⚠️ Gagal mendeteksi lokasi. Silakan pilih manual.');
      setTimeout(() => loadingPopup.remove(), 3000);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

/**
 * Update lokasi dan reverse geocoding
 */
async function updateLocation(lat, lng) {
  // Tampilkan loading di popup
  const popup = L.popup()
    .setLatLng([lat, lng])
    .setContent('<i class="fas fa-spinner fa-spin"></i> Mencari alamat...')
    .openOn(mapInstance);

  try {
    // Reverse geocoding menggunakan Nominatim (OpenStreetMap)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'id',
        },
      }
    );
    
    const data = await response.json();
    const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Update popup dengan alamat
    popup.setContent(`
      <div style="max-width:200px;">
        <strong>📍 Lokasi Dipilih</strong><br/>
        <small>${address}</small>
      </div>
    `);

    // Callback ke parent
    if (currentCallback) {
      currentCallback(lat, lng, address);
    }
  } catch (error) {
    console.error('Gagal reverse geocoding:', error);
    const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    popup.setContent(`
      <div style="max-width:200px;">
        <strong>📍 Lokasi Dipilih</strong><br/>
        <small>${fallbackAddress}</small>
      </div>
    `);
    
    if (currentCallback) {
      currentCallback(lat, lng, fallbackAddress);
    }
  }
}

/**
 * Destroy map instance
 */
export function destroyMapPicker() {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    markerInstance = null;
    currentCallback = null;
  }
}

/**
 * Set lokasi map secara programmatic
 */
export function setMapLocation(lat, lng) {
  if (mapInstance && markerInstance) {
    mapInstance.setView([lat, lng], 15);
    markerInstance.setLatLng([lat, lng]);
    updateLocation(lat, lng);
  }
}
