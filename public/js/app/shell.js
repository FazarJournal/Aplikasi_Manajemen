import {
  APP_INFO,
  DEFAULT_PROFILE_NAME,
  MODULE_MANIFEST_URL,
  PROFILE_NAME_KEY,
} from '../core/config.js';
import { bus } from '../core/bus.js';
import { LocalDatabase } from '../core/db.js';
import { EVENTS } from '../core/events.js';
import { el } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { ModuleRegistry } from '../core/registry.js';
import { PwaController } from '../core/pwa.js';
import {
  describeBackupAge,
  getBackupReminder,
  snoozeBackupReminder,
} from '../core/persistence.js';
import { Router } from '../core/router.js';
import { ThemeController } from '../core/theme.js';
import { UI } from '../core/ui.js';
import { renderHome } from '../views/home.js';
import { createModuleCard } from '../views/module-list.js';
import { renderSearch } from '../views/search.js';
import { renderSettings } from '../views/settings.js';

/**
 * Composition root aplikasi.
 * Core tidak mengenal fitur. Modul ditemukan dari manifest dan mendapat
 * konteks layanan dari registry.
 */
export class App {
  #db;
  #ui;
  #router;
  #registry;
  #pwa;
  #theme;

  #manifestUrl;
  #profileName = DEFAULT_PROFILE_NAME;
  #navigationId = 0;
  #activeCleanup = null;
  #bootWarnings = [];
  #booted = false;

  #routeView;
  #mainView;
  #toastRoot;
  #modalRoot;
  #bottomNav;
  #bootScreen;
  #routeAnnouncer;
  #offlineBanner;
  #offlineBannerIcon;
  #quickAddButton;
  #headerBack;
  #headerBackIcon;
  #headerTitle;
  #searchLink;
  #searchIcon;
  #notificationButton;
  #notificationIcon;
  #notificationBadge;
  #settingsLink;
  #settingsLinkIcon;
  #notifications = [];
  #notificationRefreshTimer = null;
  #searchQuery = '';
  #currentPath = '/';
  #previousPath = null;

  constructor({ manifestUrl = MODULE_MANIFEST_URL } = {}) {
    this.#manifestUrl = manifestUrl instanceof URL
      ? manifestUrl
      : new URL(String(manifestUrl), document.baseURI);
  }

