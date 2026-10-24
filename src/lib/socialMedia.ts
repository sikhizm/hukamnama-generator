import { PublishError } from "./socialPost";

type Config = { token: string; pageId: string; version: string };
export type MediaTarget = "facebook-reel" | "instagram-reel" | "facebook-story" | "instagram-story";

export async function publishMedia(config: Config, target: MediaTarget, file: Blob, caption: string, request: typeof fetch = fetch) {
  const base = `https://graph.facebook.com/${config.version}`;
  async function graph(path: string, body?: FormData | URLSearchParams, publishing = false): Promise<Record<string, unknown>> {
    try {
      const response = await request(`${base}/${path}`, { method: body ? "POST" : "GET", body, headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok || data.error) throw new PublishError(`Meta rejected ${target}${data.error?.code ? ` (code ${Number(data.error.code)})` : ""}. Check publishing permissions and account eligibility.`, publishing && response.status >= 500);
      return data;
    } catch (error) {
      if (error instanceof PublishError) throw error;
      throw new PublishError(publishing ? "Result not confirmed. Check the account before publishing again." : "Meta could not complete media preparation.", publishing);
    }
  }
  async function upload(url: string, data: Blob) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "rupload.facebook.com") throw new PublishError("Meta returned an unexpected upload address.");
    try {
      const response = await request(url, { method: "POST", headers: { Authorization: `OAuth ${config.token}`, offset: "0", file_size: String(data.size), "Content-Type": "application/octet-stream" }, body: data, signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error();
    } catch { throw new PublishError("Meta video upload failed. No publishing request was sent."); }
  }
  const page = await graph("me?fields=id,instagram_business_account{id,username,account_type}");
  if (page.id !== config.pageId) throw new PublishError("The token does not belong to the configured Page.");
  const ig = page.instagram_business_account as { id: string; username: string; account_type: string } | undefined;
  if (target.startsWith("instagram") && (!ig || ig.username?.toLowerCase() !== "sikhizmcom")) throw new PublishError("Connect the expected @sikhizmcom professional account first.");
  if (target === "instagram-story" && ig?.account_type !== "BUSINESS") throw new PublishError("Instagram API story publishing requires a Business account. Reel publishing also supports Creator accounts.");

  if (target === "facebook-reel") {
    const session = await graph(`${config.pageId}/video_reels`, new URLSearchParams({ upload_phase: "start" }));
    if (typeof session.video_id !== "string" || typeof session.upload_url !== "string") throw new PublishError("Facebook did not create a reel upload session.");
    await upload(session.upload_url, file);
    const finished = await graph(`${config.pageId}/video_reels`, new URLSearchParams({ upload_phase: "finish", video_id: session.video_id, video_state: "PUBLISHED", description: caption }), true);
    if (finished.success !== true) throw new PublishError("Facebook did not confirm the reel. Check the Page before retrying.", true);
    return { id: session.video_id, url: `https://www.facebook.com/reel/${session.video_id}`, processing: true };
  }
  let imageUrl = "";
  if (target.endsWith("story")) {
    const form = new FormData(); form.set("source", file, "hukamnama-story.jpg"); form.set("published", "false");
    const photo = await graph(`${config.pageId}/photos`, form);
    if (typeof photo.id !== "string" || !/^\d+$/.test(photo.id)) throw new PublishError("Facebook did not return a staged photo ID.");
    if (target === "facebook-story") {
      const result = await graph(`${config.pageId}/photo_stories`, new URLSearchParams({ photo_id: photo.id }), true);
      if (!result.success && !result.post_id) throw new PublishError("Facebook did not confirm the story. Check the Page before retrying.", true);
      return { id: String(result.post_id ?? photo.id), url: `https://www.facebook.com/${config.pageId}`, processing: false };
    }
    const photoData = await graph(`${photo.id}?fields=images`);
    const images = photoData.images as { source: string; width: number }[];
    imageUrl = images?.slice().sort((a, b) => b.width - a.width)[0]?.source;
    if (!imageUrl?.startsWith("https://")) throw new PublishError("Meta could not prepare the story image.");
  }
  const container = await graph(`${ig!.id}/media`, new URLSearchParams(target === "instagram-reel"
    ? { media_type: "REELS", upload_type: "resumable", caption, share_to_feed: "true" }
    : { media_type: "STORIES", image_url: imageUrl }));
  if (typeof container.id !== "string" || !/^\d+$/.test(container.id)) throw new PublishError("Instagram did not create a media container.");
  if (target === "instagram-reel") await upload(`https://rupload.facebook.com/ig-api-upload/${config.version}/${container.id}`, file);
  let ready = false;
  for (let n = 0; n < 15; n++) {
    const status = await graph(`${container.id}?fields=status_code`);
    if (status.status_code === "FINISHED") { ready = true; break; }
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new PublishError("Instagram could not process the media. No publish request was sent.");
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  if (!ready) throw new PublishError("Instagram is still processing. No publish request was sent; try again later.");
  const result = await graph(`${ig!.id}/media_publish`, new URLSearchParams({ creation_id: container.id }), true);
  if (typeof result.id !== "string") throw new PublishError("Instagram did not confirm a post ID. Check the account before retrying.", true);
  return { id: result.id, url: "https://www.instagram.com/sikhizmcom/", processing: false };
}
