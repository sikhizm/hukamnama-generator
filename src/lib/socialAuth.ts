import { NextRequest } from "next/server";
import { APP_COOKIE, readAppSession } from "./appSession";

export async function authorizeSocial(request: NextRequest): Promise<string | null> {
  if (request.headers.get("origin") !== request.nextUrl.origin) return "Open this action from the app.";
  if (!await readAppSession(request.cookies.get(APP_COOKIE)?.value)) return "Your session expired. Sign in again.";
  return null;
}

export function metaConfig() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const version = process.env.META_GRAPH_VERSION;
  if (!token || !pageId || !version || !/^\d+$/.test(pageId) || !/^v\d+\.\d+$/.test(version)) throw new Error("Complete the Meta server settings first.");
  return { token, pageId, version };
}
