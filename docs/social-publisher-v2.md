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
| Tumblr | Yes | Uploaded JPEG | — |
| Blogger | Yes | Public HTTPS image URL | — |
| WordPress.com | Yes | Uploaded JPEG | — |
| X | Yes | Yes | — |
| Telegram channel | Yes | Yes | — |
| Bluesky (bsky.social account) | Yes | Yes | — |
| Mastodon (configured server) | Yes | Yes | — |

This is not a claim that every platform format is implemented. Carousels, arbitrary
large video uploads, TikTok's approved creator/privacy flow, analytics and new
scheduled jobs are outside this change. WhatsApp remains in Hukamnama Studio.
Alt text is sent to adapters that support it in this release: Threads, Pinterest,
Tumblr, Blogger, WordPress.com, Bluesky and Mastodon. Facebook/Instagram/X image alt metadata is not added
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
| Tumblr | `/api/social/publisher/callback/tumblr` | `TUMBLR_CLIENT_ID`, `TUMBLR_CLIENT_SECRET`, `TUMBLR_BLOG_NAME` |
| Blogger | `/api/social/publisher/callback/blogger` | `BLOGGER_CLIENT_ID`, `BLOGGER_CLIENT_SECRET`, `BLOGGER_BLOG_ID` |
| WordPress.com | `/api/social/publisher/callback/wordpress` | `WORDPRESS_COM_CLIENT_ID`, `WORDPRESS_COM_CLIENT_SECRET`, `WORDPRESS_COM_SITE_ID` |
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
- **Tumblr:** register at https://www.tumblr.com/oauth/apps and set the OAuth2 redirect
  URL (not only the legacy OAuth callback). Use the OAuth consumer key as
  `TUMBLR_CLIENT_ID` and its matching secret as `TUMBLR_CLIENT_SECRET`.
  `TUMBLR_BLOG_NAME` is the handle without `https://` or `.tumblr.com`.
  Requests `basic write offline_access`; the configured blog must appear in the
  connected user's blogs. Images use NPF multipart upload; captions are plain
  text blocks. Optional title becomes a heading, hashtags also become native tags.
- **Blogger:** enable Blogger API v3 in Google Cloud. Create a Web application
  OAuth client, configure its consent screen (add your account as a test user
  while in Testing), and add the exact callback above. Use dedicated
  `BLOGGER_CLIENT_ID` / `BLOGGER_CLIENT_SECRET`; the existing YouTube credentials
  and callback are untouched. `BLOGGER_BLOG_ID` is the numeric blog ID shown in
  Blogger's dashboard URL. The account needs author/admin access. Requests
  `https://www.googleapis.com/auth/blogger` with offline consent.
  A title is required. Image posts embed the Blogger public image URL shown in
  its preview, not the selected upload. Sikhizm imports prefill that URL when
  available; otherwise enter a permanent public HTTPS image URL. The app does
  not fetch this arbitrary URL on its server. Blogger image-only publishing
  needs no local file; other selected image platforms still require an upload.
- **WordPress.com:** register at https://developer.wordpress.com/apps/ with the
  exact callback above. Use its Client ID and Client Secret. Set the numeric
  `WORDPRESS_COM_SITE_ID` of a separate hosted `yourblog.wordpress.com` site.
  Authorization requests `posts media`, scoped to that site, not global access.
  The site must be listed in the authenticated account's sites with
  `publish_posts` capability, `jetpack: false`, and a `.wordpress.com` hostname.
  Custom domains and Jetpack-connected self-hosted sites (including Sikhizm.com)
  are deliberately excluded. A title is required. Uploaded images go to the
  selected site's media library and appear inline and as featured media.
  If a later post step fails, the uploaded media may remain in that library.
- **LinkedIn:** removed from the list, OAuth endpoints and publishing adapters.
  Previously saved LinkedIn cookies are unused. Its old environment variables
  can be removed manually when convenient; this change does not edit Vercel.
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
PKCE. Blogger and Tumblr access tokens are renewed before account checks or
publishing when their encrypted refresh token is available. Rotated tokens are
saved in the HttpOnly provider cookie; the connection lasts at most 30 days
before reconnection. Expired/revoked refresh tokens require reconnecting. Google
Testing-mode authorizations may expire earlier. WordPress.com and other OAuth
providers expire with the access-token lifetime (capped at 30 days); reconnect
when needed. There is no always-running renewal job.
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

## Connection troubleshooting

OAuth callbacks now return an allowlisted diagnostic reason and, when supplied by
the provider, numeric HTTP/error/suberror codes. These appear beside the connection
failure on `/posts`. Raw provider messages, authorization codes and credentials
are never returned or logged. A failed connection retains any previous account
cookie. Start OAuth from the same hostname as PUBLISHER_REDIRECT_BASE: a preview
host cannot share its authorization-state cookie with the production callback.
The Connect endpoint now rejects this mismatch before leaving the app.

Threads authorization/token/profile checks use the current documented threads.com
hosts. The older graph.threads.net host also accepts requests; changing the host
alone is not evidence of a root-cause fix. An actual successful authorization is
still required to verify the user's connection.

## Use a generated Threads tester token

For this personal app, a token generated for @sikhizmcom in Meta's Threads User
Token Generator can be saved directly as `THREADS_ACCESS_TOKEN` in Vercel
Production (Secret). Redeploy, open Social Publisher and press Refresh. No OAuth
Connect click or app-secret replacement is needed for this option. The Threads
App Secret remains `THREADS_CLIENT_SECRET`; the generated user token is separate.

The server verifies `/me?fields=id,username` and requires @sikhizmcom before enabling
the account and again before each post. An invalid token or another account's
token blocks publishing. It never falls back silently to a different OAuth
account. An absent server token preserves the original OAuth connection flow.
The token is never returned to the browser or stored in its connection cookie.
Renew it manually in Vercel and redeploy when it expires or is revoked; automatic
refresh is not implemented. Meta still enforces its publishing permissions and
tester restrictions. Threads image hosting still uses the existing unpublished
Facebook Page photo upload; a valid Meta Page token is needed for image posts.

## Bundled UCSB Uni font

`public/fonts/Gurmukhi-UCSB-Uni.ttf` is bundled from the supplied file. The existing
CSS font face and Studio font detector load it automatically when selected; no
manual upload or system font installation is needed. The default font and the
Hukamnama renderer, sharing and morning publisher behavior are unchanged.
