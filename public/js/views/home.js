import { el } from '../core/dom.js';
import { EVENTS } from '../core/events.js';
import { icon } from '../core/icons.js';
import {
  describeBackupAge,
  getBackupReminder,
  getStorageHealth,
  markBackupExported,
  requestPersistentStorage,
  snoozeBackupReminder,
} from '../core/persistence.js';
import {
  debounce,
  downloadJSON,
  formatBytes,
  greetingForHour,
  toDateKey,
} from '../core/utils.js';

const TONE_CLASSES = new Set(['default', 'success', 'warning', 'danger']);

const HOME_SUMMARY_MODULES = Object.freeze(['tugas', 'keuangan']);
const HOME_SUMMARY_LIMIT = 2;

const TONE_ICON = {
  default: 'border border-ink/[0.06] bg-ink/[0.05] text-ink/65',
  success: 'border border-brand/10 bg-brand/10 text-brand',
  warning: 'border border-warning/10 bg-warning/10 text-warning',
  danger: 'border border-danger/10 bg-danger/10 text-danger',
};

const TONE_ARROW = {
  default: 'bg-ink/[0.04] text-ink/40',
  success: 'bg-brand/10 text-brand/70',
  warning: 'bg-warning/10 text-warning/70',
  danger: 'bg-danger/10 text-danger/70',
};

