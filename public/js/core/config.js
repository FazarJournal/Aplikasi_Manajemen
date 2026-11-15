/**
 * Identitas aplikasi dan konstanta global.
 * Nilai di sini adalah kontrak inti, bukan tempat menaruh logika modul.
 */
export const APP_INFO = Object.freeze({
  name: 'Asisten Pribadi Siswa',
  shortName: 'Asisten Siswa',
  version: '1.5.0',
  dbName: 'asisten-pribadi-siswa',
  dbVersion: 1,
});

export const DEFAULT_PROFILE_NAME = 'Siswa';
export const PROFILE_NAME_KEY = 'profile.name';

/** Path relatif terhadap dokumen utama. */
export const MODULE_MANIFEST_URL = new URL(
  './js/modules/modules.json',
  document.baseURI,
);
