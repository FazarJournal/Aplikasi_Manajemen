# Asisten Pribadi Siswa

PWA lokal-first untuk siswa: mencatat tugas, mengatur tenggat, dan mencatat keuangan pribadi tanpa akun, tanpa cloud, dan tanpa pelacakan. Seluruh data tersimpan di IndexedDB perangkat.

Antarmuka mobile-first dengan tema terang dan gelap yang dapat mengikuti sistem atau dipilih manual. Aplikasi dibangun dengan HTML, CSS, serta JavaScript murni (ES modules) tanpa framework runtime. Tailwind CSS dipakai **saat build** untuk menghasilkan utilitas; hasilnya berupa satu file CSS statis sehingga aplikasi tetap ringan dan offline. Fitur baru dapat ditambahkan sebagai modul tanpa mengubah inti aplikasi.

## Sorotan

- **100% lokal** - tidak ada server data, akun, iklan, atau telemetri.
- **Bisa offline** - service worker menyimpan shell, kode, ikon, dan aset modul.
- **Arsitektur modular** - modul ditemukan dari `js/modules/modules.json` dan diimpor secara dinamis.
- **Skema data universal** - satu object store untuk semua modul; menambah modul tidak memerlukan migrasi database.
- **Dialog kustom** - tidak memakai `alert`, `confirm`, atau `prompt` bawaan browser.
- **Pembaruan cerdas** - kode memakai network-first dengan revalidasi, aset visual memakai stale-while-revalidate.
- **Backup JSON** - ekspor seluruh data dan impor kembali secara aman.
- **Pengingat backup** - pengingat ekspor berkala 30 hari, bisa ditunda 7 hari.
- **Perlindungan penyimpanan** - meminta `navigator.storage.persist()` lewat gestur pengguna dan menampilkan statusnya.
- **Pengingat tenggat** - notifikasi lokal untuk tugas, dengan batas timer yang dijelaskan di bawah.
- **Grafik SVG** - donut dan batang tanpa library, dengan tooltip, legenda, dan tabel aksesibel.
- **Tema terang/gelap** - pilihan Sistem, Terang, atau Gelap di Pengaturan. Mode Sistem mengikuti perubahan tema perangkat secara langsung, dan pilihan disimpan di perangkat.
- **Tema hijau tenang** - aksen hijau dan dekorasi yang dikurangi agar layar terasa lebih sederhana di kedua tema.
- **Catat cepat** - tombol mengambang, pintasan `Alt+N`, dan shortcut PWA untuk mencatat tugas tanpa berpindah halaman.
- **Navigasi native** - header ringkas dengan judul di kiri, tombol kembali kondisional, ikon Cari, lonceng notifikasi, dan avatar profil. Bottom nav berisi 3 tab tetap: **Beranda**, **Menu**, dan **Pengaturan**; semua modul dibuka dari halaman Menu.
- **Pencarian modul** - ikon Cari membuka halaman pencarian yang mencocokkan nama dan deskripsi modul. Query dipertahankan saat kembali dari modul, dan pencarian tidak membaca isi catatan pribadi.
- **Pusat notifikasi** - lonceng menampilkan daftar live berisi tugas lewat tenggat, tugas jatuh tempo hari ini, dan pengingat backup. Badge mengikuti kondisi data saat ini, tanpa status "sudah dibaca".
- **Beranda fokus** - maksimal dua kartu inti (Tugas dan Keuangan); modul lain dibuka lewat Menu agar Beranda tetap ringkas.
- **Modul Tugas** - CRUD, filter, tenggat, statistik, undo, catat cepat, dan sorotan beranda.
- **Modul Keuangan** - dompet tunai/e-wallet/bank, pemasukan, pengeluaran, transfer, catatan, laporan per dompet, dan grafik. Nominal diisi dalam ribuan (misalnya `2,5` menjadi Rp2.500) agar cepat ditulis.
- **Modul Latihan Soal** - impor paket soal pilihan ganda dari JSON, umpan balik per soal, skor, dan riwayat latihan. Urutan soal dan pilihan diacak setiap percobaan. Tidak ada editor soal manual.

