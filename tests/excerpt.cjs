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
assert.ok(hukamnamaExcerpt('ਅ'.repeat(260) + '॥੧॥', 'ਵਿਆਖਿਆ।੧।').error);
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
assert.ok(oct29Excerpt.translation.startsWith('ਹੇ ਭਾਈ! ਮਾਇਆ ਦਾ ਮੋਹ'));
assert.ok(oct29Excerpt.translation.endsWith('ਮਨੁੱਖ ਆਪਣਾ ਬੜਾ ਕੀਮਤੀ ਜੀਵਨ ਗਵਾ ਲੈਂਦਾ ਹੈ ।੧।'));
assert.ok(!oct29Excerpt.translation.includes('ਦਇਆ ਦਾ ਘਰ'));
const oct29Loaded = loadedContent(oct29);
assert.equal(oct29Loaded.original, oct29Excerpt.original);
assert.equal(oct29Loaded.translation, oct29Excerpt.translation);
assert.equal(oct29Loaded.fullOriginal, oct29.original);
assert.equal(oct29Loaded.fullTranslation, oct29.translation);
console.log(`Oct 29 regression passed: ${[...oct29Excerpt.original].length}-character rahau excerpt, rahau-first aligned meaning and full source preservation.`);
