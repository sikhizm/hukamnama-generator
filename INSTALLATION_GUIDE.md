# Installation Guide - Updated Hukamnama Generator

## Quick Start

### Option 1: Replace Modified Files Only (Fastest)

Copy these 5 files from your updated project to your current project:

```
src/lib/hukamnama/
  ├── types.ts          (MODIFIED)
  ├── defaults.ts       (MODIFIED)
  └── layout.ts         (MODIFIED)

src/lib/hukamnama/renderer.ts          (MODIFIED)
src/components/studio/panels.tsx       (MODIFIED)
```

Then restart your dev server:
```bash
npm run dev
```

### Option 2: Full Project Replacement (Safest)

1. Backup your current project
2. Extract the updated version to a new directory
3. Copy these directories from your old project (if customized):
   ```
   public/fonts/      (your custom fonts)
   public/images/     (your custom images)
   .env.local         (your environment variables)
   ```
4. Run setup:
   ```bash
   npm install
   npm run dev
   ```

---

## Changes Summary

### Files Modified: 5

1. **types.ts** - Type definitions
   - Added `originalSize`, `translationSize`, `originalSizeRatio` to `TypoSettings`

2. **defaults.ts** - Default state
   - New defaults: originalSize=48px, translationSize=32px, ratio=1.5x

3. **layout.ts** - Layout engine
   - Refactored to handle separate sizes for original and translation
   - Implemented ratio-based auto-fit

4. **renderer.ts** - Canvas rendering
   - Added line-limiting overflow protection

5. **panels.tsx** - UI controls
   - New Typography section with conditional controls
   - Toggle between auto-fit ratio and manual sizing

### Files Unchanged: All others
- No dependencies added
- No breaking changes to existing functionality
- Backward compatible with existing exports

---

## Verifying the Installation

### Step 1: Start the app
```bash
cd your-project
npm run dev
```

### Step 2: Check Typography Section
Navigate to the "Text layout" section in the left panel. You should see:

**If Auto-fit is ON:**
- Justified alignment toggle
- Auto-fit text toggle ✓
- **Size ratio slider** (1.0 - 2.0x) ← NEW
- Line height slider

**If Auto-fit is OFF:**
- Justified alignment toggle
- Auto-fit text toggle
- **Original (Mool) font size slider** (22-80px) ← NEW
- **Translation font size slider** (18-60px) ← NEW
- Line height slider

### Step 3: Test the Features

1. **Auto-fit mode (default)**
   - Adjust the "Size ratio" slider from 1.0 to 2.0
   - Watch the original text grow 1-2x larger than translation
   - Both texts shrink together to fit

2. **Manual mode**
   - Toggle off "Auto-fit text"
   - Independently adjust original size (22-80px)
   - Independently adjust translation size (18-60px)
   - Note: Text may overflow if sizes are too large

3. **Overflow Prevention**
   - Make sizes very large to test clipping
   - Text should ALWAYS stay within the red boxes
   - Check console for warnings about overflow

---

## Configuration

### Default Typography Settings

Located in `src/lib/hukamnama/defaults.ts`:

```typescript
typo: {
  justify: true,              // Keep justified alignment
  autoFit: true,              // Keep smart sizing on
  manualSize: 40,             // Legacy (not used with new system)
  originalSize: 48,           // Change this for manual mode default
  translationSize: 32,        // Change this for manual mode default
  originalSizeRatio: 1.5,     // Change this for auto-fit default ratio
  lineHeight: 1.62,           // Adjust line spacing if needed
}
```

### Adjust Default Ratio

To start with a different ratio (e.g., 1.8x instead of 1.5x):

```typescript
// In defaults.ts
originalSizeRatio: 1.8,  // Original will be 1.8x translation
```

### Adjust Default Manual Sizes

To start with different manual sizes:

```typescript
// In defaults.ts
originalSize: 52,        // Start original at 52px
translationSize: 36,     // Start translation at 36px
```

---

## Troubleshooting

### Issue: Sliders don't appear or are greyed out

**Solution:** 
- Check that "Auto-fit text" toggle state matches what you expect
- If auto-fit is ON, you should only see the ratio slider
- If auto-fit is OFF, you should see both original and translation sliders

### Issue: Text is clipped unexpectedly

**Solution:**
- This is intentional! Text is clipped to prevent overflow
- Reduce the font sizes or check the console for overflow warnings
- Example: "Original text overflows its panel by 45px" means reduce size by 45px

### Issue: Changes don't appear in preview

**Solution:**
1. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. Check browser console (F12) for errors
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Ratio isn't working in auto-fit

**Solution:**
- Make sure "Auto-fit text" toggle is ON (enabled/checked)
- The ratio slider should be visible
- Clear browser cache and hard refresh

---

## Advanced Usage

### Programmatic Adjustment

If you're modifying the app or creating a preset system:

```typescript
// Set manual sizes
patchTypo({
  autoFit: false,
  originalSize: 56,
  translationSize: 38,
});

// Set auto-fit ratio
patchTypo({
  autoFit: true,
  originalSizeRatio: 1.75,
});
```

### Custom Font Pairing

Since original and translation can now be sized independently:

- **Original**: Use a more decorative font with larger size
- **Translation**: Use a readable font with smaller size

Example:
- Original: Chatrik Uni at 56px
- Translation: Tiro Gurmukhi at 36px
- Ratio in auto-fit: 1.55x

---

## Performance Notes

- No performance impact (same canvas rendering)
- Overflow clipping uses native canvas features
- Layout calculations are optimized
- All exports render at full resolution

---

## Backup Your Settings

The app stores settings in browser localStorage. To backup:

1. Open browser DevTools (F12)
2. Go to "Application" → "Local Storage"
3. Find entries for your app domain
4. Export/copy the values
5. Save to a text file for safekeeping

---

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Look at the console (F12) for error messages
3. Verify all 5 files are correctly placed
4. Try clearing browser cache and restarting dev server
5. Check that Node.js version is 18+ (via `node --version`)

---

## What's Next?

With separate text sizing, you can now:

- ✅ Make original text more prominent (1.5-2x larger)
- ✅ Create better visual hierarchy
- ✅ Adjust each section independently
- ✅ Export at any size without overflow
- ✅ Create templates with different ratios

Enjoy your enhanced Hukamnama generator! 🙏
