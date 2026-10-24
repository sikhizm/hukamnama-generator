import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial } from "@/lib/socialAuth";
import { unseal, YOUTUBE_COOKIE, type YoutubeSession, publishYoutube } from "@/lib/youtube";
import { PublishError } from "@/lib/socialPost";

export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const auth = authorizeSocial(request); if (auth) return reply({ error: auth }, 401);
  let session: YoutubeSession;
  try { session = unseal<YoutubeSession>(request.cookies.get(YOUTUBE_COOKIE)?.value ?? ""); }
  catch { return reply({ error: "Connect your YouTube channel first." }, 401); }
  if (request.nextUrl.searchParams.get("status") === "1") return reply({ channelId: session.channelId, title: session.title });
  try {
    if (Number(request.headers.get("content-length")) > 4250000) return reply({ error: "Video exceeds 4 MB." }, 413);
    const body = await request.formData(); const file = body.get("file");
    const caption = String(body.get("caption") ?? ""), title = String(body.get("title") ?? "Daily Hukamnama");
    if (!(file instanceof Blob) || file.type !== "video/mp4" || file.size > 4000000 || file.size < 12) return reply({ error: "Use an MP4 reel under 4 MB." }, 400);
    const bytes = new Uint8Array(await file.slice(4, 8).arrayBuffer());
    if (new TextDecoder().decode(bytes) !== "ftyp" || [...caption].length > 5000) return reply({ error: "Use a valid MP4 and a description under 5,000 characters." }, 400);
    return reply(await publishYoutube(session, file, caption, title));
  } catch (error) { return reply({ error: (error as Error).message, uncertain: error instanceof PublishError ? error.uncertain : false }, 502); }
}