## Menjalankan

Aplikasi membutuhkan HTTP/HTTPS karena memakai ES modules dan service worker. Membuka `index.html` langsung melalui `file://` **tidak akan bekerja**.

Web root aplikasi ada di folder `public/`. Jalankan server dari sana:

```bash
cd "/path/ke/folder-proyek"
python3 -m http.server 8080 --directory public
```

Alternatif lain:

```bash
cd "/path/ke/folder-proyek/public"
npx serve .
```

Buka:

```text
http://localhost:8080
```

`README.md` dan `docs/` berada di luar web root dan tidak ikut terdeploy. Alternatif: unggah seluruh **isi folder `public/`** ke hosting statis apa pun (Netlify, Vercel, Cloudflare Pages, GitHub Pages, atau server sekolah). Jika memakai Netlify/Vercel, atur publish directory ke `public`.

### Memasang sebagai PWA

1. Buka aplikasi melalui HTTPS atau `localhost`.
2. Di Chrome/Edge, pilih menu browser → **Instal aplikasi** / **Tambahkan ke layar utama**. Prompt instalasi juga tersedia lewat tombol di **Pengaturan → Aplikasi**.
3. Di iPhone/iPad, buka Safari → **Bagikan** → **Tambahkan ke Layar Utama**.
4. Setelah satu kali pemuatan online, coba mode offline dari DevTools atau matikan jaringan. Muat ulang halaman; aplikasi tetap berjalan.

Service worker membutuhkan secure context. `http://localhost` dianggap aman; alamat LAN biasa (misalnya `http://192.168.1.10`) tidak.

## Struktur proyek

```text
.
├── README.md                  # Dokumentasi penggunaan
├── package.json               # Skrip build Tailwind (dev-only)
├── tailwind.config.js         # Konfigurasi Tailwind
├── src/tailwind.css           # Sumber direktif Tailwind
├── docs/
│   └── ARCHITECTURE.md        # Analisis & keputusan arsitektur
└── public/                    # ← web root; inilah yang disajikan/deploy
    ├── index.html             # Shell HTML + boot screen
    ├── manifest.webmanifest   # Metadata PWA
    ├── sw.js                  # Service worker & strategi cache
    ├── icons/                 # Ikon SVG/PNG (any, maskable, Apple)
    ├── styles/
    │   ├── app.css            # Token desain & reset
    │   ├── views.css          # Gaya view lama yang masih dipakai
    │   ├── charts.css         # Gaya grafik SVG core
    │   ├── overlays.css       # Dialog, form, toast
    │   ├── native.css         # Shell native, safe area, bottom sheet
    │   └── tailwind.css       # Hasil build utilitas Tailwind (jangan diedit manual)
    └── js/
        ├── main.js            # Titik masuk
        ├── app/shell.js       # Composition root & lifecycle aplikasi
        ├── core/
        │   ├── bus.js         # Event bus
        │   ├── chart.js       # Donut & bar chart SVG
        │   ├── config.js      # Identitas & konstanta inti
        │   ├── db.js          # IndexedDB, repository, backup
        │   ├── dom.js         # Helper DOM
        │   ├── events.js      # Nama event inti
        │   ├── icons.js       # Ikon SVG internal
        │   ├── notifications.js # Izin & penjadwal notifikasi
        │   ├── persistence.js # Storage persist & pengingat backup
        │   ├── pwa.js         # Instalasi & pembaruan PWA
        │   ├── registry.js    # Discovery, import, context, notifikasi, cleanup modul
        │   ├── router.js      # Hash router
        │   ├── theme.js       # Tema Sistem/Terang/Gelap
        │   ├── ui.js          # Dialog, form, prompt, toast
        │   └── utils.js       # Tanggal, ID, format, unduh JSON
        ├── views/
        │   ├── home.js        # Beranda dinamis
        │   ├── module-list.js # Kartu modul bersama Menu & pencarian
        │   ├── search.js      # Pencarian nama/deskripsi modul
        │   └── settings.js    # Profil, tema, backup, penyimpanan
        └── modules/
            ├── modules.json   # Manifest komposisi modul
            ├── tugas/index.js # Modul tugas
            ├── keuangan/index.js # Modul keuangan
            └── latihan/index.js  # Modul latihan soal
```

