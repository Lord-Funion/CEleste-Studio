export const PICO8_PALETTE = [
  [0x00,0x00,0x00],[0x1d,0x2b,0x53],[0x7e,0x25,0x53],[0x00,0x87,0x51],
  [0xab,0x52,0x36],[0x5f,0x57,0x4f],[0xc2,0xc3,0xc7],[0xff,0xf1,0xe8],
  [0xff,0x00,0x4d],[0xff,0xa3,0x00],[0xff,0xec,0x27],[0x00,0xe4,0x36],
  [0x29,0xad,0xff],[0x83,0x76,0x9c],[0xff,0x77,0xa8],[0xff,0xcc,0xaa]
];

// Exact flags used by Celeste Classic / CEleste for atlas sprites 0..127.
export const TILE_MASK = new Uint8Array([
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
const ROT_FAMILIES=[
  [17,59,27,43],
  [34,38,50,36],
  [41,42,58,57]
];
const hexByte=n=>((n&255).toString(16).padStart(2,'0'));

export function packRotations(rotations){
  const src=rotations instanceof Uint8Array?rotations:Uint8Array.from(rotations||[]);
  if(src.length!==256)throw new Error(`PICO-8 preview requires 256 rotation cells, got ${src.length}`);
  const out=new Uint8Array(64);
  for(let i=0;i<256;i++){
    const r=src[i];
    if(r>3)throw new Error(`Invalid rotation ${r} at cell ${i}`);
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
    const a=rgba[i*4+3];
    if(a<128){out[i]=0;continue;}
    const k=`${rgba[i*4]},${rgba[i*4+1]},${rgba[i*4+2]}`;
    const idx=key.get(k);
    if(idx===undefined)throw new Error(`Atlas contains non-PICO-8 color rgb(${k}) at pixel ${i}`);
    out[i]=idx;
  }
  return out;
}

function rotatedCounterpart(id,rotation){
  if(!rotation)return id;
  for(const family of ROT_FAMILIES){
    const i=family.indexOf(id);
    if(i>=0)return family[(i+(rotation&3))&3];
  }
  return id;
}

function buildMap(level,{forOriginalCart=false}={}){
  if(!level?.rooms?.length)throw new Error('Preview level has no rooms');
  if(level.rooms.length>32)throw new Error('PICO-8 preview supports at most 32 rooms');
  const map=Array.from({length:64},()=>new Uint8Array(128));
  for(let ri=0;ri<level.rooms.length;ri++){
    const room=level.rooms[ri];
    if(room.width!==16||room.height!==16)throw new Error(`Room ${ri+1} is not 16x16`);
    const tiles=room.tiles instanceof Uint8Array?room.tiles:Uint8Array.from(room.tiles||[]);
    const rotations=room.rotations instanceof Uint8Array?room.rotations:Uint8Array.from(room.rotations||new Uint8Array(256));
    if(tiles.length!==256)throw new Error(`Room ${ri+1} tile plane is not 256 cells`);
    if(rotations.length!==256)throw new Error(`Room ${ri+1} rotation plane is not 256 cells`);
    const ox=(ri%8)*16,oy=Math.floor(ri/8)*16;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const cell=y*16+x,id=tiles[cell];
      if(id>127)throw new Error(`Room ${ri+1} tile ${id} is outside the PICO-8 atlas`);
      map[oy+y][ox+x]=forOriginalCart?rotatedCounterpart(id,rotations[cell]):id;
    }
    if(forOriginalCart){
      map[oy+(room.spawnY&15)][ox+(room.spawnX&15)]=1;
      for(const e of room.entities||[]){
        if(!SUPPORTED_ENTITIES.has(e.type))throw new Error(`Unsupported preview entity ${e.type}`);
        map[oy+(e.y&15)][ox+(e.x&15)]=e.type&255;
      }
    }
  }
  return map;
}

function buildGfx(atlas,map){
  if(!(atlas instanceof Uint8Array)||atlas.length!==128*64)throw new Error('Atlas must be 128x64 PICO-8 color indices');
  const lines=[];
  for(let y=0;y<64;y++){
    let line='';
    for(let x=0;x<128;x++)line+=HEX[atlas[y*128+x]&15];
    lines.push(line);
  }
  lines.push(...buildSharedMapGfxLines(map));
  return lines.join('\n');
}

function buildSharedMapGfxLines(map){
  const lines=[];
  for(let my=32;my<64;my++){
    for(let half=0;half<2;half++){
      let line='';
      for(let mx=half*64;mx<half*64+64;mx++){
        const b=map[my][mx];
        line+=HEX[b&15]+HEX[(b>>4)&15];
      }
      lines.push(line);
    }
  }
  return lines;
}

function buildMapSection(map){
  return map.slice(0,32).map(row=>Array.from(row,hexByte).join('')).join('\n');
}

function buildGff(){
  const bytes=new Uint8Array(256);bytes.set(TILE_MASK);
  const s=Array.from(bytes,hexByte).join('');
  return `${s.slice(0,256)}\n${s.slice(256)}`;
}

export function buildPico8Cart(level,{atlasIndices,runtimeLua}){
  if(typeof runtimeLua!=='string'||!runtimeLua.includes('__CELSTUDIO_ROOM_COUNT__')||!runtimeLua.includes('__CELSTUDIO_ROOM_DATA__')){
    throw new Error('Preview runtime template is missing Studio data markers');
  }
  const map=buildMap(level);
  const roomRecords=level.rooms.map(encodeRoomRecord);
  const roomTable=`{${roomRecords.map(s=>`\"${s}\"`).join(',')}}`;
  const lua=runtimeLua
    .replace('__CELSTUDIO_ROOM_COUNT__',String(level.rooms.length))
    .replace('__CELSTUDIO_ROOM_DATA__',roomTable);
  return [
    'pico-8 cartridge // http://www.pico-8.com',
    'version 42',
    '__lua__',lua,
    '__gfx__',buildGfx(atlasIndices,map),
    '__gff__',buildGff(),
    '__map__',buildMapSection(map),
    ''
  ].join('\n');
}

function sectionInfo(text,name){
  const re=/^__([a-z0-9_]+)__\s*$/gmi;
  const found=[];let m;
  while((m=re.exec(text)))found.push({name:m[1].toLowerCase(),start:m.index,bodyStart:re.lastIndex});
  const i=found.findIndex(x=>x.name===name.toLowerCase());
  if(i<0)throw new Error(`Original cart is missing __${name}__`);
  return {...found[i],bodyEnd:i+1<found.length?found[i+1].start:text.length};
}

function getSection(text,name){const s=sectionInfo(text,name);return text.slice(s.bodyStart,s.bodyEnd).replace(/^\s*\n/,'').replace(/\s+$/,'');}
function replaceSection(text,name,body){
  const s=sectionInfo(text,name);
  const before=text.slice(0,s.bodyStart).replace(/\s*$/,'');
  const after=text.slice(s.bodyEnd).replace(/^\s*/, '\n');
  return `${before}\n${String(body).replace(/\s+$/,'')}\n${after}`;
}

function buildChestRotations(level){
  const rows=[];
  for(let ri=0;ri<level.rooms.length;ri++)for(const e of level.rooms[ri].entities||[]){
    if(e.type===20){const rot=((e.flags||0)>>6)&3;if(rot)rows.push(`{${ri},${e.x&15},${e.y&15},${rot}}`);}
  }
  return `{${rows.join(',')}}`;
}

function buildPrivatePatch(level){
  const roomCount=level.rooms.length;
  const chestRots=buildChestRotations(level);
  return `\n-- celeste studio private patch: user-owned original cart + custom rooms\nstudio_room_count=${roomCount}\nstudio_complete=false\nstudio_climb=false\nstudio_stamina=110\nstudio_chest_rots=${chestRots}\npoke(0x5f2d,1)\n\nclimb_chest={tile=129,update=function(this)\n if this.check(player,0,0) then studio_climb=true studio_stamina=110 destroy_object(this) end\nend,draw=function(this)\n spr(20,this.x,this.y)\n rectfill(this.x+3,this.y+1,this.x+4,this.y+6,12)\n rectfill(this.x+1,this.y+3,this.x+6,this.y+4,12)\nend}\nadd(types,climb_chest)\n\nlocal studio_old_player_update=player.update\nplayer.update=function(this)\n if studio_climb and this.is_solid(0,1) then studio_stamina=110 end\n local grab=band(stat(34) or 0,1)>0\n if studio_climb and grab and studio_stamina>0 and not btn(k_dash) and not this.is_solid(0,1) then\n  local wall=0\n  if this.is_solid(-3,0) and not this.is_ice(-3,0) then wall=-1 elseif this.is_solid(3,0) and not this.is_ice(3,0) then wall=1 end\n  if wall~=0 then\n   local jump=btn(k_jump) and not this.p_jump\n   this.p_jump=btn(k_jump)\n   if jump then\n    studio_stamina=max(0,studio_stamina-27.5)\n    this.spd.y=-2 this.spd.x=-wall*2\n   else\n    this.spd.x=0\n    if btn(k_up) then this.spd.y=-0.8 studio_stamina=max(0,studio_stamina-1.5)\n    elseif btn(k_down) then this.spd.y=0.8\n    else this.spd.y=0 studio_stamina=max(0,studio_stamina-0.4) end\n   end\n   return\n  end\n end\n studio_old_player_update(this)\nend\n\nfunction studio_rot_spr(s,x,y,r)\n local sx=(s%16)*8 local sy=flr(s/16)*8\n for py=0,7 do for px=0,7 do\n  local c=sget(sx+px,sy+py)\n  if c~=0 then\n   if r==1 then pset(x+7-py,y+px,c) elseif r==2 then pset(x+7-px,y+7-py,c) elseif r==3 then pset(x+py,y+7-px,c) end\n  end\n end end\nend\n\nlocal studio_old_load_room=load_room\nfunction load_room(x,y)\n studio_old_load_room(x,y)\n local li=level_index()\n foreach(objects,function(o)\n  if o.type==chest then\n   local tx=flr((o.x+4)/8) local ty=flr(o.y/8)\n   foreach(studio_chest_rots,function(r) if r[1]==li and r[2]==tx and r[3]==ty then o.studio_rot=r[4] end end)\n  end\n end)\nend\n\nlocal studio_old_draw_object=draw_object\nfunction draw_object(o)\n if o.type==chest and o.studio_rot~=nil and o.studio_rot>0 then studio_rot_spr(o.spr,o.x,o.y,o.studio_rot) else studio_old_draw_object(o) end\nend\n\nlocal studio_old_next_room=next_room\nfunction next_room()\n if level_index()>=studio_room_count-1 then studio_complete=true else studio_old_next_room() end\nend\n\nlocal studio_old_update=_update\nfunction _update()\n if studio_complete then if btnp(k_jump) or btnp(k_dash) then studio_complete=false load_room(0,0) end return end\n studio_old_update()\nend\n\nlocal studio_old_draw=_draw\nfunction _draw()\n studio_old_draw()\n if studio_climb and studio_stamina<110 then rectfill(2,121,57,126,0) rectfill(3,122,3+flr(studio_stamina/2),125,11) end\n if studio_complete then rectfill(25,51,103,77,0) print(\"level complete\",38,58,7) print(\"z/x: restart\",39,68,6) end\nend\n\nlocal studio_old_init=_init\nfunction _init()\n studio_climb=false studio_stamina=110 studio_complete=false\n studio_old_init()\n load_room(0,0)\nend\n`;
}

export function patchOriginalCelesteCart(baseCart,level){
  if(!level?.rooms?.length)throw new Error('Preview level has no rooms');
  if(level.rooms.length>32)throw new Error('The original Celeste map layout supports at most 32 Studio rooms');
  let text=String(baseCart||'').replace(/\r\n?/g,'\n');
  if(!text.toLowerCase().includes('pico-8 cartridge'))throw new Error('The selected file is not a text PICO-8 .p8 cartridge');
  let lua=getSection(text,'lua');
  for(const anchor of ['function load_room','function next_room','function draw_object'])if(!lua.includes(anchor))throw new Error('The selected .p8 is not a compatible original Celeste Classic cartridge');
  if(!/player\s*=\s*\{/.test(lua))throw new Error('The selected cart does not expose the expected Celeste player table');

  const map=buildMap(level,{forOriginalCart:true});
  text=replaceSection(text,'map',buildMapSection(map));

  const gfx=getSection(text,'gfx').split('\n');
  if(gfx.length<128)throw new Error('Original Celeste cartridge has an incomplete __gfx__ section');
  const shared=buildSharedMapGfxLines(map);
  for(let i=0;i<64;i++)gfx[64+i]=shared[i];
  text=replaceSection(text,'gfx',gfx.slice(0,128).join('\n'));

  lua=getSection(text,'lua').replace(/\n-- celeste studio private patch:[\s\S]*$/,'');
  text=replaceSection(text,'lua',lua+buildPrivatePatch(level));
  return text;
}

export function privatePreviewWarnings(level){
  const warnings=[];
  for(let ri=0;ri<(level.rooms||[]).length;ri++){
    const room=level.rooms[ri],rots=room.rotations||[];
    for(let i=0;i<rots.length;i++)if((rots[i]&3)&&rotatedCounterpart(room.tiles[i],rots[i])===room.tiles[i]){
      warnings.push(`Room ${ri+1}: tile ${room.tiles[i]} at ${i%16},${Math.floor(i/16)} has no original-cart rotated tile; its calculator rotation is not shown in exact-cart preview.`);
      if(warnings.length>=4)return warnings;
    }
  }
  return warnings;
}
