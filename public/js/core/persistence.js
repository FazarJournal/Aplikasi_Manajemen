/**
 * Perlindungan penyimpanan dan pengingat cadangan.
 *
 * `navigator.storage.persist()` hanya bisa diminta dari secure context dan
 * sebaiknya dipicu oleh gestur pengguna. Browser tetap dapat menolak; karena
 * itu perlindungan penyimpanan bukan pengganti backup JSON.
 */
export const BACKUP_LAST_EXPORT_META = 'backup.lastExportAt';
export const BACKUP_LAST_REMINDER_META = 'backup.lastReminderAt';
export const BACKUP_INTERVAL_DAYS = 30;
export const BACKUP_SNOOZE_DAYS = 7;

const DAY_MS = 86_400_000;

function startOfDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calendarDaysBetween(from, to = new Date()) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (!start || !end) return null;
  return Math.floor((end - start) / DAY_MS);
}

export async function getStorageHealth() {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return {
      supported: false,
      canPersist: false,
      persisted: false,
      usage: 0,
      quota: 0,
      percent: 0,
    };
  }

  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate?.().catch(() => null) ?? Promise.resolve(null),
    navigator.storage.persisted?.().catch(() => false) ?? Promise.resolve(false),
  ]);

  const usage = Number(estimate?.usage) || 0;
  const quota = Number(estimate?.quota) || 0;

  return {
    supported: true,
    canPersist: typeof navigator.storage.persist === 'function',
    persisted: Boolean(persisted),
    usage,
    quota,
    percent: quota > 0 ? Math.min(100, (usage / quota) * 100) : 0,
  };
}

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, granted: false };
  }

  const alreadyPersisted = await navigator.storage.persisted?.().catch(() => false);
  if (alreadyPersisted) return { supported: true, granted: true, already: true };

  if (typeof navigator.storage.persist !== 'function') {
    return { supported: false, granted: false };
  }

  try {
    return {
      supported: true,
      granted: Boolean(await navigator.storage.persist()),
    };
  } catch (error) {
    console.warn('[Persistence] Permintaan perlindungan penyimpanan gagal.', error);
    return { supported: true, granted: false, error };
  }
}

export async function getBackupReminder(db, {
  intervalDays = BACKUP_INTERVAL_DAYS,
  snoozeDays = BACKUP_SNOOZE_DAYS,
  now = new Date(),
} = {}) {
  if (!db?.getMeta) throw new TypeError('Database dengan getMeta() wajib diberikan.');

  const [lastExportAt, lastReminderAt] = await Promise.all([
    db.getMeta(BACKUP_LAST_EXPORT_META, null),
    db.getMeta(BACKUP_LAST_REMINDER_META, null),
  ]);

  let recordCount = null;
  if (typeof db.countRecords === 'function') {
    try {
      recordCount = await db.countRecords();
    } catch (error) {
      console.warn('[Persistence] Jumlah catatan tidak dapat dibaca.', error);
    }
  }

  const exportDate = typeof lastExportAt === 'string' ? new Date(lastExportAt) : null;
  const validExportDate = exportDate && !Number.isNaN(exportDate.getTime()) ? exportDate : null;
  const daysSinceExport = validExportDate ? calendarDaysBetween(validExportDate, now) : null;
  const due = recordCount !== 0 && (!validExportDate || daysSinceExport >= intervalDays);

  const reminderDate = typeof lastReminderAt === 'string' ? new Date(lastReminderAt) : null;
  const validReminderDate = reminderDate && !Number.isNaN(reminderDate.getTime()) ? reminderDate : null;
  const daysSinceReminder = validReminderDate ? calendarDaysBetween(validReminderDate, now) : null;
  const snoozed = due && daysSinceReminder !== null && daysSinceReminder < snoozeDays;

  return {
    due,
    snoozed,
    shouldRemind: due && !snoozed,
    intervalDays,
    snoozeDays,
    lastExportAt: validExportDate?.toISOString() ?? null,
    lastReminderAt: validReminderDate?.toISOString() ?? null,
    daysSinceExport,
    daysSinceReminder,
    recordCount,
  };
}

export async function markBackupExported(db, at = new Date()) {
  if (!db?.setMeta) throw new TypeError('Database dengan setMeta() wajib diberikan.');
  const timestamp = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError('Tanggal backup tidak valid.');
  await db.setMeta(BACKUP_LAST_EXPORT_META, timestamp.toISOString());
  return timestamp;
}

export async function snoozeBackupReminder(db, at = new Date()) {
  if (!db?.setMeta) throw new TypeError('Database dengan setMeta() wajib diberikan.');
  const timestamp = at instanceof Date ? at : new Date(at);
  await db.setMeta(BACKUP_LAST_REMINDER_META, timestamp.toISOString());
  return timestamp;
}

export function describeBackupAge(reminder) {
  if (!reminder || reminder.daysSinceExport === null) return 'Belum pernah diekspor';
  if (reminder.daysSinceExport <= 0) return 'Diekspor hari ini';
  if (reminder.daysSinceExport === 1) return 'Diekspor kemarin';
  return `Diekspor ${reminder.daysSinceExport} hari lalu`;
}
