import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPico8Cart,encodeRoomRecord,packRotations,TILE_MASK} from '../lib/pico8-cart.mjs';

const room=(tile=0)=>({
  id:1,width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,
  tiles:Object.assign(new Uint8Array(256),{0:tile}),rotations:new Uint8Array(256),entities:[]
});

test('rotation plane matches CELV 2bpp packing',()=>{
  const r=new Uint8Array(256);r[0]=1;r[1]=2;r[2]=3;r[3]=0;r[4]=3;
  const packed=packRotations(r);
  assert.equal(packed.length,64);
  assert.equal(packed[0],0x39);
  assert.equal(packed[1],0x03);
});

test('room records carry Climb Chest 129 without confusing it for an atlas tile',()=>{
  const r=room();r.entities=[{type:129,x:6,y:8,flags:0xc0}];
  const record=encodeRoomRecord(r);
  assert.equal(record.slice(0,4),'020d');
  assert.equal(record.slice(4+64*2,4+64*2+2),'01');
  assert.equal(record.slice(-8),'810608c0');
});

test('generated cart uses normal map rows and shared lower sprite/map memory correctly',async()=>{
  const rooms=Array.from({length:32},()=>room());
  rooms[0].tiles[0]=0x12;
  rooms[16].tiles[0]=0x3a; // room 17 begins at map y=32
  rooms[0].entities=[{type:129,x:5,y:5,flags:0}];
  const level={title:'test',rooms};
  const lua=await readFile(new URL('../preview-runtime/celeste-preview.lua',import.meta.url),'utf8');
  const cart=buildPico8Cart(level,{atlasIndices:new Uint8Array(128*64),runtimeLua:lua});
  assert.match(cart,/pico-8 cartridge/);
  assert.ok(!cart.includes('__CELSTUDIO_ROOM_COUNT__'));
  assert.ok(!cart.includes('__CELSTUDIO_ROOM_DATA__'));
  const map=cart.split('__map__\n')[1].split('\n');
  assert.ok(map[0].startsWith('12'));
  const gfx=cart.split('__gfx__\n')[1].split('\n__gff__')[0].split('\n');
  assert.equal(gfx.length,128);
  assert.ok(gfx[64].startsWith('a3')); // __gfx__ stores shared map byte low nibble first
});

test('PICO-8 flag table stays identical to Studio/CEleste',()=>{
  assert.equal(TILE_MASK[37],3);
  assert.equal(TILE_MASK[66],19);
  assert.equal(TILE_MASK[17],2);
});