Semua jalur `js/...`, `styles/...`, dan aset lain di dokumentasi ini relatif terhadap web root `public/`.

## Cara kerja singkat

```text
main.js
  └─ App (shell.js)
      ├─ Router          → #/ , #/menu , #/cari , #/modul/:id , #/pengaturan
      ├─ UI              → dialog/form/toast (Promise-based)
      ├─ LocalDatabase   → records + settings + meta
      ├─ ModuleRegistry  → modules.json → dynamic import → mount/cleanup
      └─ PwaController   → registrasi SW, update, prompt instalasi
```

Modul tidak diimpor secara statis oleh inti. Registry membaca manifest, memvalidasi ID dan entry, mengimpor file modul, membuat konteks layanan yang terisolasi, lalu memanggil `mount()` saat rute modul dibuka. Saat pengguna berpindah halaman, listener, `AbortSignal`, dan cleanup modul dijalankan.

Navigasi mobile memakai header ringkas dan bottom nav 3 tab tetap: **Beranda**, **Menu**, dan **Pengaturan**. Header menampilkan judul halaman di kiri, tombol kembali hanya pada rute yang lebih dalam (modul, pencarian, halaman tidak ditemukan), serta ikon Cari, lonceng notifikasi, dan avatar profil di kanan. Halaman **Menu** (`#/menu`) adalah rute penuh berisi semua modul dalam grid dua kolom, sehingga jumlah tab tidak berubah saat modul bertambah dan daftar tidak memakan banyak ruang vertikal. Tab Menu tetap aktif saat sebuah modul dibuka. Beranda hanya menampilkan maksimal dua kartu inti (Tugas dan Keuangan) dengan fallback bila modul inti tidak tersedia. Modul dapat menandai kartu pilihannya dengan `primary: true`; jika tidak ada, kartu valid pertama yang dipakai.

Ikon Cari membuka `#/cari`, halaman pencarian yang hanya mencocokkan **nama dan deskripsi modul** (bukan isi catatan). Pencarian mengabaikan perbedaan huruf besar/kecil dan diakritik, menampilkan empty state bila tidak ada hasil, dan mempertahankan query saat pengguna membuka modul lalu kembali. Kartu modul di Menu dan hasil pencarian memakai komponen yang sama di `views/module-list.js`.

Lonceng membuka pusat notifikasi berupa bottom sheet. Isinya dihitung dari kondisi data saat ini, bukan daftar pesan yang bisa ditandai "sudah dibaca". Modul dapat menyumbang notifikasi lewat `getNotifications(ctx)`, sementara shell menambahkan pengingat backup yang jatuh tempo. Setiap item mengarah ke rute terkait; badge pada lonceng diperbarui saat boot, saat data berubah (dengan debounce), saat sheet dibuka, setelah ekspor backup, dan setelah pengingat backup ditunda. Status koneksi tidak lagi memakai ruang header: saat offline, banner tipis muncul di bawah header.

Tombol catat cepat mengambang (FAB) membuka formulir dari halaman mana pun. Di desktop, tekan `Alt+N`; di layar utama PWA, tahan ikon aplikasi lalu pilih **Catat**. Modul yang mendukung pencatatan cepat cukup mengekspor `quickAdd(ctx)`. Saat ini modul Tugas menyediakan formulir satu baris dengan tenggat opsional, sehingga pencatatan tidak perlu menunggu membuka modul penuh.

