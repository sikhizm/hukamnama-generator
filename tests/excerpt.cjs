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
// A later rahau cannot override the 250 character ceiling.
const late = 'ਅ'.repeat(220) + '॥੧॥ ' + 'ਅ'.repeat(40) + chant;
assert.ok(hukamnamaExcerpt(late, 'ਪਹਿਲਾ।੧। ਅੰਤ।ਰਹਾਉ।').original.endsWith('॥੧॥'));
console.log(`Verse excerpts passed: today's requested excerpt (${[...result.original].length} characters), matching translation, rahau, grouped markers, hard limit, and review gates.`);

// A numbered first stanza before rahau makes rahau the priority even below 200.
const early = 'ਅ'.repeat(80) + '॥੧॥ ' + 'ਅ'.repeat(50) + '॥ ਰਹਾਉ ॥' + 'ਅ'.repeat(150) + '॥੨॥';
const priority = hukamnamaExcerpt(early, 'ਪਹਿਲਾ ॥੧॥ ਰੁਕਾਉ ॥ ਰਹਾਉ ॥ ਬਾਕੀ ॥੨॥');
assert.equal(priority.error, null);
assert.ok(priority.original.endsWith('॥ ਰਹਾਉ ॥'));
assert.equal(priority.translation, 'ਪਹਿਲਾ ॥੧॥ ਰੁਕਾਉ ॥ ਰਹਾਉ ॥');
assert.ok(hukamnamaExcerpt(early, 'ਪਹਿਲਾ ॥੧॥ unmarked rest').error);
