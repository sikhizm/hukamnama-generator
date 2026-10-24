const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { composeCaption, publishImage } = require('../src/lib/socialPost.ts');
const config = { version: 'v26.0', pageId: '123', token: 'PRIVATE' };
const image = new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });
const identity = { id: '123', name: 'Sikhizm', instagram_business_account: { id: '456', username: 'sikhizmcom' } };
function sequence(responses, checks = []) {
  let index = 0;
  const request = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer PRIVATE');
    assert.ok(!String(url).includes('PRIVATE'));
    assert.equal(options.cache, 'no-store');
    assert.ok(index < responses.length, 'unexpected Graph request');
    checks[index]?.(String(url), options);
    const response = responses[index++];
    if (response instanceof Error) throw response;
    return response instanceof Response ? response : Response.json(response);
  };
  request.done = () => assert.equal(index, responses.length);
  return request;
}
(async () => {
  assert.equal(composeCaption('  Gurbani  ', 'Gurbani, #Sikhizm #Gurbani'), 'Gurbani\n\n#Gurbani #Sikhizm');
  assert.throws(() => composeCaption('', ''), /Add a caption/);
  assert.throws(() => composeCaption('x'.repeat(2201), ''), /2,200/);
  assert.throws(() => composeCaption('test', Array.from({ length: 31 }, (_, i) => `tag${i}`).join(' ')), /30/);
  const fb = sequence([identity, { id: '789' }], [undefined, (url, options) => {
    assert.ok(url.endsWith('/123/photos'));
    assert.equal(options.body.get('published'), 'true');
    assert.equal(options.body.get('message'), 'Caption');
    assert.equal(options.body.get('source').type, 'image/jpeg');
  }]);
  assert.equal((await publishImage(config, 'facebook', image, 'Caption', fb)).id, '789'); fb.done();
  const ig = sequence([identity, { id: '789' }, { images: [{ source: 'https://cdn.example/photo.jpg', width: 1080 }] }, { id: '321' }, { status_code: 'FINISHED' }, { id: '654' }, { permalink: 'https://www.instagram.com/p/test/' }], [
    undefined, (url, options) => assert.equal(options.body.get('published'), 'false'), undefined,
    (url, options) => { assert.ok(url.endsWith('/456/media')); assert.equal(options.body.get('image_url'), 'https://cdn.example/photo.jpg'); }, undefined,
    (url, options) => { assert.ok(url.endsWith('/456/media_publish')); assert.equal(options.body.get('creation_id'), '321'); },
  ]);
  assert.equal((await publishImage(config, 'instagram', image, 'Caption', ig)).url, 'https://www.instagram.com/p/test/'); ig.done();
  const wrong = sequence([{ ...identity, id: '999' }]);
  await assert.rejects(publishImage(config, 'facebook', image, 'Caption', wrong), /does not belong/); wrong.done();
  const unrelated = sequence([{ ...identity, instagram_business_account: { id: '456', username: 'other' } }]);
  await assert.rejects(publishImage(config, 'instagram', image, 'Caption', unrelated), /linked to @sikhizmcom/); unrelated.done();
  const uncertain = sequence([identity, new Error('PRIVATE network error')]);
  await assert.rejects(publishImage(config, 'facebook', image, 'Caption', uncertain), err => err.uncertain && !err.message.includes('PRIVATE')); uncertain.done();
  const rejected = sequence([identity, Response.json({ error: { code: 190, message: 'PRIVATE' } }, { status: 400 })]);
  await assert.rejects(publishImage(config, 'facebook', image, 'Caption', rejected), err => !err.uncertain && err.message.includes('190') && !err.message.includes('PRIVATE')); rejected.done();
  const notReady = sequence([identity, { id: '789' }, { images: [{ source: 'https://cdn.example/photo.jpg', width: 1080 }] }, { id: '321' }, { status_code: 'ERROR' }]);
  await assert.rejects(publishImage(config, 'instagram', image, 'Caption', notReady), /could not process/); notReady.done();
  console.log('Social publishing tests passed (mocked; no live posts created).');
})().catch(error => { console.error(error); process.exitCode = 1; });
