const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  module._compile(output, filename);
};
const { defaultState } = require('../src/lib/hukamnama/defaults.ts');
const { computeLayout } = require('../src/lib/hukamnama/layout.ts');
const { getPreset } = require('../src/lib/hukamnama/types.ts');
const { wrapText } = require('../src/lib/hukamnama/text.ts');
const { buildSocialCaption } = require('../src/lib/hukamnama/socialCaption.ts');
const { referenceComposite, drawReference } = require('../src/lib/hukamnama/reference.ts');
// Deterministic measurement tests exercise bounds, not visual font equivalence.
const ctx = { font: '', measureText(text) {
  const size = Number(this.font.match(/([\d.]+)px/)?.[1] || 16);
  const clusters = [...new Intl.Segmenter('pa', { granularity: 'grapheme' }).segment(text)];
  return { width: clusters.length * size * .6 };
}};
for (const id of ['feed', 'vertical']) {
  const s = { ...defaultState(), presetId: id, original: 'ਵਾਹਿਗੁਰੂ', translation: 'ਵਾਹਿਗੁਰੂ' };
  const l = computeLayout(s, getPreset(id), ctx);
  assert(l.blocks.every(b => b.fits));
  const longerOriginal = computeLayout({ ...s, original: 'ਵਾਹਿਗੁਰੂ '.repeat(35) }, getPreset(id), ctx);
  assert(longerOriginal.blocks[0].dividerY > l.blocks[0].dividerY, 'separator moves down when the original Hukamnama is longer');
  assert(longerOriginal.blocks[1].textRect.y > l.blocks[1].textRect.y, 'translation follows the dynamically placed separator');
  for (const b of l.blocks) {
    assert(b.textRect.y + b.textRect.h < l.date.rect.y);
    assert(b.textRect.x >= 0 && b.textRect.x + b.textRect.w <= l.w);
  }
  const long = computeLayout({ ...s, original: 'ਵਾਹਿਗੁਰੂ '.repeat(3000) }, getPreset(id), ctx);
  assert.equal(long.blocks[0].fits, false, 'long Gurbani must fail the export fit gate');
  assert(long.warnings.length > 0);
  const manual = computeLayout({ ...s, original: 'ਵਾਹਿਗੁਰੂ '.repeat(500), typo: { ...s.typo, autoFit: false, originalSize: 70 } }, getPreset(id), ctx);
  assert.equal(manual.blocks[0].fits, false);
  const clears = [];
  const imageDraws = [];
  referenceComposite({ canvas: {width: 1080, height: getPreset(id).h}, fillRect(...r) { clears.push(r); }, drawImage(...r) { imageDraws.push(r); } }, {}, id, l);
  assert(clears.some(r => r[1] === (id === 'feed' ? 379 : 483)), 'clear old Gurbani');
  assert(clears.some(r => r[1] === (id === 'feed' ? 1268 : 1645)), 'clear old date');
  if (id === 'vertical') assert.equal(imageDraws.at(-1)[6], l.blocks[0].dividerY - 18, 'reuse the original floral divider at its measured position');

  const mixed = { ...s, dateText: '24-October-2026 | ਕੱਤਕ (KATAK) 10 | ਸ਼ਨੀਚਰਵਾਰ (SATURDAY)', banikar: 'ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ' };
  const drawn = [];
  const drawCtx = Object.assign(Object.create(ctx), {
    canvas: { width: 1080, height: getPreset(id).h }, save() {}, restore() {}, beginPath() {},
    rect() {}, clip() {}, setLineDash() {}, strokeRect() {}, fillText(text, x, y) { drawn.push({ text, font: this.font, x, y }); },
  });
  drawReference(drawCtx, { ...l, blocks: [] }, mixed);
  const latinDate = drawn.find(d => d.text.includes('24-OCTOBER'));
  const punjabiDate = drawn.find(d => d.text.includes('ਕੱਤਕ'));
  assert(latinDate && punjabiDate, 'date contains both Latin and Gurmukhi runs');
  assert(Number(punjabiDate.font.match(/([\d.]+)px/)?.[1]) > Number(latinDate.font.match(/([\d.]+)px/)?.[1]), 'Punjabi date glyphs use optical size adjustment');
  assert(drawn.some(d => d.text.includes('ਗੁਰੂ')) && drawn.some(d => d.text.includes('ਨਾਨਕ')), 'author renders Gurmukhi runs');
}
const clusters = ['ਕਿ', 'ਕਿ', 'ਕਿ'];
assert.deepEqual(wrapText(ctx, clusters.join(''), 20, 13), clusters, 'never split a vowel from its consonant');
assert.equal(defaultState().original, '', 'do not label an example as today’s Hukamnama');
assert.equal(defaultState().dateText, '', 'require a verified date');
const caption = buildSocialCaption({
  dateText: '24-October-2026 | ਕੱਤਕ (Katak) 08 | ਸ਼ਨੀਵਾਰ (Saturday)',
  banikar: 'ਭਗਤ ਨਾਮਦੇਵ ਜੀ', original: 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਵਾਹਿਗੁਰੂ ॥', translation: 'ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ।',
}, 'https://sikhizm.com/today/', 'https://sikhizm.com/download/today.pdf');
assert(caption.includes('🪯 ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ'));
assert(caption.includes('🗓️ 24-October-2026'));
assert(caption.includes('📜 *ਭਗਤ ਨਾਮਦੇਵ ਜੀ* ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਵਾਹਿਗੁਰੂ ॥ 📜'));
assert(caption.includes('🗒️ ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ।'));
assert(caption.includes('https://sikhizm.com/today/'));
assert(caption.includes('https://sikhizm.com/download/today.pdf'));
assert(caption.endsWith('#waheguruji'));
console.log('Renderer and social-caption invariants passed: both formats, overflow, manual sizing, date erasure, graphemes, empty initial state, and caption fields.');
