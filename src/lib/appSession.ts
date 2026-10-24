import { createHash, timingSafeEqual } from "node:crypto";
import { unsealData, type SessionOptions } from "iron-session";

export const APP_COOKIE = "sikhizm-app-session";
export const SESSION_TTL = 30 * 86400;
export interface AppSession { username: string; version: string; expires: number }
export function loginConfigured() {
  return !!process.env.APP_USERNAME && (process.env.APP_PASSWORD?.length ?? 0) >= 12 && ((process.env.APP_SESSION_SECRET ?? process.env.SOCIAL_ADMIN_KEY)?.length ?? 0) >= 32;
}
export function sessionOptions(): SessionOptions {
  const password = process.env.APP_SESSION_SECRET ?? process.env.SOCIAL_ADMIN_KEY ?? "";
  if (!loginConfigured()) throw new Error("Configure APP_USERNAME, APP_PASSWORD (at least 12 characters), and a session secret of at least 32 characters.");
  return { cookieName: APP_COOKIE, password, ttl: SESSION_TTL, cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL } };
}
export function credentialsVersion() {
  return createHash("sha256").update(`${process.env.APP_USERNAME}\0${process.env.APP_PASSWORD}`).digest("hex");
}
export function correctCredentials(username: string, password: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const correctUser = timingSafeEqual(digest(username), digest(process.env.APP_USERNAME ?? ""));
  const correctPassword = timingSafeEqual(digest(password), digest(process.env.APP_PASSWORD ?? ""));
  return loginConfigured() && correctUser && correctPassword;
}
export async function readAppSession(cookie?: string): Promise<AppSession | null> {
  if (!cookie || !loginConfigured()) return null;
  try {
    const session = await unsealData<AppSession>(cookie, { password: sessionOptions().password, ttl: SESSION_TTL });
    return session.username === process.env.APP_USERNAME && session.version === credentialsVersion() && session.expires > Date.now() ? session : null;
  } catch { return null; }
}
