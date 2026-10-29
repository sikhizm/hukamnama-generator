const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, file);
const { hukamnamaExcerpt } = require('../src/lib/hukamnama/excerpt.ts');
const { parseSikhizmLiveArticle } = require('../src/lib/hukamnama/liveSource.ts');
const record = parseSikhizmLiveArticle(fs.readFileSync('tests/fixtures/sikhizm-2026-10-25.html', 'utf8'), { publishedAt: '2026-10-25T00:00:11Z', localDateISO: '2026-10-25' }, '2026-10-25');
const result = hukamnamaExcerpt(record.original, record.translation);
assert.equal(result.error, null);
assert.equal(result.original, record.original.slice(0, record.original.indexOf('॥੧॥') + '॥੧॥'.length).trim());
assert.ok(result.original.endsWith('ਦੀਨਾ ਜੀਉ ॥੧॥'));
assert.ok(result.translation.endsWith('ਗੁਰੂ ਨੇ ਦਿੱਤੀ ਹੈ।੧।'));
assert.ok(!result.translation.includes('ਹੇ ਭਾਈ!'));
assert.ok([...result.original].length <= 250);
assert.equal(record.original.length, 479, 'source remains complete');
const chant = 'ਰਹਾਉ ॥';
const longRahau = 'ਅ'.repeat(205) + chant + 'ਅ'.repeat(100) + '॥੧॥';
assert.equal(hukamnamaExcerpt(longRahau, 'ਵਿਆਖਿਆ।ਰਹਾਉ। ਹੋਰ।੧।').original, 'ਅ'.repeat(205) + chant);
assert.equal(hukamnamaExcerpt(longRahau, 'ਵਿਆਖਿਆ।ਰਹਾਉ। ਹੋਰ।੧।').translation, 'ਵਿਆਖਿਆ।ਰਹਾਉ।');
const grouped = 'ਅ'.repeat(220) + '॥੨॥੧॥' + 'ਅ'.repeat(100);
assert.equal(hukamnamaExcerpt(grouped, 'ਵਿਆਖਿਆ।੨।੧। ਹੋਰ').original, 'ਅ'.repeat(220) + '॥੨॥੧॥');
assert.equal(hukamnamaExcerpt(grouped, 'ਵਿਆਖਿਆ।੨।੧। ਹੋਰ').translation, 'ਵਿਆਖਿਆ।੨।੧।');
assert.ok(hukamnamaExcerpt(grouped, 'unmarked explanation').error);
assert.equal(hukamnamaExcerpt('ਅ'.repeat(260) + '॥੧॥' + 'ਅ'.repeat(70) + '॥੨॥', 'ਵਿਆਖਿਆ।੧। ਹੋਰ।੨।').original, 'ਅ'.repeat(260) + '॥੧॥');
assert.equal(hukamnamaExcerpt('ਛੋਟਾ ਸ਼ਬਦ ॥੧॥', 'ਪੂਰੀ ਵਿਆਖਿਆ।੧।').shortened, false);
// A later rahau overrides the usual 250-character budget, with aligned meaning.
const late = 'ਅ'.repeat(220) + '॥੧॥ ' + 'ਅ'.repeat(40) + chant;
const lateExcerpt = hukamnamaExcerpt(late, 'ਪਹਿਲਾ।੧। ਅੰਤ।ਰਹਾਉ।');
assert.equal(lateExcerpt.error, null);
assert.equal(lateExcerpt.original, late);
assert.equal(lateExcerpt.translation, 'ਪਹਿਲਾ।੧। ਅੰਤ।ਰਹਾਉ।');
assert.ok([...lateExcerpt.original].length > 250);
const noEarlierVerse = 'ਅ'.repeat(300) + '॥੧॥ ਰਹਾਉ ॥' + 'ਅ'.repeat(90) + '॥੨॥';
assert.equal(hukamnamaExcerpt(noEarlierVerse, 'ਰੁਕਾਉ।੧।ਰਹਾਉ। ਹੋਰ।੨।').original, 'ਅ'.repeat(300) + '॥੧॥ ਰਹਾਉ ॥');
assert.ok(hukamnamaExcerpt(late, 'ਗਲਤ।੨। ਅੰਤ।ਰਹਾਉ।').error, 'long rahau still requires matching translation');
console.log(`Verse excerpts passed: today's requested excerpt (${[...result.original].length} characters), matching translation, rahau, grouped markers, numbered-ending budget, and review gates.`);