### Build CSS

Jika mengubah kelas Tailwind di `public/`:

```bash
npm install
npm run build:css
```

File `public/styles/tailwind.css` adalah hasil build dan tidak perlu diedit manual. Tanpa langkah build, aplikasi tetap berjalan karena CSS hasil build sudah disertakan.

## Menambah modul baru

Menambah fitur **tidak memerlukan perubahan** pada `shell.js`, router, database, atau service worker. Cukup dua langkah:

### 1. Buat file modul

Contoh `js/modules/kebiasaan/index.js`:

```js
import { el } from '../../core/dom.js';

export default {
  id: 'kebiasaan',
  name: 'Kebiasaan',
  description: 'Bangun kebiasaan kecil setiap hari.',
  version: '0.1.0',
  order: 40,

  icon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12l4 4L19 6"/></svg>',

  styles: `
    .kebiasaan { display: grid; gap: 14px; }
  `,

  async mount(ctx, container) {
    const habits = ctx.data('habits');
    const items = await habits.list();

    const root = el('div', { class: 'kebiasaan' });
    root.append(el('h2', { text: `Kebiasaan: ${items.length}` }));
    container.replaceChildren(root);

    ctx.onCleanup(() => {
      container.replaceChildren();
    });
  },

  async getHomeSummary(ctx) {
    const items = await ctx.data('habits').list();
    return [{
      label: 'Kebiasaan',
      value: items.length,
      hint: 'Satu kebiasaan kecil hari ini sudah cukup.',
      tone: 'default',
    }];
  },
};
```

### 2. Daftarkan di manifest

`js/modules/modules.json`:

```json
{
  "manifestVersion": 1,
  "modules": [
    {
      "id": "tugas",
      "entry": "./tugas/index.js",
      "enabled": true
    },
    {
      "id": "kebiasaan",
      "entry": "./kebiasaan/index.js",
      "enabled": true,
      "assets": ["./kebiasaan/icon.svg"]
    }
  ]
}
```

`assets` bersifat opsional dan dipakai service worker untuk mem-precache file tambahan (gambar, font, CSS eksternal modul). CSS yang ditulis di properti `styles` otomatis disuntikkan oleh registry.

### Kontrak modul

| Properti / method | Wajib | Keterangan |
| --- | --- | --- |
| `id` | Ya | Harus sama dengan `id` di manifest. Huruf kecil, angka, tanda hubung. |
| `name` | Ya | Nama tampilan di navigasi dan beranda. |
| `mount(ctx, container)` | Ya | Merender fitur. Boleh mengembalikan fungsi teardown. |
| `description` | Tidak | Ditampilkan di kartu beranda/menu. |
| `version` | Tidak | Ditampilkan pada header modul. Default `1.0.0`. |
| `icon` | Tidak | Markup SVG tepercaya. Default ikon plus. |
| `order` | Tidak | Urutan navigasi. Default `100`. |
| `styles` | Tidak | CSS string yang di-scope secara manual oleh penulis modul. |
| `setup(ctx)` | Tidak | Dipanggil sekali saat registry dimuat. Jangan merender DOM di sini. |
| `unmount(ctx)` | Tidak | Dipanggil saat modul dilepas dari rute. |
| `getHomeSummary(ctx)` | Tidak | Mengembalikan array kartu; registry memilih satu sorotan utama per modul. |
| `quickAdd(ctx)` | Tidak | Membuka formulir catat cepat dari FAB. Gunakan `ctx.ui.form()` dan `ctx.data()`. |
| `getNotifications(ctx)` | Tidak | Mengembalikan array notifikasi live untuk pusat notifikasi. Lihat contoh di bawah. |

