import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const htmlUrl = new URL('../index.html', import.meta.url);
const appUrl = new URL('../app.js', import.meta.url);

test('editor exposes the new local quality-of-life controls', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['duplicateLevel', 'deleteLevel', 'fitCanvas', 'showGrid', 'saveStatus']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('editor persists preferences and avoids no-op stroke history', async () => {
  const [js, html] = await Promise.all([readFile(appUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  assert.match(js, /celeste-studio-editor-prefs-v1/);
  assert.match(js, /strokeBefore=snapshot\(\)/);
  assert.match(js, /if\(strokeChanged\)commit\(\)/);
  assert.match(js, /pointerCanPaint/);
  assert.match(html, /Alt\+←\/→/i);
});
