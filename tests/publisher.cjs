const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, q, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { EMPTY_DRAFT, PLATFORMS, validateDraft, postText } = require('../src/lib/publisher/model.ts');
const { articleUrl, parseArticle, fetchArticleResource, readLimited } = require('../src/lib/publisher/importArticle.ts');
const { startOAuth, verifyState, finishOAuth, readConnection, cookieName } = require('../src/lib/publisher/connections.ts');
const { publishExtra, providerRequest, linkFacets } = require('../src/lib/publisher/adapters.ts');
const { seal, unseal } = require('../src/lib/youtube.ts');
const { readLedger, writeLedger, attemptKey, clearAttempt } = require('../src/lib/publisher/attempts.ts');
const draft = { ...EMPTY_DRAFT, title: 'A title', caption: 'An article', url: 'https://sikhizm.com/article/', hashtags: '#Gurbani, Sikhizm #Gurbani', alt: 'A description', board: '123' };
const image = new Blob([new Uint8Array([255,216,255,217,0,0,0,0,0,0,0,0])], {type:'image/jpeg'});
function sequence(items, checks = []) {
  let index = 0;
  const request = async (url, options = {}) => {
    assert.ok(index < items.length, `unexpected request: ${url}`);
    assert.equal(options.cache, 'no-store');
    checks[index]?.(String(url), options);
    const result = items[index++];
    if (result instanceof Error) throw result;
    return result instanceof Response ? result : Response.json(result);
  };
  request.done = () => assert.equal(index, items.length); return request;
}
(async () => {
  assert.equal(PLATFORMS.length, 10);
  assert.equal(postText(draft), 'An article\n\nhttps://sikhizm.com/article/\n\n#Gurbani #Sikhizm');
  assert.equal(postText({...draft,caption: draft.url}), `${draft.url}\n\n#Gurbani #Sikhizm`);
  for (const platform of PLATFORMS.filter(p => p !== 'youtube')) assert.equal(validateDraft(platform, 'image', draft), null, platform);
  assert.match(validateDraft('youtube', 'image', draft), /does not support/);
  assert.match(validateDraft('pinterest', 'text', draft), /does not support/);
  assert.match(validateDraft('instagram', 'text', draft), /does not support/);
  assert.match(validateDraft('x', 'text', {...draft,caption:'a'.repeat(281)}), /280/);
  assert.match(validateDraft('telegram','image',{...draft,caption:'a'.repeat(1025)}), /1,024/);
  assert.match(validateDraft('pinterest','image',{...draft,board:'bad'}), /board/);
  assert.match(validateDraft('youtube','video',{...draft,title:''}), /title/);
  assert.match(validateDraft('facebook','text',{...draft,url:'javascript:alert(1)'}), /HTTPS/);
  assert.match(validateDraft('facebook','text',{...EMPTY_DRAFT}), /message/);
  assert.equal(validateDraft('facebook','image',{...EMPTY_DRAFT}), null);

  for (const url of ['http://sikhizm.com/a','https://sikhizm.com.evil.test/a','https://sikhizm.com@evil.test/a','https://127.0.0.1/','https://sikhizm.com:444/a','https://sikhizm.com/wp-admin/']) assert.throws(()=>articleUrl(url), /public HTTPS/);
  const html = '<meta content="Title &amp; More" property="og:title"><meta name="description" content="ਪੰਜਾਬੀ &lt;em&gt;text&lt;/em&gt;"><meta property="og:image" content="/wp-content/uploads/test.jpg">';
  const imported = parseArticle(html,'https://sikhizm.com/article/');
  assert.equal(imported.title,'Title & More'); assert.equal(imported.caption,'ਪੰਜਾਬੀ <em>text</em>');
  assert.equal(imported.imageUrl,'https://sikhizm.com/wp-content/uploads/test.jpg');
  assert.equal(parseArticle(html.replace('/wp-content/uploads/test.jpg','https://evil.test/a.jpg'),'https://sikhizm.com/a').imageUrl,'');
  const redirect = sequence([new Response('',{status:302,headers:{Location:'https://127.0.0.1/private'}})]);
  await assert.rejects(fetchArticleResource('https://sikhizm.com/a',redirect),/public HTTPS/); redirect.done();
  const safe = sequence([new Response('',{status:301,headers:{Location:'/b'}}),new Response(html)]);
  assert.equal((await fetchArticleResource('https://sikhizm.com/a',safe)).url,'https://sikhizm.com/b'); safe.done();
  await assert.rejects(readLimited(new Response('too big'),3),/too large/);

  process.env.SOCIAL_ADMIN_KEY = 't'.repeat(32);
  process.env.PUBLISHER_REDIRECT_BASE = 'https://app.example';
  for (const platform of ['threads','pinterest','linkedin','x','mastodon']) {
    process.env[`${platform.toUpperCase()}_CLIENT_ID`] = 'test-client';
    process.env[`${platform.toUpperCase()}_CLIENT_SECRET`] = 'test-secret';
    const started = startOAuth(platform), url = new URL(started.url);
    assert.ok(!started.url.includes('test-secret'));
    assert.equal(url.searchParams.get('redirect_uri'),`https://app.example/api/social/publisher/callback/${platform}`);
    const state = verifyState(started.cookie,platform,url.searchParams.get('state'));
    assert.throws(()=>verifyState(started.cookie,platform,'different'),/expired/);
    assert.throws(()=>verifyState(started.cookie,platform === 'x' ? 'threads' : 'x',state.state),/expired/);
    if (platform === 'x') assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    const who = platform === 'threads' ? {id:'10',username:'sikhizm'} : platform === 'pinterest' ? {username:'sikhizm'} : platform === 'linkedin' ? {sub:'member',name:'Sikhizm'} : platform === 'x' ? {data:{id:'10',username:'sikhizm'}} : {id:'10',acct:'sikhizm'};
    const exchange = sequence([{access_token:'ACCESS',expires_in:3600},who],[(url,o)=>{assert.equal(o.body.get('code'),'CODE');assert.equal(o.body.get('redirect_uri'),`https://app.example/api/social/publisher/callback/${platform}`);if(platform==='x')assert.equal(o.body.get('code_verifier'),state.verifier);}]);
    const session = await finishOAuth(platform,'CODE',state,exchange);exchange.done();
    assert.equal(session.name,'sikhizm' === who.username ? 'sikhizm' : platform==='linkedin'?'Sikhizm':'sikhizm');
    assert.ok(session.expires <= Date.now()+3600000);
    const cookie = seal(session); assert.equal(readConnection(cookie,platform).accessToken,'ACCESS');
    assert.equal(readConnection(cookie,platform==='x'?'threads':'x'),null);
    assert.equal(readConnection(seal({...session,expires:Date.now()-1}),platform),null);
  }
  const conn = p=>({platform:p,id:p==='linkedin'?'urn:li:person:member':'10',name:'sikhizm',accessToken:'ACCESS',expires:Date.now()+60000});
  const threads = sequence([{id:'20'},{id:'30'},{permalink:'https://www.threads.net/@sikhizm/post/30'}],[(url,o)=>assert.equal(JSON.parse(o.body).text,postText(draft))]);
  assert.equal((await publishExtra('threads',draft,null,conn('threads'),threads)).id,'30'); threads.done();
  const pins = sequence([{items:[{id:'123',name:'Gurbani'}]},{id:'99'}],[undefined,(url,o)=>{const data=JSON.parse(o.body);assert.equal(data.media_source.source_type,'image_base64');assert.equal(data.link,draft.url);}]);
  assert.equal((await publishExtra('pinterest',draft,image,conn('pinterest'),pins)).url,'https://www.pinterest.com/pin/99/');pins.done();
  const wrongBoard = sequence([{items:[]}]);await assert.rejects(publishExtra('pinterest',draft,image,conn('pinterest'),wrongBoard),/belonging/);wrongBoard.done();
  process.env.LINKEDIN_API_VERSION='202610';
  const li = sequence([{value:{uploadUrl:'https://www.linkedin.com/upload',image:'urn:li:image:1'}},new Response('',{status:201}),new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:2'}})],[undefined,undefined,(url,o)=>assert.equal(JSON.parse(o.body).author,'urn:li:person:member')]);
  assert.equal((await publishExtra('linkedin',draft,image,conn('linkedin'),li)).id,'urn:li:share:2');li.done();
  const evil = sequence([{value:{uploadUrl:'https://evil.test/upload',image:'urn:li:image:1'}}]);await assert.rejects(publishExtra('linkedin',draft,image,conn('linkedin'),evil),/unexpected/);evil.done();
  const x = sequence([{data:{id:'1'}},{data:{id:'2'}}],[undefined,(url,o)=>assert.deepEqual(JSON.parse(o.body).media,{media_ids:['1']})]);
  assert.equal((await publishExtra('x',draft,image,conn('x'),x)).id,'2');x.done();
  process.env.TELEGRAM_BOT_TOKEN='TEST_TOKEN';process.env.TELEGRAM_CHAT_ID='@test';
  const telegram = sequence([{ok:true,result:{id:1}},{ok:true,result:{id:-100123,type:'channel',title:'Sikhizm'}},{ok:true,result:{status:'administrator',can_post_messages:true}},{ok:true,result:{message_id:8,chat:{username:'sikhizm'}}}],[undefined,undefined,undefined,(url,o)=>assert.equal(o.body.get('caption'),postText(draft))]);
  assert.equal((await publishExtra('telegram',draft,image,null,telegram)).url,'https://t.me/sikhizm/8');telegram.done();
  process.env.BLUESKY_IDENTIFIER='test.bsky.social';process.env.BLUESKY_APP_PASSWORD='APP-PASSWORD';
  const bsky = sequence([{accessJwt:'ACCESS',did:'did:plc:test',handle:'test.bsky.social'},{blob:{ref:'blob'}},{uri:'at://did:plc:test/app.bsky.feed.post/123'}],[undefined,undefined,(url,o)=>{const data=JSON.parse(o.body);assert.equal(data.record.embed.images[0].alt,draft.alt);assert.equal(data.record.facets[0].features[0].uri,draft.url);}]);
  assert.equal((await publishExtra('bluesky',draft,image,null,bsky)).id,'at://did:plc:test/app.bsky.feed.post/123');bsky.done();
  const facets = linkFacets('ੴ https://sikhizm.com/a');assert.equal(facets[0].index.byteStart,Buffer.byteLength('ੴ '));
  const mastodon = sequence([{id:'1',url:'https://mastodon.social/media/1'},{id:'2',url:'https://mastodon.social/@sikhizm/2'}]);
  assert.equal((await publishExtra('mastodon',draft,image,conn('mastodon'),mastodon)).id,'2');mastodon.done();
  const noPermalink = sequence([{id:'2'}]);assert.equal((await publishExtra('mastodon',draft,null,conn('mastodon'),noPermalink)).id,'2');noPermalink.done();
  const interrupted = sequence([new Error('SECRET response')]);await assert.rejects(providerRequest('https://example.test',{},true,interrupted),error=>error.uncertain&&!error.message.includes('SECRET'));interrupted.done();
  const rejected = sequence([new Response('',{status:403})]);await assert.rejects(providerRequest('https://example.test',{},true,rejected),error=>!error.uncertain);rejected.done();
  const badJson = sequence([new Response('not JSON')]);await assert.rejects(publishExtra('x',draft,null,conn('x'),badJson),error=>error.uncertain);badJson.done();

  const storage = new Map();global.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const key = await attemptKey('facebook','image',draft,image,'page1');
  assert.notEqual(key,await attemptKey('facebook','image',draft,image,'page2'),'different accounts have separate attempt histories');
  assert.notEqual(key,await attemptKey('instagram','image',draft,image,'page1'));
  writeLedger(key,{uncertain:true});assert.equal(readLedger()[key].outcome.uncertain,true,'pre-dispatch marker survives rereading');
  writeLedger(key,{id:'posted'});assert.equal(readLedger()[key].outcome.id,'posted');clearAttempt(key);assert.equal(readLedger()[key],undefined);

  // Exercise authenticated API boundaries and validation without a real external request.
  const { NextRequest } = require('next/server'); const { sealData } = require('iron-session');
  const { APP_COOKIE, credentialsVersion, SESSION_TTL } = require('../src/lib/appSession.ts');
  process.env.APP_USERNAME='test';process.env.APP_PASSWORD='long-test-password';process.env.APP_SESSION_SECRET='s'.repeat(32);
  const appCookie=await sealData({username:'test',version:credentialsVersion(),expires:Date.now()+60000},{password:process.env.APP_SESSION_SECRET,ttl:SESSION_TTL});
  const req=(suffix,body,authenticated=true,origin='https://app.example')=>new NextRequest(`https://app.example/api/social/publisher/${suffix}`,{method:'POST',headers:{Origin:origin,...(authenticated?{Cookie:`${APP_COOKIE}=${appCookie}`}:{})},body});
  const publishRoute = require('../src/app/api/social/publisher/publish/route.ts').POST;
  const importRoute = require('../src/app/api/social/publisher/import/route.ts').POST;
  const realFetch=global.fetch;global.fetch=async()=>{throw new Error('Unexpected external request');};
  try {
    assert.equal((await publishRoute(req('publish',new FormData(),false))).status,401);
    assert.equal((await publishRoute(req('publish',new FormData(),true,'https://evil.test'))).status,401);
    const unsupported = new FormData();unsupported.set('platform','youtube');unsupported.set('kind','image');
    assert.equal((await publishRoute(req('publish',unsupported))).status,400);
    const missingSession = new FormData();missingSession.set('platform','threads');missingSession.set('kind','text');missingSession.set('caption','Hello');
    assert.equal((await publishRoute(req('publish',missingSession))).status,401);
    assert.equal((await importRoute(req('import',JSON.stringify({url:'https://127.0.0.1/'})))).status,400);
    assert.equal((await importRoute(req('import',JSON.stringify({url:'https://sikhizm.com/a'}),false))).status,401);
    const connectRoute=require('../src/app/api/social/publisher/connect/[platform]/route.ts').POST;
    const connected=await connectRoute(req('connect/x',null),{params:Promise.resolve({platform:'x'})});
    assert.equal(connected.status,200);assert.ok(connected.cookies.get('publisher-state-x').value);
    assert.ok(!JSON.stringify(await connected.json()).includes('test-secret'));
    const callback=require('../src/app/api/social/publisher/callback/[platform]/route.ts').GET;
    const failed=await callback(new NextRequest('https://app.example/api/social/publisher/callback/x?state=wrong&code=bad'),{params:Promise.resolve({platform:'x'})});
    assert.ok(failed.headers.get('location').includes('/posts?connectionFailed=x'));
  } finally {global.fetch=realFetch;}
  console.log('Social Publisher passed: 10-platform validation, safe read-only imports, OAuth/PKCE and expiry, all new publishing adapters, uncertain results, persistent attempt history, authenticated routes. All external requests mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
