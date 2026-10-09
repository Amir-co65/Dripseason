import { useState } from "react";

export function CopyablePublicId({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access requires a secure browser context and user interaction.
      setCopied(false);
    }
  };

  return <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void copy(); }} title={copied ? "Copied!" : "Click to copy ID"} aria-label={copied ? `${value} copied` : `Copy ID ${value}`} className={`cursor-copy rounded px-1 text-left transition-colors hover:bg-indigo-500/15 hover:text-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${className}`}>{copied ? "Copied!" : value}</button>;
}
