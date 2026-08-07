import {
  fnv1a, exportLevel8xv, exportPack8xv, import8xv, validateLevel, validatePack,
  encodeLevelPayload, encodePackPayload, makeVarName
} from './lib/format.mjs';

const TILE_SIZE = 8;
const ENTITY_TYPES = new Set([8,11,12,18,20,22,23,26,28,64,86,96,118]);
const FRUIT_GATED_TYPES = new Set([20,26,28,64]);
const COMPOUND_COMPANIONS = new Set([70,71,87,97,112,113]);

// Exact PICO-8 sprite flags from Celeste Classic / CEleste. Bit 0 = solid,
// bit 1 = normal map layer, bit 2 = background, bit 3 = foreground,
// bit 4 = ice/slippery.
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

const LOGICAL_PIECES = [
  {id:0,name:'Empty',category:'Basic',description:'Erase terrain or leave a grid cell empty.',color:'#090811'},
  {id:1,name:'Player spawn',category:'Gameplay',special:'spawn',description:'Where Madeline spawns. Each room has exactly one spawn position.',color:'#ff557f'},
  {id:8,name:'Key',category:'Gameplay',entity:true,description:'Collecting the key unlocks every locked chest in the current room.',color:'#ffe66b'},
  {id:20,name:'Locked chest',category:'Gameplay',entity:true,description:'Original key puzzle chest. By default it releases a strawberry after the room key is collected.',options:'strawberry',color:'#ce9250'},
  {id:64,name:'Fake wall',category:'Gameplay',entity:true,description:'Complete 16×16 dash-breakable fake block. By default a strawberry is hidden inside.',options:'strawberry',compound:'fake-wall',color:'#5f4564'},
  {id:96,name:'Dash upgrade chest',category:'Gameplay',entity:true,description:'Complete 16×16 big chest. Opening it creates the orb that upgrades Madeline to two (or optionally three) dashes.',options:'dashes',compound:'big-chest',color:'#d9a766'},
  {id:18,name:'Spring',category:'Gameplay',entity:true,description:'Launches Madeline upward and refills dashes.',color:'#e54b67'},
  {id:22,name:'Dash balloon',category:'Gameplay',entity:true,description:'Refills all available dashes, disappears, then respawns.',compound:'balloon',color:'#79d8f5'},
  {id:23,name:'Falling floor',category:'Gameplay',entity:true,description:'Breaks after Madeline touches it, disappears temporarily, then respawns.',color:'#e7ba62'},
  {id:26,name:'Strawberry',category:'Gameplay',entity:true,description:'Normal collectible strawberry. Collection persists through room deaths/restarts.',color:'#f44762'},
  {id:28,name:'Flying strawberry',category:'Gameplay',entity:true,description:'Flies away after the first dash, just like Celeste Classic.',compound:'flying-berry',color:'#ff7790'},
  {id:11,name:'Moving platform ←',category:'Gameplay',entity:true,description:'Complete two-sprite moving platform travelling left. Rotate to reverse direction.',compound:'platform',color:'#a989d2'},
  {id:12,name:'Moving platform →',category:'Gameplay',entity:true,description:'Complete two-sprite moving platform travelling right. Rotate to reverse direction.',compound:'platform',color:'#bba2e8'},
  {id:86,name:'Memorial message',category:'Gameplay',entity:true,description:'Complete 2×2 Celeste memorial sign plus its original message interaction.',compound:'message',color:'#e7e4ff'},
  {id:118,name:'Summit flag',category:'Gameplay',entity:true,description:'Summit/results flag. It does NOT complete a custom room; climbing through the top does.',color:'#80e78b'}
];

function tileFlag(id,flag){return id>=0&&id<TILE_MASK.length&&(TILE_MASK[id]&(1<<flag))!==0;}
function rawCategory(id){
  if([17,27,43,59].includes(id))return 'Hazards';
  if(tileFlag(id,4))return 'Ice';
  if(tileFlag(id,0))return 'Terrain';
  if(tileFlag(id,2))return 'Background';
  return 'Decoration';
}
function rawName(id){
  const c=rawCategory(id);
  if(id===17)return 'Spikes ↑'; if(id===59)return 'Spikes →'; if(id===27)return 'Spikes ↓'; if(id===43)return 'Spikes ←';
  return `${c} ${id}`;
}
const rawPieces=[];
for(let id=1;id<128;id++){
  if(!TILE_MASK[id]||ENTITY_TYPES.has(id)||COMPOUND_COMPANIONS.has(id))continue;
  rawPieces.push({id,name:rawName(id),category:rawCategory(id),description:`Original Celeste Classic map tile ${id}. Collision/layer flags are preserved exactly.`,color:'#6d586f'});
}
const categoryOrder=['Basic','Terrain','Ice','Hazards','Gameplay','Background','Decoration'];
const paletteItems=[...LOGICAL_PIECES,...rawPieces].sort((a,b)=>categoryOrder.indexOf(a.category)-categoryOrder.indexOf(b.category)||a.id-b.id);
const paletteById=new Map(paletteItems.map(i=>[i.id,i]));

// Real rotations that have genuine Celeste Classic counterparts. We do not
// silently rotate art to a state the calculator runtime cannot reproduce.
const ROTATE_CW=new Map([
  [17,59],[59,27],[27,43],[43,17],
  [11,12],[12,11],
  [34,38],[38,50],[50,36],[36,34],
  [41,42],[42,58],[58,57],[57,41]
]);
function rotateId(id,clockwise=true){
  if(clockwise)return ROTATE_CW.get(id)??id;
  for(const [from,to] of ROTATE_CW)if(to===id)return from;
  return id;
}

