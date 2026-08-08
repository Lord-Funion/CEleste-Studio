import assert from 'node:assert/strict';
import {copyFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {patchOriginalCelesteCart} from '../lib/pico8-cart.mjs';
import {minimalCelesteCart,samplePrivateLevel} from './minimal-celeste-fixture.mjs';

const js=resolve('preview-runtime/fake08.js');
const cjs=resolve('preview-runtime/fake08-smoke.cjs');
const wasm=resolve('preview-runtime/fake08.wasm');
await copyFile(js,cjs);
const require=createRequire(import.meta.url);
let Module;
try{
  const Fake08Module=require(cjs);
  Module=await Fake08Module({locateFile:path=>path.endsWith('.wasm')?wasm:path,print:()=>{},printErr:()=>{}});
}finally{await unlink(cjs).catch(()=>{});}
Module._f08_init();

const patched=patchOriginalCelesteCart(minimalCelesteCart(),samplePrivateLevel());
const bytes=new TextEncoder().encode(patched),ptr=Module._malloc(bytes.length);
Module.HEAPU8.set(bytes,ptr);
const result=Module._f08_load_cart_data(ptr,bytes.length);
Module._free(ptr);
if(result!==0){
  const ep=Module._f08_get_last_error?.();
  const detail=ep?Module.UTF8ToString(ep):'';
  if(ep)Module._free(ep);
  throw new Error(`Fake-08 rejected Studio's original-cart patch: ${detail||result}`);
}
assert.ok(Module._f08_get_framebuffer_ptr()>0,'Fake-08 framebuffer should exist');
assert.equal(Module._f08_get_target_fps(),30,'Celeste-compatible preview must run at 30 Hz');
for(let i=0;i<12;i++){
  const held=i<6?0x02:0;
  const down=i===1?0x10:0;
  Module._f08_set_inputs(down,held,0,0,i>=8?1:0);
  Module._f08_step_frame();
}
console.log('Fake-08 loaded and stepped Studio\'s patched original-cart preview path successfully.');
