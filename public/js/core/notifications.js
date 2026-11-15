/**
 * Helper Web Notification yang ringan.
 *
 * Batasan penting:
 * - Izin hanya boleh diminta dari gestur pengguna.
 * - Timer pengingat hidup selama halaman aplikasi masih terbuka. Saat PWA
 *   ditutup, browser tidak menjamin timer berjalan. Untuk pengingat yang
 *   benar-benar terjadwal saat aplikasi mati, dibutuhkan push/periodic sync
 *   dari backend atau dukungan browser khusus.
 * - Service worker dipakai lebih dulu karena `new Notification()` sering
 *   diblokir di browser mobile.
 */
const MAX_TIMER_DELAY = 2_147_483_647;

function absoluteAsset(path) {
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return String(path);
  }
}

export class NotificationCenter {
  #timers = new Map();
  #icon;
  #badge;

  constructor({
    icon = './icons/icon-192.png',
    badge = './icons/icon-192.png',
  } = {}) {
    this.#icon = icon;
    this.#badge = badge;
  }

  get supported() {
    return typeof window !== 'undefined'
      && window.isSecureContext !== false
      && typeof globalThis.Notification !== 'undefined';
  }

  get permission() {
    if (!this.supported) return 'unsupported';
    return globalThis.Notification.permission;
  }

  get canNotify() {
    return this.permission === 'granted';
  }

  get scheduledIds() {
    return [...this.#timers.keys()];
  }

  get scheduledCount() {
    return this.#timers.size;
  }

  async requestPermission() {
    if (!this.supported) return 'unsupported';
    if (this.permission !== 'default') return this.permission;

    try {
      return await globalThis.Notification.requestPermission();
    } catch (error) {
      console.warn('[Notification] Permintaan izin gagal.', error);
      return 'default';
    }
  }

  /**
   * Menampilkan notifikasi. Kembalian selalu objek agar pemanggil dapat
   * menangani kegagalan tanpa try/catch tambahan.
   */
  async show({
    title,
    body = '',
    tag = null,
    data = null,
    icon = null,
    badge = null,
    silent = false,
    requireInteraction = false,
  } = {}) {
    if (!this.canNotify) {
      return { shown: false, reason: 'permission' };
    }
    if (typeof title !== 'string' || title.trim() === '') {
      return { shown: false, reason: 'title' };
    }

    const options = {
      body: String(body),
      icon: absoluteAsset(icon ?? this.#icon),
      badge: absoluteAsset(badge ?? this.#badge),
      data,
      silent: Boolean(silent),
      requireInteraction: Boolean(requireInteraction),
    };
    if (tag) {
      options.tag = String(tag);
      options.renotify = true;
    }

    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      if (registration?.showNotification) {
        await registration.showNotification(title.trim(), options);
        return { shown: true, via: 'service-worker' };
      }

      if (typeof globalThis.Notification === 'function') {
        const notification = new globalThis.Notification(title.trim(), options);
        return { shown: true, via: 'window', notification };
      }
    } catch (error) {
      console.warn('[Notification] Gagal menampilkan notifikasi.', error);
      return { shown: false, reason: 'error', error };
    }

    return { shown: false, reason: 'unavailable' };
  }

  /**
   * Menjadwalkan notifikasi satu kali. `id` dipakai untuk membatalkan atau
   * mengganti jadwal. Hanya jadwal dalam rentang timer browser yang diterima.
   */
  schedule({
    id,
    at,
    onShown = null,
    ...notification
  } = {}) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError('ID jadwal notifikasi wajib berupa string.');
    }
    if (!this.canNotify) return false;

    const target = at instanceof Date ? at.getTime() : Number(at);
    const delay = target - Date.now();
    if (!Number.isFinite(delay) || delay <= 0 || delay > MAX_TIMER_DELAY) {
      return false;
    }

    this.cancel(id);
    const timer = window.setTimeout(async () => {
      this.#timers.delete(id);
      const result = await this.show(notification);
      if (result.shown && typeof onShown === 'function') {
        try {
          await onShown(result);
        } catch (error) {
          console.error('[Notification] Callback onShown gagal.', error);
        }
      }
    }, delay);

    this.#timers.set(id, timer);
    return true;
  }

  cancel(id) {
    const timer = this.#timers.get(id);
    if (!timer) return false;
    window.clearTimeout(timer);
    this.#timers.delete(id);
    return true;
  }

  cancelAll(prefix = '') {
    let cancelled = 0;
    for (const id of [...this.#timers.keys()]) {
      if (!prefix || id.startsWith(prefix)) {
        if (this.cancel(id)) cancelled += 1;
      }
    }
    return cancelled;
  }
}

export const notifications = new NotificationCenter();

export function notificationPermissionLabel(permission = notifications.permission) {
  if (permission === 'granted') return 'Aktif';
  if (permission === 'denied') return 'Diblokir';
  if (permission === 'unsupported') return 'Tidak didukung';
  return 'Belum aktif';
}