// A numbered first stanza before rahau makes rahau the priority even below 200.
const early = 'ਅ'.repeat(80) + '॥੧॥ ' + 'ਅ'.repeat(50) + '॥ ਰਹਾਉ ॥' + 'ਅ'.repeat(150) + '॥੨॥';
const priority = hukamnamaExcerpt(early, 'ਪਹਿਲਾ ॥੧॥ ਰੁਕਾਉ ॥ ਰਹਾਉ ॥ ਬਾਕੀ ॥੨॥');
assert.equal(priority.error, null);
assert.ok(priority.original.endsWith('॥ ਰਹਾਉ ॥'));
assert.equal(priority.translation, 'ਪਹਿਲਾ ॥੧॥ ਰੁਕਾਉ ॥ ਰਹਾਉ ॥');
assert.ok(hukamnamaExcerpt(early, 'ਪਹਿਲਾ ॥੧॥ unmarked rest').error);

const { loadedContent, captionContent } = require('../src/lib/hukamnama/loadedContent.ts');
const today = parseSikhizmLiveArticle(fs.readFileSync('tests/fixtures/sikhizm-2026-10-26.html', 'utf8'), { publishedAt: '2026-10-26T00:00:00Z', localDateISO: '2026-10-26' }, '2026-10-26');
const loaded = loadedContent(today);
assert.ok(loaded.original.endsWith('ਰਹਾਉ ॥'));
assert.ok(!loaded.original.includes('ਬਹੁਤ ਜਨਮ'));
assert.ok(loaded.translation.endsWith('ਰਹਾਉ।'));
assert.ok(!loaded.translation.includes('ਕਈ ਜਨਮਾਂ'));
assert.equal(loaded.fullOriginal, today.original);
assert.equal(loaded.fullTranslation, today.translation);
assert.equal(captionContent(loaded).original, today.original);
console.log('Today’s Ang 694 load passed: visible fields stop at rahau, full source remains available for captions.');

const { buildSocialCaption } = require('../src/lib/hukamnama/socialCaption.ts');
assert.ok(buildSocialCaption({ ...loaded, dateText: today.dateText }, '', '').includes('ਬਹੁਤ ਜਨਮ'), 'full caption retains the later stanza omitted from artwork');

// Actual 29 October article: stanza 1 precedes a late numbered rahau,
// while its Punjabi explanation places rahau before stanza 1.
const oct29 = JSON.parse(fs.readFileSync('tests/fixtures/sikhizm-2026-10-29.json', 'utf8'));
const oct29Excerpt = hukamnamaExcerpt(oct29.original, oct29.translation);
const rahauEnd = oct29.original.indexOf('ਰਹਾਉ ॥') + 'ਰਹਾਉ ॥'.length;
assert.equal(oct29Excerpt.error, null);
assert.equal(oct29Excerpt.original, oct29.original.slice(0, rahauEnd));
assert.ok([...oct29Excerpt.original].length > 250);
assert.ok(oct29Excerpt.original.endsWith('॥੧॥ ਰਹਾਉ ॥'));
assert.ok(!oct29Excerpt.original.includes('ਤੂ ਦਇਆਲੁ'));
assert.ok(oct29Excerpt.translation.startsWith('ਹੇ ਭਾਈ! ਜੇ ਇਸ ਸਰੀਰ'));
assert.ok(oct29Excerpt.translation.endsWith('।੧।ਰਹਾਉ।'));
assert.ok(oct29Excerpt.translation.indexOf('ਜੀਵਨ ਗਵਾ ਲੈਂਦਾ') < oct29Excerpt.translation.indexOf('ਮਾਇਆ ਦਾ ਮੋਹ'), 'stanza 1 meaning now precedes rahau');
assert.ok(!oct29Excerpt.translation.includes('ਦਇਆ ਦਾ ਘਰ'));
const oct29Loaded = loadedContent(oct29);
assert.equal(oct29Loaded.original, oct29Excerpt.original);
assert.equal(oct29Loaded.translation, oct29Excerpt.translation);
assert.equal(oct29Loaded.fullOriginal, oct29.original);
assert.equal(oct29Loaded.fullTranslation, oct29.translation);
console.log(`Oct 29 regression passed: ${[...oct29Excerpt.original].length}-character rahau excerpt, rahau-first aligned meaning and full source preservation.`);

