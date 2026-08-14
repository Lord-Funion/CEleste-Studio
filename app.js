import {
  fnv1a, exportLevel8xv, exportPack8xv, import8xv, validateLevel, validatePack,
  encodeLevelPayload, encodePackPayload, makeVarName
} from './lib/format.mjs';
import {createPico8Preview} from './lib/pico8-preview.mjs';

const TILE_SIZE = 8;
const AUTOSAVE_KEY = 'celeste-studio-autosave';
const EDITOR_PREFS_KEY = 'celeste-studio-editor-prefs-v1';
const ENTITY_TYPES = new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129,130,131]);
const FRUIT_GATED_TYPES = new Set([20,26,28,64,129,130]);
const ENTITY_ROTATION_SHIFT=6,ENTITY_ROTATION_MASK=0xc0,ENTITY_FLAG_MASK=0x3f;
const entityRotation=e=>((e.flags||0)&ENTITY_ROTATION_MASK)>>ENTITY_ROTATION_SHIFT;
const entityGameplayFlags=e=>(e.flags||0)&ENTITY_FLAG_MASK;
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
  {id:130,name:'Silver key',category:'Gameplay',entity:true,options:'link',description:'Collect it to open every silver gate block with the same link group (0–63), even in another room of this custom level.',color:'#c2c3c7'},
  {id:131,name:'Silver gate',category:'Gameplay',entity:true,options:'link',description:'A solid 8×8 linked gate block. Stack blocks with the same link group to build doors, portcullises, walls, or any keyed barrier shape.',color:'#5f574f'},
  {id:20,name:'Locked chest',category:'Gameplay',entity:true,description:'Original key puzzle chest. By default it releases a strawberry after the room key is collected.',options:'strawberry',color:'#ce9250'},
  {id:129,name:'Climb Chest',category:'Gameplay',entity:true,description:'Custom power-up chest. Touch it to unlock modern-Celeste-style wall grabbing for the rest of the level. On calculator hold MATH against a non-ice wall; Up climbs, Down descends, and stamina limits hanging/climbing.',color:'#74d9ff'},
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

// Rotation is stored independently from the atlas ID. Any graphical piece can use 0/90/180/270 degrees.

// Celeste Classic / PICO-8 sprite atlas. The private repo carries the same
// 128×64 atlas used by the calculator build.
const spriteAtlas=new Image();
let spriteAtlasReady=false;
spriteAtlas.decoding='async';
spriteAtlas.onload=()=>{spriteAtlasReady=true;renderPalette();drawEditor();};
spriteAtlas.onerror=()=>{spriteAtlasReady=false;};
spriteAtlas.src='assets/pico8-atlas.png';

function drawPicoSprite(target,id,dx,dy,size,flipX=false,flipY=false,alpha=1,rotation=0){
  if(!spriteAtlasReady||id<0||id>127)return false;
  const sx=(id%16)*8,sy=Math.floor(id/16)*8;
  target.save();target.globalAlpha=alpha;target.imageSmoothingEnabled=false;
  target.translate(dx+size/2,dy+size/2);target.rotate((rotation&3)*Math.PI/2);target.scale(flipX?-1:1,flipY?-1:1);
  target.drawImage(spriteAtlas,sx,sy,8,8,-size/2,-size/2,size,size);target.restore();return true;
}
function pieceBounds(id,cell){if(id===64||id===96)return{ox:0,oy:0,w:2*cell,h:2*cell};if(id===86)return{ox:0,oy:-cell,w:2*cell,h:2*cell};if(id===11||id===12)return{ox:-cell/2,oy:-cell/8,w:2*cell,h:cell};return{ox:0,oy:0,w:cell,h:cell};}
function drawLogicalPiece(target,id,dx,dy,cell,alpha=1,rotation=0){
  if(rotation){const b=pieceBounds(id,cell),cx=dx+b.ox+b.w/2,cy=dy+b.oy+b.h/2;target.save();target.translate(cx,cy);target.rotate((rotation&3)*Math.PI/2);target.translate(-cx,-cy);drawLogicalPiece(target,id,dx,dy,cell,alpha,0);target.restore();return true;}
  if(id===130){
    const ok=drawPicoSprite(target,8,dx,dy,cell,false,false,alpha);
    if(ok){target.save();target.globalAlpha=alpha;target.globalCompositeOperation='source-atop';target.fillStyle='#c2c3c7';target.fillRect(dx,dy,cell,cell);target.restore();}
    return true;
  }
  if(id===131){
    target.save();target.globalAlpha=alpha;target.fillStyle='#5f574f';target.fillRect(dx,dy,cell,cell);const c=cell/8;target.fillStyle='#c2c3c7';target.fillRect(dx+c,dy,2*c,cell);target.fillRect(dx+5*c,dy,2*c,cell);target.fillStyle='#fff1e8';target.fillRect(dx+3*c,dy+3*c,2*c,2*c);target.restore();return true;
  }
  if(id===129){
    drawPicoSprite(target,20,dx,dy,cell,false,false,alpha);
    target.save();target.globalAlpha=alpha;target.fillStyle='#74d9ff';const c=cell/8;target.fillRect(dx+3*c,dy+2*c,2*c,4*c);target.fillRect(dx+2*c,dy+3*c,4*c,2*c);target.restore();return true;
  }
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
  if(id===129||id===130||id===131){drawLogicalPiece(target,id,5,5,24);return;}
  if(id===86){drawLogicalPiece(target,id,3,17,14);return;}
  if(id===11||id===12){drawPicoSprite(target,11,3,10,14);drawPicoSprite(target,12,17,10,14);return;}
  if(id===28){drawPicoSprite(target,45,1,10,12);drawPicoSprite(target,28,11,9,16);drawPicoSprite(target,45,23,10,12,true);return;}
  if(id===22){drawPicoSprite(target,13,11,18,12);drawPicoSprite(target,22,9,4,16);return;}
  if(!drawPicoSprite(target,id,5,5,24)){target.fillStyle=item.color||'#777';target.fillRect(5,5,24,24);}
}

