export type Platform = "facebook" | "instagram";

export function composeCaption(caption: string, hashtags: string): string {
  const tags = [...new Set(hashtags.split(/[\s,]+/).filter(Boolean).map(tag => `#${tag.replace(/^#+/, "")}`).filter(tag => tag !== "#"))];
  if (tags.length > 30) throw new Error("Use at most 30 hashtags.");
  const text = [caption.trim(), tags.join(" ")].filter(Boolean).join("\n\n");
  if (!text) throw new Error("Add a caption or hashtags before publishing.");
  if ([...text].length > 2200) throw new Error("Keep the caption and hashtags within 2,200 characters.");
  return text;
}

export class PublishError extends Error {
  constructor(message: string, public uncertain = false) { super(message); }
}

type Config = { token: string; pageId: string; version: string };

// Only Meta receives the image. Instagram requires a publicly fetchable URL;
// an unpublished Page photo supplies it without a separate storage service.
export async function publishImage(config: Config, platform: Platform, image: Blob, caption: string, request: typeof fetch = fetch) {
  if (!/^v\d+\.\d+$/.test(config.version) || !/^\d+$/.test(config.pageId)) throw new PublishError("Check the Meta server settings.");
  const base = `https://graph.facebook.com/${config.version}`;
  async function graph(path: string, body?: FormData | URLSearchParams, publishes = false): Promise<Record<string, unknown>> {
    try {
      const response = await request(`${base}/${path}`, {
        method: body ? "POST" : "GET", body,
        headers: { Authorization: `Bearer ${config.token}` },
        cache: "no-store", signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const code = Number(data.error?.code);
        throw new PublishError(`Meta rejected this step${Number.isFinite(code) ? ` (code ${code})` : ""}. Check account permissions, token expiry and image requirements.`, publishes && response.status >= 500);
      }
      return data;
    } catch (error) {
      if (error instanceof PublishError) throw error;
      throw new PublishError(publishes ? "Meta did not confirm the result. Check your account before trying again to avoid a duplicate." : "Could not complete the Meta request. Try again shortly.", publishes);
    }
  }
  const identity = await graph("me?fields=id,name,instagram_business_account{id,username}");
  if (identity.id !== config.pageId) throw new PublishError("This token does not belong to the configured Facebook Page.");
  const instagram = identity.instagram_business_account as { id?: string; username?: string } | undefined;
  if (platform === "instagram" && (instagram?.username?.toLowerCase() !== "sikhizmcom" || !/^\d+$/.test(instagram.id ?? ""))) {
    throw new PublishError("The configured Page must be linked to @sikhizmcom before Instagram publishing.");
  }
  const upload = new FormData();
  upload.set("source", image, "gurbani-post.jpg");
  upload.set("published", platform === "facebook" ? "true" : "false");
  if (platform === "facebook") upload.set("message", caption);
  const photo = await graph(`${config.pageId}/photos`, upload, platform === "facebook");
  if (typeof photo.id !== "string" || !/^\d+$/.test(photo.id)) throw new PublishError("Meta did not return a photo ID. Check the Page before trying again.", platform === "facebook");
  if (platform === "facebook") return { id: photo.id, url: `https://www.facebook.com/photo.php?fbid=${photo.id}` };

  const media = await graph(`${photo.id}?fields=images`);
  const images = media.images as { source: string; width: number }[] | undefined;
  const source = images?.slice().sort((a, b) => b.width - a.width)[0]?.source;
  if (!source || !source.startsWith("https://")) throw new PublishError("Meta could not prepare the image URL for Instagram.");
  const container = await graph(`${instagram!.id}/media`, new URLSearchParams({ image_url: source, caption }));
  if (typeof container.id !== "string" || !/^\d+$/.test(container.id)) throw new PublishError("Instagram did not return a media container.");
  // Wait for readiness before publishing; never retry the publishing call.
  let ready = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const status = await graph(`${container.id}?fields=status_code`);
    if (status.status_code === "FINISHED") { ready = true; break; }
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new PublishError("Instagram could not process this image. Check its requirements and try again.");
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (!ready) throw new PublishError("Instagram is taking too long to prepare the image. No publish request was sent.");
  const published = await graph(`${instagram!.id}/media_publish`, new URLSearchParams({ creation_id: container.id }), true);
  if (typeof published.id !== "string") throw new PublishError("Instagram did not confirm a post ID. Check the account before trying again.", true);
  let url = "https://www.instagram.com/sikhizmcom/";
  try {
    const result = await graph(`${published.id}?fields=permalink`);
    if (typeof result.permalink === "string" && result.permalink.startsWith("https://www.instagram.com/")) url = result.permalink;
  } catch { /* Publishing already succeeded; permalink lookup is optional. */ }
  return { id: published.id, url };
}