// Revised fallback rules and whole-section translation reordering.
const noEnding = { original: 'ਅ'.repeat(300), translation: 'ਪੂਰੇ ਅਰਥ ਬਿਨਾਂ ਅੰਤ ਚਿੰਨ੍ਹ' };
assert.ok(hukamnamaExcerpt(noEnding.original, noEnding.translation).error);
assert.deepEqual(loadedContent(noEnding), { ...noEnding, fullOriginal: undefined, fullTranslation: undefined }, 'failed truncation leaves full fields editable');
const mismatched = { original: grouped, translation: 'ਗਲਤ ਅਰਥ।੩।' };
assert.deepEqual(loadedContent(mismatched), { ...mismatched, fullOriginal: undefined, fullTranslation: undefined }, 'failed alignment preserves both full fields');
assert.equal(hukamnamaExcerpt('ਸੋਧਿਆ ਛੋਟਾ ਪੂਰਾ ਪਾਠ ॥੧॥', 'ਆਪਣੇ ਸੋਧੇ ਅਰਥ।੧।').error, null, 'manual correction can be applied');
const withoutNumber = hukamnamaExcerpt(early, 'ਪਹਿਲੇ ਪਦੇ ਦੇ ਅਰਥ ॥ ਵਿਰਾਮ ਦੇ ਅਰਥ ॥ ਠਹਿਰਾਉ ॥ ਬਾਕੀ ਅਰਥ ॥');
assert.equal(withoutNumber.error, null);
assert.equal(withoutNumber.translation, 'ਪਹਿਲੇ ਪਦੇ ਦੇ ਅਰਥ ॥ ਵਿਰਾਮ ਦੇ ਅਰਥ ॥ ਠਹਿਰਾਉ ॥');
const reordered = hukamnamaExcerpt(early, 'ਵਿਰਾਮ ਦੇ ਅਰਥ ॥ ਠਹਿਰਾਉ ॥ ਪਹਿਲੇ ਪਦੇ ਦੇ ਅਰਥ ॥੧॥ ਬਾਕੀ ॥੨॥');
assert.equal(reordered.error, null);
assert.equal(reordered.translation, 'ਪਹਿਲੇ ਪਦੇ ਦੇ ਅਰਥ ॥੧॥ ਵਿਰਾਮ ਦੇ ਅਰਥ ॥ ਠਹਿਰਾਉ ॥');
assert.deepEqual(hukamnamaExcerpt(reordered.original, reordered.translation), { original: reordered.original, translation: reordered.translation, shortened: false, error: null }, 'reloading the applied excerpt is stable');
const reorderedLong = hukamnamaExcerpt(oct29Excerpt.original, oct29Excerpt.translation);
assert.equal(reorderedLong.translation, oct29Excerpt.translation, 'long excerpts remain stable after a second render pass');
assert.ok(hukamnamaExcerpt(early, 'ਗਲਤ ਪਦੇ ਦੇ ਅਰਥ ॥੨॥ ਵਿਰਾਮ ॥ ਠਹਿਰਾਉ ॥').error, 'pause alias cannot hide conflicting stanza numbers');
const earlyPause = 'ਅ'.repeat(90) + '॥ ਰਹਾਉ ॥' + 'ਅ'.repeat(200) + '॥੧॥';
assert.equal(hukamnamaExcerpt(earlyPause, 'ਵਿਰਾਮ।ਠਹਿਰਾਉ। ਬਾਕੀ।੧।').original, 'ਅ'.repeat(90) + '॥ ਰਹਾਉ ॥', 'early pause is fallback when no numbered ending fits');
const { parseSikhizmPunjabiTranslation } = require('../src/lib/hukamnama/liveSource.ts');
for (const [name, ang, length] of [['hoho', '493', 227], ['rasna', '560', 200]]) {
  const html = fs.readFileSync(`tests/fixtures/sikhizm-${name}.html`, 'utf8');
  const original = html.match(/<div class="su-box-content">([\s\S]*?)<\/div>/)[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const translation = parseSikhizmPunjabiTranslation(html, original, ang);
  assert.ok(translation, name + ': native meaning extracted');
  const selected = hukamnamaExcerpt(original, translation);
  assert.equal(selected.error, null, name);
  assert.equal([...selected.original].length, length);
  assert.ok(selected.original.endsWith(name === 'hoho' ? '॥੧॥ ਰਹਾਉ ॥' : '॥੨॥'));
  assert.ok(!selected.translation.includes('Rasna Har Saad'));
  assert.ok(selected.translation.endsWith(name === 'hoho' ? 'ਠਹਿਰਾਉ ॥' : '॥੨॥'));
  assert.ok(!selected.translation.includes(name === 'hoho' ? 'ਹੇ ਦਿਲਾਂ ਦੀਆਂ' : 'ਸ਼ਬਦ ਦੀ ਬਰਕਤ'));
  assert.equal(loadedContent({ original, translation }).translation, selected.translation);
}
console.log('Revised rules passed: late numbered fallback, ਠਹਿਰਾਉ, unnumbered pause explanations, reordered meanings, editable failure fallback and both reviewed article examples.');

assert.ok(hukamnamaExcerpt(early, 'ਵਿਰਾਮ ॥ ਠਹਿਰਾਉ ॥ ਗਲਤ ਪਦੇ ਦੇ ਅਰਥ ॥੨॥').error, 'missing stanza 1 cannot be hidden by pause-first conflicting numbered sections');

assert.ok(hukamnamaExcerpt(early, 'ਪਹਿਲੇ ਅਰਥ ॥ ਠਹਿਰਾਉ ॥ ਦੁਹਰਾਏ ਅਰਥ ॥ ਰਹਾਉ ॥').error, 'two unnumbered pause sections are ambiguous');

// A selected early rahau extends only to a complete later ending at 200–250.
function atPositions(entries) {
  let text = '';
  for (const [end, marker] of entries) text += 'ਅ'.repeat(end - [...text].length - [...marker].length) + marker;
  return text;
}
const extend = atPositions([[77, '॥੧॥'], [145, '॥੧॥ ਰਹਾਉ ॥'], [200, '॥੨॥'], [266, '॥੩॥']]);
const extended = hukamnamaExcerpt(extend, 'ਵਿਰਾਮ।ਠਹਿਰਾਉ। ਪਹਿਲਾ।੧। ਦੂਜਾ।੨। ਤੀਜਾ।੩।');
assert.equal(extended.error, null);
assert.equal([...extended.original].length, 200);
assert.equal(extended.translation, 'ਪਹਿਲਾ।੧। ਵਿਰਾਮ।ਠਹਿਰਾਉ। ਦੂਜਾ।੨।');
for (const [positions, expected] of [
  [[200, 225, 250], 225],
  [[210, 250], 210],
  [[250], 250],
  [[199, 251], 145],
]) {
  const entries = [[77, '॥੧॥'], [145, '॥੧॥ ਰਹਾਉ ॥'], ...positions.map((pos, i) => [pos, `॥${i + 2}॥`]), [330, '॥੯॥']];
  const source = atPositions(entries);
  const meaning = 'ਪਹਿਲਾ।੧। ਵਿਰਾਮ।ਰਹਾਉ। ' + positions.map((_, i) => `ਅਰਥ।${i + 2}।`).join(' ') + ' ਅੰਤ।੯।';
  const selected = hukamnamaExcerpt(source, meaning);
  assert.equal(selected.error, null);
  assert.equal([...selected.original].length, expected);
}
const boundaryPause = atPositions([[77, '॥੧॥'], [200, '॥੧॥ ਰਹਾਉ ॥'], [225, '॥੨॥'], [310, '॥੩॥']]);
assert.equal([...hukamnamaExcerpt(boundaryPause, 'ਪਹਿਲਾ।੧। ਵਿਰਾਮ।ਰਹਾਉ। ਦੂਜਾ।੨। ਅੰਤ।੩।').original].length, 200, 'pause at exactly 200 keeps existing priority');
const missingExtension = { original: extend, translation: 'ਪਹਿਲਾ।੧। ਵਿਰਾਮ।ਰਹਾਉ। ਗਲਤ।੩।' };
assert.ok(hukamnamaExcerpt(missingExtension.original, missingExtension.translation).error);
assert.deepEqual(loadedContent(missingExtension), { ...missingExtension, fullOriginal: undefined, fullTranslation: undefined }, 'unmatched added stanza retains full editable fields');
console.log('Early rahau extension passed: actual Rasna now 200 characters, 200/250 boundaries, 220–230 preference, nearest ending, reordered matching meaning and manual fallback.');
