# Detailed Code Changes Reference

## 1. types.ts - Type Definitions

### BEFORE
```typescript
export interface TypoSettings {
  justify: boolean;
  autoFit: boolean;
  manualSize: number;
  lineHeight: number;
}
```

### AFTER
```typescript
export interface TypoSettings {
  justify: boolean;
  autoFit: boolean;
  manualSize: number;              // Legacy - kept for compatibility
  originalSize: number;             // NEW: Size for original/Mool text (22-80px)
  translationSize: number;          // NEW: Size for translation (18-60px)
  originalSizeRatio: number;        // NEW: Ratio multiplier (1.0-2.0x)
  lineHeight: number;
}
```

### Changes Made
- ✅ Added 3 new properties to `TypoSettings` interface
- ✅ Maintained backward compatibility with `manualSize`
- ✅ Type safety preserved throughout

---

## 2. defaults.ts - Default State Values

### BEFORE
```typescript
typo: {
  justify: true,
  autoFit: true,
  manualSize: 40,
  lineHeight: 1.62,
}
```

### AFTER
```typescript
typo: {
  justify: true,
  autoFit: true,
  manualSize: 40,                  // Kept for legacy compatibility
  originalSize: 48,                // NEW: Default original size
  translationSize: 32,             // NEW: Default translation size
  originalSizeRatio: 1.5,          // NEW: Default ratio (1.5x)
  lineHeight: 1.62,
}
```

### Changes Made
- ✅ Added 3 new default values
- ✅ Original defaults to 48px (1.5× the 32px translation)
- ✅ Maintains visual hierarchy from the start
- ✅ Can be customized per project

---

## 3. layout.ts - Layout Engine (Core Logic)

### SECTION 1: Auto-fit and Manual Sizing Logic

#### BEFORE (Lines ~267-279)
```typescript
const pass = (px: number) => {
  const mO = measureAt(ctx, state.original, px, textW, lh);
  const mT = measureAt(ctx, state.translation, px, textW, lh);
  return { mO, mT, stackH: chromeH * 2 + panelGap + mO.contentH + mT.contentH };
};

let px = Math.floor(typo.autoFit ? maxPx : typo.manualSize * unit);
let r = pass(px);
if (typo.autoFit) {
  while (px > minPx && r.stackH > availH) {
    px -= 1;
    r = pass(px);
  }
}
```

#### AFTER (Lines ~267-305)
```typescript
let pxO: number;  // Original size
let pxT: number;  // Translation size
let r: { mO: any; mT: any; stackH: number };

if (typo.autoFit) {
  // Auto-fit with ratio: base is translation, original is base × ratio
  let basePx = maxPx;
  const ratio = clamp(typo.originalSizeRatio, 1.0, 2.0);
  
  const pass = (basePx: number) => {
    const pxT = basePx;                    // Translation at base size
    const pxO = basePx * ratio;            // Original at base × ratio
    const mO = measureAt(ctx, state.original, pxO, textW, lh);
    const mT = measureAt(ctx, state.translation, pxT, textW, lh);
    return { pxO, pxT, mO, mT, stackH: chromeH * 2 + panelGap + mO.contentH + mT.contentH };
  };

  let result = pass(basePx);
  while (basePx > minPx && result.stackH > availH) {
    basePx -= 1;
    result = pass(basePx);
  }
  pxO = result.pxO;
  pxT = result.pxT;
  r = result;
} else {
  // Manual sizing with separate sizes for original and translation
  pxO = typo.originalSize * unit;
  pxT = typo.translationSize * unit;
  const mO = measureAt(ctx, state.original, pxO, textW, lh);
  const mT = measureAt(ctx, state.translation, pxT, textW, lh);
  r = { mO, mT, stackH: chromeH * 2 + panelGap + mO.contentH + mT.contentH };
}
```

### SECTION 2: Block Creation Function

#### BEFORE (Lines ~301-330)
```typescript
const mk = (
  heading: string,
  y: number,
  textH: number,
  content: { lines: string[]; lineH: number; contentH: number },
  fits: boolean
): BlockLayout => {
  // ... creates block with single px value for both
  return {
    // ...
    px,  // Same size for both original and translation
    // ...
  };
};

const y1 = availTop + shift;
blocks.push(mk(PANEL_HEADING_ORIGINAL, y1, textHO, r.mO, fitsO));
const y2 = y1 + chromeH + textHO + panelGap;
blocks.push(mk(PANEL_HEADING_TRANSLATION, y2, textHT, r.mT, fitsT));
```

