# Arsitektur Asisten Pribadi Siswa

Dokumen ini menjelaskan keputusan arsitektur, strategi skema data, mekanisme plugin, lifecycle modul, routing, UI, PWA, serta batasan dan jalur evolusi aplikasi.

- **Versi aplikasi:** 1.6.0
- **Runtime:** browser modern, tanpa framework, ES modules
- **Penyimpanan:** IndexedDB lokal
- **Hosting:** HTML/CSS/JS statis + HTTPS
- **Web root:** `public/`
- **Modul bawaan:** `keuangan`, `latihan`, `tugas`

---

## 1. Tujuan dan batasan

Kebutuhan utama:

1. Aplikasi siswa yang **lokal-first**, privat, dan bisa dipakai offline.
2. Fitur baru dapat ditambahkan sebagai **modul** tanpa mengedit inti atau memigrasikan database.
3. Tidak memakai framework, `alert`, `confirm`, atau `prompt` bawaan browser.
4. UI mobile-first dengan tema terang/gelap, tetap nyaman di desktop.
5. Service worker tidak boleh membuat kode baru tertahan selamanya di cache lama.

Batasan yang diterima:

- Data hanya ada di satu browser/perangkat; tidak ada sinkronisasi.
- Modul adalah **kode tepercaya** yang berjalan di origin yang sama.
- Aplikasi membutuhkan secure context untuk PWA.
- Skala data adalah skala personal siswa, bukan multi-tenant atau analytics besar.

---

## 2. Keputusan arsitektur utama

| Keputusan | Alternatif | Alasan dipilih |
| --- | --- | --- |
| **Modular monolith** + plugin registry | Microfrontend/iframe per fitur | Satu shell, satu tema, satu database, tanpa build step. Isolasi modul cukup lewat kontrak dan namespace data. |
| **Dynamic import dari manifest** | Daftar impor statis di `main.js` | Menambah modul tidak menyentuh inti. Registry dapat memvalidasi, mengisolasi kegagalan, dan membersihkan lifecycle. |
| **Satu object store `records`** | Satu store per modul/koleksi | Tidak ada migrasi skema saat modul baru muncul. Backup dan import menjadi seragam. |
| **Repository scoped per modul** | Modul mengakses IndexedDB langsung | Mencegah tabrakan data dan menyembunyikan detail transaksi. Modul tidak dapat menyentuh namespace modul lain. |
| **Hash router** | History API + rewrite server | Aplikasi statis dapat dideploy tanpa konfigurasi server, tetap bekerja offline. |
| **Vanilla JS + ES modules** | React/Vue/Svelte | Sesuai kebutuhan, ukuran kecil, tanpa toolchain, mudah diaudit. |
| **Dialog kustom Promise-based** | `alert`/`confirm`/`prompt` | Kontrol tampilan, aksesibilitas, fokus, validasi, dan tema terang/gelap. |
| **Network-first untuk kode** | Cache-first / SWR untuk semua aset | Kode terbaru diambil saat online; cache hanya fallback offline. |
| **Toast + undo** | Dialog konfirmasi untuk setiap aksi | Aksi yang bisa dibatalkan tidak perlu memblokir alur. |

Prinsip pemisahan:

```text
core/       tidak boleh mengimpor modules/ atau views/
views/      boleh mengimpor core/, tidak boleh mengimpor modules/ secara statis
modules/    boleh mengimpor core/ dan utilitasnya, tidak boleh mengimpor views/
app/shell   composition root; satu-satunya tempat merakit semuanya
```

Modul tidak perlu tahu tentang shell, router, atau modul lain. Komunikasi lintas fitur dilakukan lewat event bus dengan awalan nama modul.

---

## 3. Gambaran sistem

```text
┌─────────────────────────────────────────────────────────────┐
│                         index.html                          │
│  shell statis · boot screen · nav container · modal root     │
└─────────────────────────────┬───────────────────────────────┘
                              │ js/main.js
┌─────────────────────────────▼───────────────────────────────┐
│                    App - app/shell.js                       │
│  composition root · boot orchestration · navigation guard   │
└───┬───────────┬──────────────┬──────────────┬───────────────┘
    │           │              │              │
    ▼           ▼              ▼              ▼
┌────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────────┐
│ Router │ │   UI    │ │ LocalDatabase│ │ PwaController│
│ hash   │ │ dialog  │ │ IndexedDB    │ │ SW/install   │
└────────┘ │ toast   │ │ backup       │ └──────┬───────┘
           └─────────┘ └──────┬───────┘        │
                               │                │ sw.js
                     ┌─────────▼────────┐       ▼
                     │  ModuleRegistry  │  Cache API + Fetch
                     │ manifest/import  │
                     │ context/cleanup  │
                     └─────────┬────────┘
                               │ dynamic import
              ┌────────────────▼────────────────┐
              │ js/modules/modules.json          │
              │  ├─ tugas/index.js               │
              │  ├─ keuangan/index.js            │
              │  ├─ latihan/index.js             │
              │  └─ (modul berikutnya)           │
              └──────────────────────────────────┘
```

