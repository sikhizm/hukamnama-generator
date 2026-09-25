# Hukamnama Generator - Text Size Control Updates

## Overview
Your Hukamnama generator has been enhanced to provide separate, adjustable text sizing for the "Mool Hukamnama" (original) and "Punjabi Translation" sections. The original text can now be 1.5-2x larger than the translation, with intelligent overflow prevention.

---

## Key Features Added

### 1. **Separate Size Controls**
- **Original (Mool) Hukamnama**: Can be sized independently (22-80px)
- **Translation**: Can be sized independently (18-60px)
- **Auto-fit Ratio**: When auto-fit is enabled, the original is automatically 1.5x the translation size (adjustable 1.0-2.0x)

### 2. **Smart Auto-Fit with Ratio**
- When "Auto-fit text" is **enabled**: 
  - Both texts scale together while maintaining the size ratio you set
  - Starts at maximum size and shrinks both proportionally until they fit
  - Translation size determines the base; original is `base × ratio`
  
- When "Auto-fit text" is **disabled**:
  - Original and Translation have independent manual size controls
  - Set each precisely to your desired size

### 3. **Overflow Protection**
- Text is clipped to its box boundaries using canvas clipping
- Only lines that fit within the box height are rendered
- No text will ever extend outside the red-bordered panels

---

## Modified Files

### 1. **src/lib/hukamnama/types.ts**
```typescript
export interface TypoSettings {
  justify: boolean;
  autoFit: boolean;
  manualSize: number;                    // Legacy (kept for compatibility)
  originalSize: number;                  // NEW: Original text size when autoFit is off
  translationSize: number;               // NEW: Translation size when autoFit is off
  originalSizeRatio: number;             // NEW: Ratio multiplier (1.0-2.0) for autoFit
  lineHeight: number;
}
```

### 2. **src/lib/hukamnama/defaults.ts**
Updated default values:
```typescript
typo: {
  justify: true,
  autoFit: true,
  manualSize: 40,
  originalSize: 48,        // NEW: Default original size
  translationSize: 32,     // NEW: Default translation size
  originalSizeRatio: 1.5,  // NEW: Default ratio (original is 1.5x larger)
  lineHeight: 1.62,
}
```

### 3. **src/lib/hukamnama/layout.ts**
- Refactored text sizing logic to handle separate sizes for original and translation
- When `autoFit` is true:
  - Calculates `translationSize` starting from `FIT_MAX_PX`
  - Calculates `originalSize` as `translationSize × ratio`
  - Shrinks both proportionally until content fits
  
- When `autoFit` is false:
  - Uses `originalSize` directly for original text
  - Uses `translationSize` directly for translation text
  
- Updated `mk()` function to accept fontSize parameter for each block

### 4. **src/lib/hukamnama/renderer.ts**
Added overflow clipping logic:
```typescript
// Calculate max lines that can fit
const maxVisibleLines = Math.floor(block.textRect.h / block.lineH);

// Only render lines that fit within the box height
block.lines.forEach((line, i) => {
  if (i < maxVisibleLines) {
    // Render the line
  }
});
```

### 5. **src/components/studio/panels.tsx**
Enhanced the Typography section with:
- Toggle between auto-fit and manual sizing modes
- When **auto-fit enabled**: Single slider for "Size ratio (Original ÷ Translation)"
- When **auto-fit disabled**: Two separate sliders:
  - "Original (Mool) font size" (22-80px)
  - "Translation font size" (18-60px)
- Dynamic help text showing current ratio

---

## UI Changes

### Typography Section Now Shows:

**When Auto-fit is ON:**
```
Justified alignment [toggle]
Auto-fit text [toggle] ✓
  └─ Fit both texts optimally — original 1.50× translation size
Size ratio (Original ÷ Translation) [slider: 1.0 - 2.0]
Line height [slider]
```

**When Auto-fit is OFF:**
```
Justified alignment [toggle]
Auto-fit text [toggle]
Original (Mool) font size [slider: 22-80px]
Translation font size [slider: 18-60px]
Line height [slider]
```

---

## How It Works

### Auto-Fit Mode (Recommended)
1. Set your desired **ratio** (default 1.5x)
2. The app automatically finds the largest size where both texts fit
3. Original stays 1.5x larger than translation throughout

### Manual Mode (Precise Control)
1. Disable "Auto-fit text"
2. Adjust "Original (Mool) font size" to your preference (22-80px)
3. Adjust "Translation font size" separately (18-60px)
4. If text overflows, the app warns you with details about overflow amount

---

## Text Overflow Handling

Both panels have built-in overflow protection:

1. **Canvas Clipping**: Text is clipped to the box boundaries
2. **Line Limiting**: Only lines that fit within the box height are rendered
3. **Warnings**: If content exceeds available space, you'll see warnings like:
   - `Original text overflows its panel by 45px`
   - `Translation overflows its panel by 12px`

**The red-bordered boxes will NEVER have text extending beyond them.**

---

## Migration Notes

### For Existing Projects
- Your existing `manualSize` setting is preserved (not used anymore)
- New defaults are applied:
  - Original: 48px
  - Translation: 32px
  - Ratio: 1.5x
- Auto-fit remains on by default

### To Restore Previous Behavior
1. Disable "Auto-fit text"
2. Set both original and translation to the same size (disable the ratio advantage)
3. Or manually adjust to match your preference

---

## Testing Checklist

- [x] Original text is 1.5-2x larger than translation
- [x] Text never overflows the red-bordered boxes
- [x] Auto-fit works with the ratio applied
- [x] Manual sizing allows independent control
- [x] Line height works correctly with new sizes
- [x] Justified alignment works with different sizes
- [x] All export presets (vertical, square, landscape, etc.) work correctly
- [x] Warnings display when text overflows

---

## Default Values Reference

```typescript
typo: {
  justify: true,              // Text justification enabled
  autoFit: true,              // Smart sizing enabled
  manualSize: 40,             // Legacy (22-60px range)
  originalSize: 48,           // Original text size: 48px (22-80px)
  translationSize: 32,        // Translation size: 32px (18-60px)
  originalSizeRatio: 1.5,     // Original is 1.5x translation (1.0-2.0x)
  lineHeight: 1.62,           // Line spacing: 1.62 (1.3-1.9)
}
```

---

## Browser Compatibility

- Canvas clipping: Supported in all modern browsers
- Text measurement: Supported in all modern browsers
- No external dependencies added
- Works on desktop, tablet, and mobile exports

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `types.ts` | Added 3 new TypoSettings properties |
| `defaults.ts` | Added default values for new properties |
| `layout.ts` | Refactored sizing logic for separate original/translation sizes |
| `renderer.ts` | Added line-limiting overflow protection |
| `panels.tsx` | Enhanced UI with conditional controls based on auto-fit mode |

---

## Questions or Issues?

The sizing algorithm ensures that:
- Text never overflows boxes (clipped at canvas level)
- Ratio is always maintained when auto-fit is enabled
- Manual control is precise when auto-fit is disabled
- Line height applies uniformly to both sections
- All export formats maintain the same sizing

Enjoy your enhanced Hukamnama generator! 🙏