Registry membungkus `mount()` dengan error boundary dan batas waktu 12 detik. Jika `mount()` melempar error atau menggantung, DOM parsial dibersihkan, cleanup dijalankan, konteks di-abort, event `core:module-mount-error` dipancarkan, lalu shell menampilkan kartu error dengan tombol coba lagi. Modul tidak perlu menangani kegagalan mount-nya sendiri, tetapi tetap harus memeriksa `ctx.signal.aborted` setelah operasi async.

Contoh `quickAdd(ctx)` minimal:

```js
async quickAdd(ctx) {
  const values = await ctx.ui.form({
    title: 'Catat cepat',
    layout: 'sheet',
    fields: [{
      name: 'title',
      label: 'Apa yang perlu diingat?',
      required: true,
      autofocus: true,
      maxlength: 120,
    }],
    submitLabel: 'Simpan',
  });
  if (!values) return;

  await ctx.data('items').create({ title: values.title.trim() });
  ctx.ui.toast('Catatan disimpan.', { type: 'success' });
},
```

Shell hanya memanggil modul yang menyediakan `quickAdd()`. Jika ada lebih dari satu modul, shell menampilkan pilihan singkat; jika hanya satu, formulir langsung dibuka.

Contoh `getNotifications(ctx)` minimal:

```js
async getNotifications(ctx) {
  const items = await ctx.data('items').list();
  const overdue = items.filter((item) => !item.done && isOverdue(item));

  if (overdue.length === 0) return [];
  return [{
    id: 'items-overdue',
    icon: 'alert',                 // nama ikon internal atau markup SVG
    title: `${overdue.length} catatan lewat tenggat`,
    text: 'Buka modul untuk menindaklanjuti.',
    tone: 'danger',                // default | warning | danger
    path: '/modul/kebiasaan',      // rute tujuan saat item diklik
  }];
},
```

Registry menormalkan setiap item: `id` (fallback dibuat otomatis), `source` (nama modul), `icon` (ikon modul bila kosong), `tone` (fallback `default`), dan `path` (fallback `/modul/<id>`). Item tanpa `title` dilewati, dan kegagalan satu modul tidak menggagalkan notifikasi modul lain. Notifikasi bersifat turunan kondisi data saat ini; tidak ada status "sudah dibaca" atau penyimpanan pesan. Shell juga menambahkan pengingat backup saat ekspor sudah jatuh tempo, lalu menghitung badge dari total item.

### Konteks modul (`ctx`)

| Properti | Fungsi |
| --- | --- |
| `ctx.module` | Metadata modul (`id`, `name`, `description`, `version`). |
| `ctx.db` | Scope database milik modul. |
| `ctx.data(name)` | Pintasan `ctx.db.collection(name)`; hanya bisa mengakses koleksi modul sendiri. |
| `ctx.ui` | Dialog, form, prompt, confirm, dan toast kustom. |
| `ctx.bus` | Event bus bersama. Gunakan awalan event modul, misalnya `kebiasaan:selesai`. |
| `ctx.utils` | Utilitas tanggal, ID, format, debounce, dan unduh JSON. |
| `ctx.navigate(path)` | Navigasi hash internal. |
| `ctx.signal` | `AbortSignal` yang abort saat modul di-unmount. |
| `ctx.onCleanup(fn)` | Daftarkan pembersihan listener/timer/DOM. |
| `ctx.on(event, handler)` | Berlangganan event; otomatis dibersihkan saat unmount. |

Aturan penting:

- Gunakan `ctx.on()` dan `ctx.onCleanup()` agar tidak ada listener atau timer yang bocor.
- Cek `ctx.signal.aborted` setelah operasi async sebelum menyentuh DOM.
- Jangan menganggap modul selalu mounted; dialog bisa ditutup oleh navigasi.
- Data modul hanya boleh diakses lewat `ctx.data()`. Namespace modul lain tidak tersedia.
- Modul adalah kode tepercaya yang berjalan di origin yang sama. Jangan memuat modul dari sumber yang tidak dipercaya.

### Helper core untuk modul

