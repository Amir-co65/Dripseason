import { Select } from "@/components/ui/Field";
import type { PublicIdSortOrder } from "@/lib/inventorySort";

export function PublicIdSortSelect({
  value,
  onChange,
  className = "max-w-[220px]",
}: {
  value: PublicIdSortOrder;
  onChange: (value: PublicIdSortOrder) => void;
  className?: string;
}) {
  return (
    <Select aria-label="Sort by public ID" value={value} onChange={(event) => onChange(event.target.value as PublicIdSortOrder)} className={className}>
      <option value="oldest">Oldest code to newest</option>
      <option value="newest">Newest code to oldest</option>
    </Select>
  );
}
