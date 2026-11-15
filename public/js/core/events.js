/**
 * Nama event lintas modul resmi milik Core.
 * Modul diperbolehkan membuat event sendiri dengan awalan id modul,
 * misalnya "tugas:fokus-dimulai", demi menghindari tabrakan nama.
 */
export const EVENTS = Object.freeze({
  DATA_CHANGED: 'core:data-changed',
  DATA_IMPORTED: 'core:data-imported',
  DATA_CLEARED: 'core:data-cleared',
  SETTINGS_CHANGED: 'core:settings-changed',
  DB_VERSION_CHANGE: 'core:db-version-change',
  NETWORK_CHANGE: 'core:network-change',
  MODULE_MOUNT_ERROR: 'core:module-mount-error',
});
