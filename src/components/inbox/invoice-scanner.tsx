"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decodeQrBytes, isLeftQr, isRightQr, itemsComplete, parseInvoiceQr, type ParsedInvoice } from "@/lib/ledger/invoice-qr";

type ZXingReader = typeof import("zxing-wasm/reader");

let readerPromise: Promise<ZXingReader> | null = null;

/** 載入 zxing-wasm（WASM 由自己的網站 /zxing/ 提供，不從外部 CDN 下載） */
function loadReader(): Promise<ZXingReader> {
  readerPromise ??= import("zxing-wasm/reader").then((zx) => {
    zx.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path) },
    });
    return zx;
  });
  return readerPromise;
}

async function readTexts(input: Blob | ImageData): Promise<string[]> {
  const zx = await loadReader();
  const results = await zx.readBarcodes(input, { formats: ["QRCode"], maxNumberOfSymbols: 4, tryHarder: true });
  return results.filter((r) => r.isValid).map((r) => decodeQrBytes(r.bytes));
}

/** 把一批 QR 文字湊成發票：一張左方 + 最多一張右方 */
function combine(texts: string[]): ParsedInvoice | null {
  const left = texts.find(isLeftQr);
  if (!left) return null;
  return parseInvoiceQr(left, texts.find(isRightQr) ?? null);
}

interface InvoiceScannerProps {
  /** 讀到一張發票（同一張只回報一次） */
  onInvoice: (invoice: ParsedInvoice) => void;
  /** 照片裡找不到發票等訊息 */
  onMessage: (message: string) => void;
  /** 處理中或對話框開著時暫停辨識（相機不關） */
  paused: boolean;
}

type CameraState = "starting" | "on" | "unavailable";

/**
 * 掃描電子發票證明聯：相機對準下方左右兩個 QR Code。
 * 先讀到左方就有金額與日期；品項放不下時會在右方，等最多 1.5 秒把右方也讀進來。
 * 沒有相機（或不給權限）時可以上傳發票照片。
 */
export function InvoiceScanner({ onInvoice, onMessage, paused }: InvoiceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [hint, setHint] = useState("把發票下方左右兩個 QR Code 一起拍進框裡");
  const seen = useRef(new Set<string>());
  const pending = useRef<{ left: string; since: number } | null>(null);
  const lastRight = useRef<{ text: string; at: number } | null>(null);
  const busy = useRef(false);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // 父層每次重繪都會給新的 onInvoice；放在 ref 裡，辨識迴圈才不會一直重設
  const onInvoiceRef = useRef(onInvoice);
  useEffect(() => {
    onInvoiceRef.current = onInvoice;
  }, [onInvoice]);
  const report = useCallback((invoice: ParsedInvoice) => {
    if (seen.current.has(invoice.invoiceNo)) return;
    seen.current.add(invoice.invoiceNo);
    onInvoiceRef.current(invoice);
  }, []);

  // 開相機
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCamera("on");
        void loadReader();
      } catch {
        setCamera("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 每 300ms 辨識一次畫面
  useEffect(() => {
    if (camera !== "on") return;
    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (pausedRef.current || busy.current || !video || !canvas || video.readyState < 2) return;
      busy.current = true;
      try {
        const scale = Math.min(1, 1280 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const texts = await readTexts(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const now = Date.now();
        for (const text of texts) {
          if (isRightQr(text)) lastRight.current = { text, at: now };
          else if (isLeftQr(text) && pending.current?.left !== text) pending.current = { left: text, since: now };
        }
        if (!pending.current) return;
        const right = lastRight.current && now - lastRight.current.at < 3000 ? lastRight.current.text : null;
        const invoice = parseInvoiceQr(pending.current.left, right);
        if (!invoice) {
          pending.current = null;
          return;
        }
        if (seen.current.has(invoice.invoiceNo)) {
          pending.current = null;
          return;
        }
        if (itemsComplete(invoice) || now - pending.current.since > 1500) {
          pending.current = null;
          lastRight.current = null;
          setHint("把發票下方左右兩個 QR Code 一起拍進框裡");
          report(invoice);
        } else {
          setHint("讀到左邊了，右邊的 QR Code 也拍進來…");
        }
      } catch {
        // 單一畫面讀失敗就等下一張
      } finally {
        busy.current = false;
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [camera, report]);

  const fromPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const texts = (await Promise.all([...files].map((f) => readTexts(f)))).flat();
      const invoice = combine(texts);
      if (!invoice) return onMessage("照片裡找不到電子發票的 QR Code，請拍清楚一點（兩個 QR 都要在畫面裡）");
      if (seen.current.has(invoice.invoiceNo)) return onMessage(`發票 ${invoice.invoiceNo} 這次已經掃過了`);
      report(invoice);
    } catch {
      onMessage("讀取照片失敗，請換一張試試");
    }
  };

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-[18px] bg-black">
        <video ref={videoRef} muted playsInline aria-label="相機畫面" className="aspect-[4/3] w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" aria-hidden />
        {camera === "on" && (
          <div aria-hidden className="pointer-events-none absolute inset-x-[8%] top-[22%] bottom-[22%] rounded-xl border-2 border-dashed border-white/80" />
        )}
        {camera !== "on" && (
          <div className="absolute inset-0 grid place-content-center gap-2 p-6 text-center text-sm text-white/90">
            <Camera className="mx-auto size-8" aria-hidden />
            {camera === "starting" ? "正在開啟相機…" : "沒辦法使用相機（沒有相機或沒有給權限）。可以改用下方「上傳發票照片」。"}
          </div>
        )}
      </div>
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {paused ? "處理中…" : camera === "on" ? hint : " "}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="上傳發票照片"
        onChange={(e) => {
          void fromPhotos(e.target.files);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" className="justify-self-center" disabled={paused} onClick={() => fileRef.current?.click()}>
        <ImageUp className="size-4" aria-hidden />
        上傳發票照片
      </Button>
    </div>
  );
}
