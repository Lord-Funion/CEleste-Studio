#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace(path, old, new):
    p = ROOT / path
    s = p.read_text()
    if new in s:
        return False
    if old not in s:
        raise SystemExit(f'patch point not found in {path}: {old[:100]!r}')
    p.write_text(s.replace(old, new, 1))
    return True

changed=False

changed |= replace('app.js',
"const ENTITY_TYPES = new Set([8,11,12,18,20,22,23,26,28,64,86,96,118]);\nconst FRUIT_GATED_TYPES = new Set([20,26,28,64]);",
"const ENTITY_TYPES = new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129]);\nconst FRUIT_GATED_TYPES = new Set([20,26,28,64,129]);")

changed |= replace('app.js',
"  {id:20,name:'Locked chest',category:'Gameplay',entity:true,description:'Original key puzzle chest. By default it releases a strawberry after the room key is collected.',options:'strawberry',color:'#ce9250'},",
"  {id:20,name:'Locked chest',category:'Gameplay',entity:true,description:'Original key puzzle chest. By default it releases a strawberry after the room key is collected.',options:'strawberry',color:'#ce9250'},\n  {id:129,name:'Climb Chest',category:'Gameplay',entity:true,description:'Custom power-up chest. Touch it to unlock modern-Celeste-style wall grabbing for the rest of the level. On calculator hold MATH against a non-ice wall; Up climbs, Down descends, and stamina limits hanging/climbing.',color:'#74d9ff'},")

changed |= replace('app.js',
"function drawLogicalPiece(target,id,dx,dy,cell,alpha=1,rotation=0){\n  if(rotation){",
"function drawLogicalPiece(target,id,dx,dy,cell,alpha=1,rotation=0){\n  if(rotation){")
# Insert after the generic rotation wrapper so the complete special graphic rotates as a unit.
changed |= replace('app.js',
"  if(id===64){drawPicoSprite(target,64,dx,dy,cell,false,false,alpha);",
"  if(id===129){\n    drawPicoSprite(target,20,dx,dy,cell,false,false,alpha);\n    target.save();target.globalAlpha=alpha;target.fillStyle='#74d9ff';const c=cell/8;target.fillRect(dx+3*c,dy+2*c,2*c,4*c);target.fillRect(dx+2*c,dy+3*c,4*c,2*c);target.restore();return true;\n  }\n  if(id===64){drawPicoSprite(target,64,dx,dy,cell,false,false,alpha);")

changed |= replace('app.js',
"  if(id===64||id===96){drawLogicalPiece(target,id,3,3,14);return;}",
"  if(id===64||id===96){drawLogicalPiece(target,id,3,3,14);return;}\n  if(id===129){drawLogicalPiece(target,id,5,5,24);return;}")

changed |= replace('app.js',
"let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,won:false,raf:0,lastTime:0,accum:0,maxDashes:1,collectedSources:new Set(),entities:[]};",
"let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,won:false,raf:0,lastTime:0,accum:0,maxDashes:1,collectedSources:new Set(),entities:[],climbEnabled:false,climbStamina:1100,climbing:false};")

changed |= replace('app.js',
"function startPreview(){const validation=validateLevel(currentLevel());if(!validation.valid)return showValidation(validation);$('previewDialog').showModal();preview.running=true;preview.room=0;preview.maxDashes=1;preview.collectedSources=new Set();preview.lastTime=performance.now();preview.accum=0;resetPreview();previewLoop(preview.lastTime);}",
"function startPreview(){const validation=validateLevel(currentLevel());if(!validation.valid)return showValidation(validation);$('previewDialog').showModal();preview.running=true;preview.room=0;preview.maxDashes=1;preview.climbEnabled=false;preview.climbStamina=1100;preview.climbing=false;preview.collectedSources=new Set();preview.lastTime=performance.now();preview.accum=0;resetPreview();previewLoop(preview.lastTime);}")

