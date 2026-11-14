# XAU Sentinel

Dashboard pribadi untuk memantau XAUUSD di sekitar rilis data ekonomi AS (CPI, NFP, PPI, FOMC) dan berita mendadak. Dibuat dengan Next.js 16 (App Router), React 19, Tailwind CSS 4, dan TypeScript. Frontend dan backend berada dalam satu proyek, jadi cukup satu kali deploy ke Vercel.

> Ini alat riset untuk diuji di akun demo. Sinyalnya dihitung dengan aturan sederhana dan bisa salah. Ini bukan nasihat keuangan.

## Yang sudah dan belum diuji

Supaya ekspektasinya tepat:

- **Sudah diuji:** proyek lolos `npm run build` dan `npm run lint`; semua parser (harga, kalender, BLS, RSS) diuji dengan respons tiruan berformat sama dengan aslinya; tampilan dicek di layar desktop dan ponsel; kondisi semua sumber gagal menampilkan pesan yang jelas.
- **Belum diuji dari sisi pembuat:** koneksi langsung ke penyedia data. Lingkungan tempat proyek ini dibuat tidak bisa mengakses internet umum. Saat pertama kali menjalankan, buka panel **Status sumber data** di bagian bawah. Titik hijau berarti sumber itu berjalan; titik merah disertai penyebabnya. Lihat bagian [Pemecahan masalah](#pemecahan-masalah).

## Daftar isi

1. [Cara membaca dashboard](#cara-membaca-dashboard)
2. [Cara kerja sinyal](#cara-kerja-sinyal)
3. [Sumber data dan batasnya](#sumber-data-dan-batasnya)
4. [Menjalankan di komputer sendiri](#menjalankan-di-komputer-sendiri)
5. [Push ke GitHub](#push-ke-github)
6. [Deploy ke Vercel](#deploy-ke-vercel)
7. [Menyetel aturan](#menyetel-aturan)
8. [Cara menguji di akun demo](#cara-menguji-di-akun-demo)
9. [Pemecahan masalah](#pemecahan-masalah)
10. [Struktur proyek](#struktur-proyek)
11. [Batasan dan langkah berikutnya](#batasan-dan-langkah-berikutnya)

## Cara membaca dashboard

Dari atas ke bawah:

**Bilah atas.** Harga terakhir, perubahan 24 jam, bid, ask, spread, dan dua label sumber.

Label pertama menunjukkan **harga langsung**: kutipan spot XAU/USD yang diambil setiap 2,5 detik. Bila tertulis "Harga langsung tidak aktif", sumber kutipan gagal atau pasar sedang tutup, dan grafik hanya bergerak saat data candle diperbarui.

Label kedua menunjukkan **sumber candle** (riwayat harga di grafik):

| Label | Artinya |
| --- | --- |
| Candle XAU/USD spot, Twelve Data (hijau) | Riwayat harga spot. Ini yang paling akurat. |
| Candle futures GC=F digeser ke spot (emas) | Twelve Data gagal, jadi riwayat diambil dari kontrak berjangka Yahoo lalu digeser dengan selisih tetap supaya harga terakhirnya sama dengan spot. Bentuk grafik dan indikator tetap benar, tetapi level harga lama hanya perkiraan. |
| Data simulasi (merah) | Semua sumber gagal. Grafik berisi data buatan dan sinyal tidak berarti apa-apa. |

**Rilis berikutnya.** Hitung mundur ke rilis USD berdampak tinggi terdekat, beserta angka perkiraan dan angka sebelumnya. Garis waktu di sebelahnya menunjukkan semua agenda minggu ini: garis emas untuk dampak tinggi, garis biru untuk dampak sedang, belah ketupat putih untuk posisi sekarang.

**Grafik harga.** Candlestick dengan pilihan timeframe M5, M15, H1, H4, D1. Tombol EMA menampilkan EMA 20 (emas), 50 (biru), 200 (putih). Tombol Bollinger menampilkan pita atas dan bawah. Titik emas di atas candle menandai rilis berdampak tinggi yang sudah lewat. Saat sinyal menunjukkan arah, garis putus-putus SL, TP1, TP2 ikut muncul. Panel kecil di bawah grafik adalah RSI 14 dengan garis batas 70 dan 30. Candle terakhir bergerak mengikuti harga langsung, dan candle baru terbuka sendiri saat waktunya berganti. Jam di sumbu bawah mengikuti zona waktu browser.

**Sinyal gabungan.** Tiga cincin, dari luar ke dalam: teknikal, rilis data, arus berita. Busur ke kanan (hijau) berarti faktor itu mendukung beli, ke kiri (merah) mendukung jual. Di tengah ada keputusan (BELI, JUAL, atau TUNGGU) dan skor gabungan dari −100 sampai +100. Di bawahnya ada rincian skor, bobot tiap faktor, dan level acuan, stop, serta target.

**Analisis teknikal.** Enam pembacaan indikator untuk timeframe yang sedang dipilih. Titik hijau berarti mendukung naik, merah mendukung turun, abu-abu netral.

**Analisis fundamental.** Tiga bagian:

- *Skenario dan hasil rilis.* Pilih sebuah rilis, lihat apa yang secara teori terjadi pada emas bila angkanya di atas atau di bawah perkiraan. Begitu angka aktual keluar, ketik angkanya lalu tekan **Pakai hasil ini**. Skor rilis langsung masuk ke sinyal gabungan dan berlaku 4 jam.
- *Agenda USD minggu ini.* Daftar rilis berdampak tinggi dan sedang.
- *Angka resmi terakhir dari BLS.* CPI, Core CPI, NFP, pengangguran, PPI, dan upah langsung dari sumber resminya. Tombol **Isi dengan angka ini** menyalin angka BLS ke kolom aktual. Periksa dulu periodenya, karena BLS bisa terlambat beberapa menit dari jam rilis.

**Berita mendadak.** Kotak status di atas punya tiga tingkat: Tenang, Pantau, Siaga. Daftar di bawahnya berisi judul berita dengan skor: positif mendukung emas, negatif menekan emas. Klik judul untuk membuka artikel aslinya.

**Jurnal sinyal.** Dengan **Catat otomatis: nyala** (bawaan), setiap kali sinyal menunjukkan BELI atau JUAL, level-levelnya langsung tercatat. Catatan baru tidak dibuat selama masih ada catatan searah yang terbuka, dan ada jeda 15 menit setelah sebuah catatan selesai. Tombol **Catat ke jurnal** tetap ada untuk mencatat manual. Hasilnya dicek sendiri: mana yang tersentuh lebih dulu, target 1 atau stop. Bisa diunduh sebagai CSV.

Dua hal yang perlu diketahui: pencatatan otomatis hanya berjalan selama halaman ini terbuka di browser, dan jurnal tersimpan di browser (localStorage), jadi tidak ikut pindah ke perangkat lain. Pencatatan otomatis tidak berjalan pada data simulasi.

**Status sumber data.** Kondisi tiap sumber, dengan pesan kesalahan bila gagal.

## Cara kerja sinyal

Semua aturan ada di kode dan bisa kamu ubah. Tidak ada model tersembunyi.

**Skor teknikal** (`lib/technical.ts`). Enam pembacaan, masing-masing bernilai −1, 0, atau +1, lalu dirata-rata dan dikali 100:

| Pembacaan | +1 bila | −1 bila |
| --- | --- | --- |
| EMA 20 vs 50 | EMA 20 di atas | EMA 20 di bawah |
| EMA 50 vs 200 | EMA 50 di atas | EMA 50 di bawah |
| Harga vs EMA 50 | harga di atas | harga di bawah |
| RSI 14 | 55 sampai 70 | 30 sampai 45 |
| MACD | histogram positif dan membesar | histogram negatif dan membesar |
| Bollinger | harga di sepertiga atas pita | harga di sepertiga bawah pita |

RSI di atas 70 atau di bawah 30 dihitung netral, karena bisa berarti momentum kuat maupun rawan berbalik.

**Skor rilis** (`lib/fundamentals.ts`). Selisih aktual dengan perkiraan dibagi ambang tiap indikator, lalu dikali arah. Contoh: CPI m/m punya ambang 0,1 poin dan arah negatif, jadi aktual 0,5% dengan perkiraan 0,3% menghasilkan skor −100 (menekan emas). Pengangguran arahnya positif: naik di atas perkiraan mendukung emas.

**Skor berita** (`lib/news-score.ts` dan `lib/signal.ts`). Tiap judul dicocokkan dengan kamus kata kunci. Skor judul meluruh dengan waktu paruh 45 menit, lalu dijumlah menjadi tekanan berita.

**Status berita mendadak:**

- **Siaga** bila tekanan berita minimal 6 dan didukung minimal 2 sumber berbeda, atau tekanan minimal 4 dan harga bergerak minimal 2× ATR ke arah yang sama.
- **Pantau** bila tekanan minimal 3, atau harga bergerak minimal 2× ATR tanpa berita yang terdeteksi.
- **Tenang** selain itu.

**Skor gabungan.** Bobotnya berubah menurut keadaan:

| Keadaan | Teknikal | Rilis | Berita |
| --- | --- | --- | --- |
| Biasa | 60% | 0% | 40% |
| Ada hasil rilis yang dimasukkan | 30% | 45% | 25% |
| Berita siaga | 40% | 0% | 60% |
| Berita siaga dan ada hasil rilis | 25% | 30% | 45% |

Skor minimal +35 menghasilkan BELI, maksimal −35 menghasilkan JUAL, di antaranya TUNGGU. Dalam 30 menit sebelum rilis berdampak tinggi, keputusan dipaksa TUNGGU sampai kamu memasukkan angka aktual.

**Level.** Stop berjarak 1,5× ATR dari harga acuan, target 1 berjarak 1,5× ATR, target 2 berjarak 3× ATR. ATR diambil dari timeframe yang sedang dipilih, jadi level di M5 jauh lebih sempit daripada di H1.

**Kelemahan yang perlu kamu tahu:**

- Kamus kata kunci tidak memahami konteks. Judul "film perang terbaru" pun bisa ikut terhitung.
- Aturan arah rilis adalah aturan buku teks. Reaksi pasar nyata sering berbalik, terutama bila pasar sudah mengantisipasi.
- Sinyal tidak memperhitungkan spread dan slippage, yang justru membesar saat rilis.
- Angka aktual dimasukkan manual, jadi kecepatanmu ikut menentukan.

## Sumber data dan batasnya

| Data | Sumber | Kunci | Batas |
| --- | --- | --- | --- |
| Harga XAU/USD spot | Twelve Data | Perlu, gratis | 8 permintaan per menit, 800 per hari |
| Candle cadangan | Yahoo Finance, GC=F | Tidak | Tidak resmi, bisa diblokir kapan saja |
| Harga langsung (bid/ask) | Kutipan publik Swissquote, cadangan gold-api.com | Tidak | Tidak resmi, tanpa jaminan ketersediaan |
| Jadwal dan perkiraan | Ekspor mingguan Forex Factory | Tidak | Hanya minggu berjalan, akses dibatasi ketat |
| Angka resmi | API publik BLS | Opsional | 25 per hari tanpa kunci, 500 dengan kunci |
| Berita | RSS: Google News, Federal Reserve, CNBC, BBC, Al Jazeera | Tidak | Hanya judul dan tautan |

Server menyimpan hasil sementara (cache) supaya kuota tidak habis: candle M5 ditahan 2 menit, kalender 30 menit, berita 90 detik, harga langsung 2 detik. Jadi candle terakhir dan harga di bilah atas tertinggal beberapa detik dari pasar, sedangkan candle-candle sebelumnya diperbarui tiap beberapa menit.

Ini bukan aliran tick seperti di platform broker. Harga dari penyedia kutipan juga bisa berbeda sedikit dari harga brokermu. Untuk eksekusi, selalu pakai harga di platform broker.

Aplikasi hanya menampilkan judul berita dan tautan ke sumbernya, tidak menyalin isi artikel.

## Menjalankan di komputer sendiri

Yang dibutuhkan: Node.js versi 20.9 atau lebih baru, dan Git.

```bash
# 1. Masuk ke folder proyek
cd xau-sentinel

# 2. Pasang dependensi
npm install

# 3. Buat file konfigurasi lokal
cp .env.example .env.local
```

Buka `.env.local` dan isi kuncinya:

```
TWELVEDATA_API_KEY=kunci_dari_twelvedata
BLS_API_KEY=kunci_dari_bls_boleh_kosong
```

Cara mendapat kunci:

- **Twelve Data:** daftar di https://twelvedata.com/register, lalu salin API key dari halaman dashboard. Paket gratis sudah cukup.
- **BLS (opsional):** daftar di https://data.bls.gov/registrationEngine/. Kunci dikirim lewat email.

Lalu jalankan:

```bash
npm run dev
```

Buka http://localhost:3000. Perintah lain yang berguna:

```bash
npm run build   # build produksi, sama seperti yang dijalankan Vercel
npm run start   # menjalankan hasil build
npm run lint    # memeriksa kode
```

Di Windows, ganti `cp .env.example .env.local` dengan `copy .env.example .env.local`.

## Push ke GitHub

1. Buka https://github.com/new dan buat repository baru, misalnya `xau-sentinel`. Pilih **Private** bila tidak ingin kodenya terlihat publik. Jangan centang "Add a README", karena proyek ini sudah punya.

2. Di folder proyek, jalankan:

```bash
git init
git add .
git commit -m "XAU Sentinel versi pertama"
git branch -M main
git remote add origin https://github.com/NAMA_AKUN_KAMU/xau-sentinel.git
git push -u origin main
```

Ganti `NAMA_AKUN_KAMU` dengan nama akun GitHub-mu. Bila diminta login, GitHub tidak lagi menerima kata sandi akun untuk Git; gunakan personal access token atau login lewat GitHub CLI (`gh auth login`).

3. Pastikan `.env.local` **tidak** ikut ter-upload. File itu sudah dicantumkan di `.gitignore`. Cek dengan `git status` sebelum commit: nama `.env.local` tidak boleh muncul.

Untuk perubahan berikutnya:

```bash
git add .
git commit -m "jelaskan perubahannya"
git push
```

## Deploy ke Vercel

1. Buka https://vercel.com dan login dengan akun GitHub.
2. Pilih **Add New**, lalu **Project**.
3. Pilih repository `xau-sentinel`, lalu **Import**. Bila repository tidak muncul, beri Vercel izin akses ke repository itu lewat tautan pengaturan GitHub App yang ditampilkan.
4. Vercel mengenali Next.js secara otomatis. Biarkan pengaturan build apa adanya.
5. Buka bagian **Environment Variables** dan tambahkan:
   - `TWELVEDATA_API_KEY` dengan kunci Twelve Data
   - `BLS_API_KEY` dengan kunci BLS (boleh dilewati)
6. Tekan **Deploy**. Setelah selesai, kamu mendapat alamat seperti `https://xau-sentinel-xxxx.vercel.app`.

Setelah itu, setiap `git push` ke branch `main` otomatis memicu deploy baru.

Hal yang perlu diperhatikan:

- **Mengubah environment variable tidak langsung berlaku.** Setelah menambah atau mengganti kunci di Settings, buka tab Deployments dan pilih **Redeploy** pada deployment terakhir.
- **Alamat Vercel bisa dibuka siapa saja yang tahu tautannya.** Aplikasi ini tidak punya login. Kunci API tetap aman karena hanya dipakai di server, tetapi orang lain yang membuka halaman ikut memakai kuotamu. Untuk membatasi, aktifkan Deployment Protection di Settings proyek Vercel.
- **Paket Hobby Vercel ditujukan untuk pemakaian pribadi non-komersial.** Cocok untuk tahap riset ini.

## Menyetel aturan

Hampir semua yang ingin kamu ubah saat riset ada di tiga file:

| File | Isinya |
| --- | --- |
| `lib/config.ts` | Ambang sinyal, kelipatan ATR untuk stop dan target, waktu paruh berita, daftar feed RSS, lama cache |
| `lib/news-score.ts` | Kamus kata kunci berita beserta arah dan bobotnya |
| `lib/fundamentals.ts` | Aturan arah dan ambang kejutan tiap rilis data |

Contoh: untuk membuat sinyal lebih jarang muncul, naikkan `entryThreshold` di `lib/config.ts` dari 35 ke 50. Untuk menambah sumber berita, tambahkan satu baris ke `FEEDS` di file yang sama.

Bobot skor gabungan ada di fungsi `composeSignal` dalam `lib/signal.ts`.

## Cara menguji di akun demo

Saran alur supaya hasilnya bisa dinilai:

1. Tentukan satu timeframe untuk pengujian (misalnya M15) dan jangan diubah-ubah, karena level stop dan target bergantung padanya.
2. Biarkan halaman terbuka dengan Catat otomatis menyala dan notifikasi dinyalakan. Setiap kali catatan baru muncul di jurnal, buka posisi yang sama di akun demo dengan stop dan target yang sama.
3. Catat di akun demo harga eksekusi yang sebenarnya. Bandingkan dengan harga acuan di jurnal: selisihnya adalah biaya spread dan slippage yang tidak terlihat di dashboard.
4. Pisahkan hasil menurut kolom mode di CSV (teknikal, rilis, breaking). Ketiganya adalah strategi berbeda dan bisa saja hanya satu yang layak.
5. Kumpulkan minimal beberapa puluh sinyal per mode sebelum menyimpulkan. Rilis berdampak tinggi hanya terjadi beberapa kali sebulan, jadi mode rilis butuh waktu berbulan-bulan.

Kolom hasil di jurnal memakai candle dari sumber harga yang sama saat sinyal dicatat. Bila target dan stop tersentuh di candle yang sama, hasilnya dihitung sebagai stop.

## Pemecahan masalah

**Label harga menunjukkan "Data simulasi".**
Twelve Data dan Yahoo sama-sama gagal. Buka Status sumber data dan baca pesannya:

- `TWELVEDATA_API_KEY belum diisi`: kunci belum ada di `.env.local` (lokal) atau di Environment Variables (Vercel). Di Vercel, jangan lupa Redeploy.
- `HTTP 401` atau pesan soal apikey: Twelve Data menolak kuncinya. Buka https://twelvedata.com/account/api-keys, salin ulang kuncinya, dan tulis di `.env.local` sebagai `TWELVEDATA_API_KEY=kunci` tanpa spasi dan tanpa tanda kutip. Pastikan nama filenya persis `.env.local` dan letaknya di folder utama proyek (sejajar `package.json`), lalu hentikan dan jalankan ulang `npm run dev`, karena file env hanya dibaca saat server dinyalakan.
- Pesan soal kredit habis: kuota 800 per hari tercapai. Kuota pulih keesokan harinya. Kurangi jumlah tab yang terbuka atau naikkan `ttlMs` di `lib/config.ts`.
- Pesan bahwa simbol tidak tersedia di paketmu: cek di dashboard Twelve Data apakah XAU/USD termasuk paketmu. Bila tidak, aplikasi tetap berjalan dengan data Yahoo.

**Label harga langsung tertulis "tidak aktif".**
Lihat kelompok Harga langsung di Status sumber data. Bila kedua sumber merah, penyedia kutipan menolak permintaan dari servermu. Bila hijau tetapi tetap tidak aktif, kutipannya lebih tua dari 10 menit, yang berarti pasar sedang tutup.

**Yahoo Finance gagal (HTTP 401, 403, atau 429).**
Yahoo tidak menyediakan API resmi dan sering menolak permintaan dari server cloud. Ini wajar; andalkan Twelve Data.

**Kalender ekonomi gagal (HTTP 429).**
Feed kalender membatasi akses dengan ketat. Tunggu beberapa menit. Jangan turunkan `CALENDAR_TTL_MS`. Selama pengembangan, menyalakan ulang `npm run dev` berulang kali mengosongkan cache dan bisa memicu batas ini.

**BLS gagal atau menolak permintaan.**
Tanpa kunci, batasnya 25 permintaan per hari. Daftarkan kunci gratis dan isi `BLS_API_KEY`. Panel lain tetap berjalan tanpa BLS.

**Sebagian feed berita merah.**
Beberapa situs menolak permintaan dari server tertentu atau mengganti alamat RSS-nya. Feed lain tidak terpengaruh. Hapus atau ganti alamat feed yang bermasalah di `FEEDS` dalam `lib/config.ts`.

**Notifikasi tidak muncul.**
Browser harus memberi izin notifikasi untuk situs ini, dan halaman harus tetap terbuka. Peringatan hanya dikirim saat status berubah (misalnya dari Pantau ke Siaga), bukan terus-menerus.

**Grafik kosong di akhir pekan.**
Pasar emas tutup dari Jumat malam sampai Minggu malam waktu New York. Grafik menampilkan candle terakhir dan bilah atas menampilkan keterangan pasar tutup.

**Di Vercel data terasa lambat diperbarui.**
Respons API ditahan CDN Vercel selama 30 sampai 120 detik untuk menghemat kuota. Angkanya ada di header `Cache-Control` pada file `app/api/*/route.ts`.

## Struktur proyek

```
app/
  layout.tsx            kerangka halaman dan font
  page.tsx              halaman utama
  globals.css           token warna dan gaya
  api/market/route.ts   API harga
  api/calendar/route.ts API kalender dan angka resmi
  api/news/route.ts     API berita
  api/tick/route.ts     API harga langsung (bid/ask)
components/
  Dashboard.tsx         pengatur data dan tata letak
  TopBar.tsx            harga, sumber, jam dunia
  EventHorizon.tsx      hitung mundur dan garis waktu rilis
  PriceChart.tsx        grafik candlestick
  SignalCore.tsx        cincin sinyal gabungan
  TechnicalPanel.tsx    pembacaan indikator
  FundamentalPanel.tsx  skenario, hasil rilis, agenda, angka BLS
  NewsPanel.tsx         status dan daftar berita
  JournalPanel.tsx      jurnal sinyal
  StatusPanel.tsx       kondisi sumber data
lib/
  config.ts             semua ambang dan daftar feed
  indicators.ts         EMA, RSI, MACD, ATR, Bollinger
  technical.ts          skor teknikal
  fundamentals.ts       aturan rilis dan hitungan kejutan
  news-score.ts         kamus kata kunci berita
  signal.ts             tekanan berita, anomali harga, sinyal gabungan
  journal.ts            evaluasi, aturan catat otomatis, dan ekspor jurnal
  live.ts               penyatuan harga langsung ke candle terakhir
  cache.ts              cache memori di server
  providers/            pengambil data harga, kalender, berita
```

## Batasan dan langkah berikutnya

- **Peringatan dan jurnal otomatis hanya bekerja selama halaman terbuka.** Vercel tidak menjalankan proses latar belakang terus-menerus. Untuk peringatan saat browser tertutup, langkah berikutnya adalah membuat endpoint pemeriksa yang dipanggil penjadwal eksternal dan mengirim pesan ke Telegram.
- **Angka aktual dimasukkan manual.** Sumber angka aktual yang cepat dan terstruktur umumnya berbayar.
- **Penilaian berita berbasis kata kunci.** Peningkatan yang paling terasa adalah mengganti kamus dengan klasifikasi oleh model bahasa, supaya konteks judul ikut dipahami.
- **Jurnal tersimpan di browser.** Untuk riwayat lintas perangkat, perlu database.
- **Kalender hanya mencakup minggu berjalan.**

Grafik dibuat dengan TradingView Lightweight Charts (lisensi Apache 2.0); logo kecil di pojok grafik adalah atribusi yang diminta lisensinya.
