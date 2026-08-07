from pathlib import Path
p=Path('app.js')
s=p.read_text()
if 'const spriteAtlas = new Image();' in s:
    print('app.js already upgraded')
    raise SystemExit(0)
# Insert atlas helpers after paletteById
needle="const paletteById = new Map(paletteItems.map(i => [i.id, i]));\n"
insert=r'''const paletteById = new Map(paletteItems.map(i => [i.id, i]));

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
'''
assert needle in s
s=s.replace(needle,insert,1)

start=s.index("function renderPalette(filter=''){")
end=s.index("function updateToolButtons()",start)
new=r'''function renderPalette(filter=''){
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
'''
s=s[:start]+new+s[end:]

start=s.index("function drawEditor(){")
end=s.index("function drawMarker",start)
new=r'''function drawEditor(){
  const room=currentRoom(),scale=Number($('zoom').value),cell=TILE_SIZE*scale;ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const id=room.tiles[y*16+x]; if(!id) continue;
    if(!drawPicoSprite(ctx,id,x*cell,y*cell,cell)){ctx.fillStyle=tileColor(id);ctx.fillRect(x*cell,y*cell,cell,cell)}
  }
  for(const e of room.entities){
    if(!drawPicoSprite(ctx,e.type,e.x*cell,e.y*cell,cell)){ctx.fillStyle=tileColor(e.type);ctx.fillRect(e.x*cell,e.y*cell,cell,cell)}
  }
  // Spawn/exit metadata are overlays; gameplay still exits through the top like Celeste Classic.
  drawPicoSprite(ctx,1,room.spawnX*cell,room.spawnY*cell,cell,false,false,.72);
  drawPicoSprite(ctx,118,room.exitX*cell,room.exitY*cell,cell,false,false,.58);
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border');ctx.lineWidth=1;
  for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*cell+.5,0);ctx.lineTo(i*cell+.5,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell+.5);ctx.lineTo(canvas.width,i*cell+.5);ctx.stroke();}
}
'''
s=s[:start]+new+s[end:]

# Replace old preview block through renderAll call
start=s.index("// Lightweight preview.")
end=s.index("renderAll();",start)
preview=r'''// PICO-8-faithful preview core. Constants and collision rules mirror the
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

'''
s=s[:start]+preview+s[end:]
# update preview initial object fields line
s=s.replace("let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,onGround:false,dash:1,dashFrames:0,won:false,raf:0};","let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,won:false,raf:0,lastTime:0,accum:0,entities:[]};")
p.write_text(s)
