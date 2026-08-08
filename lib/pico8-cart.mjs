export const PICO8_PALETTE=[
 [0x00,0x00,0x00],[0x1d,0x2b,0x53],[0x7e,0x25,0x53],[0x00,0x87,0x51],
 [0xab,0x52,0x36],[0x5f,0x57,0x4f],[0xc2,0xc3,0xc7],[0xff,0xf1,0xe8],
 [0xff,0x00,0x4d],[0xff,0xa3,0x00],[0xff,0xec,0x27],[0x00,0xe4,0x36],
 [0x29,0xad,0xff],[0x83,0x76,0x9c],[0xff,0x77,0xa8],[0xff,0xcc,0xaa]
];

export const TILE_MASK=new Uint8Array([
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 4,2,0,0,0,0,0,0,0,0,0,2,0,0,0,0,
 3,3,3,3,3,3,3,3,4,4,4,2,2,0,0,0,
 3,3,3,3,3,3,3,3,4,4,4,2,2,2,2,2,
 0,0,19,19,19,19,2,2,3,2,2,2,2,2,2,2,
 0,0,19,19,19,19,2,2,4,2,2,2,2,2,2,2,
 0,0,19,19,19,19,0,4,4,2,2,2,2,2,2,2,
 0,0,19,19,19,19,0,0,0,2,2,2,2,2,2,2
]);

const HEX='0123456789abcdef';
const SUPPORTED_ENTITIES=new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129]);
const SPIKE_FAMILY=[17,59,27,43];
const SIMPLE_ROTATION_ENTITIES=new Set([8,18,20,23,26]);
const hexByte=n=>(n&255).toString(16).padStart(2,'0');

export function packRotations(rotations){
 const src=rotations instanceof Uint8Array?rotations:Uint8Array.from(rotations||[]);
 if(src.length!==256)throw new Error(`PICO-8 preview requires 256 rotation cells, got ${src.length}`);
 const out=new Uint8Array(64);
 for(let i=0;i<256;i++){
  const r=src[i];if(r>3)throw new Error(`Invalid rotation ${r} at cell ${i}`);
  out[i>>2]|=(r&3)<<((i&3)*2);
 }
 return out;
}

export function encodeRoomRecord(room){
 if(room.width!==16||room.height!==16)throw new Error('PICO-8 preview rooms must be 16x16');
 const entities=room.entities||[];
 if(entities.length>48)throw new Error('PICO-8 preview supports at most 48 entities per room');
 const bytes=[room.spawnX&255,room.spawnY&255,...packRotations(room.rotations),entities.length&255];
 for(const e of entities){
  if(!SUPPORTED_ENTITIES.has(e.type))throw new Error(`Unsupported preview entity ${e.type}`);
  if(e.x<0||e.x>15||e.y<0||e.y>15)throw new Error(`Entity ${e.type} is outside the room`);
  bytes.push(e.type&255,e.x&255,e.y&255,(e.flags||0)&255);
 }
 return bytes.map(hexByte).join('');
}

export function atlasRgbaToPicoIndices(rgba,width=128,height=64){
 if(width!==128||height!==64)throw new Error(`Expected 128x64 Celeste atlas, got ${width}x${height}`);
 if(rgba.length!==width*height*4)throw new Error('Atlas RGBA buffer has the wrong size');
 const key=new Map(PICO8_PALETTE.map((c,i)=>[c.join(','),i]));
 const out=new Uint8Array(width*height);
 for(let i=0;i<out.length;i++){
  if(rgba[i*4+3]<128){out[i]=0;continue;}
  const k=`${rgba[i*4]},${rgba[i*4+1]},${rgba[i*4+2]}`;
  const idx=key.get(k);if(idx===undefined)throw new Error(`Atlas contains non-PICO-8 color rgb(${k}) at pixel ${i}`);
  out[i]=idx;
 }
 return out;
}

function directionalSpike(id,rotation){
 const i=SPIKE_FAMILY.indexOf(id);
 return i<0||!rotation?id:SPIKE_FAMILY[(i+(rotation&3))&3];
}

