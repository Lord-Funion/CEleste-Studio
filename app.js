import {
  fnv1a, exportLevel8xv, exportPack8xv, import8xv, validateLevel, validatePack,
  encodeLevelPayload, encodePackPayload, makeVarName
} from './lib/format.mjs';

const TILE_SIZE = 8;
const ENTITY_TYPES = new Set([1,8,11,12,18,20,22,23,26,28,64,86,96,118]);
const paletteItems = [
  {id:0,name:'Empty',color:'#090811'}, {id:2,name:'Rock A',color:'#6d586f'}, {id:3,name:'Rock B',color:'#8a718d'},
  {id:4,name:'Ice',color:'#7ee5ef'}, {id:5,name:'Snow',color:'#edfaff'}, {id:17,name:'Spikes',color:'#cfd7e7'},
  {id:27,name:'Spikes alt',color:'#9da9ba'}, {id:1,name:'Player spawn',color:'#ff557f',special:'spawn'},
  {id:118,name:'Finish flag',color:'#80e78b',special:'exit'}, {id:18,name:'Spring',color:'#e54b67',entity:true},
  {id:22,name:'Dash balloon',color:'#79d8f5',entity:true}, {id:23,name:'Falling floor',color:'#e7ba62',entity:true},
  {id:26,name:'Strawberry',color:'#f44762',entity:true}, {id:28,name:'Flying berry',color:'#ff7790',entity:true},
  {id:64,name:'Fake wall',color:'#5f4564',entity:true}, {id:8,name:'Key',color:'#ffe66b',entity:true},
  {id:20,name:'Chest',color:'#ce9250',entity:true}, {id:11,name:'Platform left',color:'#a989d2',entity:true},
  {id:12,name:'Platform right',color:'#bba2e8',entity:true}, {id:86,name:'Message',color:'#e7e4ff',entity:true},
  {id:96,name:'Big chest',color:'#d9a766',entity:true}
];
const paletteById = new Map(paletteItems.map(i => [i.id, i]));

const $ = id => document.getElementById(id);
const canvas = $('editorCanvas'), ctx = canvas.getContext('2d');
const previewCanvas = $('previewCanvas'), pctx = previewCanvas.getContext('2d');

function idFor(label) { return fnv1a(`${label}|${Date.now()}|${Math.random()}`); }
function blankRoom(label='Room') {
  const tiles = new Uint8Array(256);
  for (let x=0;x<16;x++) tiles[15*16+x]=2;
  for (let y=0;y<16;y++){ tiles[y*16]=2; tiles[y*16+15]=2; }
  return {id:idFor(label),width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,tiles,entities:[]};
}
function blankLevel(index=1) { return {id:idFor(`level-${index}`),title:`Level ${index}`,author:'Lord Funion',description:'',difficulty:2,rooms:[blankRoom()]}; }
function freshProject(){return {version:1,id:idFor('pack'),title:'My CEleste Pack',author:'Lord Funion',description:'',levels:[blankLevel(1)],activeLevel:0,activeRoom:0};}

let project = loadAutosave() || freshProject();
let tool='pencil', selected=2, specialMode=null, pointerDown=false, lastCell=-1;
let history=[], future=[];
let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,onGround:false,dash:1,dashFrames:0,won:false,raf:0};

