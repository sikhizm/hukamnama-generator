import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PublishError } from "./socialPost";

export const YOUTUBE_COOKIE = "sikhizm-youtube";
export const STATE_COOKIE = "sikhizm-youtube-state";
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
export interface YoutubeSession { refreshToken: string; channelId: string; title: string; expires: number }

function cipherKey() {
  const key = process.env.SOCIAL_ADMIN_KEY ?? "";
  if (key.length < 32) throw new Error("Configure the social setup key first.");
  return createHash("sha256").update(`youtube:${key}`).digest();
}
export function seal(value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unseal<T extends { expires: number }>(value: string): T {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", cipherKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const result = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as T;
  if (result.expires < Date.now()) throw new Error("Connection expired; connect YouTube again.");
  return result;
}
export function googleConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID, clientSecret = process.env.YOUTUBE_CLIENT_SECRET, redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REDIRECT_URI in server settings to connect YouTube.");
  return { clientId, clientSecret, redirectUri };
}
export async function googleToken(fields: Record<string, string>, request: typeof fetch = fetch) {
  const config = googleConfig();
  const response = await request("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields }), signal: AbortSignal.timeout(20000), cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("YouTube authorization failed. Connect your channel again.");
  return data as { access_token: string; refresh_token?: string };
}
export async function youtubeChannel(accessToken: string, request: typeof fetch = fetch) {
  const response = await request("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  const channel = data.items?.[0];
  if (!response.ok || !channel?.id) throw new Error("No YouTube channel was returned for this account.");
  if (process.env.YOUTUBE_CHANNEL_ID && channel.id !== process.env.YOUTUBE_CHANNEL_ID) throw new Error("Select the configured Sikhizm YouTube channel.");
  return { channelId: String(channel.id), title: String(channel.snippet.title) };
}
export async function publishYoutube(session: YoutubeSession, file: Blob, caption: string, title: string, request: typeof fetch = fetch) {
  const token = await googleToken({ grant_type: "refresh_token", refresh_token: session.refreshToken }, request);
  const channel = await youtubeChannel(token.access_token, request);
  if (channel.channelId !== session.channelId) throw new Error("The YouTube channel changed. Connect again before publishing.");
  const start = await request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(file.size) },
    body: JSON.stringify({ snippet: { title: [...title].slice(0, 100).join(""), description: caption, categoryId: "22" }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } }), signal: AbortSignal.timeout(20000),
  });
  const location = start.headers.get("location");
  if (!start.ok || !location) throw new Error("YouTube could not start the upload. Check API access and quota.");
  const uploadUrl = new URL(location);
  if (uploadUrl.protocol !== "https:" || !["www.googleapis.com", "upload.youtube.com"].includes(uploadUrl.hostname)) throw new Error("YouTube returned an unexpected upload address.");
  try {
    const response = await request(location, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file, signal: AbortSignal.timeout(60000) });
    const data = await response.json();
    if (!response.ok) throw new PublishError("YouTube rejected the upload. Check your channel and quota.", response.status >= 500);
    if (!data.id) throw new PublishError("YouTube did not confirm a video ID. Check your channel before retrying.", true);
    return { id: String(data.id), url: `https://www.youtube.com/watch?v=${encodeURIComponent(data.id)}`, processing: true };
  } catch (error) {
    if (error instanceof PublishError) throw error;
    throw new PublishError("YouTube upload result was not confirmed. Check your channel before trying again.", true);
  }
}