#### AFTER (Lines ~301-330)
```typescript
const mk = (
  heading: string,
  y: number,
  textH: number,
  content: { lines: string[]; lineH: number; contentH: number },
  fits: boolean,
  fontSize: number        // NEW PARAMETER: Use different size per block
): BlockLayout => {
  // ... creates block with specific fontSize for this block
  return {
    // ...
    px: fontSize,  // Different for original vs translation
    // ...
  };
};

const y1 = availTop + shift;
blocks.push(mk(PANEL_HEADING_ORIGINAL, y1, textHO, r.mO, fitsO, pxO));  // Pass pxO
const y2 = y1 + chromeH + textHO + panelGap;
blocks.push(mk(PANEL_HEADING_TRANSLATION, y2, textHT, r.mT, fitsT, pxT)); // Pass pxT
```

### Key Changes
- ✅ Separated font size calculation for original and translation
- ✅ When auto-fit: uses ratio multiplier on base size
- ✅ When manual: uses independent sizes from UI
- ✅ Maintains all existing overflow detection and warnings
- ✅ Ratio is clamped to 1.0-2.0 range

---

## 4. renderer.ts - Canvas Rendering

### Overflow Prevention

#### BEFORE (Lines ~304-328)
```typescript
ctx.save();
rr(ctx, block.textRect, 4 * unit);
ctx.clip();
ctx.font = fontFor(block.px, 600);
ctx.fillStyle = CREAM;
ctx.shadowColor = "rgba(0,0,0,0.45)";
ctx.shadowBlur = 5 * unit;
const justify = state.typo.justify;
const align = state.header.align;
block.lines.forEach((line, i) => {
  const baseline = block.textRect.y + block.vOffset + i * block.lineH + block.px * 0.92;
  const paragraphEnd = i === block.lines.length - 1 || line.trim() === "";
  drawLine(
    ctx,
    line,
    block.textRect.x,
    baseline,
    block.textRect.w,
    align,
    justify,
    paragraphEnd
  );
});
ctx.restore();
```

#### AFTER (Lines ~304-335)
```typescript
ctx.save();
rr(ctx, block.textRect, 4 * unit);
ctx.clip();
ctx.font = fontFor(block.px, 600);
ctx.fillStyle = CREAM;
ctx.shadowColor = "rgba(0,0,0,0.45)";
ctx.shadowBlur = 5 * unit;
const justify = state.typo.justify;
const align = state.header.align;

// NEW: Calculate max lines that fit in box
const maxVisibleLines = Math.floor(block.textRect.h / block.lineH);

block.lines.forEach((line, i) => {
  // NEW: Only render lines that fit
  if (i < maxVisibleLines) {
    const baseline = block.textRect.y + block.vOffset + i * block.lineH + block.px * 0.92;
    const paragraphEnd = i === block.lines.length - 1 || line.trim() === "";
    drawLine(
      ctx,
      line,
      block.textRect.x,
      baseline,
      block.textRect.w,
      align,
      justify,
      paragraphEnd
    );
  }
});
ctx.restore();
```

### Key Changes
- ✅ Calculate maximum visible lines based on box height
- ✅ Only render lines that fit within the clipping region
- ✅ Canvas clipping (`ctx.clip()`) prevents overflow visually
- ✅ Line limiting prevents memory waste and ensures proper display
- ✅ Text is guaranteed to stay within red box boundaries

---

## 5. panels.tsx - UI Controls

### TypographySection Function

#### BEFORE (Lines ~479-515)
```typescript
export function TypographySection(p: PanelProps) {
  const { state, patchTypo } = p;
  return (
    <Section icon={SlidersHorizontal} title="Text layout" subtitle="Auto-fit + justified Gurmukhi">
      <ToggleRow
        label="Justified alignment"
        desc="Stretch spaces so both panel edges align flush. Last lines stay centered."
        checked={state.typo.justify}
        onChange={(v) => patchTypo({ justify: v })}
      />
      <ToggleRow
        label="Auto-fit text"
        desc={`Start at ${FIT_MAX_PX}px and shrink until the text fills its panel — never below ${FIT_MIN_PX}px.`}
        checked={state.typo.autoFit}
        onChange={(v) => patchTypo({ autoFit: v })}
      />
      <SliderRow
        label="Manual font size"
        value={state.typo.manualSize}
        min={22}
        max={60}
        step={1}
        format={(v) => `${v}px`}
        disabled={state.typo.autoFit}
        onChange={(v) => patchTypo({ manualSize: v })}
      />
      <SliderRow
        label="Line height"
        value={state.typo.lineHeight}
        min={1.3}
        max={1.9}
        step={0.02}
        format={(v) => v.toFixed(2)}
        onChange={(v) => patchTypo({ lineHeight: v })}
      />
    </Section>
  );
}
```

