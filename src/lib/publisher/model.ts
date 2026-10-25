export const PLATFORMS = ["facebook", "instagram", "youtube", "threads", "pinterest", "tumblr", "blogger", "wordpress", "x", "telegram", "bluesky", "mastodon"] as const;
export type Platform = typeof PLATFORMS[number];
export type PostKind = "image" | "text" | "video";
export type Draft = { title: string; caption: string; url: string; hashtags: string; alt: string; board: string; imageUrl: string };
export type Account = { platform: Platform; connected: boolean; configured: boolean; id?: string; name?: string; connection?: "server-token"; message: string; boards?: { id: string; name: string }[] };
export type Outcome = { id?: string; url?: string; error?: string; uncertain?: boolean; processing?: boolean };
export const LABELS: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", threads: "Threads", pinterest: "Pinterest", tumblr: "Tumblr", blogger: "Blogger", wordpress: "WordPress.com", x: "X", telegram: "Telegram", bluesky: "Bluesky", mastodon: "Mastodon" };
export const FORMATS: Record<Platform, PostKind[]> = {
  facebook: ["image", "text", "video"], instagram: ["image", "video"], youtube: ["video"],
  threads: ["image", "text"], pinterest: ["image"], tumblr: ["image", "text"], blogger: ["image", "text"], wordpress: ["image", "text"],
  x: ["image", "text"], telegram: ["image", "text"], bluesky: ["image", "text"], mastodon: ["image", "text"],
};
export const EMPTY_DRAFT: Draft = { title: "", caption: "", url: "", hashtags: "", alt: "", board: "", imageUrl: "" };
export const CONNECTION_ISSUES = {
  "state-missing": "The browser did not return the connection cookie. Start Connect again on the production app in the same browser, and allow its cookies.",
  "state-invalid": "The connection session expired or did not match. Close old authorization tabs and start Connect again.",
  "permission-denied": "Authorization was declined or blocked. Check that @sikhizmcom accepted its Threads Tester invitation and approve the requested permissions.",
  "no-code": "The provider returned without an authorization code. Start Connect again and complete its approval screen.",
  "redirect-mismatch": "Meta rejected the callback URL. It must exactly match the registered Threads OAuth redirect URL, including the hostname and path.",
  "credentials-rejected": "Meta rejected the app credentials. Check the Threads App ID and its matching Threads App Secret in Vercel Production, then redeploy.",
  "token-rejected": "The provider rejected the authorization-code exchange. Check the matching app credentials, exact callback URL and accepted tester invitation, then start a new connection.",
  "identity-rejected": "The access token was issued, but the provider could not verify the account. Check account permissions and tester access, then reconnect.",
  "provider-unavailable": "The provider request could not be completed. Start Connect again shortly.",
  "cookie-capacity": "The provider returned credentials too large for this connection's cookie storage.",
  "configuration": "The server connection settings are incomplete or invalid. Check the provider credentials and callback origin, then redeploy.",
  "unexpected": "The callback could not be completed. Start a new connection; the safe diagnostic code below identifies the failing step.",
} as const;
export type ConnectionIssue = keyof typeof CONNECTION_ISSUES;
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
  const limit = platform === "telegram" ? (kind === "image" ? 1024 : 4096) : ({ facebook: 2200, instagram: 2200, youtube: 5000, threads: 500, pinterest: 800, tumblr: 10000, blogger: 20000, wordpress: 20000, x: 280, bluesky: 300, mastodon: 500 }[platform]);
  // Conservative code-point checks; platforms still enforce their own weighted/grapheme limits.
  if ([...text].length > limit) return `${LABELS[platform]}: shorten this draft to ${limit.toLocaleString()} characters including the URL and hashtags.`;
  if ((["pinterest", "youtube", "blogger", "wordpress"].includes(platform)) && !draft.title.trim()) return `Add a title for ${LABELS[platform]}.`;
  if ((["pinterest", "youtube", "blogger", "wordpress"].includes(platform)) && [...draft.title].length > 100) return "Keep the title within 100 characters.";
  if ([...draft.alt].length > 1000) return "Keep image alt text within 1,000 characters.";
  if (platform === "pinterest" && !/^\d+$/.test(draft.board)) return "Choose a Pinterest board.";
  if (platform === "blogger" && kind === "image" && !validPublicImageUrl(draft.imageUrl)) return "Blogger image posts need a public HTTPS image URL. Blogger uses that image instead of the uploaded file.";
  if (platform === "instagram" && draft.hashtags.split(/[\s,]+/).filter(Boolean).length > 30) return "Use at most 30 Instagram hashtags.";
  return null;
}

export function validPublicImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && /^[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(url.hostname)
      && !/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) && !/^[\d.]+$/.test(url.hostname);
  } catch { return false; }
}
