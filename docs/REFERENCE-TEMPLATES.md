# Original Sikhizm templates — draft implementation

The original-template mode supports 1080×1350 and 1080×1920. It retains the supplied PNG artwork as the fixed design layer and clears all date, author, Ang, Gurbani and translation regions before drawing editable text. The PNGs correspond to the two supplied Photoshop documents. Fixed titles, photograph, QR and footer remain unchanged. Both formats position the translation from the measured original text height. In the 1080×1920 template, the floral divider is reused from the artwork and moves down when the original Hukamnama needs more room; the translation then uses the remaining space above the fixed date.

Saved projects are migrated to the Sikhizm artwork while retaining their Hukamnama text. Their size is set to the matching 1080×1350 or 1080×1920 template. New projects start blank with a manually verified date. The dated reference example is explicitly loaded by the user and is not a live SGPC fetch. Safe-area guides appear only in the preview. Both single and bulk exports block overflowing text; bulk exports preflight all selected layouts before downloading any file.

## Fonts needed to finish visual matching

- `public/fonts/ChatrikUni.ttf` (or `.otf`): body and Punjabi explanation. The existing font uploader can load it temporarily for a session.
- `public/fonts/LEMONMILK-Regular.otf`: Latin author, Ang and date labels.

The PSD files name these fonts but do not supply installable font binaries. Do not claim exact typography until the actual files are installed and both PNG exports have been visually compared with the references. Only bundle fonts the project owner is entitled to distribute. Fixed header text is preserved in the artwork and does not require its Photoshop fonts at runtime.

Reference text is regular weight, with size caps taken from PSD styles. Photoshop paragraph composition and horizontal scaling may differ from browser Canvas. Final line-break/spacing calibration remains outstanding. Long content is blocked, not silently shortened; automatic continuation slides are not implemented yet.

The existing computed Punjabi calendar uses fixed month boundaries and must not be used as an authoritative SGPC date. Enter the source date manually. The reference example's date is supplied by the owner.

## Validation

`npm run test:renderer` checks bounds in both formats, long/manual text overflow, clearing old daily content, blank initial content and grapheme-safe wrapping. It uses deterministic measurement, not font equivalence. The changed rendering modules pass a strict TypeScript check, and the studio component bundles successfully. Full local installation/build was blocked by unavailable pinned packages; the validation workflow runs the pinned install, full typecheck, renderer tests and production build on GitHub.

## Daily workflow automation groundwork

The app checks the official SGPC Hukamnama page and shows whether its date is current. While the page is open, it polls every five minutes during 4:15–5:45 a.m. Asia/Kolkata. Loading today's Gurbani, Punjabi explanation, date and Ang into the template remains a deliberate user action. Author metadata is suggested only when GurbaniNow's daily result agrees with the SGPC Gregorian date, Ang and opening Gurbani. GurbaniNow's published API terms specify non-commercial, no-derivatives use; obtain permission or replace the provider before using this matcher in a monetized production workflow.

The text-template composer reads Sikhizm's public Hukamnama RSS feed and updates article/PDF URL fields only after a post matches the SGPC date. WhatsApp sharing offers two distinct steps: share the rendered image, then share the caption as a second post. Native file sharing is used when available; otherwise the image downloads for manual attachment. The operator still chooses the WhatsApp destination and taps Send.

Video/audio rendering, direct Meta or YouTube publishing, a private mobile dashboard and background polling while the app is closed remain later stages. WhatsApp Channel/group and Facebook-group final-send controls remain in WhatsApp/Facebook.
