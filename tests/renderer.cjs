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
assert.equal(live.dateText, '24-October-2026 | ਕੱਤਕ (Katak) 08 | ਸ਼ਨਿਚਰਵਾਰ (Saturday)');
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
assert.equal(fallback.dateText, '24-October-2026 | ਕੱਤਕ (Katak) 08 | ਸ਼ਨਿਚਰਵਾਰ (Saturday)');
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
assert.equal(sikhizmLive.dateText, '24-October-2026 | Saturday', 'do not fabricate a Nanakshahi date missing from the post');
assert.throws(() => parseSikhizmLiveArticle('<p class="Bani">ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਵਾਹਿਗੁਰੂ</p>', sikhizmPost, '2026-10-25'), /not confirmed for today/);
const matchedMetadata = {
  date: { gregorian: { year: 2026, monthno: 10, date: 24 } },
  hukamnamainfo: { pageno: 718, writer: { unicode: 'ਭਗਤ ਨਾਮਦੇਵ ਜੀ' } },
  hukamnama: [{ line: { gurmukhi: { unicode: 'ਟੋਡੀ ਬਾਣੀ ਭਗਤਾਂ ਕੀ ॥ ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ ਕੋਈ ਬੋਲੈ ਨਿਰਵਾ ਕੋਈ ਬੋਲੈ ਦੂਰਿ ॥ ਜਲ ਕੀ ਮਾਛੁਲੀ ਚਰੈ ਖਜੂਰਿ ॥੧॥ ਕਾਂਇ ਰੇ ਬਕਬਾਦੁ ਲਾਇਓ ॥ ਜਿਨਿ ਹਰਿ ਪਾਇਓ ਤਿਨਹਿ ਛਪਾਇਓ ॥੧॥ ਰਹਾਉ ॥ ਪੰਡਿਤੁ ਹੋਇ ਕੈ ਬੇਦੁ ਬਖਾਨੈ ॥ ਮੂਰਖੁ ਨਾਮਦੇਉ ਰਾਮਹਿ ਜਾਨੈ ॥੨॥੧॥' } } }],
};
assert.equal(matchGurbaniNowMetadata(matchedMetadata, live), 'ਭਗਤ ਨਾਮਦੇਵ ਜੀ', 'accept author only when date, Ang and opening Gurbani all match');
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
