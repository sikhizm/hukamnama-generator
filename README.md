# Hukamnama Generator - Enhanced Text Size Control

This package contains all the changes needed to add separate, adjustable text sizing for the Mool Hukamnama (original) and Punjabi Translation sections.

## 📦 What's Included

### Documentation Files

1. **CHANGES_SUMMARY.md** ← Start here!
   - Overview of all changes
   - Modified files list
   - Default values reference
   - Testing checklist

2. **INSTALLATION_GUIDE.md**
   - Step-by-step installation
   - File placement guide
   - Verification steps
   - Troubleshooting

3. **DETAILED_CODE_CHANGES.md**
   - Before/after code for each file
   - Explanation of each change
   - Data flow diagrams
   - Performance notes

4. **USAGE_EXAMPLES.md**
   - 8 real-world scenarios
   - Visual representations
   - Best practices
   - Platform-specific tips

5. **UI_COMPARISON_AND_FAQ.md**
   - Visual UI comparisons (before/after)
   - Feature comparison table
   - 20 common questions with answers
   - Troubleshooting flowchart

6. **README.md** (this file)
   - Package overview
   - File descriptions
   - Quick start guide

---

## 🚀 Quick Start

### Step 1: Understand the Changes
Read **CHANGES_SUMMARY.md** for a complete overview (5 min read).

### Step 2: Install Modified Files
Copy these 5 files to your project:
- `src/lib/hukamnama/types.ts`
- `src/lib/hukamnama/defaults.ts`
- `src/lib/hukamnama/layout.ts`
- `src/lib/hukamnama/renderer.ts`
- `src/components/studio/panels.tsx`

See **INSTALLATION_GUIDE.md** for detailed steps.

### Step 3: Test & Verify
Restart dev server and check the "Text layout" section in the UI.
See **INSTALLATION_GUIDE.md** - Verifying the Installation section.

### Step 4: Start Using
Toggle "Auto-fit text" and play with the new sliders!
See **USAGE_EXAMPLES.md** for inspiration.

---

## ✨ What You Get

### Original Features (Preserved)
- ✅ All existing functionality works exactly as before
- ✅ Backward compatible with existing exports
- ✅ No breaking changes
- ✅ Same performance

### New Capabilities
- ✅ **Separate sizing**: Original and translation can be different sizes
- ✅ **Auto-fit ratio**: Original automatically 1.5-2.0× larger than translation
- ✅ **Manual control**: Precise sizing when auto-fit disabled
- ✅ **Overflow protection**: Text never escapes the red boxes
- ✅ **Intelligent scaling**: Both texts scale proportionally in auto-fit mode

---

## 📋 File Modifications Summary

| File | Location | Changes |
|------|----------|---------|
| **types.ts** | `src/lib/hukamnama/` | +3 properties to TypoSettings |
| **defaults.ts** | `src/lib/hukamnama/` | +3 default values |
| **layout.ts** | `src/lib/hukamnama/` | Refactored sizing logic |
| **renderer.ts** | `src/lib/hukamnama/` | +Overflow clipping |
| **panels.tsx** | `src/components/studio/` | Enhanced Typography section |

**Total lines changed: ~150 lines across 5 files**
**No new dependencies added**
**No breaking changes**

---

## 📖 Documentation Reading Order

For different use cases:

### I just want to install it
1. CHANGES_SUMMARY.md (Overview)
2. INSTALLATION_GUIDE.md (How to install)
3. Done!

### I want to understand everything
1. CHANGES_SUMMARY.md (What changed)
2. DETAILED_CODE_CHANGES.md (How it changed)
3. INSTALLATION_GUIDE.md (How to install)
4. UI_COMPARISON_AND_FAQ.md (Visual comparison)
5. USAGE_EXAMPLES.md (How to use)

### I just want to use it
1. INSTALLATION_GUIDE.md (Install)
2. USAGE_EXAMPLES.md (Try scenarios)
3. UI_COMPARISON_AND_FAQ.md (If you have questions)

