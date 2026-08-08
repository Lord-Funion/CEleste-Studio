import test from 'node:test';
import assert from 'node:assert/strict';
import {patchOriginalCelesteCart,privatePreviewWarnings} from '../lib/pico8-cart.mjs';
import {minimalCelesteCart,samplePrivateLevel} from './minimal-celeste-fixture.mjs';

test('patches Studio rooms into a user-owned Celeste cart without replacing player physics',()=>{
  const base=minimalCelesteCart();
  const level=samplePrivateLevel();
  const out=patchOriginalCelesteCart(base,level);
  assert.match(out,/player=\{tile=1,update=function\(this\) end\}/,'the original player implementation remains in the cart');
  assert.match(out,/celeste studio private original-cart patch/);
  assert.match(out,/climb_chest=\{tile=129/);
  assert.match(out,/studio_old_player_update=player\.update/);
  assert.match(out,/function studio_map/,'the original map renderer calls are redirected to the rotation-aware renderer');
  assert.doesNotMatch(out,/\bmap\(room\.x\*16/,'old map draw calls should be patched');

  const map=out.split('__map__\n')[1].trim().split('\n');
  assert.equal(map.length,32);
  assert.equal(map[13].slice(4,6),'01','Studio spawn becomes original cart spawn tile 1');
  assert.equal(map[14].slice(10,12),'3b','90-degree up-spike rotation uses right-spike tile 59 for collision');
  assert.equal(map[13].slice(14,16),'14','chest stays an original Celeste chest tile');
  assert.equal(map[13].slice(18,20),'81','Climb Chest uses logical map entity 129');
});

test('private preview warns only about rotated compound entity animations that cannot be losslessly redirected',()=>{
  const level=samplePrivateLevel();
  level.rooms[0].entities.push({type:96,x:10,y:13,flags:0x40});
  const warnings=privatePreviewWarnings(level);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/entity 96/);
});

test('rejects unrelated PICO-8 carts instead of silently running wrong physics',()=>{
  assert.throws(()=>patchOriginalCelesteCart('pico-8 cartridge // http://www.pico-8.com\nversion 42\n__lua__\nfunction _init() end\n__gfx__\n00\n__gff__\n00\n__map__\n00\n',samplePrivateLevel()),/compatible Celeste|incomplete/);
});
