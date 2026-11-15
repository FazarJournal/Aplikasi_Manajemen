export async function initStorageProtection(db, ui) {
  // 1. Meminta daya tahan penyimpanan dari OS/Browser otomatis
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      await navigator.storage.persist();
    }
  }

  // 2. Memeriksa rentang waktu cadangan terakhir (Default batas: 14 hari)
  const BACKUP_WARN_DAYS = 14;
  const lastBackupSetting = await db.getSetting('lastBackupAt');

  if (lastBackupSetting) {
    const lastBackupDate = new Date(lastBackupSetting);
    const diffDays = Math.floor((Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= BACKUP_WARN_DAYS) {
      ui.toast(`Sudah ${diffDays} hari kamu tidak mengunduh cadangan data. Disarankan ekspor data dari Pengaturan.`, 6000);
    }
  } else {
    // Peringatan awal jika pengguna baru dan belum pernah melakukan cadangan
    const firstRun = await db.getSetting('appInitializedAt');
    if (firstRun) {
      const daysSinceStart = Math.floor((Date.now() - new Date(firstRun).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceStart >= BACKUP_WARN_DAYS) {
        ui.toast('Amankan datamu! Lakukan ekspor cadangan pertama dari menu Pengaturan.', 6000);
      }
    } else {
      await db.setSetting('appInitializedAt', new Date().toISOString());
    }
  }
}

export async function markBackupCompleted(db) {
  await db.setSetting('lastBackupAt', new Date().toISOString());
}
