import assert from 'node:assert/strict';
import {copyFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

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

const gfx=Array.from({length:128},()=> '0'.repeat(128)).join('\n');
const gff='0'.repeat(256)+'\n'+'0'.repeat(256);
const map=Array.from({length:32},()=> '00'.repeat(128)).join('\n');
const cart=[
  'pico-8 cartridge // http://www.pico-8.com','version 42','__lua__',
  'function _init() end','function _update() end','function _draw() cls(0) pset(64,64,8) end',
  '__gfx__',gfx,'__gff__',gff,'__map__',map,''
].join('\n');
const bytes=new TextEncoder().encode(cart),ptr=Module._malloc(bytes.length);
Module.HEAPU8.set(bytes,ptr);const result=Module._f08_load_cart_data(ptr,bytes.length);Module._free(ptr);
if(result!==0){const ep=Module._f08_get_last_error?.();const detail=ep?Module.UTF8ToString(ep):'';if(ep)Module._free(ep);throw new Error(`Fake-08 rejected smoke cart: ${detail||result}`);}
assert.ok(Module._f08_get_framebuffer_ptr()>0,'Fake-08 framebuffer should exist');
for(let i=0;i<5;i++){Module._f08_set_inputs(0,0,0,0,0);Module._f08_step_frame();}
console.log('Fake-08 loaded and stepped a PICO-8 cartridge successfully.');
