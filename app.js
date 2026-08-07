import {
  fnv1a, exportLevel8xv, exportPack8xv, import8xv, validateLevel, validatePack,
  encodeLevelPayload, encodePackPayload, makeVarName
} from './lib/format.mjs';

const TILE_SIZE = 8;
const ENTITY_TYPES = new Set([1,8,11,12,18,20,22,23,26,28,64,86,96,118]);
const paletteItems = [
  {id:0,name:'Empty',color:'#090811'},
  {id:32,name:'Ground A',color:'#6d586f'}, {id:33,name:'Ground B',color:'#79627d'},
  {id:34,name:'Ground C',color:'#856d89'}, {id:35,name:'Ground D',color:'#927895'},
  {id:36,name:'Ground E',color:'#9d84a0'}, {id:37,name:'Ground F',color:'#a88eaa'},
  {id:66,name:'Ice A',color:'#7ee5ef'}, {id:67,name:'Ice B',color:'#8dedf4'},
  {id:68,name:'Ice C',color:'#a1f1f6'}, {id:69,name:'Ice D',color:'#b4f5f8'},
  {id:17,name:'Spikes up',color:'#cfd7e7'}, {id:27,name:'Spikes down',color:'#cfd7e7'},
  {id:43,name:'Spikes left',color:'#cfd7e7'}, {id:59,name:'Spikes right',color:'#cfd7e7'},
  {id:1,name:'Player spawn',color:'#ff557f',special:'spawn'},
  {id:118,name:'Summit flag',color:'#80e78b',entity:true}, {id:18,name:'Spring',color:'#e54b67',entity:true},
  {id:22,name:'Dash balloon',color:'#79d8f5',entity:true}, {id:23,name:'Falling floor',color:'#e7ba62',entity:true},
  {id:26,name:'Strawberry',color:'#f44762',entity:true}, {id:28,name:'Flying berry',color:'#ff7790',entity:true},
  {id:64,name:'Fake wall',color:'#5f4564',entity:true}, {id:8,name:'Key',color:'#ffe66b',entity:true},
  {id:20,name:'Chest',color:'#ce9250',entity:true}, {id:11,name:'Platform left',color:'#a989d2',entity:true},
  {id:12,name:'Platform right',color:'#bba2e8',entity:true}, {id:86,name:'Message',color:'#e7e4ff',entity:true},
  {id:96,name:'Big chest',color:'#d9a766',entity:true}
];
const paletteById = new Map(paletteItems.map(i => [i.id, i]));

// Celeste Classic / PICO-8 sprite atlas. The private repo sync workflow copies
// the same 128x64 atlas used by the calculator port into assets/.
const spriteAtlas = new Image();
let spriteAtlasReady = false;
spriteAtlas.decoding = 'async';
spriteAtlas.onload = () => { spriteAtlasReady = true; renderPalette($('paletteSearch')?.value || ''); drawEditor(); if (preview.running) drawPreview(currentLevel().rooms[preview.room]); };
spriteAtlas.onerror = () => { spriteAtlasReady = false; };
spriteAtlas.src = 'assets/pico8-atlas.png';

const TILE_MASK = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  4,2,0,0,0,0,0,0,0,0,0,2,0,0,0,0,
  3,3,3,3,3,3,3,3,4,4,4,2,2,0,0,0,
  3,3,3,3,3,3,3,3,4,4,4,2,2,2,2,2,
  0,0,19,19,19,19,2,2,3,2,2,2,2,2,2,2,
  0,0,19,19,19,19,2,2,4,2,2,2,2,2,2,2,
  0,0,19,19,19,19,0,4,4,2,2,2,2,2,2,2,
  0,0,19,19,19,19,0,0,0,2,2,2,2,2,2,2
];

function drawPicoSprite(target,id,dx,dy,size,flipX=false,flipY=false,alpha=1){
  if(!spriteAtlasReady || id < 0 || id > 127) return false;
  const sx=(id%16)*8, sy=Math.floor(id/16)*8;
  target.save(); target.globalAlpha=alpha; target.imageSmoothingEnabled=false;
  target.translate(dx+(flipX?size:0),dy+(flipY?size:0));
  target.scale(flipX?-1:1,flipY?-1:1);
  target.drawImage(spriteAtlas,sx,sy,8,8,0,0,size,size);
  target.restore(); return true;
}

