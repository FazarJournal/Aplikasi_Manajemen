import { bus as defaultBus } from './bus.js';
import { EVENTS } from './events.js';
import { createId, isPlainObject } from './utils.js';

const RECORDS = 'records';
const SETTINGS = 'settings';
const META = 'meta';

const BACKUP_FORMAT = 'asisten-pribadi-siswa-backup';
const BACKUP_VERSION = 1;

const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const COLLECTION_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('Permintaan IndexedDB gagal.')), { once: true });
  });
}

function validateModuleId(moduleId) {
  if (typeof moduleId !== 'string' || !MODULE_ID_PATTERN.test(moduleId)) {
    throw new TypeError(`ID modul tidak valid: "${moduleId}". Gunakan huruf kecil, angka, dan tanda hubung.`);
  }
}

function validateCollection(collection) {
  if (typeof collection !== 'string' || !COLLECTION_PATTERN.test(collection)) {
    throw new TypeError(`Nama koleksi tidak valid: "${collection}". Gunakan huruf kecil, angka, garis bawah, atau tanda hubung.`);
  }
}

function recordKey(moduleId, collection, id) {
  return `${moduleId}::${collection}::${id}`;
}

function publicRecord(raw) {
  return {
    ...raw._data,
    id: raw._id,
    createdAt: raw._createdAt,
    updatedAt: raw._updatedAt,
  };
}

function compareNewestFirst(left, right) {
  return String(right._updatedAt).localeCompare(String(left._updatedAt));
}

/**
 * Skema backup bersifat append-only. Validasi ini sengaja ketat agar
 * file impor tidak merusak indeks atau mengubah identitas dokumen.
 */
export function validateBackupPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new Error('File backup tidak dikenali.');
  }
  if (payload.format !== BACKUP_FORMAT) {
    throw new Error('Format file bukan backup Asisten Pribadi Siswa.');
  }
  if (!Number.isInteger(payload.formatVersion) || payload.formatVersion < 1) {
    throw new Error('Versi format backup tidak valid.');
  }
  if (payload.formatVersion > BACKUP_VERSION) {
    throw new Error('Backup dibuat oleh versi aplikasi yang lebih baru.');
  }
  if (!Array.isArray(payload.records) || !Array.isArray(payload.settings)) {
    throw new Error('Struktur backup tidak lengkap.');
  }

  const records = payload.records.map((raw) => {
    if (!isPlainObject(raw)
      || typeof raw._module !== 'string'
      || typeof raw._collection !== 'string'
      || typeof raw._id !== 'string'
      || typeof raw._createdAt !== 'string'
      || typeof raw._updatedAt !== 'string'
      || !isPlainObject(raw._data)) {
      throw new Error('Ada catatan yang rusak di dalam file backup.');
    }

    validateModuleId(raw._module);
    validateCollection(raw._collection);

    const expectedKey = recordKey(raw._module, raw._collection, raw._id);
    if (raw._key !== expectedKey) {
      throw new Error('Kunci catatan backup tidak konsisten.');
    }

    return {
      _key: expectedKey,
      _module: raw._module,
      _collection: raw._collection,
      _id: raw._id,
      _data: raw._data,
      _createdAt: raw._createdAt,
      _updatedAt: raw._updatedAt,
    };
  });

  const settings = payload.settings.map((raw) => {
    if (!isPlainObject(raw) || typeof raw.key !== 'string' || raw.key.length === 0
      || !Object.hasOwn(raw, 'value')) {
      throw new Error('Ada pengaturan yang rusak di dalam file backup.');
    }
    return {
      key: raw.key,
      value: raw.value,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
  });

  return { records, settings };
}

/**
 * Penyimpanan lokal berbasis dokumen.
 *
 * Modul tidak pernah membuat object store sendiri. Semua data modul masuk
 * ke satu store `records` dengan indeks [module, collection]. Karena itu,
 * menambah fitur baru tidak membutuhkan migrasi skema database.
 */
export class LocalDatabase {
  #name;
  #version;
  #appVersion;
  #bus;
  #dbPromise = null;

  constructor({
    name = 'asisten-pribadi-siswa',
    version = 1,
    appVersion = '1.4.0',
    bus = defaultBus,
  } = {}) {
    this.#name = name;
    this.#version = version;
    this.#appVersion = appVersion;
    this.#bus = bus;
  }

  get name() {
    return this.#name;
  }

  get version() {
    return this.#version;
  }