### Urutan boot

1. `main.js` membuat `App` dan memanggil `boot()`.
2. Shell mengambil referensi DOM dan mengecat ikon/versi statis.
3. Dibuat layanan: `UI`, `PwaController`, `Router`, `LocalDatabase`, `ModuleRegistry`.
4. Database dibuka; nama profil dibaca dari `settings`.
5. `registry.load()` membaca manifest, mengimpor modul secara paralel, memanggil `setup()`.
6. Navigasi dan rute didaftarkan; router mulai menangani hash.
7. Shell ditampilkan, boot screen dihapus, peringatan boot ditampilkan bila ada.
8. Service worker diregistrasi dan aset modul dikirim untuk di-precache.
9. Pengingat backup diperiksa; database kosong tidak memicu toast. Badge notifikasi dihitung dari kondisi data saat ini.
10. Jika database gagal dibuka, shell menampilkan layar error fatal, bukan halaman kosong.

### Urutan navigasi

```text
hashchange
  → router membaca path
  → App.#prepareNavigation()
      · naikkan navigationId
      · tunggu cleanup view sebelumnya
      · abaikan jika sudah ada navigasi lebih baru
      · tutup semua dialog
      · perbarui judul, aria-live, nav aktif, scroll
  → render view / mount modul
  → jika navigationId berubah selama await, hasil dibuang + cleanup
  → simpan cleanup sebagai activeCleanup
```

Mekanisme `navigationId` mencegah render usang ketika pengguna berpindah halaman cepat saat modul masih memuat data.

---

## 4. Registry dan lifecycle modul

### 4.1 Manifest

`js/modules/modules.json` adalah satu-satunya titik komposisi fitur:

```json
{
  "manifestVersion": 1,
  "modules": [
    {
      "id": "tugas",
      "entry": "./tugas/index.js",
      "enabled": true,
      "assets": []
    },
    {
      "id": "keuangan",
      "entry": "./keuangan/index.js",
      "enabled": true
    }
  ]
}
```

Validasi yang dilakukan registry:

- `modules` harus array.
- `enabled: false` dilewati.
- `id` harus cocok dengan pola huruf kecil/angka/tanda hubung dan unik.
- `entry` wajib, harus berada di origin yang sama.
- Modul harus mengekspor default object dengan `id` yang sama, `name`, dan `mount()`.
- Aset tambahan hanya diterima dari origin yang sama.

Kegagalan satu modul tidak menggagalkan modul lain. `Promise.allSettled` dipakai untuk import, `setup()` dibungkus try/catch, dan kesalahan dicatat ke `registry.errors` untuk ditampilkan sebagai peringatan boot.

### 4.2 Fase hidup

| Fase | Frekuensi | Fungsi |
| --- | --- | --- |
| Import | sekali saat boot | Memuat kode modul, menyuntikkan `styles`, membuat metadata. |
| `setup(ctx)` | sekali saat boot | Registrasi event jangka panjang, warm-up cache, atau pekerjaan non-DOM. |
| `mount(ctx, container)` | setiap rute modul dibuka | Merender UI dan mengikat listener. |
| Teardown | setiap rute ditinggalkan | Menjalankan teardown hasil `mount`, `unmount(ctx)`, cleanup, dan abort signal. |

Konteks `setup()` bersifat jangka panjang (`ctx.signal === null`). Konteks `mount()` baru dibuat setiap kali modul dibuka dan memiliki `AbortSignal` sendiri. Ini mencegah modul memegang DOM lama atau listener ganda setelah navigasi berulang.

### 4.3 Context API

Modul menerima:

```text
ctx.module     metadata aman (id, name, description, version)
ctx.db         scope database modul
ctx.data(name) repository koleksi
ctx.ui         dialog/form/prompt/confirm/toast
ctx.bus        event bus
ctx.utils      util tanggal, ID, format, debounce, unduh
ctx.navigate   navigasi internal
ctx.signal     AbortSignal per mount
ctx.onCleanup  registrasi cleanup
ctx.on         event bus + auto-cleanup
```

Modul hanya dapat mengakses `db.scope(id)` miliknya. Repository adalah closure yang sudah mengikat `moduleId`; tidak ada parameter modul lain pada API repository.

