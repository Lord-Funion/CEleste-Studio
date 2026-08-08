const DB_NAME='celeste-studio-private-v1';
const STORE='vault';
const CART_KEY='original-celeste-p8';

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open private cart storage'));
  });
}

function tx(mode,fn){
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,mode),s=t.objectStore(STORE);
    let req;
    try{req=fn(s);}catch(err){db.close();reject(err);return;}
    if(req){req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}
    else{t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);}
    t.oncomplete=()=>db.close();
  }));
}

export function validateOriginalCelesteCart(text){
  const s=String(text||'').replace(/\r\n?/g,'\n');
  const required=['pico-8 cartridge','__lua__','__gfx__','__gff__','__map__'];
  for(const marker of required)if(!s.toLowerCase().includes(marker.toLowerCase()))throw new Error(`That file is not a complete text .p8 cartridge (missing ${marker}).`);
  const lua=s.slice(s.indexOf('__lua__')+7,s.indexOf('__gfx__'));
  const anchors=['function load_room','function next_room','function draw_object','player'];
  for(const a of anchors)if(!lua.includes(a))throw new Error('That .p8 does not look like the original Celeste Classic cartridge Studio knows how to patch.');
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
  if(!/\.p8$/i.test(file.name||''))throw new Error('Use the text Celeste cartridge (.p8). .p8.png carts are compressed and are not patched by Studio.');
  const text=validateOriginalCelesteCart(await file.text());
  const value={name:file.name||'celeste.p8',text,savedAt:Date.now()};
  await tx('readwrite',s=>s.put(value,CART_KEY));
  return value;
}

export async function pickAndStorePrivateCart(){
  return new Promise((resolve,reject)=>{
    const input=document.createElement('input');
    input.type='file';input.accept='.p8,text/plain';
    input.onchange=async()=>{
      try{if(!input.files?.[0])return resolve(null);resolve(await storePrivateCartFile(input.files[0]));}
      catch(err){reject(err);}
    };
    input.click();
  });
}

export async function clearPrivateCart(){
  await tx('readwrite',s=>s.delete(CART_KEY));
}