const $ = id => document.getElementById(id);
const canvas = $('editorCanvas'), ctx = canvas.getContext('2d');
const previewCanvas = $('previewCanvas'), pctx = previewCanvas.getContext('2d');

function idFor(label) { return fnv1a(`${label}|${Date.now()}|${Math.random()}`); }
function blankRoom(label='Room') {
  const tiles = new Uint8Array(256);
  for (let x=0;x<16;x++) tiles[15*16+x]=37;
  for (let y=0;y<16;y++){ tiles[y*16]=37; tiles[y*16+15]=37; }
  return {id:idFor(label),width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,tiles,entities:[]};
}
function blankLevel(index=1) { return {id:idFor(`level-${index}`),title:`Level ${index}`,author:'Lord Funion',description:'',difficulty:2,rooms:[blankRoom()]}; }
function freshProject(){return {version:2,id:idFor('pack'),title:'My CEleste Pack',author:'Lord Funion',description:'',levels:[blankLevel(1)],activeLevel:0,activeRoom:0};}

let project = loadAutosave() || freshProject();
let tool='pencil', selected=37, specialMode=null, pointerDown=false, lastCell=-1;
let history=[], future=[];
let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,won:false,raf:0,lastTime:0,accum:0,entities:[]};

function currentLevel(){return project.levels[project.activeLevel];}
function currentRoom(){return currentLevel().rooms[project.activeRoom];}
function serializableProject(){return JSON.parse(JSON.stringify(project,(k,v)=>v instanceof Uint8Array?Array.from(v):v));}
function migrateLegacyTerrain(level,force=false){
  const legacy=new Map([[2,32],[3,33],[4,66],[5,67]]);
  let hasLegacy=false,hasModern=false;
  for(const room of level.rooms||[]){
    const tiles=room.tiles instanceof Uint8Array?room.tiles:Uint8Array.from(room.tiles||[]);
    room.tiles=tiles;
    for(const id of tiles){if(legacy.has(id))hasLegacy=true;if((id>=32&&id<=39)||(id>=48&&id<=55)||(id>=66&&id<=69))hasModern=true;}
  }
  if(force||(hasLegacy&&!hasModern)) for(const room of level.rooms||[]) for(let i=0;i<room.tiles.length;i++) if(legacy.has(room.tiles[i])) room.tiles[i]=legacy.get(room.tiles[i]);
  return level;
}
function reviveProject(raw){
  if(!raw?.levels?.length) throw new Error('Project contains no levels');
  const migrate=(raw.version||1)<2;
  for(const level of raw.levels)migrateLegacyTerrain(level,migrate);
  raw.version=2;
  raw.activeLevel=Math.min(raw.activeLevel||0,raw.levels.length-1); raw.activeRoom=Math.min(raw.activeRoom||0,raw.levels[raw.activeLevel].rooms.length-1); return raw;
}
function snapshot(){return serializableProject();}
function pushHistory(){history.push(snapshot());if(history.length>100)history.shift();future=[];updateUndoButtons();}
function restore(s){project=reviveProject(structuredClone(s));renderAll();autosave();}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());}
function updateUndoButtons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function autosave(){localStorage.setItem('celeste-studio-autosave',JSON.stringify(serializableProject()));}
function loadAutosave(){try{const v=localStorage.getItem('celeste-studio-autosave');return v?reviveProject(JSON.parse(v)):null}catch{return null}}
function commit(){autosave();renderLists();updateSize();}

