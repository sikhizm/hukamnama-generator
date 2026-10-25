const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, quote, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { parseSikhizmLiveArticle } = require('../src/lib/hukamnama/liveSource.ts');
const { findEvergreenLinks, matchesSikhizmArticle, searchResultArticles, linkContext } = require('../src/lib/hukamnama/sikhizmLinks.ts');
const { buildSocialCaption } = require('../src/lib/hukamnama/socialCaption.ts');
const { expandTemplate, SHORT_TEMPLATE } = require('../src/lib/morningPlan.ts');
const { POST, GET } = require('../src/app/api/hukamnama/sikhizm-links/route.ts');
const html = fs.readFileSync(path.join(__dirname, 'fixtures/sikhizm-2026-10-25.html'), 'utf8');
const source = parseSikhizmLiveArticle(html, { publishedAt: '2026-10-25T00:00:11Z', localDateISO: '2026-10-25' }, '2026-10-25');
source.date = '2026-10-25';
const article = 'https://sikhizm.com/sunahu-sant-pyare-binou-hamare-jio/';
const pdf = 'https://sikhizm.com/download/279567/';
const withPdf = html + `<a href="${pdf}">Download PDF</a>`;
assert(matchesSikhizmArticle(html, source));
assert.equal(matchesSikhizmArticle(html.replace('<td>678</td>', '<td>679</td>'), source), false);
assert.equal(matchesSikhizmArticle(html.replaceAll('ਸੁਨਹੁ', 'ਸਿਨਹੁ'), source), false, 'preserve vowel marks while matching');
assert.equal(matchesSikhizmArticle(html.replace(/<tr><td>Ang<\/td><td>678<\/td><\/tr>/, ''), source), false);
assert.notEqual(linkContext({ ...source, dateISO: '2026-10-25' }), linkContext({ ...source, dateISO: '2026-10-26' }), 'links are associated with the current Hukamnama day');
(async () => {
  const evergreen = withPdf.replace('2026-10-25', '2018-06-21');
  const found = await findEvergreenLinks(source, async () => Response.json([{ link: article, date: '2018-06-21', content: { rendered: evergreen } }]));
  assert.equal(found.articleUrl, article); assert.equal(found.pdfUrl, pdf, 'publication date is irrelevant for evergreen posts');
  const noPdf = await findEvergreenLinks(source, async url => url.includes('wp-json') ? Response.json([{ link: article, content: { rendered: html } }]) : new Response('', { status: 503 }));
  assert.equal(noPdf.found, true); assert.equal(noPdf.pdfUrl, '', 'missing PDF never carries a previous PDF forward');
  const publicSearch = `<h3 class="jeg_post_title"><a href="${article}">Article</a></h3><h3 class="jeg_post_title"><a href="https://evil.example/">Reject</a></h3>`;
  assert.deepEqual(searchResultArticles(publicSearch), [article]);
  const fallback = await findEvergreenLinks(source, async url => url.includes('wp-json') ? new Response('', { status: 403 }) : url.includes('?s=') ? new Response(publicSearch) : new Response(withPdf));
  assert.equal(fallback.articleUrl, article); assert.equal(fallback.pdfUrl, pdf);
  const missing = await findEvergreenLinks(source, async url => url.includes('wp-json') ? Response.json([]) : new Response('No matches'));
  assert.equal(missing.found, false); assert.equal(missing.articleUrl, ''); assert.equal(missing.pdfUrl, '');
  const caption = buildSocialCaption(source, '', '');
  assert(!caption.includes('Read Complete')); assert(!caption.includes('Download Hukamnama PDF')); assert(!caption.includes('🔗')); assert(!caption.includes('----\n----'));
  const short = expandTemplate(SHORT_TEMPLATE, { date: 'today', articleUrl: '', pdfUrl: '' });
  assert(!short.includes('Read the complete')); assert(!short.includes('PDF:')); assert(short.includes('#Hukamnama'));
  assert.equal((await GET()).status, 400, 'a date alone cannot identify a shabad');
  assert.equal((await POST(new Request('https://app.example/api/hukamnama/sikhizm-links', { method: 'POST', body: JSON.stringify({ date: source.date, ang: '99999', original: source.original }) }))).status, 400);
  const realFetch = global.fetch;
  try {
    global.fetch = async () => Response.json([{ link: article, content: { rendered: evergreen } }]);
    const response = await POST(new Request('https://app.example/api/hukamnama/sikhizm-links', { method: 'POST', body: JSON.stringify({ date: source.date, ang: source.ang, original: source.original }) }));
    assert.equal(response.status, 200); assert.equal((await response.json()).articleUrl, article);
  } finally { global.fetch = realFetch; }
  console.log('Evergreen link tests passed: Ang + Gurbani matching, old publication dates, public-search fallback, PDF handling, stale-link isolation and clean omitted-link captions. No live posts.');
})().catch(error => { console.error(error); process.exitCode = 1; });
