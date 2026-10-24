// Production-build integration check. Uses the bundled chant, never a live account.
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sikhizm-http-qa-'));
  const image = path.join(directory, 'image.jpg'), audio = path.join(directory, 'tone.wav');
  execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=0x101c3f:s=1920x1080','-frames:v','1', image]);
  execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','pcm_s16le', audio]);
  const port = 3197;
  const key = 'local-test-key-00000000000000000000';
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)], {
    env: { ...process.env, SOCIAL_ADMIN_KEY: key, META_PAGE_ACCESS_TOKEN: '', YOUTUBE_CLIENT_ID: '', YOUTUBE_CLIENT_SECRET: '' }, stdio: ['ignore','pipe','pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 15000);
      server.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited before verification')); });
      server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    });
    const base = `http://127.0.0.1:${port}`, origin = `http://localhost:${port}`;
    let response = await fetch(base);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('Morning posts, reels'));
    for (const asset of ['fonts/ChatrikUni.ttf', 'audio/waheguru-waheguru.mp3']) {
      const served = await fetch(`${base}/${asset}`);
      assert.equal(served.status, 200, `${asset} must load without an upload`);
      assert.deepEqual(Buffer.from(await served.arrayBuffer()), fs.readFileSync(path.join('public',asset)));
    }
    response = await fetch(`${base}/api/social/reel`, { method: 'POST', headers: { origin } });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/api/social/reel`, { method: 'POST', headers: { origin:'https://other.example', authorization:`Bearer ${key}` } });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/api/social/youtube?status=1`, { method:'POST', headers:{ origin, authorization:`Bearer ${key}` } });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Connect your YouTube channel first.');
    const body = new FormData();
    body.set('image', new Blob([fs.readFileSync(image)], {type:'image/jpeg'}), 'image.jpg');
    body.set('audio', new Blob([fs.readFileSync('public/audio/waheguru-waheguru.mp3')], {type:'audio/mpeg'}), 'chant.mp3'); body.set('duration','10');
    response = await fetch(`${base}/api/social/reel`, { method:'POST', headers:{ origin, authorization:`Bearer ${key}` }, body });
    if (!response.ok) throw new Error(await response.text());
    assert.ok(response.headers.get('content-type').includes('video/mp4'));
    const file = path.join(directory, 'output.mp4'); fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','stream=codec_name,width,height,pix_fmt,sample_rate:format=duration','-of','json',file], {encoding:'utf8'}));
    assert.equal(probe.streams[0].codec_name,'h264'); assert.equal(probe.streams[0].width,1080); assert.equal(probe.streams[0].height,1920); assert.equal(probe.streams[0].pix_fmt,'yuv420p');
    assert.equal(probe.streams[1].codec_name,'aac'); assert.equal(probe.streams[1].sample_rate,'48000'); assert.equal(Number(probe.format.duration),10);
    assert.ok(fs.statSync(file).size < 4000000);
    console.log('Production HTTP reel generation, codecs, dimensions, duration and authorization checks passed. No social posts created.');
  } finally { server.kill(); fs.rmSync(directory, {recursive:true,force:true}); }
})().catch(error => { console.error(error); process.exitCode=1; });