### 4.4 Cleanup

Urutan teardown:

1. Fungsi yang dikembalikan `mount()`.
2. `unmount(ctx)`.
3. Seluruh cleanup yang didaftarkan via `ctx.onCleanup()`, urutan terbalik.
4. `AbortSignal` di-abort.

Semua langkah dibungkus try/catch agar kegagalan cleanup satu modul tidak menghalangi navigasi. Modul tetap disarankan memeriksa `ctx.signal.aborted` setelah operasi async sebelum menyentuh DOM. Operasi IndexedDB tidak dapat dibatalkan, tetapi hasilnya tidak boleh dipakai setelah unmount.

### 4.5 Ringkasan beranda

Registry masih menyediakan kontrak ringkasan untuk modul. Jika modul mengekspor `getHomeSummary(ctx)`, registry memanggilnya dan menormalkan hasilnya:

```js
return [{
  label: 'Tugas aktif',
  value: 4,
  hint: 'Lihat tenggat di modul Tugas.',
  tone: 'default', // default | success | warning | danger
  primary: true,
}];
```

Registry menambahkan `id`, `moduleId`, `moduleName`, dan `moduleIcon`, memilih satu ringkasan per modul (utamakan `primary: true`), lalu membatasi jumlah kartu. Kegagalan satu ringkasan tidak menggagalkan modul lain.

Sejak 1.6.0, Beranda tidak memakai kartu ringkasan generik sebagai jalur utama. `views/home.js` membaca koleksi modul inti lewat repository scoped (`db.scope(moduleId).collection(...)`), sehingga angka yang tampil adalah data nyata:

- saldo gabungan, pemasukan, dan pengeluaran bulan berjalan dari `keuangan`;
- tiga transaksi terbaru dan tiga tugas mendatang;
- jumlah paket, jumlah soal, dan skor terakhir dari `latihan`;
- pintasan ke Keuangan, Latihan Soal, dan Tugas.

Setiap bagian memiliki empty state dan status pemuatan sendiri. `getHomeSummary()` dipertahankan sebagai kontrak registry untuk modul lain, tetapi Beranda inti tidak lagi bergantung padanya.

### 4.6 Error boundary `mount()`

`registry.mount()` tidak membiarkan error modul menjadi layar putih. Alurnya:

1. `mount()` dijalankan di dalam `Promise.resolve()` agar error sinkron ikut tertangkap.
2. Balapan dengan timeout 12 detik mencegah modul yang menggantung memblokir area konten.
3. Saat gagal, DOM parsial dibersihkan, cleanup modul dijalankan, konteks di-abort, dan error dicatat.
4. Event `core:module-mount-error` dipancarkan.
5. Shell menerima `onError` dan merender kartu error dengan tombol coba lagi. Jika tidak ada callback, registry merender fallback mandiri.
6. Pemanggil tetap menerima fungsi teardown yang aman, bukan exception.

```js
const cleanup = await registry.mount(module.id, content, {
  onError: ({ error, timedOut }) => {
    renderModuleError(content, module, error, timedOut);
  },
});
```

Kegagalan setelah mount, misalnya error di event listener, tidak tertangkap boundary ini. Modul tetap bertanggung jawab membungkus operasi async-nya dan memeriksa `ctx.signal.aborted`.

### 4.7 Modul Keuangan

Modul Keuangan memakai dua koleksi di namespace `keuangan`:

| Koleksi | Isi |
| --- | --- |
| `accounts` | Dompet dengan `name`, `kind` (`cash`/`ewallet`/`bank`), dan `openingBalance`. |
| `transactions` | Pemasukan, pengeluaran, atau transfer dengan `accountId`, `toAccountId`, `amount`, `date`, `category`, dan `note`. |

Saldo dihitung dari saldo awal ditambah seluruh transaksi. Transfer mengurangi saldo asal dan menambah saldo tujuan, sehingga total kekayaan tidak berubah. Form transaksi mengutamakan jenis, nominal, dompet, lalu catatan; tanggal diletakkan paling bawah karena biasanya sudah sesuai hari ini. Nominal ditulis dalam ribuan (`1` = Rp1.000, `2,5` = Rp2.500) tetapi tetap disimpan sebagai rupiah penuh. Dompet tujuan hanya muncul untuk transfer. Kategori dihapus dan digabung ke catatan. Laporan menampilkan komposisi pengeluaran per dompet pada periode terpilih; grafik donut dan batang dirender oleh helper core `chart.js`.

### 4.8 Catat cepat