// Celeste Classic / PICO-8 sprite atlas. The private repo carries the same
// 128×64 atlas used by the calculator build.
const spriteAtlas=new Image();
let spriteAtlasReady=false;
spriteAtlas.decoding='async';
spriteAtlas.onload=()=>{spriteAtlasReady=true;renderPalette();drawEditor();if(preview.running)drawPreview(currentLevel().rooms[preview.room]);};
spriteAtlas.onerror=()=>{spriteAtlasReady=false;};
spriteAtlas.src='assets/pico8-atlas.png';

function drawPicoSprite(target,id,dx,dy,size,flipX=false,flipY=false,alpha=1){
  if(!spriteAtlasReady||id<0||id>127)return false;
  const sx=(id%16)*8,sy=Math.floor(id/16)*8;
  target.save();target.globalAlpha=alpha;target.imageSmoothingEnabled=false;
  target.translate(dx+(flipX?size:0),dy+(flipY?size:0));target.scale(flipX?-1:1,flipY?-1:1);
  target.drawImage(spriteAtlas,sx,sy,8,8,0,0,size,size);target.restore();return true;
}
function drawLogicalPiece(target,id,dx,dy,cell,alpha=1){
  if(id===64){drawPicoSprite(target,64,dx,dy,cell,false,false,alpha);drawPicoSprite(target,65,dx+cell,dy,cell,false,false,alpha);drawPicoSprite(target,80,dx,dy+cell,cell,false,false,alpha);drawPicoSprite(target,81,dx+cell,dy+cell,cell,false,false,alpha);return true;}
  if(id===96){drawPicoSprite(target,96,dx,dy,cell,false,false,alpha);drawPicoSprite(target,97,dx+cell,dy,cell,false,false,alpha);drawPicoSprite(target,112,dx,dy+cell,cell,false,false,alpha);drawPicoSprite(target,113,dx+cell,dy+cell,cell,false,false,alpha);return true;}
  if(id===86){drawPicoSprite(target,70,dx,dy-cell,cell,false,false,alpha);drawPicoSprite(target,71,dx+cell,dy-cell,cell,false,false,alpha);drawPicoSprite(target,86,dx,dy,cell,false,false,alpha);drawPicoSprite(target,87,dx+cell,dy,cell,false,false,alpha);return true;}
  if(id===11||id===12){drawPicoSprite(target,11,dx-cell/2,dy-cell/8,cell,false,false,alpha);drawPicoSprite(target,12,dx+cell/2,dy-cell/8,cell,false,false,alpha);return true;}
  if(id===28){drawPicoSprite(target,45,dx-cell*.75,dy-cell*.25,cell,false,false,alpha);drawPicoSprite(target,28,dx,dy,cell,false,false,alpha);drawPicoSprite(target,45,dx+cell*.75,dy-cell*.25,cell,true,false,alpha);return true;}
  if(id===22){drawPicoSprite(target,13,dx,dy+cell*.75,cell,false,false,alpha);drawPicoSprite(target,22,dx,dy,cell,false,false,alpha);return true;}
  return drawPicoSprite(target,id,dx,dy,cell,false,false,alpha);
}
function drawPaletteIcon(target,item){
  target.clearRect(0,0,34,34);target.imageSmoothingEnabled=false;
  const id=item.id;
  if(id===64||id===96){drawLogicalPiece(target,id,3,3,14);return;}
  if(id===86){drawLogicalPiece(target,id,3,17,14);return;}
  if(id===11||id===12){drawPicoSprite(target,11,3,10,14);drawPicoSprite(target,12,17,10,14);return;}
  if(id===28){drawPicoSprite(target,45,1,10,12);drawPicoSprite(target,28,11,9,16);drawPicoSprite(target,45,23,10,12,true);return;}
  if(id===22){drawPicoSprite(target,13,11,18,12);drawPicoSprite(target,22,9,4,16);return;}
  if(!drawPicoSprite(target,id,5,5,24)){target.fillStyle=item.color||'#777';target.fillRect(5,5,24,24);}
}

const $=id=>document.getElementById(id);
const canvas=$('editorCanvas'),ctx=canvas.getContext('2d');
const previewCanvas=$('previewCanvas'),pctx=previewCanvas.getContext('2d');

function idFor(label){return fnv1a(`${label}|${Date.now()}|${Math.random()}`);}
function blankRoom(label='Room'){
  const tiles=new Uint8Array(256);
  for(let x=0;x<16;x++)tiles[15*16+x]=37;
  for(let y=0;y<16;y++){tiles[y*16]=37;tiles[y*16+15]=37;}
  return{id:idFor(label),width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,tiles,entities:[]};
}
function blankLevel(index=1){return{id:idFor(`level-${index}`),title:`Level ${index}`,author:'Lord Funion',description:'',difficulty:2,rooms:[blankRoom()]};}
function freshProject(){return{version:3,id:idFor('pack'),title:'My CEleste Pack',author:'Lord Funion',description:'',levels:[blankLevel(1)],activeLevel:0,activeRoom:0};}

let project=loadAutosave()||freshProject();
let tool='pencil',selected=37,specialMode=null,placementFlags=0,pointerDown=false,lastCell=-1;
let history=[],future=[];
let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,won:false,raf:0,lastTime:0,accum:0,maxDashes:1,collectedSources:new Set(),entities:[]};

