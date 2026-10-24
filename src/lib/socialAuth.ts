import { NextRequest } from "next/server";
import { validAdminKey } from "./metaConnection";

export function authorizeSocial(request: NextRequest): string | null {
  if (request.headers.get("origin") !== request.nextUrl.origin) return "Open this action from the app.";
  const expected = process.env.SOCIAL_ADMIN_KEY ?? "";
  if (!validAdminKey(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", expected)) return "Enter the correct social setup key.";
  return null;
}

export function metaConfig() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const version = process.env.META_GRAPH_VERSION;
  if (!token || !pageId || !version || !/^\d+$/.test(pageId) || !/^v\d+\.\d+$/.test(version)) throw new Error("Complete the Meta server settings first.");
  return { token, pageId, version };
}