const $=id=>document.getElementById(id);
const canvas=$('editorCanvas'),ctx=canvas.getContext('2d');
const previewCanvas=$('previewCanvas'),pctx=previewCanvas.getContext('2d');
const editorPrefs=loadEditorPrefs();
$('zoom').value=String(editorPrefs.zoom);
$('showGrid').checked=editorPrefs.grid;
document.documentElement.dataset.theme=editorPrefs.theme;

function idFor(label){return fnv1a(`${label}|${Date.now()}|${Math.random()}`);}
function blankRoom(label='Room'){
  const tiles=new Uint8Array(256);
  for(let x=0;x<16;x++)tiles[15*16+x]=37;
  for(let y=0;y<16;y++){tiles[y*16]=37;tiles[y*16+15]=37;}
  return{id:idFor(label),width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,tiles,rotations:new Uint8Array(256),entities:[]};
}
function blankLevel(index=1){return{id:idFor(`level-${index}`),title:`Level ${index}`,author:'Lord Funion',description:'',difficulty:2,rooms:[blankRoom()]};}
function freshProject(){return{version:4,id:idFor('pack'),title:'My CEleste Pack',author:'Lord Funion',description:'',levels:[blankLevel(1)],activeLevel:0,activeRoom:0};}

const restoredProject=loadAutosave();
let project=restoredProject||freshProject();
let tool='pencil',selected=37,specialMode=null,placementFlags=0,placementRotation=0,pointerDown=false,lastCell=-1;
let strokeHistoryAdded=false,strokeChanged=false,pointerCanPaint=false,strokeBefore=null;
let history=[],future=[];

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
  for(const level of raw.levels){migrateLegacyTerrain(level,migrate);migrateLegacyEntities(level);for(const room of level.rooms){room.rotations=room.rotations instanceof Uint8Array?room.rotations:Uint8Array.from(room.rotations||new Uint8Array(room.width*room.height));room.entities=(room.entities||[]).map(e=>({...e,flags:e.flags??0}));}}
  raw.version=4;raw.activeLevel=Math.min(raw.activeLevel||0,raw.levels.length-1);raw.activeRoom=Math.min(raw.activeRoom||0,raw.levels[raw.activeLevel].rooms.length-1);return raw;
}
function snapshot(){return serializableProject();}
function pushHistory(){history.push(snapshot());if(history.length>100)history.shift();future=[];updateUndoButtons();}
function restore(s){project=reviveProject(structuredClone(s));renderAll();autosave();}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());}
function updateUndoButtons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function setSaveStatus(message,error=false){const el=$('saveStatus');if(!el)return;el.textContent=message;el.classList.toggle('error',error);}
function autosave(){try{localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(serializableProject()));setSaveStatus(`Saved locally ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);return true;}catch(err){setSaveStatus('Local save failed',true);return false;}}
function loadAutosave(){try{const v=localStorage.getItem(AUTOSAVE_KEY);return v?reviveProject(JSON.parse(v)):null}catch{return null;}}
function loadEditorPrefs(){try{const raw=JSON.parse(localStorage.getItem(EDITOR_PREFS_KEY)||'{}');return{zoom:Math.max(1,Math.min(4,Number(raw.zoom)||3)),grid:raw.grid!==false,theme:raw.theme==='light'?'light':'dark'};}catch{return{zoom:3,grid:true,theme:'dark'};}}
function saveEditorPrefs(){try{localStorage.setItem(EDITOR_PREFS_KEY,JSON.stringify({zoom:Number($('zoom').value),grid:$('showGrid').checked,theme:document.documentElement.dataset.theme}));}catch{}}
function commit(){autosave();renderLists();updateSize();}

function renderAll(){syncInputs();renderLists();renderPalette();renderInspector();resizeCanvas();drawEditor();updateSize();updateUndoButtons();}
function syncInputs(){
  $('packTitle').value=project.title;$('packAuthor').value=project.author;$('packDescription').value=project.description;
  const level=currentLevel();$('levelTitle').value=level.title;$('levelAuthor').value=level.author;$('levelDescription').value=level.description;$('levelDifficulty').value=level.difficulty;
}
function renderLists(){
  $('levelList').innerHTML='';project.levels.forEach((level,i)=>{const row=document.createElement('div');row.className='list-item'+(i===project.activeLevel?' active':'');const b=document.createElement('button');b.textContent=`${i+1}. ${level.title}`;b.onclick=()=>activateLevel(i);const up=document.createElement('button');up.className='mini';up.textContent='↑';up.title='Move level up';up.disabled=i===0;up.onclick=()=>moveLevel(i,-1);const down=document.createElement('button');down.className='mini';down.textContent='↓';down.title='Move level down';down.disabled=i===project.levels.length-1;down.onclick=()=>moveLevel(i,1);row.append(b,up,down);$('levelList').append(row);});
  $('roomList').innerHTML='';currentLevel().rooms.forEach((room,i)=>{const row=document.createElement('div');row.className='list-item'+(i===project.activeRoom?' active':'');const b=document.createElement('button');b.textContent=`Room ${i+1}`;b.onclick=()=>activateRoom(i);row.append(b);$('roomList').append(row);});
  $('deleteLevel').disabled=project.levels.length===1;
  $('deleteRoom').disabled=currentLevel().rooms.length===1;
  $('moveRoomUp').disabled=project.activeRoom===0;
  $('moveRoomDown').disabled=project.activeRoom===currentLevel().rooms.length-1;
}
function activateLevel(index){if(index<0||index>=project.levels.length||index===project.activeLevel)return;project.activeLevel=index;project.activeRoom=0;autosave();renderAll();}
function activateRoom(index){if(index<0||index>=currentLevel().rooms.length||index===project.activeRoom)return;project.activeRoom=index;autosave();renderAll();}
function stepLevel(delta){activateLevel(project.activeLevel+delta);}
function stepRoom(delta){activateRoom(project.activeRoom+delta);}
function moveLevel(i,d){const n=i+d;if(n<0||n>=project.levels.length)return;pushHistory();[project.levels[i],project.levels[n]]=[project.levels[n],project.levels[i]];project.activeLevel=n;commit();renderAll();}

function selectPiece(id,flags=0,rotation=null){selected=id;placementFlags=flags&ENTITY_FLAG_MASK;placementRotation=rotation==null?((flags&ENTITY_ROTATION_MASK)>>ENTITY_ROTATION_SHIFT):(rotation&3);specialMode=paletteById.get(id)?.special||null;if(!specialMode)tool='pencil';renderPalette();renderInspector();updateToolButtons();}
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
  const canRotate=selected!==0&&specialMode!=='spawn';$('rotateCW').disabled=!canRotate;$('rotateCCW').disabled=!canRotate;$('pieceMeta').textContent=`${item.category} · ID ${item.id} · ${placementRotation*90}°`; 
  const opts=$('pieceOptions');opts.innerHTML='';
  if(item.options==='strawberry'){
    const label=document.createElement('label');label.className='option-row';const cb=document.createElement('input');cb.type='checkbox';cb.checked=(placementFlags&1)===0;cb.onchange=()=>{placementFlags=cb.checked?(placementFlags&~1):(placementFlags|1);};label.append(cb,document.createTextNode(' Contains a strawberry'));opts.append(label);
  }else if(item.options==='dashes'){
    const label=document.createElement('label');label.textContent='Dash upgrade';const sel=document.createElement('select');sel.innerHTML='<option value="2">2 dashes</option><option value="3">3 dashes</option>';sel.value=(placementFlags&2)?'3':'2';sel.onchange=()=>{placementFlags=sel.value==='3'?(placementFlags|2):(placementFlags&~2);};label.append(sel);opts.append(label);
  }else if(item.options==='link'){
    const label=document.createElement('label');label.textContent='Link group ';const input=document.createElement('input');input.type='number';input.min='0';input.max='63';input.step='1';input.value=String(placementFlags&63);input.oninput=()=>{const n=Math.max(0,Math.min(63,Number(input.value)||0));placementFlags=n;input.value=String(n);};label.append(input);opts.append(label);
  }
}
function rotateSelected(clockwise=true){if(selected===0||specialMode==='spawn')return;placementRotation=(placementRotation+(clockwise?1:3))&3;renderPalette();renderInspector();drawEditor();$('cursorStatus').textContent=`Placement rotation ${placementRotation*90}°`;}
function updateToolButtons(){for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool&&!specialMode);}
function resizeCanvas(){const z=Number($('zoom').value);canvas.width=128*z;canvas.height=128*z;canvas.style.width=`${128*z}px`;canvas.style.height=`${128*z}px`;ctx.imageSmoothingEnabled=false;$('zoomValue').textContent=`${z}×`;}
function fitCanvas(){const shell=document.querySelector('.canvas-shell');const room=Math.max(128,Math.min(shell.clientWidth-36,shell.clientHeight-36));$('zoom').value=String(Math.max(1,Math.min(4,Math.floor(room/128))));saveEditorPrefs();resizeCanvas();drawEditor();}
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
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const id=room.tiles[y*16+x];if(!id)continue;if(!drawPicoSprite(ctx,id,x*cell,y*cell,cell,false,false,1,room.rotations?.[y*16+x]||0)){ctx.fillStyle=tileColor(id);ctx.fillRect(x*cell,y*cell,cell,cell);}}
  for(const e of room.entities||[])drawLogicalPiece(ctx,e.type,e.x*cell,e.y*cell,cell,1,entityRotation(e));
  drawPicoSprite(ctx,1,room.spawnX*cell,room.spawnY*cell,cell,false,false,.72);
  if($('showGrid').checked){ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border');ctx.lineWidth=1;for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*cell+.5,0);ctx.lineTo(i*cell+.5,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell+.5);ctx.lineTo(canvas.width,i*cell+.5);ctx.stroke();}}
}
function cellAt(event){const rect=canvas.getBoundingClientRect();const x=Math.floor((event.clientX-rect.left)/rect.width*16),y=Math.floor((event.clientY-rect.top)/rect.height*16);return{x:Math.max(0,Math.min(15,x)),y:Math.max(0,Math.min(15,y)),index:y*16+x};}
function applyAt(x,y,index,forceErase=false){
  const room=currentRoom();
  if(specialMode==='spawn'){room.spawnX=x;room.spawnY=y;specialMode=null;renderPalette();renderInspector();return true;}
  const effective=forceErase?'eraser':tool;
  if(effective==='eyedropper'){
    const e=entityAtCell(room,x,y);if(e)selectPiece(e.type,e.flags||0,entityRotation(e));else selectPiece(room.tiles[index]||0,0,room.rotations?.[index]||0);tool='pencil';updateToolButtons();return false;
  }
  if(effective==='eraser'||selected===0){const e=entityAtCell(room,x,y);if(e){room.entities=room.entities.filter(v=>v!==e);return true;}if(room.tiles[index]!==0){room.tiles[index]=0;if(room.rotations)room.rotations[index]=0;return true;}return false;}
  if(effective==='fill'){
    if(ENTITY_TYPES.has(selected)||specialMode)return false;const from=room.tiles[index],fromRot=room.rotations?.[index]||0,to=selected;if(from===to&&fromRot===placementRotation)return false;const q=[index],seen=new Set(q);while(q.length){const p=q.pop();room.tiles[p]=to;room.rotations[p]=placementRotation;const px=p%16,py=Math.floor(p/16);for(const [nx,ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]])if(nx>=0&&nx<16&&ny>=0&&ny<16){const ni=ny*16+nx;if(!seen.has(ni)&&room.tiles[ni]===from&&(room.rotations?.[ni]||0)===fromRot){seen.add(ni);q.push(ni);}}}return true;
  }
  if(ENTITY_TYPES.has(selected)){
    const next={type:selected,x,y,flags:(placementFlags&ENTITY_FLAG_MASK)|((placementRotation&3)<<ENTITY_ROTATION_SHIFT)};const fp=entityFootprint(next);if(!footprintInBounds(fp)){$('cursorStatus').textContent='Piece does not fit at this edge';return false;}
    room.entities=(room.entities||[]).filter(e=>!footprintsOverlap(entityFootprint(e),fp));for(const p of fp){room.tiles[p.y*16+p.x]=0;room.rotations[p.y*16+p.x]=0;}room.entities.push(next);return true;
  }
  const overlapped=entityAtCell(room,x,y);if(overlapped)room.entities=room.entities.filter(e=>e!==overlapped);if(room.tiles[index]===selected&&(room.rotations?.[index]||0)===placementRotation)return false;room.tiles[index]=selected;room.rotations[index]=placementRotation;return true;
}

function recordStrokeChange(){if(!strokeHistoryAdded){history.push(strokeBefore);if(history.length>100)history.shift();future=[];strokeHistoryAdded=true;updateUndoButtons();}strokeChanged=true;drawEditor();}
function finishPointerStroke(){pointerDown=false;if(strokeChanged)commit();strokeHistoryAdded=strokeChanged=pointerCanPaint=false;strokeBefore=null;}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointerDown=true;lastCell=-1;strokeChanged=false;strokeBefore=snapshot();pointerCanPaint=e.button===2||tool==='eraser'||(tool==='pencil'&&!ENTITY_TYPES.has(selected)&&!specialMode);const c=cellAt(e);if(applyAt(c.x,c.y,c.index,e.button===2))recordStrokeChange();lastCell=c.index;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{const c=cellAt(e);$('cursorStatus').textContent=`x ${c.x}, y ${c.y}`;if(pointerDown&&pointerCanPaint&&c.index!==lastCell){if(applyAt(c.x,c.y,c.index,e.buttons===2))recordStrokeChange();lastCell=c.index;}});
canvas.addEventListener('pointerup',finishPointerStroke);canvas.addEventListener('pointercancel',finishPointerStroke);canvas.addEventListener('contextmenu',e=>e.preventDefault());

function bindText(id,key,level=false,number=false){$(id).addEventListener('change',()=>{pushHistory();const target=level?currentLevel():project;target[key]=number?Number($(id).value):$(id).value;commit();renderLists();updateSize();});}
bindText('packTitle','title');bindText('packAuthor','author');bindText('packDescription','description');bindText('levelTitle','title',true);bindText('levelAuthor','author',true);bindText('levelDescription','description',true);bindText('levelDifficulty','difficulty',true,true);
$('paletteSearch').oninput=renderPalette;$('paletteCategory').onchange=renderPalette;$('zoom').oninput=()=>{saveEditorPrefs();resizeCanvas();drawEditor();};
$('showGrid').onchange=()=>{saveEditorPrefs();drawEditor();};$('fitCanvas').onclick=fitCanvas;
$('toolButtons').addEventListener('click',e=>{if(e.target.dataset.tool){tool=e.target.dataset.tool;specialMode=null;updateToolButtons();renderPalette();}});
$('undo').onclick=undo;$('redo').onclick=redo;$('rotateCW').onclick=()=>rotateSelected(true);$('rotateCCW').onclick=()=>rotateSelected(false);
$('setSpawn').onclick=()=>selectPiece(1,0);
$('addLevel').onclick=()=>{pushHistory();project.levels.push(blankLevel(project.levels.length+1));project.activeLevel=project.levels.length-1;project.activeRoom=0;commit();renderAll();};
$('duplicateLevel').onclick=()=>{pushHistory();const source=currentLevel(),copy=structuredClone(source);copy.id=idFor('level-copy');copy.title=`${source.title} copy`.slice(0,63);copy.rooms=copy.rooms.map(room=>({...room,id:idFor('room-copy')}));project.levels.splice(project.activeLevel+1,0,copy);project.activeLevel++;project.activeRoom=0;commit();renderAll();};
$('deleteLevel').onclick=()=>{if(project.levels.length===1)return showMessage('Cannot delete level','Every pack must contain at least one level.');if(!confirm(`Delete “${currentLevel().title}”? You can still undo this action.`))return;pushHistory();project.levels.splice(project.activeLevel,1);project.activeLevel=Math.min(project.activeLevel,project.levels.length-1);project.activeRoom=0;commit();renderAll();};
$('addRoom').onclick=()=>{pushHistory();currentLevel().rooms.push(blankRoom());project.activeRoom=currentLevel().rooms.length-1;commit();renderAll();};
$('duplicateRoom').onclick=()=>{pushHistory();const r=currentRoom();const copy={...structuredClone(r),id:idFor('room-copy'),tiles:r.tiles.slice(),rotations:r.rotations.slice()};currentLevel().rooms.splice(project.activeRoom+1,0,copy);project.activeRoom++;commit();renderAll();};
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
$('validate').onclick=()=>showValidation(validatePack(project));$('themeButton').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';saveEditorPrefs();drawEditor();};

function showValidation(result){const box=$('validation');box.innerHTML='';if(result.valid&&!result.warnings.length){box.innerHTML='<p class="ok">No errors or warnings.</p>';return;}if(result.errors.length){const h=document.createElement('p');h.className='error';h.textContent=`${result.errors.length} error(s)`;box.append(h,list(result.errors,'error'));}if(result.warnings.length){const h=document.createElement('p');h.className='warning';h.textContent=`${result.warnings.length} warning(s)`;box.append(h,list(result.warnings,'warning'));}if(result.valid)showMessage('Validation passed',result.warnings.length?'The pack is valid, with warnings shown in the sidebar.':'The pack is valid.');}
function list(items,cls){const ul=document.createElement('ul');for(const t of items){const li=document.createElement('li');li.className=cls;li.textContent=t;ul.append(li);}return ul;}
function updateSize(){try{const l=encodeLevelPayload(currentLevel()).length,p=encodePackPayload(project).length;$('sizeStatus').textContent=`Level ${l.toLocaleString()} B · Pack ${p.toLocaleString()} B`;}catch(err){$('sizeStatus').textContent=err.message;}}
function download(bytes,name,type){const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeFile(s){return String(s||'celeste-project').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,60)||'celeste-project';}
function showMessage(title,body){$('messageTitle').textContent=title;$('messageBody').textContent=body;$('messageDialog').showModal();}
$('messageClose').onclick=()=>$('messageDialog').close();

window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(document.querySelector('dialog[open]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();stepRoom(-1);return;}
  if(e.altKey&&e.key==='ArrowRight'){e.preventDefault();stepRoom(1);return;}
  if(e.altKey&&e.key==='ArrowUp'){e.preventDefault();stepLevel(-1);return;}
  if(e.altKey&&e.key==='ArrowDown'){e.preventDefault();stepLevel(1);return;}
  if(e.key.toLowerCase()==='g'){$('showGrid').checked=!$('showGrid').checked;saveEditorPrefs();drawEditor();return;}
  if(e.key.toLowerCase()==='r'&&!$('previewDialog').open){e.preventDefault();rotateSelected(!e.shiftKey);return;}
  const map={b:'pencil',e:'eraser',f:'fill',i:'eyedropper'};if(map[e.key.toLowerCase()]){tool=map[e.key.toLowerCase()];specialMode=null;updateToolButtons();renderPalette();}
});

// Real PICO-8 preview: Studio generates a cartridge for the current level and
// executes it inside Fake-08 WebAssembly. Browser JavaScript no longer owns
// player physics, collision, entity timing, or room transitions.
const pico8Preview=createPico8Preview({
  canvas:previewCanvas,status:$('previewStatus'),dialog:$('previewDialog')
});
$('previewButton').onclick=async()=>{
  const validation=validateLevel(currentLevel());
  if(!validation.valid)return showValidation(validation);
  try{await pico8Preview.start(currentLevel());}
  catch(err){pico8Preview.stop();showMessage('PICO-8 preview failed',err?.message||String(err));}
};
$('closePreview').onclick=()=>pico8Preview.stop();
$('previewDialog').addEventListener('close',()=>pico8Preview.stop(false));

renderAll();
setSaveStatus(restoredProject?'Restored local autosave':'New project — saved after your first edit');