Modul boleh mengimpor helper core berikut tanpa mengubah registry:

```js
import { donutChart } from '../../core/chart.js';
import { notifications } from '../../core/notifications.js';

// Grafik SVG: data pengguna tetap dirender sebagai text node.
panel.replaceChildren(donutChart(
  [{ label: 'Makanan', value: 50000 }],
  { centerLabel: 'Bulan ini', formatValue: (value) => `Rp${value}` },
));

// Izin harus diminta dari klik pengguna. Timer hanya hidup selama aplikasi terbuka.
enableButton.addEventListener('click', async () => {
  const permission = await notifications.requestPermission();
  if (permission !== 'granted') return;
  notifications.schedule({
    id: 'contoh:tenggat',
    at: new Date(Date.now() + 60_000),
    title: 'Tenggat contoh',
    body: 'Satu tugas menunggu.',
    data: { url: new URL('./#/modul/contoh', document.baseURI).href },
  });
});
```

`notifications.cancel(id)` dan `notifications.cancelAll(prefix)` tersedia untuk membersihkan jadwal. Pengingat berbasis timer tidak dijamin berjalan setelah PWA ditutup; lihat batasan di bawah.

## Latihan Soal

Modul **Latihan Soal** menerima paket soal pilihan ganda dari file JSON. Tidak ada editor soal manual: file JSON adalah sumber paket soal, sedangkan aplikasi menangani pengerjaan, penilaian, dan riwayat. Buka **Menu → Latihan Soal**, lalu pilih **Impor soal JSON**. Tombol **Unduh contoh** menyediakan file yang bisa langsung dipakai sebagai templat.

Contoh format:

```json
{
  "format": "asisten-latihan-soal",
  "formatVersion": 1,
  "title": "Latihan Matematika",
  "subject": "Matematika",
  "description": "Pecahan dan desimal.",
  "questions": [
    {
      "question": "Hasil dari 1/2 + 1/4 adalah …",
      "options": ["1/4", "1/2", "3/4", "1"],
      "answer": 2,
      "explanation": "1/2 sama dengan 2/4, jadi hasilnya 3/4."
    }
  ]
}
```

Aturan impor:

- `format` dan `formatVersion` disarankan diisi seperti contoh. Jika ada, nilainya harus dikenali aplikasi; versi format yang lebih baru ditolak.
- Satu file maksimal 2 MB, berisi 1–300 soal, dan setiap soal memiliki 2–6 pilihan.
- `title` boleh dihilangkan; nama file dipakai sebagai judul cadangan. `subject`, `description`, dan `explanation` opsional.
- `answer` dapat berupa indeks berbasis nol (`0` untuk pilihan pertama), huruf pilihan (`"C"`), atau teks pilihan yang sama persis.
- Setiap impor membuat paket baru. Menghapus paket tidak menghapus riwayat skor; riwayat dapat dibersihkan terpisah dari halaman modul.
- Skor disimpan per percobaan: jumlah benar, total soal, persentase, waktu pengerjaan, dan tanggal. Halaman menampilkan delapan riwayat terbaru.
- Semua data tetap berada di IndexedDB perangkat dan ikut dalam backup JSON aplikasi.

## Data dan backup

Tiga object store inti:

| Store | Isi |
| --- | --- |
| `records` | Seluruh dokumen data modul. |
| `settings` | Pengaturan aplikasi, termasuk nama profil. |
| `meta` | Metadata internal aplikasi. |

Kunci dokumen:

```text
_key = "<moduleId>::<collection>::<id>"
```

Contoh:

```text
tugas::tasks::0f0f07c6-7a4e-4aab-9fd5-8f6f3e21a9d0
```

Index `_scope` (`[_module, _collection]`) membuat setiap modul hanya membaca koleksinya sendiri. Menambah modul atau koleksi baru **tidak mengubah versi database**.

Backup dapat dilakukan dari **Pengaturan → Data & cadangan → Ekspor data**. File berisi:

