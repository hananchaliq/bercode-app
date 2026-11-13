"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "barcode-detector/ponyfill";
import bwipjs from "bwip-js/browser";
import { Camera, CameraOff, ScanBarcode, RotateCcw, CheckCircle2, AlertCircle, Package, Cpu, Clock, Layers, BookOpen, ArrowUpRight, Search, Download, QrCode } from "lucide-react";

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
   "8996001300219": {
      barcode: "8996001300219",
      name: "Teh Melati Botol 350ml",
      category: "Minuman",
      stock: 36,
      price: 5000,
      notes: "Tersimpan di chiller display depan.",
      updatedAt: "Hari ini, 09:10",
   },
   "8991002101122": {
      barcode: "8991002101122",
      name: "Biskuit Gandum Cokelat 110g",
      category: "Makanan Ringan",
      stock: 22,
      price: 9500,
      notes: "Expired date Maret 2027, rak B2.",
      updatedAt: "Hari ini, 07:45",
   },
   "8992753101106": {
      barcode: "8992753101106",
      name: "Susu UHT Full Cream 250ml",
      category: "Minuman",
      stock: 3,
      price: 7500,
      notes: "Sisa 3 kotak, butuh restock mingguan.",
      updatedAt: "Kemarin, 18:20",
   },
   "INV-2026-002": {
      barcode: "INV-2026-002",
      name: "Switch Gigabit 24-Port Managed",
      category: "Perangkat Jaringan",
      stock: 5,
      price: 2850000,
      notes: "Cadangan rack server lantai 2.",
      updatedAt: "11 Nov 2026",
   },
   "INV-2026-003": {
      barcode: "INV-2026-003",
      name: "Kabel Patch Cord Cat6 3 Meter",
      category: "Perangkat Jaringan",
      stock: 65,
      price: 35000,
      notes: "Warna biru, stok melimpah di boks kabel.",
      updatedAt: "09 Nov 2026",
   },
   "LAB-ESP-32": {
      barcode: "LAB-ESP-32",
      name: "Mikrokontroler ESP32-S3 DevKit",
      category: "Komponen IoT",
      stock: 18,
      price: 115000,
      notes: "Digunakan untuk praktikum modul Wi-Fi & BLE.",
      updatedAt: "Hari ini, 10:05",
   },
   "LAB-RFID-01": {
      barcode: "LAB-RFID-01",
      name: "Sensor RFID RC522 + Kartu Tag",
      category: "Komponen IoT",
      stock: 2,
      price: 28000,
      notes: "Stok kritis, tersisa 2 set di lemari lab.",
      updatedAt: "08 Nov 2026",
   },
   "ATK-HVS-A4": {
      barcode: "ATK-HVS-A4",
      name: "Kertas HVS A4 80gsm (1 Rim)",
      category: "Alat Tulis Kantor",
      stock: 30,
      price: 54000,
      notes: "Rak logistik administrasi ruangan TU.",
      updatedAt: "Kemarin, 14:00",
   },
   "ATK-SP-09": {
      barcode: "ATK-SP-09",
      name: "Spidol Whiteboard Hitam",
      category: "Alat Tulis Kantor",
      stock: 0,
      price: 9000,
      notes: "Habis terpakai, sedang proses pengajuan pembelian.",
      updatedAt: "07 Nov 2026",
   },
   "8999999501233": {
      barcode: "8999999501233",
      name: "Hand Sanitizer Gel 100ml",
      category: "Kesehatan & Kebersihan",
      stock: 19,
      price: 14000,
      notes: "Stok standar ruang kelas & lab komputer.",
      updatedAt: "12 Nov 2026",
   },
   "8993175534217": {
      barcode: "8993175534217",
      name: "Wafer Krim Vanila 140g",
      category: "Makanan Ringan",
      stock: 14,
      price: 8500,
      notes: "Rak display koperasi bagian tengah.",
      updatedAt: "Hari ini, 08:50",
   },
};

type ActiveTab = "scanner" | "generator" | "catalog" | "guide";
type ScanProfile = "1D_PRODUCT" | "QR_ONLY" | "ALL";
type GeneratorFormat = "code128" | "ean13" | "qrcode";

