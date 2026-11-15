import { PROFILE_NAME_KEY } from '../core/config.js';
import { validateBackupPayload } from '../core/db.js';
import { el } from '../core/dom.js';
import { icon } from '../core/icons.js';
import {
  describeBackupAge,
  getBackupReminder,
  getStorageHealth,
  markBackupExported,
  requestPersistentStorage,
} from '../core/persistence.js';
import { downloadJSON, formatBytes, toDateKey } from '../core/utils.js';

function createSection({ iconName, title, description, badge = null, tone = 'default' }) {
  const section = el('section', {
    class: [
      'rounded-[26px] border p-4',
      tone === 'danger'
        ? 'border-danger/15 bg-danger/[0.035]'
        : 'border-ink/[0.06] bg-ink/[0.035]',
    ].join(' '),
  });
  const header = el('header', { class: 'flex items-start gap-3' });
  const copy = el('div', { class: 'min-w-0 flex-1' });
  const titleRow = el('div', { class: 'flex flex-wrap items-center gap-2' });
  titleRow.append(el('span', {
    class: 'grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand',
    html: icon(iconName, 'h-[18px] w-[18px]'),
  }));
  titleRow.append(el('h2', { class: 'text-[14px] font-semibold tracking-[-0.02em] text-ink/85', text: title }));
  if (badge) titleRow.append(badge);
  copy.append(titleRow);
  if (description) copy.append(el('p', { class: 'mt-1 text-[11px] leading-relaxed text-ink/45', text: description }));
  header.append(copy);
  section.append(header);

  const body = el('div', { class: 'mt-4 space-y-3' });
  section.append(body);
  return { section, body };
}

function actionButton({ label, iconName, variant = 'secondary', onClick }) {
  const button = el('button', {
    class: `btn btn--${variant}`,
    type: 'button',
    html: `${icon(iconName)}<span>${label}</span>`,
  });
  button.addEventListener('click', onClick);
  return button;
}

let holdButtonSequence = 0;

/**
 * Tombol konfirmasi dengan cara ditahan. Mendukung pointer dan keyboard
 * (Space/Enter ditahan) agar tetap bisa dipakai tanpa layar sentuh.
 */
function holdToConfirmButton({
  label,
  iconName,
  duration = 1500,
  onConfirm,
}) {
  const hintId = `hold-hint-${++holdButtonSequence}`;
  const button = el('button', {
    class: 'btn btn--danger hold-button',
    type: 'button',
    'aria-describedby': hintId,
  });
  const fill = el('span', { class: 'hold-button__fill', 'aria-hidden': 'true' });
  const content = el('span', {
    class: 'hold-button__content',
    html: `${icon(iconName)}<span>${label}</span>`,
  });
  const hint = el('span', {
    class: 'hold-button__hint',
    id: hintId,
    text: 'Tahan 1,5 detik',
  });
  button.append(fill, content, hint);

  let timer = 0;
  let completed = false;

  const cancel = () => {
    if (completed) return;
    window.clearTimeout(timer);
    button.classList.remove('is-holding');
    button.setAttribute('aria-pressed', 'false');
    hint.textContent = 'Tahan 1,5 detik';
  };

  const finish = async () => {
    if (completed) return;
    completed = true;
    button.classList.remove('is-holding');
    hint.textContent = 'Menghapus…';
    button.disabled = true;
    try {
      await onConfirm();
    } finally {
      completed = false;
      button.disabled = false;
      hint.textContent = 'Tahan 1,5 detik';
      button.setAttribute('aria-pressed', 'false');
    }
  };

  const start = () => {
    if (completed || button.disabled) return;
    window.clearTimeout(timer);
    button.classList.add('is-holding');
    button.setAttribute('aria-pressed', 'true');
    hint.textContent = 'Terus tahan…';
    timer = window.setTimeout(finish, duration);
  };

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    start();
  });
  for (const eventName of ['pointerup', 'pointerleave', 'pointercancel']) {
    button.addEventListener(eventName, cancel);
  }
  button.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat) return;
    start();
  });
  button.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') cancel();
  });
  button.addEventListener('blur', cancel);
  button.addEventListener('contextmenu', (event) => event.preventDefault());

  return button;
}