```json
{
  "format": "asisten-pribadi-siswa-backup",
  "formatVersion": 1,
  "appVersion": "1.5.0",
  "databaseVersion": 1,
  "exportedAt": "2026-10-26T12:00:00.000Z",
  "counts": { "records": 12, "settings": 2 },
  "records": [],
  "settings": []
}
```

Impor lewat antarmuka memakai mode **merge**: catatan dengan ID yang sama ditimpa, catatan lain dipertahankan. API database juga mendukung mode `replace`, tetapi antarmuka saat ini sengaja hanya menawarkan merge agar tidak menghapus data tanpa perlu. File divalidasi sebelum transaksi; impor bersifat atomik.

Aplikasi memakai metadata `backup.lastExportAt` dan `backup.lastReminderAt` untuk mengingatkan ekspor setiap 30 hari. Pengingat bisa ditunda 7 hari dari beranda. Database kosong tidak memicu pengingat. Tombol **Minta perlindungan** memanggil `navigator.storage.persist()` setelah gestur pengguna; browser tetap bisa menolak, jadi backup JSON tetap wajib.

Penghapusan seluruh data di **Pengaturan → Hapus semua data** memakai tombol tahan ±1,5 detik, bukan mengetik kata konfirmasi. Tombol juga bisa ditahan dengan Space/Enter saat memakai keyboard.

