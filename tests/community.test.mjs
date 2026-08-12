import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('community browser UI exposes browsing, publishing and sorting controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="communityBrowse"/);
  assert.match(html, /id="communityPublish"/);
  assert.match(html, /id="communityDetail"/);
  assert.match(html, /value="popular"/);
  assert.match(html, /value="newest"/);
  assert.match(html, /value="likes"/);
  assert.match(html, /value="downloads"/);
  assert.match(html, /value="comments"/);
});

test('community bootstrap supports list, publish, vote, comment, download and deep links', async () => {
  const js = await readFile(new URL('../bootstrap.js', import.meta.url), 'utf8');
  assert.match(js, /community\.php/);
  assert.match(js, /action: 'publish'/);
  assert.match(js, /action: 'vote'/);
  assert.match(js, /action: 'comment'/);
  assert.match(js, /community-comment-form/);
  assert.match(js, /communityCommentBody/);
  assert.match(js, /download: 1/);
  assert.match(js, /searchParams\.set\('level'/);
  assert.match(js, /Most popular|sort/);
});

test('community PHP API has popularity sorting, strict level validation and safe file reads', async () => {
  const php = await readFile(new URL('../community.php', import.meta.url), 'utf8');
  assert.match(php, /'popular', 'newest', 'likes', 'downloads', 'comments'/);
  assert.match(php, /\$votes\['likes'\] \* 5/);
  assert.match(php, /action === 'vote'/);
  assert.match(php, /action === 'comment'/);
  assert.match(php, /action === 'publish'/);
  assert.match(php, /random_bytes\(16\)/);
  assert.match(php, /COMMUNITY_MAX_COMMENT/);
  assert.match(php, /LOCK_SH/);
  assert.match(php, /Every room must contain exactly 256 map tiles/);
  assert.match(php, /more than 48 gameplay entities|too many gameplay entities/);
  assert.match(php, /function_exists\('mb_substr'\)/);
  assert.match(php, /must use application\/json/);
  assert.doesNotMatch(php, /:\s*never\b/);

  const htaccess = await readFile(new URL('../storage/.htaccess', import.meta.url), 'utf8');
  assert.match(htaccess, /Require all denied|Deny from all/);
});

test('sharing and community write APIs require JSON requests', async () => {
  const sharePhp = await readFile(new URL('../share.php', import.meta.url), 'utf8');
  const communityPhp = await readFile(new URL('../community.php', import.meta.url), 'utf8');
  assert.match(sharePhp, /Project sharing POST requests must use application\/json/);
  assert.match(communityPhp, /Community POST requests must use application\/json/);
});