#### AFTER (Lines ~479-532)
```typescript
export function TypographySection(p: PanelProps) {
  const { state, patchTypo } = p;
  const ratio = state.typo.originalSizeRatio.toFixed(2);  // NEW: Display ratio
  return (
    <Section icon={SlidersHorizontal} title="Text layout" subtitle="Auto-fit + justified Gurmukhi">
      <ToggleRow
        label="Justified alignment"
        desc="Stretch spaces so both panel edges align flush. Last lines stay centered."
        checked={state.typo.justify}
        onChange={(v) => patchTypo({ justify: v })}
      />
      <ToggleRow
        label="Auto-fit text"
        desc={`Fit both texts optimally — original ${ratio}× translation size (when enabled).`}  // UPDATED: Show ratio
        checked={state.typo.autoFit}
        onChange={(v) => patchTypo({ autoFit: v })}
      />
      
      {state.typo.autoFit ? (  // NEW: Conditional rendering based on autoFit
        <>
          <SliderRow
            label="Size ratio (Original ÷ Translation)"  // NEW: Ratio slider
            value={state.typo.originalSizeRatio}
            min={1.0}
            max={2.0}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => patchTypo({ originalSizeRatio: v })}
          />
        </>
      ) : (
        <>
          <SliderRow
            label="Original (Mool) font size"  // NEW: Original size slider
            value={state.typo.originalSize}
            min={22}
            max={80}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => patchTypo({ originalSize: v })}
          />
          <SliderRow
            label="Translation font size"  // NEW: Translation size slider
            value={state.typo.translationSize}
            min={18}
            max={60}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => patchTypo({ translationSize: v })}
          />
        </>
      )}

      <SliderRow
        label="Line height"
        value={state.typo.lineHeight}
        min={1.3}
        max={1.9}
        step={0.02}
        format={(v) => v.toFixed(2)}
        onChange={(v) => patchTypo({ lineHeight: v })}
      />
    </Section>
  );
}
```

### Key Changes
- ✅ Dynamic help text showing current ratio
- ✅ Conditional UI based on `autoFit` toggle state
- ✅ When auto-fit ON: Show only ratio slider
- ✅ When auto-fit OFF: Show original and translation sliders separately
- ✅ Sliders have appropriate ranges:
  - Original: 22-80px (wider range for emphasis)
  - Translation: 18-60px (narrower range for legibility)
  - Ratio: 1.0-2.0x (ratio multiplier)

---

## Summary of All Changes

| Component | Changes | Impact |
|-----------|---------|--------|
| `types.ts` | Added 3 properties | Type-safe configuration |
| `defaults.ts` | Added default values | Smart starting point |
| `layout.ts` | Refactored sizing logic | Separate control per text block |
| `renderer.ts` | Added line limiting | Guaranteed overflow prevention |
| `panels.tsx` | Enhanced UI controls | User-friendly separate adjustments |

---

## Data Flow

```
User Adjustment in UI
         ↓
    patchTypo()
         ↓
  StudioState.typo updated
         ↓
    Layout Calculation
    ├─ if autoFit: ratio-based sizing
    └─ if manual: direct sizing
         ↓
  BlockLayout with separate pxO and pxT
         ↓
    Canvas Rendering
    ├─ measure text
    ├─ apply line limiting
    └─ clip to box
         ↓
    Visual Result: Original 1.5x larger, no overflow
```

---

## Backward Compatibility

✅ **All changes are backward compatible:**

- `manualSize` field is preserved in `TypoSettings`
- Existing settings continue to load
- New fields have sensible defaults
- Old projects won't break when loading new version
- No API changes to core functions

---

## Testing Edge Cases

### Test 1: Maximum Sizes
```
originalSize: 80px (max)
translationSize: 60px (max)
Result: Should clip text if too large
```

### Test 2: Minimum Sizes
```
originalSize: 22px (min)
translationSize: 18px (min)
Result: Should render full text, may need 2+ pages
```

### Test 3: Extreme Ratio
```
autoFit: true
originalSizeRatio: 2.0 (max ratio)
Result: Original should be 2x translation while fitting
```

### Test 4: No Ratio (1.0x)
```
autoFit: true
originalSizeRatio: 1.0
Result: Both texts same size
```

---

## Performance Characteristics

- Layout calculation: **O(n)** where n = number of text wrapping iterations
- Rendering: **O(m)** where m = visible lines (due to line limiting optimization)
- Memory: **No increase** (text data structure unchanged)
- Export: **No performance impact** (calculations are the same)

---

This completes the detailed technical reference. All changes maintain code quality, performance, and user experience.
