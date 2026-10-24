import { NextRequest, NextResponse } from "next/server";
import { validAdminKey, verifyMetaConnection } from "@/lib/metaConnection";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
  });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply({ error: "Open this check from the Hukamnama app." }, 403);
  }
  const adminKey = process.env.SOCIAL_ADMIN_KEY ?? "";
  if (!adminKey || adminKey.length < 32) {
    return reply({ error: "Social setup is not configured. Add SOCIAL_ADMIN_KEY (at least 32 characters) in server settings and redeploy." }, 503);
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!validAdminKey(provided, adminKey)) {
    return reply({ error: "Enter the correct social setup key." }, 401);
  }
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const version = process.env.META_GRAPH_VERSION;
  if (!token || !pageId || !version) {
    return reply({ error: "Add META_PAGE_ACCESS_TOKEN, META_PAGE_ID and META_GRAPH_VERSION in server settings and redeploy. Never paste your Meta token into this screen." }, 503);
  }
  try {
    return reply(await verifyMetaConnection({ token, pageId, version }));
  } catch (error) {
    return reply({ error: error instanceof Error && error.name !== "TimeoutError"
      ? error.message : "Meta connection check timed out. Try again." }, 502);
  }
}