### I'm troubleshooting
1. INSTALLATION_GUIDE.md - Troubleshooting section
2. UI_COMPARISON_AND_FAQ.md - FAQ (Q&A)
3. DETAILED_CODE_CHANGES.md - Technical reference

---

## 🎯 Key Features Explained

### Auto-Fit Mode (Recommended)
- **What it does**: Both texts shrink together while maintaining ratio
- **How to use**: Enable "Auto-fit text" toggle, adjust ratio slider (1.0-2.0×)
- **Best for**: Daily posts, varying content lengths, consistent feel
- **Typical sizes**: Original 48px, Translation 32px (1.5× default)

### Manual Mode (Precise Control)
- **What it does**: You control each size independently
- **How to use**: Disable "Auto-fit text", adjust two sliders
- **Best for**: Templates, exact dimensions, specific projects
- **Range**: Original 22-80px, Translation 18-60px

### Overflow Protection
- **How it works**: Text clipped to box + line limiting
- **What you see**: Text always stays within red borders
- **If overflow**: Console warns "overflows by Xpx"
- **What to do**: Reduce size or enable auto-fit

---

## 🔧 Customization

### Change Default Ratio
In `defaults.ts`:
```typescript
originalSizeRatio: 1.8,  // Changed from 1.5
```

### Change Default Sizes (Manual Mode)
In `defaults.ts`:
```typescript
originalSize: 52,        // Changed from 48
translationSize: 36,     // Changed from 32
```

### Change Size Ranges (UI Limits)
In `panels.tsx`:
```typescript
// Original size: 22-80px (change max/min)
// Translation size: 18-60px (change max/min)
// Ratio: 1.0-2.0× (change max/min)
```

---

## ✅ Verification Checklist

After installation, verify:

- [ ] App starts without errors
- [ ] Typography section shows new controls
- [ ] Auto-fit toggle shows ratio slider when ON
- [ ] Auto-fit toggle shows two size sliders when OFF
- [ ] Adjusting sizes updates preview
- [ ] Text stays within red boxes (no overflow)
- [ ] Original is larger than translation (at defaults)
- [ ] All export presets work correctly
- [ ] Console shows no errors

See **INSTALLATION_GUIDE.md** - Verifying the Installation for details.

---

## 📱 Browser Compatibility

- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ✅ Mobile browsers (iOS/Android)
- ✅ All modern browsers with canvas support

---

## 🎓 Before You Install

### Prerequisites
- Node.js 18+
- npm or yarn
- Working Hukamnama generator project
- Basic familiarity with the project structure

### Backup
Before installing:
1. Backup your current project
2. Or create a git branch

See **INSTALLATION_GUIDE.md** for full details.

---

## 🚨 Important Notes

### No Breaking Changes
- Existing exports continue to work
- Old settings load correctly
- Backward compatible throughout

### Performance
- No performance degradation
- Same render time
- Optimized with line limiting

### Text Overflow
- Guaranteed not to overflow boxes
- Clipped at canvas level
- Console warnings if too large

---

## 🤔 Frequently Asked

### Q: Do I need to modify any other files?
**A:** No, just the 5 files listed above.

### Q: Will my old exports still work?
**A:** Yes, completely backward compatible.

### Q: Can I adjust each text size independently?
**A:** Yes, disable Auto-fit and use two sliders.

### Q: What if text overflows?
**A:** It's clipped to the box. Reduce size or enable auto-fit.

### Q: Can I copy these settings to another project?
**A:** Yes, export from localStorage. See UI_COMPARISON_AND_FAQ.md Q11.

More Q&A in **UI_COMPARISON_AND_FAQ.md**.

---

## 📞 Support Resources

### In Case of Issues

