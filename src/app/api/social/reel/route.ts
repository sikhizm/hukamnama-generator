import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial } from "@/lib/socialAuth";
import { renderReel } from "@/lib/reelRenderer";

export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const auth = await authorizeSocial(request);
  if (auth) return NextResponse.json({ error: auth }, { status: 401 });
  try {
    if (Number(request.headers.get("content-length")) > 4000000) throw new Error("Use an image and audio totaling less than 4 MB.");
    const body = await request.formData();
    const image = body.get("image"), audio = body.get("audio");
    const value = body.get("duration") ?? "full";
    const duration = value === "full" ? "full" : Number(value);
    if (!(image instanceof Blob) || !(audio instanceof Blob) || image.size + audio.size > 3800000 || audio.size < 32 || image.size < 4) throw new Error("Choose a valid image and a short audio file; combined limit 3.8 MB.");
    const signature = new Uint8Array(await image.slice(0, 3).arrayBuffer());
    if (image.type !== "image/jpeg" || signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) throw new Error("Use a JPEG image.");
    const result = await renderReel(new Uint8Array(await image.arrayBuffer()), new Uint8Array(await audio.arrayBuffer()), duration);
    return new Response(new Uint8Array(result), { headers: { "Content-Type": "video/mp4", "Content-Disposition": 'attachment; filename="hukamnama-reel.mp4"', "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reel creation failed." }, { status: 400 });
  }
}
