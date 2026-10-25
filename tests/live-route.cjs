const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, quote, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { GET } = require('../src/app/api/hukamnama/live/route.ts');
const { parseSikhizmLiveArticle } = require('../src/lib/hukamnama/liveSource.ts');
const html = fs.readFileSync(path.join(__dirname, 'fixtures/sikhizm-2026-10-25.html'), 'utf8');
const record = parseSikhizmLiveArticle(html, { publishedAt: 'Sun, 25 Oct 2026 00:00:11 +0000', localDateISO: '2026-10-25' }, '2026-10-25');
const RealDate = Date, realFetch = fetch;
class FixedDate extends RealDate { constructor(value) { super(value === undefined ? '2026-10-25T03:30:00Z' : value); } }
const articleUrl = 'https://sikhizm.com/sunahu-sant-pyare-binou-hamare-jio/';
const metadata = { date: { gregorian: { year: 2026, monthno: 10, date: 25 } }, hukamnamainfo: { pageno: 678, writer: { unicode: 'ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ' } }, hukamnama: [{ line: { gurmukhi: { unicode: record.original } } }] };
(async () => {
  global.Date = FixedDate;
  for (const mode of ['matched', 'unavailable', 'wrong-ang', 'stale']) {
    const calls = [];
    global.fetch = async value => {
      const url = String(value); calls.push(url);
      if (url === 'https://hs.sgpc.net/index.php' || url === 'https://sgpc.net/daily-mukhwak-pdf/') return new Response('', { status: 403 });
      if (url === 'https://sikhizm.com/category/hukamnama/feed/') return new Response(`<rss><channel><item><title>Today's Hukamnama</title><link>${articleUrl}</link><pubDate>${mode === 'stale' ? 'Sat, 24 Oct 2026 00:00:11 +0000' : 'Sun, 25 Oct 2026 00:00:11 +0000'}</pubDate></item></channel></rss>`);
      if (url === articleUrl) return new Response(html);
      if (url === 'https://api.gurbaninow.com/v2/hukamnama/today') {
        if (mode === 'unavailable') return new Response('', { status: 503 });
        return Response.json(mode === 'wrong-ang' ? { ...metadata, hukamnamainfo: { ...metadata.hukamnamainfo, pageno: 679 } } : metadata);
      }
      throw new Error(`Unexpected request: ${url}`);
    };
    const response = await GET(new Request('https://example.com/api/hukamnama/live?refresh=1'));
    const data = await response.json();
    if (mode === 'stale') { assert.equal(response.status, 502); assert.ok(data.error.includes('No same-day')); continue; }
    assert.equal(response.status, 200);
    assert.equal(data.sourceName, 'Sikhizm same-day Hukamnama post');
    assert.equal(data.dateText, '25-October-2026 | ਕੱਤਕ 09, 558 | ਐਤਵਾਰ (Sunday)', 'annual SGPC calendar works even when both daily sources return 403');
    assert.equal(data.sourceDateISO, '2026-10-25'); assert.equal(data.ang, '678');
    assert.equal(data.original, record.original); assert.equal(data.translation, record.translation);
    assert.equal(data.metadataMatched, true, 'verified article author survives a failed or mismatched external lookup');
    assert.equal(data.matchedAuthor, 'Guru Arjan Dev Ji');
    assert.equal(calls.length, 5);
  }
  console.log('Live route passed: both SGPC pages blocked, legacy Sikhizm fallback, guarded author match, metadata outage and stale-date rejection. No network requests or posts made.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.Date = RealDate; global.fetch = realFetch; });
