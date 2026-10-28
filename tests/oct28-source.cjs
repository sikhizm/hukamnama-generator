const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, quote, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { parseSikhizmLiveArticle, parseSikhizmPunjabiTranslation, readSikhizmAng } = require('../src/lib/hukamnama/liveSource.ts');
const { loadedContent } = require('../src/lib/hukamnama/loadedContent.ts');
const { splitIntroduction } = require('../src/lib/hukamnama/introduction.ts');
const { matchesSikhizmArticle } = require('../src/lib/hukamnama/sikhizmLinks.ts');
const { GET } = require('../src/app/api/hukamnama/live/route.ts');
const html = fs.readFileSync(path.join(__dirname, 'fixtures/sikhizm-2026-10-28.html'), 'utf8');
const post = { publishedAt: '2026-10-28T00:00:45+00:00', localDateISO: '2026-10-28' };
const parse = value => parseSikhizmLiveArticle(value, post, post.localDateISO);
const record = parse(html);
assert.equal(record.ang, '632');
assert.equal(record.matchedAuthor, 'Guru Tegh Bahadur Ji');
assert.equal(record.sourceDateISO, '2026-10-28'); assert.equal(record.isToday, true);
assert.ok(record.translation.startsWith('ਹੇ ਮਨ!'));
assert.ok(!record.translation.includes('ਅਰਥ:'));
assert.ok(!/[A-Za-z]/.test(record.translation));
assert.ok(record.translation.endsWith('॥੩॥੪॥'));
const applied = loadedContent(record);
assert.ok(applied.fullOriginal && applied.fullTranslation, 'full source is retained');
assert.ok([...applied.original].length <= 250);
assert.ok(applied.original.endsWith('॥੧॥'));
assert.ok(applied.original.includes('ਰਹਾਉ ॥ ਅਟਲ ਭਇਓ'), 'early rahau keeps the next complete stanza');
assert.ok(!applied.original.includes('ਜਬ ਹੀ ਸਰਨਿ'));
assert.ok(applied.translation.includes('ਧ੍ਰੂ ਸਦਾ ਲਈ ਅਟੱਲ'));
assert.ok(!applied.translation.includes('ਗਜ ਨੇ'));
assert.equal(splitIntroduction(applied.original).introduction, 'ਸੋਰਠਿ ਮਹਲਾ ੯ ॥');
for (const label of ['Ang', 'Ang/Page', 'Page', 'SGGS Ang', 'SGGS Page', 'SGGS Ang/Page', 'ਅੰਗ', 'ਪੰਨਾ']) {
  const variant = html.replace('Ang/Page</td>', `${label}</td>`);
  assert.equal(parse(variant).ang, '632', label);
  assert.equal(parse(variant).translation, record.translation, label);
  assert.ok(matchesSikhizmArticle(variant, record), label);
}
assert.equal(readSikhizmAng(html.replace('632</td>', '੬੩੨</td>')), '632');
assert.equal(readSikhizmAng('<p>Page: 632</p>'), '632');
for (const invalid of ['0', '1431', '632 unrelated', '']) {
  assert.throws(() => parse(html.replace('632</td>', `${invalid}</td>`)), /Ang/);
}
const conflict = html + '<table><tr><th>Page</th><td>633</td></tr></table>';
assert.equal(readSikhizmAng(conflict), null);
assert.equal(parseSikhizmPunjabiTranslation(conflict, record.original, '632'), null);
assert.equal(matchesSikhizmArticle(conflict, record), false);
const wrongAng = html.replace('632</td>', '633</td>');
assert.equal(parseSikhizmPunjabiTranslation(wrongAng, record.original, '632'), null);
assert.equal(matchesSikhizmArticle(wrongAng, record), false);
assert.equal(readSikhizmAng(html.replace('Ang/Page</td>', 'Page views</td>')), null, 'unrelated label is not scripture metadata');
for (const heading of ['Punjabi Translation', 'Translation in Punjabi', 'Hukamnama Meaning in Gurmukhi', 'Hukamnama Translation in Punjabi']) {
  assert.equal(parse(html.replace('Hukamnama Meaning in Gurmukhi', heading)).translation, record.translation);
}
assert.equal(parse(html.replace('Hukamnama Meaning in Gurmukhi', 'English Transliteration')).translation, '', 'unrelated headings never supply Punjabi meanings');
assert.throws(() => parse(html.replace('2026-10-28T00:00:45', '2026-10-27T00:00:45')), /not confirmed for today/);
assert.throws(() => parse(html.replace('॥੩॥੪॥</div>', '</div>')), /complete Gurmukhi/);
const realDate = Date, realFetch = fetch;
class FixedDate extends realDate { constructor(value) { super(value === undefined ? '2026-10-28T01:00:00Z' : value); } }
(async () => {
  global.Date = FixedDate;
  const article = 'https://sikhizm.com/man-re-prabh-ki-saran-bichaaro/';
  const feed = `<rss><channel><item><title>Man Re Prabh Ki Saran Bichaaro</title><link>${article}</link><pubDate>Wed, 28 Oct 2026 00:00:45 +0000</pubDate></item></channel></rss>`;
  for (const query of ['?refresh=1', '?sources=sikhizm&translation=1', '?sources=sikhizm&translation=0']) {
    const calls = [];
    global.fetch = async url => {
      calls.push(String(url));
      if (String(url) === 'https://sikhizm.com/category/hukamnama/feed/') return new Response(feed);
      if (String(url) === article) return new Response(html);
      throw new Error('Unexpected lower-priority/translation request: ' + url);
    };
    const response = await GET(new Request('https://app.example/api/hukamnama/live' + query));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.translation, record.translation); assert.equal(data.ang, '632');
    assert.equal(data.sourceName, 'Sikhizm same-day Hukamnama post');
    assert.equal(calls.length, 2, 'Sikhizm native data stops fallback and BaniDB lookups');
    assert.deepEqual(loadedContent(data), applied, 'API data is ready for the editor excerpt loader');
  }
  console.log(`Oct 28 regression passed: actual Ang/Page article, native Gurmukhi meaning heading, author, ${[...applied.original].length}-character aligned excerpt, links, label variants and automatic/manual route loads. No live posts.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.Date = realDate; global.fetch = realFetch; });