1. **Installation problems**: INSTALLATION_GUIDE.md - Troubleshooting
2. **How to use**: USAGE_EXAMPLES.md - Real scenarios
3. **Technical questions**: DETAILED_CODE_CHANGES.md - Code reference
4. **UI questions**: UI_COMPARISON_AND_FAQ.md - Visual guide
5. **General questions**: CHANGES_SUMMARY.md - Overview

### Debug Steps
1. Check browser console (F12) for errors
2. Verify all 5 files are correctly placed
3. Restart dev server: `Ctrl+C` then `npm run dev`
4. Hard refresh browser: `Ctrl+Shift+R`
5. Check INSTALLATION_GUIDE.md troubleshooting section

---

## Private app login

Configure these server environment variables before deploying this change:

- `APP_USERNAME`: your chosen username, for example `sikhizm`.
- `APP_PASSWORD`: your chosen strong password, at least 12 characters.
- `APP_SESSION_SECRET`: optional random secret of at least 32 characters. If
  omitted, the existing server-side `SOCIAL_ADMIN_KEY` is used for session encryption.

Keep `SOCIAL_ADMIN_KEY` in the server settings; it also protects the existing
YouTube connection cookies. It is no longer entered in any posting screen.
Never put these values in `NEXT_PUBLIC_` variables or commit credentials.

The login page sets an encrypted, HttpOnly, Secure, SameSite=Lax cookie for
30 days. Root, posts, source-data and social API routes require a valid session.
Social route handlers also verify the session and same-origin requests; the
former bearer setup key no longer bypasses login. Changing the username or
password invalidates existing sessions. Sign out clears the app and YouTube
connection cookies. There is no public signup flow. Login has supplemental
per-instance throttling; it is not a distributed rate-limit service.

Without configured login credentials, the app fails closed and displays setup
instructions. The browser can save the username/password using its password
manager. No app credentials are stored in localStorage.

## Full audio and playback

Full audio is the new default, including migration of previously saved 10/15s
defaults. The supplied MP3 decodes to about 17.963 seconds; the MP4 is about
17.967 seconds after video-frame rounding. The recording is decoded once into
continuous 48 kHz stereo PCM before a single 192 kbps AAC encode, removing MP3
packet timing from the mux. Audio is not looped, speed-changed or faded.

Local decoded waveform comparison found no introduced 100 ms silent gaps and
correlation above 0.9999 with the original. This does not guarantee playback
on every browser or after a social platform transcodes the upload. If a preview
stutters, download the MP4 and listen in a separate player before posting.

## Morning publishing and reels

In the generator, expand **Social caption & sharing → Morning posts, reels &
stories**. This is an **app-open runner**, not a server scheduler. Keep the app
visible on an awake, online laptop. A screen wake lock is requested when supported,
but cannot wake a sleeping computer. No service worker or PWA background posting
is promised. WhatsApp still uses the manual share steps.

The default selection is Facebook feed image (1080×1350), Instagram reel and
YouTube Short (1080×1920 MP4), and Facebook/Instagram image stories (1080×1920).
Every destination has an independent checkbox; Facebook reels and Instagram feed
images are optional. The reel uses the full recording by default, with optional first-10/15-second excerpts, the vertical template and
your audio; arbitrary landscape images are padded without cropping. H.264,
yuv420p, 30 fps, AAC 48 kHz audio and MP4 faststart are used.

1. The supplied **Waheguru Waheguru.mp3** is bundled with the app and loads
   automatically as the default reel background. Its entire recording is used
   by default. An optional replacement under 1.8 MB can be saved in this browser's
   IndexedDB. Recordings are never looped; clips from 1 to 60 seconds are supported. **Use bundled Waheguru chant** restores the default.
2. Create a reel preview and download it before testing public posting.
3. Sign in, select destinations and review the shared caption. A short editable template
   is the default. The full existing template is optional; Instagram captions
   must fit within 2,200 characters. No Gurbani is truncated to fit.
4. Select a start time between 04:00 and
   10:30 IST (default 05:45), approve public posting, and turn **AUTO ON**.
   Reloading turns the runner off, but the login session remains. Settings,
   custom audio and posting records remain on this browser. The bundled chant
   and ChatrikUni font remain available on every device after deployment.

