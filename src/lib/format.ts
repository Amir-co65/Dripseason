/** Formats a number as money, or shows a placeholder when the value is
 * null - which happens on purpose for workers reading the *_secure views,
 * where money columns come back as null rather than the real number. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // some legacy dates are free text, not real dates
  return d.toLocaleDateString();
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
