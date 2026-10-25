import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial, metaConfig } from "@/lib/socialAuth";
import { publishImage, PublishError } from "@/lib/socialPost";
import { publishMedia } from "@/lib/socialMedia";
import { publishYoutube, seal, unseal, YOUTUBE_COOKIE, type YoutubeSession } from "@/lib/youtube";
import { isPlatform, postText, validateDraft, type Draft, type PostKind } from "@/lib/publisher/model";
import { cookieName, currentConnection, publisherCookie, type Connection, oauthPlatforms, identity, type OAuthPlatform } from "@/lib/publisher/connections";
import { publishExtra, providerRequest } from "@/lib/publisher/adapters";
import { serverThreadsConnection } from "@/lib/publisher/threads";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: NextRequest) {
  const renewed: Connection[] = [];
  const reply = (data: unknown, status = 200) => {
    const response = NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
    for (const session of renewed) {
      const value = seal(session);
      if (value.length <= 3600) response.cookies.set(cookieName(session.platform), value, { ...publisherCookie, maxAge: Math.max(1, Math.floor((session.expires - Date.now()) / 1000)) });
    }
    return response;
  };
  const auth = await authorizeSocial(request); if (auth) return reply({ error: auth }, 401);
  try {
    if (Number(request.headers.get("content-length")) > 4250000) return reply({ error: "Media exceeds the 4 MB transfer limit." }, 413);
    const data = await request.formData();
    const platform = String(data.get("platform")), kind = String(data.get("kind")) as PostKind;
    if (!isPlatform(platform) || !["image", "text", "video"].includes(kind)) return reply({ error: "Choose a supported platform and post format." }, 400);
    const draft: Draft = { title: String(data.get("title") ?? ""), caption: String(data.get("caption") ?? ""), url: String(data.get("url") ?? ""), hashtags: String(data.get("hashtags") ?? ""), alt: String(data.get("alt") ?? ""), board: String(data.get("board") ?? ""), imageUrl: String(data.get("imageUrl") ?? "") };
    if (Object.values(draft).some(value => value.length > 20000)) return reply({ error: "Draft is too large." }, 400);
    const invalid = validateDraft(platform, kind, draft); if (invalid) return reply({ error: invalid }, 400);
    const file = data.get("file");
    let media: Blob | null = null;
    if (kind !== "text" && platform !== "blogger") {
      if (!(file instanceof Blob) || file.size < 12 || file.size > (kind === "image" ? 3000000 : 4000000)) return reply({ error: "Choose a JPEG under 3 MB or an MP4 under 4 MB." }, 400);
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (kind === "image" ? file.type !== "image/jpeg" || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 : file.type !== "video/mp4" || new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp") return reply({ error: "The media file does not match the selected format." }, 400);
      media = file;
    }
    if (kind === "text") draft.imageUrl = "";
    const text = postText(draft);
    if (platform === "youtube") {
      let session: YoutubeSession;
      try { session = unseal<YoutubeSession>(request.cookies.get(YOUTUBE_COOKIE)?.value ?? ""); } catch { return reply({ error: "Connect your YouTube channel first." }, 401); }
      return reply(await publishYoutube(session, media!, text, draft.title));
    }
    if (platform === "facebook" || platform === "instagram") {
      const config = metaConfig();
      if (kind === "image") return reply(await publishImage(config, platform, media!, text));
      if (kind === "video") return reply(await publishMedia(config, platform === "facebook" ? "facebook-reel" : "instagram-reel", media!, text));
      const response = await providerRequest(`https://graph.facebook.com/${config.version}/${config.pageId}/feed`, { method: "POST", headers: { Authorization: `Bearer ${config.token}` }, body: new URLSearchParams({ message: text, ...(draft.url ? { link: draft.url } : {}) }) }, true);
      let result; try { result = await response.json(); } catch { throw new PublishError("Facebook did not confirm the post. Check the Page before retrying.", true); }
      if (!result.id) throw new PublishError("Facebook did not confirm a post ID. Check the Page before retrying.", true);
      return reply({ id: result.id, url: `https://www.facebook.com/${encodeURIComponent(result.id)}` });
    }
    const serverSession = platform === "threads" ? await serverThreadsConnection() : null;
    const session = serverSession ?? await currentConnection(request.cookies.get(cookieName(platform))?.value, platform);
    if (session?.refreshToken) renewed.push(session);
    if (oauthPlatforms.includes(platform as OAuthPlatform)) {
      if (!session) return reply({ error: "Connect this account before publishing." }, 401);
      if (!serverSession) {
        const user = await identity(platform as OAuthPlatform, session.accessToken);
        if (user.id !== session.id) return reply({ error: "The connected account changed. Reconnect before publishing." }, 409);
      }
    }
    return reply(await publishExtra(platform, draft, media, session));
  } catch (error) {
    return reply({ error: error instanceof PublishError ? error.message : error instanceof Error && error.name !== "TimeoutError" ? error.message : "Publishing could not be prepared. Check the connection and try again.", uncertain: error instanceof PublishError ? error.uncertain : false }, error instanceof PublishError ? 502 : 400);
  }
}
