import { useEffect, useRef, useState } from "react";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

function findItemCodes(text: string) {
  const upper = text.toUpperCase();
  const exact = upper.match(/\b\d{3}[A-Z0-9]{2}\b/g) ?? [];
  // OCR sometimes puts spaces or newlines between the characters.
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  const compactMatches = compact.match(/\d{3}[A-Z0-9]{2}/g) ?? [];
  return [...new Set([...exact, ...compactMatches])];
}

/** Camera OCR for Project26's printed five-character product IDs, e.g. 000A0.
 * A capture is deliberate: it prevents a busy camera feed from adding the
 * same label repeatedly and makes multi-item stock checks predictable. */
export function ItemTextScanner({ onDone, knownCodes }: { onDone: (codes: string[]) => void; knownCodes: string[] }) {
  const [open, setOpen] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("Point the rear camera at one item code.");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let stream: MediaStream | null = null;
    let active = true;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMessage("Ready. Keep the five-character code inside the frame, then tap Scan this item.");
      } catch {
        setMessage("Camera access is needed. Allow camera access in your browser settings, then try again.");
      }
    })();
    return () => { active = false; stream?.getTracks().forEach((track) => track.stop()); };
  }, [open, facing]);

  useEffect(() => () => { void workerRef.current?.terminate(); }, []);

  async function scanFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || scanning) return;
    setScanning(true);
    setMessage("Reading the printed code…");
    try {
      // Read only the centre guide area. It deliberately ignores labels and
      // product text above/below the code, which were causing false results.
      const sourceX = Math.round(video.videoWidth * 0.06);
      const sourceY = Math.round(video.videoHeight * 0.36);
      const sourceWidth = Math.round(video.videoWidth * 0.88);
      const sourceHeight = Math.round(video.videoHeight * 0.22);
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth * 3;
      canvas.height = sourceHeight * 3;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      // High-contrast black-on-white copy gives OCR a clean five-character
      // image even when labels have shadows or low phone-camera contrast.
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const brightness = new Uint8Array(image.data.length / 4);
      const histogram = new Uint32Array(256);
      for (let pixel = 0; pixel < brightness.length; pixel += 1) {
        const offset = pixel * 4;
        const value = Math.round(image.data[offset] * 0.299 + image.data[offset + 1] * 0.587 + image.data[offset + 2] * 0.114);
        brightness[pixel] = value; histogram[value] += 1;
      }
      let total = brightness.length, sum = 0, background = 0, backgroundSum = 0, best = -1, threshold = 145;
      for (let value = 0; value < 256; value += 1) sum += value * histogram[value];
      for (let value = 0; value < 256; value += 1) {
        background += histogram[value]; if (!background) continue;
        const foreground = total - background; if (!foreground) break;
        backgroundSum += value * histogram[value];
        const between = background * foreground * (backgroundSum / background - (sum - backgroundSum) / foreground) ** 2;
        if (between > best) { best = between; threshold = value; }
      }
      for (let pixel = 0; pixel < brightness.length; pixel += 1) {
        const value = brightness[pixel] < threshold ? 0 : 255;
        const offset = pixel * 4; image.data[offset] = value; image.data[offset + 1] = value; image.data[offset + 2] = value;
      }
      context.putImageData(image, 0, 0);
      if (!workerRef.current) {
        workerRef.current = await createWorker("eng", 1, { logger: () => undefined });
        await workerRef.current.setParameters({ tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", tessedit_pageseg_mode: PSM.SINGLE_WORD });
      }
      const result = await workerRef.current.recognize(canvas);
      const permitted = new Set(knownCodes.map((code) => code.toUpperCase()));
      const found = findItemCodes(result.data.text).filter((code) => permitted.has(code));
      if (!found.length) setMessage("No matching item code found. Put only the five-character code inside the centre box, then scan again.");
      else {
        setCodes((old) => [...new Set([...old, ...found])]);
        setMessage(`Added ${found.join(", ")}. Move to the next item and tap Scan this item again.`);
      }
    } catch {
      setMessage("Could not read that image. Try better light or hold the label steadier.");
    } finally { setScanning(false); }
  }

  return <><Button type="button" variant="secondary" onClick={() => { setCodes([]); setFacing("environment"); setOpen(true); }}>Camera scan</Button>{open && <Modal open onClose={() => setOpen(false)} title="Scan item codes"><div className="flex flex-col gap-3"><div className="relative"><video ref={videoRef} muted playsInline className="aspect-[3/4] w-full rounded-lg bg-neutral-900 object-cover" /><div className="pointer-events-none absolute left-[6%] top-[36%] h-[22%] w-[88%] rounded border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" /></div><p className="text-sm text-neutral-600">{message}</p>{codes.length > 0 && <div className="rounded-lg bg-neutral-100 p-3 text-sm"><span className="font-medium">Scanned:</span> {codes.join(", ")}</div>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFacing((value) => value === "environment" ? "user" : "environment")}>Flip camera</Button><Button type="button" variant="secondary" onClick={() => setCodes([])}>Clear</Button><Button type="button" disabled={scanning} onClick={() => void scanFrame()}>{scanning ? "Reading…" : "Scan this item"}</Button><Button type="button" disabled={!codes.length} onClick={() => { onDone(codes); setOpen(false); }}>Done · show items</Button></div></div></Modal>}</>;
}
