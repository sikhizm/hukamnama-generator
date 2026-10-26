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
const { wrapText, measureBalancedAt } = require('../src/lib/hukamnama/text.ts');
const { buildSocialCaption } = require('../src/lib/hukamnama/socialCaption.ts');
const { parseSgpcPage, parseSgpcDailyMukhwakPage, parseSikhizmFeed, parseSikhizmLiveArticle, parseSikhizmPunjabiTranslation, findSikhizmPdfUrl, matchGurbaniNowMetadata } = require('../src/lib/hukamnama/liveSource.ts');
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
  assert(l.blocks[0].px > l.blocks[1].px, "Gurbani must always be larger than its explanation");
  const longerOriginal = computeLayout({ ...s, original: 'ਵਾਹਿਗੁਰੂ '.repeat(35) }, getPreset(id), ctx);
  assert(longerOriginal.blocks[1].textRect.y >= longerOriginal.blocks[0].textRect.y + longerOriginal.blocks[0].contentH, 'translation follows the complete original even when the separator is hidden');
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
  assert(clears.some(r => r[1] === (id === 'feed' ? 1256 : 1644)), 'clear old date');
  if (id === 'vertical' && l.blocks[0].dividerY > 0) assert.equal(imageDraws.at(-1)[6], l.blocks[0].dividerY - 18, 'reuse the original floral divider at its measured position');

  const mixed = { ...s, dateText: '24-October-2026 | ਕੱਤਕ (KATAK) 10 | ਸ਼ਨੀਚਰਵਾਰ (SATURDAY)', banikar: 'ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ' };
  const drawn = [];
  const drawCtx = Object.assign(Object.create(ctx), {
    measureText(text) {
      const metrics = ctx.measureText.call(this, text);
      const px = Number(this.font.match(/([\d.]+)px/)?.[1] || 16);
      return { ...metrics, actualBoundingBoxAscent: px * .75, actualBoundingBoxDescent: px * .25 };
    },
    canvas: { width: 1080, height: getPreset(id).h }, save() {}, restore() {}, beginPath() {},
    rect() {}, clip() {}, setLineDash() {}, strokeRect() {}, fillText(text, x, y) { const m = this.measureText(text); drawn.push({ text, font: this.font, x, y, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent }); },
  });
  drawReference(drawCtx, { ...l, blocks: [] }, mixed);
  const latinDate = drawn.find(d => d.text.includes('24-OCTOBER'));
  const punjabiDate = drawn.find(d => d.text.includes('ਕੱਤਕ'));
  assert(latinDate && punjabiDate, 'date contains both Latin and Gurmukhi runs');
  assert(Number(punjabiDate.font.match(/([\d.]+)px/)?.[1]) > Number(latinDate.font.match(/([\d.]+)px/)?.[1]), 'Punjabi date glyphs use optical size adjustment');
  assert(drawn.some(d => d.text.includes('ਗੁਰੂ')) && drawn.some(d => d.text.includes('ਨਾਨਕ')), 'author renders Gurmukhi runs');
  const config = require('../src/lib/hukamnama/reference.ts').referenceConfig(id);
  for (const strip of [config.stripe, config.date]) {
    const labels = drawn.filter(run => run.y > strip[1] && run.y < strip[1] + strip[3]);
    assert(labels.length > 0);
    const topPad = Math.min(...labels.map(run => run.top)) - strip[1];
    const bottomPad = strip[1] + strip[3] - Math.max(...labels.map(run => run.bottom));
    assert.ok(Math.abs(topPad - bottomPad) < 1, 'maroon label glyphs have equal top/bottom padding');
    assert.ok(topPad >= 6 && bottomPad >= 6, 'label glyphs retain a minimum six-pixel vertical inset');
  }

}
const clusters = ['ਕਿ', 'ਕਿ', 'ਕਿ'];
assert.deepEqual(wrapText(ctx, clusters.join(''), 20, 13), clusters, 'never split a vowel from its consonant');
assert.equal(defaultState().original, '', 'do not label an example as today’s Hukamnama');
assert.equal(defaultState().dateText, '', 'require a verified date');
const caption = buildSocialCaption({
  dateText: '24-October-2026 | ਕੱਤਕ (Katak) 08 | ਸ਼ਨੀਵਾਰ (Saturday)',
  original: 'ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਵਾਹਿਗੁਰੂ ॥', translation: 'ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ।',
}, 'https://sikhizm.com/today/', 'https://sikhizm.com/download/today.pdf');
assert(caption.includes('🪯 ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ'));
assert(caption.includes('🗓️ 24-October-2026'));
assert(caption.includes('📜 *ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਵਾਹਿਗੁਰੂ ॥* 📜'));
assert(caption.includes('🗒️ ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ।'));
assert(caption.includes('https://sikhizm.com/today/'));
assert(caption.includes('https://sikhizm.com/download/today.pdf'));
assert(caption.endsWith('#waheguruji'));
const live = parseSgpcPage(`<html><body>
  <h2>ਮੁੱਖਵਾਕ</h2><h2>ਸੱਚਖੰਡ ਸ੍ਰੀ ਹਰਿਮੰਦਰ ਸਾਹਿਬ, ਸ੍ਰੀ ਅੰਮ੍ਰਿਤਸਰ</h2>
  <p>24-10-2026 05:30 AM</p><p>🎵 Hukamnama Audio</p><p>🎵 Katha Audio</p>
  <h4>ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ</h4><h5>ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥</h5>
  <p>ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ ਕੋਈ ਬੋਲੈ ਦੂਰਿ ॥ ਜਲ ਕੀ ਮਾਛੁਲੀ ਚਰੈ ਖਜੂਰਿ ॥੧॥</p>
  <p>ਸ਼ਨਿਚਰਵਾਰ, ੮ ਕੱਤਕ (ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ)</p><p>(ਅੰਗ: ੭੧੮)</p>
  <h4>ਪੰਜਾਬੀ ਵਿਆਖਿਆ</h4><p>ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ ਕਿ ਪ੍ਰਭੂ ਨੇੜੇ ਹੈ।</p>
  <h4>English Translation</h4><h5>Saturday, 8th Katak (Samvat 558 Nanakshahi)</h5><p>Some say that He is near.</p>
</body></html>`, '2026-10-24', '2026-10-24T09:30:00.000Z');
assert.equal(live.isToday, true);
assert.equal(live.sourceTime, '05:30 AM');
assert.equal(live.ang, '718');
assert(live.original.includes('ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ'));
assert(live.translation.includes('ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ'));
assert.equal(live.dateText, '24-October-2026 | ਕੱਤਕ 08, 558 | ਸ਼ਨਿਚਰਵਾਰ (Saturday)');
const fallback = parseSgpcDailyMukhwakPage(`<html><body>
  <h2>ਰੋਜ਼ਾਨਾ ਮੁੱਖਵਾਕ / Daily Mukhwak</h2>
  <h3>ਮੁੱਖਵਾਕ - ਸੱਚਖੰਡ ਸ੍ਰੀ ਹਰਿਮੰਦਰ ਸਾਹਿਬ ਸ੍ਰੀ ਅੰਮ੍ਰਿਤਸਰ</h3>
  <h4>ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ</h4><p>ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥</p>
  <p>ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ ਕੋਈ ਬੋਲੈ ਦੂਰਿ ॥ ਜਲ ਕੀ ਮਾਛੁਲੀ ਚਰੈ ਖਜੂਰਿ ॥੧॥ ਕਾਂਇ ਰੇ ਬਕਬਾਦੁ ਲਾਇਓ ॥ ਜਿਨਿ ਹਰਿ ਪਾਇਓ ਤਿਨਹਿ ਛਪਾਇਓ ॥੧॥ ਰਹਾਉ ॥</p>
  <p>ਸ਼ਨਿਚਰਵਾਰ, ੮ ਕੱਤਕ (ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ) ੨੪ ਅਕਤੂਬਰ, ੨੦੨੬ (ਅੰਗ: ੭੧੮)</p>
</body></html>`, '2026-10-24', '2026-10-24T12:00:00.000Z');
assert.equal(fallback.isToday, true);
assert.equal(fallback.sourceName, 'SGPC Daily Mukhwak page');
assert.equal(fallback.ang, '718');
assert.equal(fallback.dateText, '24-October-2026 | ਕੱਤਕ 08, 558 | ਸ਼ਨਿਚਰਵਾਰ (Saturday)');
assert.equal(fallback.translation, '', 'official SGPC fallback must not invent a Punjabi translation');
const matchedTranslation = parseSikhizmPunjabiTranslation(`<html><body>
  <p>Ang</p><p>718</p><p>ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ ਕੋਈ ਬੋਲੈ ਦੂਰਿ ॥ ਜਲ ਕੀ ਮਾਛੁਲੀ ਚਰੈ ਖਜੂਰਿ ॥੧॥ ਕਾਂਇ ਰੇ ਬਕਬਾਦੁ ਲਾਇਓ ॥ ਜਿਨਿ ਹਰਿ ਪਾਇਓ ਤਿਨਹਿ ਛਪਾਇਓ ॥੧॥ ਰਹਾਉ ॥</p>
  <h3>4. Punjabi Translation by Prof Sahib Singh Ji</h3>
  <p>ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ ਕਿ ਪ੍ਰਭੂ ਨੇੜੇ ਹੈ।</p><p>ਇੱਕ ਹੋਰ ਪੈਰਾ।</p><p>ਸ਼ਬਦ ਦਾ ਭਾਵ: ਇਹ ਸਿਰਫ ਜਾਂਚ ਲਈ ਹੈ।</p>
</body></html>`, fallback.original, fallback.ang);
assert.equal(matchedTranslation, 'ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ ਕਿ ਪ੍ਰਭੂ ਨੇੜੇ ਹੈ। ਇੱਕ ਹੋਰ ਪੈਰਾ।', 'accept same Ang and matching Gurbani translation from Sikhizm article');
assert.equal(parseSikhizmPunjabiTranslation('<p>Ang</p><p>719</p>', fallback.original, fallback.ang), null, 'reject translation from a different Ang');
const sikhizmPost = { publishedAt: 'Sat, 24 Oct 2026 00:00:57 +0000', localDateISO: '2026-10-24' };
const sikhizmLive = parseSikhizmLiveArticle(`<html><head><meta property="article:published_time" content="2026-10-24T00:00:57+00:00"></head><body>
  <table><tr><td>Ang</td><td>718</td></tr></table>
  <p class="Bani"><span lang="PA">ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ ਕੋਈ ਬੋਲੈ ਦੂਰਿ ॥ ਜਲ ਕੀ ਮਾਛੁਲੀ ਚਰੈ ਖਜੂਰਿ ॥੧॥ ਕਾਂਇ ਰੇ ਬਕਬਾਦੁ ਲਾਇਓ ॥ ਜਿਨਿ ਹਰਿ ਪਾਇਓ ਤਿਨਹਿ ਛਪਾਇਓ ॥੧॥ ਰਹਾਉ ॥ ਪੰਡਿਤੁ ਹੋਇ ਕੈ ਬੇਦੁ ਬਖਾਨੈ ॥ ਮੂਰਖੁ ਨਾਮਦੇਵ ਰਾਮਹਿ ਜਾਨੈ ॥੨॥੧॥</span></p>
  <h3>4. Punjabi Translation by Prof Sahib Singh Ji</h3><p>ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ ਕਿ ਪ੍ਰਭੂ ਨੇੜੇ ਹੈ।</p><p>ਸ਼ਬਦ ਦਾ ਭਾਵ: ਇਹ ਸਿਰਫ ਜਾਂਚ ਲਈ ਹੈ।</p>
</body></html>`, sikhizmPost, '2026-10-24');
assert.equal(sikhizmLive.isToday, true, 'accept only the same-day Sikhizm post');
assert.equal(sikhizmLive.ang, '718');
assert.equal(sikhizmLive.sourceName, 'Sikhizm same-day Hukamnama post');
assert(sikhizmLive.original.includes('ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ'));
assert.equal(sikhizmLive.translation, 'ਕੋਈ ਮਨੁੱਖ ਆਖਦਾ ਹੈ ਕਿ ਪ੍ਰਭੂ ਨੇੜੇ ਹੈ।');
assert.equal(sikhizmLive.dateText, '24-October-2026 | ਕੱਤਕ 08, 558 | ਸ਼ਨਿਚਰਵਾਰ (Saturday)', 'use the published annual SGPC calendar when the daily page is unavailable');
assert.throws(() => parseSikhizmLiveArticle('<p class="Bani">ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਵਾਹਿਗੁਰੂ</p>', sikhizmPost, '2026-10-25'), /not confirmed for today/);
// Today's legacy shortcode post has no p.Bani and uses a plain translation heading.
const legacyPost = { publishedAt: 'Sun, 25 Oct 2026 00:00:11 +0000', localDateISO: '2026-10-25' };
const legacyHtml = fs.readFileSync(require('node:path').join(__dirname, 'fixtures/sikhizm-2026-10-25.html'), 'utf8');
const legacyLive = parseSikhizmLiveArticle(legacyHtml, legacyPost, '2026-10-25');
assert.equal(legacyLive.ang, '678');
assert.ok(legacyLive.original.startsWith('ਧਨਾਸਰੀ ਮਹਲਾ ੫ ਘਰੁ ੬ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਸੁਨਹੁ ਸੰਤ ਪਿਆਰੇ'));
assert.ok(legacyLive.original.endsWith('॥੩॥੧॥੨੯॥'), 'preserve the complete closing Gurbani');
assert.ok(legacyLive.translation.startsWith('ਹੇ ਪਿਆਰੇ ਸੰਤ ਜਨੋ!'));
assert.ok(legacyLive.translation.endsWith('੩।੧।੨੯।'), 'preserve every Punjabi explanation paragraph');
assert.ok(!legacyLive.translation.includes('हिन्दी'), 'stop before the next language heading');
assert.equal(legacyLive.original.length, 479);
assert.equal(legacyLive.translation.length, 952);
assert.equal(legacyLive.metadataMatched, true, 'same-day article supplies its explicitly labelled Creator');
assert.equal(legacyLive.matchedAuthor, 'Guru Arjan Dev Ji');
assert.throws(() => parseSikhizmLiveArticle(legacyHtml, legacyPost, '2026-10-26'), /not confirmed for today/);
const nestedLegacy = legacyHtml.replace('<div class="su-box-content">', '<div class="su-box-content"><div><span>').replace('॥੩॥੧॥੨੯॥</div>', '॥੩॥੧॥੨੯॥</span></div></div>');
assert.equal(parseSikhizmLiveArticle(nestedLegacy, legacyPost, '2026-10-25').original, legacyLive.original, 'nested markup must not cut the shabad');
assert.throws(() => parseSikhizmLiveArticle(legacyHtml.replace('su-box-content', 'other-box'), legacyPost, '2026-10-25'), /complete Gurmukhi/, 'do not scrape arbitrary page text');
assert.throws(() => parseSikhizmLiveArticle(legacyHtml.replace('॥੩॥੧॥੨੯॥', ''), legacyPost, '2026-10-25'), /complete Gurmukhi/, 'reject a visibly cut off Gurbani block');
assert.equal(parseSikhizmPunjabiTranslation(legacyHtml.replace('<td>678</td>', '<td>679</td>'), legacyLive.original, '678'), null, 'Ang mismatch must still reject translation');
const matchedMetadata = {
  date: { gregorian: { year: 2026, monthno: 10, date: 24 } },
  hukamnamainfo: { pageno: 718, writer: { unicode: 'ਭਗਤ ਨਾਮਦੇਵ ਜੀ' } },
  hukamnama: [{ line: { gurmukhi: { unicode: 'ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ॥ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ ਕੋਈ ਬੋਲੈ ਦੂਰਿ ॥ ਜਲ ਕੀ ਮਾਛੁਲੀ ਚਰੈ ਖਜੂਰਿ ॥੧॥ ਕਾਂਇ ਰੇ ਬਕਬਾਦੁ ਲਾਇਓ ॥ ਜਿਨਿ ਹਰਿ ਪਾਇਓ ਤਿਨਹਿ ਛਪਾਇਓ ॥੧॥ ਰਹਾਉ ॥ ਪੰਡਿਤੁ ਹੋਇ ਕੈ ਬੇਦੁ ਬਖਾਨੈ ॥ ਮੂਰਖੁ ਨਾਮਦੇਉ ਰਾਮਹਿ ਜਾਨੈ ॥੨॥੧॥' } } }],
};
assert.equal(matchGurbaniNowMetadata(matchedMetadata, live), 'Bhagat Namdev Ji', 'accept author only when date, Ang and opening Gurbani all match');
assert.equal(matchGurbaniNowMetadata({ ...matchedMetadata, hukamnamainfo: { ...matchedMetadata.hukamnamainfo, pageno: 719 } }, live), null, 'reject metadata with a different Ang');
assert.equal(matchGurbaniNowMetadata({ ...matchedMetadata, date: { gregorian: { year: 2026, monthno: 10, date: 23 } } }, live), null, 'reject a stale daily response');
assert.equal(matchGurbaniNowMetadata({ ...matchedMetadata, hukamnama: [{ line: { gurmukhi: { unicode: 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਕਿਸੇ ਹੋਰ ਸ਼ਬਦ ਦੀ ਤੁਕ ॥' } } }] }, live), null, 'reject a different Gurbani passage');
const feed = parseSikhizmFeed(`<rss><channel><item>
  <title>Koi Bole Nirva Koi Bole Door</title><link>https://sikhizm.com/koi-bole-nirva-koi-bole-door/</link>
  <pubDate>Fri, 23 Oct 2026 19:00:00 +0000</pubDate>
  <content:encoded><![CDATA[<a href="https://sikhizm.com/download/281582/?tmstv=1749252210">Download Hukamnama PDF</a>]]></content:encoded>
</item></channel></rss>`);
assert.equal(feed[0].localDateISO, '2026-10-24', 'RSS publication time is interpreted in India time');
assert.equal(feed[0].link, 'https://sikhizm.com/koi-bole-nirva-koi-bole-door/');
assert.equal(findSikhizmPdfUrl(feed[0].content, feed[0].link), 'https://sikhizm.com/download/281582/?tmstv=1749252210');
console.log('Renderer, caption, and live-feed invariants passed: both formats, overflow, manual sizing, date erasure, graphemes, primary/fallback SGPC parsing, same-day Sikhizm source and translation matching, guarded author matching, RSS/PDF links, and caption fields.');

const { AUTHOR_OPTIONS, normalizeAuthor, liveAuthor } = require('../src/lib/hukamnama/authors.ts');
assert.equal(AUTHOR_OPTIONS.length, 9);
assert.equal(normalizeAuthor('ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ'), 'Guru Arjan Dev Ji');
assert.equal(normalizeAuthor('Bani Bhagat Namdev Ji'), 'Bhagat Namdev Ji');
assert.equal(normalizeAuthor('Guru Amar Das Ji'), 'Guru Amardas Ji');
assert.equal(normalizeAuthor('Guru Ram Das Ji'), 'Guru Ramdas Ji');
assert.equal(normalizeAuthor('Bhagat Farid Ji'), 'Bhagat Farid Ji', 'unknown author stays available for Custom');
assert.equal(liveAuthor(null), '', 'missing author clears yesterday’s selection');
const creatorFree = legacyHtml.replace('Guru Arjan Dev Ji', '');
assert.equal(parseSikhizmLiveArticle(creatorFree, legacyPost, '2026-10-25').matchedAuthor, null);
const customCreator = legacyHtml.replace('Guru Arjan Dev Ji', 'Bhagat Farid Ji');
assert.equal(parseSikhizmLiveArticle(customCreator, legacyPost, '2026-10-25').matchedAuthor, 'Bhagat Farid Ji');

const { formatSgpcCalendarDate } = require('../src/lib/hukamnama/sgpcDate.ts');
const todayCalendar = 'ਐਤਵਾਰ, ੯ ਕੱਤਕ (ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ)';
const expectedCalendar = '25-October-2026 | ਕੱਤਕ 09, 558 | ਐਤਵਾਰ (Sunday)';
assert.equal(formatSgpcCalendarDate(todayCalendar, '2026-10-25'), expectedCalendar);
assert.equal(formatSgpcCalendarDate('Sunday, 9th Katak (Samvat 558 Nanakshahi)', '2026-10-25'), expectedCalendar);
assert.equal(formatSgpcCalendarDate(todayCalendar + ' Sunday, 10th Katak (Samvat 558 Nanakshahi)', '2026-10-25'), null, 'reject conflicting calendar lines');
assert.equal(formatSgpcCalendarDate(todayCalendar, '2026-10-26'), null, 'reject a weekday mismatch');
assert.equal(formatSgpcCalendarDate(todayCalendar, '2026-02-31'), null, 'reject invalid Gregorian dates');
assert.equal(formatSgpcCalendarDate('25 October 2026', '2026-10-25'), null, 'never invent an absent Nanakshahi date');
assert.equal(formatSgpcCalendarDate('Sunday, 99th Katak (Samvat 558 Nanakshahi)', '2026-10-25'), null);

assert.equal(formatSgpcCalendarDate('18-10-2026 05:30 AM ' + todayCalendar, '2026-10-25'), null, 'reject an older SGPC release even if its weekday agrees');
assert.ok(buildSocialCaption({ ...defaultState(), dateText: expectedCalendar }, '', '').includes(expectedCalendar), 'caption keeps the complete dual-calendar date');

const balancedText = 'aaaa aaaa aaaa aaaa aaaa aa';
const balanced = measureBalancedAt(ctx, balancedText, 10, 150);
assert.equal(balanced.lines.join(' '), balancedText, 'balancing preserves words and order exactly');
assert.ok(ctx.measureText(balanced.lines.at(-1)).width > ctx.measureText(wrapText(ctx, balancedText, 10, 150, 400).at(-1)).width, 'last line is balanced instead of leaving a tiny orphan');
const { publishedSgpcDate, upgradeGregorianDate, SGPC_558_MONTHS } = require('../src/lib/hukamnama/sgpcCalendar.ts');
assert.equal(publishedSgpcDate('2026-10-25'), expectedCalendar);
assert.equal(publishedSgpcDate('2026-10-17'), '17-October-2026 | ਕੱਤਕ 01, 558 | ਸ਼ਨਿਚਰਵਾਰ (Saturday)');
assert.equal(publishedSgpcDate('2026-11-15'), '15-November-2026 | ਕੱਤਕ 30, 558 | ਐਤਵਾਰ (Sunday)');
assert.ok(publishedSgpcDate('2026-11-16').includes('ਮੱਘਰ 01, 558'));
assert.ok(publishedSgpcDate('2027-03-14').includes('ਫੱਗਣ 30, 558'));
assert.equal(publishedSgpcDate('2027-03-15'), null, 'do not extrapolate beyond the published year');
assert.equal(publishedSgpcDate('2026-03-13'), null);
assert.equal(publishedSgpcDate('2026-02-31'), null);
assert.equal(SGPC_558_MONTHS.length, 12);
assert.equal(upgradeGregorianDate('25-October-2026 | Sunday', '2026-10-25'), expectedCalendar);
assert.equal(upgradeGregorianDate('My reviewed custom date', '2026-10-25'), 'My reviewed custom date');

// Three-level artwork hierarchy retains canonical source and justified body text.
const { splitIntroduction, joinIntroduction } = require('../src/lib/hukamnama/introduction.ts');
const intro = 'ਧਨਾਸਰੀ ਭਗਤ ਰਵਿਦਾਸ ਜੀ ਕੀ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥';
const body = 'ਹਮ ਸਰਿ ਦੀਨੁ ਦਇਆਲੁ ਨ ਤੁਮ ਸਰਿ ਅਬ ਪਤੀਆਰੁ ਕਿਆ ਕੀਜੈ ॥ ਬਚਨੀ ਤੋਰ ਮੋਰ ਮਨੁ ਮਾਨੈ ਜਨ ਕਉ ਪੂਰਨੁ ਦੀਜੈ ॥੧॥ ਹਉ ਬਲਿ ਬਲਿ ਜਾਉ ਰਮਈਆ ਕਾਰਨੇ ॥ ਕਾਰਨ ਕਵਨ ਅਬੋਲ ॥ ਰਹਾਉ ॥';
const source = `${intro} ${body}`;
assert.deepEqual(splitIntroduction(source), { introduction: intro, body });
assert.equal(joinIntroduction(intro, body), source);
assert.deepEqual(splitIntroduction('ਸਲੋਕੁ ਮਃ ੫ ॥ ਮੇਰਾ ਪਾਠ ॥੧॥'), { introduction: '', body: 'ਸਲੋਕੁ ਮਃ ੫ ॥ ਮੇਰਾ ਪਾਠ ॥੧॥' }, 'ambiguous boundaries stay editable instead of guessing');
assert.equal(splitIntroduction(source, '').body, source, 'explicitly empty introduction preserves the whole body');
assert.equal(splitIntroduction(source, 'old heading').introduction, intro, 'stale saved introduction cannot remove new source text');
for (const id of ['feed', 'vertical']) {
  const state = { ...defaultState(), presetId: id, original: source, translation: 'ਹੇ ਮਾਧੋ! ਮੇਰੇ ਵਰਗਾ ਕੋਈ ਨਿਮਾਣਾ ਨਹੀਂ।੧। ਹੇ ਸੋਹਣੇ ਰਾਮ! ਮੈਂ ਤੈਥੋਂ ਸਦਾ ਸਦਕੇ ਹਾਂ। ਰਹਾਉ।' };
  const layout = computeLayout(state, getPreset(id), ctx);
  assert.ok(layout.introduction.fits);
  assert.equal(layout.introduction.lines.length, 1, 'short introduction fits one line');
  assert.ok(layout.blocks.every(block => block.fits));
  assert.ok(layout.introduction.px < layout.blocks[0].px);
  assert.ok(layout.blocks[1].px < layout.blocks[0].px);
  assert.equal(layout.blocks[0].lines.join(' '), body, 'introduction is not duplicated in main text');
  assert.ok(layout.blocks[0].textRect.y >= layout.introduction.textRect.y + layout.introduction.contentH + 16);
  const runs = [];
  const drawCtx = Object.assign(Object.create(ctx), { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillText(text, x, y) { runs.push({ text, x, y, color: this.fillStyle }); } });
  drawReference(drawCtx, layout, state);
  assert.ok(runs.some(run => run.text === intro && run.color === '#800000'), 'introduction uses its own maroon colour');
  const firstWord = layout.blocks[0].lines[0].split(' ')[0];
  assert.ok(runs.some(run => run.text === firstWord && run.x === layout.blocks[0].textRect.x && run.y > layout.blocks[0].textRect.y), 'main Gurbani retains justified word placement');
  const custom = computeLayout({ ...state, typo: { ...state.typo, autoFit: false, introductionSize: 28, originalSize: 55, translationSize: 32 } }, getPreset(id), ctx);
  assert.equal(custom.introduction.px, 28); assert.equal(custom.blocks[0].px, 55); assert.equal(custom.blocks[1].px, 32);
  const longIntro = 'ਧਨਾਸਰੀ '.repeat(12) + 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥';
  const wrapped = computeLayout({ ...state, original: joinIntroduction(longIntro, body) }, getPreset(id), ctx);
  assert.ok(wrapped.introduction.lines.length > 1, 'long headings wrap without truncating');
  assert.equal(wrapped.introduction.lines.join(' '), longIntro.trim());
  const overflow = computeLayout({ ...state, original: joinIntroduction('ਧਨਾਸਰੀ '.repeat(1000), body), introduction: 'ਧਨਾਸਰੀ '.repeat(1000).trim(), typo: { ...state.typo, autoFit: false } }, getPreset(id), ctx);
  assert.equal(overflow.introduction.fits, false);
}
console.log('Introduction hierarchy passed: automatic split, custom boundary, full-source preservation, both formats, independent pixel sizes, wrapping and overflow gating.');