Modul dapat mengekspor `quickAdd(ctx)` untuk menyediakan formulir singkat yang bisa dibuka dari halaman mana pun. Registry menyediakan:

- `registry.quickActions` berisi daftar modul yang punya `quickAdd()`;
- `registry.runQuickAdd(moduleId)` memanggil method tersebut dengan konteks modul jangka panjang.

Shell menampilkan tombol **Catat** di topbar dan mendengarkan `Alt+N`. Jika hanya ada satu aksi, formulir langsung dibuka. Jika ada beberapa modul, shell menampilkan pilihan singkat lebih dulu. Modul bertanggung jawab penuh atas form dan penyimpanan, misalnya Tugas memakai `ctx.ui.form()` lalu `ctx.data('tasks').create()`.

Karena `quickAdd()` memakai konteks `setup()` yang tidak memiliki `AbortSignal` per-mount, method ini tidak boleh menyentuh DOM modul yang mungkin sudah dilepas. Setelah data berubah, event `core:data-changed` membuat Tugas yang sedang terbuka menyegarkan daftar. Shortcut PWA `./?quick=1` membuka formulir yang sama setelah boot, lalu query dibersihkan dari URL.

### 4.9 Helper core lintas modul

Tiga helper core dipakai modul dan views tanpa menambah dependensi:

| Helper | Tanggung jawab |
| --- | --- |
| `core/chart.js` | `donutChart()` dan `barChart()` berbasis SVG murni, `viewBox`, tooltip `<title>`, legenda, dan tabel tersembunyi untuk grafik batang. |
| `core/notifications.js` | Cek dukungan, izin, tampil via service worker atau `new Notification`, penjadwalan timer, dan pembatalan. |
| `core/persistence.js` | `navigator.storage.persist()`, estimasi pemakaian, metadata ekspor, dan pengingat backup 30/7 hari. |

```js
import { barChart } from '../../core/chart.js';

panel.replaceChildren(barChart(groups, {
  series: [
    { key: 'income', label: 'Masuk', color: '#34d399' },
    { key: 'expense', label: 'Keluar', color: '#fb7185' },
  ],
  formatValue: (value) => `Rp${value}`,
}));
```

`notifications.schedule()` hanya menerima jadwal dengan delay positif dan di bawah batas timer browser. Izin diminta dari gestur pengguna. Timer tidak hidup setelah PWA ditutup; push server atau background sync di luar cakupan.

`persistence.js` membutuhkan database penuh (`getMeta`, `setMeta`, `countRecords`), jadi helper ini dipakai shell dan views, bukan `ctx.db` yang scoped ke satu modul. Database kosong tidak memicu pengingat ekspor.

### 4.10 Notifikasi modul

Modul dapat mengekspor `getNotifications(ctx)` untuk menyumbang item ke pusat notifikasi. Kontraknya sengaja tidak menyimpan pesan: notifikasi adalah **turunan kondisi data saat ini**, sehingga tidak ada status "sudah dibaca", tabel notifikasi, atau sinkronisasi.

```js
async getNotifications(ctx) {
  const tasks = await ctx.data('tasks').list();
  const overdue = tasks.filter((task) => !task.done && isOverdue(task));

  if (overdue.length === 0) return [];
  return [{
    id: 'tugas-overdue',
    icon: 'alert',           // nama ikon core atau markup SVG
    title: `${overdue.length} tugas lewat tenggat`,
    text: 'Buka modul Tugas untuk menindaklanjuti.',
    tone: 'danger',          // default | warning | danger
    path: '/modul/tugas',
  }];
}
```

`registry.getNotifications()` memanggil semua modul yang menyediakan method tersebut secara paralel dengan `Promise.allSettled`, lalu menormalkan item:

| Field | Normalisasi |
| --- | --- |
| `id` | String tidak kosong, atau `<moduleId>-<index>` bila kosong. |
| `source` | Selalu nama modul. |
| `icon` | Ikon item (nama atau SVG), fallback ikon modul. |
| `title` | Wajib; item tanpa judul dilewati. |
| `text` | String opsional, fallback string kosong. |
| `tone` | `default`, `warning`, atau `danger`. |
| `path` | Rute internal yang diawali `/`, fallback `/modul/<moduleId>`. |

Kegagalan satu modul dicatat dan tidak menggagalkan hasil modul lain. Shell menambahkan pengingat backup bila `getBackupReminder()` menyatakan `due`, lalu menghitung badge dari total item. Karena badge memakai `due` (bukan `shouldRemind`), menunda toast tidak menyembunyikan item dari pusat notifikasi. Refresh badge dipicu saat boot, debounce 450 ms setelah `core:data-changed`, saat sheet dibuka, setelah ekspor backup, dan setelah pengingat boot ditunda.

