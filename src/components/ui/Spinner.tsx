export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 text-neutral-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