function currentLevel(){return project.levels[project.activeLevel];}
function currentRoom(){return currentLevel().rooms[project.activeRoom];}
function serializableProject(){return JSON.parse(JSON.stringify(project,(k,v)=>v instanceof Uint8Array?Array.from(v):v));}
function migrateLegacyTerrain(level,force=false){
  const legacy=new Map([[2,32],[3,33],[4,66],[5,67]]);let hasLegacy=false,hasModern=false;
  for(const room of level.rooms||[]){room.tiles=room.tiles instanceof Uint8Array?room.tiles:Uint8Array.from(room.tiles||[]);for(const id of room.tiles){if(legacy.has(id))hasLegacy=true;if((id>=32&&id<=55)||(id>=66&&id<=69))hasModern=true;}}
  if(force||(hasLegacy&&!hasModern))for(const room of level.rooms||[])for(let i=0;i<room.tiles.length;i++)if(legacy.has(room.tiles[i]))room.tiles[i]=legacy.get(room.tiles[i]);
  return level;
}
function migrateLegacyEntities(level){
  for(const room of level.rooms||[]){
    room.entities=room.entities||[];const occupied=new Set(room.entities.map(e=>`${e.x},${e.y}`));
    for(let i=0;i<room.tiles.length;i++){
      const id=room.tiles[i],x=i%16,y=Math.floor(i/16);
      if(id===1){room.spawnX=x;room.spawnY=y;room.tiles[i]=0;continue;}
      if(ENTITY_TYPES.has(id)){
        if(!occupied.has(`${x},${y}`)){room.entities.push({type:id,x,y,flags:0});occupied.add(`${x},${y}`);}
        room.tiles[i]=0;
      }
    }
  }
  return level;
}
function reviveProject(raw){
  if(!raw?.levels?.length)throw new Error('Project contains no levels');
  const migrate=(raw.version||1)<2;
  for(const level of raw.levels){migrateLegacyTerrain(level,migrate);migrateLegacyEntities(level);for(const room of level.rooms){room.entities=(room.entities||[]).map(e=>({...e,flags:e.flags??0}));}}
  raw.version=3;raw.activeLevel=Math.min(raw.activeLevel||0,raw.levels.length-1);raw.activeRoom=Math.min(raw.activeRoom||0,raw.levels[raw.activeLevel].rooms.length-1);return raw;
}
function snapshot(){return serializableProject();}
function pushHistory(){history.push(snapshot());if(history.length>100)history.shift();future=[];updateUndoButtons();}
function restore(s){project=reviveProject(structuredClone(s));renderAll();autosave();}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());}
function updateUndoButtons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function autosave(){localStorage.setItem('celeste-studio-autosave',JSON.stringify(serializableProject()));}
function loadAutosave(){try{const v=localStorage.getItem('celeste-studio-autosave');return v?reviveProject(JSON.parse(v)):null}catch{return null;}}
function commit(){autosave();renderLists();updateSize();}

function renderAll(){syncInputs();renderLists();renderPalette();renderInspector();resizeCanvas();drawEditor();updateSize();updateUndoButtons();}
function syncInputs(){
  $('packTitle').value=project.title;$('packAuthor').value=project.author;$('packDescription').value=project.description;
  const level=currentLevel();$('levelTitle').value=level.title;$('levelAuthor').value=level.author;$('levelDescription').value=level.description;$('levelDifficulty').value=level.difficulty;
}
function renderLists(){
  $('levelList').innerHTML='';project.levels.forEach((level,i)=>{const row=document.createElement('div');row.className='list-item'+(i===project.activeLevel?' active':'');const b=document.createElement('button');b.textContent=`${i+1}. ${level.title}`;b.onclick=()=>{project.activeLevel=i;project.activeRoom=0;renderAll();};const up=document.createElement('button');up.className='mini';up.textContent='↑';up.disabled=i===0;up.onclick=()=>moveLevel(i,-1);const down=document.createElement('button');down.className='mini';down.textContent='↓';down.disabled=i===project.levels.length-1;down.onclick=()=>moveLevel(i,1);row.append(b,up,down);$('levelList').append(row);});
  $('roomList').innerHTML='';currentLevel().rooms.forEach((room,i)=>{const row=document.createElement('div');row.className='list-item'+(i===project.activeRoom?' active':'');const b=document.createElement('button');b.textContent=`Room ${i+1}`;b.onclick=()=>{project.activeRoom=i;renderAll();};row.append(b);$('roomList').append(row);});
}
function moveLevel(i,d){const n=i+d;if(n<0||n>=project.levels.length)return;pushHistory();[project.levels[i],project.levels[n]]=[project.levels[n],project.levels[i]];project.activeLevel=n;commit();renderAll();}

