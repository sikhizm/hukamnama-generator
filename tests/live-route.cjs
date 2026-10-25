const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, quote, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { GET } = require('../src/app/api/hukamnama/live/route.ts');
const { parseSikhizmLiveArticle, parseSgpcPage } = require('../src/lib/hukamnama/liveSource.ts');
const html = fs.readFileSync(path.join(__dirname, 'fixtures/sikhizm-2026-10-25.html'), 'utf8');
const record = parseSikhizmLiveArticle(html, { publishedAt: 'Sun, 25 Oct 2026 00:00:11 +0000', localDateISO: '2026-10-25' }, '2026-10-25');
const RealDate = Date, realFetch = fetch;
class FixedDate extends RealDate { constructor(value) { super(value === undefined ? '2026-10-25T03:30:00Z' : value); } }
const articleUrl = 'https://sikhizm.com/sunahu-sant-pyare-binou-hamare-jio/';

const { parseHukamnamaSahib, parseDekhoJi, headingAuthor, normalizedVerse } = require('../src/lib/hukamnama/fallbackSources.ts');
const sahibHtml = fs.readFileSync(path.join(__dirname, 'fixtures/hukamnamasahib-2026-10-25.html'), 'utf8');
const dekhoHtml = fs.readFileSync(path.join(__dirname, 'fixtures/dekhoji-2026-10-25.html'), 'utf8');
const day = '2026-10-25';
const sahib = parseHukamnamaSahib(sahibHtml, day);
const dekho = parseDekhoJi(dekhoHtml, day);
for (const result of [sahib, dekho]) {
  assert.equal(result.ang, '678');
  assert.equal(result.sourceDateISO, day);
  assert.equal(result.matchedAuthor, 'Guru Arjan Dev Ji');
  assert.ok(result.translation.length > 800, 'full Punjabi explanation extracted');
  assert.ok(!/facebook|Dhanaasaree|धनासरी/.test(result.translation), 'no footer or other language included');
  assert.equal(normalizedVerse(result.original), normalizedVerse(record.original));
}
assert.throws(() => parseHukamnamaSahib(sahibHtml, '2026-10-26'));
assert.throws(() => parseHukamnamaSahib(sahibHtml.replaceAll('-morning', '-evening'), day));
assert.throws(() => parseHukamnamaSahib(sahibHtml.replace(/<div class="hukamnama-html-content[\s\S]*/, ''), day));
assert.throws(() => parseDekhoJi(dekhoHtml, '2026-10-26'));
assert.throws(() => parseDekhoJi(dekhoHtml.replace(/Ang 678/, 'Ang 679'), day));
assert.equal(headingAuthor(record.original), 'Guru Arjan Dev Ji', 'generic bhagat word inside verse is not a writer heading');
assert.equal(headingAuthor('ਮਹਲਾ ੫ ਮਃ ੩ ੴ'), null, 'mixed headings remain unresolved');
assert.equal(headingAuthor('ਕਬੀਰ ਜੀ ਮਹਲਾ ੫ ੴ'), null);
assert.notEqual(normalizedVerse('ਸੁਨਹੁ'), normalizedVerse('ਸੁਨਹਿ'), 'vowel marks matter for exact passage matching');
const urls = {
  sgpc: 'https://hs.sgpc.net/index.php', daily: 'https://sgpc.net/daily-mukhwak-pdf/',
  feed: 'https://sikhizm.com/category/hukamnama/feed/', article: articleUrl,
  sahib: `https://hukamnamasahib.com/hukamnama/${day}-morning`, dekho: 'https://www.dekho-ji.com/hukamnama?t=today',
};
const feed = `<rss><channel><item><title>Today's Hukamnama</title><link>${articleUrl}</link><pubDate>Sun, 25 Oct 2026 00:00:11 +0000</pubDate></item></channel></rss>`;
const primaryHtml = `<h2>ਮੁੱਖਵਾਕ</h2><p>25-10-2026 05:30 AM</p><h4>${record.original.split('ੴ')[0]}</h4><p>ੴ${record.original.split('ੴ')[1]}</p><p>ਐਤਵਾਰ, ੯ ਕੱਤਕ (ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ)</p><p>(ਅੰਗ: ੬੭੮)</p><h4>ਪੰਜਾਬੀ ਵਿਆਖਿਆ</h4><p>${record.translation}</p><h4>English Translation</h4>`;
async function run(responses) {
  const calls = [];
  global.fetch = async value => {
    const url = String(value); calls.push(url);
    assert.ok(Object.values(urls).includes(url), `Unapproved provider: ${url}`);
    return Object.hasOwn(responses, url) ? new Response(responses[url]) : new Response('', { status: 503 });
  };
  const response = await GET(new Request('https://example.com/api/hukamnama/live?refresh=1'));
  return { status: response.status, data: await response.json(), calls };
}
(async () => {
  global.Date = FixedDate;
  const primary = await run({ [urls.sgpc]: primaryHtml });
  assert.equal(primary.status, 200);
  assert.deepEqual(primary.calls, [urls.sgpc], 'complete current SGPC data stops fallback queries');
  assert.equal(primary.data.translation, parseSgpcPage(primaryHtml, day).translation);
  assert.equal(primary.data.matchedAuthor, 'Guru Arjan Dev Ji');

  const sikhizm = await run({ [urls.feed]: feed, [urls.article]: html, [urls.sahib]: sahibHtml });
  assert.equal(sikhizm.status, 200);
  assert.equal(sikhizm.data.sourceName, 'Sikhizm same-day Hukamnama post');
  assert.equal(sikhizm.data.dateText, '25-October-2026 | ਕੱਤਕ 09, 558 | ਐਤਵਾਰ (Sunday)');
  assert.deepEqual(sikhizm.calls, [urls.sgpc, urls.daily, urls.feed, urls.article]);

  const third = await run({ [urls.sahib]: sahibHtml, [urls.dekho]: dekhoHtml });
  assert.equal(third.status, 200);
  assert.equal(third.data.sourceName, sahib.sourceName);
  assert.deepEqual(third.calls, [urls.sgpc, urls.daily, urls.feed, urls.sahib]);
  assert.equal(third.data.isToday, true);

  const fourth = await run({ [urls.sahib]: sahibHtml.replaceAll('-morning', '-evening'), [urls.dekho]: dekhoHtml });
  assert.equal(fourth.status, 200);
  assert.equal(fourth.data.sourceName, dekho.sourceName);
  assert.deepEqual(fourth.calls, [urls.sgpc, urls.daily, urls.feed, urls.sahib, urls.dekho]);

  const staleHtml = primaryHtml.replace('25-10-2026', '24-10-2026');
  const stale = await run({ [urls.sgpc]: staleHtml });
  assert.equal(stale.status, 200);
  assert.equal(stale.data.isToday, false, 'old SGPC data remains visibly stale');
  assert.equal(stale.data.sourceDateISO, '2026-10-24');
  const freshFallback = await run({ [urls.sgpc]: staleHtml, [urls.sahib]: sahibHtml });
  assert.equal(freshFallback.data.sourceName, sahib.sourceName, 'stale SGPC does not block today’s fallback');
  assert.equal(freshFallback.data.isToday, true);

  const missingTranslation = `<h2>ਮੁੱਖਵਾਕ - ਸੱਚਖੰਡ ਸ੍ਰੀ ਹਰਿਮੰਦਰ ਸਾਹਿਬ</h2><p>${record.original}</p><p>25 ਅਕਤੂਬਰ, 2026 ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ ਅੰਗ: ੬੭੮</p>`;
  const supplemented = await run({ [urls.daily]: missingTranslation, [urls.sahib]: sahibHtml });
  assert.equal(supplemented.status, 200);
  assert.equal(supplemented.data.translation, sahib.translation);
  assert.ok(supplemented.data.sourceName.includes('matched HukamnamaSahib'));
  const mismatched = await run({ [urls.daily]: missingTranslation, [urls.sahib]: sahibHtml.replaceAll('ਸੁਨਹੁ', 'ਸੁਨਹਿ') });
  assert.equal(mismatched.data.translation, '', 'different vowel marks prevent incorrect enrichment');
  assert.equal(mismatched.data.original, parseSgpcPage(primaryHtml, day).original);

  const unavailable = await run({});
  assert.equal(unavailable.status, 502);
  assert.ok(unavailable.data.error);
  console.log('Live sources passed: ordered four-provider fallback, current-day morning validation, stale rejection, full Punjabi extraction and exact passage enrichment. No network requests or posts made.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.Date = RealDate; global.fetch = realFetch; });
