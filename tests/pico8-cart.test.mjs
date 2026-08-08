import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRoomRecord,packRotations,TILE_MASK} from '../lib/pico8-cart.mjs';

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

test('PICO-8 flag table stays identical to Studio/CEleste',()=>{
  assert.equal(TILE_MASK[37],3);
  assert.equal(TILE_MASK[66],19);
  assert.equal(TILE_MASK[17],2);
});
