"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { Camera, CameraOff, ScanBarcode, RotateCcw, CheckCircle2, AlertCircle, Package, Cpu, Clock, Layers, BookOpen, ArrowUpRight, Search } from "lucide-react";

interface ProductItem {
   barcode: string;
   name: string;
   category: string;
   stock: number;
   price: number;
   notes: string;
   updatedAt: string;
}

interface ScanTelemetry {
   rawValue: string;
   format: string;
   inferenceMs: string;
   box: { x: number; y: number; width: number; height: number };
   source: "CAMERA" | "SIMULATION";
}

const DUMMY_DATABASE: Record<string, ProductItem> = {
   "8992761136014": {
      barcode: "8992761136014",
      name: "Air Mineral Botol 600ml",
      category: "Minuman",
      stock: 48,
      price: 4000,
      notes: "Stok aman di rak utama gudang A.",
      updatedAt: "Hari ini, 08:30",
   },
   "8998866200578": {
      barcode: "8998866200578",
      name: "Kopi Instan Hitam Sachet",
      category: "Kopi & Teh",
      stock: 4,
      price: 2500,
      notes: "Stok menipis, segera lakukan restock.",
      updatedAt: "Kemarin, 16:15",
   },
   "INV-2026-001": {
      barcode: "INV-2026-001",
      name: "Router Wi-Fi 6 Enterprise",
      category: "Perangkat Jaringan",
      stock: 12,
      price: 1450000,
      notes: "Aset inventaris IT - Garansi aktif hingga 2028.",
      updatedAt: "12 Nov 2026",
   },
   "LAB-CV-99": {
      barcode: "LAB-CV-99",
      name: "Modul Sensor Kamera OV2640",
      category: "Komponen IoT",
      stock: 0,
      price: 85000,
      notes: "Stok habis. Cek supplier komponen elektronik.",
      updatedAt: "10 Nov 2026",
   },
};

type ActiveTab = "scanner" | "catalog" | "guide";