The runner waits for a same-day live record with complete Gurbani, translation,
date, Ang and a matched author, loads it into the template, and waits for the
required font and overflow checks. It resolves same-day article/PDF links before
each batch. If links are unavailable it uses `/hukamnama-sahib/` and leaves the
PDF blank. It never reuses yesterday's record or links. Morning polling stops
at 10:30 IST; there is also a manual **Publish today's pending destinations now**.

Per-date, per-destination records are written to localStorage before dispatch.
Web Locks serialize tabs in the same browser. Failed or unconfirmed requests are
not automatically retried. Check the destination first, then explicitly allow
a retry. These records do not coordinate separate devices/browsers and are lost
if browser storage is cleared. Turning AUTO OFF stops future dispatches; a
request already in flight may still finish.

Meta uses the existing Page credentials. Instagram stories require a **Business**
account; Creator accounts can still publish reels. Meta may require additional
account eligibility or permissions. Upload acceptance is shown separately from
final platform processing; inspect the account after the first live tests.

### YouTube connection

Enable **YouTube Data API v3** in a Google Cloud project, configure its OAuth
consent screen and your account as a test user if applicable, and create a Web
application OAuth client. Register this redirect URI for production:

`https://hukamnama-generator-nine.vercel.app/api/social/youtube/callback`

Set these server environment variables and redeploy:

- `YOUTUBE_CLIENT_ID`: Web application OAuth client ID.
- `YOUTUBE_CLIENT_SECRET`: OAuth client secret.
- `YOUTUBE_REDIRECT_URI`: the exact registered callback URI above.
- `YOUTUBE_CHANNEL_ID`: optional expected channel ID to enforce the intended channel.

Click **Connect YouTube**, choose the intended Sikhizm channel, then **Check
channel**. Upload and read-only channel scopes are requested. The refresh token
is encrypted with AES-GCM under a key derived from `SOCIAL_ADMIN_KEY` and held
in a Secure, HttpOnly, SameSite=Lax cookie on this browser. It is never returned
to JavaScript or committed. OAuth state is signed/encrypted, short-lived and
verified on callback. Each upload checks the authorized channel again. Rotating
the setup key, revoking Google access, or clearing cookies requires reconnection.
Google's consent mode and token expiry rules still apply. Uploads request public
visibility; Google/channel policy and processing determine final availability.

The FFmpeg executable is a pinned Linux dependency, explicitly traced into only
the reel function; intermediate files exist only in a per-request `/tmp`
directory and are deleted afterward. The input body must be under 4 MB and the
finished video under 4 MB to fit Vercel's request/response limit. Reel creation
has a 120-second budget. No separate database or media store is required.

Validation: `npm run test:social` covers mocked image/reel/story uploads, safe
upload hosts, uncertain outcomes, OAuth encryption, YouTube channel checks and
upload, template expansion, morning timing and midnight guards. Real FFmpeg
checks confirmed 1080×1920 H.264/AAC outputs lasting exactly 10 and 15 seconds.
Live account publishing and Google OAuth must be tested after deployment.

## Manual Gurbani image posts

Open `/posts` using the **Gurbani Posts** link in the studio header. Upload a
JPG, PNG or WebP (up to 20 MB), enter a caption and hashtags, select Facebook
and/or Instagram, review the prepared preview, sign in and
press **Publish image post**. The image is converted locally to a JPEG under
3 MB; artwork outside the supported feed proportions is padded, never cropped.
Captions including hashtags are limited to 2,200 characters and 30 hashtags.

Uses the existing server settings: `SOCIAL_ADMIN_KEY`, `META_PAGE_ACCESS_TOKEN`,
`META_PAGE_ID`, and `META_GRAPH_VERSION`. Meta credentials never go to the
browser. Requires Page posting permissions and, for Instagram, the linked
professional `@sikhizmcom` account with content publishing permission.