  async open() {
    if (this.#dbPromise) return this.#dbPromise;

    this.#dbPromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('Browser ini tidak mendukung IndexedDB.'));
        return;
      }

      const request = indexedDB.open(this.#name, this.#version);

      request.onupgradeneeded = () => this.#upgrade(request.result);
      request.onblocked = () => {
        console.warn('[DB] Pembaruan database tertahan oleh tab lain.');
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Database lokal tidak dapat dibuka.'));
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          this.#dbPromise = null;
          this.#bus.emit(EVENTS.DB_VERSION_CHANGE);
        };
        resolve(database);
      };
    }).catch((error) => {
      this.#dbPromise = null;
      throw error;
    });

    return this.#dbPromise;
  }

  /**
   * Hanya menambah store/index yang belum ada. Tidak pernah menghapus
   * data lama. Versi database dapat tetap 1 selama modul memakai `records`.
   */
  #upgrade(database) {
    if (!database.objectStoreNames.contains(RECORDS)) {
      const store = database.createObjectStore(RECORDS, { keyPath: '_key' });
      store.createIndex('_scope', ['_module', '_collection'], { unique: false });
      store.createIndex('_module', '_module', { unique: false });
      store.createIndex('_updatedAt', '_updatedAt', { unique: false });
    }

    if (!database.objectStoreNames.contains(SETTINGS)) {
      database.createObjectStore(SETTINGS, { keyPath: 'key' });
    }

    if (!database.objectStoreNames.contains(META)) {
      database.createObjectStore(META, { keyPath: 'key' });
    }
  }

  async #transaction(storeNames, mode, work) {
    const database = await this.open();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];

    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = database.transaction(names, mode);
      } catch (error) {
        reject(error);
        return;
      }

      let result;
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error ?? new Error('Transaksi database gagal.'));
      };

      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      transaction.onerror = () => fail(transaction.error);
      transaction.onabort = () => fail(transaction.error);

      Promise.resolve()
        .then(() => work(transaction))
        .then((value) => {
          result = value;
        })
        .catch((error) => {
          try {
            transaction.abort();
          } catch {
            // Transaksi mungkin sudah selesai/abort.
          }
          fail(error);
        });
    });
  }

  /**
   * Membuat namespace data untuk satu modul. Modul hanya bisa mengakses
   * koleksi di dalam namespace miliknya sendiri.
   */
  scope(moduleId) {
    validateModuleId(moduleId);
    const collectionCache = new Map();

    return Object.freeze({
      moduleId,
      collection: (collectionName) => {
        validateCollection(collectionName);
        if (collectionCache.has(collectionName)) {
          return collectionCache.get(collectionName);
        }

        const repository = Object.freeze({
          list: () => this.#list(moduleId, collectionName),
          get: (id) => this.#get(moduleId, collectionName, id),
          create: (data) => this.#create(moduleId, collectionName, data),
          update: (id, patch) => this.#update(moduleId, collectionName, id, patch),
          remove: (id) => this.#remove(moduleId, collectionName, id),
          clear: () => this.#clear(moduleId, collectionName),
          count: () => this.#count(moduleId, collectionName),
        });

        collectionCache.set(collectionName, repository);
        return repository;
      },
    });
  }

  #emitDataChange(moduleId, collection, action, id = null) {
    this.#bus.emit(EVENTS.DATA_CHANGED, { moduleId, collection, action, id });
  }

  async #list(moduleId, collection) {
    return this.#transaction(RECORDS, 'readonly', async (transaction) => {
      const index = transaction.objectStore(RECORDS).index('_scope');
      const request = index.getAll(IDBKeyRange.only([moduleId, collection]));
      const rows = await requestResult(request);
      return rows.sort(compareNewestFirst).map(publicRecord);
    });
  }

  async #get(moduleId, collection, id) {
    if (typeof id !== 'string' || id.length === 0) return null;
    return this.#transaction(RECORDS, 'readonly', async (transaction) => {
      const raw = await requestResult(
        transaction.objectStore(RECORDS).get(recordKey(moduleId, collection, id)),
      );
      return raw ? publicRecord(raw) : null;
    });
  }

  async #create(moduleId, collection, data) {
    if (!isPlainObject(data)) {
      throw new TypeError('Data yang disimpan harus berupa objek biasa.');
    }

    const id = createId();
    const now = new Date().toISOString();
    const raw = {
      _key: recordKey(moduleId, collection, id),
      _module: moduleId,
      _collection: collection,
      _id: id,
      _data: { ...data },
      _createdAt: now,
      _updatedAt: now,
    };

    await this.#transaction(RECORDS, 'readwrite', async (transaction) => {
      transaction.objectStore(RECORDS).put(raw);
    });

    this.#emitDataChange(moduleId, collection, 'create', id);
    return publicRecord(raw);
  }

  async #update(moduleId, collection, id, patch) {
    if (!isPlainObject(patch)) {
      throw new TypeError('Patch pembaruan harus berupa objek biasa.');
    }

    const result = await this.#transaction(RECORDS, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(RECORDS);
      const raw = await requestResult(store.get(recordKey(moduleId, collection, id)));
      if (!raw) throw new Error('Data yang ingin diubah tidak ditemukan.');

      const updated = {
        ...raw,
        _data: { ...raw._data, ...patch },
        _updatedAt: new Date().toISOString(),
      };
      store.put(updated);
      return updated;
    });

    this.#emitDataChange(moduleId, collection, 'update', id);
    return publicRecord(result);
  }

  async #remove(moduleId, collection, id) {
    const existed = await this.#transaction(RECORDS, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(RECORDS);
      const key = recordKey(moduleId, collection, id);
      const raw = await requestResult(store.get(key));
      if (!raw) return false;
      store.delete(key);
      return true;
    });

    if (existed) this.#emitDataChange(moduleId, collection, 'remove', id);
    return existed;
  }

  async #clear(moduleId, collection) {
    const deleted = await this.#transaction(RECORDS, 'readwrite', async (transaction) => {
      const index = transaction.objectStore(RECORDS).index('_scope');
      const keys = await requestResult(index.getAllKeys(IDBKeyRange.only([moduleId, collection])));
      const store = transaction.objectStore(RECORDS);
      for (const key of keys) store.delete(key);
      return keys.length;
    });

    if (deleted > 0) this.#emitDataChange(moduleId, collection, 'clear');
    return deleted;
  }

  async #count(moduleId, collection) {
    return this.#transaction(RECORDS, 'readonly', async (transaction) => {
      const index = transaction.objectStore(RECORDS).index('_scope');
      return requestResult(index.count(IDBKeyRange.only([moduleId, collection])));
    });
  }

  async getSetting(key, fallback = null) {
    if (typeof key !== 'string' || key.length === 0) throw new TypeError('Kunci pengaturan tidak valid.');
    return this.#transaction(SETTINGS, 'readonly', async (transaction) => {
      const raw = await requestResult(transaction.objectStore(SETTINGS).get(key));
      return raw ? raw.value : fallback;
    });
  }

  async getAllSettings() {
    return this.#transaction(SETTINGS, 'readonly', async (transaction) => {
      const rows = await requestResult(transaction.objectStore(SETTINGS).getAll());
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    });
  }

  async setSetting(key, value) {
    if (typeof key !== 'string' || key.length === 0) throw new TypeError('Kunci pengaturan tidak valid.');
    const updatedAt = new Date().toISOString();

    await this.#transaction(SETTINGS, 'readwrite', async (transaction) => {
      transaction.objectStore(SETTINGS).put({ key, value, updatedAt });
    });

    this.#bus.emit(EVENTS.SETTINGS_CHANGED, { key, value });
    return value;
  }

  async deleteSetting(key) {
    await this.#transaction(SETTINGS, 'readwrite', async (transaction) => {
      transaction.objectStore(SETTINGS).delete(key);
    });
    this.#bus.emit(EVENTS.SETTINGS_CHANGED, { key, value: undefined });
  }

  /** Jumlah seluruh dokumen modul, dipakai untuk pengingat backup awal. */
  async countRecords() {
    return this.#transaction(RECORDS, 'readonly', async (transaction) => {
      return requestResult(transaction.objectStore(RECORDS).count());
    });
  }

  async getMeta(key, fallback = null) {
    return this.#transaction(META, 'readonly', async (transaction) => {
      const raw = await requestResult(transaction.objectStore(META).get(key));
      return raw ? raw.value : fallback;
    });
  }

  async setMeta(key, value) {
    await this.#transaction(META, 'readwrite', async (transaction) => {
      transaction.objectStore(META).put({ key, value });
    });
    return value;
  }

  /** Snapshot seluruh data dalam satu transaksi baca. */
  async exportData() {
    return this.#transaction([RECORDS, SETTINGS], 'readonly', async (transaction) => {
      const [records, settings] = await Promise.all([
        requestResult(transaction.objectStore(RECORDS).getAll()),
        requestResult(transaction.objectStore(SETTINGS).getAll()),
      ]);

      return {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_VERSION,
        appVersion: this.#appVersion,
        databaseVersion: this.#version,
        exportedAt: new Date().toISOString(),
        counts: {
          records: records.length,
          settings: settings.length,
        },
        records,
        settings,
      };
    });
  }

  /**
   * Import bersifat atomik. Mode "merge" mempertahankan catatan lain,
   * mode "replace" menghapus data lama terlebih dahulu.
   */
  async importData(payload, { mode = 'merge' } = {}) {
    if (!['merge', 'replace'].includes(mode)) {
      throw new Error('Mode import tidak dikenal.');
    }

    const { records, settings } = validateBackupPayload(payload);

    await this.#transaction([RECORDS, SETTINGS], 'readwrite', async (transaction) => {
      const recordStore = transaction.objectStore(RECORDS);
      const settingStore = transaction.objectStore(SETTINGS);

      if (mode === 'replace') {
        recordStore.clear();
        settingStore.clear();
      }

      for (const raw of records) recordStore.put(raw);
      for (const raw of settings) settingStore.put(raw);
    });

    this.#bus.emit(EVENTS.DATA_IMPORTED, {
      mode,
      records: records.length,
      settings: settings.length,
    });
    this.#emitDataChange('*', '*', 'import');
    return { records: records.length, settings: settings.length };
  }

  async clearAll() {
    await this.#transaction([RECORDS, SETTINGS, META], 'readwrite', async (transaction) => {
      transaction.objectStore(RECORDS).clear();
      transaction.objectStore(SETTINGS).clear();
      transaction.objectStore(META).clear();
    });
    this.#bus.emit(EVENTS.DATA_CLEARED);
    this.#emitDataChange('*', '*', 'clear');
  }

  close() {
    this.#dbPromise?.then((database) => database.close()).catch(() => {});
    this.#dbPromise = null;
  }
}
