=====================================================================
        Fonts — Hukamnama Studio
=====================================================================

Hukamnama Studio can render Gurmukhi text in any of 4 typefaces,
picked from the Font section of the sidebar:

  1. ChatrikUni            — brand font, loaded from a local file
  2. Tiro Gurmukhi          — loaded automatically from Google Fonts
  3. Noto Serif Gurmukhi    — loaded automatically from Google Fonts
  4. Gurmukhi-UCSB-Uni      — classic font, loaded from a local file

Local-file fonts (ChatrikUni, Gurmukhi-UCSB-Uni)
-------------------------------------------------
These two are not distributed with the app. Each is expected at one
of these paths:

    public/fonts/ChatrikUni.ttf          or  ChatrikUni.otf
    public/fonts/Gurmukhi-UCSB-Uni.ttf   or  Gurmukhi-UCSB-Uni.otf

Steps
-----
1. Place your licensed font file into this folder (public/fonts/).
2. Restart / rebuild the app (or just hard-refresh the browser).
3. The app auto-detects the font. The font badge in the top bar
   turns green ("<font> active") once it is available.

No file? No problem.
--------------------
You can also load either font at runtime without rebuilding: select
it in the Font section, then click "Load .ttf / .otf" and choose
your file. It is registered instantly via the FontFace API and
stays active for the whole session.

Google Fonts (Tiro Gurmukhi, Noto Serif Gurmukhi)
--------------------------------------------------
These two load automatically over the network the first time the
app runs (via a Google Fonts stylesheet import) — no file needed.
If you select one of these and it's stuck on "missing", check your
network connection or allow the fallback in the Font section.

Export guard
------------
While the selected font is missing, PNG/JPG export is locked by
default to guarantee brand-consistent typography. You may explicitly
allow fallback export (Noto Sans Gurmukhi) from the Font section —
the badge then shows a fallback state so it's always visible.