function selectPiece(id,flags=0){selected=id;placementFlags=flags;specialMode=paletteById.get(id)?.special||null;if(!specialMode)tool='pencil';renderPalette();renderInspector();updateToolButtons();}
function renderPalette(){
  const filter=($('paletteSearch').value||'').trim().toLowerCase(),category=$('paletteCategory').value;
  $('palette').innerHTML='';
  for(const item of paletteItems){
    if(category!=='All'&&item.category!==category)continue;
    if(filter&&!`${item.name} ${item.id} ${item.category}`.toLowerCase().includes(filter))continue;
    const b=document.createElement('button');b.className='palette-item'+(selected===item.id?' active':'');b.title=`${item.name} · PICO-8 ID ${item.id}`;
    const icon=document.createElement('canvas');icon.width=34;icon.height=34;icon.className='sprite-swatch';drawPaletteIcon(icon.getContext('2d'),item);
    const label=document.createElement('span');label.textContent=item.name;b.append(icon,label);b.onclick=()=>selectPiece(item.id,0);$('palette').append(b);
  }
}
function renderInspector(){
  const item=paletteById.get(selected)||{name:`Tile ${selected}`,description:'Imported PICO-8 tile.',category:'Unknown'};
  $('pieceName').textContent=item.name;$('pieceMeta').textContent=`${item.category} · ID ${item.id}`;$('pieceDescription').textContent=item.description||'';
  const canRotate=rotateId(selected,true)!==selected;$('rotateCW').disabled=!canRotate;$('rotateCCW').disabled=!canRotate;
  const opts=$('pieceOptions');opts.innerHTML='';
  if(item.options==='strawberry'){
    const label=document.createElement('label');label.className='option-row';const cb=document.createElement('input');cb.type='checkbox';cb.checked=(placementFlags&1)===0;cb.onchange=()=>{placementFlags=cb.checked?(placementFlags&~1):(placementFlags|1);};label.append(cb,document.createTextNode(' Contains a strawberry'));opts.append(label);
  }else if(item.options==='dashes'){
    const label=document.createElement('label');label.textContent='Dash upgrade';const sel=document.createElement('select');sel.innerHTML='<option value="2">2 dashes</option><option value="3">3 dashes</option>';sel.value=(placementFlags&2)?'3':'2';sel.onchange=()=>{placementFlags=sel.value==='3'?(placementFlags|2):(placementFlags&~2);};label.append(sel);opts.append(label);
  }
}
function rotateSelected(clockwise=true){const next=rotateId(selected,clockwise);if(next===selected)return;selected=next;specialMode=paletteById.get(next)?.special||null;renderPalette();renderInspector();}
function updateToolButtons(){for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool&&!specialMode);}
function resizeCanvas(){const z=Number($('zoom').value);canvas.width=128*z;canvas.height=128*z;canvas.style.width=`${128*z}px`;canvas.style.height=`${128*z}px`;ctx.imageSmoothingEnabled=false;}
function tileColor(id){return paletteById.get(id)?.color||`hsl(${(id*47)%360} 35% 48%)`;}
function entityFootprint(e){
  const x=e.x,y=e.y;
  if(e.type===64||e.type===96)return[{x,y},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}];
  if(e.type===86)return[{x,y:y-1},{x:x+1,y:y-1},{x,y},{x:x+1,y}];
  if(e.type===11||e.type===12)return[{x,y},{x:x+1,y}];
  return[{x,y}];
}
function footprintInBounds(fp){return fp.every(p=>p.x>=0&&p.x<16&&p.y>=0&&p.y<16);}
function footprintsOverlap(a,b){return a.some(p=>b.some(q=>p.x===q.x&&p.y===q.y));}
function entityAtCell(room,x,y){return(room.entities||[]).find(e=>entityFootprint(e).some(p=>p.x===x&&p.y===y));}
function drawEditor(){
  const room=currentRoom(),scale=Number($('zoom').value),cell=TILE_SIZE*scale;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const id=room.tiles[y*16+x];if(!id)continue;if(!drawPicoSprite(ctx,id,x*cell,y*cell,cell)){ctx.fillStyle=tileColor(id);ctx.fillRect(x*cell,y*cell,cell,cell);}}
  for(const e of room.entities||[])drawLogicalPiece(ctx,e.type,e.x*cell,e.y*cell,cell);
  drawPicoSprite(ctx,1,room.spawnX*cell,room.spawnY*cell,cell,false,false,.72);
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border');ctx.lineWidth=1;for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*cell+.5,0);ctx.lineTo(i*cell+.5,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell+.5);ctx.lineTo(canvas.width,i*cell+.5);ctx.stroke();}
}
function cellAt(event){const rect=canvas.getBoundingClientRect();const x=Math.floor((event.clientX-rect.left)/rect.width*16),y=Math.floor((event.clientY-rect.top)/rect.height*16);return{x:Math.max(0,Math.min(15,x)),y:Math.max(0,Math.min(15,y)),index:y*16+x};}
function applyAt(x,y,index,forceErase=false){
  const room=currentRoom();
  if(specialMode==='spawn'){room.spawnX=x;room.spawnY=y;specialMode=null;renderPalette();renderInspector();return true;}
  const effective=forceErase?'eraser':tool;
  if(effective==='eyedropper'){
    const e=entityAtCell(room,x,y);if(e)selectPiece(e.type,e.flags||0);else selectPiece(room.tiles[index]||0,0);tool='pencil';updateToolButtons();return false;
  }
  if(effective==='eraser'||selected===0){const e=entityAtCell(room,x,y);if(e){room.entities=room.entities.filter(v=>v!==e);return true;}if(room.tiles[index]!==0){room.tiles[index]=0;return true;}return false;}
  if(effective==='fill'){
    if(ENTITY_TYPES.has(selected)||specialMode)return false;const from=room.tiles[index],to=selected;if(from===to)return false;const q=[index],seen=new Set(q);while(q.length){const p=q.pop();room.tiles[p]=to;const px=p%16,py=Math.floor(p/16);for(const [nx,ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]])if(nx>=0&&nx<16&&ny>=0&&ny<16){const ni=ny*16+nx;if(!seen.has(ni)&&room.tiles[ni]===from){seen.add(ni);q.push(ni);}}}return true;
  }
  if(ENTITY_TYPES.has(selected)){
    const next={type:selected,x,y,flags:placementFlags};const fp=entityFootprint(next);if(!footprintInBounds(fp)){$('cursorStatus').textContent='Piece does not fit at this edge';return false;}
    room.entities=(room.entities||[]).filter(e=>!footprintsOverlap(entityFootprint(e),fp));for(const p of fp)room.tiles[p.y*16+p.x]=0;room.entities.push(next);return true;
  }
  const overlapped=entityAtCell(room,x,y);if(overlapped)room.entities=room.entities.filter(e=>e!==overlapped);if(room.tiles[index]===selected)return false;room.tiles[index]=selected;return true;
}

canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointerDown=true;lastCell=-1;pushHistory();const c=cellAt(e);if(applyAt(c.x,c.y,c.index,e.button===2)){drawEditor();commit();}lastCell=c.index;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{const c=cellAt(e);$('cursorStatus').textContent=`x ${c.x}, y ${c.y}`;if(pointerDown&&c.index!==lastCell&&(tool==='eraser'||(tool==='pencil'&&!ENTITY_TYPES.has(selected)&&!specialMode))){if(applyAt(c.x,c.y,c.index,e.buttons===2)){drawEditor();commit();}lastCell=c.index;}});
canvas.addEventListener('pointerup',()=>pointerDown=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());