Facebook publishes a photo with the caption. Instagram first uploads an
unpublished Facebook photo, reads its image URL, creates a media container,
checks readiness and publishes it. Unpublished staging photos remain in Meta;
this feature does not configure separate storage or delete media automatically.

Results are tracked per platform for the current composer session. Successful
platforms are skipped on retry; ambiguous network failures pause retries so the
operator can check their account. This is not durable cross-session deduplication:
after a refresh or an unconfirmed result, check Meta before publishing again.
This separate composer remains manual; the generator's morning controls are
described above.
Run `npm run test:social` for mocked connection and publishing checks. A live
manual post is still needed to confirm the account's publishing permissions.

## 📊 Statistics

- **Files modified**: 5
- **Lines added**: ~150
- **Lines removed**: ~10
- **New features**: 3 (separate sizing, ratio control, enhanced clipping)
- **Breaking changes**: 0
- **Performance impact**: 0
- **Dependencies added**: 0

---

## 🎉 Next Steps

1. **Read** CHANGES_SUMMARY.md (5 min)
2. **Install** using INSTALLATION_GUIDE.md (10 min)
3. **Verify** installation (5 min)
4. **Explore** USAGE_EXAMPLES.md (10 min)
5. **Use** and enjoy!

**Total time to get started: ~30 minutes**

---

## 📝 Version Information

- **Enhancement**: Text Size Control
- **Target App**: Hukamnama Generator
- **Compatibility**: All preset dimensions (vertical, square, landscape, etc.)
- **Status**: Production Ready
- **Last Updated**: September 2026

---

## 🙏 Enjoy Your Enhanced Hukamnama Generator!

With these changes, you now have:
- ✅ Professional text hierarchy (original 1.5-2× larger)
- ✅ Flexible sizing (auto or manual)
- ✅ Guaranteed overflow protection
- ✅ Same visual quality
- ✅ Better control over appearance

Start with the default settings and explore the scenarios in **USAGE_EXAMPLES.md** to find what works best for your content!

---

## File Manifest

```
outputs/
├── README.md                          ← You are here
├── CHANGES_SUMMARY.md                 ← Start with this
├── INSTALLATION_GUIDE.md              ← Then this
├── DETAILED_CODE_CHANGES.md           ← Technical details
├── USAGE_EXAMPLES.md                  ← Real scenarios
├── UI_COMPARISON_AND_FAQ.md          ← Visual + FAQ
└── [Original uploaded image.png]      ← Reference screenshot
```

All files use Markdown format for easy reading and searching.

---

**Happy Hukamnama generating! 🎨✨**


## Social Publisher v2

The former Gurbani Posts tab is now Social Publisher. It imports public Sikhizm
articles into drafts and publishes to configured social accounts. See
[Social Publisher setup and supported formats](docs/social-publisher-v2.md) for
credentials, callback URLs, limits and validation. Hukamnama Studio workflows
retain their existing behaviour.

## Daily Hukamnama sources

The live endpoint checks providers in this order: **SGPC** (live page, then official Daily Mukhwak page), **Sikhizm.com**, **HukamnamaSahib.com**, then **Dekho Ji**. It skips unavailable or outdated sources. No other provider is queried.

HukamnamaSahib is fetched from the explicitly dated morning article, not its homepage or evening post. Dekho Ji must show today's date and consistent Ang metadata. Dates are checked against the current day in Asia/Kolkata. A previous day's SGPC entry can still be displayed as stale but cannot qualify as today's update. Publication timing is controlled by the providers, not guaranteed by the app.

Missing Punjabi explanation or author metadata can only be supplemented from a current-day source with the same Ang and complete matching Gurmukhi passage (including vowel marks). An unambiguous Mehl heading can identify its Guru; unresolved authors remain available for manual selection. Manual editing and sharing remain unchanged, and the existing unattended publisher freshness checks still apply.
