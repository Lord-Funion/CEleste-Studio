#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def rep(path,old,new,count=1):
    p=ROOT/path;t=p.read_text()
    if old not in t: raise SystemExit(f'missing marker {path}: {old[:100]!r}')
    p.write_text(t.replace(old,new,count))

# ---------- CELV v2 format ----------
p=ROOT/'lib/format.mjs';t=p.read_text()
t=t.replace("const VERSION = 1;", "const VERSION = 2;\nconst MIN_VERSION = 1;\nconst ROTATION_PLANE_BYTES = 64;\nconst ROTATION_ENCODING_2BPP = 1;\nexport const ENTITY_ROTATION_SHIFT = 6;\nexport const ENTITY_ROTATION_MASK = 0xc0;\nexport const ENTITY_FLAG_MASK = 0x3f;")
t=t.replace("MAGIC: 'CELV', VERSION, KIND_LEVEL, KIND_PACK, HEADER_SIZE, MAX_APPVAR_PAYLOAD,", "MAGIC: 'CELV', VERSION, MIN_VERSION, KIND_LEVEL, KIND_PACK, HEADER_SIZE, MAX_APPVAR_PAYLOAD, ROTATION_PLANE_BYTES, ROTATION_ENCODING_2BPP,")
t=t.replace("function normalizeRoom(room, index = 0) {\n  const width = room.width ?? 16, height = room.height ?? 16;\n  const size = width * height;\n  const tiles = room.tiles instanceof Uint8Array ? room.tiles : Uint8Array.from(room.tiles ?? []);\n  if (tiles.length !== size) throw new Error(`Room ${index + 1} has ${tiles.length} tiles; expected ${size}`);\n  return {", "function normalizeRoom(room, index = 0) {\n  const width = room.width ?? 16, height = room.height ?? 16;\n  const size = width * height;\n  const tiles = room.tiles instanceof Uint8Array ? room.tiles : Uint8Array.from(room.tiles ?? []);\n  const rotations = room.rotations instanceof Uint8Array ? room.rotations : Uint8Array.from(room.rotations ?? new Uint8Array(size));\n  if (tiles.length !== size) throw new Error(`Room ${index + 1} has ${tiles.length} tiles; expected ${size}`);\n  if (rotations.length !== size) throw new Error(`Room ${index + 1} has ${rotations.length} rotations; expected ${size}`);\n  for (const r of rotations) if (r > 3) throw new Error(`Room ${index + 1} has invalid rotation ${r}`);\n  return {")
t=t.replace("    flags: room.flags ?? 0,\n    tiles,", "    flags: room.flags ?? 0,\n    tiles, rotations,")
insert='''\nfunction packRotations(rotations) {\n  const out = new Uint8Array(ROTATION_PLANE_BYTES);\n  for (let i = 0; i < 256; i++) out[i >> 2] |= (rotations[i] & 3) << ((i & 3) * 2);\n  return out;\n}\nfunction unpackRotations(bytes) {\n  if (bytes.length !== ROTATION_PLANE_BYTES) throw new Error('Invalid rotation plane length');\n  const out = new Uint8Array(256);\n  for (let i = 0; i < 256; i++) out[i] = (bytes[i >> 2] >> ((i & 3) * 2)) & 3;\n  return out;\n}\n'''
t=t.replace("function encodeRoom(room, index) {", insert+"\nfunction encodeRoom(room, index) {")
t=t.replace("    .u8(room.flags).u8(0)\n    .u16(compressed.length).u16(room.entities.length).u32(room.id)\n    .bytes(compressed);", "    .u8(room.flags).u8(ROTATION_ENCODING_2BPP)\n    .u16(compressed.length).u16(room.entities.length).u32(room.id)\n    .bytes(compressed).bytes(packRotations(room.rotations));")
t=t.replace("function decodeRoom(reader, index) {", "function decodeRoom(reader, index, version) {")
t=t.replace("  const flags = reader.u8(); reader.u8();\n  const tileLength = reader.u16(), entityCount = reader.u16(), id = reader.u32();\n  const tiles = rleDecode(reader.take(tileLength, 'room tiles'), width * height);\n  const entities = [];", "  const flags = reader.u8(); const rotationEncoding = reader.u8();\n  const tileLength = reader.u16(), entityCount = reader.u16(), id = reader.u32();\n  const tiles = rleDecode(reader.take(tileLength, 'room tiles'), width * height);\n  let rotations = new Uint8Array(width * height);\n  if (version >= 2) {\n    if (rotationEncoding === ROTATION_ENCODING_2BPP) rotations = unpackRotations(reader.take(ROTATION_PLANE_BYTES, 'room rotations'));\n    else if (rotationEncoding !== 0) throw new Error(`Unsupported rotation encoding ${rotationEncoding}`);\n  }\n  const entities = [];")
t=t.replace("  return { id, width, height, spawnX, spawnY, exitX, exitY, flags, tiles, entities };", "  return { id, width, height, spawnX, spawnY, exitX, exitY, flags, tiles, rotations, entities };")
t=t.replace("    .u16(0x0100).u32(0).finish();", "    .u16(0x0101).u32(0).finish();")
t=t.replace("  const version = r.u8(); if (version !== VERSION) throw new Error(`Unsupported CEleste level format version ${version}`);", "  const version = r.u8(); if (version < MIN_VERSION || version > VERSION) throw new Error(`Unsupported CEleste level format version ${version}`);")
t=t.replace("for (let i = 0; i < itemCount; i++) rooms.push(decodeRoom(r, i));", "for (let i = 0; i < itemCount; i++) rooms.push(decodeRoom(r, i, version));")
t=t.replace("    if (!(room.tiles instanceof Uint8Array) || room.tiles.length !== room.width * room.height) errors.push(`${label}: tile array size is invalid.`);", "    if (!(room.tiles instanceof Uint8Array) || room.tiles.length !== room.width * room.height) errors.push(`${label}: tile array size is invalid.`);\n    if (!(room.rotations instanceof Uint8Array) || room.rotations.length !== room.width * room.height) errors.push(`${label}: rotation array size is invalid.`);\n    else for (const rotation of room.rotations) if (rotation > 3) { errors.push(`${label}: invalid tile rotation ${rotation}.`); break; }")
p.write_text(t)

