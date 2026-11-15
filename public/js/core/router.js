/**
 * Router hash sederhana (`#/modul/tugas`).
 * Hash dipilih agar aplikasi statis/PWA tetap berfungsi tanpa konfigurasi server.
 */
export class Router {
  #routes = [];
  #fallback = null;
  #onError;
  #started = false;
  #currentPath = '/';

  constructor({ onError } = {}) {
    this.#onError = onError ?? ((error) => console.error('[Router]', error));
  }

  add(pattern, handler) {
    if (typeof pattern !== 'string' || typeof handler !== 'function') {
      throw new TypeError('Route membutuhkan pattern string dan handler fungsi.');
    }
    this.#routes.push({ pattern: this.#normalisePattern(pattern), handler });
    return this;
  }

  setFallback(handler) {
    this.#fallback = handler;
    return this;
  }

  start() {
    if (this.#started) return;
    this.#started = true;

    if (!window.location.hash) {
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', `${base}#/`);
    }

    window.addEventListener('hashchange', this.#handle);
    return this.#handle();
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    window.removeEventListener('hashchange', this.#handle);
  }

  navigate(path, { replace = false } = {}) {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    const hash = `#${normalised}`;

    if (window.location.hash === hash) {
      this.#handle();
      return;
    }

    if (replace) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${hash}`,
      );
      this.#handle();
    } else {
      window.location.hash = normalised;
    }
  }

  get path() {
    return this.#readPath();
  }

  #normalisePattern(pattern) {
    const path = pattern.startsWith('/') ? pattern : `/${pattern}`;
    return path === '' ? '/' : path.replace(/\/+$/, '') || '/';
  }

  #readPath() {
    let path = window.location.hash.slice(1) || '/';
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.split('?')[0];
    return path.replace(/\/+$/, '') || '/';
  }

  #match(path) {
    const pathSegments = path.split('/').filter(Boolean);

    for (const route of this.#routes) {
      const patternSegments = route.pattern.split('/').filter(Boolean);
      if (patternSegments.length !== pathSegments.length) continue;

      const params = {};
      let matches = true;

      for (let index = 0; index < patternSegments.length; index += 1) {
        const patternSegment = patternSegments[index];
        const pathSegment = pathSegments[index];

        if (patternSegment.startsWith(':')) {
          try {
            params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
          } catch {
            matches = false;
            break;
          }
        } else if (patternSegment !== pathSegment) {
          matches = false;
          break;
        }
      }

      if (matches) return { route, params };
    }

    return null;
  }

  #handle = async () => {
    const path = this.#readPath();
    this.#currentPath = path;
    const match = this.#match(path);

    try {
      if (match) {
        await match.route.handler({ path, params: match.params });
      } else if (this.#fallback) {
        await this.#fallback({ path, params: {} });
      }
    } catch (error) {
      this.#onError(error);
    }
  };
}
