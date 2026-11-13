"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "barcode-detector/ponyfill";

interface ProductItem {
   barcode: string;
   name: string;
   category: string;
   stock: number;
   price: number;
   notes: string;
}

interface ScanTelemetry {
   rawValue: string;
   format: string;
   inferenceMs: string;
   box: { x: number; y: number; width: number; height: number };
}

const DUMMY_DATABASE: Record<string, ProductItem> = {
   "8992761136014": {
      barcode: "8992761136014",
      name: "Air Mineral Botol 600ml",
      category: "Minuman",
      stock: 48,
      price: 4000,
      notes: "Stok aman di rak utama gudang A.",
   },
   "8998866200578": {
      barcode: "8998866200578",
      name: "Kopi Instan Hitam Sachet",
      category: "Kopi & Teh",
      stock: 4,
      price: 2500,
      notes: "Peringatan: Stok menipis, segera lakukan restock.",
   },
   "INV-2026-001": {
      barcode: "INV-2026-001",
      name: "Router Wi-Fi 6 Enterprise",
      category: "Perangkat Jaringan",
      stock: 12,
      price: 1450000,
      notes: "Aset inventaris IT - Garansi aktif hingga 2028.",
   },
   "LAB-CV-99": {
      barcode: "LAB-CV-99",
      name: "Modul Sensor Kamera OV2640",
      category: "Komponen IoT",
      stock: 0,
      price: 85000,
      notes: "Stok habis. Cek supplier komponen elektronik.",
   },
};

