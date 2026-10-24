import { NextRequest, NextResponse } from "next/server";
import { validAdminKey } from "@/lib/metaConnection";
import { composeCaption, publishImage, PublishError } from "@/lib/socialPost";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Open publishing from this app." }, 403);
  const key = process.env.SOCIAL_ADMIN_KEY ?? "";
  if (key.length < 32) return reply({ error: "Configure SOCIAL_ADMIN_KEY in server settings first." }, 503);
  if (!validAdminKey(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", key)) return reply({ error: "Enter the correct social setup key." }, 401);
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const version = process.env.META_GRAPH_VERSION;
  if (!token || !pageId || !version) return reply({ error: "Complete the Meta connection settings first." }, 503);
  if (Number(request.headers.get("content-length")) > 3500000) return reply({ error: "The prepared image is too large." }, 413);
  try {
    const data = await request.formData();
    const platform = data.get("platform");
    const image = data.get("image");
    if (platform !== "facebook" && platform !== "instagram") return reply({ error: "Choose Facebook or Instagram." }, 400);
    if (!(image instanceof Blob) || image.type !== "image/jpeg" || image.size > 3000000 || image.size < 4) return reply({ error: "Use a JPEG image under 3 MB." }, 400);
    const bytes = new Uint8Array(await image.slice(0, 3).arrayBuffer());
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return reply({ error: "The image is not a valid JPEG." }, 400);
    const caption = composeCaption(String(data.get("caption") ?? ""), String(data.get("hashtags") ?? ""));
    return reply(await publishImage({ token, pageId, version }, platform, image, caption));
  } catch (error) {
    if (error instanceof PublishError) return reply({ error: error.message, uncertain: error.uncertain }, 502);
    return reply({ error: error instanceof Error && /caption|hashtags|2,200/.test(error.message) ? error.message : "Could not read this post. Please select the image again." }, 400);
  }
}
