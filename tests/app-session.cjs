const assert=require('node:assert/strict'), fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {sealData}=require('iron-session');
const {loginConfigured,correctCredentials,readAppSession,credentialsVersion,SESSION_TTL}=require('../src/lib/appSession.ts');
(async()=>{
  process.env.APP_USERNAME='qa-user';process.env.APP_PASSWORD='qa-password-123456!';process.env.APP_SESSION_SECRET='x'.repeat(32);
  assert.equal(loginConfigured(),true);assert.equal(correctCredentials('qa-user','qa-password-123456!'),true);assert.equal(correctCredentials('other','qa-password-123456!'),false);assert.equal(correctCredentials('qa-user','wrong'),false);
  const data={username:'qa-user',version:credentialsVersion(),expires:Date.now()+60000};
  const seal=await sealData(data,{password:process.env.APP_SESSION_SECRET,ttl:SESSION_TTL});
  assert.equal((await readAppSession(seal)).username,'qa-user');assert.equal(await readAppSession(),null);assert.equal(await readAppSession(seal.slice(0,100)+(seal[100]==='a'?'b':'a')+seal.slice(101)),null);
  const expired=await sealData({...data,expires:Date.now()-1},{password:process.env.APP_SESSION_SECRET,ttl:SESSION_TTL});assert.equal(await readAppSession(expired),null);
  process.env.APP_PASSWORD='changed-password-123';assert.equal(await readAppSession(seal),null,'changing password invalidates old sessions');
  delete process.env.APP_PASSWORD;assert.equal(loginConfigured(),false);assert.equal(await readAppSession(seal),null);
  console.log('App session encryption, credentials, tamper rejection, expiry and password rotation checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
