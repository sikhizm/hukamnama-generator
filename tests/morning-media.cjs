const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { indiaClock, inMorningWindow, expandTemplate, defaultTargets, verifyMorningState } = require('../src/lib/morningPlan.ts');
const { publishMedia } = require('../src/lib/socialMedia.ts');
const { reelArgs } = require('../src/lib/reelRenderer.ts');
const { seal, unseal, publishYoutube } = require('../src/lib/youtube.ts');
const cfg = { version: 'v26.0', token: 'PRIVATE', pageId: '123' };
const page = { id: '123', instagram_business_account: { id: '456', username: 'sikhizmcom', account_type: 'BUSINESS' } };
const video = new Blob(['test video'], { type: 'video/mp4' });
const image = new Blob(['test image'], { type: 'image/jpeg' });
function sequence(responses, check = []) {
  let n = 0;
  const request = async (url, options) => {
    assert.ok(n < responses.length, 'unexpected request');
    assert.ok(!String(url).includes('PRIVATE'));
    check[n]?.(String(url), options);
    const result = responses[n++];
    if (result instanceof Error) throw result;
    return result instanceof Response ? result : Response.json(result);
  };
  request.done = () => assert.equal(n, responses.length); return request;
}
(async () => {
  assert.deepEqual(indiaClock(new Date('2026-10-24T00:15:00Z')), { day: '2026-10-24', minutes: 345 });
  assert.equal(indiaClock(new Date('2026-10-24T19:00:00Z')).day, '2026-10-25');
  assert.equal(inMorningWindow('05:45', new Date('2026-10-24T00:14:00Z')), false);
  assert.equal(inMorningWindow('05:45', new Date('2026-10-24T00:15:00Z')), true);
  assert.equal(inMorningWindow('05:45', new Date('2026-10-24T05:01:00Z')), false);
  assert.equal(inMorningWindow('25:00'), false);
  assert.equal(defaultTargets['facebook-image'], true); assert.equal(defaultTargets['instagram-image'], false);
  assert.equal(defaultTargets['instagram-reel'], true); assert.equal(defaultTargets['youtube-reel'], true);
  assert.equal(expandTemplate('{date} {original}', { date: 'today', original: '{translation}', translation: 'must not expand twice' }), 'today {translation}');
  const state = { dateISO: '2026-10-24', original: 'ਬਾਣੀ', translation: 'ਅਰਥ', ang: '1', banikar: 'ਗੁਰੂ', dateText: '24 October' };
  const live = { sourceDateISO: '2026-10-24', isToday: true, metadataMatched: true, original: state.original, translation: state.translation, dateText: state.dateText, ang: state.ang, matchedAuthor: state.banikar };
  assert.equal(verifyMorningState(state, live, '2026-10-24').matchesLive, true);
  assert.equal(verifyMorningState(state, live, '2026-10-25').validLive, false, 'yesterday must not be sent after midnight');
  assert.equal(verifyMorningState(state, { ...live, metadataMatched: false }, '2026-10-24').validLive, false);
  assert.equal(verifyMorningState({ ...state, banikar: 'old author' }, live, '2026-10-24').matchesLive, false);
  assert.equal(verifyMorningState(state, { ...live, translation: '' }, '2026-10-24').validLive, false);
  assert.throws(() => reelArgs('image','audio','output',12), /10 or 15/);
  const args = reelArgs('image','audio','output',15); assert.ok(args.includes('libx264')); assert.ok(args.includes('aac')); assert.ok(args.includes('yuv420p')); assert.ok(args.some(arg => arg.includes('pad=1080:1920')));

  const fb = sequence([page, { video_id: '789', upload_url: 'https://rupload.facebook.com/video-upload/v26.0/789' }, { success: true }, { success: true }], [undefined, (url,o) => assert.equal(o.body.get('upload_phase'), 'start'), (url,o) => { assert.equal(o.headers.file_size, String(video.size)); assert.equal(o.headers.Authorization, 'OAuth PRIVATE'); }, (url,o) => { assert.equal(o.body.get('upload_phase'), 'finish'); assert.equal(o.body.get('description'), 'caption'); }]);
  assert.equal((await publishMedia(cfg,'facebook-reel',video,'caption',fb)).id,'789'); fb.done();
  const ig = sequence([page, { id:'789' }, {success:true}, {status_code:'FINISHED'}, {id:'987'}], [undefined,(url,o) => {assert.equal(o.body.get('media_type'),'REELS');assert.equal(o.body.get('upload_type'),'resumable');},(url,o)=>assert.equal(url,'https://rupload.facebook.com/ig-api-upload/v26.0/789')]);
  assert.equal((await publishMedia(cfg,'instagram-reel',video,'caption',ig)).id,'987');ig.done();
  const fsStory = sequence([page,{id:'789'},{success:true,post_id:'123_789'}],[undefined,undefined,(url,o)=>{assert.ok(url.endsWith('/123/photo_stories'));assert.equal(o.body.get('photo_id'),'789')}]);
  assert.equal((await publishMedia(cfg,'facebook-story',image,'caption',fsStory)).id,'123_789');fsStory.done();
  const igStory = sequence([page,{id:'789'},{images:[{source:'https://cdn.example/photo.jpg',width:1080}]},{id:'654'},{status_code:'FINISHED'},{id:'987'}],[undefined,undefined,undefined,(url,o)=>{assert.equal(o.body.get('media_type'),'STORIES');assert.equal(o.body.get('caption'),null)}]);
  await publishMedia(cfg,'instagram-story',image,'caption',igStory);igStory.done();
  const creator = sequence([{...page,instagram_business_account:{...page.instagram_business_account,account_type:'MEDIA_CREATOR'}}]);
  await assert.rejects(publishMedia(cfg,'instagram-story',image,'caption',creator),/Business account/);creator.done();
  const wrong = sequence([{...page,id:'999'}]); await assert.rejects(publishMedia(cfg,'facebook-reel',video,'caption',wrong),/configured Page/);wrong.done();
  const badUpload = sequence([page,{video_id:'789',upload_url:'https://evil.example/upload'}]); await assert.rejects(publishMedia(cfg,'facebook-reel',video,'caption',badUpload),/unexpected upload/);badUpload.done();
  const uncertain = sequence([page,{id:'789'},{success:true},{status_code:'FINISHED'},new Error('PRIVATE network')]);
  await assert.rejects(publishMedia(cfg,'instagram-reel',video,'caption',uncertain), e=>e.uncertain && !e.message.includes('PRIVATE'));uncertain.done();

  process.env.SOCIAL_ADMIN_KEY = 'x'.repeat(32);
  const session = { refreshToken:'PRIVATE', channelId:'UC123',title:'Sikhizm',expires:Date.now()+60000 };
  const encrypted=seal(session); assert.ok(!encrypted.includes('PRIVATE'));assert.deepEqual(unseal(encrypted),session);
  const tampered=Buffer.from(encrypted,'base64url');tampered[30]^=1;assert.throws(()=>unseal(tampered.toString('base64url')));
  assert.throws(()=>unseal(seal({...session,expires:Date.now()-1})),/expired/);
  process.env.YOUTUBE_CLIENT_ID='test';process.env.YOUTUBE_CLIENT_SECRET='PRIVATE';process.env.YOUTUBE_REDIRECT_URI='https://example.com/callback';
  const yt = sequence([{access_token:'test'},{items:[{id:'UC123',snippet:{title:'Sikhizm'}}]},new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=example'}}),{id:'video123'}],[undefined,undefined,(url,o)=>{const body=JSON.parse(o.body);assert.equal(body.status.privacyStatus,'public');assert.equal(body.snippet.description,'caption');},(url,o)=>assert.equal(o.method,'PUT')]);
  assert.equal((await publishYoutube(session,video,'caption','Title',yt)).id,'video123');yt.done();
  console.log('Morning plan, reel/story publishing, OAuth encryption and YouTube upload tests passed (mocked; no live posts).');
})().catch(error=>{console.error(error);process.exitCode=1});
