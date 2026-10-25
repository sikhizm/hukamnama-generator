# Social Publisher v2

Social Publisher replaces the `/posts` page. Hukamnama generation, source matching,
artwork fitting, calendar dates, daily excerpts, chant rendering, WhatsApp sharing,
and the armed morning batch retain their existing implementations. Existing Meta
and YouTube publishing services are reused without changes. The shared header link
is renamed, and the app/PWA icon is replaced with an Ik Onkar outline from the
bundled ChatrikUni font.

## Workflow

1. Upload a JPG/PNG/WebP, select an MP4, or import a public Sikhizm article URL.
2. Edit the shared caption, optional title, destination URL, hashtags and alt text.
3. Select verified connected accounts. Unsupported formats cannot be selected.
4. Inspect each platform preview and optionally customise that platform's draft.
5. Select a Pinterest board if needed, review the destinations and press Publish.

Images are prepared as JPEG, within 1080px width and the existing Instagram feed
aspect-ratio range, with padding instead of cropping. Compression keeps the result
under 950 KB for the image destinations, including Bluesky. Video uploads retain the
selected MP4; limit 4 MB. Facebook/Instagram videos use the existing reel service.
Use a suitable vertical MP4 for those destinations. No new automated schedule or
story batch is introduced into this tab.

Import performs GET requests only, limited to `https://sikhizm.com` and
`https://www.sikhizm.com`, with same-host redirect checks, timeouts and response
size limits. It reads public Open Graph metadata (with title/description fallbacks)
and the site's featured image. It does not authenticate to WordPress, install a
plugin, update content, or write to the WordPress database. An unavailable or
external-host featured image must be uploaded manually. Import explicitly replaces
the current draft. Imported titles can exceed a platform's limit: shorten them in
that platform's custom version rather than silently truncating them.

Save/Restore stores draft text in this browser, never credentials or media. Save
before connecting an account; after the OAuth return, restore the text and choose
media again. Selecting a Pinterest board creates its custom draft. Other custom
versions retain their own text when the shared draft changes.

## Formats implemented

| Destination | Text/link | Single image | MP4 |
| --- | --- | --- | --- |
| Facebook Page | Yes | Yes | Reel |
| Instagram professional account | — | Yes | Reel |
| YouTube | — | — | Video / suitable Shorts |
| Threads | Yes | Yes | — |
| Pinterest | — | Pin | — |
| LinkedIn | Yes | Yes | — |
| X | Yes | Yes | — |
| Telegram channel | Yes | Yes | — |
| Bluesky (bsky.social account) | Yes | Yes | — |
| Mastodon (configured server) | Yes | Yes | — |

This is not a claim that every platform format is implemented. Carousels, arbitrary
large video uploads, TikTok's approved creator/privacy flow, analytics and new
scheduled jobs are outside this change. WhatsApp remains in Hukamnama Studio.
Alt text is sent to adapters that support it in this release: Threads, Pinterest,
LinkedIn, Bluesky and Mastodon. Facebook/Instagram/X image alt metadata is not added
by the existing single-image publishing service / current X adapter.

## Server configuration

Keep existing app login, Meta and YouTube environment variables unchanged. Never
enter developer secrets into the composer or commit real tokens. Each integration
can be configured independently; unavailable integrations stay unselectable.

Common OAuth setting:

- `PUBLISHER_REDIRECT_BASE`: the app HTTPS origin, for example
  `https://hukamnama-generator-nine.vercel.app`.
- Existing `SOCIAL_ADMIN_KEY`: at least 32 characters; encrypts provider cookies,
  consistent with the existing YouTube connection. Credentials are HttpOnly,
  SameSite=Lax, Secure in production. New provider cookies are scoped to
  `/api/social/publisher`. Cookie capacity is checked before storing.

Register these exact OAuth callback paths with each developer application:

