import { NextRequest, NextResponse } from "next/server";
import { authorizeSocial, metaConfig } from "@/lib/socialAuth";
import { verifyMetaConnection } from "@/lib/metaConnection";
import { googleConfig, googleToken, unseal, YOUTUBE_COOKIE, youtubeChannel, type YoutubeSession } from "@/lib/youtube";
import { PLATFORMS, type Account } from "@/lib/publisher/model";
import { oauthConfig, oauthPlatforms, cookieName, readConnection, identity, setupMessage, type OAuthPlatform } from "@/lib/publisher/connections";
import { blueskySession, telegramIdentity, pinterestBoards } from "@/lib/publisher/adapters";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const auth = await authorizeSocial(request); if (auth) return reply({ error: auth }, 401);
  const meta = (async () => { try { return await verifyMetaConnection(metaConfig()); } catch { return null; } })();
  const accounts = await Promise.all(PLATFORMS.map(async (platform): Promise<Account> => {
    const account: Account = { platform, connected: false, configured: false, message: setupMessage(platform) };
    try {
      if (platform === "facebook" || platform === "instagram") {
        try { metaConfig(); account.configured = true; } catch { return account; }
        const result = await meta;
        if (result?.[platform].connected) return { ...account, connected: true, id: platform === "facebook" ? result.facebook.id : result.instagram.username ?? "", name: platform === "facebook" ? result.facebook.name : `@${result.instagram.username}`, message: "Account verified." };
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
      } else if (oauthPlatforms.includes(platform as OAuthPlatform)) {
        try { oauthConfig(platform as OAuthPlatform); account.configured = platform !== "linkedin" || /^\d{6}$/.test(process.env.LINKEDIN_API_VERSION ?? ""); } catch { return account; }
        if (!account.configured) return { ...account, message: "Add LINKEDIN_API_VERSION (YYYYMM) in server settings." };
        const session = readConnection(request.cookies.get(cookieName(platform))?.value, platform);
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
