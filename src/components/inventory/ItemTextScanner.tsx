import { useEffect, useRef, useState } from "react";
import { createWorker, type Worker } from "tesseract.js";
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
export function ItemTextScanner({ onDone }: { onDone: (codes: string[]) => void }) {
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
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      if (!workerRef.current) {
        workerRef.current = await createWorker("eng", 1, { logger: () => undefined });
        await workerRef.current.setParameters({ tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" });
      }
      const result = await workerRef.current.recognize(canvas);
      const found = findItemCodes(result.data.text);
      if (!found.length) setMessage("No 000A0-style code found. Move closer, improve light, and scan again.");
      else {
        setCodes((old) => [...new Set([...old, ...found])]);
        setMessage(`Added ${found.join(", ")}. Move to the next item and tap Scan this item again.`);
      }
    } catch {
      setMessage("Could not read that image. Try better light or hold the label steadier.");
    } finally { setScanning(false); }
  }

  return <><Button type="button" variant="secondary" onClick={() => { setCodes([]); setFacing("environment"); setOpen(true); }}>Camera scan</Button>{open && <Modal open onClose={() => setOpen(false)} title="Scan item codes"><div className="flex flex-col gap-3"><video ref={videoRef} muted playsInline className="aspect-[3/4] w-full rounded-lg bg-neutral-900 object-cover" /><p className="text-sm text-neutral-600">{message}</p>{codes.length > 0 && <div className="rounded-lg bg-neutral-100 p-3 text-sm"><span className="font-medium">Scanned:</span> {codes.join(", ")}</div>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFacing((value) => value === "environment" ? "user" : "environment")}>Flip camera</Button><Button type="button" variant="secondary" onClick={() => setCodes([])}>Clear</Button><Button type="button" disabled={scanning} onClick={() => void scanFrame()}>{scanning ? "Reading…" : "Scan this item"}</Button><Button type="button" disabled={!codes.length} onClick={() => { onDone(codes); setOpen(false); }}>Done · show items</Button></div></div></Modal>}</>;
}