function validateLevelShape(level){
 if(!level?.rooms?.length)throw new Error('Preview level has no rooms');
 if(level.rooms.length>32)throw new Error('The original Celeste map supports at most 32 Studio rooms');
 for(let ri=0;ri<level.rooms.length;ri++){
  const room=level.rooms[ri];
  if(room.width!==16||room.height!==16)throw new Error(`Room ${ri+1} is not 16x16`);
  if((room.entities||[]).length>48)throw new Error(`Room ${ri+1} has more than 48 entities`);
  const tiles=room.tiles instanceof Uint8Array?room.tiles:Uint8Array.from(room.tiles||[]);
  const rotations=room.rotations instanceof Uint8Array?room.rotations:Uint8Array.from(room.rotations||[]);
  if(tiles.length!==256)throw new Error(`Room ${ri+1} tile plane is not 256 cells`);
  if(rotations.length!==256)throw new Error(`Room ${ri+1} rotation plane is not 256 cells`);
  for(const id of tiles)if(id>127)throw new Error(`Room ${ri+1} contains tile ${id}, outside the original Celeste atlas`);
  for(const e of room.entities||[]){
   if(!SUPPORTED_ENTITIES.has(e.type))throw new Error(`Unsupported preview entity ${e.type}`);
   if(e.x<0||e.x>15||e.y<0||e.y>15)throw new Error(`Entity ${e.type} is outside room ${ri+1}`);
  }
 }
}

function buildOriginalMap(level){
 validateLevelShape(level);
 const map=Array.from({length:64},()=>new Uint8Array(128));
 for(let ri=0;ri<level.rooms.length;ri++){
  const room=level.rooms[ri],tiles=room.tiles,rots=room.rotations;
  const ox=(ri%8)*16,oy=Math.floor(ri/8)*16;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const i=y*16+x,id=tiles[i];
   map[oy+y][ox+x]=directionalSpike(id,rots[i]);
  }
  map[oy+(room.spawnY&15)][ox+(room.spawnX&15)]=1;
  for(const e of room.entities||[])map[oy+(e.y&15)][ox+(e.x&15)]=e.type&255;
 }
 return map;
}

function buildSharedMapGfxLines(map){
 const lines=[];
 for(let my=32;my<64;my++)for(let half=0;half<2;half++){
  let line='';
  for(let mx=half*64;mx<half*64+64;mx++){
   const b=map[my][mx];line+=HEX[b&15]+HEX[(b>>4)&15];
  }
  lines.push(line);
 }
 return lines;
}

function buildMapSection(map){return map.slice(0,32).map(row=>Array.from(row,hexByte).join('')).join('\n');}

function sectionInfo(text,name){
 const re=/^__([a-z0-9_]+)__\s*$/gmi,found=[];let m;
 while((m=re.exec(text)))found.push({name:m[1].toLowerCase(),start:m.index,bodyStart:re.lastIndex});
 const i=found.findIndex(x=>x.name===name.toLowerCase());
 if(i<0)throw new Error(`Original cart is missing __${name}__`);
 return {...found[i],bodyEnd:i+1<found.length?found[i+1].start:text.length};
}
function getSection(text,name){const s=sectionInfo(text,name);return text.slice(s.bodyStart,s.bodyEnd).replace(/^\s*\n/,'').replace(/\s+$/,'');}
function replaceSection(text,name,body){
 const s=sectionInfo(text,name),before=text.slice(0,s.bodyStart).replace(/\s*$/,''),after=text.slice(s.bodyEnd).replace(/^\s*/,'\n');
 return `${before}\n${String(body).replace(/\s+$/,'')}\n${after}`;
}

