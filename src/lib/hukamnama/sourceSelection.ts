export const DAILY_SOURCES = [
  { id: "sikhizm", label: "Sikhizm.com" },
  { id: "sgpc", label: "SGPC" },
  { id: "hukamnamasahib", label: "HukamnamaSahib.com" },
  { id: "sikhnet", label: "SikhNet" },
  { id: "dekhoji", label: "Dekho Ji" },
] as const;
export type DailySource = typeof DAILY_SOURCES[number]["id"];
export type SourceSelection = { sources: DailySource[]; translation: boolean };

/** A missing sources parameter always means the established automatic policy. */
export function readSourceSelection(params: URLSearchParams): SourceSelection | null {
  if (!params.has("sources")) return null;
  const selected = params.get("sources")!.split(",");
  if (params.getAll("sources").length !== 1 || !selected.length || selected.some(id => !DAILY_SOURCES.some(source => source.id === id))) {
    throw new Error("Choose at least one supported daily source.");
  }
  if (params.has("translation") && !["0", "1"].includes(params.get("translation")!)) throw new Error("Invalid translation option.");
  return { sources: DAILY_SOURCES.filter(source => selected.includes(source.id)).map(source => source.id), translation: params.get("translation") !== "0" };
}

export function manualSourceUrl(selection: SourceSelection): string {
  const params = new URLSearchParams({ refresh: "1", sources: selection.sources.join(","), translation: selection.translation ? "1" : "0" });
  return `/api/hukamnama/live?${params}`;
}
