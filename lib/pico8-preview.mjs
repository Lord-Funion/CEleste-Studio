import {patchOriginalCelesteCart,privatePreviewWarnings} from './pico8-cart.mjs';
import {getPrivateCart,pickAndStorePrivateCart} from './private-cart.mjs';

const RUNTIME_BASE=new URL('../preview-runtime/',import.meta.url);
const PICO_W=128,PICO_H=128;
const KEY_BITS={ArrowLeft:0x01,ArrowRight:0x02,ArrowUp:0x04,ArrowDown:0x08,KeyZ:0x10,KeyX:0x20};
let fake08Promise=null;

function loadClassicScript(url){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-celeste-runtime="${url.href}"]`);
    if(existing){
      if(globalThis.Fake08Module)return resolve();
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',()=>reject(new Error(`Failed to load ${url.pathname}`)),{once:true});
      return;
    }
    const s=document.createElement('script');s.src=url.href;s.async=true;s.dataset.celesteRuntime=url.href;
    s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${url.pathname}`));document.head.append(s);
  });
}

async function getFake08(){
  if(!fake08Promise)fake08Promise=(async()=>{
    if(!globalThis.Fake08Module)await loadClassicScript(new URL('fake08.js',RUNTIME_BASE));
    if(typeof globalThis.Fake08Module!=='function')throw new Error('Fake-08 browser module did not initialize');
    const Module=await globalThis.Fake08Module({
      locateFile:path=>path.endsWith('.wasm')?new URL('fake08.wasm',RUNTIME_BASE).href:new URL(path,RUNTIME_BASE).href,
      print:msg=>console.debug('[Fake-08]',msg),printErr:msg=>console.warn('[Fake-08]',msg)
    });
    Module._f08_init();return Module;
  })();
  return fake08Promise;
}

function lastFake08Error(Module){
  try{const ptr=Module._f08_get_last_error?.();if(!ptr)return '';const text=Module.UTF8ToString(ptr)||'';Module._free?.(ptr);return text;}catch{return '';}
}
function loadCart(Module,bytes){
  const ptr=Module._malloc(bytes.length);
  try{Module.HEAPU8.set(bytes,ptr);const result=Module._f08_load_cart_data(ptr,bytes.length);if(result!==0)throw new Error(lastFake08Error(Module)||`Fake-08 rejected the patched original cartridge (code ${result})`);}finally{Module._free(ptr);}
}

export function createPico8Preview({canvas,status,dialog}){
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const native=document.createElement('canvas');native.width=PICO_W;native.height=PICO_H;
  const nctx=native.getContext('2d');nctx.imageSmoothingEnabled=false;
  const image=nctx.createImageData(PICO_W,PICO_H);
  let Module=null,fbPtr=0,palettePtr=0,paletteView=null,raf=0,running=false,last=0,accum=0,frameMs=1000/30;
  let held=0,pressed=0,grab=false,cartBytes=null,cartName='celeste.p8';
  const setStatus=t=>{if(status)status.textContent=t;};
  const active=()=>running&&dialog.open;

  function onKeyDown(e){
    if(!active())return;
    if(e.code==='KeyR'){e.preventDefault();if(cartBytes){loadCart(Module,cartBytes);held=0;pressed=0;grab=false;accum=0;last=performance.now();setStatus(`Restarted ${cartName} · exact original-cart physics`);}return;}
    if(e.code==='KeyC'){grab=true;e.preventDefault();return;}
    const bit=KEY_BITS[e.code];if(bit){e.preventDefault();if(!(held&bit))pressed|=bit;held|=bit;}
  }
  function onKeyUp(e){
    if(e.code==='KeyC'){grab=false;if(active())e.preventDefault();return;}
    const bit=KEY_BITS[e.code];if(bit){held&=~bit;if(active())e.preventDefault();}
  }
  window.addEventListener('keydown',onKeyDown,{passive:false});
  window.addEventListener('keyup',onKeyUp,{passive:false});

  function renderFrame(){
    if(!Module||!fbPtr)return;
    const fb=new Uint8Array(Module.HEAPU8.buffer,fbPtr,PICO_W*PICO_H/2);
    if(!paletteView||paletteView.buffer!==Module.HEAPU8.buffer)paletteView=new Uint8Array(Module.HEAPU8.buffer,palettePtr,64);
    Module._f08_get_palette_rgba(palettePtr);
    const d=image.data;
    for(let i=0;i<PICO_W*PICO_H;i++){
      const b=fb[i>>1],c=(i&1)?(b>>4):(b&15),p=c*4,o=i*4;
      d[o]=paletteView[p];d[o+1]=paletteView[p+1];d[o+2]=paletteView[p+2];d[o+3]=255;
    }
    nctx.putImageData(image,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(native,0,0,canvas.width,canvas.height);
  }

  function loop(now){
    if(!running)return;
    accum+=Math.min(150,now-last);last=now;let steps=0;
    while(accum>=frameMs&&steps<6){Module._f08_set_inputs(pressed,held,0,0,grab?1:0);pressed=0;Module._f08_step_frame();accum-=frameMs;steps++;}
    renderFrame();raf=requestAnimationFrame(loop);
  }

  async function requireCart(){
    let stored=await getPrivateCart();
    if(!stored){
      setStatus('Choose your own original Celeste Classic .p8 cart. It stays only in this browser.');
      const saved=await pickAndStorePrivateCart();
      if(!saved)throw new Error('Preview cancelled because no original Celeste .p8 cart is stored.');
      stored=saved;
      window.dispatchEvent(new CustomEvent('celeste-private-cart-changed'));
    }
    return stored;
  }

  async function start(level){
    stop(false);if(!dialog.open)dialog.showModal();
    setStatus('Loading your browser-local original Celeste cartridge…');
    const [mod,stored]=await Promise.all([getFake08(),requireCart()]);Module=mod;cartName=stored.name||'celeste.p8';
    const patched=patchOriginalCelesteCart(stored.text,level);
    cartBytes=new TextEncoder().encode(patched);loadCart(Module,cartBytes);
    fbPtr=Module._f08_get_framebuffer_ptr();if(!fbPtr)throw new Error('Fake-08 did not expose a PICO-8 framebuffer');
    if(!palettePtr)palettePtr=Module._malloc(64);
    const fps=Module._f08_get_target_fps?.()||30;frameMs=1000/(fps>0?fps:30);
    held=0;pressed=0;grab=false;accum=0;last=performance.now();running=true;
    const warnings=privatePreviewWarnings(level);
    setStatus(`Running ${cartName} in Fake-08 @ ${Math.round(1000/frameMs)} Hz · ORIGINAL CART PHYSICS · Z jump · X dash · C climb · R restart${warnings.length?' · '+warnings[0]:''}`);
    Module._f08_set_inputs(0,0,0,0,0);Module._f08_step_frame();renderFrame();raf=requestAnimationFrame(loop);
  }

  function stop(closeDialog=true){running=false;cancelAnimationFrame(raf);raf=0;held=0;pressed=0;grab=false;if(closeDialog&&dialog.open)dialog.close();}
  return {start,stop,get running(){return running;}};
}