export default function BarcodeCVLab() {
   const videoRef = useRef<HTMLVideoElement | null>(null);
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const timerRef = useRef<NodeJS.Timeout | null>(null);
   const isLockedRef = useRef<boolean>(false);

   const [engineMode, setEngineMode] = useState<string>("Mendeteksi...");
   const [isScanning, setIsScanning] = useState<boolean>(false);
   const [isLocked, setIsLocked] = useState<boolean>(false);
   const [telemetry, setTelemetry] = useState<ScanTelemetry | null>(null);
   const [matchedProduct, setMatchedProduct] = useState<ProductItem | null>(null);
   const [errorMsg, setErrorMsg] = useState<string>("");

   useEffect(() => {
      const hasNative = typeof window !== "undefined" && "BarcodeDetector" in window;
      setEngineMode(hasNative ? "Native ML Kit API" : "ZXing WASM Polyfill");

      return () => {
         if (timerRef.current) clearTimeout(timerRef.current);
      };
   }, []);

   const lookupDatabase = (code: string) => {
      const found = DUMMY_DATABASE[code] || null;
      setMatchedProduct(found);
   };

   const simulateScan = (code: string) => {
      isLockedRef.current = true;
      setIsLocked(true);
      setTelemetry({
         rawValue: code,
         format: code.startsWith("899") ? "EAN_13 (SIMULATED)" : "CODE_128 (SIMULATED)",
         inferenceMs: "0.45",
         box: { x: 120, y: 80, width: 320, height: 140 },
      });
      lookupDatabase(code);
   };

   const resetScan = () => {
      isLockedRef.current = false;
      setIsLocked(false);
      setTelemetry(null);
      setMatchedProduct(null);

      // Bersihkan canvas bounding box
      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext("2d");
         ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      // Lanjutkan loop deteksi jika kamera masih aktif
      if (isScanning) {
         detectLoop();
      }
   };

   const startCamera = async () => {
      setErrorMsg("");
      try {
         const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
         });
         if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsScanning(true);
            isLockedRef.current = false;
            setIsLocked(false);
            detectLoop();
         }
      } catch {
         setErrorMsg("Gagal mengakses kamera. Pastikan website dibuka via HTTPS atau localhost dan izin kamera aktif.");
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
         // Berhenti memindai jika hasil sudah terkunci
         if (isLockedRef.current) return;

         if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const t0 = performance.now();
            try {
               const barcodes = await detector.detect(video);
               const t1 = performance.now();

               // Hanya proses jika BENAR-BENAR ada barcode terdeteksi di kamera
               if (barcodes.length > 0 && barcodes[0].rawValue) {
                  const code = barcodes[0];
                  const { x, y, width, height } = code.boundingBox;

                  // Gambar Bounding Box Hijau
                  ctx.strokeStyle = "#10B981";
                  ctx.lineWidth = 4;
                  ctx.strokeRect(x, y, width, height);

                  // Gambar Titik Sudut Merah
                  if (code.cornerPoints) {
                     ctx.fillStyle = "#EF4444";
                     code.cornerPoints.forEach((pt: { x: number; y: number }) => {
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
                        ctx.fill();
                     });
                  }

                  setTelemetry({
                     rawValue: code.rawValue,
                     format: code.format.toUpperCase(),
                     inferenceMs: (t1 - t0).toFixed(2),
                     box: {
                        x: Math.round(x),
                        y: Math.round(y),
                        width: Math.round(width),
                        height: Math.round(height),
                     },
                  });

                  lookupDatabase(code.rawValue);

                  // Kunci hasil agar tidak terus men-scan ulang setelah ketemu
                  isLockedRef.current = true;
                  setIsLocked(true);
                  return;
               }
            } catch {
               // Abaikan error frame tunggal
            }
         }

         // Cek setiap 150ms (~6-7 FPS) agar CPU adem & tidak spam loop
         timerRef.current = setTimeout(scanFrame, 150);
      };

      scanFrame();
   };

   return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 flex flex-col items-center">
         <div className="max-w-xl w-full space-y-4">
            <header className="border-b border-slate-800 pb-3 flex justify-between items-start">
               <div>
                  <h1 className="text-xl font-bold text-emerald-400">ML Kit Vision &amp; Local DB Lab</h1>
                  <p className="text-xs text-slate-400">Pemindaian Computer Vision Lokal + Pencocokan Data Dummy</p>
               </div>
               <span className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] font-mono text-sky-400">{engineMode}</span>
            </header>

            {errorMsg && <div className="p-3 bg-red-950/60 border border-red-500/50 rounded text-xs text-red-200">{errorMsg}</div>}

            {/* Area Kamera & Canvas Bounding Box */}
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
               <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
               <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

               {!isScanning && (
                  <button onClick={startCamera} className="absolute px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md shadow">
                     Aktifkan Kamera &amp; Vision Engine
                  </button>
               )}

               {isScanning && (
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                     <span className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold ${isLocked ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50" : "bg-slate-950/80 text-amber-300 border border-amber-500/40"}`}>{isLocked ? "LOCKED: KODE TERDETEKSI" : "MENCARI BARCODE..."}</span>
                  </div>
               )}

               {isLocked && (
                  <button onClick={resetScan} className="absolute bottom-3 right-3 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md shadow">
                     Scan Ulang
                  </button>
               )}
            </div>

            {/* Panel Daftar Kode Dummy untuk Testing */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-2">
               <div className="text-xs font-semibold text-slate-300">Data Dummy Terdaftar (Generate kode ini di laptop lalu scan pakai HP):</div>
               <div className="flex flex-wrap gap-2">
                  {Object.keys(DUMMY_DATABASE).map(code => (
                     <button key={code} onClick={() => simulateScan(code)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono text-emerald-300 transition" title="Klik untuk simulasi instan tanpa kamera">
                        {code}
                     </button>
                  ))}
               </div>
            </section>

            {/* Hasil Pencocokan Database Lokal */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
               <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Hasil Lookup Database Lokal</span>
                  {telemetry && (
                     <button onClick={resetScan} className="text-xs text-slate-400 hover:text-white underline">
                        Reset
                     </button>
                  )}
               </div>

               {telemetry ? (
                  matchedProduct ? (
                     <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-md p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                           <span className="font-bold text-sm text-emerald-300">{matchedProduct.name}</span>
                           <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">{matchedProduct.category}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                           <div>
                              Harga: <span className="text-white">Rp {matchedProduct.price.toLocaleString("id-ID")}</span>
                           </div>
                           <div>
                              Stok: <span className={matchedProduct.stock <= 5 ? "text-red-400 font-bold" : "text-emerald-400"}>{matchedProduct.stock} unit</span>
                           </div>
                        </div>
                        <div className="pt-1 text-slate-300 border-t border-slate-800/80">
                           Catatan Sistem: <span className="italic text-amber-300">{matchedProduct.notes}</span>
                        </div>
                     </div>
                  ) : (
                     <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs text-slate-400">
                        Barcode <span className="font-mono text-amber-400">{telemetry.rawValue}</span> terbaca oleh Computer Vision, tetapi <strong>tidak ditemukan</strong> di dalam <code>DUMMY_DATABASE</code>.
                     </div>
                  )
               ) : (
                  <p className="text-xs text-slate-500 italic">Arahkan barcode ke kamera untuk memindai...</p>
               )}
            </section>

            {/* Panel Telemetri Computer Vision */}
            {telemetry && (
               <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 text-xs font-mono">
                  <div className="text-slate-400 uppercase tracking-wider font-sans font-semibold">Telemetri Computer Vision</div>
                  <div className="grid grid-cols-2 gap-2">
                     <div className="bg-slate-950 p-2 rounded">
                        <span className="text-slate-500 block">RAW VALUE</span>
                        <span className="text-emerald-400 font-bold">{telemetry.rawValue}</span>
                     </div>
                     <div className="bg-slate-950 p-2 rounded">
                        <span className="text-slate-500 block">FORMAT</span>
                        <span className="text-sky-400 font-bold">{telemetry.format}</span>
                     </div>
                     <div className="bg-slate-950 p-2 rounded">
                        <span className="text-slate-500 block">INFERENCE TIME</span>
                        <span className="text-amber-400">{telemetry.inferenceMs} ms</span>
                     </div>
                     <div className="bg-slate-950 p-2 rounded">
                        <span className="text-slate-500 block">BOUNDING BOX</span>
                        <span className="text-purple-400">
                           {telemetry.box.x},{telemetry.box.y} ({telemetry.box.width}x{telemetry.box.height})
                        </span>
                     </div>
                  </div>
               </section>
            )}
         </div>
      </main>
   );
}
