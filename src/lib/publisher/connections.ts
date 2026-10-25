import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { seal, unseal } from "../youtube";
import { type Platform, LABELS, CONNECTION_ISSUES, type ConnectionIssue } from "./model";

export class OAuthConnectionError extends Error {
  constructor(public issue: ConnectionIssue, public httpStatus?: number, public providerCode?: number, public providerSubcode?: number) { super(CONNECTION_ISSUES[issue]); }
}
function safeNumber(value: unknown): number | undefined { return (typeof value === "number" || typeof value === "string") && /^\d{1,9}$/.test(String(value)) ? Number(value) : undefined; }
export function connectionFailure(error: unknown) {
  return error instanceof OAuthConnectionError ? error : new OAuthConnectionError("unexpected");
}

export type OAuthPlatform = "threads" | "pinterest" | "linkedin" | "x" | "mastodon";
export type Connection = { platform: Platform; accessToken: string; id: string; name: string; expires: number };
export type OAuthState = { platform: OAuthPlatform; state: string; verifier: string; expires: number };
export const oauthPlatforms: OAuthPlatform[] = ["threads", "pinterest", "linkedin", "x", "mastodon"];
export const cookieName = (platform: Platform) => `publisher-${platform}`;
export const stateName = (platform: string) => `publisher-state-${platform}`;
export const publisherCookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/social/publisher" };