Detail skema dan alasan desainnya ada di [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Offline & pembaruan cache

| Jenis permintaan | Strategi |
| --- | --- |
| Navigasi, HTML, JS, CSS, JSON, manifest | Network-first + revalidasi HTTP, fallback cache |
| Gambar, font, ikon | Stale-while-revalidate |
| Modul baru | Entry dan `assets` dibaca dari `modules.json`, lalu di-precache |

- Cache diberi prefix dan versi (`asisten-pribadi-siswa-static-v1.6.0`); cache versi lama dihapus saat aktivasi.
- `sw.js` mendaftar ulang dan memeriksa pembaruan saat online.
- Jika ada versi baru, aplikasi menampilkan toast **Muat ulang**; service worker menunggu hingga pengguna memilih.
- Kode memakai `cache: 'no-cache'` saat network-first, sehingga host dengan `max-age` panjang tidak membuat kode tertahan di cache HTTP lama.
- Klik notifikasi membuka atau memfokuskan jendela aplikasi pada rute tugas. Handler `notificationclick` memakai URL yang disimpan di payload notifikasi.
- Setelah deploy perubahan besar, disarankan menaikkan `CACHE_NAME` di `sw.js` agar cache offline lama dibersihkan pada aktivasi berikutnya.

## Deployment

Checklist host statis:

- Publikasikan **isi folder `public/`** sebagai root situs (publish directory: `public`).
- Sajikan melalui **HTTPS** (wajib untuk service worker di domain publik).
- Pertahankan struktur folder dan jalur relatif di dalam `public/`.
- Pastikan MIME type benar:
  - `.js` → `text/javascript`
  - `.json` → `application/json`
  - `.webmanifest` → `application/manifest+json`
- Set header `Cache-Control: no-cache` untuk `sw.js` agar pembaruan service worker cepat terdeteksi.
- Routing memakai hash (`#/modul/tugas`), jadi **tidak perlu** rewrite semua request ke `index.html`.
- Jangan menambahkan `Service-Worker-Allowed` kecuali scope diubah; scope default sudah `./`.

## Batasan yang perlu diketahui

- Data terikat pada **satu browser + satu perangkat**. Menghapus data situs, mode privat, atau pembersihan otomatis browser dapat menghapus data. Ekspor backup secara berkala dan gunakan tombol **Minta perlindungan** di Pengaturan. `navigator.storage.persist()` tidak menjamin data permanen.
- Pengingat tenggat memakai timer halaman dan notifikasi lokal. Timer hanya berjalan selama aplikasi terbuka; saat PWA ditutup, browser tidak menjamin pengingat muncul. Implementasi saat ini tidak memakai push server atau background sync.
- Notifikasi membutuhkan secure context dan izin pengguna. Jika izin diblokir, pengingat tidak dijadwalkan dan UI menampilkan statusnya.
- Belum ada sinkronisasi cloud atau multi-perangkat.
- Modul berjalan dengan kepercayaan penuh di origin aplikasi. Hanya pasang modul yang kamu tulis atau percayai.
- Aplikasi membutuhkan browser modern (ES modules, IndexedDB, service worker, `inert`, `:has`).
- Service worker dan PWA tidak aktif saat halaman dibuka melalui `file://`.

## Validasi yang sudah dilakukan

- Pemeriksaan sintaks seluruh file JavaScript dan service worker dengan Node.js.
- Pengujian IndexedDB dengan `fake-indexeddb`: CRUD, isolasi modul/koleksi, pengurutan, pengaturan, meta, ekspor/impor merge & replace, validasi backup, atomisitas impor, `countRecords()`, dan persistensi setelah koneksi ditutup.
- Uji integrasi DOM dengan jsdom: boot aplikasi, navigasi modul, catat cepat dari FAB dan pintasan `Alt+N`, tambah/edit/centang/hapus/undo tugas, filter, form kustom, validasi, toast, prompt profil, skip-link, fokus dialog, pengingat tugas, dompet dan transaksi keuangan, transfer, laporan, grafik, serta pemulihan data dari IndexedDB.
- Uji fitur core: donut/bar chart dan sanitasi label, error boundary `mount()` termasuk timeout dan cleanup, pengingat backup 30/7 hari, serta penjadwalan notifikasi.
- Uji navigasi shell: 3 tab tetap (Beranda, Menu, Pengaturan), tab Menu aktif pada rute modul, tombol kembali hanya pada rute dalam, pencarian nama/deskripsi modul (termasuk empty state, Enter membuka hasil pertama, dan query yang dipertahankan), pusat notifikasi live dengan badge yang mengikuti perubahan data, serta banner offline di bawah header.
- Uji tema terang/gelap: pilihan Sistem/Terang/Gelap tersimpan, mengikuti perubahan tema perangkat pada mode Sistem, dan diterapkan tanpa kedipan saat boot.
- Uji modul Latihan Soal: impor JSON valid, penolakan JSON rusak/format jawaban tidak valid, pengerjaan pilihan ganda dengan umpan balik, skor 3/4 = 75%, penyimpanan riwayat setelah muat ulang, ringkasan beranda, pengacakan soal/pilihan tiap percobaan, penghapusan paket tanpa menghapus riwayat, dan tampilan responsif di tema terang/gelap.
- Uji browser (Playwright/Chromium) pada viewport mobile: smoke 7 rute tanpa error, form Keuangan bertombol pilihan dengan tanggal di bawah, input nominal ribuan dan saldo awal dompet, transfer dengan dompet tujuan kondisional, laporan per dompet, Beranda maksimal dua kartu inti, Menu grid dua kolom, tombol hapus tahan ketuk (pointer dan keyboard), serta mode offline dengan cache `static-v1.6.0`.
- Harness service worker: instalasi precache, pembersihan cache lama, network-first online/offline, fallback navigasi, halaman darurat, stale-while-revalidate, pesan cache aset, `notificationclick`, dan `SKIP_WAITING`.
- Pemeriksaan seluruh aset yang direferensikan HTML, manifest, dan service worker melalui server HTTP lokal (semua merespons 200).
- Validasi sintaks CSS dengan PostCSS.

Pengujian tersebut bukan pengganti uji perangkat nyata. Sebelum dipakai sehari-hari, lakukan smoke test di browser target: muat online, pasang PWA, muat ulang offline, tambah tugas, ekspor, impor, dan coba pembaruan versi.
