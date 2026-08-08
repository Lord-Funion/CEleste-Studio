export const PICO8_PALETTE = [
  [0x00,0x00,0x00],[0x1d,0x2b,0x53],[0x7e,0x25,0x53],[0x00,0x87,0x51],
  [0xab,0x52,0x36],[0x5f,0x57,0x4f],[0xc2,0xc3,0xc7],[0xff,0xf1,0xe8],
  [0xff,0x00,0x4d],[0xff,0xa3,0x00],[0xff,0xec,0x27],[0x00,0xe4,0x36],
  [0x29,0xad,0xff],[0x83,0x76,0x9c],[0xff,0x77,0xa8],[0xff,0xcc,0xaa]
];

// Exact flags used by Celeste Classic / CEleste for atlas sprites 0..127.
// bit 0 solid, bit 1 normal map layer, bit 2 background, bit 3 foreground,
// bit 4 ice/slippery.
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

function buildMap(level){
  const map=Array.from({length:64},()=>new Uint8Array(128));
  for(let ri=0;ri<level.rooms.length;ri++){
    const room=level.rooms[ri];
    if(room.width!==16||room.height!==16)throw new Error(`Room ${ri+1} is not 16x16`);
    const tiles=room.tiles instanceof Uint8Array?room.tiles:Uint8Array.from(room.tiles||[]);
    if(tiles.length!==256)throw new Error(`Room ${ri+1} tile plane is not 256 cells`);
    const ox=(ri%8)*16,oy=Math.floor(ri/8)*16;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const id=tiles[y*16+x];
      if(id>127)throw new Error(`Room ${ri+1} tile ${id} is outside the PICO-8 atlas`);
      map[oy+y][ox+x]=id;
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
  // PICO-8 map rows 32..63 share memory with the lower half of the sprite sheet.
  // In __gfx__, each map byte is represented as low nibble pixel first, then high.
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
  return lines.join('\n');
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
  if(!level?.rooms?.length)throw new Error('Preview level has no rooms');
  if(level.rooms.length>32)throw new Error('PICO-8 preview supports at most 32 rooms');
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
