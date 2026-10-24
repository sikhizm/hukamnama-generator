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
const { referenceComposite } = require('../src/lib/hukamnama/reference.ts');
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
  referenceComposite({ canvas: {width: 1080, height: getPreset(id).h}, fillRect(...r) { clears.push(r); }, drawImage() {} }, null, id);
  assert(clears.some(r => r[1] === (id === 'feed' ? 379 : 483)), 'clear old Gurbani');
  assert(clears.some(r => r[1] === (id === 'feed' ? 1268 : 1645)), 'clear old date');
}
const clusters = ['ਕਿ', 'ਕਿ', 'ਕਿ'];
assert.deepEqual(wrapText(ctx, clusters.join(''), 20, 13), clusters, 'never split a vowel from its consonant');
assert.equal(defaultState().original, '', 'do not label an example as today’s Hukamnama');
assert.equal(defaultState().dateText, '', 'require a verified date');
console.log('Renderer invariants passed: both formats, overflow, manual sizing, date erasure, graphemes, empty initial state.');
