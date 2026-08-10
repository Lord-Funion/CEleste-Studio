import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevel} from '../lib/format.mjs';
import {encodeRoomRecord,patchOriginalCelesteCart,privatePreviewWarnings} from '../lib/pico8-cart.mjs';
import {minimalCelesteCart,samplePrivateLevel} from './minimal-celeste-fixture.mjs';

function linkedLevel(){
  const level=samplePrivateLevel();
  level.rooms[0].entities.push(
    {type:130,x:11,y:13,flags:12},
    {type:131,x:12,y:13,flags:12},
    {type:131,x:13,y:13,flags:12}
  );
  return level;
}

test('CELV validation accepts matching silver-key gate links',()=>{
  const level=linkedLevel();
  const result=validateLevel(level);
  assert.equal(result.valid,true);
  assert.equal(result.warnings.some(w=>/Silver (key|gate) link 12 has no matching/.test(w)),false);
});

test('validation warns when a linked gate has no key',()=>{
  const level=linkedLevel();
  level.rooms[0].entities=level.rooms[0].entities.filter(e=>e.type!==130);
  const result=validateLevel(level);
  assert.equal(result.valid,true);
  assert.match(result.warnings.join('\n'),/Silver gate link 12 has no matching silver key/);
});

test('preview room records carry silver entity IDs and six-bit links',()=>{
  const room=linkedLevel().rooms[0];
  const record=encodeRoomRecord(room);
  assert.match(record,/820b0d0c/); // type 130, x 11, y 13, link 12
  assert.match(record,/830c0d0c/); // type 131, x 12, y 13, link 12
});

test('private Celeste preview injects solid linked silver gates',()=>{
  const out=patchOriginalCelesteCart(minimalCelesteCart(),linkedLevel());
  assert.match(out,/silver_key=\{tile=130/);
  assert.match(out,/silver_gate=\{tile=131/);
  assert.match(out,/studio_gate_links\[link\]=true/);
  assert.match(out,/o\.check\(silver_gate,ox,oy\)/,'player collision is extended with silver gates');
  assert.match(out,/meta\[4\]==131 and studio_gate_links/,'already-unlocked gates are suppressed on room reload');
  assert.equal(privatePreviewWarnings(linkedLevel()).some(w=>/entity 130|entity 131/.test(w)),false);
});