function renderAll(){syncInputs();renderLists();renderPalette();resizeCanvas();drawEditor();updateSize();updateUndoButtons();}
function syncInputs(){
  $('packTitle').value=project.title;$('packAuthor').value=project.author;$('packDescription').value=project.description;
  const level=currentLevel();$('levelTitle').value=level.title;$('levelAuthor').value=level.author;$('levelDescription').value=level.description;$('levelDifficulty').value=level.difficulty;
}
function renderLists(){
  $('levelList').innerHTML=''; project.levels.forEach((level,i)=>{
    const row=document.createElement('div');row.className='list-item'+(i===project.activeLevel?' active':'');
    const b=document.createElement('button');b.textContent=`${i+1}. ${level.title}`;b.onclick=()=>{project.activeLevel=i;project.activeRoom=0;renderAll();};
    const up=document.createElement('button');up.className='mini';up.textContent='↑';up.disabled=i===0;up.onclick=()=>moveLevel(i,-1);
    const down=document.createElement('button');down.className='mini';down.textContent='↓';down.disabled=i===project.levels.length-1;down.onclick=()=>moveLevel(i,1);
    row.append(b,up,down);$('levelList').append(row);
  });
  $('roomList').innerHTML=''; currentLevel().rooms.forEach((room,i)=>{
    const row=document.createElement('div');row.className='list-item'+(i===project.activeRoom?' active':'');
    const b=document.createElement('button');b.textContent=`Room ${i+1}`;b.onclick=()=>{project.activeRoom=i;renderAll();};row.append(b);$('roomList').append(row);
  });
}
function moveLevel(i,d){const n=i+d;if(n<0||n>=project.levels.length)return;pushHistory();[project.levels[i],project.levels[n]]=[project.levels[n],project.levels[i]];project.activeLevel=n;commit();renderAll();}

