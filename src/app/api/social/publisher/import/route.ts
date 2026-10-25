import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial } from "@/lib/socialAuth";
import { fetchArticleResource, parseArticle, readLimited } from "@/lib/publisher/importArticle";

export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const auth = await authorizeSocial(request); if (auth) return reply({ error: auth }, 401);
  try {
    if (Number(request.headers.get("content-length")) > 10000) return reply({ error: "Request too large." }, 413);
    const body = await request.json();
    if (typeof body.url !== "string" || body.url.length > 2048) return reply({ error: "Paste a Sikhizm article URL." }, 400);
    const { response, url } = await fetchArticleResource(body.url);
    const type = response.headers.get("content-type")?.split(";")[0];
    if (body.image === true) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(type ?? "")) throw new Error("The featured image must be a JPG, PNG or WebP file.");
      const bytes = await readLimited(response, 3500000);
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type!, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    if (type !== "text/html") throw new Error("Use an article page rather than a download or media URL.");
    return reply(parseArticle(new TextDecoder().decode(await readLimited(response, 1500000)), url));
  } catch (error) { return reply({ error: error instanceof Error && error.name !== "TimeoutError" ? error.message : "Import timed out. Try again or create the draft manually." }, 400); }
}