function currentLevel(){return project.levels[project.activeLevel];}
function currentRoom(){return currentLevel().rooms[project.activeRoom];}
function serializableProject(){return JSON.parse(JSON.stringify(project,(k,v)=>v instanceof Uint8Array?Array.from(v):v));}
function reviveProject(raw){
  if(!raw?.levels?.length) throw new Error('Project contains no levels');
  for(const level of raw.levels) for(const room of level.rooms) room.tiles=room.tiles instanceof Uint8Array?room.tiles:Uint8Array.from(room.tiles||[]);
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
    const b=document.createElement('button');b.className='palette-item'+(selected===item.id&&!specialMode?' active':'');b.title=`Tile ID ${item.id}`;
    const sw=document.createElement('span');sw.className='swatch';sw.style.background=item.color;b.append(sw,document.createTextNode(item.name));
    b.onclick=()=>{selected=item.id;specialMode=item.special||null;if(!item.special)tool='pencil';renderPalette($('paletteSearch').value);updateToolButtons();};$('palette').append(b);
  }
}
function updateToolButtons(){for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool&&!specialMode);}
function resizeCanvas(){const z=Number($('zoom').value);canvas.width=128*z;canvas.height=128*z;canvas.style.width=`${128*z}px`;canvas.style.height=`${128*z}px`;ctx.imageSmoothingEnabled=false;}
function tileColor(id){return paletteById.get(id)?.color||`hsl(${(id*47)%360} 35% 48%)`;}
function drawEditor(){
  const room=currentRoom(),scale=Number($('zoom').value),cell=TILE_SIZE*scale;ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const id=room.tiles[y*16+x];ctx.fillStyle=tileColor(id);ctx.fillRect(x*cell,y*cell,cell,cell);if(id){ctx.fillStyle='#0008';ctx.font=`${Math.max(8,scale*3)}px sans-serif`;ctx.fillText(String(id),x*cell+2,y*cell+Math.max(9,scale*3));}}
  for(const e of room.entities){ctx.fillStyle=tileColor(e.type);ctx.fillRect(e.x*cell+cell*.18,e.y*cell+cell*.18,cell*.64,cell*.64);ctx.strokeStyle='#fff';ctx.strokeRect(e.x*cell+cell*.18,e.y*cell+cell*.18,cell*.64,cell*.64);}
  drawMarker(room.spawnX,room.spawnY,'S','#ff386b',cell);drawMarker(room.exitX,room.exitY,'E','#54e179',cell);
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border');ctx.lineWidth=1;
  for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*cell+.5,0);ctx.lineTo(i*cell+.5,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell+.5);ctx.lineTo(canvas.width,i*cell+.5);ctx.stroke();}
}
function drawMarker(x,y,text,color,cell){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x*cell+cell/2,y*cell+cell/2,Math.max(5,cell*.28),0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.max(9,cell*.38)}px sans-serif`;ctx.fillText(text,x*cell+cell/2,y*cell+cell/2);ctx.textAlign='start';ctx.textBaseline='alphabetic';}
function cellAt(event){const rect=canvas.getBoundingClientRect();const x=Math.floor((event.clientX-rect.left)/rect.width*16),y=Math.floor((event.clientY-rect.top)/rect.height*16);return{x:Math.max(0,Math.min(15,x)),y:Math.max(0,Math.min(15,y)),index:y*16+x};}
function applyAt(x,y,index,forceErase=false){
  const room=currentRoom();
  if(specialMode==='spawn'){room.spawnX=x;room.spawnY=y;specialMode=null;renderPalette($('paletteSearch').value);return true}
  if(specialMode==='exit'){room.exitX=x;room.exitY=y;specialMode=null;renderPalette($('paletteSearch').value);return true}
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
$('setSpawn').onclick=()=>{specialMode='spawn';selected=1;renderPalette($('paletteSearch').value)};$('setExit').onclick=()=>{specialMode='exit';selected=118;renderPalette($('paletteSearch').value)};
$('addLevel').onclick=()=>{pushHistory();project.levels.push(blankLevel(project.levels.length+1));project.activeLevel=project.levels.length-1;project.activeRoom=0;commit();renderAll();};
$('addRoom').onclick=()=>{pushHistory();currentLevel().rooms.push(blankRoom());project.activeRoom=currentLevel().rooms.length-1;commit();renderAll();};
$('duplicateRoom').onclick=()=>{pushHistory();const r=currentRoom();const copy={...structuredClone(r),id:idFor('room-copy'),tiles:r.tiles.slice()};currentLevel().rooms.splice(project.activeRoom+1,0,copy);project.activeRoom++;commit();renderAll();};
$('deleteRoom').onclick=()=>{if(currentLevel().rooms.length===1)return showMessage('Cannot delete room','Every level must contain at least one room.');pushHistory();currentLevel().rooms.splice(project.activeRoom,1);project.activeRoom=Math.max(0,project.activeRoom-1);commit();renderAll();};
function moveRoom(d){const rooms=currentLevel().rooms,i=project.activeRoom,n=i+d;if(n<0||n>=rooms.length)return;pushHistory();[rooms[i],rooms[n]]=[rooms[n],rooms[i]];project.activeRoom=n;commit();renderAll();}
$('moveRoomUp').onclick=()=>moveRoom(-1);$('moveRoomDown').onclick=()=>moveRoom(1);

$('newProject').onclick=()=>{if(confirm('Create a new project? The current autosave will be replaced.')){pushHistory();project=freshProject();history=[];future=[];commit();renderAll();}};
$('saveProject').onclick=()=>download(new TextEncoder().encode(JSON.stringify(serializableProject(),null,2)),`${safeFile(project.title)}.celproj`,'application/json');
$('openProject').onchange=async e=>{try{const raw=JSON.parse(await e.target.files[0].text());pushHistory();project=reviveProject(raw);commit();renderAll();showMessage('Project opened',`${project.levels.length} level(s) loaded.`)}catch(err){showMessage('Could not open project',err.message)}e.target.value='';};
$('import8xv').onchange=async e=>{let count=0;const failures=[];pushHistory();for(const file of e.target.files){try{const imported=import8xv(new Uint8Array(await file.arrayBuffer()));if(imported.data.kind==='level'){project.levels.push(imported.data);count++}else{project.title=imported.data.title;project.author=imported.data.author;project.description=imported.data.description;project.levels.push(...imported.data.levels);count+=imported.data.levels.length}}catch(err){failures.push(`${file.name}: ${err.message}`)}}if(project.levels.length>1&&project.levels[0].title==='Level 1'&&isBlank(project.levels[0]))project.levels.shift();project.activeLevel=Math.max(0,project.levels.length-count);project.activeRoom=0;commit();renderAll();showMessage('Import complete',`${count} level(s) imported.${failures.length?'\n\nFailed:\n'+failures.join('\n'):''}`);e.target.value='';};
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

// Lightweight preview. It intentionally models the editor collision grid rather than claiming byte-for-byte game physics.
$('previewButton').onclick=()=>startPreview();$('closePreview').onclick=()=>stopPreview();$('previewDialog').addEventListener('close',stopPreview);
function startPreview(){const validation=validateLevel(currentLevel());if(!validation.valid)return showValidation(validation);$('previewDialog').showModal();preview.running=true;preview.room=0;resetPreview();previewLoop();}
function stopPreview(){preview.running=false;cancelAnimationFrame(preview.raf);preview.keys.clear();if($('previewDialog').open)$('previewDialog').close();}
function resetPreview(){const r=currentLevel().rooms[preview.room];preview.x=r.spawnX*8+1;preview.y=r.spawnY*8;preview.vx=0;preview.vy=0;preview.dash=1;preview.dashFrames=0;preview.won=false;}
window.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;preview.keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright','z','x','r'].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='r')resetPreview();});
window.addEventListener('keyup',e=>preview.keys.delete(e.key.toLowerCase()));
function solid(room,x,y){const tx=Math.floor(x/8),ty=Math.floor(y/8);if(tx<0||tx>=16||ty<0||ty>=16)return true;return [2,3,4,5,17,27,23,64].includes(room.tiles[ty*16+tx]);}
function collides(room,x,y){return solid(room,x+1,y+1)||solid(room,x+6,y+1)||solid(room,x+1,y+7)||solid(room,x+6,y+7);}
function moveAxis(room,amount,axis){const step=Math.sign(amount),whole=Math.abs(Math.round(amount));for(let i=0;i<whole;i++){const nx=preview.x+(axis==='x'?step:0),ny=preview.y+(axis==='y'?step:0);if(collides(room,nx,ny)){if(axis==='y'&&step>0)preview.onGround=true;if(axis==='x')preview.vx=0;else preview.vy=0;return}else{preview.x=nx;preview.y=ny}}}
function previewLoop(){if(!preview.running)return;const room=currentLevel().rooms[preview.room];preview.onGround=false;const left=preview.keys.has('arrowleft'),right=preview.keys.has('arrowright');preview.vx+=(right-left)*.42;preview.vx*=.82;preview.vx=Math.max(-2.1,Math.min(2.1,preview.vx));if(preview.keys.has('z')&&collides(room,preview.x,preview.y+1)&&!preview.jumpLock){preview.vy=-3.6;preview.jumpLock=true}if(!preview.keys.has('z'))preview.jumpLock=false;if(preview.keys.has('x')&&preview.dash&&!preview.dashLock){let dx=(right-left),dy=(preview.keys.has('arrowdown')?1:0)-(preview.keys.has('arrowup')?1:0);if(!dx&&!dy)dx=1;const len=Math.hypot(dx,dy);preview.vx=dx/len*5;preview.vy=dy/len*5;preview.dash=0;preview.dashFrames=6;preview.dashLock=true}if(!preview.keys.has('x'))preview.dashLock=false;if(preview.dashFrames)preview.dashFrames--;else preview.vy=Math.min(4,preview.vy+.28);moveAxis(room,preview.vx,'x');moveAxis(room,preview.vy,'y');if(collides(room,preview.x,preview.y+1)){preview.onGround=true;preview.dash=1}
  const cx=Math.floor((preview.x+4)/8),cy=Math.floor((preview.y+4)/8);for(const e of room.entities){if(e.x===cx&&e.y===cy&&e.type===22)preview.dash=1;if(e.x===cx&&e.y===cy&&e.type===18)preview.vy=-5}
  if(Math.abs(cx-room.exitX)<=0&&Math.abs(cy-room.exitY)<=0){if(preview.room<currentLevel().rooms.length-1){preview.room++;resetPreview()}else preview.won=true}
  drawPreview(room);preview.raf=requestAnimationFrame(previewLoop);
}
function drawPreview(room){const scale=4;pctx.fillStyle='#090811';pctx.fillRect(0,0,512,512);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const id=room.tiles[y*16+x];if(id){pctx.fillStyle=tileColor(id);pctx.fillRect(x*8*scale,y*8*scale,8*scale,8*scale)}}for(const e of room.entities){pctx.fillStyle=tileColor(e.type);pctx.fillRect(e.x*32+8,e.y*32+8,16,16)}pctx.fillStyle='#50df7b';pctx.fillRect(room.exitX*32+10,room.exitY*32+2,12,28);pctx.fillStyle='#f25b82';pctx.fillRect(preview.x*scale,preview.y*scale,7*scale,8*scale);$('previewStatus').textContent=preview.won?'Level complete!':`Room ${preview.room+1}/${currentLevel().rooms.length} · dash ${preview.dash?'ready':'used'}`;}

renderAll();
