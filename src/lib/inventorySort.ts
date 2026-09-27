export type PublicIdSortOrder = "oldest" | "newest";

function codeSequence(code: string | null | undefined) {
  const match = /^(\d{3})([a-z])0$/i.exec(code ?? "");
  if (!match) return null;
  return (match[2].toLowerCase().charCodeAt(0) - 97) * 1000 + Number(match[1]);
}

export function sortByPublicId<T>(
  items: readonly T[],
  getPublicId: (item: T) => string | null | undefined,
  order: PublicIdSortOrder = "oldest",
) {
  return [...items].sort((a, b) => {
    return comparePublicIds(getPublicId(a), getPublicId(b), order);
  });
}

export function comparePublicIds(aCode: string | null | undefined, bCode: string | null | undefined, order: PublicIdSortOrder = "oldest") {
  const aSequence = codeSequence(aCode);
  const bSequence = codeSequence(bCode);

  // Keep unassigned/unrecognized codes after valid public IDs in either order.
  if (aSequence == null || bSequence == null) {
    if (aSequence == null && bSequence != null) return 1;
    if (aSequence != null && bSequence == null) return -1;
    const fallback = (aCode ?? "").localeCompare(bCode ?? "", undefined, { numeric: true, sensitivity: "base" });
    return order === "oldest" ? fallback : -fallback;
  }

  const difference = aSequence - bSequence;
  return order === "oldest" ? difference : -difference;
}
