const DB_NAME='celeste-studio-private-v1';
const STORE='vault';
const CART_KEY='original-celeste-p8';

function openDb(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('IndexedDB is unavailable. Run Studio through localhost or HTTPS in a normal browser.'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open private cart storage'));
    req.onblocked=()=>reject(new Error('Private cart storage is blocked by another open Studio tab.'));
  });
}

async function tx(mode,operation){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    let result;
    const t=db.transaction(STORE,mode),store=t.objectStore(STORE);
    t.oncomplete=()=>{db.close();resolve(result);};
    t.onabort=()=>{const err=t.error||new Error('Private cart storage transaction was aborted');db.close();reject(err);};
    t.onerror=()=>{}; // onabort carries the transaction error.
    try{
      const req=operation(store);
      if(req){
        req.onsuccess=()=>{result=req.result;};
        req.onerror=()=>{try{t.abort();}catch{};};
      }
    }catch(err){try{t.abort();}catch{};db.close();reject(err);}
  });
}

export function validateOriginalCelesteCart(text){
  const s=String(text||'').replace(/^\ufeff/,'').replace(/\r\n?/g,'\n');
  if(!/^pico-8 cartridge\b/im.test(s))throw new Error('That file is not a text PICO-8 .p8 cartridge.');
  const required=['__lua__','__gfx__','__gff__','__map__'];
  for(const marker of required)if(!s.toLowerCase().includes(marker))throw new Error(`That file is incomplete (missing ${marker}).`);
  const lower=s.toLowerCase(),luaStart=lower.indexOf('__lua__'),gfxStart=lower.indexOf('__gfx__');
  if(luaStart<0||gfxStart<=luaStart)throw new Error('That .p8 has an invalid Lua/graphics section order.');
  const lua=s.slice(luaStart+7,gfxStart);
  const anchors=['function load_room','function next_room','function draw_object','function init_object','function begin_game'];
  for(const a of anchors)if(!lua.includes(a))throw new Error(`That .p8 is not the compatible Celeste Classic cart layout Studio expects (missing ${a}).`);
  if(!/player\s*=\s*\{/.test(lua))throw new Error('That .p8 does not expose the expected Celeste player table.');
  return s;
}

export async function getPrivateCart(){
  try{return await tx('readonly',s=>s.get(CART_KEY))||null;}catch{return null;}
}

export async function getPrivateCartInfo(){
  const v=await getPrivateCart();
  return v?{name:v.name||'celeste.p8',savedAt:v.savedAt||0,bytes:new Blob([v.text]).size}:null;
}

export async function storePrivateCartFile(file){
  if(!file)throw new Error('No cartridge selected.');
  if(!/\.p8$/i.test(file.name||''))throw new Error('Use the text Celeste cartridge (.p8). .p8.png carts are compressed and are intentionally not stored or patched by Studio.');
  const text=validateOriginalCelesteCart(await file.text());
  const value={name:file.name||'celeste.p8',text,savedAt:Date.now()};
  await tx('readwrite',s=>s.put(value,CART_KEY));
  return value;
}

export async function pickAndStorePrivateCart(){
  return new Promise((resolve,reject)=>{
    const input=document.createElement('input');input.type='file';input.accept='.p8,text/plain';
    input.onchange=async()=>{
      try{if(!input.files?.[0])return resolve(null);resolve(await storePrivateCartFile(input.files[0]));}
      catch(err){reject(err);}
    };
    input.click();
  });
}

export async function clearPrivateCart(){await tx('readwrite',s=>s.delete(CART_KEY));}