# ---------- Studio editor ----------
p=ROOT/'app.js';t=p.read_text()
t=t.replace("const FRUIT_GATED_TYPES = new Set([20,26,28,64]);", "const FRUIT_GATED_TYPES = new Set([20,26,28,64]);\nconst ENTITY_ROTATION_SHIFT=6,ENTITY_ROTATION_MASK=0xc0,ENTITY_FLAG_MASK=0x3f;\nconst entityRotation=e=>((e.flags||0)&ENTITY_ROTATION_MASK)>>ENTITY_ROTATION_SHIFT;\nconst entityGameplayFlags=e=>(e.flags||0)&ENTITY_FLAG_MASK;")
start=t.index("// Real rotations that have genuine Celeste Classic counterparts.")
end=t.index("// Celeste Classic / PICO-8 sprite atlas.",start)
t=t[:start]+"// Rotation is stored independently from the atlas ID. Any graphical piece can use 0/90/180/270 degrees.\n\n"+t[end:]
old="""function drawPicoSprite(target,id,dx,dy,size,flipX=false,flipY=false,alpha=1){
  if(!spriteAtlasReady||id<0||id>127)return false;
  const sx=(id%16)*8,sy=Math.floor(id/16)*8;
  target.save();target.globalAlpha=alpha;target.imageSmoothingEnabled=false;
  target.translate(dx+(flipX?size:0),dy+(flipY?size:0));target.scale(flipX?-1:1,flipY?-1:1);
  target.drawImage(spriteAtlas,sx,sy,8,8,0,0,size,size);target.restore();return true;
}
function drawLogicalPiece(target,id,dx,dy,cell,alpha=1){
"""
new="""function drawPicoSprite(target,id,dx,dy,size,flipX=false,flipY=false,alpha=1,rotation=0){
  if(!spriteAtlasReady||id<0||id>127)return false;
  const sx=(id%16)*8,sy=Math.floor(id/16)*8;
  target.save();target.globalAlpha=alpha;target.imageSmoothingEnabled=false;
  target.translate(dx+size/2,dy+size/2);target.rotate((rotation&3)*Math.PI/2);target.scale(flipX?-1:1,flipY?-1:1);
  target.drawImage(spriteAtlas,sx,sy,8,8,-size/2,-size/2,size,size);target.restore();return true;
}
function pieceBounds(id,cell){if(id===64||id===96)return{ox:0,oy:0,w:2*cell,h:2*cell};if(id===86)return{ox:0,oy:-cell,w:2*cell,h:2*cell};if(id===11||id===12)return{ox:-cell/2,oy:-cell/8,w:2*cell,h:cell};return{ox:0,oy:0,w:cell,h:cell};}
function drawLogicalPiece(target,id,dx,dy,cell,alpha=1,rotation=0){
  if(rotation){const b=pieceBounds(id,cell),cx=dx+b.ox+b.w/2,cy=dy+b.oy+b.h/2;target.save();target.translate(cx,cy);target.rotate((rotation&3)*Math.PI/2);target.translate(-cx,-cy);drawLogicalPiece(target,id,dx,dy,cell,alpha,0);target.restore();return true;}
"""
if old not in t: raise SystemExit('drawPicoSprite marker missing')
t=t.replace(old,new,1)
t=t.replace("  return{id:idFor(label),width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,tiles,entities:[]};", "  return{id:idFor(label),width:16,height:16,spawnX:2,spawnY:13,exitX:13,exitY:1,flags:0,tiles,rotations:new Uint8Array(256),entities:[]};")
t=t.replace("function freshProject(){return{version:3,", "function freshProject(){return{version:4,")
t=t.replace("let tool='pencil',selected=37,specialMode=null,placementFlags=0,pointerDown=false,lastCell=-1;", "let tool='pencil',selected=37,specialMode=null,placementFlags=0,placementRotation=0,pointerDown=false,lastCell=-1;")
t=t.replace("for(const level of raw.levels){migrateLegacyTerrain(level,migrate);migrateLegacyEntities(level);for(const room of level.rooms){room.entities=(room.entities||[]).map(e=>({...e,flags:e.flags??0}));}}\n  raw.version=3;", "for(const level of raw.levels){migrateLegacyTerrain(level,migrate);migrateLegacyEntities(level);for(const room of level.rooms){room.rotations=room.rotations instanceof Uint8Array?room.rotations:Uint8Array.from(room.rotations||new Uint8Array(room.width*room.height));room.entities=(room.entities||[]).map(e=>({...e,flags:e.flags??0}));}}\n  raw.version=4;")
t=t.replace("function selectPiece(id,flags=0){selected=id;placementFlags=flags;specialMode=paletteById.get(id)?.special||null;", "function selectPiece(id,flags=0,rotation=null){selected=id;placementFlags=flags&ENTITY_FLAG_MASK;placementRotation=rotation==null?((flags&ENTITY_ROTATION_MASK)>>ENTITY_ROTATION_SHIFT):(rotation&3);specialMode=paletteById.get(id)?.special||null;")
t=t.replace("  const canRotate=rotateId(selected,true)!==selected;$('rotateCW').disabled=!canRotate;$('rotateCCW').disabled=!canRotate;", "  const canRotate=selected!==0&&specialMode!=='spawn';$('rotateCW').disabled=!canRotate;$('rotateCCW').disabled=!canRotate;$('pieceMeta').textContent=`${item.category} · ID ${item.id} · ${placementRotation*90}°`; ")
t=t.replace("function rotateSelected(clockwise=true){const next=rotateId(selected,clockwise);if(next===selected)return;selected=next;specialMode=paletteById.get(next)?.special||null;renderPalette();renderInspector();}", "function rotateSelected(clockwise=true){if(selected===0||specialMode==='spawn')return;placementRotation=(placementRotation+(clockwise?1:3))&3;renderPalette();renderInspector();drawEditor();$('cursorStatus').textContent=`Placement rotation ${placementRotation*90}°`;}")
t=t.replace("if(id)continue;", "if(id)continue;")
# Editor drawing + editing state.
t=t.replace("if(!drawPicoSprite(ctx,id,x*cell,y*cell,cell))", "if(!drawPicoSprite(ctx,id,x*cell,y*cell,cell,false,false,1,room.rotations?.[y*16+x]||0))")
t=t.replace("for(const e of room.entities||[])drawLogicalPiece(ctx,e.type,e.x*cell,e.y*cell,cell);", "for(const e of room.entities||[])drawLogicalPiece(ctx,e.type,e.x*cell,e.y*cell,cell,1,entityRotation(e));")
t=t.replace("const e=entityAtCell(room,x,y);if(e)selectPiece(e.type,e.flags||0);else selectPiece(room.tiles[index]||0,0);", "const e=entityAtCell(room,x,y);if(e)selectPiece(e.type,e.flags||0,entityRotation(e));else selectPiece(room.tiles[index]||0,0,room.rotations?.[index]||0);")
t=t.replace("if(effective==='eraser'||selected===0){const e=entityAtCell(room,x,y);if(e){room.entities=room.entities.filter(v=>v!==e);return true;}if(room.tiles[index]!==0){room.tiles[index]=0;return true;}return false;}", "if(effective==='eraser'||selected===0){const e=entityAtCell(room,x,y);if(e){room.entities=room.entities.filter(v=>v!==e);return true;}if(room.tiles[index]!==0){room.tiles[index]=0;if(room.rotations)room.rotations[index]=0;return true;}return false;}")
t=t.replace("if(ENTITY_TYPES.has(selected)||specialMode)return false;const from=room.tiles[index],to=selected;if(from===to)return false;const q=[index],seen=new Set(q);while(q.length){const p=q.pop();room.tiles[p]=to;", "if(ENTITY_TYPES.has(selected)||specialMode)return false;const from=room.tiles[index],fromRot=room.rotations?.[index]||0,to=selected;if(from===to&&fromRot===placementRotation)return false;const q=[index],seen=new Set(q);while(q.length){const p=q.pop();room.tiles[p]=to;room.rotations[p]=placementRotation;")
t=t.replace("if(!seen.has(ni)&&room.tiles[ni]===from){", "if(!seen.has(ni)&&room.tiles[ni]===from&&(room.rotations?.[ni]||0)===fromRot){")
t=t.replace("const next={type:selected,x,y,flags:placementFlags};", "const next={type:selected,x,y,flags:(placementFlags&ENTITY_FLAG_MASK)|((placementRotation&3)<<ENTITY_ROTATION_SHIFT)};")
t=t.replace("for(const p of fp)room.tiles[p.y*16+p.x]=0;", "for(const p of fp){room.tiles[p.y*16+p.x]=0;room.rotations[p.y*16+p.x]=0;}")
t=t.replace("if(room.tiles[index]===selected)return false;room.tiles[index]=selected;return true;", "if(room.tiles[index]===selected&&(room.rotations?.[index]||0)===placementRotation)return false;room.tiles[index]=selected;room.rotations[index]=placementRotation;return true;")
t=t.replace("const copy={...structuredClone(r),id:idFor('room-copy'),tiles:r.tiles.slice()};", "const copy={...structuredClone(r),id:idFor('room-copy'),tiles:r.tiles.slice(),rotations:r.rotations.slice()};")
# Preview: rotated spike direction + rendering.
old="function spikesAt(room,x,y,w,h,xspd,yspd){const x0=Math.max(0,Math.floor(x/8)),x1=Math.min(15,Math.floor((x+w-1)/8)),y0=Math.max(0,Math.floor(y/8)),y1=Math.min(15,Math.floor((y+h-1)/8));for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++){const tile=tileAt(room,i,j);if(tile===17&&(((y+h-1)%8)>=6||y+h===j*8+8)&&yspd>=0)return true;if(tile===27&&y%8<=2&&yspd<=0)return true;if(tile===43&&x%8<=2&&xspd<=0)return true;if(tile===59&&(((x+w-1)%8)>=6||x+w===i*8+8)&&xspd>=0)return true;}return false;}"
new="function spikesAt(room,x,y,w,h,xspd,yspd){const x0=Math.max(0,Math.floor(x/8)),x1=Math.min(15,Math.floor((x+w-1)/8)),y0=Math.max(0,Math.floor(y/8)),y1=Math.min(15,Math.floor((y+h-1)/8));for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++){let tile=tileAt(room,i,j);const rot=room.rotations?.[j*16+i]||0;let dir=tile===17?0:tile===59?1:tile===27?2:tile===43?3:-1;if(dir>=0){dir=(dir+rot)&3;tile=dir===0?17:dir===1?59:dir===2?27:43;}if(tile===17&&(((y+h-1)%8)>=6||y+h===j*8+8)&&yspd>=0)return true;if(tile===27&&y%8<=2&&yspd<=0)return true;if(tile===43&&x%8<=2&&xspd<=0)return true;if(tile===59&&(((x+w-1)%8)>=6||x+w===i*8+8)&&xspd>=0)return true;}return false;}"
if old not in t: raise SystemExit('spikes marker missing')
t=t.replace(old,new,1)
t=t.replace("drawLogicalPiece(pctx,e.type,e.px*scale,e.py*scale,32);", "drawLogicalPiece(pctx,e.type,e.px*scale,e.py*scale,32,1,entityRotation(e));")
t=t.replace("if(id&&!drawPicoSprite(pctx,id,x*32,y*32,32))", "if(id&&!drawPicoSprite(pctx,id,x*32,y*32,32,false,false,1,room.rotations?.[y*16+x]||0))")
p.write_text(t)