export function renderHome(container, {
  registry,
  bus,
  profileName,
  version,
  db = null,
  ui = null,
  onQuickAdd = null,
}) {
  let disposed = false;
  let requestSequence = 0;
  let safetySequence = 0;

  const dateText = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  const greeting = greetingForHour();
  const modules = registry.modules;
  const summaryPlaceholderCount = Math.min(
    HOME_SUMMARY_LIMIT,
    Math.max(modules.length, 1),
  );

  const view = el('div', { class: 'view home-view space-y-5' });

  // Hero -------------------------------------------------------------------
  const hero = el('section', {
    class: 'relative overflow-hidden rounded-[30px] border border-brand/15 bg-gradient-to-br from-brand/20 via-brand-strong/[0.06] to-transparent p-5',
    'aria-labelledby': 'home-greeting',
  });
  hero.append(el('span', {
    class: 'pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-brand/10 blur-3xl',
    'aria-hidden': 'true',
  }));

  const heroTop = el('div', { class: 'relative flex items-center justify-between gap-3' });
  heroTop.append(
    el('span', {
      class: 'inline-flex items-center gap-1.5 rounded-full border border-brand/10 bg-brand/10 px-2.5 py-1 text-[10px] font-medium text-brand',
      html: `${icon('calendar', 'h-3 w-3')}<span>${dateText}</span>`,
    }),
    el('span', {
      class: 'inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-1 text-[9.5px] font-medium text-brand/60',
      html: `${icon('shield', 'h-3 w-3')}<span>Privat</span>`,
    }),
  );
  hero.append(heroTop);

  const heading = el('h1', {
    class: 'relative mt-5 max-w-[12ch] text-[32px] font-semibold leading-[1.02] tracking-[-0.055em] text-ink',
    id: 'home-greeting',
  },
  greeting,
  ', ',
  el('span', { class: 'text-brand', text: profileName }),
  '.',
  );
  hero.append(heading);
  hero.append(el('p', {
    class: 'relative mt-2.5 max-w-[30ch] text-[12.5px] leading-relaxed text-ink/55',
    text: 'Catat tugas atau hal penting dalam beberapa detik, lalu lanjutkan harimu.',
  }));

  const heroActions = el('div', { class: 'relative mt-5 flex flex-wrap items-center gap-2' });
  if (typeof onQuickAdd === 'function') {
    const quickButton = el('button', {
      class: 'hero-quick inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-[12.5px] font-semibold text-emerald-950 shadow-lg shadow-emerald-950/30 transition active:scale-95',
      type: 'button',
      html: `${icon('plus', 'h-4 w-4')}<span>Catat cepat</span>`,
      title: 'Catat cepat (Alt+N)',
    });
    quickButton.addEventListener('click', () => onQuickAdd());
    heroActions.append(quickButton);
  }
  heroActions.append(el('a', {
    class: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-ink/[0.04] px-4 text-[12.5px] font-medium text-ink/65 transition active:scale-95',
    href: '#/menu',
    html: `${icon('menu', 'h-4 w-4')}<span>Lihat menu</span>`,
  }));
  hero.append(heroActions);
  view.append(hero);

  // Ringkasan --------------------------------------------------------------
  const summarySection = el('section', {
    class: 'space-y-3',
    'aria-labelledby': 'summary-heading',
  });
  summarySection.append(el('div', { class: 'flex items-end justify-between gap-3 px-1' },
    el('div', {},
      el('p', { class: 'text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink/40', text: 'Sekilas hari ini' }),
      el('h2', { class: 'mt-1 text-[17px] font-semibold tracking-[-0.03em] text-ink', id: 'summary-heading', text: 'Ringkasan modul' }),
    ),
    el('a', {
      class: 'pb-0.5 text-[10.5px] font-medium text-brand/80 transition active:opacity-60',
      href: '#/menu',
      text: 'Semua modul',
    }),
  ));

  const summaryGrid = el('div', {
    class: 'grid gap-2.5',
    'aria-live': 'polite',
    'aria-busy': 'true',
    dataset: { summaryGrid: 'true' },
  });
  for (let index = 0; index < summaryPlaceholderCount; index += 1) {
    summaryGrid.append(el('span', { class: 'block h-[104px] animate-pulse rounded-[26px] bg-ink/[0.035]' }));
  }
  summarySection.append(summaryGrid);
  view.append(summarySection);

  const dataSafetyHost = el('div', { class: 'data-safety-host space-y-3' });
  view.append(dataSafetyHost);

  view.append(el('div', {
    class: 'flex items-start gap-2.5 rounded-2xl border border-ink/[0.05] bg-ink/[0.02] px-3.5 py-3 text-[10.5px] leading-relaxed text-ink/40',
  },
  el('span', { class: 'mt-0.5 shrink-0 text-ink/35', html: icon('lock', 'h-3.5 w-3.5') }),
  el('p', {},
    el('strong', { class: 'font-medium text-ink/60', text: 'Data milikmu sepenuhnya. ' }),
    `Tersimpan di IndexedDB perangkat ini. Aplikasi versi ${version} tetap bekerja tanpa internet.`,
  ),
  ));

  function safetyButton({ label, iconName, variant = 'secondary', onClick, attrs = {} }) {
    const variants = {
      primary: 'bg-emerald-400 text-emerald-950 shadow-md shadow-emerald-950/20',
      secondary: 'border border-ink/10 bg-ink/[0.05] text-ink/70',
      ghost: 'text-ink/50',
    };
    const button = el('button', {
      class: `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[10.5px] font-semibold transition active:scale-95 disabled:opacity-50 ${variants[variant] ?? variants.secondary}`,
      type: 'button',
      html: `${icon(iconName, 'h-3.5 w-3.5')}<span>${label}</span>`,
      ...attrs,
    });
    button.addEventListener('click', onClick);
    return button;
  }

  async function runButtonTask(button, busyLabel, task) {
    const original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = busyLabel;
    try {
      return await task();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (button.isConnected) button.innerHTML = original;
    }
  }

  async function exportBackup(button) {
    if (!db) return;
    await runButtonTask(button, 'Menyiapkan…', async () => {
      try {
        const payload = await db.exportData();
        downloadJSON(`asisten-siswa-backup-${toDateKey()}.json`, payload);
        await markBackupExported(db);
        ui?.toast('Backup JSON berhasil dibuat.', { type: 'success' });
        await loadDataSafety();
      } catch (error) {
        ui?.toast(`Ekspor gagal: ${error.message}`, { type: 'error' });
      }
    });
  }

  function renderDataSafety({ backup, storage }) {
    const needsBackup = backup.due;
    const needsStorage = storage.supported && !storage.persisted;

    if (!needsBackup && !needsStorage) {
      dataSafetyHost.replaceChildren();
      return;
    }

    const card = el('section', {
      class: 'rounded-[26px] border border-warning/10 bg-warning/[0.035] p-4',
      'aria-labelledby': 'data-safety-title',
      dataset: { dataSafety: 'true' },
    });

    const head = el('div', { class: 'flex items-start gap-3' });
    head.append(
      el('span', {
        class: 'grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/10 text-warning',
        html: icon('shield', 'h-[18px] w-[18px]'),
      }),
      el('div', { class: 'min-w-0 flex-1' },
        el('p', { class: 'text-[9px] font-semibold uppercase tracking-[0.16em] text-warning/50', text: 'Kesehatan data' }),
        el('h2', { class: 'mt-0.5 text-[13px] font-semibold tracking-[-0.02em] text-ink/85', id: 'data-safety-title', text: 'Jaga data tetap aman' }),
      ),
      el('span', {
        class: 'shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[8.5px] font-semibold text-warning/80',
        text: needsBackup ? 'Backup' : 'Penyimpanan',
      }),
    );
    card.append(head);

    const rows = el('div', { class: 'mt-3 space-y-2.5' });

    if (needsBackup) {
      const exportButton = safetyButton({
        label: 'Ekspor',
        iconName: 'download',
        variant: 'primary',
        onClick: () => exportBackup(exportButton),
      });
      const laterButton = backup.snoozed
        ? null
        : safetyButton({
          label: 'Nanti',
          iconName: 'clock',
          variant: 'ghost',
          onClick: () => runButtonTask(laterButton, 'Menunda…', async () => {
            try {
              await snoozeBackupReminder(db);
              ui?.toast('Pengingat backup ditunda 7 hari.', { type: 'info' });
              await loadDataSafety();
            } catch (error) {
              ui?.toast(`Pengingat gagal disimpan: ${error.message}`, { type: 'error' });
            }
          }),
        });

      const row = el('div', { class: 'rounded-2xl border border-ink/[0.05] bg-ink/10 p-3' });
      row.append(
        el('div', { class: 'flex items-start gap-2.5' },
          el('span', { class: 'mt-0.5 shrink-0 text-warning/60', html: icon('database', 'h-4 w-4') }),
          el('div', { class: 'min-w-0' },
            el('p', { class: 'text-[11px] font-semibold text-ink/70', text: 'Cadangan JSON' }),
            el('p', {
              class: 'mt-0.5 text-[10px] leading-relaxed text-ink/45',
              text: `${describeBackupAge(backup)}.${backup.snoozed ? ' Pengingat ditunda sementara.' : ' Ekspor berkala agar data bisa dipulihkan.'}`,
            }),
          ),
        ),
        el('div', { class: 'mt-2.5 flex flex-wrap gap-2' }, exportButton, laterButton),
      );
      rows.append(row);
    }

    if (needsStorage) {
      const protectButton = storage.canPersist
        ? safetyButton({
          label: 'Lindungi',
          iconName: 'shield',
          variant: 'secondary',
          onClick: () => runButtonTask(protectButton, 'Meminta…', async () => {
            const result = await requestPersistentStorage();
            ui?.toast(
              result.granted
                ? 'Penyimpanan dilindungi dari pembersihan otomatis.'
                : 'Browser belum memberi perlindungan. Backup JSON tetap penting.',
              { type: result.granted ? 'success' : 'warning' },
            );
            await loadDataSafety();
          }),
        })
        : null;

      const row = el('div', { class: 'rounded-2xl border border-ink/[0.05] bg-ink/10 p-3' });
      row.append(
        el('div', { class: 'flex items-start gap-2.5' },
          el('span', { class: 'mt-0.5 shrink-0 text-ink/40', html: icon('hardDrive', 'h-4 w-4') }),
          el('div', { class: 'min-w-0' },
            el('p', { class: 'text-[11px] font-semibold text-ink/70', text: 'Penyimpanan perangkat' }),
            el('p', {
              class: 'mt-0.5 text-[10px] leading-relaxed text-ink/45',
              text: storage.canPersist
                ? `Belum dilindungi. ${formatBytes(storage.usage)} dari ${formatBytes(storage.quota)} terpakai. Browser dapat membersihkan data saat ruang menipis.`
                : `Browser ini tidak mendukung perlindungan tambahan. ${formatBytes(storage.usage)} dari ${formatBytes(storage.quota)} terpakai.`,
            }),
          ),
        ),
        protectButton
          ? el('div', { class: 'mt-2.5 flex flex-wrap gap-2' }, protectButton)
          : null,
      );
      rows.append(row);
    }

    card.append(rows);
    dataSafetyHost.replaceChildren(card);
  }

  async function loadDataSafety() {
    if (!db) return;
    const sequence = ++safetySequence;

    try {
      const [backup, storage] = await Promise.all([
        getBackupReminder(db),
        getStorageHealth(),
      ]);
      if (disposed || sequence !== safetySequence) return;
      renderDataSafety({ backup, storage });
    } catch (error) {
      if (disposed || sequence !== safetySequence) return;
      console.warn('[Home] Status kesehatan data tidak dapat dibaca.', error);
      dataSafetyHost.replaceChildren();
    }
  }

  function summaryCard(summary) {
    const tone = TONE_CLASSES.has(summary.tone) ? summary.tone : 'default';
    const card = el('a', {
      class: 'group relative flex items-center gap-3 overflow-hidden rounded-[26px] border border-ink/[0.06] bg-ink/[0.035] p-4 transition active:scale-[0.98]',
      href: `#/modul/${summary.moduleId}`,
      'aria-label': `${summary.moduleName}: ${summary.label} ${summary.value}. ${summary.hint ?? ''}`,
      dataset: { summaryCard: summary.moduleId },
    });

    card.append(
      el('span', {
        class: `grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${TONE_ICON[tone]}`,
        html: summary.moduleIcon,
      }),
    );

    const copy = el('span', { class: 'min-w-0 flex-1' });
    copy.append(el('span', {
      class: 'block truncate text-[9.5px] font-semibold uppercase tracking-[0.15em] text-ink/40',
      text: summary.moduleName,
    }));
    copy.append(el('span', { class: 'mt-1 flex items-baseline gap-2' },
      el('span', { class: 'text-[24px] font-semibold leading-none tracking-[-0.045em] text-ink', text: summary.value }),
      el('span', { class: 'truncate text-[11px] text-ink/50', text: summary.label }),
    ));
    if (summary.hint) {
      copy.append(el('span', {
        class: 'mt-1.5 line-clamp-2 block text-[10.5px] leading-relaxed text-ink/45',
        text: summary.hint,
      }));
    }
    card.append(copy);

    card.append(el('span', {
      class: `grid h-8 w-8 shrink-0 place-items-center rounded-full ${TONE_ARROW[tone]}`,
      html: icon('arrowRight', 'h-4 w-4'),
    }));

    return card;
  }

  async function loadSummaries() {
    const sequence = ++requestSequence;
    try {
      const summaries = await registry.getSummaries();
      if (disposed || sequence !== requestSequence) return;

      summaryGrid.setAttribute('aria-busy', 'false');
      if (summaries.length === 0) {
        summaryGrid.replaceChildren(el('div', {
          class: 'rounded-[26px] border border-dashed border-ink/10 bg-ink/[0.02] px-5 py-6 text-center',
        },
        el('span', {
          class: 'mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-ink/[0.04] text-ink/45',
          html: icon('chart', 'h-5 w-5'),
        }),
        el('h3', { class: 'mt-3 text-[13px] font-semibold text-ink/75', text: 'Ringkasan belum tersedia' }),
        el('p', {
          class: 'mx-auto mt-1 max-w-[30ch] text-[10.5px] leading-relaxed text-ink/45',
          text: 'Modul yang menyediakan ringkasan akan menampilkannya di sini secara otomatis.',
        }),
        ));
        return;
      }
      const coreSummaries = summaries.filter((summary) => (
        HOME_SUMMARY_MODULES.includes(summary.moduleId)
      ));
      const visibleSummaries = (coreSummaries.length > 0 ? coreSummaries : summaries)
        .slice(0, HOME_SUMMARY_LIMIT);
      summaryGrid.replaceChildren(...visibleSummaries.map(summaryCard));
    } catch (error) {
      if (disposed || sequence !== requestSequence) return;
      console.error('[Home] Gagal memuat ringkasan.', error);
      summaryGrid.setAttribute('aria-busy', 'false');
      summaryGrid.replaceChildren(el('p', {
        class: 'rounded-2xl border border-danger/10 bg-danger/[0.04] px-3.5 py-3 text-[10.5px] leading-relaxed text-danger/70',
        text: 'Ringkasan sedang tidak bisa dimuat. Coba kembali sebentar lagi.',
      }));
    }
  }

  const refreshSummaries = debounce(loadSummaries, 140);
  const unsubscribeData = bus.on(EVENTS.DATA_CHANGED, refreshSummaries);
  const unsubscribeImported = bus.on(EVENTS.DATA_IMPORTED, refreshSummaries);
  const unsubscribeCleared = bus.on(EVENTS.DATA_CLEARED, refreshSummaries);

  container.replaceChildren(view);
  loadSummaries();
  loadDataSafety();

  return () => {
    disposed = true;
    requestSequence += 1;
    safetySequence += 1;
    refreshSummaries.cancel();
    unsubscribeData();
    unsubscribeImported();
    unsubscribeCleared();
  };
  }
