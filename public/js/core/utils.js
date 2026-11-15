/**
 * Utilitas umum tanpa ketergantungan pada fitur tertentu.
 */

/** UUID v4 dengan fallback untuk browser lama. */
export function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function debounce(callback, delay = 150) {
  let timer = null;

  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      callback(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return debounced;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function capitalise(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Tanggal lokal dalam format YYYY-MM-DD (aman dari pergeseran UTC). */
export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Mengubah YYYY-MM-DD menjadi Date lokal, atau null jika tidak valid. */
export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Selisih hari kalender lokal antara tanggal dan hari ini. Negatif = lampau. */
export function daysFromToday(dateKey, now = new Date()) {
  const target = parseDateKey(dateKey);
  if (!target) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay - today) / 86_400_000);
}

/** Label tenggat yang konsisten untuk modul apa pun. */
export function describeDueDate(dateKey, now = new Date()) {
  const difference = daysFromToday(dateKey, now);
  if (difference === null) return { label: 'Tanpa tenggat', state: 'none' };

  if (difference < 0) {
    const late = Math.abs(difference);
    return {
      label: late === 1 ? 'Terlambat 1 hari' : `Terlambat ${late} hari`,
      state: 'overdue',
    };
  }
  if (difference === 0) return { label: 'Tenggat hari ini', state: 'today' };
  if (difference === 1) return { label: 'Tenggat besok', state: 'soon' };

  const date = parseDateKey(dateKey);
  return {
    label: new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    }).format(date),
    state: 'upcoming',
  };
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[exponent]}`;
}

export function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function pluralizeId(count, singular, plural = singular) {
  return `${count.toLocaleString('id-ID')} ${count === 1 ? singular : plural}`;
}
