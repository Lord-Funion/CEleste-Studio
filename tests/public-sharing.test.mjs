import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('hosted Studio is public and bootstraps without a password gate', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="shareProject"/);
  assert.match(html, /bootstrap\.js/);
  assert.doesNotMatch(html, /privateGate|privatePassword|private-gate\.js/);
});

test('sharing bootstrap uses same-origin PHP and browser autosave data', async () => {
  const js = await readFile(new URL('../bootstrap.js', import.meta.url), 'utf8');
  assert.match(js, /share\.php/);
  assert.match(js, /celeste-studio-autosave/);
  assert.match(js, /params\.get\('share'\)/);
  assert.match(js, /Content-Type': 'application\/json'/);
});

test('share storage is protected from direct Apache access', async () => {
  const htaccess = await readFile(new URL('../storage/.htaccess', import.meta.url), 'utf8');
  assert.match(htaccess, /Require all denied|Deny from all/);
});