function buildRotationStrings(level){
 return `{${level.rooms.map(room=>{
  const effective=Uint8Array.from(room.rotations);
  for(let i=0;i<256;i++)if(SPIKE_FAMILY.includes(room.tiles[i])&&effective[i])effective[i]=0;
  return `\"${Array.from(packRotations(effective),hexByte).join('')}\"`;
 }).join(',')}}`;
}

function buildEntityRows(level){
 const rows=[];
 for(let ri=0;ri<level.rooms.length;ri++)for(const e of level.rooms[ri].entities||[]){
  rows.push(`{${ri},${e.x&15},${e.y&15},${e.type&255},${(e.flags||0)&255}}`);
 }
 return `{${rows.join(',')}}`;
}

function buildPrivatePatch(level){
 const roomCount=level.rooms.length,rotRows=buildRotationStrings(level),entityRows=buildEntityRows(level);
 return `\n-- celeste studio private original-cart patch\nstudio_room_count=${roomCount}\nstudio_tile_rots=${rotRows}\nstudio_entities=${entityRows}\nstudio_collected={}\nstudio_complete=false\nstudio_climb=false\nstudio_stamina=110\nstudio_suppress_fruit=false\nstudio_spawn_source=nil\nstudio_orb_target=nil\n\nfunction studio_hexbyte(s,p) return tonum(\"0x\"..sub(s,p,p+1)) or 0 end\nfunction studio_tile_rot(mx,my)\n local li=flr(mx/16)%8+flr(my/16)*8\n local s=studio_tile_rots[li+1]\n if s==nil then return 0 end\n local i=(my%16)*16+(mx%16)\n local b=studio_hexbyte(s,flr(i/4)*2+1)\n return band(shr(b,(i%4)*2),3)\nend\nfunction studio_rot_spr(s,x,y,r)\n if r==0 then spr(s,x,y) return end\n local sx=(s%16)*8 local sy=flr(s/16)*8\n for py=0,7 do for px=0,7 do\n  local c=sget(sx+px,sy+py)\n  if c~=0 then\n   if r==1 then pset(x+7-py,y+px,c) elseif r==2 then pset(x+7-px,y+7-py,c) else pset(x+py,y+7-px,c) end\n  end\n end end\nend\nfunction studio_map(cx,cy,sx,sy,cw,ch,layer)\n for yy=0,ch-1 do for xx=0,cw-1 do\n  local mx=cx+xx local my=cy+yy local t=mget(mx,my)\n  if t>0 and (layer==nil or layer==0 or band(fget(t),layer)>0) then\n   local r=studio_tile_rot(mx,my)\n   if r==0 then spr(t,sx+xx*8,sy+yy*8) else studio_rot_spr(t,sx+xx*8,sy+yy*8,r) end\n  end\n end end\nend\n\nfunction studio_meta_at(x,y)\n local li=level_index() local tx=flr(x/8) local ty=flr(y/8) local hit=nil\n foreach(studio_entities,function(e) if e[1]==li and e[2]==tx and e[3]==ty then hit=e end end)\n return hit\nend\nfunction studio_key(e) return e[1]..\":\"..e[2]..\":\"..e[3]..\":\"..e[4] end\nfunction studio_source_collected(type,x,y)\n local e=studio_meta_at(x,y)\n if e==nil then return false end\n local id=e[4]\n if id==8 then return false end\n if id==20 or id==26 or id==28 or id==64 or id==129 then return studio_collected[studio_key(e)]==true end\n return false\nend\n\nclimb_chest={tile=129,if_not_fruit=true,update=function(this)\n if this.check(player,0,0) then\n  studio_climb=true studio_stamina=110\n  if this.studio_source~=nil then studio_collected[this.studio_source]=true end\n  destroy_object(this)\n end\nend,draw=function(this)\n local r=this.studio_rot or 0\n studio_rot_spr(20,this.x,this.y,r)\n rectfill(this.x+3,this.y+1,this.x+4,this.y+6,12)\n rectfill(this.x+1,this.y+3,this.x+6,this.y+4,12)\nend}\nadd(types,climb_chest)\n\nlocal studio_old_init_object=init_object\nfunction init_object(type,x,y)\n if studio_suppress_fruit and type==fruit then return nil end\n local meta=studio_meta_at(x,y)\n local o=studio_old_init_object(type,x,y)\n if o~=nil then\n  if meta~=nil then\n   o.studio_flags=meta[5] or 0\n   o.studio_rot=band(shr(o.studio_flags,6),3)\n   if meta[4]==20 or meta[4]==26 or meta[4]==28 or meta[4]==64 or meta[4]==129 then o.studio_source=studio_key(meta) end\n  elseif type==fruit and studio_spawn_source~=nil then o.studio_source=studio_spawn_source end\n  if type==orb and studio_orb_target~=nil then o.studio_target_dashes=studio_orb_target end\n end\n return o\nend\n\nlocal studio_old_fruit_update=fruit.update\nfruit.update=function(this)\n if this.studio_source~=nil and this.collide(player,0,0)~=nil then studio_collected[this.studio_source]=true end\n studio_old_fruit_update(this)\nend\nlocal studio_old_fly_update=fly_fruit.update\nfly_fruit.update=function(this)\n if this.studio_source~=nil and this.collide(player,0,0)~=nil then studio_collected[this.studio_source]=true end\n studio_old_fly_update(this)\nend\n\nlocal studio_old_chest_update=chest.update\nchest.update=function(this)\n local empty=band(this.studio_flags or 0,1)>0\n studio_suppress_fruit=empty\n studio_spawn_source=this.studio_source\n studio_old_chest_update(this)\n studio_suppress_fruit=false studio_spawn_source=nil\nend\nlocal studio_old_fake_update=fake_wall.update\nfake_wall.update=function(this)\n local empty=band(this.studio_flags or 0,1)>0\n studio_suppress_fruit=empty\n studio_spawn_source=this.studio_source\n studio_old_fake_update(this)\n studio_suppress_fruit=false studio_spawn_source=nil\nend\n\nlocal studio_old_big_draw=big_chest.draw\nbig_chest.draw=function(this)\n if band(this.studio_flags or 0,2)>0 then studio_orb_target=3 else studio_orb_target=nil end\n studio_old_big_draw(this)\n studio_orb_target=nil\nend\nlocal studio_old_orb_draw=orb.draw\norb.draw=function(this)\n local hit=nil\n if this.studio_target_dashes==3 and this.spd.y==0 then hit=this.collide(player,0,0) end\n studio_old_orb_draw(this)\n if hit~=nil then max_djump=3 hit.djump=3 end\nend\n\nlocal studio_old_player_update=player.update\nplayer.update=function(this)\n if studio_climb and this.is_solid(0,1) then studio_stamina=110 end\n local grab=band(stat(34) or 0,1)>0\n if studio_climb and grab and studio_stamina>0 and not btn(k_dash) and not this.is_solid(0,1) then\n  local wall=0\n  if this.is_solid(-3,0) and not this.is_ice(-3,0) then wall=-1 elseif this.is_solid(3,0) and not this.is_ice(3,0) then wall=1 end\n  if wall~=0 then\n   local jump=btn(k_jump) and not this.p_jump this.p_jump=btn(k_jump)\n   if jump then studio_stamina=max(0,studio_stamina-27.5) this.spd.y=-2 this.spd.x=-wall*2\n   else\n    this.spd.x=0\n    if btn(k_up) then this.spd.y=-0.8 studio_stamina=max(0,studio_stamina-1.5)\n    elseif btn(k_down) then this.spd.y=0.8\n    else this.spd.y=0 studio_stamina=max(0,studio_stamina-0.4) end\n   end\n   return\n  end\n end\n studio_old_player_update(this)\nend\n\nlocal studio_old_draw_object=draw_object\nfunction draw_object(o)\n local r=o.studio_rot or 0\n if r>0 and o.spr~=nil and o.spr>0 and o.type.draw==nil then studio_rot_spr(o.spr,o.x,o.y,r) else studio_old_draw_object(o) end\nend\n\nlocal studio_old_next_room=next_room\nfunction next_room()\n if level_index()>=studio_room_count-1 then studio_complete=true else studio_old_next_room() end\nend\nlocal studio_old_update=_update\nfunction _update()\n if studio_complete then\n  if btnp(k_jump) or btnp(k_dash) then studio_collected={} studio_climb=false studio_stamina=110 studio_complete=false begin_game() end\n  return\n end\n studio_old_update()\nend\nlocal studio_old_draw=_draw\nfunction _draw()\n studio_old_draw()\n if studio_climb and studio_stamina<110 then rectfill(2,121,59,126,0) rectfill(3,122,3+flr(studio_stamina/2),125,11) end\n if studio_complete then rectfill(25,51,103,77,0) print(\"level complete\",38,58,7) print(\"z/x: restart\",39,68,6) end\nend\nlocal studio_old_init=_init\nfunction _init()\n poke(0x5f2d,1)\n studio_collected={} studio_climb=false studio_stamina=110 studio_complete=false\n studio_old_init()\n begin_game()\nend\n`;
}