| Provider | Callback under PUBLISHER_REDIRECT_BASE | Other variables |
| --- | --- | --- |
| YouTube | `/api/social/publisher/callback/youtube` | Existing `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`; keep the original callback registered too |
| Threads | `/api/social/publisher/callback/threads` | `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET` |
| Pinterest | `/api/social/publisher/callback/pinterest` | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` |
| LinkedIn | `/api/social/publisher/callback/linkedin` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` |
| X | `/api/social/publisher/callback/x` | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| Mastodon | `/api/social/publisher/callback/mastodon` | `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET`, `MASTODON_SERVER` |

- **Meta:** uses existing Page identity verification and @sikhizmcom guard. Keep
  `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID` and `META_GRAPH_VERSION`. Threads image
  publishing also uses an unpublished Facebook Page photo as a fetchable media
  source; this does not create a visible Page post.
- **YouTube:** keeps using the existing encrypted channel connection. The new
  callback returns to `/posts`; the original callback and morning batch are
  unchanged. Add the new URI to Google's authorised redirect URIs. Channel and
  refresh token are checked before uploading. Public visibility remains subject
  to Google's account/project rules.
- **Threads:** requests `threads_basic,threads_content_publish`. Short access
  tokens expire; reconnect when required. No long-lived token exchange is claimed.
- **Pinterest:** requests `user_accounts:read,boards:read,pins:read,pins:write`.
  The first 100 accessible boards are listed. Requires the relevant app access
  tier / approval. The selected board is checked again before creating the Pin.
- **LinkedIn:** requests `openid profile w_member_social`. Enable the corresponding
  Sign In and Share on LinkedIn products. Set a currently supported
  `LINKEDIN_API_VERSION` in YYYYMM form. Optionally set numeric
  `LINKEDIN_ORGANIZATION_ID` to publish as a company; this additionally requests
  `w_organization_social` and needs Community Management access and an authorised
  Page role. The UI labels company connections explicitly.
- **X:** OAuth 2.0 with PKCE; scopes `tweet.read tweet.write users.read media.write`.
  Requires a confidential web app and paid API access. No budget or billing
  settings are changed by this app.
- **Mastodon:** register the app on the configured public HTTPS server (defaults
  to mastodon.social). Scopes `read:accounts write:statuses write:media`. The
  composer uses a conservative 500-character limit; servers may differ. Changing
  MASTODON_SERVER requires reconnecting.
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (numeric ID or @channel).
  Add the bot as a channel administrator with permission to post. The app checks
  both identity and channel permission before enabling / publishing.
- **Bluesky:** `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`. Create a dedicated app
  password. This release supports bsky.social-hosted accounts; custom PDS hosting
  and Bluesky OAuth are not implemented. Credentials stay on the server.

Connecting only authorises the account. It never publishes a test post. OAuth
state is random, encrypted, short lived and bound to its provider. X also uses
PKCE. New OAuth tokens expire with the provider's returned access-token lifetime
(capped at 30 days); reconnect instead of claiming background token refresh.
All protected routes use the existing signed-in app session and same-origin POST
checks. The existing proxy also covers the new `/api/social/publisher/*` routes.

## Publishing and retries

Selected destinations publish sequentially. Each has its own result and post link
where available; an uploaded YouTube video may still be processing. A rejection
for one platform does not resend successes on the others. There is no automatic
retry of a publishing call.

The browser acquires a cross-tab Web Lock and stores an attempt marker before
sending. The key includes provider, verified account ID, format, draft and media
hash. Recent attempts (up to 200) survive reloads. An interrupted/ambiguous result
stays blocked until the user checks the account and explicitly allows another
attempt. Browser storage must be writable. This is browser-scoped duplicate
protection, not a server-wide guarantee across devices or cleared browser data.

No live accounts were posted to during validation. New providers require a real
connection, required approvals and a deliberate user test after configuration.

## Checks

- `npm run test:publisher` — mock imports, redirect boundaries, response limits,
  OAuth state/provider binding/PKCE, token expiry, provider request payloads and
  upload host restrictions, uncertain outcomes, persistent attempt history and
  authenticated API validation.
- `npm run test:renderer` — existing source/calendar/artwork/excerpt/link tests.
- `npm run test:social` — existing Meta/media/YouTube/session tests.
- `npm run build` — production build and TypeScript.
- Focused ESLint on the new publisher files and posts page.
