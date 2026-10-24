import { timingSafeEqual } from "node:crypto";

export function validAdminKey(provided: string, expected: string): boolean {
  if (expected.length < 32 || provided.length > 512) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface MetaIdentity {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username: string };
}

export async function verifyMetaConnection(
  config: { version: string; token: string; pageId: string },
  request: typeof fetch = fetch,
) {
  if (!/^v\d+\.\d+$/.test(config.version) || !/^\d+$/.test(config.pageId)) {
    throw new Error("Check META_GRAPH_VERSION and META_PAGE_ID in server settings.");
  }
  const url = new URL(`https://graph.facebook.com/${config.version}/me`);
  url.searchParams.set("fields", "id,name,instagram_business_account{id,username}");
  const response = await request(url, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Do not echo Graph errors: they may include credentials or account details.
    throw new Error("Meta could not verify this Page token. Check its expiry and Page/Instagram access permissions.");
  }
  const page = await response.json() as MetaIdentity;
  if (page.id !== config.pageId || typeof page.name !== "string") {
    throw new Error("The token does not belong to the configured Facebook Page. Use a Page access token for Sikhizm.");
  }
  const instagram = page.instagram_business_account;
  return {
    facebook: { id: page.id, name: page.name, connected: true },
    instagram: instagram?.username?.toLowerCase() === "sikhizmcom"
      ? { username: instagram.username, connected: true }
      : { username: null, connected: false },
    message: instagram?.username?.toLowerCase() === "sikhizmcom"
      ? "Page identity and linked @sikhizmcom account verified. Publishing permissions will be tested in the next step."
      : "Facebook Page verified. Link the @sikhizmcom professional Instagram account to this Page, then check again.",
  };
}
