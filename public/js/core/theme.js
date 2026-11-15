/**
 * Pengendali tema aplikasi.
 *
 * Mode tersimpan di localStorage agar tema bisa diterapkan sebelum CSS dimuat
 * (lihat skrip kecil di index.html), sehingga tidak ada kedipan warna.
 * Nilai `system` mengikuti preferensi perangkat dan diperbarui saat berubah.
 */

export const THEME_STORAGE_KEY = 'asisten.theme';
export const THEME_MODES = Object.freeze(['system', 'light', 'dark']);
export const THEME_COLORS = Object.freeze({
  light: '#f4f8f5',
  dark: '#06100b',
});

const MODE_SET = new Set(THEME_MODES);

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredMode(storage) {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return MODE_SET.has(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(media) {
  return Boolean(media?.matches);
}

export class ThemeController {
  #mode;
  #media;
  #storage;
  #listeners = new Set();
  #destroyed = false;

  constructor({
    storage = defaultStorage(),
    media = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null,
  } = {}) {
    this.#storage = storage;
    this.#media = media;
    this.#mode = readStoredMode(storage);
    this.#listenForSystemChange();
    this.apply({ notify: false });
  }

  get mode() {
    return this.#mode;
  }

  get resolved() {
    if (this.#mode === 'system') {
      return systemPrefersDark(this.#media) ? 'dark' : 'light';
    }
    return this.#mode;
  }

  get isSystem() {
    return this.#mode === 'system';
  }

  setMode(mode) {
    if (!MODE_SET.has(mode)) {
      throw new TypeError(`Mode tema tidak dikenal: "${mode}".`);
    }
    if (mode === this.#mode) return this.resolved;

    this.#mode = mode;
    try {
      this.#storage?.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Mode tetap berlaku untuk sesi ini meskipun penyimpanan diblokir.
    }
    this.apply();
    return this.resolved;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener tema harus berupa fungsi.');
    }
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  apply({ notify = true } = {}) {
    const resolved = this.resolved;
    const root = document.documentElement;

    root.dataset.theme = resolved;
    root.dataset.themeMode = this.#mode;
    root.style.colorScheme = resolved;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);

    if (!notify) return;

    const detail = { mode: this.#mode, resolved };
    document.dispatchEvent(new CustomEvent('theme:change', { detail }));
    for (const listener of this.#listeners) {
      try {
        listener(detail);
      } catch (error) {
        console.warn('[Theme] Listener tema gagal.', error);
      }
    }
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#listeners.clear();
    this.#removeSystemListener();
  }

  #listenForSystemChange() {
    if (!this.#media) return;
    if (typeof this.#media.addEventListener === 'function') {
      this.#media.addEventListener('change', this.#onSystemChange);
    } else if (typeof this.#media.addListener === 'function') {
      this.#media.addListener(this.#onSystemChange);
    }
  }

  #removeSystemListener() {
    if (!this.#media) return;
    if (typeof this.#media.removeEventListener === 'function') {
      this.#media.removeEventListener('change', this.#onSystemChange);
    } else if (typeof this.#media.removeListener === 'function') {
      this.#media.removeListener(this.#onSystemChange);
    }
  }

  #onSystemChange = () => {
    if (this.#mode !== 'system') return;
    this.apply();
  };
}
