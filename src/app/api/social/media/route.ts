import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial, metaConfig } from "@/lib/socialAuth";
import { publishMedia, type MediaTarget } from "@/lib/socialMedia";
import { PublishError } from "@/lib/socialPost";

export const maxDuration = 180;
export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const auth = authorizeSocial(request);
  if (auth) return reply({ error: auth }, 401);
  try {
    const config = metaConfig();
    if (Number(request.headers.get("content-length")) > 4250000) return reply({ error: "Media exceeds 4 MB." }, 413);
    const body = await request.formData();
    const target = String(body.get("target")) as MediaTarget;
    const file = body.get("file");
    const caption = String(body.get("caption") ?? "");
    if (!["facebook-reel", "instagram-reel", "facebook-story", "instagram-story"].includes(target)) return reply({ error: "Choose a supported destination." }, 400);
    if (!(file instanceof Blob) || file.size > 4000000 || file.size < 12) return reply({ error: "Choose media under 4 MB." }, 400);
    if (target === "instagram-reel" && [...caption].length > 2200) return reply({ error: "Instagram captions must fit within 2,200 characters. Shorten the publishing template without cutting Gurbani." }, 400);
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const video = target.endsWith("reel");
    if (video ? file.type !== "video/mp4" || new TextDecoder().decode(signature.slice(4, 8)) !== "ftyp" : file.type !== "image/jpeg" || signature[0] !== 255 || signature[1] !== 216) return reply({ error: "Choose a valid MP4 reel or JPEG story image." }, 400);
    return reply(await publishMedia(config, target, file, caption));
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Publishing failed.", uncertain: error instanceof PublishError ? error.uncertain : false }, 502);
  }
}
