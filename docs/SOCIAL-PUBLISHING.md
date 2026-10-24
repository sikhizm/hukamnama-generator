# Social publishing: staged rollout

## Step 1 — connection check (implemented)

The Facebook & Instagram panel verifies a server-configured Page access token
against an explicit Facebook Page ID and checks that its linked professional
Instagram account is @sikhizmcom. It performs read-only API calls. A successful
check verifies identity and linkage, not publishing permissions.

Configure these server-only variables in the Hukamnama Generator Vercel project,
then redeploy:

- SOCIAL_ADMIN_KEY: a random secret of at least 32 characters. This protects the
  connection check; enter this key in the app. It is never stored in the browser.
- META_PAGE_ACCESS_TOKEN: Page token for the Sikhizm Facebook Page, stored as a
  Secret. Never enter this token in the app or commit it to GitHub.
- META_PAGE_ID: the numeric ID of facebook.com/sikhizmcom. Verify this in Meta
  before configuring; the Page name alone is not proof of identity.
- META_GRAPH_VERSION: supported version for your Meta app, e.g. v26.0; check the
  version available in your Meta app dashboard before configuring.

Use a Meta developer app with access to your Page and linked professional
Instagram account. The Facebook Login publishing path will require the relevant
Page and Instagram publishing permissions. Verify their current requirements
in Meta's documentation and dashboard during connection setup:

- https://developers.facebook.com/docs/pages-api/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/

Test: open the panel and check accounts. Missing server configuration, wrong key,
expired token, mismatched Page ID, and missing/wrong Instagram linkage must show
clear errors. A successful check must show the expected Page ID and @sikhizmcom.
This release has no publishing endpoint and cannot create a social post.

## Next separately testable releases

2. Publish one approved image plus template as a caption to selected platforms.
   Add durable records per date/platform, partial-success handling, safe retries,
   protected publishing access, and confirm resulting post links.
3. Automatic posting switch, off initially. Define its trigger explicitly
   (approved export while app is open versus a scheduled background job).
   Do not publish each preview refresh or editor change.
4. Create downloadable 1080×1920 MP4 from the vertical image plus uploaded audio:
   duration 10 or 15 seconds, audio trim/start selection, preview before export.
5. Connect and test Facebook Reels, Instagram Reels and YouTube separately,
   then expose automatic video publishing per destination. YouTube requires its
   own Google authorization. Use audio you own or are permitted to publish.
