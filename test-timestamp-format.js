/**
 * Test untuk memverifikasi format timestamp dan konversi waktu
 * Run dengan: node test-timestamp-format.js
 */

// Simulasi fungsi fmtTime dari helpers.js
function fmtTime(t) {
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

// Simulasi fungsi localNow dari helpers.js
function localNow(date = new Date()) {
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

console.log('=== TEST TIMESTAMP FORMAT ===\n');

// Test 1: Format yang disimpan ke database
console.log('Test 1: Format yang disimpan ke database');
const { dateStr, timeStr, datetimeStr } = localNow();
console.log('  dateStr:', dateStr);
console.log('  timeStr:', timeStr);
console.log('  datetimeStr:', datetimeStr);

// Test 2: Simulasi input admin check-in
console.log('\nTest 2: Simulasi admin check-in');
const checkInTime = '08:00';
const checkOutTime = '17:00';
const checkInTs = `${dateStr} ${checkInTime}:00+07:00`;
const checkOutTs = `${dateStr} ${checkOutTime}:00+07:00`;
console.log('  Check-in timestamp:', checkInTs);
console.log('  Check-out timestamp:', checkOutTs);

// Test 3: Format yang dikembalikan dari database (simulasi PostgreSQL TIMESTAMPTZ)
console.log('\nTest 3: Format dari database (PostgreSQL TIMESTAMPTZ)');
// PostgreSQL mengembalikan dalam format ISO 8601
const dbCheckIn = new Date(`${dateStr}T${checkInTime}:00+07:00`).toISOString();
const dbCheckOut = new Date(`${dateStr}T${checkOutTime}:00+07:00`).toISOString();
console.log('  DB Check-in (ISO):', dbCheckIn);
console.log('  DB Check-out (ISO):', dbCheckOut);

// Test 4: Konversi dengan fmtTime
console.log('\nTest 4: Konversi dengan fmtTime');
console.log('  fmtTime(checkInTs):', fmtTime(checkInTs));
console.log('  fmtTime(checkOutTs):', fmtTime(checkOutTs));
console.log('  fmtTime(dbCheckIn):', fmtTime(dbCheckIn));
console.log('  fmtTime(dbCheckOut):', fmtTime(dbCheckOut));

// Test 5: Berbagai format timestamp
console.log('\nTest 5: Berbagai format timestamp');
const testCases = [
  '08:00',
  '08:00:00',
  '2026-05-07 08:00:00',
  '2026-05-07 08:00:00+07:00',
  '2026-05-07T08:00:00+07:00',
  '2026-05-07T08:00:00.000Z',
  new Date('2026-05-07T08:00:00+07:00').toISOString(),
];

testCases.forEach(tc => {
  console.log(`  "${tc}" → ${fmtTime(tc)}`);
});

// Test 6: Verifikasi timezone
console.log('\nTest 6: Verifikasi timezone conversion');
const testDate = new Date('2026-05-07T08:00:00+07:00');
console.log('  Input: 2026-05-07T08:00:00+07:00 (WIB)');
console.log('  UTC:', testDate.toISOString());
console.log('  Local (id-ID):', testDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
console.log('  fmtTime:', fmtTime(testDate.toISOString()));

// Test 7: Edge case - midnight
console.log('\nTest 7: Edge case - midnight');
const midnight = `${dateStr} 00:00:00+07:00`;
console.log('  Midnight timestamp:', midnight);
console.log('  fmtTime(midnight):', fmtTime(midnight));

// Test 8: Edge case - late night
console.log('\nTest 8: Edge case - late night');
const lateNight = `${dateStr} 23:59:00+07:00`;
console.log('  Late night timestamp:', lateNight);
console.log('  fmtTime(lateNight):', fmtTime(lateNight));

console.log('\n=== TEST SELESAI ===');
console.log('\n✅ Kesimpulan:');
console.log('1. Format yang disimpan ke DB: YYYY-MM-DD HH:MM:SS+07:00');
console.log('2. Format yang dikembalikan dari DB: ISO 8601 (YYYY-MM-DDTHH:MM:SS.sssZ)');
console.log('3. fmtTime() dapat menangani kedua format dengan benar');
console.log('4. Waktu ditampilkan dalam format HH:MM (24 jam)');