# ---------- interaction hardening: no counterpart assumptions ----------
p=ROOT/'interaction-fix.js';t=p.read_text()
# Preserve only the focus/capture shortcut layer; app.js owns rotation state/buttons.
start=t.index('const ROTATE_CW = new Map(')
end=t.index('function isEditableTarget',start)
replacement='''function focusEditor() {\n  if (!editorCanvas) return;\n  try { editorCanvas.focus({ preventScroll: true }); }\n  catch { editorCanvas.focus(); }\n}\n\n'''
t=t[:start]+replacement+t[end:]
# Drop obsolete mutation observer block.
a=t.index('// Keep rotation button state synchronized')
b=t.index('// Palette/tool clicks',a)
t=t[:a]+t[b:]
t=t.replace("    queueMicrotask(() => {\n      syncRotationControls(true);\n      focusEditor();\n    });", "    queueMicrotask(focusEditor);")
old="""    syncRotationControls(false);
    const button = event.shiftKey ? rotateCCW : rotateCW;
    if (button && !button.disabled) {
      button.click();
      queueMicrotask(() => {
        syncRotationControls(true);
        focusEditor();
      });
    } else if (cursorStatus) {
      setRotationStatus(selectedPieceId());
    }
"""
new="""    const button = event.shiftKey ? rotateCCW : rotateCW;
    if (button && !button.disabled) button.click();
    queueMicrotask(focusEditor);
"""
if old not in t: raise SystemExit('interaction R handler marker missing')
t=t.replace(old,new,1)
p.write_text(t)

