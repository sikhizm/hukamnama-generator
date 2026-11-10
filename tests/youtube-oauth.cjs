const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, filename);

process.env.SOCIAL_ADMIN_KEY = "test-social-admin-key-which-is-long-enough";
process.env.YOUTUBE_CLIENT_ID = "test-client-id";
process.env.YOUTUBE_CLIENT_SECRET = "test-client-secret";
process.env.YOUTUBE_REDIRECT_URI = "https://app.example/api/social/youtube/callback";

const { googleToken, publishYoutube, seal, unseal } = require("../src/lib/youtube.ts");

function sequence(responses, checks = []) {
  let index = 0;
  const request = async (url, options = {}) => {
    assert.ok(index < responses.length, "unexpected Google/YouTube request");
    checks[index]?.(String(url), options);
    const response = responses[index++];
    if (response instanceof Error) throw response;
    return response;
  };
  request.done = () => assert.equal(index, responses.length, "not all mocked requests were used");
  return request;
}

(async () => {
  const tokenRequest = sequence([Response.json({ access_token: "ACCESS", refresh_token: "ROTATED", expires_in: 3600 })], [
    (url, options) => {
      assert.equal(url, "https://oauth2.googleapis.com/token");
      assert.equal(options.method, "POST");
      assert.equal(options.cache, "no-store");
      assert.equal(options.body.get("grant_type"), "refresh_token");
      assert.equal(options.body.get("refresh_token"), "OLD_REFRESH");
    },
  ]);
  const refreshed = await googleToken({ grant_type: "refresh_token", refresh_token: "OLD_REFRESH" }, tokenRequest);
  tokenRequest.done();
  assert.equal(refreshed.access_token, "ACCESS");
  assert.equal(refreshed.refresh_token, "ROTATED");

  const invalidGrant = sequence([Response.json({ error: "invalid_grant" }, { status: 400 })]);
  await assert.rejects(
    googleToken({ grant_type: "refresh_token", refresh_token: "EXPIRED" }, invalidGrant),
    error => /Testing/.test(error.message) && /7 days/.test(error.message) && /In production/.test(error.message),
  );
  invalidGrant.done();

  const session = { refreshToken: "OLD_REFRESH", channelId: "channel-1", title: "Sikhizm", expires: Date.now() + 86400000 };
  const calls = sequence([
    Response.json({ access_token: "ACCESS", refresh_token: "ROTATED_REFRESH", expires_in: 3600 }),
    Response.json({ items: [{ id: "channel-1", snippet: { title: "Sikhizm" } }] }),
    new Response(null, { status: 200, headers: { location: "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable" } }),
    Response.json({ id: "video-123" }),
  ], [
    (url, options) => { assert.equal(url, "https://oauth2.googleapis.com/token"); assert.equal(options.body.get("grant_type"), "refresh_token"); },
    (url, options) => { assert.ok(url.includes("/youtube/v3/channels?part=snippet&mine=true")); assert.equal(options.headers.Authorization, "Bearer ACCESS"); },
    (url, options) => { assert.ok(url.includes("uploadType=resumable")); assert.equal(options.method, "POST"); assert.equal(options.headers.Authorization, "Bearer ACCESS"); },
    (url, options) => { assert.equal(url, "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable"); assert.equal(options.method, "PUT"); },
  ]);
  let rotatedRefreshToken = "";
  const result = await publishYoutube(
    session,
    new Blob([new Uint8Array(32)], { type: "video/mp4" }),
    "Daily Hukamnama",
    "Today's Hukamnama",
    calls,
    value => { rotatedRefreshToken = value; },
  );
  calls.done();
  assert.equal(result.id, "video-123");
  assert.equal(rotatedRefreshToken, "ROTATED_REFRESH");

  const cookie = seal({ ...session, expires: Date.now() + 86400000 });
  assert.equal(unseal(cookie).refreshToken, "OLD_REFRESH");
  console.log("YouTube OAuth tests passed: offline refresh, Testing-mode expiry guidance, refresh-token rotation and encrypted token storage.");
})().catch(error => { console.error(error); process.exitCode = 1; });
