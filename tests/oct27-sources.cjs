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
// The article was subsequently updated with its introductory heading and Latin SEO label.
const updatedHtml = fs.readFileSync(path.join(__dirname, 'fixtures/sikhizm-2026-10-27-heading.html'), 'utf8');
const updated = parsers.sikhizm(updatedHtml);
const { loadedContent } = require('../src/lib/hukamnama/loadedContent.ts');
const { splitIntroduction } = require('../src/lib/hukamnama/introduction.ts');
const applied = loadedContent(updated);
assert.ok(updated.original.startsWith('ਰਾਗੁ ਸੋਰਠਿ'));
assert.ok(!/[A-Za-z]/.test(updated.translation), 'English SEO prefix is excluded');
assert.ok(updated.translation.includes('(ਜੋ ਕਰਨ-ਜੋਗ ਸੀ)'), 'Punjabi parentheses are retained');
assert.ok(applied.original.endsWith('ਰਹਾਉ ॥'));
assert.ok(!applied.original.includes('ਬਨ ਖੰਡ'));
assert.ok(applied.translation.includes('ਜਿਨ੍ਹਾਂ ਸਿਆਣੇ'));
assert.ok(!applied.translation.includes('ਕਈ ਲੋਕਾਂ'));
assert.ok([...applied.original].length <= 250);
assert.equal(applied.fullOriginal, updated.original);
assert.ok(splitIntroduction(applied.original).introduction.endsWith('ਪ੍ਰਸਾਦਿ ॥'));
assert.equal(live.cleanPunjabiTranslation('(English keyword) ਹੇ ਮਨ! (ਪੰਜਾਬੀ ਅਰਥ) ਹੋਰ।੧।'), 'ਹੇ ਮਨ! (ਪੰਜਾਬੀ ਅਰਥ) ਹੋਰ।੧।');
assert.equal(live.cleanPunjabiTranslation('Keyword phrase — ਹੇ ਮਨ! [English label] ਹੋਰ।੧।'), 'ਹੇ ਮਨ! ਹੋਰ।੧।');
assert.ok(hukamnamaExcerpt(updated.original, updated.translation.replace('।੧।ਰਹਾਉ।', '।੨।ਰਹਾਉ।').replace('।੧।', '।੨।')).error, 'unrelated numbered meanings cannot be accepted');

// Read-only responses from SGPC's archive calendar, retrieved 27 October.
const archive = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sgpc-archive-oct20-27.json'), 'utf8'));
assert.equal(archive.length, 8);
for (const item of archive) {
  const original = [item.gheading1, item.gheading2, item.ghukamnama].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const [year, month, date] = item.date.split('-');
  const html = `<p>${date}-${month}-${year} 05:30 AM</p><h4>${item.gheading1}</h4><h5>${item.gheading2}</h5><p>${item.ghukamnama}</p><p>${item.gfooter1}</p><p>${item.gfooter2}</p><h4>ਪੰਜਾਬੀ ਵਿਆਖਿਆ</h4><p>${item.ghukamnamadesc}</p><h4>English Translation</h4>`;
  const parsed = live.parseSgpcPage(html, item.date);
  assert.equal(parsed.original, original, item.date);
  assert.equal(parsed.isToday, true);
  const excerpt = hukamnamaExcerpt(parsed.original, parsed.translation);
  if (!excerpt.error) assert.ok([...excerpt.original].length <= 250 || excerpt.original.endsWith('ਰਹਾਉ ॥'), item.date);
  else assert.ok(excerpt.error.includes('250 characters') || excerpt.error.includes('matching stanza'), 'unsafe cases stay blocked for manual review');
  if (!item.gheading2) {
    const split = splitIntroduction(original);
    assert.equal(split.introduction, item.gheading1);
    assert.ok(split.body.startsWith(item.ghukamnama.slice(0, 10)));
  }
}
console.log(`Updated Sikhizm article: ${[...applied.original].length} characters through numbered rahau, clean matching Punjabi meanings. Eight SGPC archive entries checked.`);
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