changed |= replace('app.js',
"function resetPreview(){const r=currentLevel().rooms[preview.room];Object.assign(preview,{x:r.spawnX*8,y:r.spawnY*8,vx:0,vy:0,remX:0,remY:0,grace:0,jbuffer:0,djump:preview.maxDashes,dashTime:0,dashEffectTime:0,dashTargetX:0,dashTargetY:0,dashAccelX:0,dashAccelY:0,pJump:false,pDash:false,flipX:false,sprite:1,sprOff:0,wasOnGround:false,won:false,deadFrames:0,hasKey:false,hasDashed:false,entities:makePreviewEntities(r)});}",
"function resetPreview(){const r=currentLevel().rooms[preview.room];Object.assign(preview,{x:r.spawnX*8,y:r.spawnY*8,vx:0,vy:0,remX:0,remY:0,grace:0,jbuffer:0,djump:preview.maxDashes,dashTime:0,dashEffectTime:0,dashTargetX:0,dashTargetY:0,dashAccelX:0,dashAccelY:0,pJump:false,pDash:false,flipX:false,sprite:1,sprOff:0,wasOnGround:false,won:false,deadFrames:0,hasKey:false,hasDashed:false,climbStamina:1100,climbing:false,entities:makePreviewEntities(r)});}")

changed |= replace('app.js',
"window.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;preview.keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright','z','x','r'].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='r')resetPreview();});",
"window.addEventListener('keydown',e=>{if(!$('previewDialog').open)return;preview.keys.add(e.key.toLowerCase());if(['arrowup','arrowdown','arrowleft','arrowright','z','x','c','r'].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='r')resetPreview();});")

changed |= replace('app.js',
"    else if(e.type===102){e.vy=appr(e.vy,0,.5);e.py+=e.vy;if(e.vy===0&&rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.maxDashes=e.targetDashes||2;preview.djump=preview.maxDashes;e.alive=false;}}",
"    else if(e.type===102){e.vy=appr(e.vy,0,.5);e.py+=e.vy;if(e.vy===0&&rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.maxDashes=e.targetDashes||2;preview.djump=preview.maxDashes;e.alive=false;}}\n    else if(e.type===129){if(rectsOverlap(px,py,6,5,e.px,e.py,8,8)){preview.climbEnabled=true;preview.climbStamina=1100;preview.collectedSources.add(previewSourceKey(preview.room,e._source));e.alive=false;}}")

changed |= replace('app.js',
"  if(onGround){preview.grace=6;if(preview.djump<preview.maxDashes)preview.djump=preview.maxDashes;}else if(preview.grace>0)preview.grace--;preview.dashEffectTime--;\n  if(preview.dashTime>0){preview.dashTime--;preview.vx=appr(preview.vx,preview.dashTargetX,preview.dashAccelX);preview.vy=appr(preview.vy,preview.dashTargetY,preview.dashAccelY);}else{\n    const maxrun=1;",
"  if(onGround){preview.grace=6;if(preview.climbEnabled)preview.climbStamina=1100;if(preview.djump<preview.maxDashes)preview.djump=preview.maxDashes;}else if(preview.grace>0)preview.grace--;preview.dashEffectTime--;preview.climbing=false;\n  if(preview.dashTime>0){preview.dashTime--;preview.vx=appr(preview.vx,preview.dashTargetX,preview.dashAccelX);preview.vy=appr(preview.vy,preview.dashTargetY,preview.dashAccelY);}else{\n    let climbWall=0;if(preview.climbEnabled&&!onGround&&!dash&&pbtn('c')&&preview.climbStamina>0){if(playerSolid(room,-3,0)&&!iceAt(room,preview.x-2,preview.y+3,6,5))climbWall=-1;else if(playerSolid(room,3,0)&&!iceAt(room,preview.x+4,preview.y+3,6,5))climbWall=1;}\n    let climbing=climbWall!==0;if(climbing&&preview.jbuffer>0){preview.jbuffer=0;preview.climbStamina=Math.max(0,preview.climbStamina-275);preview.vy=-2;preview.vx=-climbWall*2;climbing=false;}\n    if(climbing){preview.vx=0;preview.flipX=climbWall<0;if(pbtn('arrowup')){preview.vy=-.8;preview.climbStamina=Math.max(0,preview.climbStamina-15);}else if(pbtn('arrowdown'))preview.vy=.8;else{preview.vy=0;preview.climbStamina=Math.max(0,preview.climbStamina-4);}if(preview.climbStamina===0)climbing=false;}preview.climbing=climbing;\n    if(!climbing){\n    const maxrun=1;")