function bindText(id,key,level=false,number=false){$(id).addEventListener('change',()=>{pushHistory();const target=level?currentLevel():project;target[key]=number?Number($(id).value):$(id).value;commit();renderLists();updateSize();});}
bindText('packTitle','title');bindText('packAuthor','author');bindText('packDescription','description');bindText('levelTitle','title',true);bindText('levelAuthor','author',true);bindText('levelDescription','description',true);bindText('levelDifficulty','difficulty',true,true);
$('paletteSearch').oninput=renderPalette;$('paletteCategory').onchange=renderPalette;$('zoom').oninput=()=>{resizeCanvas();drawEditor();};
$('toolButtons').addEventListener('click',e=>{if(e.target.dataset.tool){tool=e.target.dataset.tool;specialMode=null;updateToolButtons();renderPalette();}});
$('undo').onclick=undo;$('redo').onclick=redo;$('rotateCW').onclick=()=>rotateSelected(true);$('rotateCCW').onclick=()=>rotateSelected(false);
$('setSpawn').onclick=()=>selectPiece(1,0);
$('addLevel').onclick=()=>{pushHistory();project.levels.push(blankLevel(project.levels.length+1));project.activeLevel=project.levels.length-1;project.activeRoom=0;commit();renderAll();};
$('addRoom').onclick=()=>{pushHistory();currentLevel().rooms.push(blankRoom());project.activeRoom=currentLevel().rooms.length-1;commit();renderAll();};
$('duplicateRoom').onclick=()=>{pushHistory();const r=currentRoom();const copy={...structuredClone(r),id:idFor('room-copy'),tiles:r.tiles.slice()};currentLevel().rooms.splice(project.activeRoom+1,0,copy);project.activeRoom++;commit();renderAll();};
$('deleteRoom').onclick=()=>{if(currentLevel().rooms.length===1)return showMessage('Cannot delete room','Every level must contain at least one room.');pushHistory();currentLevel().rooms.splice(project.activeRoom,1);project.activeRoom=Math.max(0,project.activeRoom-1);commit();renderAll();};
function moveRoom(d){const rooms=currentLevel().rooms,i=project.activeRoom,n=i+d;if(n<0||n>=rooms.length)return;pushHistory();[rooms[i],rooms[n]]=[rooms[n],rooms[i]];project.activeRoom=n;commit();renderAll();}
$('moveRoomUp').onclick=()=>moveRoom(-1);$('moveRoomDown').onclick=()=>moveRoom(1);

$('newProject').onclick=()=>{if(confirm('Create a new project? The current autosave will be replaced.')){project=freshProject();history=[];future=[];commit();renderAll();}};
$('saveProject').onclick=()=>download(new TextEncoder().encode(JSON.stringify(serializableProject(),null,2)),`${safeFile(project.title)}.celproj`,'application/json');
$('openProject').onchange=async e=>{try{const raw=JSON.parse(await e.target.files[0].text());pushHistory();project=reviveProject(raw);commit();renderAll();showMessage('Project opened',`${project.levels.length} level(s) loaded.`);}catch(err){showMessage('Could not open project',err.message);}e.target.value='';};
$('import8xv').onchange=async e=>{let count=0;const failures=[];pushHistory();for(const file of e.target.files){try{const imported=import8xv(new Uint8Array(await file.arrayBuffer()));if(imported.data.kind==='level'){project.levels.push(migrateLegacyEntities(migrateLegacyTerrain(imported.data)));count++;}else{project.title=imported.data.title;project.author=imported.data.author;project.description=imported.data.description;project.levels.push(...imported.data.levels.map(level=>migrateLegacyEntities(migrateLegacyTerrain(level))));count+=imported.data.levels.length;}}catch(err){failures.push(`${file.name}: ${err.message}`);}}if(project.levels.length>1&&project.levels[0].title==='Level 1'&&isBlank(project.levels[0]))project.levels.shift();project.activeLevel=Math.max(0,project.levels.length-count);project.activeRoom=0;commit();renderAll();showMessage('Import complete',`${count} level(s) imported.${failures.length?'\n\nFailed:\n'+failures.join('\n'):''}`);e.target.value='';};
function isBlank(level){return level.rooms.length===1&&level.rooms[0].entities.length===0;}
$('exportLevel').onclick=()=>{const level=currentLevel(),v=validateLevel(level);if(!v.valid)return showValidation(v);const name=makeVarName(level,'level');download(exportLevel8xv(level,{name}),`${name}.8xv`,'application/octet-stream');showMessage('Level exported',`${level.title}\nVariable: ${name}\nThe file is ready for TI Connect CE.`);};
$('exportPack').onclick=()=>{const v=validatePack(project);if(!v.valid)return showValidation(v);try{const name=makeVarName(project,'pack');download(exportPack8xv(project,{name}),`${name}.8xv`,'application/octet-stream');showMessage('Pack exported',`${project.levels.length} levels\nVariable: ${name}`);}catch(err){showMessage('Pack export failed',`${err.message}\nExport individual levels or split the pack.`);}};
$('validate').onclick=()=>showValidation(validatePack(project));$('themeButton').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';drawEditor();};

function showValidation(result){const box=$('validation');box.innerHTML='';if(result.valid&&!result.warnings.length){box.innerHTML='<p class="ok">No errors or warnings.</p>';return;}if(result.errors.length){const h=document.createElement('p');h.className='error';h.textContent=`${result.errors.length} error(s)`;box.append(h,list(result.errors,'error'));}if(result.warnings.length){const h=document.createElement('p');h.className='warning';h.textContent=`${result.warnings.length} warning(s)`;box.append(h,list(result.warnings,'warning'));}if(result.valid)showMessage('Validation passed',result.warnings.length?'The pack is valid, with warnings shown in the sidebar.':'The pack is valid.');}
function list(items,cls){const ul=document.createElement('ul');for(const t of items){const li=document.createElement('li');li.className=cls;li.textContent=t;ul.append(li);}return ul;}
function updateSize(){try{const l=encodeLevelPayload(currentLevel()).length,p=encodePackPayload(project).length;$('sizeStatus').textContent=`Level ${l.toLocaleString()} B · Pack ${p.toLocaleString()} B`;}catch(err){$('sizeStatus').textContent=err.message;}}
function download(bytes,name,type){const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeFile(s){return String(s||'celeste-project').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,60)||'celeste-project';}
function showMessage(title,body){$('messageTitle').textContent=title;$('messageBody').textContent=body;$('messageDialog').showModal();}
$('messageClose').onclick=()=>$('messageDialog').close();

