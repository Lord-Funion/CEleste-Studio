export function minimalCelesteCart(){
  const lua=`
room={x=0,y=0}
objects={}
types={}
got_fruit={}
has_key=false
max_djump=1
k_left=0 k_right=1 k_up=2 k_down=3 k_jump=4 k_dash=5

function level_index() return room.x%8+room.y*8 end
function destroy_object(o) del(objects,o) end

player={tile=1,update=function(this) end}
fruit={tile=26,if_not_fruit=true,update=function(this) end}
fly_fruit={tile=28,if_not_fruit=true,update=function(this) end}
chest={tile=20,if_not_fruit=true,update=function(this) end}
fake_wall={tile=64,if_not_fruit=true,update=function(this) end}
big_chest={tile=96,draw=function(this) end}
orb={tile=102,draw=function(this) end}
platform={draw=function(this) end}
add(types,player) add(types,fruit) add(types,fly_fruit) add(types,chest) add(types,fake_wall) add(types,big_chest)

function init_object(type,x,y)
 if type.if_not_fruit~=nil and got_fruit[1+level_index()] then
  return
 end
 local o={type=type,x=x,y=y,spr=type.tile or 0,studio_flags=0,spd={x=0,y=0},p_jump=false}
 o.collide=function(t,ox,oy) return nil end
 o.check=function(t,ox,oy) return false end
 o.is_solid=function(ox,oy) return false end
 o.is_ice=function(ox,oy) return false end
 add(objects,o)
 return o
end

function load_room(x,y)
 objects={}
 room.x=x room.y=y
 for tx=0,15 do for ty=0,15 do
  local t=mget(x*16+tx,y*16+ty)
  if t==11 or t==12 then
   local o=init_object(platform,tx*8,ty*8) if o then o.dir=t==11 and -1 or 1 end
  else
   foreach(types,function(tp) if tp.tile==t then init_object(tp,tx*8,ty*8) end end)
  end
 end end
end
function begin_game() load_room(0,0) end
function next_room() if room.x==7 then load_room(0,room.y+1) else load_room(room.x+1,room.y) end end
function draw_object(o) if o.type.draw then o.type.draw(o) elseif o.spr and o.spr>0 then spr(o.spr,o.x,o.y) end end
function _init() begin_game() end
function _update() foreach(objects,function(o) if o.type.update then o.type.update(o) end end) end
function _draw() cls(0) map(room.x*16,room.y*16,0,0,16,16,2) foreach(objects,draw_object) end
`;
  const gfx=Array.from({length:128},()=> '0'.repeat(128)).join('\n');
  const gff='0'.repeat(256)+'\n'+'0'.repeat(256);
  const map=Array.from({length:32},()=> '00'.repeat(128)).join('\n');
  return ['pico-8 cartridge // http://www.pico-8.com','version 42','__lua__',lua,'__gfx__',gfx,'__gff__',gff,'__map__',map,''].join('\n');
}

export function samplePrivateLevel(){
  const tiles=new Uint8Array(256);
  for(let x=0;x<16;x++)tiles[15*16+x]=37;
  tiles[14*16+5]=17;
  const rotations=new Uint8Array(256);rotations[14*16+5]=1;
  return {title:'Private smoke',rooms:[{
    width:16,height:16,spawnX:2,spawnY:13,tiles,rotations,
    entities:[{type:20,x:7,y:13,flags:0x40},{type:129,x:9,y:13,flags:0}]
  }]};
}
