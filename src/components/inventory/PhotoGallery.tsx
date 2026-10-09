import { useRef, useState } from "react";
import { useAddItemLink, useDeleteItemMedia, useItemMedia, useUploadItemPhoto } from "@/hooks/useInventory";
import { getPhotoUrl } from "@/services/media";
import { Button } from "@/components/ui/Button";

export function PhotoGallery({ inventoryItemId }: { inventoryItemId: string }) {
  const { data: media, isLoading } = useItemMedia(inventoryItemId);
  const upload = useUploadItemPhoto();
  const remove = useDeleteItemMedia();
  const addLink = useAddItemLink();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  const photos = (media ?? []).filter((m) => m.kind === "photo");
  const links = (media ?? []).filter((m) => m.kind === "link");

  async function handleFiles(files: FileList | File[] | null) {
    const selectedFiles = files ? Array.from(files) : [];
    if (selectedFiles.length === 0) return;
    setError(null);
    try {
      let position = photos.length;
      for (const file of selectedFiles) {
        await upload.mutateAsync({ inventoryItemId, file, position });
        position++;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function uploadImageUrl(url: string) {
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load that image. Try saving it to your device first.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("That link does not point directly to an image.");
      const lastPathPart = new URL(url).pathname.split("/").pop() || "pasted-image";
      const file = new File([blob], lastPathPart.includes(".") ? lastPathPart : `${lastPathPart}.jpg`, { type: blob.type });
      await handleFiles([file]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that image.");
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      void handleFiles(files);
      return;
    }
    const pasted = (event.clipboardData.getData("text/uri-list") || event.clipboardData.getData("text/plain")).trim();
    if (/^https?:\/\//i.test(pasted)) {
      event.preventDefault();
      void uploadImageUrl(pasted);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addLink.mutateAsync({ inventoryItemId, url: link.trim() });
      setLink("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add link");
    }
  }

  return (
    <div className="flex flex-col gap-3 outline-none" tabIndex={0} onPaste={handlePaste} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files); else { const url = (event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain")).trim(); if (/^https?:\/\//i.test(url)) void uploadImageUrl(url); } }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">Photos</span>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading..." : "+ Add photos"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
              {p.storage_path && (
                <img src={getPhotoUrl(p.storage_path)} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => remove.mutate({ mediaId: p.id, storagePath: p.storage_path, inventoryItemId })}
                className="absolute right-1 top-1 hidden h-5 w-5 rounded-full bg-black/60 text-xs text-white group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length === 0 && <p className="text-sm text-neutral-400">No photos yet.</p>}
        </div>
      )}

      <p className="text-xs text-neutral-400">You can also drag an image here or focus this area and paste an image or direct image link.</p>

      {links.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">Links</span>
          {links.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <a href={l.external_url ?? "#"} target="_blank" rel="noreferrer" className="truncate text-blue-600 underline">
                {l.external_url}
              </a>
              <button
                type="button"
                onClick={() => remove.mutate({ mediaId: l.id, inventoryItemId })}
                className="ml-2 text-neutral-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddLink} className="flex flex-col gap-2 sm:flex-row">
        <input type="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder="Supplier or reference URL" aria-label="Supplier or reference URL" className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <Button type="submit" variant="secondary" disabled={addLink.isPending}>{addLink.isPending ? "Adding…" : "Add link"}</Button>
      </form>
    </div>
  );
}
