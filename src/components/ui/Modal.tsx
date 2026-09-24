import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:items-center sm:pt-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-xl bg-white p-5 shadow-lg sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