function renderPalette(filter=''){
  $('palette').innerHTML='';filter=filter.trim().toLowerCase();
  for(const item of paletteItems){if(filter&&!`${item.name} ${item.id}`.toLowerCase().includes(filter))continue;
    const b=document.createElement('button');b.className='palette-item'+(selected===item.id&&!specialMode?' active':'');b.title=`PICO-8 sprite/tile ${item.id}`;
    const icon=document.createElement('canvas');icon.width=24;icon.height=24;icon.className='sprite-swatch';
    const ictx=icon.getContext('2d');ictx.imageSmoothingEnabled=false;
    if(!drawPicoSprite(ictx,item.id,0,0,24)){ictx.fillStyle=item.color;ictx.fillRect(0,0,24,24)}
    b.append(icon,document.createTextNode(item.name));
    b.onclick=()=>{selected=item.id;specialMode=item.special||null;if(!item.special)tool='pencil';renderPalette($('paletteSearch').value);updateToolButtons();};$('palette').append(b);
  }
}
function updateToolButtons(){for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool&&!specialMode);}
function resizeCanvas(){const z=Number($('zoom').value);canvas.width=128*z;canvas.height=128*z;canvas.style.width=`${128*z}px`;canvas.style.height=`${128*z}px`;ctx.imageSmoothingEnabled=false;}
function tileColor(id){return paletteById.get(id)?.color||`hsl(${(id*47)%360} 35% 48%)`;}
function drawEditor(){
  const room=currentRoom(),scale=Number($('zoom').value),cell=TILE_SIZE*scale;ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const id=room.tiles[y*16+x]; if(!id) continue;
    if(!drawPicoSprite(ctx,id,x*cell,y*cell,cell)){ctx.fillStyle=tileColor(id);ctx.fillRect(x*cell,y*cell,cell,cell)}
  }
  for(const e of room.entities){
    if(!drawPicoSprite(ctx,e.type,e.x*cell,e.y*cell,cell)){ctx.fillStyle=tileColor(e.type);ctx.fillRect(e.x*cell,e.y*cell,cell,cell)}
  }
  // Spawn is editor metadata. Rooms advance only when the player exits through the top.
  drawPicoSprite(ctx,1,room.spawnX*cell,room.spawnY*cell,cell,false,false,.72);
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border');ctx.lineWidth=1;
  for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*cell+.5,0);ctx.lineTo(i*cell+.5,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell+.5);ctx.lineTo(canvas.width,i*cell+.5);ctx.stroke();}
}
function drawMarker(x,y,text,color,cell){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x*cell+cell/2,y*cell+cell/2,Math.max(5,cell*.28),0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.max(9,cell*.38)}px sans-serif`;ctx.fillText(text,x*cell+cell/2,y*cell+cell/2);ctx.textAlign='start';ctx.textBaseline='alphabetic';}
function cellAt(event){const rect=canvas.getBoundingClientRect();const x=Math.floor((event.clientX-rect.left)/rect.width*16),y=Math.floor((event.clientY-rect.top)/rect.height*16);return{x:Math.max(0,Math.min(15,x)),y:Math.max(0,Math.min(15,y)),index:y*16+x};}
function applyAt(x,y,index,forceErase=false){
  const room=currentRoom();
  if(specialMode==='spawn'){room.spawnX=x;room.spawnY=y;specialMode=null;renderPalette($('paletteSearch').value);return true}
  const effective=forceErase?'eraser':tool;
  if(effective==='eyedropper'){const e=room.entities.find(v=>v.x===x&&v.y===y);selected=e?.type??room.tiles[index];tool='pencil';renderPalette($('paletteSearch').value);updateToolButtons();return false}
  if(effective==='fill'){const from=room.tiles[index],to=selected;if(from===to)return false;const q=[index],seen=new Set(q);while(q.length){const p=q.pop();room.tiles[p]=to;const px=p%16,py=Math.floor(p/16);for(const n of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){if(n[0]>=0&&n[0]<16&&n[1]>=0&&n[1]<16){const ni=n[1]*16+n[0];if(!seen.has(ni)&&room.tiles[ni]===from){seen.add(ni);q.push(ni)}}}}return true}
  if(effective==='eraser'||selected===0){const before=room.tiles[index]!==0||room.entities.some(e=>e.x===x&&e.y===y);room.tiles[index]=0;room.entities=room.entities.filter(e=>e.x!==x||e.y!==y);return before}
  if(ENTITY_TYPES.has(selected)){const old=room.entities.find(e=>e.x===x&&e.y===y);if(old?.type===selected)return false;room.entities=room.entities.filter(e=>e.x!==x||e.y!==y);room.entities.push({type:selected,x,y,flags:0});return true}
  if(room.tiles[index]===selected)return false;room.tiles[index]=selected;return true;
}

canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointerDown=true;lastCell=-1;pushHistory();const c=cellAt(e);if(applyAt(c.x,c.y,c.index,e.button===2)){drawEditor();commit();}lastCell=c.index;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{const c=cellAt(e);$('cursorStatus').textContent=`x ${c.x}, y ${c.y}`;if(pointerDown&&c.index!==lastCell&&(tool==='pencil'||tool==='eraser')){if(applyAt(c.x,c.y,c.index,e.buttons===2)){drawEditor();commit();}lastCell=c.index;}});
canvas.addEventListener('pointerup',()=>pointerDown=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());

function bindText(id,key,level=false,number=false){$(id).addEventListener('change',()=>{pushHistory();const target=level?currentLevel():project;target[key]=number?Number($(id).value):$(id).value;commit();renderLists();updateSize();});}
bindText('packTitle','title');bindText('packAuthor','author');bindText('packDescription','description');bindText('levelTitle','title',true);bindText('levelAuthor','author',true);bindText('levelDescription','description',true);bindText('levelDifficulty','difficulty',true,true);
$('paletteSearch').oninput=()=>renderPalette($('paletteSearch').value);$('zoom').oninput=()=>{resizeCanvas();drawEditor();};
$('toolButtons').addEventListener('click',e=>{if(e.target.dataset.tool){tool=e.target.dataset.tool;specialMode=null;updateToolButtons();renderPalette($('paletteSearch').value);}});
$('undo').onclick=undo;$('redo').onclick=redo;
$('setSpawn').onclick=()=>{specialMode='spawn';selected=1;renderPalette($('paletteSearch').value)};
$('addLevel').onclick=()=>{pushHistory();project.levels.push(blankLevel(project.levels.length+1));project.activeLevel=project.levels.length-1;project.activeRoom=0;commit();renderAll();};
$('addRoom').onclick=()=>{pushHistory();currentLevel().rooms.push(blankRoom());project.activeRoom=currentLevel().rooms.length-1;commit();renderAll();};
$('duplicateRoom').onclick=()=>{pushHistory();const r=currentRoom();const copy={...structuredClone(r),id:idFor('room-copy'),tiles:r.tiles.slice()};currentLevel().rooms.splice(project.activeRoom+1,0,copy);project.activeRoom++;commit();renderAll();};
$('deleteRoom').onclick=()=>{if(currentLevel().rooms.length===1)return showMessage('Cannot delete room','Every level must contain at least one room.');pushHistory();currentLevel().rooms.splice(project.activeRoom,1);project.activeRoom=Math.max(0,project.activeRoom-1);commit();renderAll();};
function moveRoom(d){const rooms=currentLevel().rooms,i=project.activeRoom,n=i+d;if(n<0||n>=rooms.length)return;pushHistory();[rooms[i],rooms[n]]=[rooms[n],rooms[i]];project.activeRoom=n;commit();renderAll();}
$('moveRoomUp').onclick=()=>moveRoom(-1);$('moveRoomDown').onclick=()=>moveRoom(1);

$('newProject').onclick=()=>{if(confirm('Create a new project? The current autosave will be replaced.')){pushHistory();project=freshProject();history=[];future=[];commit();renderAll();}};
$('saveProject').onclick=()=>download(new TextEncoder().encode(JSON.stringify(serializableProject(),null,2)),`${safeFile(project.title)}.celproj`,'application/json');
$('openProject').onchange=async e=>{try{const raw=JSON.parse(await e.target.files[0].text());pushHistory();project=reviveProject(raw);commit();renderAll();showMessage('Project opened',`${project.levels.length} level(s) loaded.`)}catch(err){showMessage('Could not open project',err.message)}e.target.value='';};
$('import8xv').onchange=async e=>{let count=0;const failures=[];pushHistory();for(const file of e.target.files){try{const imported=import8xv(new Uint8Array(await file.arrayBuffer()));if(imported.data.kind==='level'){project.levels.push(migrateLegacyTerrain(imported.data));count++}else{project.title=imported.data.title;project.author=imported.data.author;project.description=imported.data.description;project.levels.push(...imported.data.levels.map(level=>migrateLegacyTerrain(level)));count+=imported.data.levels.length}}catch(err){failures.push(`${file.name}: ${err.message}`)}}if(project.levels.length>1&&project.levels[0].title==='Level 1'&&isBlank(project.levels[0]))project.levels.shift();project.activeLevel=Math.max(0,project.levels.length-count);project.activeRoom=0;commit();renderAll();showMessage('Import complete',`${count} level(s) imported.${failures.length?'\n\nFailed:\n'+failures.join('\n'):''}`);e.target.value='';};
function isBlank(level){return level.rooms.length===1&&level.rooms[0].entities.length===0;}
$('exportLevel').onclick=()=>{const level=currentLevel(),v=validateLevel(level);if(!v.valid)return showValidation(v);const name=makeVarName(level,'level');download(exportLevel8xv(level,{name}),`${name}.8xv`,'application/octet-stream');showMessage('Level exported',`${level.title}\nVariable: ${name}\nThe file is ready for TI Connect CE.`)};
$('exportPack').onclick=()=>{const v=validatePack(project);if(!v.valid)return showValidation(v);try{const name=makeVarName(project,'pack');download(exportPack8xv(project,{name}),`${name}.8xv`,'application/octet-stream');showMessage('Pack exported',`${project.levels.length} levels\nVariable: ${name}`)}catch(err){showMessage('Pack export failed',`${err.message}\nExport individual levels or split the pack.`)}};
$('validate').onclick=()=>showValidation(validatePack(project));
$('themeButton').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';drawEditor();};

function showValidation(result){const box=$('validation');box.innerHTML='';if(result.valid&&!result.warnings.length){box.innerHTML='<p class="ok">No errors or warnings.</p>';return}if(result.errors.length){const h=document.createElement('p');h.className='error';h.textContent=`${result.errors.length} error(s)`;box.append(h,list(result.errors,'error'))}if(result.warnings.length){const h=document.createElement('p');h.className='warning';h.textContent=`${result.warnings.length} warning(s)`;box.append(h,list(result.warnings,'warning'))}if(result.valid)showMessage('Validation passed',result.warnings.length?'The pack is valid, with warnings shown in the sidebar.':'The pack is valid.');}
function list(items,cls){const ul=document.createElement('ul');for(const t of items){const li=document.createElement('li');li.className=cls;li.textContent=t;ul.append(li)}return ul;}
function updateSize(){try{const l=encodeLevelPayload(currentLevel()).length,p=encodePackPayload(project).length;$('sizeStatus').textContent=`Level ${l.toLocaleString()} B · Pack ${p.toLocaleString()} B`;}catch(err){$('sizeStatus').textContent=err.message;}}
function download(bytes,name,type){const blob=new Blob([bytes],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeFile(s){return String(s||'celeste-project').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,60)||'celeste-project';}
function showMessage(title,body){$('messageTitle').textContent=title;$('messageBody').textContent=body;$('messageDialog').showModal();}
$('messageClose').onclick=()=>$('messageDialog').close();

window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}const map={b:'pencil',e:'eraser',f:'fill',i:'eyedropper'};if(map[e.key.toLowerCase()]){tool=map[e.key.toLowerCase()];specialMode=null;updateToolButtons();renderPalette($('paletteSearch').value)}});

// PICO-8-faithful preview core. Constants and collision rules mirror the
// original Celeste Classic source used by the calculator port (30 Hz update).
$('previewButton').onclick=()=>startPreview();$('closePreview').onclick=()=>stopPreview();$('previewDialog').addEventListener('close',stopPreview);
function startPreview(){const validation=validateLevel(currentLevel());if(!validation.valid)return showValidation(validation);$('previewDialog').showModal();preview.running=true;preview.room=0;preview.lastTime=performance.now();preview.accum=0;resetPreview();previewLoop(preview.lastTime);}
function stopPreview(){preview.running=false;cancelAnimationFrame(preview.raf);preview.keys.clear();if($('previewDialog').open)$('previewDialog').close();}
function makePreviewEntities(room){return room.entities.map((e,i)=>({...e,_i:i,px:e.x*8,py:e.y*8,alive:true,timer:0,phase:0,baseX:e.x*8,baseY:e.y*8}));}
function resetPreview(){const r=currentLevel().rooms[preview.room];Object.assign(preview,{x:r.spawnX*8,y:r.spawnY*8,vx:0,vy:0,remX:0,remY:0,grace:0,jbuffer:0,djump:1,dashTime:0,dashEffectTime:0,dashTargetX:0,dashTargetY:0,dashAccelX:0,dashAccelY:0,pJump:false,pDash:false,flipX:false,sprite:1,sprOff:0,wasOnGround:false,won:false,deadFrames:0,entities:makePreviewEntities(r)});}
window.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;preview.keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright','z','x','r'].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='r')resetPreview();});
window.addEventListener('keyup',e=>preview.keys.delete(e.key.toLowerCase()));
const pbtn=k=>preview.keys.has(k);
const appr=(v,target,amount)=>v>target?Math.max(v-amount,target):Math.min(v+amount,target);
const sign=v=>v>0?1:v<0?-1:0;
function tileFlag(id,flag){return id>=0&&id<TILE_MASK.length&&(TILE_MASK[id]&(1<<flag))!==0;}
function tileAt(room,tx,ty){if(tx<0||tx>15||ty<0||ty>15)return 0;return room.tiles[ty*16+tx]||0;}
function tileFlagAt(room,x,y,w,h,flag){const x0=Math.max(0,Math.floor(x/8)),x1=Math.min(15,Math.floor((x+w-1)/8)),y0=Math.max(0,Math.floor(y/8)),y1=Math.min(15,Math.floor((y+h-1)/8));for(let tx=x0;tx<=x1;tx++)for(let ty=y0;ty<=y1;ty++)if(tileFlag(tileAt(room,tx,ty),flag))return true;return false;}
function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh){return ax+aw>bx&&ay+ah>by&&ax<bx+bw&&ay<by+bh;}
function entitySolidAt(x,y,w,h,oy=0){for(const e of preview.entities||[]){if(!e.alive)continue;if(e.type===64||e.type===23){if(rectsOverlap(x,y,w,h,e.px,e.py,8,8))return true;}if((e.type===11||e.type===12)&&oy>0){if(rectsOverlap(x,y,w,h,e.px,e.py,8,3))return true;}}return false;}
function solidAt(room,x,y,w,h,oy=0){return tileFlagAt(room,x,y,w,h,0)||entitySolidAt(x,y,w,h,oy);}
function iceAt(room,x,y,w,h){return tileFlagAt(room,x,y,w,h,4);}
function playerSolid(room,ox,oy){return solidAt(room,preview.x+1+ox,preview.y+3+oy,6,5,oy);}
function spikesAt(room,x,y,w,h,xspd,yspd){const x0=Math.max(0,Math.floor(x/8)),x1=Math.min(15,Math.floor((x+w-1)/8)),y0=Math.max(0,Math.floor(y/8)),y1=Math.min(15,Math.floor((y+h-1)/8));for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++){const tile=tileAt(room,i,j);if(tile===17&&(((y+h-1)%8)>=6||y+h===j*8+8)&&yspd>=0)return true;if(tile===27&&y%8<=2&&yspd<=0)return true;if(tile===43&&x%8<=2&&xspd<=0)return true;if(tile===59&&(((x+w-1)%8)>=6||x+w===i*8+8)&&xspd>=0)return true;}return false;}
function movePreviewX(room,amount){preview.remX+=amount;let pixels=Math.floor(preview.remX+.5);preview.remX-=pixels;const step=sign(pixels);for(let i=0;i<Math.abs(pixels);i++){if(!playerSolid(room,step,0))preview.x+=step;else{preview.vx=0;preview.remX=0;break;}}}
function movePreviewY(room,amount){preview.remY+=amount;let pixels=Math.floor(preview.remY+.5);preview.remY-=pixels;const step=sign(pixels);for(let i=0;i<Math.abs(pixels);i++){if(!playerSolid(room,0,step))preview.y+=step;else{preview.vy=0;preview.remY=0;break;}}}
function killPreview(){preview.deadFrames=15;preview.vx=preview.vy=0;}
function updatePreviewEntities(room){
  const px=preview.x+1,py=preview.y+3;
  for(const e of preview.entities){
    if(e.type===22){if(e.timer>0){e.timer--;if(e.timer===0)e.alive=true;}if(e.alive&&rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.djump=1;e.alive=false;e.timer=60;}}
    else if(e.type===18){if(e.timer>0)e.timer--;if(rectsOverlap(px,py,6,5,e.px,e.py,8,8)&&preview.vy>=0){preview.y=e.py-4;preview.vx/=5;preview.vy=-3;preview.djump=1;e.timer=10;}}
    else if(e.type===26||e.type===28||e.type===8){if(e.alive&&rectsOverlap(px,py,6,5,e.px,e.py,8,8))e.alive=false;}
    else if(e.type===11||e.type===12){const dir=e.type===11?-1:1;e.px+=dir*0.65;if(e.px<-8)e.px=128;if(e.px>128)e.px=-8;}
  }
}
function previewStep(){
  if(preview.won)return;const room=currentLevel().rooms[preview.room];
  if(preview.deadFrames>0){preview.deadFrames--;if(preview.deadFrames===0)resetPreview();return;}
  const input=pbtn('arrowright')?1:(pbtn('arrowleft')?-1:0);
  if(spikesAt(room,preview.x+1,preview.y+3,6,5,preview.vx,preview.vy)||preview.y>128){killPreview();return;}
  const onGround=playerSolid(room,0,1),onIce=iceAt(room,preview.x+1,preview.y+4,6,5);
  const jump=pbtn('z')&&!preview.pJump;preview.pJump=pbtn('z');if(jump)preview.jbuffer=4;else if(preview.jbuffer>0)preview.jbuffer--;
  const dash=pbtn('x')&&!preview.pDash;preview.pDash=pbtn('x');
  if(onGround){preview.grace=6;if(preview.djump<1)preview.djump=1;}else if(preview.grace>0)preview.grace--;
  preview.dashEffectTime--;
  if(preview.dashTime>0){preview.dashTime--;preview.vx=appr(preview.vx,preview.dashTargetX,preview.dashAccelX);preview.vy=appr(preview.vy,preview.dashTargetY,preview.dashAccelY);}else{
    const maxrun=1;let accel=onGround?0.6:0.4,deccel=0.15;if(onGround&&onIce)accel=0.05;
    preview.vx=Math.abs(preview.vx)>maxrun?appr(preview.vx,sign(preview.vx)*maxrun,deccel):appr(preview.vx,input*maxrun,accel);
    if(preview.vx!==0)preview.flipX=preview.vx<0;
    let maxfall=2,gravity=Math.abs(preview.vy)<=0.15?0.105:0.21;if(input!==0&&playerSolid(room,input,0)&&!iceAt(room,preview.x+1+input,preview.y+3,6,5))maxfall=0.4;if(!onGround)preview.vy=appr(preview.vy,maxfall,gravity);
    if(preview.jbuffer>0){if(preview.grace>0){preview.jbuffer=0;preview.grace=0;preview.vy=-2;}else{const wallDir=playerSolid(room,-3,0)?-1:(playerSolid(room,3,0)?1:0);if(wallDir){preview.jbuffer=0;preview.vy=-2;preview.vx=-wallDir*(maxrun+1);}}}
    if(preview.djump>0&&dash){preview.djump--;preview.dashTime=4;preview.dashEffectTime=10;const vi=pbtn('arrowup')?-1:(pbtn('arrowdown')?1:0),full=5,half=3.5355339059;if(input!==0){if(vi!==0){preview.vx=input*half;preview.vy=vi*half}else{preview.vx=input*full;preview.vy=0}}else if(vi!==0){preview.vx=0;preview.vy=vi*full}else{preview.vx=preview.flipX?-1:1;preview.vy=0}preview.dashTargetX=2*sign(preview.vx);preview.dashTargetY=2*sign(preview.vy);preview.dashAccelX=1.5;preview.dashAccelY=1.5;if(preview.vy<0)preview.dashTargetY*=.75;if(preview.vy!==0)preview.dashAccelX=1.0606601718;if(preview.vx!==0)preview.dashAccelY=10.606601718;}
  }
  preview.sprOff++;if(!onGround)preview.sprite=playerSolid(room,input,0)?5:3;else if(pbtn('arrowdown'))preview.sprite=6;else if(pbtn('arrowup'))preview.sprite=7;else if(preview.vx===0||(!pbtn('arrowleft')&&!pbtn('arrowright')))preview.sprite=1;else preview.sprite=1+(Math.floor(preview.sprOff/4)%4);
  preview.wasOnGround=onGround;movePreviewX(room,preview.vx);movePreviewY(room,preview.vy);preview.x=Math.max(-1,Math.min(121,preview.x));
  updatePreviewEntities(room);
  // Celeste Classic completes a room by leaving through the top edge.
  if(preview.y<-4){if(preview.room<currentLevel().rooms.length-1){preview.room++;resetPreview()}else preview.won=true;}
}
function previewLoop(now){if(!preview.running)return;preview.accum+=Math.min(100,now-preview.lastTime);preview.lastTime=now;while(preview.accum>=1000/30){previewStep();preview.accum-=1000/30;}drawPreview(currentLevel().rooms[preview.room]);preview.raf=requestAnimationFrame(previewLoop);}
function drawPreview(room){
  const scale=4;pctx.imageSmoothingEnabled=false;pctx.fillStyle='#000';pctx.fillRect(0,0,512,512);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const id=room.tiles[y*16+x];if(id&&!drawPicoSprite(pctx,id,x*32,y*32,32)){pctx.fillStyle=tileColor(id);pctx.fillRect(x*32,y*32,32,32)}}
  for(const e of preview.entities||[]){if(!e.alive&&e.type!==18)continue;const sprite=e.type===18&&e.timer>0?19:e.type;if(!drawPicoSprite(pctx,sprite,e.px*scale,e.py*scale,32)){pctx.fillStyle=tileColor(sprite);pctx.fillRect(e.px*scale,e.py*scale,32,32)}}
  if(!preview.deadFrames){drawPicoSprite(pctx,preview.sprite,preview.x*scale,preview.y*scale,32,preview.flipX,false) || (()=>{pctx.fillStyle='#f25b82';pctx.fillRect(preview.x*scale,preview.y*scale,28,32)})();}
  if(preview.deadFrames){pctx.fillStyle='rgba(255,0,77,.22)';pctx.fillRect(0,0,512,512);}
  $('previewStatus').textContent=preview.won?'Level complete!':`Room ${preview.room+1}/${currentLevel().rooms.length} · dash ${preview.djump?'ready':'used'} · PICO-8 physics @ 30 Hz`;
}

renderAll();
