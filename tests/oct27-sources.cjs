const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, quote, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const live = require('../src/lib/hukamnama/liveSource.ts');
const fallback = require('../src/lib/hukamnama/fallbackSources.ts');
const { hukamnamaExcerpt } = require('../src/lib/hukamnama/excerpt.ts');
const { GET } = require('../src/app/api/hukamnama/live/route.ts');
const fixture = name => fs.readFileSync(path.join(__dirname, `fixtures/${name}-2026-10-27.html`), 'utf8');
const day = '2026-10-27';
const post = { publishedAt: '2026-10-27T00:00:00Z', localDateISO: day };
const parsers = {
  sikhizm: html => live.parseSikhizmLiveArticle(html, post, day),
  hukamnamasahib: html => fallback.parseHukamnamaSahib(html, day),
  sikhnet: html => fallback.parseSikhNet(html, day),
  dekhoji: html => fallback.parseDekhoJi(html, day),
};
for (const [name, parse] of Object.entries(parsers)) {
  const record = parse(fixture(name));
  assert.equal(record.ang, '654');
  assert.equal(record.matchedAuthor, 'Bhagat Kabir Ji');
  assert.ok(record.original.includes('ਬੇਦ ਪੁਰਾਨ'));
  assert.ok(record.original.endsWith('॥੪॥੩॥'));
  assert.ok(record.translation.length > 800);
  const excerpt = hukamnamaExcerpt(record.original, record.translation);
  assert.equal(excerpt.error, null, name);
  assert.ok(excerpt.original.endsWith('ਰਹਾਉ ॥'));
  assert.ok([...excerpt.original].length <= 250);
}
const primary = parsers.sikhizm(fixture('sikhizm'));
assert.throws(() => live.parseSikhizmLiveArticle(fixture('sikhizm'), post, '2026-10-28'));
assert.equal(live.isCompleteGurbani(primary.original.replace(/॥੪॥੩॥$/, '')), false);
assert.equal(live.isCompleteGurbani('ਹੇ ਮਨ! ਇਹ ਅਰਥ ਹਨ।੧। ਹੋਰ ਅਰਥ।੪।੩।'), false);
assert.throws(() => fallback.parseSikhNet(fixture('sikhnet').replace('"655":655', '"657":657'), day));
assert.throws(() => fallback.parseDekhoJi(fixture('dekhoji').replace('Ang 655 (#', 'Ang 657 (#'), day));
const realDate = Date, realFetch = fetch;
class FixedDate extends realDate { constructor(value) { super(value === undefined ? '2026-10-27T01:00:00Z' : value); } }
(async () => {
  global.Date = FixedDate;
  const feedUrl = 'https://sikhizm.com/category/hukamnama/feed/';
  const article = 'https://sikhizm.com/bed-puran-sabhe-mat-sun-ke/';
  const feed = `<rss><item><title>Bed Puran</title><link>${article}</link><pubDate>${post.publishedAt}</pubDate></item></rss>`;
  for (const chosen of ['sikhizm', 'hukamnamasahib', 'sikhnet', 'dekhoji']) {
    const calls = [];
    global.fetch = async value => {
      const url = String(value); calls.push(url);
      if (url === feedUrl) return new Response(feed);
      if (chosen === 'sikhizm' && url === article) return new Response(fixture('sikhizm'));
      const urls = { hukamnamasahib: `https://hukamnamasahib.com/hukamnama/${day}-morning`, sikhnet: 'https://sikhnet.com/hukam', dekhoji: 'https://www.dekho-ji.com/hukamnama?t=today' };
      return url === urls[chosen] ? new Response(fixture(chosen)) : new Response('', { status: 403 });
    };
    const response = await GET(new Request('https://example.com/api/hukamnama/live?refresh=1'));
    assert.equal(response.status, 200, chosen);
    const record = await response.json();
    assert.equal(record.sourceDateISO, day); assert.equal(record.ang, '654');
    if (chosen === 'sikhizm') assert.deepEqual(calls, [feedUrl, article]);
    assert.ok(!calls.some(url => url.includes('banidb')), 'native meanings need no lookup');
  }
  console.log('Oct 27 live-source regression passed: headerless scripture, two-Ang shabad, all fallback paths, rahau-first meanings, stale rejection. No network or publishing.');
})().finally(() => { global.Date = realDate; global.fetch = realFetch; }).catch(error => { console.error(error); process.exitCode = 1; });