window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(e.key.toLowerCase()==='r'&&!$('previewDialog').open){e.preventDefault();rotateSelected(!e.shiftKey);return;}
  const map={b:'pencil',e:'eraser',f:'fill',i:'eyedropper'};if(map[e.key.toLowerCase()]){tool=map[e.key.toLowerCase()];specialMode=null;updateToolButtons();renderPalette();}
});

// PICO-8-faithful playable preview. It implements the original room-level
// state relationships (keys/chests, fake-wall berries, big-chest dash upgrade,
// fall floors, balloons, springs, moving platforms and flying berries) in
// addition to the original player acceleration/jump/dash constants.
$('previewButton').onclick=startPreview;$('closePreview').onclick=stopPreview;$('previewDialog').addEventListener('close',stopPreview);
function startPreview(){const validation=validateLevel(currentLevel());if(!validation.valid)return showValidation(validation);$('previewDialog').showModal();preview.running=true;preview.room=0;preview.maxDashes=1;preview.collectedSources=new Set();preview.lastTime=performance.now();preview.accum=0;resetPreview();previewLoop(preview.lastTime);}
function stopPreview(){preview.running=false;cancelAnimationFrame(preview.raf);preview.keys.clear();if($('previewDialog').open)$('previewDialog').close();}
const previewSourceKey=(roomIndex,source)=>`${roomIndex}:${source}`;
function previewSourceCollected(roomIndex,source){return Number.isInteger(source)&&preview.collectedSources.has(previewSourceKey(roomIndex,source));}
function previewRoomNeedsKey(room){
  let sawChest=false;
  for(let i=0;i<(room.entities||[]).length;i++){
    const e=room.entities[i];if(e.type!==20)continue;sawChest=true;
    if((e.flags&1)!==0||!previewSourceCollected(preview.room,i))return true;
  }
  return !sawChest;
}
function makePreviewEntities(room){
  const needKey=previewRoomNeedsKey(room);
  return(room.entities||[]).map((e,i)=>({...e,_i:i,_source:i,px:e.x*8,py:e.y*8,alive:true,timer:0,state:0,fly:false,vy:0,lastX:e.x*8,baseX:e.x*8,baseY:e.y*8})).filter(e=>{
    if(e.type===8)return needKey;
    if(!FRUIT_GATED_TYPES.has(e.type))return true;
    if((e.type===20||e.type===64)&&(e.flags&1)!==0)return true;
    return !previewSourceCollected(preview.room,e._source);
  });
}
function resetPreview(){const r=currentLevel().rooms[preview.room];Object.assign(preview,{x:r.spawnX*8,y:r.spawnY*8,vx:0,vy:0,remX:0,remY:0,grace:0,jbuffer:0,djump:preview.maxDashes,dashTime:0,dashEffectTime:0,dashTargetX:0,dashTargetY:0,dashAccelX:0,dashAccelY:0,pJump:false,pDash:false,flipX:false,sprite:1,sprOff:0,wasOnGround:false,won:false,deadFrames:0,hasKey:false,hasDashed:false,entities:makePreviewEntities(r)});}
window.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;preview.keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright','z','x','r'].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='r')resetPreview();});
window.addEventListener('keyup',e=>preview.keys.delete(e.key.toLowerCase()));
const pbtn=k=>preview.keys.has(k),appr=(v,target,amount)=>v>target?Math.max(v-amount,target):Math.min(v+amount,target),sign=v=>v>0?1:v<0?-1:0;
function tileAt(room,tx,ty){if(tx<0||tx>15||ty<0||ty>15)return 0;return room.tiles[ty*16+tx]||0;}
function tileFlagAt(room,x,y,w,h,flag){const x0=Math.max(0,Math.floor(x/8)),x1=Math.min(15,Math.floor((x+w-1)/8)),y0=Math.max(0,Math.floor(y/8)),y1=Math.min(15,Math.floor((y+h-1)/8));for(let tx=x0;tx<=x1;tx++)for(let ty=y0;ty<=y1;ty++)if(tileFlag(tileAt(room,tx,ty),flag))return true;return false;}
function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh){return ax+aw>bx&&ay+ah>by&&ax<bx+bw&&ay<by+bh;}
function entityColliderAt(x,y,w,h,oy=0){
  for(const e of preview.entities||[]){if(!e.alive)continue;
    if(e.type===64&&rectsOverlap(x,y,w,h,e.px,e.py,16,16))return e;
    if(e.type===23&&e.state!==2&&rectsOverlap(x,y,w,h,e.px,e.py,8,8))return e;
    if((e.type===11||e.type===12)&&oy>0&&rectsOverlap(x,y,w,h,e.px-4,e.py-1,16,3))return e;
  }return null;
}
function solidAt(room,x,y,w,h,oy=0){return tileFlagAt(room,x,y,w,h,0)||!!entityColliderAt(x,y,w,h,oy);}
function iceAt(room,x,y,w,h){return tileFlagAt(room,x,y,w,h,4);}
function playerSolid(room,ox,oy){return solidAt(room,preview.x+1+ox,preview.y+3+oy,6,5,oy);}
function spikesAt(room,x,y,w,h,xspd,yspd){const x0=Math.max(0,Math.floor(x/8)),x1=Math.min(15,Math.floor((x+w-1)/8)),y0=Math.max(0,Math.floor(y/8)),y1=Math.min(15,Math.floor((y+h-1)/8));for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++){const tile=tileAt(room,i,j);if(tile===17&&(((y+h-1)%8)>=6||y+h===j*8+8)&&yspd>=0)return true;if(tile===27&&y%8<=2&&yspd<=0)return true;if(tile===43&&x%8<=2&&xspd<=0)return true;if(tile===59&&(((x+w-1)%8)>=6||x+w===i*8+8)&&xspd>=0)return true;}return false;}
function spawnPreviewFruit(x,y,source){preview.entities.push({type:26,x:Math.floor(x/8),y:Math.floor(y/8),flags:0,_source:source,px:x,py:y,alive:true,timer:0,state:0,vy:0});}
function breakFakeWall(e){if(!e?.alive)return;e.alive=false;preview.vx=-sign(preview.vx)*1.5;preview.vy=-1.5;preview.dashTime=-1;if((e.flags&1)===0)spawnPreviewFruit(e.px+4,e.py+4,e._source);}
function movePreviewX(room,amount){preview.remX+=amount;let pixels=Math.floor(preview.remX+.5);preview.remX-=pixels;const step=sign(pixels);for(let i=0;i<Math.abs(pixels);i++){const nx=preview.x+1+step,ny=preview.y+3;if(tileFlagAt(room,nx,ny,6,5,0)){preview.vx=0;preview.remX=0;break;}const hit=entityColliderAt(nx,ny,6,5,0);if(hit){if(hit.type===64&&preview.dashEffectTime>0)breakFakeWall(hit);preview.vx=0;preview.remX=0;break;}preview.x+=step;}}
function movePreviewY(room,amount){preview.remY+=amount;let pixels=Math.floor(preview.remY+.5);preview.remY-=pixels;const step=sign(pixels);for(let i=0;i<Math.abs(pixels);i++){const nx=preview.x+1,ny=preview.y+3+step;if(tileFlagAt(room,nx,ny,6,5,0)){preview.vy=0;preview.remY=0;break;}const hit=entityColliderAt(nx,ny,6,5,step);if(hit){if(hit.type===64&&preview.dashEffectTime>0)breakFakeWall(hit);preview.vy=0;preview.remY=0;break;}preview.y+=step;}}
function killPreview(){preview.deadFrames=15;preview.vx=preview.vy=0;}
function collectFruit(e){e.alive=false;preview.djump=preview.maxDashes;if(Number.isInteger(e._source))preview.collectedSources.add(previewSourceKey(preview.room,e._source));}
function updatePreviewEntities(room){
  const px=preview.x+1,py=preview.y+3;
  for(const e of [...preview.entities]){if(!e.alive)continue;
    if(e.type===22){if(e.timer>0){e.timer--;if(e.timer===0)e.state=0;}if(e.state===0&&rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.djump=preview.maxDashes;e.state=1;e.timer=60;}}
    else if(e.type===18){if(e.timer>0)e.timer--;if(rectsOverlap(px,py,6,5,e.px,e.py,8,8)&&preview.vy>=0){preview.y=e.py-4;preview.vx/=5;preview.vy=-3;preview.djump=preview.maxDashes;e.timer=10;}}
    else if(e.type===26){if(rectsOverlap(px,py,6,5,e.px,e.py,8,8))collectFruit(e);}
    else if(e.type===28){if(preview.hasDashed)e.fly=true;if(e.fly){e.vy=appr(e.vy,-3.5,.25);e.py+=e.vy;if(e.py<-16)e.alive=false;}if(e.alive&&rectsOverlap(px,py,6,5,e.px,e.py,8,8))collectFruit(e);}
    else if(e.type===8){if(rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.hasKey=true;e.alive=false;}}
    else if(e.type===20){if(preview.hasKey&&e.state===0){e.state=1;e.timer=20;}if(e.state===1&&--e.timer<=0){e.alive=false;if((e.flags&1)===0)spawnPreviewFruit(e.px-4,e.py-4,e._source);}}
    else if(e.type===23){if(e.state===0&&(rectsOverlap(px,py+1,6,5,e.px,e.py,8,8)||rectsOverlap(px-1,py,8,5,e.px,e.py,8,8))){e.state=1;e.timer=15;}else if(e.state===1&&--e.timer<=0){e.state=2;e.timer=60;}else if(e.state===2&&--e.timer<=0&&!rectsOverlap(px,py,6,5,e.px,e.py,8,8))e.state=0;}
    else if(e.type===11||e.type===12){const dir=e.type===11?-1:1;e.lastX=e.px;e.px+=dir*.65;if(e.px<-16)e.px=128;else if(e.px>128)e.px=-16;const dx=e.px-e.lastX;if(rectsOverlap(px,py+1,6,5,e.lastX-4,e.py-2,16,4)&&Math.abs(dx)<8)preview.x+=dx;}
    else if(e.type===96){if(e.state===0&&rectsOverlap(px,py,6,5,e.px,e.py+8,16,9)&&playerSolid(room,0,1)){e.state=1;e.timer=60;preview.vx=preview.vy=0;}else if(e.state===1&&--e.timer<0){e.state=2;preview.entities.push({type:102,px:e.px+4,py:e.py+4,alive:true,vy:-4,targetDashes:(e.flags&2)?3:2,state:0,flags:0});}}
    else if(e.type===102){e.vy=appr(e.vy,0,.5);e.py+=e.vy;if(e.vy===0&&rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.maxDashes=e.targetDashes||2;preview.djump=preview.maxDashes;e.alive=false;}}
  }
}
function previewStep(){
  if(preview.won)return;const room=currentLevel().rooms[preview.room];if(preview.deadFrames>0){preview.deadFrames--;if(preview.deadFrames===0)resetPreview();return;}
  const input=pbtn('arrowright')?1:(pbtn('arrowleft')?-1:0);if(spikesAt(room,preview.x+1,preview.y+3,6,5,preview.vx,preview.vy)||preview.y>128){killPreview();return;}
  const onGround=playerSolid(room,0,1),onIce=iceAt(room,preview.x+1,preview.y+4,6,5);const jump=pbtn('z')&&!preview.pJump;preview.pJump=pbtn('z');if(jump)preview.jbuffer=4;else if(preview.jbuffer>0)preview.jbuffer--;const dash=pbtn('x')&&!preview.pDash;preview.pDash=pbtn('x');
  if(onGround){preview.grace=6;if(preview.djump<preview.maxDashes)preview.djump=preview.maxDashes;}else if(preview.grace>0)preview.grace--;preview.dashEffectTime--;
  if(preview.dashTime>0){preview.dashTime--;preview.vx=appr(preview.vx,preview.dashTargetX,preview.dashAccelX);preview.vy=appr(preview.vy,preview.dashTargetY,preview.dashAccelY);}else{
    const maxrun=1;let accel=onGround?0.6:0.4,deccel=.15;if(onGround&&onIce)accel=.05;preview.vx=Math.abs(preview.vx)>maxrun?appr(preview.vx,sign(preview.vx)*maxrun,deccel):appr(preview.vx,input*maxrun,accel);if(preview.vx!==0)preview.flipX=preview.vx<0;
    let maxfall=2,gravity=Math.abs(preview.vy)<=.15?.105:.21;if(input!==0&&playerSolid(room,input,0)&&!iceAt(room,preview.x+1+input,preview.y+3,6,5))maxfall=.4;if(!onGround)preview.vy=appr(preview.vy,maxfall,gravity);
    if(preview.jbuffer>0){if(preview.grace>0){preview.jbuffer=0;preview.grace=0;preview.vy=-2;}else{const wallDir=playerSolid(room,-3,0)?-1:(playerSolid(room,3,0)?1:0);if(wallDir){preview.jbuffer=0;preview.vy=-2;preview.vx=-wallDir*(maxrun+1);}}}
    if(preview.djump>0&&dash){preview.djump--;preview.hasDashed=true;preview.dashTime=4;preview.dashEffectTime=10;const vi=pbtn('arrowup')?-1:(pbtn('arrowdown')?1:0),full=5,half=3.5355339059;if(input!==0){if(vi!==0){preview.vx=input*half;preview.vy=vi*half;}else{preview.vx=input*full;preview.vy=0;}}else if(vi!==0){preview.vx=0;preview.vy=vi*full;}else{preview.vx=preview.flipX?-1:1;preview.vy=0;}preview.dashTargetX=2*sign(preview.vx);preview.dashTargetY=2*sign(preview.vy);preview.dashAccelX=1.5;preview.dashAccelY=1.5;if(preview.vy<0)preview.dashTargetY*=.75;if(preview.vy!==0)preview.dashAccelX=1.0606601718;if(preview.vx!==0)preview.dashAccelY=10.606601718;}
  }
  preview.sprOff++;if(!onGround)preview.sprite=playerSolid(room,input,0)?5:3;else if(pbtn('arrowdown'))preview.sprite=6;else if(pbtn('arrowup'))preview.sprite=7;else if(preview.vx===0||(!pbtn('arrowleft')&&!pbtn('arrowright')))preview.sprite=1;else preview.sprite=1+(Math.floor(preview.sprOff/4)%4);
  preview.wasOnGround=onGround;movePreviewX(room,preview.vx);movePreviewY(room,preview.vy);preview.x=Math.max(-1,Math.min(121,preview.x));updatePreviewEntities(room);
  if(preview.y<-4){if(preview.room<currentLevel().rooms.length-1){preview.room++;resetPreview();}else preview.won=true;}
}
function previewLoop(now){if(!preview.running)return;preview.accum+=Math.min(100,now-preview.lastTime);preview.lastTime=now;while(preview.accum>=1000/30){previewStep();preview.accum-=1000/30;}drawPreview(currentLevel().rooms[preview.room]);preview.raf=requestAnimationFrame(previewLoop);}
function drawPreviewEntity(e){
  const scale=4;if(!e.alive)return;
  if(e.type===22&&e.state===1)return;
  if(e.type===23&&e.state===2)return;
  if(e.type===102){drawPicoSprite(pctx,102,e.px*scale,e.py*scale,32);return;}
  if(e.type===18&&e.timer>0){drawPicoSprite(pctx,19,e.px*scale,e.py*scale,32);return;}
  if(e.type===20&&e.state===1){drawPicoSprite(pctx,20,e.px*scale,e.py*scale,32);return;}
  drawLogicalPiece(pctx,e.type,e.px*scale,e.py*scale,32);
}
function drawPreview(room){
  pctx.imageSmoothingEnabled=false;pctx.fillStyle='#000';pctx.fillRect(0,0,512,512);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const id=room.tiles[y*16+x];if(id&&!drawPicoSprite(pctx,id,x*32,y*32,32)){pctx.fillStyle=tileColor(id);pctx.fillRect(x*32,y*32,32,32);}}
  for(const e of preview.entities||[])drawPreviewEntity(e);if(!preview.deadFrames)drawPicoSprite(pctx,preview.sprite,preview.x*4,preview.y*4,32,preview.flipX,false);if(preview.deadFrames){pctx.fillStyle='rgba(255,0,77,.22)';pctx.fillRect(0,0,512,512);}
  $('previewStatus').textContent=preview.won?'Level complete!':`Room ${preview.room+1}/${currentLevel().rooms.length} · ${preview.djump}/${preview.maxDashes} dash${preview.maxDashes===1?'':'es'} · key ${preview.hasKey?'yes':'no'} · PICO-8 @ 30 Hz`;
}

renderAll();
