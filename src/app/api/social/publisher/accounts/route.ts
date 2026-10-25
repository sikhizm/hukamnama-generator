import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial, metaConfig } from "@/lib/socialAuth";
import { verifyMetaConnection } from "@/lib/metaConnection";
import { googleConfig, googleToken, seal, unseal, YOUTUBE_COOKIE, youtubeChannel, type YoutubeSession } from "@/lib/youtube";
import { PLATFORMS, type Account } from "@/lib/publisher/model";
import { oauthConfig, oauthPlatforms, cookieName, currentConnection, publisherCookie, type Connection, identity, setupMessage, type OAuthPlatform } from "@/lib/publisher/connections";
import { blueskySession, telegramIdentity, pinterestBoards } from "@/lib/publisher/adapters";
import { hasThreadsServerToken, serverThreadsConnection } from "@/lib/publisher/threads";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const renewed: Connection[] = [];
  const reply = (data: unknown, status = 200) => {
    const response = NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
    for (const session of renewed) {
      const value = seal(session);
      if (value.length <= 3600) response.cookies.set(cookieName(session.platform), value, { ...publisherCookie, maxAge: Math.max(1, Math.floor((session.expires - Date.now()) / 1000)) });
    }
    return response;
  };
  const auth = await authorizeSocial(request); if (auth) return reply({ error: auth }, 401);
  const meta = (async () => {
    try { return { result: await verifyMetaConnection(metaConfig()), error: "" }; }
    catch (error) {
      // The connection helper's own errors are safe. Never forward raw Graph payloads.
      const message = error instanceof Error ? error.message : "";
      const safe = /^(Meta could not verify this Page token\.|The token does not belong to the configured Facebook Page\.|Check META_GRAPH_VERSION)/.test(message);
      return { result: null, error: safe ? message : "The existing Meta connection could not be verified. Check the Page token, permissions and server settings, then refresh." };
    }
  })();
  const accounts = await Promise.all(PLATFORMS.map(async (platform): Promise<Account> => {
    const account: Account = { platform, connected: false, configured: false, message: setupMessage(platform) };
    try {
      if (platform === "facebook" || platform === "instagram") {
        try { metaConfig(); account.configured = true; } catch { return account; }
        const checked = await meta, result = checked.result;
        if (result?.[platform].connected) return { ...account, connected: true, id: platform === "facebook" ? result.facebook.id : result.instagram.username ?? "", name: platform === "facebook" ? result.facebook.name : `@${result.instagram.username}`, message: "Account verified." };
        return { ...account, message: checked.error || result?.message || "The existing Meta connection could not be verified. Refresh to check again." };
      } else if (platform === "youtube") {
        try { googleConfig(); account.configured = true; } catch { return account; }
        const session = unseal<YoutubeSession>(request.cookies.get(YOUTUBE_COOKIE)?.value ?? "");
        const token = await googleToken({ grant_type: "refresh_token", refresh_token: session.refreshToken });
        const channel = await youtubeChannel(token.access_token);
        if (channel.channelId !== session.channelId) throw new Error("Channel changed");
        return { ...account, connected: true, id: channel.channelId, name: channel.title, message: "Channel verified. Upload MP4 videos up to 4 MB." };
      } else if (platform === "telegram") {
        account.configured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
        if (account.configured) { const channel = await telegramIdentity(); return { ...account, connected: true, id: channel.id, name: channel.name, message: "Bot channel posting permission verified." }; }
      } else if (platform === "bluesky") {
        account.configured = !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD);
        if (account.configured) { const user = await blueskySession(); return { ...account, connected: true, id: user.id, name: user.name, message: "Account verified with its app password." }; }
      } else if (platform === "threads" && hasThreadsServerToken()) {
        account.configured = true;
        try {
          const session = await serverThreadsConnection();
          if (!session) throw new Error("Save a Threads token in Vercel Production and redeploy.");
          return { ...account, connected: true, id: session.id, name: `@${session.name}`, connection: "server-token", message: "Verified with the saved Threads token. Renew it in Vercel when it expires or is revoked." };
        } catch (error) { return { ...account, connection: "server-token", message: error instanceof Error ? error.message : "The saved Threads token could not be verified." }; }
      } else if (oauthPlatforms.includes(platform as OAuthPlatform)) {
        try { oauthConfig(platform as OAuthPlatform); account.configured = true; } catch { return account; }
        const session = await currentConnection(request.cookies.get(cookieName(platform))?.value, platform);
        if (session?.refreshToken) renewed.push(session);
        if (!session) return account;
        const user = await identity(platform as OAuthPlatform, session.accessToken);
        if (user.id !== session.id) throw new Error("Account changed");
        const boards = platform === "pinterest" ? await pinterestBoards(session.accessToken) : undefined;
        return { ...account, connected: true, id: user.id, name: user.name, message: "Account verified. Reconnect when authorization expires.", ...(boards ? { boards } : {}) };
      }
    } catch { return { ...account, message: `Connection could not be verified. ${setupMessage(platform)}` }; }
    return account;
  }));
  return reply({ accounts });
}
