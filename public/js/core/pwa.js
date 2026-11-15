/**
 * Pengelola PWA: instalasi, pembaruan service worker, dan pre-cache
 * aset modul. Service worker tidak pernah mengunci halaman pada cache lama:
 * aset kode memakai network-first, aset visual memakai stale-while-revalidate.
 */
export class PwaController {
  #registration = null;
  #updateWorker = null;
  #deferredInstallPrompt = null;
  #updateNotified = false;
  #reloadRequested = false;
  #onUpdateReady = null;

  constructor({ onUpdateReady = null } = {}) {
    this.#onUpdateReady = onUpdateReady;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.#deferredInstallPrompt = event;
    });

    window.addEventListener('appinstalled', () => {
      this.#deferredInstallPrompt = null;
    });

    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      if (this.#reloadRequested) window.location.reload();
    });
  }

  get supported() {
    return 'serviceWorker' in navigator && window.isSecureContext;
  }

  get canInstall() {
    return Boolean(this.#deferredInstallPrompt);
  }

  get isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  async register() {
    if (!this.supported) {
      console.info('[PWA] Service worker tidak aktif di konteks ini (butuh HTTPS/localhost).');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
      });
      this.#registration = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        this.#notifyUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            this.#notifyUpdate(installing);
          }
        });
      });

      registration.update().catch(() => {});
      window.addEventListener('online', () => {
        registration.update().catch(() => {});
      });

      return registration;
    } catch (error) {
      console.warn('[PWA] Registrasi service worker gagal.', error);
      return null;
    }
  }

  async cacheModuleAssets(urls) {
    if (!this.supported || !Array.isArray(urls) || urls.length === 0) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const target = registration.active ?? navigator.serviceWorker.controller;
      target?.postMessage({
        type: 'CACHE_URLS',
        urls: urls.slice(0, 100),
      });
    } catch (error) {
      console.warn('[PWA] Gagal mengirim daftar aset modul.', error);
    }
  }

  async install() {
    if (this.isStandalone) return { status: 'installed' };
    if (!this.#deferredInstallPrompt) return { status: 'unavailable' };

    const prompt = this.#deferredInstallPrompt;
    this.#deferredInstallPrompt = null;

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      return { status: choice.outcome };
    } catch (error) {
      console.warn('[PWA] Prompt instalasi gagal.', error);
      return { status: 'error' };
    }
  }

  applyUpdate() {
    const worker = this.#updateWorker ?? this.#registration?.waiting;
    this.#reloadRequested = true;

    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }

    // Jaring pengaman jika controllerchange tidak terpicu.
    window.setTimeout(() => {
      if (this.#reloadRequested) window.location.reload();
    }, 1800);
  }

  #notifyUpdate(worker) {
    if (this.#updateNotified) return;
    this.#updateNotified = true;
    this.#updateWorker = worker;
    this.#onUpdateReady?.();
  }
}