export function mastodonOrigin() {
  const url = new URL(process.env.MASTODON_SERVER ?? "https://mastodon.social");
  if (url.protocol !== "https:" || url.port || url.username || url.password || !/^[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname)) throw new Error("Configure a public HTTPS Mastodon server.");
  return url.origin;
}
export function oauthConfig(platform: OAuthPlatform) {
  const prefix = platform.toUpperCase();
  const id = process.env[`${prefix}_CLIENT_ID`], secret = process.env[`${prefix}_CLIENT_SECRET`];
  const base = process.env.PUBLISHER_REDIRECT_BASE;
  if (!id || !secret || !base) throw new Error(`Add ${prefix}_CLIENT_ID, ${prefix}_CLIENT_SECRET and PUBLISHER_REDIRECT_BASE in server settings.`);
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("PUBLISHER_REDIRECT_BASE must be the app's HTTPS origin.");
  const redirect = `${origin.origin}/api/social/publisher/callback/${platform}`;
  const mastodon = platform === "mastodon" ? mastodonOrigin() : "https://mastodon.social";
  const configs = {
    threads: { authorize: "https://threads.com/oauth/authorize", token: "https://graph.threads.com/oauth/access_token", scope: "threads_basic,threads_content_publish" },
    pinterest: { authorize: "https://www.pinterest.com/oauth/", token: "https://api.pinterest.com/v5/oauth/token", scope: "user_accounts:read,boards:read,pins:read,pins:write" },
    linkedin: { authorize: "https://www.linkedin.com/oauth/v2/authorization", token: "https://www.linkedin.com/oauth/v2/accessToken", scope: `openid profile w_member_social${process.env.LINKEDIN_ORGANIZATION_ID ? " w_organization_social" : ""}` },
    x: { authorize: "https://x.com/i/oauth2/authorize", token: "https://api.x.com/2/oauth2/token", scope: "tweet.read tweet.write users.read media.write" },
    mastodon: { authorize: `${mastodon}/oauth/authorize`, token: `${mastodon}/oauth/token`, scope: "read:accounts write:statuses write:media" },
  };
  return { id, secret, redirect, ...configs[platform] };
}
export function startOAuth(platform: OAuthPlatform) {
  const config = oauthConfig(platform);
  const saved: OAuthState = { platform, state: randomBytes(32).toString("base64url"), verifier: randomBytes(48).toString("base64url"), expires: Date.now() + 600000 };
  const url = new URL(config.authorize);
  url.search = new URLSearchParams({ client_id: config.id, redirect_uri: config.redirect, response_type: "code", scope: config.scope, state: saved.state }).toString();
  if (platform === "x") { url.searchParams.set("code_challenge_method", "S256"); url.searchParams.set("code_challenge", createHash("sha256").update(saved.verifier).digest("base64url")); }
  return { url: url.toString(), cookie: seal(saved) };
}
export function verifyState(cookie: string, platform: OAuthPlatform, state: string): OAuthState {
  if (!cookie) throw new OAuthConnectionError("state-missing");
  let saved: OAuthState;
  try { saved = unseal<OAuthState>(cookie); } catch { throw new OAuthConnectionError("state-invalid"); }
  const a = Buffer.from(saved.state), b = Buffer.from(state);
  if (saved.platform !== platform || !b.length || a.length !== b.length || !timingSafeEqual(a, b)) throw new OAuthConnectionError("state-invalid");
  return saved;
}
export function readConnection(cookie: string | undefined, platform: Platform): Connection | null {
  try { const session = unseal<Connection>(cookie ?? ""); return session.platform === platform && session.accessToken && session.id ? session : null; } catch { return null; }
}
export async function accountJson(url: string, token: string, request: typeof fetch = fetch) {
  let response: Response;
  try { response = await request(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new OAuthConnectionError("provider-unavailable"); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new OAuthConnectionError("identity-rejected", response.status, safeNumber(data?.error?.code), safeNumber(data?.error?.error_subcode));
  return data;
}
export async function identity(platform: OAuthPlatform, token: string, request: typeof fetch = fetch) {
  let id: string, name: string;
  if (platform === "threads") { const data = await accountJson("https://graph.threads.com/v1.0/me?fields=id,username", token, request); id = data.id; name = data.username; }
  else if (platform === "pinterest") { const data = await accountJson("https://api.pinterest.com/v5/user_account", token, request); id = data.username; name = data.username; }
  else if (platform === "linkedin") { const data = await accountJson("https://api.linkedin.com/v2/userinfo", token, request); id = data.sub; name = data.name; }
  else if (platform === "x") { const data = await accountJson("https://api.x.com/2/users/me", token, request); id = data.data?.id; name = data.data?.username; }
  else { const data = await accountJson(`${mastodonOrigin()}/api/v1/accounts/verify_credentials`, token, request); id = data.id; name = data.acct; }
  if (!id || !name) throw new OAuthConnectionError("identity-rejected");
  if (platform === "linkedin" && process.env.LINKEDIN_ORGANIZATION_ID) {
    const organization = process.env.LINKEDIN_ORGANIZATION_ID;
    if (!/^\d+$/.test(organization)) throw new Error("LINKEDIN_ORGANIZATION_ID must contain digits only.");
    return { id: `urn:li:organization:${organization}`, name: `Company ${organization} · authorised by ${name}` };
  }
  return { id: platform === "linkedin" ? `urn:li:person:${id}` : String(id), name: String(name) };
}
export async function finishOAuth(platform: OAuthPlatform, code: string, state: OAuthState, request: typeof fetch = fetch): Promise<Connection> {
  let config: ReturnType<typeof oauthConfig>;
  try { config = oauthConfig(platform); } catch { throw new OAuthConnectionError("configuration"); }
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirect, client_id: config.id });
  const headers: Record<string, string> = {};
  if (platform === "pinterest" || platform === "x") headers.Authorization = `Basic ${Buffer.from(`${config.id}:${config.secret}`).toString("base64")}`;
  else body.set("client_secret", config.secret);
  if (platform === "x") body.set("code_verifier", state.verifier);
  let response: Response;
  try { response = await request(config.token, { method: "POST", body, headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) }); }
  catch { throw new OAuthConnectionError("provider-unavailable"); }
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.access_token !== "string") {
    // Classify internally; never forward provider messages, tokens, codes or secrets.
    const message = String(data?.error?.message ?? data?.error_message ?? "");
    const issue = /redirect[_ ]?uri|redirect url/i.test(message) ? "redirect-mismatch" : /client secret|app secret|invalid client|invalid app/i.test(message) ? "credentials-rejected" : "token-rejected";
    throw new OAuthConnectionError(issue, response.status, safeNumber(data?.error?.code ?? data?.code), safeNumber(data?.error?.error_subcode));
  }
  const details = await identity(platform, data.access_token, request);
  // Deliberately expire with the access token. No silent posting using expired credentials.
  const lifetime = Math.min(Number(data.expires_in) || (platform === "threads" ? 3600 : 86400 * 30), 86400 * 30);
  return { platform, accessToken: data.access_token, ...details, expires: Date.now() + lifetime * 1000 };
}
export function setupMessage(platform: Platform): string {
  if (platform === "telegram") return "Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the server; give the bot channel posting permission.";
  if (platform === "bluesky") return "Add BLUESKY_IDENTIFIER and a BLUESKY_APP_PASSWORD on the server. Main account passwords are not used.";
  if (platform === "youtube") return "Uses your existing YouTube connection. Channel owner authorization may be required.";
  if (platform === "facebook" || platform === "instagram") return "Uses the existing Meta connection. Check token expiry and Page permissions.";
  return `Configure ${LABELS[platform]} developer credentials, callback URL and publishing permissions, then connect.${platform === "x" ? " X API usage is paid." : ""}`;
}
