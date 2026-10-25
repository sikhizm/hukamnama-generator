import { PublishError } from "../socialPost";
import { type Draft, type Outcome, type Platform, postText, validPublicImageUrl } from "./model";
import { type Connection, mastodonOrigin, blogTarget, wordpressHost } from "./connections";

type Json = Record<string, unknown>;
export async function providerRequest(url: string, options: RequestInit, publishes = false, request: typeof fetch = fetch): Promise<Response> {
  try {
    const response = await request(url, { ...options, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new PublishError(`The platform rejected this step (HTTP ${response.status}). Check account permissions, connection expiry and content requirements.`, publishes && response.status >= 500);
    return response;
  } catch (error) {
    if (error instanceof PublishError) throw error;
    throw new PublishError(publishes ? "The platform did not confirm the result. Check the account before trying again." : "Could not prepare the platform request. Reconnect or try again shortly.", publishes);
  }
}
async function jsonRequest(url: string, options: RequestInit, publishes: boolean, request: typeof fetch) {
  const response = await providerRequest(url, options, publishes, request);
  try { return await response.json(); } catch { throw new PublishError("The platform returned an unreadable response. Check the account before retrying.", publishes); }
}
export async function blueskySession(request: typeof fetch = fetch) {
  const identifier = process.env.BLUESKY_IDENTIFIER, password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) throw new Error("Configure the Bluesky identifier and app password first.");
  const result = await jsonRequest("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) }, false, request);
  if (!result.accessJwt || !result.did || !result.handle) throw new Error("Bluesky could not verify this account.");
  return { token: String(result.accessJwt), id: String(result.did), name: String(result.handle) };
}
export async function telegramIdentity(request: typeof fetch = fetch) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat || !/^-?\d+$|^@[\w]+$/.test(chat)) throw new Error("Configure the Telegram bot and channel first.");
  const call = (method: string, body: Json) => jsonRequest(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, false, request);
  const bot = await call("getMe", {}), channel = await call("getChat", { chat_id: chat });
  if (!bot.ok || !bot.result?.id || !channel.ok || !channel.result?.id) throw new Error("Telegram could not verify the bot and channel.");
  const member = await call("getChatMember", { chat_id: chat, user_id: bot.result.id });
  if (!member.ok || !["administrator", "creator"].includes(member.result?.status) || (channel.result.type === "channel" && member.result.status !== "creator" && !member.result.can_post_messages)) throw new Error("Give the Telegram bot administrator permission to post in this channel.");
  return { id: String(channel.result.id), name: String(channel.result.title ?? channel.result.username ?? chat) };
}
export async function pinterestBoards(token: string, request: typeof fetch = fetch) {
  const data = await jsonRequest("https://api.pinterest.com/v5/boards?page_size=100", { headers: { Authorization: `Bearer ${token}` } }, false, request);
  return (data.items ?? []).filter((board: { id?: string; name?: string }) => board.id && board.name).map((board: { id: string; name: string }) => ({ id: board.id, name: board.name })) as { id: string; name: string }[];
}
export function linkFacets(text: string) {
  return [...text.matchAll(/https:\/\/[^\s]+/g)].map(match => ({
    index: { byteStart: Buffer.byteLength(text.slice(0, match.index)), byteEnd: Buffer.byteLength(text.slice(0, match.index + match[0].length)) },
    features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
  }));
}
export async function publishExtra(platform: Exclude<Platform, "facebook" | "instagram" | "youtube">, draft: Draft, image: Blob | null, connection: Connection | null, request: typeof fetch = fetch): Promise<Outcome> {
  const text = postText(draft), token = connection?.accessToken ?? "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let id = "", url = "";
  if (platform === "threads") {
    if (!connection) throw new Error("Connect Threads first.");
    let imageUrl = "";
    if (image) {
      const page = process.env.META_PAGE_ID, pageToken = process.env.META_PAGE_ACCESS_TOKEN, version = process.env.META_GRAPH_VERSION;
      if (!page || !pageToken || !version || !/^\d+$/.test(page) || !/^v\d+\.\d+$/.test(version)) throw new Error("Threads image publishing needs the existing Meta media-hosting connection.");
      const body = new FormData(); body.set("source", image, "social-post.jpg"); body.set("published", "false");
      const photo = await jsonRequest(`https://graph.facebook.com/${version}/${page}/photos`, { method: "POST", headers: { Authorization: `Bearer ${pageToken}` }, body }, false, request);
      if (!/^\d+$/.test(String(photo.id))) throw new Error("Meta could not prepare the image.");
      const media = await jsonRequest(`https://graph.facebook.com/${version}/${photo.id}?fields=images`, { headers: { Authorization: `Bearer ${pageToken}` } }, false, request);
      imageUrl = media.images?.[0]?.source;
      if (!imageUrl?.startsWith("https://")) throw new Error("Meta did not return an image address.");
    }
    const container = await jsonRequest(`https://graph.threads.net/v1.0/${connection.id}/threads`, { method: "POST", headers, body: JSON.stringify({ media_type: image ? "IMAGE" : "TEXT", text, ...(image ? { image_url: imageUrl, alt_text: draft.alt } : {}) }) }, false, request);
    if (!/^\d+$/.test(String(container.id))) throw new Error("Threads did not prepare the post.");
    if (image) {
      let ready = false;
      for (let i = 0; i < 8; i++) {
        const status = await jsonRequest(`https://graph.threads.net/v1.0/${container.id}?fields=status`, { headers: { Authorization: `Bearer ${token}` } }, false, request);
        if (status.status === "FINISHED") { ready = true; break; }
        if (["ERROR", "EXPIRED"].includes(status.status)) throw new Error("Threads could not process this image.");
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (!ready) throw new Error("Threads is still processing the image. No publish request was sent.");
    }
    const result = await jsonRequest(`https://graph.threads.net/v1.0/${connection.id}/threads_publish`, { method: "POST", headers, body: JSON.stringify({ creation_id: container.id }) }, true, request);
    id = result.id;
    // Account link is a safe fallback when permalink lookup is unavailable.
    url = `https://www.threads.net/@${encodeURIComponent(connection.name)}`;
    if (id) { try { const details = await jsonRequest(`https://graph.threads.net/v1.0/${id}?fields=permalink`, { headers: { Authorization: `Bearer ${token}` } }, false, request); const parsed = new URL(details.permalink); if (parsed.protocol === "https:" && ["www.threads.net", "www.threads.com", "threads.net", "threads.com"].includes(parsed.hostname)) url = parsed.toString(); } catch { /* Post already published. */ } }
  } else if (platform === "pinterest") {
    if (!connection || !image) throw new Error("Connect Pinterest and choose an image.");
    const boards = await pinterestBoards(token, request);
    if (!boards.some(board => board.id === draft.board)) throw new Error("Choose a board belonging to the connected Pinterest account.");
    const result = await jsonRequest("https://api.pinterest.com/v5/pins", { method: "POST", headers, body: JSON.stringify({ board_id: draft.board, title: draft.title, description: text, ...(draft.url ? { link: draft.url } : {}), alt_text: draft.alt, media_source: { source_type: "image_base64", content_type: "image/jpeg", data: Buffer.from(await image.arrayBuffer()).toString("base64") } }) }, true, request);
    id = result.id; url = `https://www.pinterest.com/pin/${encodeURIComponent(id)}/`;
  } else if (["tumblr", "blogger", "wordpress"].includes(platform)) {
    if (!connection || connection.id !== blogTarget(platform)) throw new Error("Reconnect the configured destination blog before publishing.");
    if (platform === "tumblr") {
      const content: Json[] = [];
      if (draft.title.trim()) content.push({ type: "text", subtype: "heading1", text: draft.title.trim() });
      if (image) content.push({ type: "image", media: [{ type: "image/jpeg", identifier: "post-image" }], alt_text: draft.alt });
      for (const paragraph of text.split(/\n\n+/)) {
        const chars = [...paragraph];
        for (let start = 0; start < chars.length; start += 4000) content.push({ type: "text", text: chars.slice(start, start + 4000).join("") });
      }
      const payload = { content, state: "published", tags: blogTags(draft).join(","), ...(draft.url ? { source_url: draft.url } : {}) };
      const body = new FormData(); body.set("json", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      if (image) body.set("post-image", image, "social-post.jpg");
      const result = await jsonRequest(`https://api.tumblr.com/v2/blog/${encodeURIComponent(connection.id)}/posts`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }, true, request);
      id = result.response?.id; if (id) url = `https://${connection.id}.tumblr.com/post/${encodeURIComponent(id)}`;
    } else if (platform === "blogger") {
      const body = blogHtml(draft, draft.imageUrl);
      const result = await jsonRequest(`https://www.googleapis.com/blogger/v3/blogs/${connection.id}/posts?isDraft=false`, { method: "POST", headers, body: JSON.stringify({ kind: "blogger#post", title: draft.title, content: body, labels: blogTags(draft) }) }, true, request);
      id = result.id; url = safePostUrl(result.url);
    } else {
      let mediaUrl = "", mediaId = "";
      if (image) {
        const body = new FormData(); body.set("media[]", image, "social-post.jpg");
        const upload = await jsonRequest(`https://public-api.wordpress.com/rest/v1.1/sites/${connection.id}/media/new`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }, false, request);
        const uploaded = upload.media?.[0];
        mediaUrl = safePostUrl(uploaded?.URL); mediaId = String(uploaded?.ID ?? "");
        if (!mediaUrl || !/^\d+$/.test(mediaId)) throw new Error("WordPress.com could not prepare the image.");
      }
      const result = await jsonRequest(`https://public-api.wordpress.com/rest/v1.1/sites/${connection.id}/posts/new`, { method: "POST", headers, body: JSON.stringify({ title: draft.title, content: blogHtml(draft, mediaUrl), status: "publish", tags: blogTags(draft).join(","), ...(mediaId ? { featured_image: mediaId } : {}) }) }, true, request);
      id = result.ID; url = wordpressHost(result.URL) ? safePostUrl(result.URL) : "";
    }
  } else if (platform === "x") {
    if (!connection) throw new Error("Connect X first.");
    let mediaId = "";
    if (image) {
      const body = new FormData(); body.set("media", image, "social-post.jpg"); body.set("media_category", "tweet_image"); body.set("media_type", "image/jpeg");
      const upload = await jsonRequest("https://api.x.com/2/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }, false, request);
      mediaId = upload.data?.id;
      if (!mediaId) throw new Error("X could not prepare the image.");
    }
    const result = await jsonRequest("https://api.x.com/2/tweets", { method: "POST", headers, body: JSON.stringify({ text, ...(mediaId ? { media: { media_ids: [mediaId] } } : {}) }) }, true, request);
    id = result.data?.id; url = `https://x.com/i/status/${encodeURIComponent(id)}`;
  } else if (platform === "telegram") {
    const channel = await telegramIdentity(request);
    const body = new FormData(); body.set("chat_id", channel.id); body.set(image ? "caption" : "text", text);
    if (image) body.set("photo", image, "social-post.jpg");
    const result = await jsonRequest(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${image ? "sendPhoto" : "sendMessage"}`, { method: "POST", body }, true, request);
    if (!result.ok) throw new PublishError("Telegram did not confirm the post. Check the channel before retrying.", true);
    id = result.result?.message_id == null ? "" : String(result.result.message_id);
    const chat = result.result?.chat;
    url = chat?.username ? `https://t.me/${encodeURIComponent(chat.username)}/${id}` : channel.id.startsWith("-100") ? `https://t.me/c/${channel.id.slice(4)}/${id}` : "";
  } else if (platform === "bluesky") {
    const session = await blueskySession(request);
    const auth = { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
    let embed: Json | undefined;
    if (image) {
      if (image.size > 1000000) throw new Error("Use an image under 1 MB for Bluesky.");
      const upload = await jsonRequest("https://bsky.social/xrpc/com.atproto.repo.uploadBlob", { method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "image/jpeg" }, body: image }, false, request);
      if (!upload.blob) throw new Error("Bluesky could not prepare this image.");
      embed = { $type: "app.bsky.embed.images", images: [{ alt: draft.alt, image: upload.blob }] };
    }
    const result = await jsonRequest("https://bsky.social/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: auth, body: JSON.stringify({ repo: session.id, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), facets: linkFacets(text), ...(embed ? { embed } : {}) } }) }, true, request);
    id = result.uri; url = `https://bsky.app/profile/${encodeURIComponent(session.name)}/post/${encodeURIComponent(String(id).split("/").pop() ?? "")}`;
  } else if (platform === "mastodon") {
    if (!connection) throw new Error("Connect Mastodon first.");
    const base = mastodonOrigin(); let mediaId = "";
    if (image) {
      const body = new FormData(); body.set("file", image, "social-post.jpg"); body.set("description", draft.alt);
      let media = await jsonRequest(`${base}/api/v2/media`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }, false, request);
      mediaId = media.id;
      if (!/^\d+$/.test(mediaId ?? "")) throw new Error("Mastodon could not prepare this image.");
      for (let i = 0; !media.url && i < 8; i++) { await new Promise(resolve => setTimeout(resolve, 1500)); media = await jsonRequest(`${base}/api/v1/media/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } }, false, request); }
      if (!media.url) throw new Error("Mastodon is still processing the image. No post was sent.");
    }
    const result = await jsonRequest(`${base}/api/v1/statuses`, { method: "POST", headers, body: JSON.stringify({ status: text, visibility: "public", ...(mediaId ? { media_ids: [mediaId] } : {}) }) }, true, request);
    id = result.id; try { const parsed = new URL(result.url); if (parsed.protocol === "https:" && parsed.origin === base) url = parsed.toString(); } catch { /* Publishing succeeded even if no permalink is returned. */ }
  }
  if (!id) throw new PublishError("The platform did not confirm a post ID. Check your account before retrying.", true);
  return { id: String(id), ...(url ? { url } : {}) };
}

function blogTags(draft: Draft): string[] { return [...new Set(draft.hashtags.split(/[\s,]+/).map(tag => tag.replace(/^#+/, "")).filter(Boolean))].slice(0, 30); }
export function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)); }
function safePostUrl(value: unknown): string {
  try { const url = new URL(String(value)); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : ""; } catch { return ""; }
}
export function blogHtml(draft: Draft, imageUrl = ""): string {
  if (imageUrl && !validPublicImageUrl(imageUrl)) throw new Error("Use a public HTTPS image URL for the blog image.");
  const copy = postText({ ...draft, url: "" });
  return (imageUrl ? `<p><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(draft.alt)}" /></p>` : "")
    + copy.split(/\n\n+/).filter(Boolean).map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join("")
    + (draft.url ? `<p><a href="${escapeHtml(draft.url)}">Read the original article</a></p>` : "");
}