export default function BarcodeCVLab() {
   const videoRef = useRef<HTMLVideoElement | null>(null);
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const timerRef = useRef<NodeJS.Timeout | null>(null);
   const isLockedRef = useRef<boolean>(false);
   const streamRef = useRef<MediaStream | null>(null);

   const [activeTab, setActiveTab] = useState<ActiveTab>("scanner");
   const [engineMode, setEngineMode] = useState<string>("Memeriksa...");
   const [isScanning, setIsScanning] = useState<boolean>(false);
   const [isLocked, setIsLocked] = useState<boolean>(false);
   const [telemetry, setTelemetry] = useState<ScanTelemetry | null>(null);
   const [matchedProduct, setMatchedProduct] = useState<ProductItem | null>(null);
   const [errorMsg, setErrorMsg] = useState<string>("");
   const [searchQuery, setSearchQuery] = useState<string>("");

   useEffect(() => {
      const hasNative = typeof window !== "undefined" && "BarcodeDetector" in window;
      setEngineMode(hasNative ? "Native ML Kit" : "WASM Polyfill");

      return () => {
         stopCamera();
      };
   }, []);

   const lookupDatabase = (code: string) => {
      const found = DUMMY_DATABASE[code] || null;
      setMatchedProduct(found);
   };

   const simulateScan = (code: string) => {
      isLockedRef.current = true;
      setIsLocked(true);
      setActiveTab("scanner");
      setTelemetry({
         rawValue: code,
         format: code.startsWith("899") ? "EAN-13" : "CODE-128",
         inferenceMs: "0.42",
         box: { x: 120, y: 80, width: 320, height: 140 },
         source: "SIMULATION",
      });
      lookupDatabase(code);
   };

   const resetScan = () => {
      isLockedRef.current = false;
      setIsLocked(false);
      setTelemetry(null);
      setMatchedProduct(null);

      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext("2d");
         ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      if (isScanning) {
         detectLoop();
      }
   };

   const stopCamera = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
      }
      if (videoRef.current) {
         videoRef.current.srcObject = null;
      }
      setIsScanning(false);
   };

   const startCamera = async () => {
      setErrorMsg("");
      try {
         const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
         });
         streamRef.current = stream;
         if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsScanning(true);
            isLockedRef.current = false;
            setIsLocked(false);
            setActiveTab("scanner");
            detectLoop();
         }
      } catch {
         setErrorMsg("Akses kamera ditolak atau tidak tersedia. Pastikan izin kamera aktif dan berjalan di HTTPS/localhost.");
      }
   };

   const detectLoop = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const detector = new BarcodeDetector({
         formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a"],
      });

      const scanFrame = async () => {
         if (isLockedRef.current) return;

         if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const t0 = performance.now();
            try {
               const barcodes = await detector.detect(video);
               const t1 = performance.now();

               if (barcodes.length > 0 && barcodes[0].rawValue) {
                  const code = barcodes[0];
                  const { x, y, width, height } = code.boundingBox;

                  // Bounding box crisp indigo-emerald
                  ctx.strokeStyle = "#5B5BD6";
                  ctx.lineWidth = 3;
                  ctx.strokeRect(x, y, width, height);

                  if (code.cornerPoints) {
                     ctx.fillStyle = "#FFFFFF";
                     code.cornerPoints.forEach((pt: { x: number; y: number }) => {
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.strokeStyle = "#5B5BD6";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                     });
                  }

                  setTelemetry({
                     rawValue: code.rawValue,
                     format: code.format.toUpperCase().replace("_", "-"),
                     inferenceMs: (t1 - t0).toFixed(2),
                     box: {
                        x: Math.round(x),
                        y: Math.round(y),
                        width: Math.round(width),
                        height: Math.round(height),
                     },
                     source: "CAMERA",
                  });

                  lookupDatabase(code.rawValue);
                  isLockedRef.current = true;
                  setIsLocked(true);
                  return;
               }
            } catch {
               // Abaikan error frame tunggal
            }
         }

         timerRef.current = setTimeout(scanFrame, 150);
      };

      scanFrame();
   };

   const filteredProducts = Object.values(DUMMY_DATABASE).filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase()));

   return (
      <div className="min-h-screen bg-[#F6F7F9] text-[#181920] p-4 sm:p-6 md:p-8 font-sans antialiased">
         <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Navigation Bar (Ref: Floating Pill + Brand + Status) */}
            <header className="flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-3 self-start md:self-auto">
                  <div className="w-10 h-10 rounded-xl bg-[#5B5BD6] flex items-center justify-center text-white shadow-sm">
                     <ScanBarcode className="w-5 h-5" />
                  </div>
                  <div>
                     <div className="font-bold text-base tracking-tight text-[#181920]">VISIOSTOCK</div>
                     <div className="text-[11px] text-slate-500 font-medium">Local Vision &amp; Inventory Lookup</div>
                  </div>
               </div>

               {/* Floating Dark Pill Navigation */}
               <nav className="flex items-center bg-[#1E1F29] p-1.5 rounded-full shadow-sm">
                  <button onClick={() => setActiveTab("scanner")} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === "scanner" ? "bg-[#5B5BD6] text-white shadow-sm" : "text-slate-300 hover:text-white"}`}>
                     Pemindai
                  </button>
                  <button onClick={() => setActiveTab("catalog")} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === "catalog" ? "bg-[#5B5BD6] text-white shadow-sm" : "text-slate-300 hover:text-white"}`}>
                     Katalog ({Object.keys(DUMMY_DATABASE).length})
                  </button>
                  <button onClick={() => setActiveTab("guide")} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === "guide" ? "bg-[#5B5BD6] text-white shadow-sm" : "text-slate-300 hover:text-white"}`}>
                     Panduan
                  </button>
               </nav>

               {/* Right Engine Status Badge */}
               <div className="hidden md:flex items-center gap-2.5">
                  <span className="px-3 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs font-medium text-slate-600 flex items-center gap-1.5">
                     <span className="w-2 h-2 rounded-full bg-emerald-500" />
                     {engineMode}
                  </span>
               </div>
            </header>

            {/* Page Title & Primary CTA Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
               <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181920]">Pemindaian Inventaris</h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Deteksi barcode secara lokal di browser dan cocokkan stok tanpa latensi server.</p>
               </div>

               <div className="flex items-center gap-2.5">
                  {telemetry && (
                     <button onClick={resetScan} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Hasil
                     </button>
                  )}
                  {!isScanning ? (
                     <button onClick={startCamera} className="px-5 py-2.5 bg-[#5B5BD6] hover:bg-[#4F4FC4] text-white rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm transition">
                        <Camera className="w-4 h-4" />
                        Aktifkan Kamera
                     </button>
                  ) : (
                     <button onClick={stopCamera} className="px-5 py-2.5 bg-[#1E1F29] hover:bg-slate-800 text-white rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm transition">
                        <CameraOff className="w-4 h-4" />
                        Matikan Kamera
                     </button>
                  )}
               </div>
            </div>

            {errorMsg && (
               <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
               </div>
            )}

            {/* 4-Column Metric Cards (Ref: Top Summary Cards) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
               <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Status Pemindai</span>
                     <div className="w-7 h-7 rounded-full bg-indigo-50 text-[#5B5BD6] flex items-center justify-center">
                        <Cpu className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-3">
                     <div className="text-xl sm:text-2xl font-bold text-[#181920]">{isLocked ? "Terkunci" : isScanning ? "Aktif" : "Siaga"}</div>
                     <div className="text-[11px] text-slate-500 mt-1">{isLocked ? "1 kode berhasil dibaca" : isScanning ? "Mencari pola di frame" : "Kamera belum menyala"}</div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Waktu Inferensi</span>
                     <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-3">
                     <div className="text-xl sm:text-2xl font-bold text-[#181920]">{telemetry ? `${telemetry.inferenceMs} ms` : "0.00 ms"}</div>
                     <div className="text-[11px] text-emerald-600 font-medium mt-1">Pemrosesan lokal 100%</div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Format Terbaca</span>
                     <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-3">
                     <div className="text-xl sm:text-2xl font-bold text-[#181920]">{telemetry ? telemetry.format : "—"}</div>
                     <div className="text-[11px] text-slate-500 mt-1">EAN-13, Code-128, QR</div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Database Lokal</span>
                     <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Package className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-3">
                     <div className="text-xl sm:text-2xl font-bold text-[#181920]">{Object.keys(DUMMY_DATABASE).length} Item</div>
                     <div className="text-[11px] text-slate-500 mt-1">Tersedia untuk uji cepat</div>
                  </div>
               </div>
            </section>

            {/* Filter / Quick Simulation Strip (Ref: Filter Bar above main dark container) */}
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
               <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700 mr-1">Uji Cepat Tanpa Kamera:</span>
                  {Object.keys(DUMMY_DATABASE).map(code => {
                     const isSelected = telemetry?.rawValue === code;
                     return (
                        <button key={code} onClick={() => simulateScan(code)} className={`px-3 py-1.5 rounded-full text-xs font-mono transition border ${isSelected ? "bg-[#5B5BD6] text-white border-[#5B5BD6] font-semibold" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                           {code}
                        </button>
                     );
                  })}
               </div>

               <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari kode / produk..." className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#5B5BD6]" />
               </div>
            </section>

            {/* TAB 1: SCANNER WORKSPACE (Ref: Dark Container + Indigo Detail Card) */}
            {activeTab === "scanner" && (
               <section className="bg-[#1E1F29] rounded-[28px] p-4 sm:p-6 text-white shadow-sm">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                     {/* Left Column: Camera Viewport + Quick List */}
                     <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-sm font-semibold text-white">Viewport Kamera</span>
                           <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${isLocked ? "bg-emerald-500/20 text-emerald-300" : isScanning ? "bg-[#5B5BD6]/30 text-indigo-200" : "bg-white/10 text-slate-300"}`}>{isLocked ? "Terkunci" : isScanning ? "Memindai..." : "Standby"}</span>
                        </div>

                        {/* Camera Frame */}
                        <div className="relative w-full aspect-video bg-[#14151C] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                           <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                           <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                           {!isScanning && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                 <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2.5">
                                    <Camera className="w-4 h-4 text-slate-300" />
                                 </div>
                                 <p className="text-xs text-slate-300 max-w-[220px]">Nyalakan kamera untuk memindai barcode fisik atau layar perangkat lain.</p>
                                 <button onClick={startCamera} className="mt-3 px-4 py-1.5 bg-[#5B5BD6] hover:bg-[#4F4FC4] text-white text-xs font-medium rounded-full transition">
                                    Mulai Kamera
                                 </button>
                              </div>
                           )}

                           {isLocked && (
                              <button onClick={resetScan} className="absolute bottom-3 right-3 px-3.5 py-1.5 bg-white text-[#181920] hover:bg-slate-100 text-xs font-semibold rounded-full shadow flex items-center gap-1.5 transition">
                                 <RotateCcw className="w-3.5 h-3.5" />
                                 Scan Berikutnya
                              </button>
                           )}
                        </div>

                        {/* Compact Item List (Ref: Left stacked list in reference image) */}
                        <div className="space-y-2 pt-1">
                           <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Daftar Kode Terdaftar</div>
                           <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                              {filteredProducts.map(item => {
                                 const active = telemetry?.rawValue === item.barcode;
                                 return (
                                    <button key={item.barcode} onClick={() => simulateScan(item.barcode)} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition ${active ? "bg-[#5B5BD6] text-white" : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-200"}`}>
                                       <div>
                                          <div className="text-xs font-mono font-semibold">{item.barcode}</div>
                                          <div className={`text-[11px] ${active ? "text-indigo-100" : "text-slate-400"}`}>{item.name}</div>
                                       </div>
                                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${active ? "bg-white text-[#5B5BD6]" : item.stock === 0 ? "bg-red-500/20 text-red-300" : "bg-white/10 text-slate-300"}`}>{item.stock} unit</span>
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     </div>

                     {/* Right Column: Indigo Inspection Detail Card (Ref: Right Periwinkle Card) */}
                     <div className="lg:col-span-7 bg-[#5B5BD6] rounded-2xl p-5 sm:p-6 flex flex-col justify-between text-white">
                        {telemetry ? (
                           <>
                              <div>
                                 {/* Top Metadata Header */}
                                 <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-white/15">
                                    <div>
                                       <div className="text-xs text-indigo-200 font-medium">Kode Terdeteksi</div>
                                       <div className="flex items-center gap-2.5 mt-1">
                                          <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight">{telemetry.rawValue}</span>
                                          <span className="px-2.5 py-0.5 bg-white/15 rounded-full text-[11px] font-medium">{matchedProduct ? "Terdaftar" : "Tidak Dikenal"}</span>
                                       </div>
                                    </div>

                                    <div className="text-left sm:text-right">
                                       <div className="text-xs text-indigo-200 font-medium">Sumber Input</div>
                                       <div className="text-sm font-semibold mt-1">{telemetry.source === "CAMERA" ? "Kamera Optik" : "Simulasi Klik"}</div>
                                    </div>
                                 </div>

                                 {/* Product Detail or Unregistered Notice */}
                                 {matchedProduct ? (
                                    <div className="py-5 space-y-5">
                                       <div>
                                          <div className="text-xs text-indigo-200">Nama Produk</div>
                                          <div className="text-lg sm:text-xl font-bold mt-0.5">{matchedProduct.name}</div>
                                          <div className="text-xs text-indigo-100 mt-1">
                                             Kategori: {matchedProduct.category} &bull; Diperbarui: {matchedProduct.updatedAt}
                                          </div>
                                       </div>

                                       {/* 3 Sub-cards inside Indigo Card (Ref: 3 translucent boxes in reference) */}
                                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                          <div className="bg-white/15 rounded-xl p-3.5 flex flex-col justify-between">
                                             <div className="flex items-center justify-between text-indigo-100">
                                                <span className="text-[11px]">Harga Satuan</span>
                                                <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                                             </div>
                                             <div className="text-lg font-bold mt-2">Rp {matchedProduct.price.toLocaleString("id-ID")}</div>
                                          </div>

                                          <div className="bg-white/15 rounded-xl p-3.5 flex flex-col justify-between">
                                             <div className="flex items-center justify-between text-indigo-100">
                                                <span className="text-[11px]">Sisa Stok</span>
                                                <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                                             </div>
                                             <div className="text-lg font-bold mt-2">{matchedProduct.stock} Unit</div>
                                          </div>

                                          <div className="bg-white/15 rounded-xl p-3.5 flex flex-col justify-between">
                                             <div className="flex items-center justify-between text-indigo-100">
                                                <span className="text-[11px]">Koordinat Box</span>
                                                <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                                             </div>
                                             <div className="text-sm font-mono font-semibold mt-2">
                                                {telemetry.box.x},{telemetry.box.y} ({telemetry.box.width}&times;{telemetry.box.height})
                                             </div>
                                          </div>
                                       </div>

                                       <div className="bg-black/15 rounded-xl p-3.5 text-xs text-indigo-50 leading-relaxed">
                                          <span className="font-semibold text-white">Catatan Gudang: </span>
                                          {matchedProduct.notes}
                                       </div>
                                    </div>
                                 ) : (
                                    <div className="py-10 text-center space-y-2">
                                       <AlertCircle className="w-8 h-8 text-indigo-200 mx-auto" />
                                       <div className="text-base font-semibold">Kode Tidak Ada di Database Lokal</div>
                                       <p className="text-xs text-indigo-100 max-w-md mx-auto">
                                          Computer vision berhasil membaca kode <span className="font-mono font-bold">{telemetry.rawValue}</span> ({telemetry.format}), namun nomor ini belum didaftarkan di katalog produk.
                                       </p>
                                    </div>
                                 )}
                              </div>

                              {/* Bottom Action Footer inside Indigo Card */}
                              <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
                                 <div className="text-xs text-indigo-100">
                                    Format: <span className="font-mono font-semibold text-white">{telemetry.format}</span> &bull; Inferensi: <span className="font-mono font-semibold text-white">{telemetry.inferenceMs} ms</span>
                                 </div>
                                 <button onClick={resetScan} className="px-5 py-2 bg-white text-[#181920] hover:bg-indigo-50 rounded-full text-xs font-bold shadow-sm transition">
                                    Pindai Kode Lain
                                 </button>
                              </div>
                           </>
                        ) : (
                           /* Empty State inside Indigo Card */
                           <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                                 <ScanBarcode className="w-6 h-6 text-white" />
                              </div>
                              <div className="text-lg font-bold">Menunggu Input Barcode</div>
                              <p className="text-xs text-indigo-100 max-w-sm leading-relaxed">Arahkan kamera ke barcode produk (EAN-13, Code-128, atau QR Code), atau pilih salah satu kode dari daftar di sebelah kiri untuk melihat detail inventaris.</p>
                           </div>
                        )}
                     </div>
                  </div>
               </section>
            )}

            {/* TAB 2: CATALOG VIEW */}
            {activeTab === "catalog" && (
               <section className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                     <div>
                        <h2 className="text-base font-bold text-[#181920]">Katalog Produk Lokal</h2>
                        <p className="text-xs text-slate-500">Klik baris item untuk mensimulasikan hasil pemindaian.</p>
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase">
                              <th className="py-3 px-3">Kode Barcode</th>
                              <th className="py-3 px-3">Nama Produk</th>
                              <th className="py-3 px-3">Kategori</th>
                              <th className="py-3 px-3">Harga</th>
                              <th className="py-3 px-3">Stok</th>
                              <th className="py-3 px-3 text-right">Aksi</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                           {filteredProducts.map(item => (
                              <tr key={item.barcode} className="hover:bg-slate-50/80 transition">
                                 <td className="py-3 px-3 font-mono font-semibold text-[#5B5BD6]">{item.barcode}</td>
                                 <td className="py-3 px-3 font-medium text-[#181920]">{item.name}</td>
                                 <td className="py-3 px-3 text-slate-500">{item.category}</td>
                                 <td className="py-3 px-3 font-medium">Rp {item.price.toLocaleString("id-ID")}</td>
                                 <td className="py-3 px-3">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${item.stock === 0 ? "bg-red-50 text-red-600" : item.stock <= 5 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{item.stock} unit</span>
                                 </td>
                                 <td className="py-3 px-3 text-right">
                                    <button onClick={() => simulateScan(item.barcode)} className="px-3 py-1 bg-[#1E1F29] hover:bg-[#5B5BD6] text-white rounded-full text-[11px] font-medium transition">
                                       Uji Scan
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </section>
            )}

            {/* TAB 3: USAGE GUIDE */}
            {activeTab === "guide" && (
               <section className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-5">
                  <div className="flex items-center gap-2.5">
                     <div className="w-8 h-8 rounded-full bg-indigo-50 text-[#5B5BD6] flex items-center justify-center">
                        <BookOpen className="w-4 h-4" />
                     </div>
                     <div>
                        <h2 className="text-base font-bold text-[#181920]">Panduan Penggunaan Pemindai</h2>
                        <p className="text-xs text-slate-500">Langkah singkat menjalankan deteksi barcode secara optimal.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-slate-200/60 space-y-2">
                        <div className="text-xs font-bold text-[#5B5BD6]">01. Aktifkan Akses Kamera</div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                           Tekan tombol <strong>Aktifkan Kamera</strong> di kanan atas dan berikan izin kamera pada browser. Pastikan halaman dibuka melalui <code>localhost</code> atau protokol <code>HTTPS</code>.
                        </p>
                     </div>

                     <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-slate-200/60 space-y-2">
                        <div className="text-xs font-bold text-[#5B5BD6]">02. Posisikan Barcode</div>
                        <p className="text-xs text-slate-600 leading-relaxed">Arahkan barcode (EAN-13, EAN-8, Code-128, Code-39, UPC-A, atau QR) ke dalam area frame kamera dengan pencahayaan cukup agar fokus kamera terkunci.</p>
                     </div>

                     <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-slate-200/60 space-y-2">
                        <div className="text-xs font-bold text-[#5B5BD6]">03. Penguncian Otomatis</div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                           Saat kode terdeteksi, sistem otomatis mengunci hasil agar data tidak berubah-ubah. Tekan <strong>Scan Berikutnya</strong> atau <strong>Reset Hasil</strong> untuk memindai barang lain.
                        </p>
                     </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                     <CheckCircle2 className="w-4 h-4 text-[#5B5BD6] shrink-0 mt-0.5" />
                     <p className="text-xs text-slate-700 leading-relaxed">
                        <strong>Pengujian Tanpa Kamera Fisik:</strong> Anda dapat menggunakan tombol kode pada bilah <em>Uji Cepat Tanpa Kamera</em> atau membuka situs generator barcode online di perangkat lain lalu memindainya menggunakan kamera ini.
                     </p>
                  </div>
               </section>
            )}
         </div>
      </div>
   );
}
