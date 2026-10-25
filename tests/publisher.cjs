const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replace(/(["'])@\/([^"']+)\1/g, (_, q, file) => JSON.stringify(path.join(__dirname, '../src', file)));
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { EMPTY_DRAFT, PLATFORMS, validateDraft, postText } = require('../src/lib/publisher/model.ts');
const { articleUrl, parseArticle, fetchArticleResource, readLimited } = require('../src/lib/publisher/importArticle.ts');
const { startOAuth, verifyState, finishOAuth, readConnection, cookieName, OAuthConnectionError, identity, currentConnection, oauthConfig } = require('../src/lib/publisher/connections.ts');
const { publishExtra, providerRequest, linkFacets, blogHtml } = require('../src/lib/publisher/adapters.ts');
const { serverThreadsConnection } = require('../src/lib/publisher/threads.ts');
const { seal, unseal } = require('../src/lib/youtube.ts');
const { readLedger, writeLedger, attemptKey, clearAttempt } = require('../src/lib/publisher/attempts.ts');
const draft = { ...EMPTY_DRAFT, title: 'A title', caption: 'An article', url: 'https://sikhizm.com/article/', hashtags: '#Gurbani, Sikhizm #Gurbani', alt: 'A description', board: '123', imageUrl: 'https://sikhizm.com/wp-content/uploads/test.jpg' };
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
  assert.equal(PLATFORMS.length, 12);
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
  for (const platform of ['threads','pinterest','x','mastodon']) {
    process.env[`${platform.toUpperCase()}_CLIENT_ID`] = 'test-client';
    process.env[`${platform.toUpperCase()}_CLIENT_SECRET`] = 'test-secret';
    const started = startOAuth(platform), url = new URL(started.url);
    assert.ok(!started.url.includes('test-secret'));
    assert.equal(url.searchParams.get('redirect_uri'),`https://app.example/api/social/publisher/callback/${platform}`);
    const state = verifyState(started.cookie,platform,url.searchParams.get('state'));
    assert.throws(()=>verifyState(started.cookie,platform,'different'),/expired/);
    assert.throws(()=>verifyState(started.cookie,platform === 'x' ? 'threads' : 'x',state.state),/expired/);
    if (platform === 'x') assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    if (platform === 'threads') assert.equal(url.origin,'https://threads.com');
    const who = platform === 'threads' ? {id:'10',username:'sikhizm'} : platform === 'pinterest' ? {username:'sikhizm'} : platform === 'x' ? {data:{id:'10',username:'sikhizm'}} : {id:'10',acct:'sikhizm'};
    const exchange = sequence([{access_token:'ACCESS',expires_in:3600},who],[(url,o)=>{assert.equal(o.body.get('code'),'CODE');assert.equal(o.body.get('redirect_uri'),`https://app.example/api/social/publisher/callback/${platform}`);if(platform==='x')assert.equal(o.body.get('code_verifier'),state.verifier);}]);
    const session = await finishOAuth(platform,'CODE',state,exchange);exchange.done();
    assert.equal(session.name,'sikhizm');
    assert.ok(session.expires <= Date.now()+3600000);
    const cookie = seal(session); assert.equal(readConnection(cookie,platform).accessToken,'ACCESS');
    assert.equal(readConnection(cookie,platform==='x'?'threads':'x'),null);
    assert.equal(readConnection(seal({...session,expires:Date.now()-1}),platform),null);
  }
  assert.throws(()=>verifyState('', 'threads', 'anything'),error=>error.issue==='state-missing');
  const flow = startOAuth('threads');
  const flowState = verifyState(flow.cookie,'threads',new URL(flow.url).searchParams.get('state'));
  for (const [message, issue] of [['Invalid client secret PRIVATE', 'credentials-rejected'], ['redirect_uri does not match PRIVATE', 'redirect-mismatch'], ['Unspecified PRIVATE', 'token-rejected']]) {
    const rejectedToken = sequence([Response.json({error:{message,code:100,error_subcode:36008}},{status:400})]);
    await assert.rejects(finishOAuth('threads','SECRET_CODE',flowState,rejectedToken),error=>error.issue===issue&&error.httpStatus===400&&error.providerCode===100&&!error.message.includes('PRIVATE'));rejectedToken.done();
  }
  const rejectedIdentity=sequence([{access_token:'PRIVATE_ACCESS'},Response.json({error:{code:190}},{status:401})]);
  await assert.rejects(finishOAuth('threads','SECRET_CODE',flowState,rejectedIdentity),error=>error.issue==='identity-rejected'&&error.providerCode===190&&!error.message.includes('PRIVATE'));rejectedIdentity.done();
  delete process.env.THREADS_ACCESS_TOKEN;
  assert.equal(await serverThreadsConnection(async()=>{throw new Error('No fetch expected');}),null);
  process.env.THREADS_ACCESS_TOKEN='  SERVER_PRIVATE_TOKEN  ';
  const serverToken=sequence([{id:'12345',username:'sikhizmcom'}],[(url,o)=>{assert.equal(url,'https://graph.threads.com/v1.0/me?fields=id,username');assert.equal(o.headers.Authorization,'Bearer SERVER_PRIVATE_TOKEN');assert.ok(!url.includes('SERVER_PRIVATE'));}]);
  assert.equal((await serverThreadsConnection(serverToken)).id,'12345');serverToken.done();
  const wrongToken=sequence([{id:'12345',username:'different'}]);await assert.rejects(serverThreadsConnection(wrongToken),/another account/);wrongToken.done();
  const expiredToken=sequence([Response.json({error:{message:'SERVER_PRIVATE_TOKEN'}},{status:401})]);await assert.rejects(serverThreadsConnection(expiredToken),error=>/expired or been revoked/.test(error.message)&&!error.message.includes('SERVER_PRIVATE'));expiredToken.done();
  delete process.env.THREADS_ACCESS_TOKEN;
  const conn = p=>({platform:p,id:'10',name:'sikhizm',accessToken:'ACCESS',expires:Date.now()+60000});
  assert.ok(!PLATFORMS.includes('linkedin'));
  process.env.TUMBLR_BLOG_NAME='sikhizm';process.env.BLOGGER_BLOG_ID='42';process.env.WORDPRESS_COM_SITE_ID='43';
  const identities = {
    tumblr: {response:{user:{blogs:[{name:'sikhizm',title:'Sikhizm'}]}}},
    blogger: {items:[{id:'42',name:'Sikhizm blog',url:'https://sikhizm.blogspot.com/'}]},
    wordpress: {sites:[{ID:43,name:'Sikhizm blog',URL:'https://sikhizm.wordpress.com',jetpack:false,capabilities:{publish_posts:true}}]}
  };
  for (const platform of ['tumblr','blogger','wordpress']) {
    const prefix=platform==='wordpress'?'WORDPRESS_COM':platform.toUpperCase();
    process.env[`${prefix}_CLIENT_ID`]='blog-client';process.env[`${prefix}_CLIENT_SECRET`]='BLOG_SECRET';
    const started=startOAuth(platform), url=new URL(started.url);
    assert.equal(url.searchParams.get('redirect_uri'),`https://app.example/api/social/publisher/callback/${platform}`);
    assert.ok(!started.url.includes('BLOG_SECRET'));
    if(platform==='wordpress') {assert.equal(url.searchParams.get('blog'),'43');assert.equal(url.searchParams.get('scope'),'posts media');}
    if(platform==='blogger') assert.equal(url.searchParams.get('access_type'),'offline');
    const state=verifyState(started.cookie,platform,url.searchParams.get('state'));
    const calls=sequence([{access_token:'BLOG_TOKEN',expires_in:3600,refresh_token:'REFRESH'},identities[platform]],[(u,o)=>{assert.equal(o.body.get('client_secret'),'BLOG_SECRET');assert.equal(o.body.get('redirect_uri'),url.searchParams.get('redirect_uri'));}]);
    const session=await finishOAuth(platform,'code',state,calls);calls.done();
    assert.equal(session.id,platform==='tumblr'?'sikhizm':platform==='blogger'?'42':'43');
    assert.ok(!JSON.stringify({id:session.id,name:session.name}).includes('BLOG_TOKEN'));
    if(platform!=='wordpress') {
      assert.equal(session.refreshToken,'REFRESH');
      const refresh=sequence([{access_token:'RENEWED',refresh_token:'ROTATED',expires_in:3600},identities[platform]],[(u,o)=>assert.equal(o.body.get('grant_type'),'refresh_token')]);
      const renewed=await currentConnection(seal({...session,accessExpires:Date.now()-1}),platform,refresh);refresh.done();assert.equal(renewed.accessToken,'RENEWED');assert.equal(renewed.refreshToken,'ROTATED');
      const reject=sequence([Response.json({error:'invalid_grant BLOG_SECRET'},{status:400})]);await assert.rejects(currentConnection(seal({...session,accessExpires:0}),platform,reject),e=>/revoked/.test(e.message)&&!e.message.includes('BLOG_SECRET'));reject.done();
    }
    const wrong=sequence([platform==='tumblr'?{response:{user:{blogs:[]}}}:platform==='blogger'?{items:[]}:{sites:[]}]);
    await assert.rejects(identity(platform,'BLOG_TOKEN',wrong));wrong.done();
  }
  const jetpack=sequence([{sites:[{ID:43,name:'Main website',URL:'https://sikhizm.com',jetpack:true,capabilities:{publish_posts:true}}]}]);
  await assert.rejects(identity('wordpress','ACCESS',jetpack),/excluded/);jetpack.done();
  const noPublish=sequence([{sites:[{ID:43,URL:'https://sikhizm.wordpress.com',jetpack:false,capabilities:{publish_posts:false}}]}]);await assert.rejects(identity('wordpress','ACCESS',noPublish));noPublish.done();
  assert.match(validateDraft('blogger','image',{...draft,imageUrl:''}),/public HTTPS/);
  assert.match(validateDraft('blogger','image',{...draft,imageUrl:'https://127.0.0.1/a.jpg'}),/public HTTPS/);
  assert.match(validateDraft('wordpress','text',{...draft,title:''}),/title/);
  const htmlBody=blogHtml({...draft,caption:'<script>alert(1)</script>',alt:'" onerror="bad'},draft.imageUrl);
  assert.ok(htmlBody.includes('&lt;script&gt;'));assert.ok(!htmlBody.includes('<script>'));assert.ok(htmlBody.includes('&quot; onerror=&quot;bad'));
  const blogConn=p=>({...conn(p),id:p==='tumblr'?'sikhizm':p==='blogger'?'42':'43'});
  const tumblr=sequence([{response:{id:'88'}}],[(url,o)=>{assert.match(url,/blog\/sikhizm\/posts$/);assert.ok(o.body.get('post-image') instanceof Blob);}]);
  assert.equal((await publishExtra('tumblr',draft,image,blogConn('tumblr'),tumblr)).id,'88');tumblr.done();
  const blogger=sequence([{id:'89',url:'https://sikhizm.blogspot.com/2026/10/post.html'}],[(url,o)=>{assert.match(url,/blogs\/42\/posts\?isDraft=false/);assert.ok(JSON.parse(o.body).content.includes(draft.imageUrl));}]);
  assert.equal((await publishExtra('blogger',draft,null,blogConn('blogger'),blogger)).id,'89');blogger.done();
  const wordpress=sequence([{media:[{ID:90,URL:'https://sikhizm.files.wordpress.com/image.jpg'}]},{ID:91,URL:'https://sikhizm.wordpress.com/post/'}],[(url,o)=>{assert.match(url,/sites\/43\/media\/new/);assert.ok(o.body.get('media[]') instanceof Blob);},(url,o)=>{const body=JSON.parse(o.body);assert.equal(body.status,'publish');assert.equal(body.featured_image,'90');assert.ok(body.content.includes('sikhizm.files.wordpress.com'));}]);
  assert.equal((await publishExtra('wordpress',draft,image,blogConn('wordpress'),wordpress)).id,'91');wordpress.done();
  for(const p of ['tumblr','blogger','wordpress']) await assert.rejects(publishExtra(p,draft,null,{...blogConn(p),id:'wrong'},async()=>{throw new Error('Must not fetch');}),/Reconnect/);
  const ambiguousBlog=sequence([new Error('network interrupted')]);await assert.rejects(publishExtra('blogger',draft,null,blogConn('blogger'),ambiguousBlog),e=>e.uncertain===true);ambiguousBlog.done();
  const threads = sequence([{id:'20'},{id:'30'},{permalink:'https://www.threads.net/@sikhizm/post/30'}],[(url,o)=>assert.equal(JSON.parse(o.body).text,postText(draft))]);
  assert.equal((await publishExtra('threads',draft,null,conn('threads'),threads)).id,'30'); threads.done();
  const pins = sequence([{items:[{id:'123',name:'Gurbani'}]},{id:'99'}],[undefined,(url,o)=>{const data=JSON.parse(o.body);assert.equal(data.media_source.source_type,'image_base64');assert.equal(data.link,draft.url);}]);
  assert.equal((await publishExtra('pinterest',draft,image,conn('pinterest'),pins)).url,'https://www.pinterest.com/pin/99/');pins.done();
  const wrongBoard = sequence([{items:[]}]);await assert.rejects(publishExtra('pinterest',draft,image,conn('pinterest'),wrongBoard),/belonging/);wrongBoard.done();
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
  const {imageUrl: ignoredImageUrl, ...legacyDraft}=draft;
  assert.equal(await attemptKey('facebook','image',draft,image,'page1'),await attemptKey('facebook','image',legacyDraft,image,'page1'),'existing attempt hashes survive deployment');
  assert.notEqual(await attemptKey('blogger','image',draft,null,'42'),await attemptKey('blogger','image',{...draft,imageUrl:'https://sikhizm.com/another.jpg'},null,'42'));
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
    const removed = new FormData();removed.set('platform','linkedin');removed.set('kind','text');assert.equal((await publishRoute(req('publish',removed))).status,400);
    const unsupported = new FormData();unsupported.set('platform','youtube');unsupported.set('kind','image');
    assert.equal((await publishRoute(req('publish',unsupported))).status,400);
    const missingSession = new FormData();missingSession.set('platform','threads');missingSession.set('kind','text');missingSession.set('caption','Hello');
    assert.equal((await publishRoute(req('publish',missingSession))).status,401);
    assert.equal((await importRoute(req('import',JSON.stringify({url:'https://127.0.0.1/'})))).status,400);
    assert.equal((await importRoute(req('import',JSON.stringify({url:'https://sikhizm.com/a'}),false))).status,401);
    const accountRoute=require('../src/app/api/social/publisher/accounts/route.ts').POST;
    process.env.META_PAGE_ACCESS_TOKEN='PRIVATE_META';process.env.META_PAGE_ID='123';process.env.META_GRAPH_VERSION='v26.0';
    global.fetch=async url=>{if(String(url).includes('graph.facebook.com'))return Response.json({id:'123',name:'Sikhizm',instagram_business_account:{id:'456',username:'sikhizmcom'}});throw new Error('No other real requests allowed');};
    const verifiedAccounts=(await (await accountRoute(req('accounts',null))).json()).accounts;
    assert.equal(verifiedAccounts.find(a=>a.platform==='facebook').connected,true);assert.equal(verifiedAccounts.find(a=>a.platform==='instagram').connected,true);
    global.fetch=async()=>Response.json({error:{code:190,message:'PRIVATE_META'}},{status:400});
    const failedAccounts=(await (await accountRoute(req('accounts',null))).json()).accounts;
    const fbFailure=failedAccounts.find(a=>a.platform==='facebook');assert.equal(fbFailure.configured,true);assert.equal(fbFailure.connected,false);assert.match(fbFailure.message,/could not verify this Page token/);assert.ok(!JSON.stringify(failedAccounts).includes('PRIVATE_META'));
    process.env.THREADS_ACCESS_TOKEN='SERVER_PRIVATE_TOKEN';
    const tokenAccountResponses = async url=>{if(String(url).includes('graph.threads.com'))return Response.json({id:'12345',username:'sikhizmcom'});throw new Error('No other real requests allowed');};
    global.fetch=tokenAccountResponses;
    const connectedWithServerToken=(await (await accountRoute(req('accounts',null))).json()).accounts;
    const connectedThreads=connectedWithServerToken.find(a=>a.platform==='threads');assert.equal(connectedThreads.connected,true);assert.equal(connectedThreads.connection,'server-token');assert.equal(connectedThreads.name,'@sikhizmcom');assert.ok(!JSON.stringify(connectedWithServerToken).includes('SERVER_PRIVATE_TOKEN'));
    global.fetch=async()=>Response.json({id:'999',username:'wrongaccount'});
    const wrongAccount=(await (await accountRoute(req('accounts',null))).json()).accounts.find(a=>a.platform==='threads');assert.equal(wrongAccount.connected,false);assert.match(wrongAccount.message,/another account/);
    const serverPublish=sequence([{id:'12345',username:'sikhizmcom'},{id:'20'},{id:'30'},{permalink:'https://www.threads.com/@sikhizmcom/post/30'}]);global.fetch=serverPublish;
    const serverBody=new FormData();serverBody.set('platform','threads');serverBody.set('kind','text');serverBody.set('caption','A deliberately mocked test');
    const serverPublished=await publishRoute(req('publish',serverBody));assert.equal(serverPublished.status,200);assert.equal((await serverPublished.json()).id,'30');serverPublish.done();
    const rejectedServer=sequence([Response.json({error:{code:190}},{status:401})]);global.fetch=rejectedServer;
    assert.equal((await publishRoute(req('publish',serverBody))).status,400);rejectedServer.done();
    delete process.env.THREADS_ACCESS_TOKEN;
    global.fetch=async()=>{throw new Error('Unexpected external request');};
    const connectRoute=require('../src/app/api/social/publisher/connect/[platform]/route.ts').POST;
    const connected=await connectRoute(req('connect/x',null),{params:Promise.resolve({platform:'x'})});
    assert.equal(connected.status,200);assert.ok(connected.cookies.get('publisher-state-x').value);
    assert.ok(!JSON.stringify(await connected.json()).includes('test-secret'));
    const callback=require('../src/app/api/social/publisher/callback/[platform]/route.ts').GET;
    const failed=await callback(new NextRequest('https://app.example/api/social/publisher/callback/x?state=wrong&code=bad'),{params:Promise.resolve({platform:'x'})});
    assert.ok(failed.headers.get('location').includes('/posts?connectionFailed=x'));
    assert.equal(new URL(failed.headers.get('location')).searchParams.get('connectionIssue'),'state-missing');
    const mismatch=await connectRoute(new NextRequest('https://preview.example/api/social/publisher/connect/x',{method:'POST',headers:{Origin:'https://preview.example',Cookie:`${APP_COOKIE}=${appCookie}`}}),{params:Promise.resolve({platform:'x'})});
    assert.equal(mismatch.status,400);assert.match((await mismatch.json()).error,/same app hostname/);
    const validFlow=startOAuth('threads'), validState=new URL(validFlow.url).searchParams.get('state');
    const previous=seal({platform:'threads',accessToken:'PREVIOUS_ACCESS',id:'10',name:'sikhizmcom',expires:Date.now()+60000});
    global.fetch=async()=>Response.json({error:{message:'Invalid client secret PRIVATE_SECRET',code:100,error_subcode:123}},{status:400});
    const tokenFailure=await callback(new NextRequest(`https://app.example/api/social/publisher/callback/threads?state=${validState}&code=PRIVATE_CODE`,{headers:{Cookie:`publisher-state-threads=${validFlow.cookie}; publisher-threads=${previous}`}}),{params:Promise.resolve({platform:'threads'})});
    const failedUrl=new URL(tokenFailure.headers.get('location'));
    assert.equal(failedUrl.searchParams.get('connectionIssue'),'credentials-rejected');assert.equal(failedUrl.searchParams.get('providerCode'),'100');
    assert.ok(!tokenFailure.headers.get('location').includes('PRIVATE'));assert.equal(tokenFailure.cookies.get('publisher-threads'),undefined,'failed connection must not overwrite previous cookie');
    // Blogger image publishing uses the reviewed URL and does not require a file.
    const blogBody=new FormData();blogBody.set('platform','blogger');blogBody.set('kind','image');
    for(const [k,v] of Object.entries(draft))blogBody.set(k,v);
    const expiredBlog=seal({...blogConn('blogger'),refreshToken:'OLD_REFRESH',accessExpires:0});
    const blogRequest=new NextRequest('https://app.example/api/social/publisher/publish',{method:'POST',headers:{Origin:'https://app.example',Cookie:`${APP_COOKIE}=${appCookie}; publisher-blogger=${expiredBlog}`},body:blogBody});
    const blogRouteFetch=sequence([{access_token:'PRIVATE_RENEWED',refresh_token:'PRIVATE_ROTATED',expires_in:3600},identities.blogger,identities.blogger,{id:'92',url:'https://sikhizm.blogspot.com/new.html'}]);global.fetch=blogRouteFetch;
    const blogResponse=await publishRoute(blogRequest);blogRouteFetch.done();
    assert.equal(blogResponse.status,200);assert.equal((await blogResponse.json()).id,'92');
    const renewedCookie=blogResponse.cookies.get('publisher-blogger');assert.ok(renewedCookie);
    assert.equal(unseal(renewedCookie.value).refreshToken,'PRIVATE_ROTATED');assert.ok(!renewedCookie.value.includes('PRIVATE'));
    // Text mode must not accidentally embed the old Blogger image URL.
    const textBody=new FormData();textBody.set('platform','blogger');textBody.set('kind','text');for(const [k,v] of Object.entries(draft))textBody.set(k,v);
    const textRequest=new NextRequest('https://app.example/api/social/publisher/publish',{method:'POST',headers:{Origin:'https://app.example',Cookie:`${APP_COOKIE}=${appCookie}; publisher-blogger=${renewedCookie.value}`},body:textBody});
    const textRouteFetch=sequence([identities.blogger,{id:'93'}],[undefined,(u,o)=>assert.ok(!JSON.parse(o.body).content.includes('<img'))]);global.fetch=textRouteFetch;
    assert.equal((await publishRoute(textRequest)).status,200);textRouteFetch.done();
  } finally {global.fetch=realFetch;}
  console.log('Social Publisher passed: 12-platform validation, safe read-only imports, OAuth/PKCE and expiry, all new publishing adapters, uncertain results, persistent attempt history, authenticated routes. All external requests mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