changed |= replace('app.js',
"    if(preview.djump>0&&dash){preview.djump--;preview.hasDashed=true;preview.dashTime=4;preview.dashEffectTime=10;const vi=pbtn('arrowup')?-1:(pbtn('arrowdown')?1:0),full=5,half=3.5355339059;if(input!==0){if(vi!==0){preview.vx=input*half;preview.vy=vi*half;}else{preview.vx=input*full;preview.vy=0;}}else if(vi!==0){preview.vx=0;preview.vy=vi*full;}else{preview.vx=preview.flipX?-1:1;preview.vy=0;}preview.dashTargetX=2*sign(preview.vx);preview.dashTargetY=2*sign(preview.vy);preview.dashAccelX=1.5;preview.dashAccelY=1.5;if(preview.vy<0)preview.dashTargetY*=.75;if(preview.vy!==0)preview.dashAccelX=1.0606601718;if(preview.vx!==0)preview.dashAccelY=10.606601718;}\n  }\n  preview.sprOff++;if(!onGround)preview.sprite=playerSolid(room,input,0)?5:3;",
"    if(preview.djump>0&&dash){preview.djump--;preview.hasDashed=true;preview.dashTime=4;preview.dashEffectTime=10;const vi=pbtn('arrowup')?-1:(pbtn('arrowdown')?1:0),full=5,half=3.5355339059;if(input!==0){if(vi!==0){preview.vx=input*half;preview.vy=vi*half;}else{preview.vx=input*full;preview.vy=0;}}else if(vi!==0){preview.vx=0;preview.vy=vi*full;}else{preview.vx=preview.flipX?-1:1;preview.vy=0;}preview.dashTargetX=2*sign(preview.vx);preview.dashTargetY=2*sign(preview.vy);preview.dashAccelX=1.5;preview.dashAccelY=1.5;if(preview.vy<0)preview.dashTargetY*=.75;if(preview.vy!==0)preview.dashAccelX=1.0606601718;if(preview.vx!==0)preview.dashAccelY=10.606601718;}\n    }\n  }\n  preview.sprOff++;if(!onGround)preview.sprite=(preview.climbing||playerSolid(room,input,0))?5:3;")

changed |= replace('app.js',
"  $('previewStatus').textContent=preview.won?'Level complete!':`Room ${preview.room+1}/${currentLevel().rooms.length} · ${preview.djump}/${preview.maxDashes} dash${preview.maxDashes===1?'':'es'} · key ${preview.hasKey?'yes':'no'} · PICO-8 @ 30 Hz`;",
"  $('previewStatus').textContent=preview.won?'Level complete!':`Room ${preview.room+1}/${currentLevel().rooms.length} · ${preview.djump}/${preview.maxDashes} dash${preview.maxDashes===1?'':'es'} · key ${preview.hasKey?'yes':'no'} · climb ${preview.climbEnabled?Math.ceil(preview.climbStamina/10)+'/110':'locked'} · PICO-8 @ 30 Hz`;")

changed |= replace('lib/format.mjs',
"      if (![8,11,12,18,20,22,23,26,28,64,86,96,118].includes(entity.type)) errors.push(`${label}: unsupported gameplay entity type ${entity.type}.`);",
"      if (![8,11,12,18,20,22,23,26,28,64,86,96,118,129].includes(entity.type)) errors.push(`${label}: unsupported gameplay entity type ${entity.type}.`);")

changed |= replace('tests/format.test.mjs',
"test('validation rejects compound piece outside room', () => {",
"test('validation accepts Climb Chest entity 129', () => {\n  const good = level();\n  good.rooms[0].entities = [{ type: 129, x: 6, y: 8, flags: 0 }];\n  good.rooms[0].tiles[8*16+6] = 0;\n  const result = validateLevel(good);\n  assert.equal(result.valid, true);\n});\n\ntest('validation rejects compound piece outside room', () => {")

changed |= replace('index.html',
"<div class=\"dialog-head\"><div><h2>Playable preview</h2><p>PICO-8 physics: arrows move, Z jumps, X dashes, R restarts. Complete each room by exiting through the top.</p></div><button id=\"closePreview\">Close</button></div>",
"<div class=\"dialog-head\"><div><h2>Playable preview</h2><p>PICO-8 physics: arrows move, Z jumps, X dashes, C grabs/climbs after a Climb Chest (MATH on calculator), R restarts. Complete each room by exiting through the top.</p></div><button id=\"closePreview\">Close</button></div>")
changed |= replace('index.html',
"<script type=\"module\" src=\"app.js?v=20260808-arbitrary-rotation\"></script>",
"<script type=\"module\" src=\"app.js?v=20260808-climb-chest\"></script>")

changed |= replace('README.md',
"- Big chests can upgrade Madeline to two or three dashes\n",
"- Big chests can upgrade Madeline to two or three dashes\n- Climb Chest power-up: touch it to unlock `MATH` wall-grab/climbing with a 110-point stamina system for the rest of the level\n")

print('Applied Studio Climb Chest update.' if changed else 'Already applied.')