# ---------- HTML text/cache ----------
p=ROOT/'index.html';t=p.read_text()
t=t.replace('Press <kbd>R</kbd> to rotate clockwise, <kbd>Shift+R</kbd> for counter-clockwise. Rotation uses real PICO-8 counterpart tiles/directions, so exports match the calculator.', 'Press <kbd>R</kbd> to rotate clockwise, <kbd>Shift+R</kbd> for counter-clockwise. Rotation is stored independently, so any graphical piece can be turned 0°, 90°, 180°, or 270° and exported exactly to the calculator.')
t=t.replace('interaction-fix.js?v=20260808-rotation-targets', 'interaction-fix.js?v=20260808-arbitrary-rotation')
t=t.replace('interaction-fix.js?v=20260808-1109', 'interaction-fix.js?v=20260808-arbitrary-rotation')
t=t.replace('app.js?v=20260807-2255', 'app.js?v=20260808-arbitrary-rotation')
p.write_text(t)

# ---------- tests ----------
p=ROOT/'tests/format.test.mjs';t=p.read_text()
t=t.replace("  return { id: 100 + seed, width: 16, height: 16, spawnX: 2, spawnY: 13, exitX: 14, exitY: 1, flags: 0, tiles, entities:", "  const rotations = new Uint8Array(256);\n  return { id: 100 + seed, width: 16, height: 16, spawnX: 2, spawnY: 13, exitX: 14, exitY: 1, flags: 0, tiles, rotations, entities:")
append='''\n\ntest('arbitrary tile rotations survive CELV v2 and 8xv round trips', () => {\n  const original=level();\n  original.rooms[0].rotations[34]=1; original.rooms[0].rotations[35]=2; original.rooms[0].rotations[36]=3;\n  const decoded=decodePayload(encodeLevelPayload(original));\n  assert.equal(decoded.version,2);\n  assert.equal(decoded.rooms[0].tiles[34],original.rooms[0].tiles[34]);\n  assert.deepEqual(Array.from(decoded.rooms[0].rotations.slice(34,37)),[1,2,3]);\n  const wrapped=import8xv(exportLevel8xv(original,{name:'CLROTATE'})).data;\n  assert.deepEqual(Array.from(wrapped.rooms[0].rotations.slice(34,37)),[1,2,3]);\n});\n\ntest('entity rotation shares flags without breaking gameplay options', () => {\n  const original=level();\n  original.rooms[0].entities=[\n    {type:20,x:5,y:8,flags:(1<<6)},\n    {type:64,x:9,y:8,flags:1|(2<<6)},\n    {type:96,x:4,y:11,flags:2|(3<<6)}\n  ];\n  const decoded=decodePayload(encodeLevelPayload(original));\n  assert.deepEqual(decoded.rooms[0].entities.map(e=>e.flags),[64,129,194]);\n});\n'''
t+=append
p.write_text(t)

print('Studio arbitrary rotation v2 patches applied.')
