export const SEPARATOR_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1).padStart(2, "0"),
  name: `PNG separator ${index + 1}`,
}));

export function separatorImagePath(id: string): string {
  const numericId = Number.parseInt(id, 10);
  const safeId = Number.isInteger(numericId) && numericId >= 1 && numericId <= 10 ? numericId : 1;
  return `/separators/${safeId}.png`;
}
