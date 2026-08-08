import assert from 'node:assert/strict';
import {copyFile,readFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPico8Cart} from '../lib/pico8-cart.mjs';

const js=resolve('preview-runtime/fake08.js');
const cjs=resolve('preview-runtime/fake08-smoke.cjs');
const wasm=resolve('preview-runtime/fake08.wasm');
await copyFile(js,cjs);
const require=createRequire(import.meta.url);
let Module;
try{
  const Fake08Module=require(cjs);
  Module=await Fake08Module({locateFile:path=>path.endsWith('.wasm')?wasm:path,print:()=>{},printErr:()=>{}});
}finally{
  await unlink(cjs).catch(()=>{});
}
Module._f08_init();

const tiles=new Uint8Array(256);
for(let x=0;x<16;x++)tiles[15*16+x]=37;
const level={title:'Smoke',rooms:[{
  id:1,width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,
  tiles,rotations:new Uint8Array(256),entities:[
    {type:18,x:5,y:14,flags:0},
    {type:129,x:7,y:14,flags:0}
  ]
}]};
const runtimeLua=await readFile(new URL('../preview-runtime/celeste-preview.lua',import.meta.url),'utf8');
const cart=new TextEncoder().encode(buildPico8Cart(level,{atlasIndices:new Uint8Array(128*64),runtimeLua}));
const ptr=Module._malloc(cart.length);
Module.HEAPU8.set(cart,ptr);
const result=Module._f08_load_cart_data(ptr,cart.length);
Module._free(ptr);
if(result!==0){
  const ep=Module._f08_get_last_error?.();
  const detail=ep?Module.UTF8ToString(ep):'';
  if(ep)Module._free(ep);
  throw new Error(`Fake-08 rejected generated Studio cart: ${detail||result}`);
}
assert.ok(Module._f08_get_framebuffer_ptr()>0,'Fake-08 framebuffer should exist');
assert.equal(Module._f08_get_target_fps(),30,'preview cart should execute at Celeste Classic 30 Hz');
for(let i=0;i<12;i++){
  const held=i<6?0x02:0;
  const down=i===1?0x10:0;
  Module._f08_set_inputs(down,held,0,0,i>=8?1:0);
  Module._f08_step_frame();
}
console.log('Fake-08 loaded and stepped the generated CEleste Studio cartridge successfully.');
