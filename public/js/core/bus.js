/**
 * Event bus sederhana untuk komunikasi longgar antar fitur.
 * Handler yang gagal tidak boleh menjatuhkan handler lainnya.
 */
export class EventBus {
  #listeners = new Map();

  on(eventName, handler) {
    if (typeof eventName !== 'string' || typeof handler !== 'function') {
      throw new TypeError('Event bus membutuhkan nama event dan fungsi handler.');
    }

    const handlers = this.#listeners.get(eventName) ?? new Set();
    handlers.add(handler);
    this.#listeners.set(eventName, handlers);

    return () => this.off(eventName, handler);
  }

  once(eventName, handler) {
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off(eventName, handler) {
    const handlers = this.#listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) this.#listeners.delete(eventName);
  }

  emit(eventName, payload) {
    const handlers = this.#listeners.get(eventName);
    if (!handlers) return;

    for (const handler of [...handlers]) {
      try {
        const result = handler(payload);
        if (result && typeof result.catch === 'function') {
          result.catch((error) => {
            console.error(`[EventBus] Handler async gagal pada "${eventName}".`, error);
          });
        }
      } catch (error) {
        console.error(`[EventBus] Handler gagal pada "${eventName}".`, error);
      }
    }
  }

  clear() {
    this.#listeners.clear();
  }
}

/** Instance tunggal untuk aplikasi. Modul mengakses lewat `ctx.bus`. */
export const bus = new EventBus();
      
