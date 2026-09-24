import type { ReactNode } from "react";

/** Wraps any <table> in a horizontally-scrolling container, so wide
 * tables stay usable on a phone instead of squashing or overflowing the
 * page. Use plain <table>/<thead>/<tbody> inside as normal. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th className={`whitespace-nowrap border-b border-neutral-200 px-4 py-2.5 font-medium text-neutral-500 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export function Td({ children, right, className = "" }: { children: ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`border-b border-neutral-100 px-4 py-2.5 ${right ? "text-right" : "text-left"} ${className}`}>{children}</td>
  );
}
