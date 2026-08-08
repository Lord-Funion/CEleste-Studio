import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('private gate loads app only after password gate code',async()=>{
  const js=await readFile(new URL('../private-gate.js',import.meta.url),'utf8');
  assert.match(js,/celestePrivatePassword/);
  assert.match(js,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(js,/await import\('\.\/app\.js/);
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/class="private-locked"/);
  assert.match(html,/private-gate\.js/);
  assert.doesNotMatch(html,/type="module" src="app\.js/);
});