async function withBusy(button, busyLabel, task) {
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = busyLabel;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = original;
  }
}

export function renderSettings(container, {
  db,
  ui,
  pwa,
  version,
  profileName,
  theme = null,
  onProfileNameChange = null,
  onBackupExported = null,
  reload = () => window.location.reload(),
}) {
  let currentName = profileName || 'Siswa';
  const cleanupFns = [];
  const view = el('div', { class: 'view settings-view space-y-4' });

  // Profil -----------------------------------------------------------------
  const profile = createSection({
    iconName: 'home',
    title: 'Profil siswa',
    description: 'Nama ini hanya disimpan di perangkat dan dipakai untuk menyapamu.',
  });

  const profileRow = el('div', { class: 'settings-row' });
  const avatar = el('span', { class: 'profile-avatar', 'aria-hidden': 'true' });
  const nameDisplay = el('strong', { class: 'profile-name' });
  const profileMeta = el('p', { class: 'settings-muted', text: 'Data lokal · tanpa akun' });

  function paintProfile() {
    avatar.textContent = currentName.trim().charAt(0).toUpperCase() || 'S';
    nameDisplay.textContent = currentName;
  }
  paintProfile();

  profileRow.append(
    el('div', { class: 'profile-ident' }, avatar, el('div', {}, nameDisplay, profileMeta)),
    actionButton({
      label: 'Ubah nama',
      iconName: 'pencil',
      onClick: async () => {
        const nextName = await ui.prompt({
          title: 'Ubah nama panggilan',
          message: 'Nama ini dipakai pada sapaan beranda. Tidak dikirim ke internet.',
          label: 'Nama panggilan',
          value: currentName,
          placeholder: 'Contoh: Raka',
          required: true,
          maxlength: 30,
          submitLabel: 'Simpan nama',
          validate: (value) => {
            const trimmed = String(value ?? '').trim();
            if (trimmed.length < 2) return 'Nama minimal 2 karakter.';
            if (trimmed.length > 30) return 'Nama maksimal 30 karakter.';
            return null;
          },
        });

        if (nextName === null) return;
        const trimmed = nextName.trim();
        if (!trimmed || trimmed === currentName) return;

        try {
          await db.setSetting(PROFILE_NAME_KEY, trimmed);
          currentName = trimmed;
          paintProfile();
          onProfileNameChange?.(trimmed);
          ui.toast('Nama panggilan diperbarui.', { type: 'success' });
        } catch (error) {
          ui.toast(`Nama tidak dapat disimpan: ${error.message}`, { type: 'error' });
        }
      },
    }),
  );
  profile.body.append(profileRow);
  profile.section.classList.add(
    'bg-gradient-to-br',
    'from-brand/10',
    'via-ink/[0.03]',
    'to-transparent',
    'border-brand/10',
  );
  view.append(profile.section);

  // Tampilan ---------------------------------------------------------------
  if (theme) {
    const themeSection = createSection({
      iconName: 'monitor',
      title: 'Tampilan',
      description: 'Pilih tema terang, gelap, atau ikuti pengaturan sistem perangkat.',
    });
    const themeOptions = el('div', {
      class: 'theme-options',
      role: 'radiogroup',
      'aria-label': 'Tema tampilan',
    });
    const themeNote = el('p', { class: 'settings-hint' });
    const themeButtons = [];
    const choices = [
      { mode: 'system', label: 'Sistem', iconName: 'monitor' },
      { mode: 'light', label: 'Terang', iconName: 'sun' },
      { mode: 'dark', label: 'Gelap', iconName: 'moon' },
    ];

    const updateNote = (mode = theme.mode) => {
      themeNote.textContent = mode === 'system'
        ? `Mengikuti pengaturan perangkat — saat ini ${theme.resolved === 'dark' ? 'gelap' : 'terang'}.`
        : `Tema ${mode === 'dark' ? 'gelap' : 'terang'} dipakai di seluruh aplikasi.`;
    };

    const paintTheme = (mode = theme.mode) => {
      for (const button of themeButtons) {
        const active = button.dataset.themeMode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', String(active));
        button.tabIndex = active ? 0 : -1;
      }
      updateNote(mode);
    };

    choices.forEach((choice, index) => {
      const button = el('button', {
        class: 'theme-option',
        type: 'button',
        role: 'radio',
        'aria-checked': 'false',
        'data-theme-mode': choice.mode,
        html: `${icon(choice.iconName, 'theme-option__icon')}<span class="theme-option__label">${choice.label}</span>`,
      });
      button.addEventListener('click', () => {
        theme.setMode(choice.mode);
        paintTheme(choice.mode);
      });
      button.addEventListener('keydown', (event) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (index + step + choices.length) % choices.length;
        theme.setMode(choices[nextIndex].mode);
        paintTheme(choices[nextIndex].mode);
        themeButtons[nextIndex].focus();
      });
      themeButtons.push(button);
      themeOptions.append(button);
    });

    paintTheme();
    cleanupFns.push(theme.subscribe(({ mode }) => paintTheme(mode)));
    themeSection.body.append(themeOptions, themeNote);
    view.append(themeSection.section);
  }

  // Data lokal -------------------------------------------------------------
  const dataSection = createSection({
    iconName: 'database',
    title: 'Data & cadangan',
    description: 'Semua catatan berada di IndexedDB. Ekspor berkala agar data tetap aman saat perangkat berganti.',
  });

  const dataActions = el('div', { class: 'settings-actions' });
  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    'aria-hidden': 'true',
    tabindex: '-1',
  });
  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files ?? [];
    fileInput.value = '';
    if (!file) return;

    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('Ukuran backup melebihi 25 MB.');
      }
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('File bukan JSON yang valid.');
      }

      const normalised = validateBackupPayload(payload);
      const approved = await ui.confirm({
        title: 'Gabungkan backup?',
        message: `Backup berisi ${normalised.records.length.toLocaleString('id-ID')} catatan dan ${normalised.settings.length.toLocaleString('id-ID')} pengaturan. Data dengan ID yang sama akan ditimpa; catatan lain tetap aman.`,
        confirmLabel: 'Impor & gabungkan',
        cancelLabel: 'Batal',
      });
      if (!approved) return;

      await db.importData(payload, { mode: 'merge' });
      ui.toast('Backup berhasil diimpor. Memuat ulang aplikasi…', { type: 'success' });
      window.setTimeout(reload, 700);
    } catch (error) {
      ui.toast(`Impor gagal: ${error.message}`, { type: 'error', duration: 6000 });
    }
  });

  const exportButton = actionButton({
    label: 'Ekspor data',
    iconName: 'download',
    onClick: () => withBusy(exportButton, 'Menyiapkan…', async () => {
      try {
        const payload = await db.exportData();
        downloadJSON(`asisten-siswa-backup-${toDateKey()}.json`, payload);
        await markBackupExported(db);
        await loadBackupStatus();
        onBackupExported?.();
        ui.toast('Backup JSON berhasil dibuat.', { type: 'success' });
      } catch (error) {
        ui.toast(`Ekspor gagal: ${error.message}`, { type: 'error' });
      }
    }),
  });

  const importButton = actionButton({
    label: 'Impor data',
    iconName: 'upload',
    onClick: () => fileInput.click(),
  });

  dataActions.append(exportButton, importButton, fileInput);
  const backupStatus = el('p', { class: 'settings-body-text settings-backup-status' });
  dataSection.body.append(
    el('p', { class: 'settings-body-text' },
      'Ekspor menghasilkan satu file JSON mandiri. Import akan menggabungkan data tanpa menghapus catatan yang tidak ada di backup.',
    ),
    backupStatus,
    dataActions,
  );

  async function loadBackupStatus() {
    try {
      const reminder = await getBackupReminder(db);
      if (reminder.recordCount === 0) {
        backupStatus.textContent = 'Belum ada data modul untuk dicadangkan.';
        backupStatus.classList.remove('is-warning');
        return;
      }
      backupStatus.textContent = reminder.due
        ? `${describeBackupAge(reminder)}. Disarankan membuat backup baru sekarang.`
        : `${describeBackupAge(reminder)}. Backup terakhir masih dalam batas 30 hari.`;
      backupStatus.classList.toggle('is-warning', reminder.due);
    } catch (error) {
      console.warn('[Settings] Status backup tidak dapat dibaca.', error);
    }
  }
  loadBackupStatus();

  const storageBox = el('div', { class: 'storage-panel', 'aria-busy': 'true' });
  const storageHead = el('div', { class: 'storage-panel__head' },
    el('div', {},
      el('p', { class: 'settings-label', text: 'Penyimpanan perangkat' }),
      el('p', { class: 'storage-panel__usage', text: 'Menghitung…' }),
    ),
    el('span', { class: 'storage-panel__status', text: 'Memeriksa' }),
  );
  const storageTrack = el('div', { class: 'storage-bar', role: 'progressbar', 'aria-label': 'Pemakaian penyimpanan', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
    el('span', { class: 'storage-bar__fill' }),
  );
  const persistenceRow = el('div', { class: 'storage-panel__footer' });
  storageBox.append(storageHead, storageTrack, persistenceRow);
  dataSection.body.append(storageBox);

  async function loadStorageInfo() {
    try {
      const storage = await getStorageHealth();
      storageBox.setAttribute('aria-busy', 'false');

      if (!storage.supported) {
        storageHead.querySelector('.storage-panel__usage').textContent = 'Estimasi tidak tersedia di browser ini.';
        storageHead.querySelector('.storage-panel__status').textContent = '';
        storageTrack.hidden = true;
        persistenceRow.replaceChildren(el('p', {
          class: 'settings-hint',
          text: 'Browser ini tidak menyediakan API penyimpanan. Ekspor backup secara berkala.',
        }));
        return;
      }

      storageHead.querySelector('.storage-panel__usage').textContent = storage.quota > 0
        ? `${formatBytes(storage.usage)} dari ${formatBytes(storage.quota)}`
        : `${formatBytes(storage.usage)} terpakai`;
      const status = storageHead.querySelector('.storage-panel__status');
      status.textContent = storage.persisted ? 'Terlindungi' : 'Penyimpanan standar';
      status.classList.toggle('is-protected', storage.persisted);

      storageTrack.hidden = false;
      storageTrack.setAttribute('aria-valuenow', String(Math.round(storage.percent)));
      storageTrack.querySelector('.storage-bar__fill').style.width = `${Math.max(storage.percent, storage.usage > 0 ? 1.5 : 0)}%`;

      persistenceRow.replaceChildren();
      if (!storage.persisted && storage.canPersist) {
        const protectButton = actionButton({
          label: 'Minta perlindungan',
          iconName: 'shield',
          variant: 'subtle',
          onClick: () => withBusy(protectButton, 'Meminta…', async () => {
            const result = await requestPersistentStorage();
            ui.toast(
              result.granted
                ? 'Penyimpanan dilindungi dari pembersihan otomatis.'
                : 'Browser belum memberikan perlindungan penyimpanan. Ekspor data secara berkala.',
              { type: result.granted ? 'success' : 'warning', duration: 5500 },
            );
            await loadStorageInfo();
          }),
        });
        persistenceRow.append(el('p', {
          class: 'settings-hint',
          text: 'Lindungi data agar tidak dibersihkan browser saat ruang menipis.',
        }), protectButton);
      } else {
        persistenceRow.append(el('p', {
          class: 'settings-hint',
          text: storage.persisted
            ? 'Penyimpanan sudah dilindungi dari pembersihan otomatis.'
            : 'Browser ini tidak menyediakan perlindungan penyimpanan tambahan.',
        }));
      }
    } catch (error) {
      storageBox.setAttribute('aria-busy', 'false');
      storageHead.querySelector('.storage-panel__usage').textContent = 'Informasi penyimpanan tidak tersedia.';
      console.warn('[Settings] Gagal membaca penyimpanan.', error);
    }
  }
  loadStorageInfo();

  view.append(dataSection.section);

  // Aplikasi ---------------------------------------------------------------
  const appSection = createSection({
    iconName: 'smartphone',
    title: 'Aplikasi',
    description: 'Pasang di layar utama untuk pengalaman layar penuh dan akses offline.',
  });

  const installRow = el('div', { class: 'settings-row settings-row--bordered' });
  const installCopy = el('div', {});
  installCopy.append(el('p', { class: 'settings-label', text: 'Pasang sebagai aplikasi' }));
  installCopy.append(el('p', {
    class: 'settings-hint',
    text: pwa.isStandalone
      ? 'Aplikasi sedang berjalan dalam mode terpasang.'
      : 'Gunakan browser modern. Instalasi tersedia lewat prompt PWA atau menu browser.',
  }));
  const installButton = actionButton({
    label: pwa.isStandalone ? 'Sudah terpasang' : 'Pasang aplikasi',
    iconName: 'smartphone',
    variant: 'primary',
    onClick: () => withBusy(installButton, 'Menyiapkan…', async () => {
      const result = await pwa.install();
      if (result.status === 'accepted') {
        ui.toast('Aplikasi berhasil dipasang.', { type: 'success' });
      } else if (result.status === 'dismissed') {
        ui.toast('Instalasi dibatalkan. Kamu bisa mencobanya lagi nanti.', { type: 'info' });
      } else if (result.status === 'installed') {
        ui.toast('Aplikasi sudah terpasang di perangkat ini.', { type: 'info' });
      } else if (result.status === 'unavailable') {
        ui.toast('Buka menu browser, lalu pilih “Tambahkan ke layar utama” atau “Instal aplikasi”.', {
          type: 'info',
          duration: 6500,
        });
      } else {
        ui.toast('Instalasi belum berhasil. Coba dari menu browser.', { type: 'warning' });
      }
    }),
  });
  if (pwa.isStandalone) installButton.disabled = true;
  installRow.append(installCopy, installButton);
  appSection.body.append(installRow);

  const offlineRow = el('div', { class: 'settings-row settings-row--bordered' });
  offlineRow.append(
    el('div', {},
      el('p', { class: 'settings-label', text: 'Mode offline' }),
      el('p', {
        class: 'settings-hint',
        text: pwa.supported
          ? 'Aset disimpan oleh service worker. Kode terbaru tetap diambil saat online.'
          : 'Aktifkan lewat HTTPS atau localhost agar service worker dapat berjalan.',
      }),
    ),
    el('span', {
      class: `status-badge ${pwa.supported ? 'status-badge--success' : 'status-badge--neutral'}`,
      text: pwa.supported ? 'Siap offline' : 'Tidak aktif',
    }),
  );
  appSection.body.append(offlineRow);

  const versionRow = el('div', { class: 'settings-row settings-row--bordered' });
  versionRow.append(
    el('div', {},
      el('p', { class: 'settings-label', text: 'Versi aplikasi' }),
      el('p', { class: 'settings-hint', text: 'Pembaruan diambil dari jaringan saat tersedia; tidak memakai cache abadi.' }),
    ),
    el('span', { class: 'status-badge status-badge--neutral', text: version }),
  );
  appSection.body.append(versionRow);
  view.append(appSection.section);

  // Zona berbahaya ---------------------------------------------------------
  const danger = createSection({
    iconName: 'trash',
    title: 'Hapus semua data',
    description: 'Menghapus seluruh catatan modul dan pengaturan dari perangkat ini secara permanen.',
    tone: 'danger',
    badge: el('span', { class: 'status-badge status-badge--danger', text: 'Permanen' }),
  });
  danger.body.append(el('p', { class: 'settings-body-text' },
    'Tindakan ini tidak dapat dibatalkan dan tidak memengaruhi file backup yang sudah kamu ekspor. Ekspor data terlebih dahulu bila masih diperlukan.',
  ));
  const deleteButton = holdToConfirmButton({
    label: 'Tahan untuk hapus semua data',
    iconName: 'trash',
    onConfirm: async () => {
      try {
        await db.clearAll();
        ui.toast('Semua data telah dihapus. Memuat ulang…', { type: 'success' });
        window.setTimeout(reload, 700);
      } catch (error) {
        ui.toast(`Data gagal dihapus: ${error.message}`, { type: 'error' });
      }
    },
  });
  danger.body.append(el('div', { class: 'danger-actions' }, deleteButton));
  view.append(danger.section);

  view.append(el('footer', { class: 'settings-footer' },
    el('span', { html: icon('lock') }),
    `Asisten Pribadi Siswa v${version} · 100% lokal · tanpa pelacakan`,
  ));

  container.replaceChildren(view);

  return () => {
    for (const cleanup of cleanupFns) {
      try {
        cleanup();
      } catch (error) {
        console.warn('[Settings] Cleanup gagal.', error);
      }
    }
    cleanupFns.length = 0;
  };
}