const FORMAT_PROFILES: Record<ScanProfile, ("ean_13" | "ean_8" | "code_128" | "code_39" | "qr_code" | "upc_a")[]> = {
   "1D_PRODUCT": ["ean_13", "code_128", "upc_a", "ean_8"],
   QR_ONLY: ["qr_code"],
   ALL: ["ean_13", "code_128", "qr_code", "upc_a", "ean_8", "code_39"],
};

const isValidEan13 = (code: string) => {
   if (!/^\d{13}$/.test(code)) return false;
   const digits = code.split("").map(Number);
   const sum = digits.slice(0, 12).reduce((acc, d, idx) => acc + d * (idx % 2 === 0 ? 1 : 3), 0);
   const checkDigit = (10 - (sum % 10)) % 10;
   return checkDigit === digits[12];
};

function BarcodeCanvas({ value, format = "code128", scale = 3, height = 13, compact = false }: { value: string; format?: GeneratorFormat; scale?: number; height?: number; compact?: boolean }) {
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const [renderError, setRenderError] = useState<string>("");

   useEffect(() => {
      if (!canvasRef.current || !value.trim()) return;
      setRenderError("");

      const trimmedValue = value.trim();
      const resolvedFormat: GeneratorFormat = format === "ean13" && !isValidEan13(trimmedValue) ? "code128" : format;

      try {
         bwipjs.toCanvas(canvasRef.current, {
            bcid: resolvedFormat,
            text: trimmedValue,
            scale,
            height: resolvedFormat === "qrcode" ? 32 : height,
            includetext: resolvedFormat !== "qrcode",
            textxalign: "center",
            backgroundcolor: "FFFFFF",
            paddingwidth: compact ? 4 : 8,
            paddingheight: compact ? 3 : 6,
         });
      } catch {
         try {
            bwipjs.toCanvas(canvasRef.current, {
               bcid: "code128",
               text: trimmedValue,
               scale,
               height,
               includetext: true,
               textxalign: "center",
               backgroundcolor: "FFFFFF",
               paddingwidth: compact ? 4 : 8,
               paddingheight: compact ? 3 : 6,
            });
         } catch (fallbackErr) {
            const msg = fallbackErr instanceof Error ? fallbackErr.message : "Format kode tidak valid";
            setRenderError(msg);
         }
      }
   }, [value, format, scale, height, compact]);

   const handleDownload = () => {
      if (!canvasRef.current) return;
      const link = document.createElement("a");
      link.download = `${format}-${value.trim()}.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
   };

   if (renderError) {
      return <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-600 text-center">{renderError}</div>;
   }

   return (
      <div className={`inline-flex flex-col items-center bg-white rounded-2xl border border-slate-200/90 ${compact ? "p-2.5 space-y-1.5" : "p-4 space-y-3"}`}>
         <canvas ref={canvasRef} className="max-w-full h-auto rounded" />
         <button type="button" onClick={handleDownload} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[11px] font-semibold flex items-center gap-1 transition">
            <Download className="w-3 h-3" />
            Unduh PNG
         </button>
      </div>
   );
}

export default function BarcodeCVLab() {
   const videoRef = useRef<HTMLVideoElement | null>(null);
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
   const timerRef = useRef<NodeJS.Timeout | null>(null);
   const isLockedRef = useRef<boolean>(false);
   const streamRef = useRef<MediaStream | null>(null);
   const lastCandidateRef = useRef<{ value: string; count: number }>({ value: "", count: 0 });

   const [activeTab, setActiveTab] = useState<ActiveTab>("scanner");
   const [scanProfile, setScanProfile] = useState<ScanProfile>("1D_PRODUCT");
   const [engineMode, setEngineMode] = useState<string>("Memeriksa...");
   const [isScanning, setIsScanning] = useState<boolean>(false);
   const [isLocked, setIsLocked] = useState<boolean>(false);
   const [telemetry, setTelemetry] = useState<ScanTelemetry | null>(null);
   const [matchedProduct, setMatchedProduct] = useState<ProductItem | null>(null);
   const [errorMsg, setErrorMsg] = useState<string>("");
   const [searchQuery, setSearchQuery] = useState<string>("");

   const [genInput, setGenInput] = useState<string>("8992761136014");
   const [genFormat, setGenFormat] = useState<GeneratorFormat>("ean13");

   useEffect(() => {
      const hasNative = typeof window !== "undefined" && "BarcodeDetector" in window;
      setEngineMode(hasNative ? "Native ML Kit" : "WASM Polyfill");
      cropCanvasRef.current = document.createElement("canvas");

      return () => {
         stopCamera();
      };
   }, []);

   useEffect(() => {
      if (isScanning && !isLockedRef.current) {
         if (timerRef.current) clearTimeout(timerRef.current);
         lastCandidateRef.current = { value: "", count: 0 };
         detectLoop();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [scanProfile]);

   const lookupDatabase = (code: string) => {
      const found = DUMMY_DATABASE[code.trim()] || null;
      setMatchedProduct(found);
   };

   const simulateScan = (code: string) => {
      isLockedRef.current = true;
      setIsLocked(true);
      setActiveTab("scanner");
      setTelemetry({
         rawValue: code,
         format: isValidEan13(code) ? "EAN-13" : "CODE-128",
         inferenceMs: "0.42",
         box: { x: 120, y: 80, width: 320, height: 140 },
         source: "SIMULATION",
      });
      lookupDatabase(code);
   };

   const resetScan = () => {
      isLockedRef.current = false;
      lastCandidateRef.current = { value: "", count: 0 };
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
            video: {
               facingMode: { ideal: "environment" },
               width: { ideal: 1280 },
               height: { ideal: 720 },
            },
            audio: false,
         });

         const videoTrack = stream.getVideoTracks()[0];
         const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
            focusMode?: string[];
         };
         if (capabilities?.focusMode?.includes("continuous")) {
            await videoTrack.applyConstraints({
               advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            });
         }

         streamRef.current = stream;
         if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsScanning(true);
            isLockedRef.current = false;
            lastCandidateRef.current = { value: "", count: 0 };
            setIsLocked(false);
            setActiveTab("scanner");
            detectLoop();
         }
      } catch {
         setErrorMsg("Akses kamera ditolak atau tidak tersedia. Pastikan izin kamera aktif dan berjalan di HTTPS/localhost.");
      }
   };

   const detectLoop = async () => {
      if (!videoRef.current || !canvasRef.current || !cropCanvasRef.current) return;
      const video = videoRef.current;
      const overlayCanvas = canvasRef.current;
      const overlayCtx = overlayCanvas.getContext("2d");
      const cropCanvas = cropCanvasRef.current;
      const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });

      const detector = new BarcodeDetector({
         formats: FORMAT_PROFILES[scanProfile],
      });

      const scanFrame = async () => {
         if (isLockedRef.current) return;

         if (video.readyState === video.HAVE_ENOUGH_DATA && overlayCtx && cropCtx) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            overlayCanvas.width = vw;
            overlayCanvas.height = vh;
            overlayCtx.clearRect(0, 0, vw, vh);

            const roiW = Math.round(vw * 0.75);
            const roiH = Math.round(vh * 0.55);
            const roiX = Math.round((vw - roiW) / 2);
            const roiY = Math.round((vh - roiH) / 2);

            const targetW = Math.min(roiW, 640);
            const scale = targetW / roiW;
            const targetH = Math.round(roiH * scale);

            cropCanvas.width = targetW;
            cropCanvas.height = targetH;
            cropCtx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, targetW, targetH);

            const t0 = performance.now();
            try {
               const barcodes = await detector.detect(cropCanvas);
               const t1 = performance.now();

               if (barcodes.length > 0 && barcodes[0].rawValue) {
                  const code = barcodes[0];
                  const cleanValue = code.rawValue.trim();

                  if (lastCandidateRef.current.value === cleanValue) {
                     lastCandidateRef.current.count += 1;
                  } else {
                     lastCandidateRef.current = { value: cleanValue, count: 1 };
                  }

                  const boxX = Math.round(roiX + code.boundingBox.x / scale);
                  const boxY = Math.round(roiY + code.boundingBox.y / scale);
                  const boxW = Math.round(code.boundingBox.width / scale);
                  const boxH = Math.round(code.boundingBox.height / scale);

                  overlayCtx.strokeStyle = lastCandidateRef.current.count >= 2 ? "#10B981" : "#F59E0B";
                  overlayCtx.lineWidth = 4;
                  overlayCtx.strokeRect(boxX, boxY, boxW, boxH);

                  if (lastCandidateRef.current.count >= 2) {
                     setTelemetry({
                        rawValue: cleanValue,
                        format: code.format.toUpperCase().replace("_", "-"),
                        inferenceMs: (t1 - t0).toFixed(2),
                        box: { x: boxX, y: boxY, width: boxW, height: boxH },
                        source: "CAMERA",
                     });

                     lookupDatabase(cleanValue);
                     isLockedRef.current = true;
                     setIsLocked(true);
                     return;
                  }
               } else {
                  lastCandidateRef.current = { value: "", count: 0 };
               }
            } catch {
               // Abaikan error frame tunggal
            }
         }

         timerRef.current = setTimeout(scanFrame, 80);
      };

      scanFrame();
   };

   const filteredProducts = Object.values(DUMMY_DATABASE).filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase()));

   const selectPresetForGenerator = (code: string) => {
      setGenInput(code);
      setGenFormat(isValidEan13(code) ? "ean13" : "code128");
   };

   return (
      <div className="min-h-screen bg-[#F6F7F9] text-[#181920] p-3.5 sm:p-6 md:p-8 font-sans antialiased">
         <div className="max-w-6xl mx-auto flex flex-col gap-5 sm:gap-6">
            {/* Top Navigation Bar */}
            <header className="flex flex-col md:flex-row items-center justify-between gap-3.5">
               <div className="flex items-center justify-between w-full md:w-auto">
                  <div className="flex items-center gap-3">
                     <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#5B5BD6] flex items-center justify-center text-white shadow-sm">
                        <ScanBarcode className="w-5 h-5" />
                     </div>
                     <div>
                        <div className="font-bold text-sm sm:text-base tracking-tight text-[#181920]">VISIOSTOCK</div>
                        <div className="text-[11px] text-slate-500 font-medium">Local Vision &amp; Inventory</div>
                     </div>
                  </div>

                  {/* Mobile Quick Camera Button in Header */}
                  <div className="md:hidden">
                     {!isScanning ? (
                        <button onClick={startCamera} className="px-3.5 py-2 bg-[#5B5BD6] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                           <Camera className="w-3.5 h-3.5" />
                           Scan
                        </button>
                     ) : (
                        <button onClick={stopCamera} className="px-3.5 py-2 bg-[#1E1F29] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                           <CameraOff className="w-3.5 h-3.5" />
                           Stop
                        </button>
                     )}
                  </div>
               </div>

               {/* Floating Dark Pill Navigation */}
               <nav className="w-full md:w-auto flex items-center justify-between md:justify-center bg-[#1E1F29] p-1.5 rounded-full shadow-sm overflow-x-auto">
                  {(
                     [
                        { id: "scanner", label: "Pemindai" },
                        { id: "generator", label: "Generator" },
                        { id: "catalog", label: `Katalog (${Object.keys(DUMMY_DATABASE).length})` },
                        { id: "guide", label: "Panduan" },
                     ] as { id: ActiveTab; label: string }[]
                  ).map(tab => (
                     <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 md:flex-none px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-[#5B5BD6] text-white shadow-sm" : "text-slate-300 hover:text-white"}`}>
                        {tab.label}
                     </button>
                  ))}
               </nav>

               {/* Right Engine Status Badge (Desktop) */}
               <div className="hidden md:flex items-center gap-2.5">
                  <span className="px-3 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs font-medium text-slate-600 flex items-center gap-1.5">
                     <span className="w-2 h-2 rounded-full bg-emerald-500" />
                     {engineMode} &bull; ROI 2-Pass
                  </span>
               </div>
            </header>

            {/* Page Title & Primary Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div>
                  <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-[#181920]">Pemindaian Inventaris</h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Arahkan barcode ke kotak bidik kamera untuk verifikasi lokal.</p>
               </div>

               <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-white border border-slate-200 rounded-full p-1">
                     {(
                        [
                           { id: "1D_PRODUCT", label: "Barcode 1D" },
                           { id: "QR_ONLY", label: "QR Code" },
                           { id: "ALL", label: "Semua" },
                        ] as { id: ScanProfile; label: string }[]
                     ).map(mode => (
                        <button key={mode.id} onClick={() => setScanProfile(mode.id)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${scanProfile === mode.id ? "bg-[#1E1F29] text-white" : "text-slate-600 hover:text-[#181920]"}`}>
                           {mode.label}
                        </button>
                     ))}
                  </div>

                  {telemetry && (
                     <button onClick={resetScan} className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5 transition">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                     </button>
                  )}

                  <div className="hidden md:block">
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
            </div>

            {errorMsg && (
               <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
               </div>
            )}

            {/* ACTIVE TAB WORKSPACE (Selalu paling atas di HP via order-first lg:order-none) */}
            <div className="order-first lg:order-none">
               {/* TAB 1: SCANNER WORKSPACE */}
               {activeTab === "scanner" && (
                  <section className="bg-[#1E1F29] rounded-3xl sm:rounded-[28px] p-3.5 sm:p-6 text-white shadow-sm">
                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
                        {/* Left Column: Camera Viewport (Always top on mobile) */}
                        <div className="lg:col-span-5 flex flex-col justify-between space-y-3.5">
                           <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-semibold text-white">Viewport Kamera</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${isLocked ? "bg-emerald-500/20 text-emerald-300" : isScanning ? "bg-[#5B5BD6]/30 text-indigo-200" : "bg-white/10 text-slate-300"}`}>{isLocked ? "Terkunci" : isScanning ? "Memindai..." : "Standby"}</span>
                           </div>

                           <div className="relative w-full aspect-[4/3] sm:aspect-video bg-[#14151C] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                              {isScanning && !isLocked && (
                                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div className="w-[75%] h-[55%] border-2 border-dashed border-white/60 rounded-xl relative flex items-end justify-center pb-2">
                                       <span className="px-2 py-0.5 bg-black/60 rounded text-[10px] text-white/90">Posisikan barcode di dalam kotak</span>
                                    </div>
                                 </div>
                              )}

                              {!isScanning && (
                                 <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                                       <Camera className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <p className="text-xs text-slate-300 max-w-[220px]">Nyalakan kamera untuk memindai barcode fisik atau dari layar lain.</p>
                                    <button onClick={startCamera} className="mt-3 px-4 py-2 bg-[#5B5BD6] hover:bg-[#4F4FC4] text-white text-xs font-semibold rounded-full transition">
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

                           {/* Compact Item List */}
                           <div className="space-y-2 pt-1">
                              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Daftar Kode Terdaftar</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                                 {filteredProducts.map(item => {
                                    const active = telemetry?.rawValue === item.barcode;
                                    return (
                                       <button key={item.barcode} onClick={() => simulateScan(item.barcode)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition ${active ? "bg-[#5B5BD6] text-white" : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-200"}`}>
                                          <div className="min-w-0 pr-2">
                                             <div className="text-xs font-mono font-semibold truncate">{item.barcode}</div>
                                             <div className={`text-[11px] truncate ${active ? "text-indigo-100" : "text-slate-400"}`}>{item.name}</div>
                                          </div>
                                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${active ? "bg-white text-[#5B5BD6]" : item.stock === 0 ? "bg-red-500/20 text-red-300" : "bg-white/10 text-slate-300"}`}>{item.stock} unit</span>
                                       </button>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>

                        {/* Right Column: Indigo Inspection Detail Card */}
                        <div className="lg:col-span-7 bg-[#5B5BD6] rounded-2xl p-4 sm:p-6 flex flex-col justify-between text-white">
                           {telemetry ? (
                              <>
                                 <div>
                                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/15">
                                       <div>
                                          <div className="text-[11px] text-indigo-200 font-medium">Kode Terdeteksi</div>
                                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                                             <span className="text-lg sm:text-2xl font-bold font-mono tracking-tight">{telemetry.rawValue}</span>
                                             <span className="px-2.5 py-0.5 bg-white/15 rounded-full text-[11px] font-medium">{matchedProduct ? "Terdaftar" : "Tidak Dikenal"}</span>
                                          </div>
                                       </div>

                                       <div className="text-left sm:text-right">
                                          <div className="text-[11px] text-indigo-200 font-medium">Sumber Input</div>
                                          <div className="text-xs sm:text-sm font-semibold mt-0.5">{telemetry.source === "CAMERA" ? "Kamera Optik" : "Simulasi Klik"}</div>
                                       </div>
                                    </div>

                                    {matchedProduct ? (
                                       <div className="py-4 sm:py-5 space-y-4">
                                          <div>
                                             <div className="text-[11px] text-indigo-200">Nama Produk</div>
                                             <div className="text-base sm:text-xl font-bold mt-0.5">{matchedProduct.name}</div>
                                             <div className="text-xs text-indigo-100 mt-1">
                                                {matchedProduct.category} &bull; {matchedProduct.updatedAt}
                                             </div>
                                          </div>

                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                                             <div className="bg-white/15 rounded-xl p-3 flex flex-col justify-between">
                                                <div className="flex items-center justify-between text-indigo-100">
                                                   <span className="text-[11px]">Harga Satuan</span>
                                                   <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                                                </div>
                                                <div className="text-sm sm:text-lg font-bold mt-1.5">Rp {matchedProduct.price.toLocaleString("id-ID")}</div>
                                             </div>

                                             <div className="bg-white/15 rounded-xl p-3 flex flex-col justify-between">
                                                <div className="flex items-center justify-between text-indigo-100">
                                                   <span className="text-[11px]">Sisa Stok</span>
                                                   <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                                                </div>
                                                <div className="text-sm sm:text-lg font-bold mt-1.5">{matchedProduct.stock} Unit</div>
                                             </div>

                                             <div className="col-span-2 sm:col-span-1 bg-white/15 rounded-xl p-3 flex flex-col justify-between">
                                                <div className="flex items-center justify-between text-indigo-100">
                                                   <span className="text-[11px]">Koordinat Box</span>
                                                   <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                                                </div>
                                                <div className="text-xs sm:text-sm font-mono font-semibold mt-1.5">
                                                   {telemetry.box.x},{telemetry.box.y} ({telemetry.box.width}&times;{telemetry.box.height})
                                                </div>
                                             </div>
                                          </div>

                                          <div className="bg-black/15 rounded-xl p-3 text-xs text-indigo-50 leading-relaxed">
                                             <span className="font-semibold text-white">Catatan Gudang: </span>
                                             {matchedProduct.notes}
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="py-8 text-center space-y-2">
                                          <AlertCircle className="w-7 h-7 text-indigo-200 mx-auto" />
                                          <div className="text-sm sm:text-base font-semibold">Kode Tidak Ada di Database Lokal</div>
                                          <p className="text-xs text-indigo-100 max-w-md mx-auto">
                                             Kamera membaca kode <span className="font-mono font-bold">{telemetry.rawValue}</span> ({telemetry.format}), namun nomor ini belum didaftarkan di katalog produk.
                                          </p>
                                       </div>
                                    )}
                                 </div>

                                 <div className="pt-3.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2.5">
                                    <div className="text-[11px] sm:text-xs text-indigo-100">
                                       Format: <span className="font-mono font-semibold text-white">{telemetry.format}</span> &bull; <span className="font-mono font-semibold text-white">{telemetry.inferenceMs} ms</span>
                                    </div>
                                    <button onClick={resetScan} className="px-4 py-2 bg-white text-[#181920] hover:bg-indigo-50 rounded-full text-xs font-bold shadow-sm transition">
                                       Pindai Kode Lain
                                    </button>
                                 </div>
                              </>
                           ) : (
                              <div className="h-full min-h-[210px] sm:min-h-[280px] flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-2.5">
                                 <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                                    <ScanBarcode className="w-5 h-5 text-white" />
                                 </div>
                                 <div className="text-base sm:text-lg font-bold">Menunggu Input Barcode</div>
                                 <p className="text-xs text-indigo-100 max-w-sm leading-relaxed">Sejajarkan barcode di dalam kotak bidik kamera, atau ketuk salah satu kode dari daftar di atas untuk simulasi instan.</p>
                              </div>
                           )}
                        </div>
                     </div>
                  </section>
               )}

               {/* TAB 2: CANVAS BARCODE GENERATOR */}
               {activeTab === "generator" && (
                  <section className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6">
                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                        <div className="lg:col-span-7 space-y-4">
                           <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 text-[#5B5BD6] flex items-center justify-center">
                                 <QrCode className="w-4 h-4" />
                              </div>
                              <div>
                                 <h2 className="text-base font-bold text-[#181920]">Generator Barcode Canvas</h2>
                                 <p className="text-xs text-slate-500">
                                    Render barcode ke elemen <code>&lt;canvas&gt;</code> tanpa gambar eksternal.
                                 </p>
                              </div>
                           </div>

                           <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-700">Format Simbologi</label>
                              <div className="flex flex-wrap gap-2">
                                 {(
                                    [
                                       { id: "ean13", label: "EAN-13 (13 Digit)" },
                                       { id: "code128", label: "Code-128" },
                                       { id: "qrcode", label: "QR Code" },
                                    ] as { id: GeneratorFormat; label: string }[]
                                 ).map(fmt => (
                                    <button key={fmt.id} type="button" onClick={() => setGenFormat(fmt.id)} className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${genFormat === fmt.id ? "bg-[#5B5BD6] text-white border-[#5B5BD6]" : "bg-[#F6F7F9] text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                                       {fmt.label}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-700">Nilai / Teks Barcode</label>
                              <input type="text" value={genInput} onChange={e => setGenInput(e.target.value)} placeholder="Masukkan angka atau kode..." className="w-full px-4 py-2.5 bg-[#F6F7F9] border border-slate-200 rounded-xl text-sm font-mono text-[#181920] focus:outline-none focus:border-[#5B5BD6]" />
                              <p className="text-[11px] text-slate-500">{genFormat === "ean13" ? "*EAN-13 membutuhkan tepat 13 digit angka valid (contoh: 8992761136014)." : "*Code-128 & QR mendukung huruf, angka, dan tanda hubung (contoh: INV-2026-001)."}</p>
                           </div>

                           <div className="space-y-1.5 pt-1">
                              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Isi Cepat dari Database Lokal:</span>
                              <div className="flex flex-wrap gap-2">
                                 {Object.values(DUMMY_DATABASE).map(item => (
                                    <button key={item.barcode} type="button" onClick={() => selectPresetForGenerator(item.barcode)} className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-[#5B5BD6] rounded-full text-xs font-mono text-slate-700 transition">
                                       {item.barcode}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="lg:col-span-5 bg-[#F6F7F9] border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[240px] space-y-3">
                           <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Live Canvas Render</span>
                           {genInput.trim() ? <BarcodeCanvas value={genInput} format={genFormat} /> : <p className="text-xs text-slate-400 italic">Ketik kode untuk me-render canvas...</p>}
                        </div>
                     </div>
                  </section>
               )}

               {/* TAB 3: CATALOG VIEW (Mobile: Compact Cards | Desktop: Clean Table) */}
               {activeTab === "catalog" && (
                  <section className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 space-y-4">
                     <div className="flex items-center justify-between">
                        <div>
                           <h2 className="text-base font-bold text-[#181920]">Katalog Produk Lokal</h2>
                           <p className="text-xs text-slate-500">
                              Render <code>&lt;canvas&gt;</code> barcode lokal untuk setiap produk.
                           </p>
                        </div>
                     </div>

                     {/* MOBILE VIEW (< md): Compact Cards — NO TABLE */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
                        {filteredProducts.map(item => (
                           <div key={item.barcode} className="p-3.5 rounded-2xl bg-[#F6F7F9] border border-slate-200/80 flex flex-col justify-between space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                 <div>
                                    <span className="text-[11px] font-medium text-slate-500">{item.category}</span>
                                    <h3 className="text-sm font-bold text-[#181920] leading-snug">{item.name}</h3>
                                 </div>
                                 <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${item.stock === 0 ? "bg-red-100 text-red-700" : item.stock <= 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{item.stock} unit</span>
                              </div>

                              <div className="flex justify-center py-1">
                                 <BarcodeCanvas value={item.barcode} format={isValidEan13(item.barcode) ? "ean13" : "code128"} scale={2} height={9} compact />
                              </div>

                              <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                                 <div>
                                    <div className="text-[10px] text-slate-500">Harga Satuan</div>
                                    <div className="text-xs font-bold text-[#181920]">Rp {item.price.toLocaleString("id-ID")}</div>
                                 </div>
                                 <button onClick={() => simulateScan(item.barcode)} className="px-3.5 py-1.5 bg-[#1E1F29] hover:bg-[#5B5BD6] text-white rounded-full text-xs font-semibold transition">
                                    Uji Scan
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>

                     {/* DESKTOP VIEW (>= md): Structured Table */}
                     <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                           <thead>
                              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase">
                                 <th className="py-3 px-3">Barcode Canvas</th>
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
                                    <td className="py-3 px-3">
                                       <BarcodeCanvas value={item.barcode} format={isValidEan13(item.barcode) ? "ean13" : "code128"} scale={2} height={8} compact />
                                    </td>
                                    <td className="py-3 px-3 font-medium text-[#181920]">{item.name}</td>
                                    <td className="py-3 px-3 text-slate-500">{item.category}</td>
                                    <td className="py-3 px-3 font-medium">Rp {item.price.toLocaleString("id-ID")}</td>
                                    <td className="py-3 px-3">
                                       <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${item.stock === 0 ? "bg-red-50 text-red-600" : item.stock <= 5 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{item.stock} unit</span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                       <button onClick={() => simulateScan(item.barcode)} className="px-3 py-1.5 bg-[#1E1F29] hover:bg-[#5B5BD6] text-white rounded-full text-[11px] font-medium transition">
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

               {/* TAB 4: USAGE GUIDE */}
               {activeTab === "guide" && (
                  <section className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 space-y-5">
                     <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-[#5B5BD6] flex items-center justify-center">
                           <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                           <h2 className="text-base font-bold text-[#181920]">Panduan Penggunaan Pemindai</h2>
                           <p className="text-xs text-slate-500">Langkah singkat menjalankan deteksi barcode secara optimal.</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-slate-200/60 space-y-1.5">
                           <div className="text-xs font-bold text-[#5B5BD6]">01. Generate Barcode Uji</div>
                           <p className="text-xs text-slate-600 leading-relaxed">
                              Buka tab <strong>Generator</strong> untuk me-render barcode EAN-13, Code-128, atau QR Code secara lokal ke dalam elemen <code>&lt;canvas&gt;</code>.
                           </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-slate-200/60 space-y-1.5">
                           <div className="text-xs font-bold text-[#5B5BD6]">02. Sejajarkan di Kotak Bidik</div>
                           <p className="text-xs text-slate-600 leading-relaxed">Tempatkan barcode di dalam garis putus-putus tengah kamera. Sistem memproses area fokus ini agar inferensi berlangsung di bawah 10 ms.</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#F6F7F9] border border-slate-200/60 space-y-1.5">
                           <div className="text-xs font-bold text-[#5B5BD6]">03. Verifikasi 2 Frame Otomatis</div>
                           <p className="text-xs text-slate-600 leading-relaxed">Sistem memastikan 2 frame berturut-turut menghasilkan angka identik sebelum mengunci hasil, mencegah salah baca akibat pantulan cahaya.</p>
                        </div>
                     </div>

                     <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-[#5B5BD6] shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-700 leading-relaxed">
                           <strong>Tips Jarak &amp; Pencahayaan:</strong> Jaga jarak sekitar 15–25 cm dari lensa. Jika memindai dari layar monitor/HP lain, turunkan sedikit kecerahan layar sumber agar garis barcode tidak pecah terkena pantulan piksel.
                        </p>
                     </div>
                  </section>
               )}
            </div>

            {/* 4-Column Metric Cards (Di bawah workspace saat mobile, di atas saat desktop) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
               <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Status Pemindai</span>
                     <div className="w-7 h-7 rounded-full bg-indigo-50 text-[#5B5BD6] flex items-center justify-center">
                        <Cpu className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-2.5">
                     <div className="text-lg sm:text-2xl font-bold text-[#181920]">{isLocked ? "Terkunci" : isScanning ? "Aktif" : "Siaga"}</div>
                     <div className="text-[11px] text-slate-500 mt-0.5">{isLocked ? "Terverifikasi 2 frame" : isScanning ? "Memindai area ROI" : "Kamera belum menyala"}</div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Waktu Inferensi</span>
                     <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-2.5">
                     <div className="text-lg sm:text-2xl font-bold text-[#181920]">{telemetry ? `${telemetry.inferenceMs} ms` : "0.00 ms"}</div>
                     <div className="text-[11px] text-emerald-600 font-medium mt-0.5">ROI Crop &amp; Downscale</div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Format Terbaca</span>
                     <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-2.5">
                     <div className="text-lg sm:text-2xl font-bold text-[#181920]">{telemetry ? telemetry.format : "—"}</div>
                     <div className="text-[11px] text-slate-500 mt-0.5">{scanProfile === "1D_PRODUCT" ? "Barcode 1D" : scanProfile === "QR_ONLY" ? "QR Code" : "Semua"}</div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                     <span className="text-xs font-medium">Database Lokal</span>
                     <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Package className="w-3.5 h-3.5" />
                     </div>
                  </div>
                  <div className="mt-2.5">
                     <div className="text-lg sm:text-2xl font-bold text-[#181920]">{Object.keys(DUMMY_DATABASE).length} Item</div>
                     <div className="text-[11px] text-slate-500 mt-0.5">Tersedia di memori</div>
                  </div>
               </div>
            </section>

            {/* Quick Simulation & Search Strip */}
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700 mr-1">Uji Cepat:</span>
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
         </div>
      </div>
   );
}