### 4.11 Modul Latihan Soal

Modul Latihan Soal sengaja tidak menyediakan editor soal. Paket soal berasal dari file JSON yang divalidasi, lalu disimpan sebagai satu dokumen di koleksi `banks`; hasil pengerjaan masuk ke koleksi `attempts`.

| Koleksi | Isi |
| --- | --- |
| `banks` | `title`, `subject`, `description`, `questions[]`, `sourceName`, `importedAt`. Setiap item `questions` berisi `question`, `options[]`, `answer`, dan `explanation`. |
| `attempts` | `bankId`, `bankTitle`, `subject`, `correct`, `total`, `percent`, `durationMs`, dan `completedAt`. |

Validasi impor menolak file di atas 2 MB, JSON rusak, paket tanpa soal, lebih dari 300 soal, soal tanpa pertanyaan, pilihan kurang dari 2 atau lebih dari 6, pilihan kosong, serta `answer` di luar jangkauan. `answer` menerima indeks berbasis nol, huruf pilihan (`"A"`–`"F"`), atau teks pilihan yang sama. `format` dan `formatVersion` opsional, tetapi bila diisi harus dikenali; versi format yang lebih baru ditolak. Judul kosong memakai nama file sebagai cadangan.

Alur UI berjalan di dalam satu mount modul:

```text
daftar paket + riwayat
  → impor JSON (file picker) atau unduh contoh
  → mulai latihan
      → satu soal per layar
      → pilih jawaban → umpan balik + penjelasan
      → soal berikutnya
  → hasil: persentase, jumlah benar, tinjau jawaban
  → simpan attempt → kembali ke daftar
```

Skor dihitung dari perbandingan indeks jawaban yang dipilih dengan `question.answer` pada snapshot sesi. Setiap percobaan disimpan sebagai dokumen baru; menekan **Ulangi latihan** mengacak ulang urutan soal dan pilihan, lalu memulai sesi baru dengan snapshot sendiri sehingga penilaian dan tinjauan tetap konsisten meski urutan berbeda. Menghapus paket hanya menghapus dokumen `banks`; riwayat tetap ada karena menyimpan `bankTitle` sendiri. Tombol **Hapus riwayat** memanggil `attempts.clear()` setelah konfirmasi. Riwayat diurutkan dari `completedAt` terbaru dan delapan item teratas ditampilkan.

Karena paket dapat berisi banyak soal dalam satu dokumen, modul ini tidak membutuhkan index database tambahan. Semua data tetap berada di namespace modul `latihan` dan ikut serta dalam ekspor/impor backup universal.

---

## 5. Strategi skema data universal

### 5.1 Tiga store inti

| Store | Key path | Isi |
| --- | --- | --- |
| `records` | `_key` | Dokumen generik semua modul. |
| `settings` | `key` | Pengaturan aplikasi. |
| `meta` | `key` | Metadata internal. |

Tidak ada object store per modul. Menambah modul tidak menambah store, tidak menaikkan versi database, dan tidak memerlukan upgrade callback baru.

### 5.2 Bentuk dokumen

```json
{
  "_key": "tugas::tasks::0f0f07c6-...",
  "_module": "tugas",
  "_collection": "tasks",
  "_id": "0f0f07c6-...",
  "_data": {
    "title": "Latihan aljabar",
    "done": false,
    "schemaVersion": 1
  },
  "_createdAt": "2026-10-26T12:00:00.000Z",
  "_updatedAt": "2026-10-26T12:00:00.000Z"
}
```

Kepada modul, repository mengembalikan bentuk publik:

```json
{
  "title": "Latihan aljabar",
  "done": false,
  "schemaVersion": 1,
  "id": "0f0f07c6-...",
  "createdAt": "2026-10-26T12:00:00.000Z",
  "updatedAt": "2026-10-26T12:00:00.000Z"
}
```

Metadata inti (`id`, `createdAt`, `updatedAt`) tidak dapat ditimpa oleh isi `_data`.

### 5.3 Index

| Index | Key path | Kegunaan |
| --- | --- | --- |
| `_scope` | `["_module", "_collection"]` | Query utama per koleksi modul. |
| `_module` | `_module` | Inspeksi/agregasi per modul. |
| `_updatedAt` | `_updatedAt` | Urutan/riwayat lintas modul bila diperlukan. |

`_key` adalah primary key dan otomatis unik. Isolasi modul ditegakkan di API dan index scope, bukan dengan memisahkan fisik data.

### 5.4 Mengapa tidak perlu migrasi s
