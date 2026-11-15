import * as utils from './utils.js';
import { el } from './dom.js';
import { EVENTS } from './events.js';
import { icon } from './icons.js';

const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const CONTEXT_ABORT = Symbol('contextAbort');
const DEFAULT_MOUNT_TIMEOUT = 12_000;

/**
 * Registry plugin.
 *
 * Inti tidak mengimpor modul secara statis. Modul ditemukan dari
 * modules.json, diimpor dinamis, lalu diberi konteks layanan yang aman.
 * Menambah modul = menambah file + satu entri manifest. Core tidak diedit.
 */
export class ModuleRegistry {
  #manifestUrl;
  #db;
  #ui;
  #bus;
  #navigate;
  #modules = new Map();
  #errors = [];
  #assetUrls = new Set();

  constructor({ manifestUrl, db, ui, bus, navigate }) {
    if (!(manifestUrl instanceof URL)) throw new TypeError('manifestUrl harus berupa URL.');
    this.#manifestUrl = manifestUrl;
    this.#db = db;
    this.#ui = ui;
    this.#bus = bus;
    this.#navigate = navigate;
  }

  get modules() {
    return [...this.#modules.values()].sort((left, right) => {
      return (left.order - right.order) || left.name.localeCompare(right.name, 'id');
    });
  }

  get errors() {
    return [...this.#errors];
  }

  get assetUrls() {
    return [...this.#assetUrls];
  }

  getModule(id) {
    return this.#modules.get(id) ?? null;
  }

  get quickActions() {
    return this.modules
      .filter((module) => (
        module.context && typeof module.definition.quickAdd === 'function'
      ))
      .map((module) => ({
        id: module.id,
        name: module.name,
        description: module.description,
        icon: module.icon,
      }));
  }

  async runQuickAdd(moduleId) {
    const module = this.#modules.get(moduleId);
    if (!module || typeof module.definition.quickAdd !== 'function' || !module.context) {
      throw new Error(`Modul "${moduleId}" tidak menyediakan catat cepat.`);
    }
    return module.definition.quickAdd(module.context);
  }

  async load() {
    this.#modules.clear();
    this.#errors = [];
    this.#assetUrls.clear();

    let response;
    try {
      response = await fetch(this.#manifestUrl, { cache: 'no-cache' });
    } catch (error) {
      throw new Error('Manifest modul tidak dapat dimuat.', { cause: error });
    }
    if (!response.ok) {
      throw new Error(`Manifest modul merespons dengan status ${response.status}.`);
    }

    let manifest;
    try {
      manifest = await response.json();
    } catch (error) {
      throw new Error('Manifest modul bukan JSON yang valid.', { cause: error });
    }

    if (!manifest || !Array.isArray(manifest.modules)) {
      throw new Error('Manifest modul tidak memiliki array "modules".');
    }

    const seenIds = new Set();
    const descriptors = manifest.modules
      .filter((entry) => entry && entry.enabled !== false)
      .filter((entry) => {
        if (typeof entry.id !== 'string' || !MODULE_ID_PATTERN.test(entry.id)) {
          this.#recordError(entry?.id ?? '(tanpa id)', 'ID modul pada manifest tidak valid.');
          return false;
        }
        if (seenIds.has(entry.id)) {
          this.#recordError(entry.id, 'ID modul duplikat di dalam manifest.');
          return false;
        }
        seenIds.add(entry.id);
        return true;
      });

    const results = await Promise.allSettled(
      descriptors.map((entry) => this.#loadModule(entry)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        const id = result.reason?.moduleId ?? 'tidak diketahui';
        this.#recordError(id, result.reason?.message ?? String(result.reason));
        console.error(`[Registry] Modul "${id}" gagal dimuat.`, result.reason);
      }
    }

    const initialised = [];
    for (const module of this.modules) {
      const context = this.#createContext(module, { perMount: false });
      try {
        await module.definition.setup?.(context);
        module.context = context;
        initialised.push(module);
      } catch (error) {
        this.#recordError(module.id, `setup() gagal: ${error.message}`);
        console.error(`[Registry] setup() modul "${module.id}" gagal.`, error);
      }
    }

    this.#modules = new Map(initialised.map((module) => [module.id, module]));
    return { modules: this.modules, errors: this.errors };
  }

  async #loadModule(entry) {
    if (typeof entry.entry !== 'string' || entry.entry.length === 0) {
      throw Object.assign(new Error('Properti "entry" wajib diisi.'), { moduleId: entry.id });
    }

    const entryUrl = new URL(entry.entry, this.#manifestUrl);
    if (entryUrl.origin !== window.location.origin) {
      throw Object.assign(new Error('Entry modul harus berada di origin yang sama.'), { moduleId: entry.id });
    }

    const assets = [];
    for (const asset of Array.isArray(entry.assets) ? entry.assets : []) {
      if (typeof asset !== 'string') continue;
      const assetUrl = new URL(asset, this.#manifestUrl);
      if (assetUrl.origin === window.location.origin) assets.push(assetUrl.href);
    }

    this.#assetUrls.add(entryUrl.href);
    for (const asset of assets) this.#assetUrls.add(asset);

    let namespace;
    try {
      namespace = await import(entryUrl.href);
    } catch (error) {
      throw Object.assign(
        new Error(`Import modul gagal: ${error.message}`),
        { moduleId: entry.id, cause: error },
      );
    }

    const definition = namespace.default;
    if (!definition || typeof definition !== 'object') {
      throw Object.assign(new Error('Modul harus mengekspor default object.'), { moduleId: entry.id });
    }
    if (definition.id !== entry.id) {
      throw Object.assign(
        new Error(`ID modul "${definition.id}" tidak cocok dengan manifest "${entry.id}".`),
        { moduleId: entry.id },
      );
    }
    if (typeof definition.name !== 'string' || definition.name.trim() === '') {
      throw Object.assign(new Error('Modul wajib punya properti "name".'), { moduleId: entry.id });
    }
    if (typeof definition.mount !== 'function') {
      throw Object.assign(new Error('Modul wajib punya method "mount()".'), { moduleId: entry.id });
    }

    if (typeof definition.styles === 'string' && definition.styles.trim()) {
      this.#injectStyles(entry.id, definition.styles);
    }

    const module = {
      id: entry.id,
      name: definition.name.trim(),
      description: typeof definition.description === 'string' ? definition.description : '',
      version: typeof definition.version === 'string' ? definition.version : '1.0.0',
      icon: typeof definition.icon === 'string' && definition.icon.trim()
        ? definition.icon
        : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18"/></svg>',
      order: Number.isFinite(definition.order) ? definition.order : 100,
      entryUrl: entryUrl.href,
      definition,
      context: null,
    };

    this.#modules.set(module.id, module);
    return module;
  }

  #injectStyles(moduleId, css) {
    const existing = document.querySelector(`style[data-module-styles="${moduleId}"]`);
    const style = existing ?? document.createElement('style');
    if (!existing) {
      style.dataset.moduleStyles = moduleId;
      document.head.append(style);
    }
    style.textContent = `/* Modul: ${moduleId} */\n${css}`;
  }

  #createContext(module, { perMount = false } = {}) {
    const scope = this.#db.scope(module.id);
    const cleanups = new Set();
    const controller = perMount ? new AbortController() : null;

    const runCleanup = () => {
      for (const cleanup of [...cleanups].reverse()) {
        try {
          cleanup?.();
        } catch (error) {
          console.error(`[Registry] Cleanup modul "${module.id}" gagal.`, error);
        }
      }
      cleanups.clear();
    };

    const context = {
      module: Object.freeze({
        id: module.id,
        name: module.name,
        description: module.description,
        version: module.version,
      }),
      db: scope,
      data: (collection) => scope.collection(collection),
      ui: this.#ui,
      bus: this.#bus,
      utils,
      navigate: (path, options) => this.#navigate(path, options),
      signal: controller?.signal ?? null,
      onCleanup: (cleanup) => {
        if (typeof cleanup === 'function') cleanups.add(cleanup);
        return cleanup;
      },
      on: (eventName, handler) => {
        const unsubscribe = this.#bus.on(eventName, handler);
        if (perMount) cleanups.add(unsubscribe);
        return unsubscribe;
      },
      runCleanup,
      [CONTEXT_ABORT]: () => controller?.abort(),
    };

    return Object.freeze(context);
  }

  /**
   * Me-mount modul ke container dengan error boundary.
   *
   * Batas waktu mencegah modul yang menggantung membuat area konten kosong
   * selamanya. Saat mount gagal, DOM yang sempat ditulis modul dibersihkan,
   * konteks di-abort, lalu `onError` dipanggil. Jika pemanggil tidak
   * menyediakan `onError`, registry merender fallback mandiri.
   *
   * @returns {Promise<Function>} Fungsi teardown yang aman dipanggil berulang.
   */
  async mount(moduleId, container, {
    onError = null,
    timeoutMs = DEFAULT_MOUNT_TIMEOUT,
  } = {}) {
    const module = this.#modules.get(moduleId);
    if (!module) throw new Error(`Modul "${moduleId}" tidak tersedia.`);
    if (!(container instanceof Element)) {
      throw new TypeError('Container modul harus berupa Element.');
    }

    const context = this.#createContext(module, { perMount: true });
    let moduleResult;
    let timedOut = false;
    let timer = null;

    // Dibungkus Promise.resolve agar error sinkron dari mount() ikut tertangkap.
    const mountPromise = Promise.resolve()
      .then(() => module.definition.mount(context, container));

    const timeoutPromise = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          timedOut = true;
          reject(new Error(`mount() melewati batas waktu ${timeoutMs} ms.`));
        }, timeoutMs);
      })
      : null;

    try {
      moduleResult = await (timeoutPromise
        ? Promise.race([mountPromise, timeoutPromise])
        : mountPromise);
    } catch (error) {
      if (timer) window.clearTimeout(timer);
      context.runCleanup();
      context[CONTEXT_ABORT]();
      container.replaceChildren();

      const detail = {
        moduleId: module.id,
        moduleName: module.name,
        error,
        timedOut,
      };

      this.#recordError(module.id, `mount() gagal: ${error?.message ?? String(error)}`);
      this.#bus.emit(EVENTS.MODULE_MOUNT_ERROR, detail);
      console.error(`[Registry] mount() modul "${module.id}" gagal.`, error);

      // Jika mount baru selesai setelah timeout, bersihkan hasil telatnya.
      mountPromise.then((lateResult) => {
        if (timedOut && typeof lateResult === 'function') {
          Promise.resolve(lateResult()).catch((cleanupError) => {
            console.error(`[Registry] Cleanup telat modul "${module.id}" gagal.`, cleanupError);
          });
        }
      }).catch(() => {});

      let handled = false;
      if (typeof onError === 'function') {
        try {
          await onError(detail);
          handled = true;
        } catch (callbackError) {
          console.error(`[Registry] onError modul "${module.id}" gagal.`, callbackError);
        }
      }
      if (!handled) this.#renderMountFallback(container, module, error);

      // Pemanggil tetap mendapat teardown yang aman, bukan exception.
      return async () => {};
    } finally {
      if (timer) window.clearTimeout(timer);
    }

    let tornDown = false;
    return async () => {
      if (tornDown) return;
      tornDown = true;

      try {
        if (typeof moduleResult === 'function') await moduleResult();
        await module.definition.unmount?.(context);
      } catch (error) {
        console.error(`[Registry] Teardown modul "${module.id}" gagal.`, error);
      } finally {
        context.runCleanup();
        context[CONTEXT_ABORT]();
      }
    };
  }

  #renderMountFallback(container, module, error) {
    const card = el('div', { class: 'empty-card empty-card--wide' },
      el('span', { class: 'empty-card__icon empty-card__icon--danger', html: '!' }),
      el('h2', { class: 'empty-card__title', text: 'Modul gagal ditampilkan' }),
      el('p', {
        class: 'empty-card__text',
        text: `Modul ${module.name} mengalami gangguan. Data tetap aman dan modul lain tidak terpengaruh.`,
      }),
      el('details', { class: 'fatal-details' },
        el('summary', { text: 'Detail teknis' }),
        el('code', { text: error?.message ?? String(error) }),
      ),
    );
    container.replaceChildren(card);
  }

  async getSummaries() {
    const modules = this.modules.filter((module) => module.context
      && typeof module.definition.getHomeSummary === 'function');

    const results = await Promise.allSettled(
      modules.map((module) => module.definition.getHomeSummary(module.context)),
    );

    const summaries = [];
    results.forEach((result, index) => {
      const module = modules[index];
      if (result.status === 'rejected') {
        console.error(`[Registry] Ringkasan modul "${module.id}" gagal.`, result.reason);
        return;
      }
      if (!Array.isArray(result.value)) return;

      // Beranda hanya menampilkan satu sorotan per modul. Modul dapat menandai
      // kartu pilihannya dengan `primary: true`; jika tidak, kartu valid
      // pertama yang dipakai.
      const candidates = result.value.filter((summary) => (
        summary && typeof summary.label === 'string'
      ));
      const summary = candidates.find((item) => item.primary === true) ?? candidates[0];
      if (!summary) return;

      summaries.push({
        ...summary,
        id: summary.id ?? `${module.id}-primary`,
        moduleId: module.id,
        moduleName: module.name,
        moduleIcon: module.icon,
        value: summary.value === undefined || summary.value === null
          ? '-'
          : String(summary.value),
      });
    });

    return summaries;
  }

  /**
   * Mengumpulkan notifikasi dari modul yang menyediakan kontrak opsional
   * `getNotifications(ctx)`. Notifikasi bersifat turunan kondisi saat ini,
   * jadi tidak ada status "sudah dibaca".
   */
  async getNotifications() {
    const modules = this.modules.filter((module) => module.context
      && typeof module.definition.getNotifications === 'function');

    const results = await Promise.allSettled(
      modules.map((module) => module.definition.getNotifications(module.context)),
    );

    const notifications = [];
    results.forEach((result, index) => {
      const module = modules[index];
      if (result.status === 'rejected') {
        console.error(`[Registry] Notifikasi modul "${module.id}" gagal.`, result.reason);
        return;
      }
      if (!Array.isArray(result.value)) return;

      for (const item of result.value) {
        if (!item || typeof item.title !== 'string' || !item.title.trim()) continue;

        let iconMarkup = module.icon;
        if (typeof item.icon === 'string' && item.icon.trim()) {
          iconMarkup = item.icon.trim().startsWith('<')
            ? item.icon
            : icon(item.icon);
        }

        notifications.push({
          id: typeof item.id === 'string' && item.id ? item.id : `${module.id}-${notifications.length}`,
          moduleId: module.id,
          source: module.name,
          icon: iconMarkup,
          title: item.title.trim(),
          text: typeof item.text === 'string' ? item.text : '',
          tone: ['default', 'warning', 'danger'].includes(item.tone) ? item.tone : 'default',
          path: typeof item.path === 'string' && item.path.startsWith('/')
            ? item.path
            : `/modul/${module.id}`,
        });
      }
    });

    return notifications;
  }

  #recordError(moduleId, message) {
    this.#errors.push({ moduleId, message });
  }
}
