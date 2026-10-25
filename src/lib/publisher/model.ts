export const PLATFORMS = ["facebook", "instagram", "youtube", "threads", "pinterest", "linkedin", "x", "telegram", "bluesky", "mastodon"] as const;
export type Platform = typeof PLATFORMS[number];
export type PostKind = "image" | "text" | "video";
export type Draft = { title: string; caption: string; url: string; hashtags: string; alt: string; board: string };
export type Account = { platform: Platform; connected: boolean; configured: boolean; id?: string; name?: string; message: string; boards?: { id: string; name: string }[] };
export type Outcome = { id?: string; url?: string; error?: string; uncertain?: boolean; processing?: boolean };
export const LABELS: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", threads: "Threads", pinterest: "Pinterest", linkedin: "LinkedIn", x: "X", telegram: "Telegram", bluesky: "Bluesky", mastodon: "Mastodon" };
export const FORMATS: Record<Platform, PostKind[]> = {
  facebook: ["image", "text", "video"], instagram: ["image", "video"], youtube: ["video"],
  threads: ["image", "text"], pinterest: ["image"], linkedin: ["image", "text"],
  x: ["image", "text"], telegram: ["image", "text"], bluesky: ["image", "text"], mastodon: ["image", "text"],
};
export const EMPTY_DRAFT: Draft = { title: "", caption: "", url: "", hashtags: "", alt: "", board: "" };
export function isPlatform(value: string): value is Platform { return PLATFORMS.some(platform => platform === value); }
export function postText(draft: Draft): string {
  const tags = [...new Set(draft.hashtags.split(/[\s,]+/).filter(Boolean).map(tag => `#${tag.replace(/^#+/, "")}`).filter(tag => tag !== "#"))];
  return [draft.caption.trim(), draft.url.trim() && !draft.caption.includes(draft.url.trim()) ? draft.url.trim() : "", tags.join(" ")].filter(Boolean).join("\n\n");
}
export function validateDraft(platform: Platform, kind: PostKind, draft: Draft): string | null {
  if (!FORMATS[platform].includes(kind)) return `${LABELS[platform]} does not support this format in Social Publisher. Choose another format or deselect it.`;
  if (draft.url) { try { const url = new URL(draft.url); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); } catch { return "Use a complete HTTPS destination URL."; } }
  const text = postText(draft);
  if (!text && kind === "text") return "Write a message or add a destination URL.";
  const limit = platform === "telegram" ? (kind === "image" ? 1024 : 4096) : ({ facebook: 2200, instagram: 2200, youtube: 5000, threads: 500, pinterest: 800, linkedin: 3000, x: 280, bluesky: 300, mastodon: 500 }[platform]);
  // Conservative code-point checks; platforms still enforce their own weighted/grapheme limits.
  if ([...text].length > limit) return `${LABELS[platform]}: shorten this draft to ${limit.toLocaleString()} characters including the URL and hashtags.`;
  if ((platform === "pinterest" || platform === "youtube") && !draft.title.trim()) return `Add a title for ${LABELS[platform]}.`;
  if ((platform === "pinterest" || platform === "youtube") && [...draft.title].length > 100) return "Keep the title within 100 characters.";
  if ([...draft.alt].length > 1000) return "Keep image alt text within 1,000 characters.";
  if (platform === "pinterest" && !/^\d+$/.test(draft.board)) return "Choose a Pinterest board.";
  if (platform === "instagram" && draft.hashtags.split(/[\s,]+/).filter(Boolean).length > 30) return "Use at most 30 Instagram hashtags.";
  return null;
}
