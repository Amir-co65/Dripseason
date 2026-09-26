import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (options?: { formats?: string[] }) => Detector; } }

/** Uses the browser's native barcode detector, so no photos leave the device.
 * Repeated detections are retained to support scanning several products. */
export function CodeScannerButton({ onDetected }: { onDetected: (codes: string[]) => void }) {
  const [open, setOpen] = useState(false); const [codes, setCodes] = useState<string[]>([]); const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!open || !video.current) return; let stream: MediaStream | undefined; let timer: number | undefined; let alive = true; void (async () => { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } }); if (!video.current || !alive) return; video.current.srcObject = stream; await video.current.play(); const DetectorClass = window.BarcodeDetector; if (!DetectorClass) return; const detector = new DetectorClass({ formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code"] }); timer = window.setInterval(async () => { if (video.current?.readyState && alive) { const found = await detector.detect(video.current); if (found.length) setCodes((old) => [...new Set([...old, ...found.map((f) => f.rawValue)])]); } }, 500); } catch { /* permission error is shown below */ } })(); return () => { alive = false; if (timer) window.clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); }; }, [open]);
  return <><Button type="button" variant="secondary" onClick={() => setOpen(true)}>Scan codes</Button>{open && <Modal open onClose={() => setOpen(false)} title="Scan product codes"><div className="flex flex-col gap-3"><video ref={video} muted playsInline className="w-full rounded-lg bg-neutral-900"/><p className="text-sm text-neutral-500">Point the camera at one or several codes. On browsers without native scanning, enter the code in search instead.</p>{codes.length > 0 && <div className="rounded bg-neutral-50 p-2 text-sm">{codes.join(", ")}</div>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCodes([])}>Clear</Button><Button disabled={!codes.length} onClick={() => { onDetected(codes); setOpen(false); }}>Use scanned codes</Button></div></div></Modal>}</>;
}