  async boot() {
    this.#collectDom();
    this.#theme = new ThemeController();
    this.#paintStaticUi();

    this.#ui = new UI({
      toastRoot: this.#toastRoot,
      modalRoot: this.#modalRoot,
    });
    this.#pwa = new PwaController({
      onUpdateReady: () => {
        this.#ui.toast('Versi baru tersedia. Muat ulang untuk memakai pembaruan.', {
          type: 'info',
          duration: 0,
          action: {
            label: 'Muat ulang',
            onClick: () => this.#pwa.applyUpdate(),
          },
        });
      },
    });
    this.#router = new Router({
      onError: (error) => this.#handleRouteError(error),
    });

    this.#db = new LocalDatabase({
      name: APP_INFO.dbName,
      version: APP_INFO.dbVersion,
      appVersion: APP_INFO.version,
      bus,
    });
    this.#registry = new ModuleRegistry({
      manifestUrl: this.#manifestUrl,
      db: this.#db,
      ui: this.#ui,
      bus,
      navigate: (path, options) => this.#router.navigate(path, options),
    });

    this.#bindGlobalEvents();

    try {
      await this.#db.open();
      const storedName = await this.#db.getSetting(PROFILE_NAME_KEY, DEFAULT_PROFILE_NAME);
      this.#profileName = typeof storedName === 'string' && storedName.trim()
        ? storedName.trim()
        : DEFAULT_PROFILE_NAME;
    } catch (error) {
      console.error('[App] Database gagal dibuka.', error);
      this.#showFatalError(error);
      return;
    }

    try {
      await this.#registry.load();
    } catch (error) {
      console.error('[App] Modul tidak dapat dimuat.', error);
      this.#bootWarnings.push(
        'Manifest modul tidak dapat dimuat. Beranda dan pengaturan tetap bisa dipakai.',
      );
    }

    if (this.#registry.errors.length > 0) {
      this.#bootWarnings.push(
        `${this.#registry.errors.length} modul gagal dimuat. Inti aplikasi tetap berjalan.`,
      );
    }

    this.#renderNavigation();
    this.#registerRoutes();
    await this.#router.start();

    this.#booted = true;
    this.#revealApp();
    this.#showBootWarnings();
    this.#refreshNotifications();
    this.#startPwa();
    this.#maybeRemindBackup();
    this.#openQuickFromLaunchParams();
  }

  #collectDom() {
    this.#routeView = document.querySelector('#route-view');
    this.#mainView = document.querySelector('#main-view');
    this.#toastRoot = document.querySelector('#toast-root');
    this.#modalRoot = document.querySelector('#modal-root');
    this.#bottomNav = document.querySelector('#bottom-nav');
    this.#bootScreen = document.querySelector('#boot-screen');
    this.#routeAnnouncer = document.querySelector('#route-announcer');
    this.#offlineBanner = document.querySelector('#offline-banner');
    this.#offlineBannerIcon = document.querySelector('#offline-banner-icon');
    this.#quickAddButton = document.querySelector('#quick-add');
    this.#headerBack = document.querySelector('#header-back');
    this.#headerBackIcon = document.querySelector('#header-back-icon');
    this.#headerTitle = document.querySelector('#header-title');
    this.#searchLink = document.querySelector('#search-link');
    this.#searchIcon = document.querySelector('#search-icon');
    this.#notificationButton = document.querySelector('#notification-button');
    this.#notificationIcon = document.querySelector('#notification-icon');
    this.#notificationBadge = document.querySelector('#notification-badge');
    this.#settingsLink = document.querySelector('#settings-link');
    this.#settingsLinkIcon = document.querySelector('#settings-link-icon');

    if (!this.#routeView || !this.#mainView || !this.#bottomNav || !this.#headerBack) {
      throw new Error('Struktur DOM aplikasi tidak lengkap.');
    }
  }

  #paintStaticUi() {
    for (const element of document.querySelectorAll('[data-app-version]')) {
      element.textContent = APP_INFO.version;
    }
    const quickAddIcon = document.querySelector('#quick-add-icon');
    if (quickAddIcon) quickAddIcon.innerHTML = icon('plus', 'h-5 w-5');
    if (this.#searchIcon) this.#searchIcon.innerHTML = icon('search', 'h-[18px] w-[18px]');
    if (this.#notificationIcon) this.#notificationIcon.innerHTML = icon('bell', 'h-[18px] w-[18px]');
    if (this.#offlineBannerIcon) this.#offlineBannerIcon.innerHTML = icon('wifiOff', 'h-[15px] w-[15px]');
    if (this.#headerBackIcon) this.#headerBackIcon.innerHTML = icon('arrowLeft', 'h-5 w-5');
    this.#settingsLink?.setAttribute('data-nav-key', 'settings');
    this.#paintProfileAvatar();
    this.#updateConnection();
  }

  #paintProfileAvatar() {
    if (!this.#settingsLinkIcon) return;
    const initial = this.#profileName.trim().charAt(0).toUpperCase() || 'S';
    this.#settingsLinkIcon.textContent = initial;
  }

  #bindGlobalEvents() {
    const updateNetwork = () => {
      this.#updateConnection();
      bus.emit(EVENTS.NETWORK_CHANGE, { online: navigator.onLine });
    };
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    // Hash router: jangan biarkan skip-link dianggap sebagai rute aplikasi.
    const skipLink = document.querySelector('.skip-link');
    skipLink?.addEventListener('click', (event) => {
      event.preventDefault();
      this.#mainView?.focus();
    });

    this.#quickAddButton?.addEventListener('click', () => this.#handleQuickAdd());
    this.#headerBack?.addEventListener('click', () => this.#handleHeaderBack());
    this.#notificationButton?.addEventListener('click', () => this.#showNotifications());
    window.addEventListener('keydown', (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'n') return;
      event.preventDefault();
      this.#handleQuickAdd();
    });

    bus.on(EVENTS.DB_VERSION_CHANGE, () => {
      if (!this.#ui) return;
      this.#ui.toast('Database diperbarui di tab lain. Muat ulang agar semua tab sinkron.', {
        type: 'warning',
        duration: 0,
        action: {
          label: 'Muat ulang',
          onClick: () => window.location.reload(),
        },
      });
    });

    bus.on(EVENTS.DATA_CHANGED, () => {
      if (this.#notificationRefreshTimer) window.clearTimeout(this.#notificationRefreshTimer);
      this.#notificationRefreshTimer = window.setTimeout(() => {
        this.#notificationRefreshTimer = null;
        this.#refreshNotifications();
      }, 450);
    });

    navigator.serviceWorker?.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.type !== 'OPEN_URL' || typeof data.url !== 'string') return;
      try {
        const url = new URL(data.url, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.hash.startsWith('#/')) this.#router.navigate(url.hash.slice(1));
      } catch {
        // Abaikan pesan dengan URL yang tidak valid.
      }
    });
  }

  async #handleQuickAdd() {
    if (!this.#booted || this.#ui.hasOpenDialog) return;

    const actions = this.#registry.quickActions;
    if (actions.length === 0) {
      this.#ui.toast('Belum ada modul yang mendukung catat cepat.', { type: 'info' });
      return;
    }

    let moduleId = actions[0].id;
    if (actions.length > 1) {
      const choice = await this.#ui.dialog({
        title: 'Catat cepat',
        description: 'Pilih jenis catatan yang ingin dibuat.',
        actions: [
          ...actions.map((action) => ({
            label: action.name,
            value: action.id,
            variant: 'secondary',
          })),
          { label: 'Batal', value: null, variant: 'ghost' },
        ],
      });
      if (!choice) return;
      moduleId = choice;
    }

    try {
      await this.#registry.runQuickAdd(moduleId);
    } catch (error) {
      console.error('[App] Catat cepat gagal.', error);
      this.#ui.toast('Catatan cepat gagal dibuka. Coba lagi.', { type: 'error' });
    }
  }

  #handleHeaderBack() {
    const path = this.#router?.path ?? '/';
    if (this.#previousPath && this.#previousPath !== path) {
      this.#router.navigate(this.#previousPath);
      return;
    }
    this.#router.navigate('/');
  }

  async #refreshNotifications() {
    if (!this.#notificationBadge || !this.#registry) return;

    try {
      const [moduleNotifications, reminder] = await Promise.all([
        this.#registry.getNotifications(),
        getBackupReminder(this.#db),
      ]);

      const notifications = [...moduleNotifications];
      if (reminder.due) {
        notifications.push({
          id: 'backup-reminder',
          icon: 'database',
          title: 'Cadangkan data',
          text: `${describeBackupAge(reminder)}. Ekspor JSON dari Pengaturan agar data aman jika perangkat berganti.`,
          tone: 'warning',
          source: 'Data lokal',
          path: '/pengaturan',
        });
      }

      this.#notifications = notifications;
      this.#paintNotificationBadge();
    } catch (error) {
      console.warn('[App] Notifikasi tidak dapat diperbarui.', error);
    }
  }

  #paintNotificationBadge() {
    if (!this.#notificationBadge || !this.#notificationButton) return;
    const count = this.#notifications.length;
    this.#notificationBadge.hidden = count === 0;
    this.#notificationBadge.textContent = count > 9 ? '9+' : String(count);
    this.#notificationButton.classList.toggle('has-alert', count > 0);
    this.#notificationButton.setAttribute(
      'aria-label',
      count > 0 ? `Buka notifikasi, ${count} perlu perhatian` : 'Buka notifikasi',
    );
  }

  async #showNotifications() {
    if (!this.#ui || this.#ui.hasOpenDialog) return;

    await this.#refreshNotifications();

    const content = el('div', { class: 'notif-list' });

    if (this.#notifications.length === 0) {
      content.append(el('div', { class: 'notif-empty' },
        el('span', { class: 'notif-empty__icon', html: icon('checkCircle') }),
        el('div', {},
          el('p', { class: 'notif-empty__title', text: 'Semua beres' }),
          el('p', {
            class: 'notif-empty__text',
            text: 'Tidak ada tugas atau pengingat yang perlu ditindaklanjuti saat ini.',
          }),
        ),
      ));
    } else {
      for (const notification of this.#notifications) {
        const row = el('button', {
          class: `notif-row notif-row--${notification.tone}`,
          type: 'button',
        });
        row.append(
          el('span', { class: 'notif-row__icon', html: notification.icon }),
          el('span', { class: 'notif-row__body' },
            el('span', { class: 'notif-row__title', text: notification.title }),
            el('span', { class: 'notif-row__text', text: notification.text }),
            el('span', { class: 'notif-row__source', text: notification.source ?? 'Aplikasi' }),
          ),
          el('span', { class: 'notif-row__arrow', html: icon('arrowRight', 'h-4 w-4') }),
        );
        row.addEventListener('click', () => {
          this.#ui.closeAll();
          this.#router.navigate(notification.path);
        });
        content.append(row);
      }
    }

    const total = this.#notifications.length;
    const action = await this.#ui.dialog({
      layout: 'sheet',
      title: 'Notifikasi',
      description: total > 0
        ? `${total} hal perlu perhatian. Daftar ini mengikuti kondisi data saat ini.`
        : 'Tidak ada yang perlu ditindaklanjuti saat ini.',
      content,
      actions: [
        { label: 'Tutup', variant: 'ghost' },
        { label: 'Buka pengaturan', value: 'settings', variant: 'secondary' },
      ],
    });

    if (action === 'settings') this.#router.navigate('/pengaturan');
  }

  #openQuickFromLaunchParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('quick') !== '1') return;

    params.delete('quick');
    const query = params.toString();
    const base = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || '#/'}`;
    window.history.replaceState(null, '', base);
    this.#handleQuickAdd();
  }

  #updateConnection() {
    const online = navigator.onLine;
    if (this.#offlineBanner) this.#offlineBanner.hidden = online;
  }

  #registerRoutes() {
    this.#router.add('/', () => this.#renderHomeRoute());
    this.#router.add('/menu', () => this.#renderMenuRoute());
    this.#router.add('/cari', () => this.#renderSearchRoute());
    this.#router.add('/modul/:id', ({ params }) => this.#renderModuleRoute(params.id));
    this.#router.add('/pengaturan', () => this.#renderSettingsRoute());
    this.#router.setFallback(() => this.#renderNotFoundRoute());
  }

  #renderNavigation() {
    this.#updateQuickAddVisibility(this.#router.path);

    // Bottom navigation: Beranda, Menu, dan Pengaturan. Semua modul tinggal
    // di halaman Menu agar jumlah tab tetap stabil saat modul bertambah.
    this.#bottomNav.replaceChildren(
      this.#makeNavLink({
        href: '#/',
        key: 'home',
        label: 'Beranda',
        iconMarkup: icon('home'),
      }),
      this.#makeNavLink({
        href: '#/menu',
        key: 'menu',
        label: 'Menu',
        iconMarkup: icon('menu'),
      }),
      this.#makeNavLink({
        href: '#/pengaturan',
        key: 'settings',
        label: 'Pengaturan',
        iconMarkup: icon('settings'),
      }),
    );

    this.#updateActiveNavigation(this.#router.path);
    this.#updateHeader(this.#router.path);
  }

  #makeNavLink({ href, key, label, iconMarkup }) {
    const link = el('a', {
      class: 'bottom-nav__item',
      href,
      dataset: { navKey: key },
      html: `<span class="bottom-nav__icon">${iconMarkup}</span><span class="bottom-nav__label"></span>`,
    });
    link.querySelector('span:last-child').textContent = label;
    link.title = label;
    return link;
  }

  #updateHeader(path) {
    if (!this.#headerTitle || !this.#headerBack) return;

    const moduleMatch = path.match(/^\/modul\/([^/]+)$/);
    const activeModule = moduleMatch ? this.#registry.getModule(moduleMatch[1]) : null;

    let title = 'Beranda';
    if (path === '/menu') title = 'Menu';
    else if (path === '/cari') title = 'Cari';
    else if (path === '/pengaturan') title = 'Pengaturan';
    else if (activeModule) title = activeModule.name;
    else if (path !== '/') title = 'Tidak ditemukan';

    this.#headerTitle.textContent = title;

    const showBack = path !== '/' && path !== '/menu' && path !== '/pengaturan';
    this.#headerBack.hidden = !showBack;
    this.#headerBack.setAttribute('aria-label', 'Kembali');
    this.#headerBack.dataset.mode = 'back';

    const searching = path === '/cari';
    this.#searchLink?.classList.toggle('is-active', searching);
    if (searching) this.#searchLink?.setAttribute('aria-current', 'page');
    else this.#searchLink?.removeAttribute('aria-current');
  }

  #updateQuickAddVisibility(path = this.#router?.path ?? '/') {
    const hasQuickAdd = this.#registry.quickActions.length > 0;
    const visible = hasQuickAdd && (path === '/' || path === '/menu');

    if (this.#quickAddButton) this.#quickAddButton.hidden = !visible;
    if (this.#mainView) {
      this.#mainView.style.paddingBottom = visible ? '78px' : '';
    }
  }

  #updateActiveNavigation(path) {
    for (const item of document.querySelectorAll('[data-nav-key]')) {
      const key = item.dataset.navKey;
      let active = false;

      if (key === 'home') active = path === '/';
      else if (key === 'settings') active = path === '/pengaturan';
      else if (key === 'menu') active = path === '/menu' || path.startsWith('/modul/');

      item.classList.toggle('is-active', active);
      if (active && item.tagName === 'A') item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }

    this.#settingsLink?.classList.toggle('is-active', path === '/pengaturan');
  }

  async #renderSearchRoute() {
    const id = await this.#prepareNavigation({
      title: `Cari · ${APP_INFO.shortName}`,
      announce: 'Pencarian',
      path: '/cari',
    });
    if (id === null) return;

    renderSearch(this.#routeView, {
      modules: this.#registry.modules,
      initialQuery: this.#searchQuery,
      onQueryChange: (query) => {
        this.#searchQuery = query;
      },
    });
    this.#activeCleanup = null;
  }

  async #renderMenuRoute() {
    const id = await this.#prepareNavigation({
      title: `Menu · ${APP_INFO.shortName}`,
      announce: 'Menu',
      path: '/menu',
    });
    if (id === null) return;

    const modules = this.#registry.modules;
    const view = el('div', { class: 'view menu-view space-y-5' });

    const intro = el('section', {
      class: 'relative overflow-hidden rounded-[30px] border border-brand/10 bg-gradient-to-br from-brand/15 via-ink/5 to-transparent p-5',
    });
    intro.append(
      el('span', {
        class: 'pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-brand/10 blur-3xl',
        'aria-hidden': 'true',
      }),
      el('p', { class: 'relative text-[10px] font-semibold uppercase tracking-[0.18em] text-brand/70', text: 'Ruang belajar' }),
      el('h1', { class: 'relative mt-2 text-[30px] font-semibold leading-[1.05] tracking-[-0.05em] text-ink', text: 'Pilih modulmu.' }),
      el('p', {
        class: 'relative mt-2 max-w-[28ch] text-[12.5px] leading-relaxed text-ink/55',
        text: 'Semua modul berjalan lokal. Daftar ini mengikuti modules.json, jadi modul baru langsung muncul di sini.',
      }),
    );
    view.append(intro);

    if (modules.length > 0) {
      const moduleList = el('nav', {
        class: 'module-grid',
        'aria-label': 'Daftar modul',
      });
      for (const module of modules) {
        moduleList.append(createModuleCard(module, { layout: 'grid' }));
      }
      view.append(moduleList);
    } else {
      view.append(el('div', { class: 'empty-card empty-card--wide' },
        el('span', { class: 'empty-card__icon', html: icon('folder') }),
        el('h2', { class: 'empty-card__title', text: 'Belum ada modul' }),
  
