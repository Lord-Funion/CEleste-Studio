import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('private original-cart preview module never fetches a bundled Celeste runtime',async()=>{
  const js=await readFile(new URL('../lib/pico8-preview.mjs',import.meta.url),'utf8');
  assert.match(js,/getPrivateCart/);
  assert.match(js,/patchOriginalCelesteCart/);
  assert.doesNotMatch(js,/celeste-preview\.lua/);
});
