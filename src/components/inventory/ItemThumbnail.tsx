export function ItemThumbnail({ src, name }: { src?: string; name: string }) {
  return src ? (
    <img src={src} alt={name} loading="lazy" decoding="async" width={44} height={44} className="h-11 w-11 shrink-0 rounded-md border border-neutral-200 bg-neutral-100 object-cover" />
  ) : (
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-[10px] text-neutral-300">P26</span>
  );
}
