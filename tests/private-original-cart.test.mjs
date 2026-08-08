import test from 'node:test';
import assert from 'node:assert/strict';
import {patchOriginalCelesteCart} from '../lib/pico8-cart.mjs';

function fakeCelesteCart(){
  const lua=[
    'types={}','objects={}','$={}','room={x=0,y=0}','k_jump=4','k_dash=5','k_up=2','k_down=3',
    'player={update=function(this) end}','chest={tile=20}','function load_room(x,y) room.x=x room.y=y end',
    'function next_room() end','function draw_object(o) end','function level_index() return room.x+room.y*8 end',
    'function _init() end','function _update() end','function _draw() end'
  ].join('\n');
  const gfx=Array.from({length:128},()=> '0'.repeat(128)).join('\n');
  const gff='0'.repeat(256)+'\n'+'0'.repeat(256);
  const map=Array.from({length:32},()=> '00'.repeat(128)).join('\n');
  return ['pico-8 cartridge // http://www.pico-8.com','version 42','__lua__',lua,'__gfx__',gfx,'__gff__',gff,'__map__',map,''].join('\n');
}

test('patches Studio rooms into a user-owned Celeste cart without replacing its game code',()=>{
  const tiles=new Uint8Array(256);tiles[15*16+2]=37;tiles[14*16+5]=17;
  const rotations=new Uint8Array(256);rotations[14*16+5]=1;
  const level={title:'Private',rooms:[{width:16,height:16,spawnX:2,spawnY:13,tiles,rotations,entities:[{type:20,x:7,y:13,flags:0x40},{type:129,x:9,y:13,flags:0}]}]};
  const out=patchOriginalCelesteCart(fakeCelesteCart(),level);
  assert.match(out,/player=\{update=function\(this\) end\}/,'original player code remains in the cart');
  assert.match(out,/celeste studio private patch/);
  assert.match(out,/climb_chest=\{tile=129/);
  const map=out.split('__map__\n')[1].trim().split('\n');
  assert.equal(map.length,32);
  const first=map[0];
  assert.equal(first.slice((13*2)+2*2,(13*2)+2*2+2),'01','Studio spawn becomes original cart spawn tile 1');
  assert.ok(out.includes('3b'),'90-degree up-spike rotation maps to original right-spike tile 59');
});
