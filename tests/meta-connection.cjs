const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  module._compile(output, filename);
};
const { validAdminKey, verifyMetaConnection } = require('../src/lib/metaConnection.ts');

(async () => {
  const key = 'x'.repeat(32);
  assert.equal(validAdminKey(key, key), true);
  assert.equal(validAdminKey('', ''), false);
  assert.equal(validAdminKey('wrong', key), false);
  assert.equal(validAdminKey('y'.repeat(32), key), false);
  const config = { version: 'v26.0', token: 'secret-do-not-return', pageId: '123' };
  let calls = 0;
  const mock = async (url, options) => {
    calls++;
    assert.equal(options.method, undefined, 'connection verification must use GET only');
    assert.equal(url.searchParams.has('access_token'), false);
    assert.equal(options.headers.Authorization, `Bearer ${config.token}`);
    assert.equal(options.cache, 'no-store');
    return Response.json({ id: '123', name: 'Sikhizm', instagram_business_account: { id: '456', username: 'sikhizmcom' } });
  };
  const connected = await verifyMetaConnection(config, mock);
  assert.equal(connected.instagram.connected, true);
  assert.equal(JSON.stringify(connected).includes(config.token), false);
  assert.equal(calls, 1);
  await assert.rejects(verifyMetaConnection({ ...config, pageId: '999' }, mock), /does not belong/);
  await assert.rejects(verifyMetaConnection({ ...config, version: '../bad' }, mock), /Check META/);
  await assert.rejects(verifyMetaConnection(config, async () => Response.json({ error: config.token }, { status: 400 })), error => !error.message.includes(config.token));
  for (const instagram of [undefined, { id: '456', username: 'someone_else' }]) {
    const result = await verifyMetaConnection(config, async () => Response.json({ id: '123', name: 'Sikhizm', instagram_business_account: instagram }));
    assert.equal(result.instagram.connected, false, 'a missing or unrelated Instagram account must not pass');
  }
  console.log('Meta connection tests passed (mocked; no posts created).');
})().catch(error => { console.error(error); process.exitCode = 1; });
