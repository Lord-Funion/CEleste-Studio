import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const communityRuntime = fileURLToPath(new URL('../storage/community/', import.meta.url));
const shareRuntime = fileURLToPath(new URL('../storage/shares/', import.meta.url));
const shareRateRuntime = fileURLToPath(new URL('../storage/rate/', import.meta.url));
const port = 18000 + (process.pid % 1000);
const base = `http://127.0.0.1:${port}/`;

await rm(communityRuntime, {recursive: true, force: true});
await rm(shareRuntime, {recursive: true, force: true});
await rm(shareRateRuntime, {recursive: true, force: true});

const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root], {
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
php.stdout.on('data', chunk => { serverLog += chunk.toString(); });
php.stderr.on('data', chunk => { serverLog += chunk.toString(); });

async function fetchJson(path, options) {
  const response = await fetch(new URL(path, base), options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {response, json, text};
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const {response, json} = await fetchJson('community.php?health=1');
      if (response.ok && json?.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`PHP test server did not become ready.\n${serverLog}`);
}

const room = {
  id: 1001,
  width: 16,
  height: 16,
  spawnX: 2,
  spawnY: 13,
  exitX: 13,
  exitY: 1,
  flags: 0,
  tiles: Array(256).fill(0),
  rotations: Array(256).fill(0),
  entities: [
    {type: 26, x: 5, y: 5, flags: 0},
    {type: 130, x: 7, y: 8, flags: 3},
    {type: 131, x: 10, y: 8, flags: 3}
  ]
};
const level = {
  id: 2001,
  title: 'Integration Summit',
  author: 'CI Tester',
  description: 'A PHP integration-test level.',
  difficulty: 3,
  rooms: [room]
};
const project = {
  version: 4,
  id: 3001,
  title: level.title,
  author: level.author,
  description: level.description,
  levels: [level],
  activeLevel: 0,
  activeRoom: 0
};
const clientId = 'integration-client-1234567890';

try {
  await waitForServer();

  {
    const {response, json} = await fetchJson('share.php?health=1');
    assert.equal(response.status, 200);
    assert.equal(json?.ok, true);
  }

  {
    const {response, json} = await fetchJson('community.php', {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: JSON.stringify({action: 'publish', project})
    });
    assert.equal(response.status, 415);
    assert.equal(json?.ok, false);
  }

  {
    const {response, json} = await fetchJson('share.php', {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: JSON.stringify(project)
    });
    assert.equal(response.status, 415);
    assert.equal(json?.ok, false);
  }

  let sharedId;
  {
    const {response, json} = await fetchJson('share.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(project)
    });
    assert.equal(response.status, 201);
    assert.equal(json?.ok, true);
    assert.match(json?.id ?? '', /^[a-f0-9]{32}$/);
    sharedId = json.id;
  }

  {
    const {response, json} = await fetchJson(`share.php?id=${sharedId}`);
    assert.equal(response.status, 200);
    assert.equal(json?.project?.levels?.[0]?.title, level.title);
  }

  let itemId;
  {
    const {response, json} = await fetchJson('community.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'publish', publisher: 'Integration Publisher', clientId, project})
    });
    assert.equal(response.status, 201, json?.error ?? 'publish failed');
    assert.equal(json?.ok, true);
    assert.match(json?.item?.id ?? '', /^[a-f0-9]{32}$/);
    assert.equal(json?.item?.title, level.title);
    itemId = json.item.id;
  }

  {
    const {response, json} = await fetchJson('community.php?list=1&sort=popular');
    assert.equal(response.status, 200);
    assert.equal(json?.total, 1);
    assert.equal(json?.items?.[0]?.id, itemId);
  }

  {
    const {response, json} = await fetchJson(`community.php?id=${itemId}&clientId=${clientId}`);
    assert.equal(response.status, 200);
    assert.equal(json?.item?.likes, 0);
    assert.equal(json?.item?.dislikes, 0);
    assert.equal(json?.item?.comments, 0);
    assert.equal(json?.item?.myReaction ?? null, null);
  }

  {
    const {response, json} = await fetchJson('community.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'vote', id: itemId, reaction: 'dislike', clientId})
    });
    assert.equal(response.status, 200);
    assert.equal(json?.likes, 0);
    assert.equal(json?.dislikes, 1);
    assert.equal(json?.myReaction, 'dislike');
  }

  {
    const {response, json} = await fetchJson('community.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'vote', id: itemId, reaction: 'like', clientId})
    });
    assert.equal(response.status, 200);
    assert.equal(json?.likes, 1);
    assert.equal(json?.dislikes, 0);
    assert.equal(json?.myReaction, 'like');
  }

  {
    const {response, json} = await fetchJson('community.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'comment', id: itemId, name: 'Integration User', body: 'Great level!', clientId})
    });
    assert.equal(response.status, 201);
    assert.equal(json?.comments, 1);
    assert.equal(json?.comment?.body, 'Great level!');
  }

  {
    const response = await fetch(new URL(`community.php?id=${itemId}&download=1`, base));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition') ?? '', /\.celproj/);
    const downloaded = await response.json();
    assert.equal(downloaded?.levels?.[0]?.title, level.title);
  }

  {
    const {response, json} = await fetchJson(`community.php?id=${itemId}&load=1`);
    assert.equal(response.status, 200);
    assert.equal(json?.project?.levels?.[0]?.title, level.title);
  }

  {
    const {response, json} = await fetchJson(`community.php?id=${itemId}&clientId=${clientId}`);
    assert.equal(response.status, 200);
    assert.equal(json?.item?.likes, 1);
    assert.equal(json?.item?.dislikes, 0);
    assert.equal(json?.item?.comments, 1);
    assert.equal(json?.item?.downloads, 1);
    assert.equal(json?.item?.views, 1);
    assert.equal(json?.item?.myReaction, 'like');
    assert.equal(json?.item?.commentList?.[0]?.body, 'Great level!');
  }

  for (const sort of ['popular', 'newest', 'likes', 'downloads', 'comments']) {
    const {response, json} = await fetchJson(`community.php?list=1&sort=${sort}`);
    assert.equal(response.status, 200);
    assert.equal(json?.items?.[0]?.id, itemId);
  }

  {
    const invalid = structuredClone(project);
    invalid.levels[0].rooms[0].tiles = [0];
    const {response, json} = await fetchJson('community.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'publish', publisher: 'Bad Upload', clientId, project: invalid})
    });
    assert.equal(response.status, 422);
    assert.match(json?.error ?? '', /256 map tiles/);
  }

  console.log('Community/share PHP integration test passed.');
} finally {
  php.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => php.once('exit', resolve)),
    delay(1500)
  ]);
  if (!php.killed) php.kill('SIGKILL');
  await rm(communityRuntime, {recursive: true, force: true});
  await rm(shareRuntime, {recursive: true, force: true});
  await rm(shareRateRuntime, {recursive: true, force: true});
}
