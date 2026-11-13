<div align="center">

```text
+-------------------------------------------------------------------------+
|                                                                         |
|   ██╗   ██╗██╗███████╗██╗ ██████╗ ███████╗████████╗ ██████╗  ██████╗    |
|   ██║   ██║██║██╔════╝██║██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝    |
|   ██║   ██║██║███████╗██║██║   ██║███████╗   ██║   ██║   ██║██║         |
|   ╚██╗ ██╔╝██║╚════██║██║██║   ██║╚════██║   ██║   ██║   ██║██║         |
|    ╚████╔╝ ██║███████║██║╚██████╔╝███████║   ██║   ╚██████╔╝╚██████╗    |
|     ╚═══╝  ╚═╝╚══════╝╚═╝ ╚═════╝ ╚══════╝   ╚═╝    ╚═════╝  ╚═════╝    |
|                                                                         |
|          LOCAL VISION & INVENTORY  //  bercode-app.vercel.app           |
+-------------------------------------------------------------------------+
```

**Pemindaian barcode 1D/2D real-time berbasis Region of Interest (ROI) 2-Pass dan rendering `<canvas>` lokal tanpa ketergantungan gambar eksternal.**

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-bercode--app.vercel.app-5B5BD6?style=for-the-badge&logo=vercel&logoColor=white)](https://bercode-app.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-App_Router-1E1F29?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-5B5BD6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Adaptive_UI-181920?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)](https://tailwindcss.com/)
[![Vision Engine](https://img.shields.io/badge/Vision-BarcodeDetector_%2B_WASM-10B981?style=for-the-badge)](#arsitektur-pipeline)

[Live App](https://bercode-app.vercel.app) &bull; [Arsitektur Pipeline](#arsitektur-pipeline) &bull; [Spesifikasi Modul](#spesifikasi-modul) &bull; [Instalasi Lokal](#instalasi-lokal)

</div>

---

## Sistem Desain & Palet Warna

Antarmuka **VISIOSTOCK** dirancang menggunakan kontras tinggi antara permukaan kerja terang, panel *viewport* kamera gelap, dan kartu telemetri *indigo* untuk keterbacaan optimal di berbagai kondisi pencahayaan gudang maupun ruang kelas.

| Peran Visual | Token Warna | Kode Hex | Implementasi Komponen |
| :--- | :--- | :--- | :--- |
| **Canvas Utama** | Soft Cool Gray | `#F6F7F9` | Latar belakang utama aplikasi dan kartu katalog |
| **Viewport & Navigasi** | Deep Charcoal | `#1E1F29` | Panel *viewport* kamera, pil navigasi mengambang, dan tombol aksi |
| **Aksen & Telemetri** | Electric Indigo | `#5B5BD6` | Kartu inspeksi detail produk, indikator tab aktif, dan tombol kamera |
| **Teks Utama** | Obsidian Ink | `#181920` | Tipografi judul, nilai metrik, dan kode barcode |
| **Status Terkunci** | Emerald Signal | `#10B981` | Kotak pembatas (*bounding box*) saat 2 *frame* terverifikasi |

---

## Arsitektur Pipeline

Aplikasi memproses *stream* kamera secara lokal di *client-side* dengan memangkas area bidik (ROI) sebelum melakukan dekode untuk menekan latensi inferensi di bawah `10 ms` per *frame*.

```text
[ MediaStream 1280x720 (Continuous Focus) ]
                     |
                     v
+-----------------------------------------+
|  1. ROI CROP & DOWNSCALE                |  --> Memotong 75% W x 55% H area tengah
|     Target Max Width: 640px             |      Memangkas beban piksel main-thread
+-----------------------------------------+
                     |
                     v
+-----------------------------------------+
|  2. HYBRID VISION DECODER               |  --> Native BarcodeDetector (ML Kit)
|     barcode-detector/ponyfill           |      Fallback otomatis ke WASM Polyfill
+-----------------------------------------+
                     |
                     v
+-----------------------------------------+
|  3. 2-PASS TEMPORAL LOCK                |  --> Wajib 2 frame berturut-turut identik
|     Frame-1: Amber (#F59E0B)            |      Mengunci koordinat bounding box
|     Frame-2: Emerald (#10B981)          |      Mencegah false-read pantulan layar
+-----------------------------------------+
                     |
                     v
[ Lookup Database & Kartu Telemetri #5B5BD6 ]
```

---

## Spesifikasi Modul

| Modul | Mekanisme Teknis | Perilaku Sistem |
| :--- | :--- | :--- |
| **Optical Scanner** | `getUserMedia` + `ROI 2-Pass` | Memprioritaskan kamera belakang (`environment`) dengan *overlay bounding box* real-time dan penguncian otomatis setelah 2 *frame* identik terbaca. |
| **Scan Profiles** | Filter simbologi aktif per sesi | Memisahkan pemindaian **Barcode 1D** (`EAN-13`, `Code-128`, `UPC-A`, `EAN-8`), **QR Code**, atau **Semua Format** untuk mempercepat proses deteksi. |
| **Canvas Generator** | `bwip-js/browser` + Modulo-10 | Merender barcode ke elemen `<canvas>` berlatar putih bersih (`#FFFFFF`) lengkap dengan validasi *check digit* EAN-13 otomatis dan unduhan PNG. |
| **Adaptive Catalog** | Mobile 2-Col Grid / Desktop Table | Menyajikan 15 item data inventaris uji dengan *sticky header* di seluler, paginasi bertahap (10 item per halaman), serta efek *fade mask* pada daftar kode. |

---

## Validasi Simbologi & Fallback

Untuk mencegah kegagalan *render* (`bwipp.ean13badCheckDigit`) pada kode aset internal yang mengandung huruf atau tanda hubung, komponen `<BarcodeCanvas />` menjalankan pengecekan otomatis sebelum memanggil `bwipjs.toCanvas`:

```text
Input String ──> Cek Regex /^\d{13}$/ ──> Hitung Check Digit Modulo-10
                       |                                |
                    [Tidak]                          [Tidak Cocok]
                       |                                |
                       +---------------+----------------+
                                       |
                                       v
                         Fallback otomatis ke CODE-128
```

* **EAN-13 (`ean13`):** Diterapkan otomatis untuk kode produk retail 13 digit dengan *check digit* valid (contoh: `8992761136014`).
* **Code-128 (`code128`):** Diterapkan untuk kode inventaris IT, komponen lab, dan ATK (contoh: `INV-2026-001`, `LAB-ESP-32`).
* **QR Code (`qrcode`):** Matriks 2D untuk payload teks panjang maupun tautan langsung.

---

## Struktur Direktori

```text
visiostock/
├── app/
│   ├── globals.css          # Konfigurasi Tailwind CSS & utilitas antarmuka
│   ├── layout.tsx           # Root layout & metadata aplikasi
│   └── page.tsx             # Core engine: Scanner ROI, Generator Canvas, Katalog & Panduan
├── public/                  # Aset statis
├── package.json             # Dependensi: barcode-detector, bwip-js, lucide-react
└── tsconfig.json            # Konfigurasi TypeScript
```

---

## Instalasi Lokal

```bash
# 1. Kloning repositori
git clone https://github.com/hananchaliq/visiostock.git
cd visiostock

# 2. Pasang dependensi
npm install

# 3. Jalankan server pengembangan
npm run dev
```

Buka `http://localhost:3000` di browser untuk menjalankan aplikasi secara lokal, atau kunjungi versi produksi di **[bercode-app.vercel.app](https://bercode-app.vercel.app)**.

> **Catatan Konteks Keamanan:** Browser modern membatasi API `navigator.mediaDevices.getUserMedia` hanya pada protokol **HTTPS** atau `localhost`. Gunakan deployment HTTPS seperti Vercel saat menguji pemindaian kamera melalui perangkat seluler.