function patchFruitGate(lua){
 const gate=/if\s+type\.if_not_fruit\s*~=\s*nil\s+and\s+got_fruit\[1\+level_index\(\)\]\s+then\s*return\s*end/;
 if(!gate.test(lua))throw new Error('This Celeste .p8 variant has an unknown init_object fruit gate. Studio will not patch an unverified cart layout.');
 return lua.replace(gate,'if type.if_not_fruit~=nil and studio_source_collected(type,x,y) then return end');
}

function patchMapCalls(lua){return lua.replace(/\bmap\s*\(/g,'studio_map(');}

export function patchOriginalCelesteCart(baseCart,level){
 validateLevelShape(level);
 let text=String(baseCart||'').replace(/^\ufeff/,'').replace(/\r\n?/g,'\n');
 if(!/^pico-8 cartridge\b/im.test(text))throw new Error('The selected file is not a text PICO-8 .p8 cartridge');
 for(const section of ['lua','gfx','gff','map'])sectionInfo(text,section);
 let lua=getSection(text,'lua');
 for(const anchor of ['function load_room','function next_room','function draw_object','function init_object','function begin_game'])if(!lua.includes(anchor))throw new Error(`The selected cart is not a compatible Celeste Classic text cart (missing ${anchor}).`);
 if(!/player\s*=\s*\{/.test(lua)||!lua.includes('chest={')&&!lua.includes('chest = {'))throw new Error('The selected cart does not expose the expected Celeste player/chest tables.');
 if(lua.includes('-- celeste studio private original-cart patch'))lua=lua.replace(/\n-- celeste studio private original-cart patch[\s\S]*$/,'');
 lua=patchFruitGate(lua);
 lua=patchMapCalls(lua);

 const map=buildOriginalMap(level);
 text=replaceSection(text,'map',buildMapSection(map));
 const gfx=getSection(text,'gfx').split('\n');
 if(gfx.length<128)throw new Error('Original Celeste cartridge has an incomplete __gfx__ section');
 const shared=buildSharedMapGfxLines(map);
 for(let i=0;i<64;i++)gfx[64+i]=shared[i];
 text=replaceSection(text,'gfx',gfx.slice(0,128).join('\n'));
 text=replaceSection(text,'lua',lua+buildPrivatePatch(level));
 return text;
}

export function privatePreviewWarnings(level){
 const warnings=[];
 for(let ri=0;ri<(level.rooms||[]).length;ri++)for(const e of level.rooms[ri].entities||[]){
  const r=((e.flags||0)>>6)&3;
  if(r&&e.type!==129&&!SIMPLE_ROTATION_ENTITIES.has(e.type)){
   warnings.push(`Room ${ri+1}: rotated entity ${e.type} at ${e.x},${e.y} uses its original-cart compound animation orientation; calculator export still keeps the full rotation.`);
   if(warnings.length>=4)return warnings;
  }
 }
 return warnings;
}
