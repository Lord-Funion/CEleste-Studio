-- CEleste Studio generated-preview runtime.
-- Runs inside a real PICO-8-compatible VM. Player constants/order mirror the
-- MIT Celeste Classic reference and the current CEleste calculator runtime.
-- Level data is injected by lib/pico8-cart.mjs before the cart is loaded.
rc=__CELSTUDIO_ROOM_COUNT__
rd=__CELSTUDIO_ROOM_DATA__

function nib(c)
 if c>=48 and c<=57 then return c-48 end
 return c-87
end
function hb(s,p)
 return nib(ord(s,p))*16+nib(ord(s,p+1))
end
function rb(s,i)
 return hb(s,i*2+1)
end
function appr(v,t,a)
 if v>t then return max(v-a,t) end
 return min(v+a,t)
end
function sgn(v)
 if v>0 then return 1 end
 if v<0 then return -1 end
 return 0
end
function ov(ax,ay,aw,ah,bx,by,bw,bh)
 return ax+aw>bx and ay+ah>by and ax<bx+bw and ay<by+bh
end
function src_key(r,s)
 return r..":"..s
end
function src_done(s)
 return collected[src_key(room,s)]==true
end
function collect_src(s)
 collected[src_key(room,s)]=true
end
function erot(e)
 return band(shr(e.f,6),3)
end
function eflags(e)
 return band(e.f,0x3f)
end

function map_origin()
 return (room%8)*16,flr(room/8)*16
end
function tile(tx,ty)
 if tx<0 or tx>15 or ty<0 or ty>15 then return 0 end
 local ox,oy=map_origin()
 return mget(ox+tx,oy+ty)
end
function rot_at(tx,ty)
 if tx<0 or tx>15 or ty<0 or ty>15 then return 0 end
 return rots[ty*16+tx] or 0
end
function flag_rect(x,y,w,h,flag)
 local x0=max(0,flr(x/8))
 local x1=min(15,flr((x+w-1)/8))
 local y0=max(0,flr(y/8))
 local y1=min(15,flr((y+h-1)/8))
 for tx=x0,x1 do
  for ty=y0,y1 do
   if fget(tile(tx,ty),flag) then return true end
  end
 end
 return false
end
function ice_rect(x,y,w,h)
 return flag_rect(x,y,w,h,4)
end
function entity_solid(x,y,w,h,down_only)
 for e in all(objs) do
  if e.alive then
   if e.t==64 and ov(x,y,w,h,e.x,e.y,16,16) then return e end
   if e.t==23 and e.state!=2 and ov(x,y,w,h,e.x,e.y,8,8) then return e end
   if (e.t==11 or e.t==12) and down_only and ov(x,y,w,h,e.x-4,e.y-1,16,3) then return e end
  end
 end
 return nil
end
function solid_rect(x,y,w,h,down_only)
 if flag_rect(x,y,w,h,0) then return true,nil end
 local e=entity_solid(x,y,w,h,down_only)
 return e!=nil,e
end
function psolid(ox,oy)
 local hit,e=solid_rect(p.x+1+ox,p.y+3+oy,6,5,oy>0)
 return hit,e
end

function spike_dir(id)
 if id==17 then return 0 end
 if id==59 then return 1 end
 if id==27 then return 2 end
 if id==43 then return 3 end
 return -1
end
function spikes_at(x,y,w,h,xs,ys)
 local x0=max(0,flr(x/8))
 local x1=min(15,flr((x+w-1)/8))
 local y0=max(0,flr(y/8))
 local y1=min(15,flr((y+h-1)/8))
 for tx=x0,x1 do
  for ty=y0,y1 do
   local d=spike_dir(tile(tx,ty))
   if d>=0 then
    d=(d+rot_at(tx,ty))%4
    if d==0 and (((y+h-1)%8)>=6 or y+h==ty*8+8) and ys>=0 then return true end
    if d==2 and y%8<=2 and ys<=0 then return true end
    if d==3 and x%8<=2 and xs<=0 then return true end
    if d==1 and (((x+w-1)%8)>=6 or x+w==tx*8+8) and xs>=0 then return true end
   end
  end
 end
 return false
end

function break_wall(e)
 if not e or not e.alive then return end
 e.alive=false
 p.vx=-sgn(p.vx)*1.5
 p.vy=-1.5
 p.dasht=-1
 if band(eflags(e),1)==0 then
  add(objs,{t=26,x=e.x+4,y=e.y+4,f=0,s=e.s,alive=true,basey=e.y+4,off=0})
 end
end
function move_x(o,amount)
 o.rx+=amount
 local n=flr(o.rx+0.5)
 o.rx-=n
 local st=sgn(n)
 for i=1,abs(n) do
  local hit,e=solid_rect(o.x+1+st,o.y+3,6,5,false)
  if hit then
   if e and e.t==64 and o.dashe>0 then break_wall(e) end
   o.vx=0
   o.rx=0
   return
  end
  o.x+=st
 end
end
function move_y(o,amount)
 o.ry+=amount
 local n=flr(o.ry+0.5)
 o.ry-=n
 local st=sgn(n)
 for i=1,abs(n) do
  local hit,e=solid_rect(o.x+1,o.y+3+st,6,5,st>0)
  if hit then
   if e and e.t==64 and o.dashe>0 then break_wall(e) end
   o.vy=0
   o.ry=0
   return
  end
  o.y+=st
 end
end

function kill_player()
 if dead>0 then return end
 deaths+=1
 dead=15
 p.vx=0 p.vy=0
end
function next_room()
 if room<rc-1 then
  room+=1
  load_room(room)
 else
  won=true
 end
end

function key_needed(s)
 local count=rb(s,66)
 for i=0,count-1 do
  local b=67+i*4
  local t=rb(s,b)
  if t==20 then
   local f=rb(s,b+3)
   if band(f,1)!=0 or not src_done(i) then return true end
  end
 end
 return false
end
function add_entity(t,x,y,f,s)
 local e={t=t,x=x*8,y=y*8,f=f,s=s,alive=true,state=0,timer=0,vx=0,vy=0,rx=0,ry=0,basey=y*8,off=0}
 if t==64 or t==20 then
  if band(f,1)==0 and src_done(s) then return end
 elseif t==26 or t==28 or t==129 then
  if src_done(s) then return end
 elseif t==8 then
  if not room_needs_key then return end
 end
 add(objs,e)
end
function load_room(r)
 room=r
 has_dashed=false
 has_key=false
 objs={}
 rots={}
 local s=rd[room+1]
 local sx=rb(s,0)
 local sy=rb(s,1)
 for i=0,255 do
  local b=rb(s,2+flr(i/4))
  rots[i]=band(shr(b,(i%4)*2),3)
 end
 room_needs_key=key_needed(s)
 local count=rb(s,66)
 for i=0,count-1 do
  local b=67+i*4
  add_entity(rb(s,b),rb(s,b+1),rb(s,b+2),rb(s,b+3),i)
 end
 p={x=sx*8,y=sy*8,vx=0,vy=0,rx=0,ry=0,pjump=false,pdash=false,grace=0,jbuf=0,djump=maxdash,dasht=0,dashe=0,dtx=0,dty=0,dax=0,day=0,flip=false,spr=1,soff=0,ground=false}
 dead=0
 paused=0
end

function grab_down()
 return band(stat(34) or 0,1)!=0
end
function player_update()
 if paused>0 then return end
 local input=btn(1) and 1 or (btn(0) and -1 or 0)
 if spikes_at(p.x+1,p.y+3,6,5,p.vx,p.vy) then kill_player() return end
 if p.y>128 then kill_player() return end
 local onground=psolid(0,1)
 local onice=ice_rect(p.x+1,p.y+4,6,5)
 if onground and not p.ground then smoke_t=5 end
 local j=btn(4) and not p.pjump
 p.pjump=btn(4)
 if j then p.jbuf=4 elseif p.jbuf>0 then p.jbuf-=1 end
 local dash=btn(5) and not p.pdash
 p.pdash=btn(5)
 if onground then
  p.grace=6
  if climb_enabled then stamina=1100 end
  if p.djump<maxdash then p.djump=maxdash end
 elseif p.grace>0 then p.grace-=1 end
 p.dashe-=1
 if p.dasht>0 then
  p.dasht-=1
  p.vx=appr(p.vx,p.dtx,p.dax)
  p.vy=appr(p.vy,p.dty,p.day)
 else
  local wall=0
  if climb_enabled and not onground and not dash and grab_down() and stamina>0 then
   local l=psolid(-3,0)
   local r=psolid(3,0)
   if l and not ice_rect(p.x-2,p.y+3,6,5) then wall=-1
   elseif r and not ice_rect(p.x+4,p.y+3,6,5) then wall=1 end
  end
  local climbing=wall!=0
  if climbing and p.jbuf>0 then
   p.jbuf=0
   stamina=max(0,stamina-275)
   p.vy=-2
   p.vx=-wall*2
   climbing=false
  end
  if climbing then
   p.vx=0
   p.flip=wall<0
   if btn(2) then p.vy=-0.8 stamina=max(0,stamina-15)
   elseif btn(3) then p.vy=0.8
   else p.vy=0 stamina=max(0,stamina-4) end
   if stamina==0 then climbing=false end
  end
  p.climbing=climbing
  if not climbing then
   local maxrun=1
   local acc=onground and 0.6 or 0.4
   local dec=0.15
   if onground and onice then acc=0.05 end
   if abs(p.vx)>maxrun then p.vx=appr(p.vx,sgn(p.vx)*maxrun,dec)
   else p.vx=appr(p.vx,input*maxrun,acc) end
   if p.vx!=0 then p.flip=p.vx<0 end
   local maxfall=2
   local grav=abs(p.vy)<=0.15 and 0.105 or 0.21
   local wallslide=input!=0 and psolid(input,0) and not ice_rect(p.x+1+input,p.y+3,6,5)
   if wallslide then maxfall=0.4 end
   if not onground then p.vy=appr(p.vy,maxfall,grav) end
   if p.jbuf>0 then
    if p.grace>0 then
     p.jbuf=0 p.grace=0 p.vy=-2
    else
     local wd=psolid(-3,0) and -1 or (psolid(3,0) and 1 or 0)
     if wd!=0 then p.jbuf=0 p.vy=-2 p.vx=-wd*(maxrun+1) end
    end
   end
   if p.djump>0 and dash then
    p.djump-=1
    has_dashed=true
    p.dasht=4
    p.dashe=10
    local vi=btn(2) and -1 or (btn(3) and 1 or 0)
    local full=5
    local half=3.5355339059
    if input!=0 then
     if vi!=0 then p.vx=input*half p.vy=vi*half else p.vx=input*full p.vy=0 end
    elseif vi!=0 then p.vx=0 p.vy=vi*full
    else p.vx=p.flip and -1 or 1 p.vy=0 end
    p.dtx=2*sgn(p.vx) p.dty=2*sgn(p.vy)
    p.dax=1.5 p.day=1.5
    if p.vy<0 then p.dty*=0.75 end
    if p.vy!=0 then p.dax=1.0606601718 end
    if p.vx!=0 then p.day=10.606601718 end
   end
  end
 end
 p.soff+=1
 if not onground then p.spr=(p.climbing or psolid(input,0)) and 5 or 3
 elseif btn(3) then p.spr=6
 elseif btn(2) then p.spr=7
 elseif p.vx==0 or (not btn(0) and not btn(1)) then p.spr=1
 else p.spr=1+(flr(p.soff/4)%4) end
 p.ground=onground
 if p.y<-4 then next_room() room_changed=true end
end

function collect_fruit(e)
 e.alive=false
 p.djump=maxdash
 collect_src(e.s)
end
function spawn_fruit(x,y,s)
 add(objs,{t=26,x=x,y=y,f=0,s=s,alive=true,state=0,timer=0,vx=0,vy=0,rx=0,ry=0,basey=y,off=0})
end
function update_entities()
 local px=p.x+1 local py=p.y+3
 for e in all(objs) do
  if e.alive then
   if e.t==22 then
    if e.timer>0 then e.timer-=1 if e.timer==0 then e.state=0 end end
    if e.state==0 and ov(px,py,6,5,e.x,e.y,8,8) then p.djump=maxdash e.state=1 e.timer=60 end
   elseif e.t==18 then
    if e.timer>0 then e.timer-=1 end
    if ov(px,py,6,5,e.x,e.y,8,8) and p.vy>=0 then p.y=e.y-4 p.vx/=5 p.vy=-3 p.djump=maxdash e.timer=10 end
   elseif e.t==26 then
    e.off+=0.025 e.y=e.basey+sin(e.off)*2.5
    if ov(px,py,6,5,e.x,e.y,8,8) then collect_fruit(e) end
   elseif e.t==28 then
    if has_dashed then e.state=1 end
    if e.state==1 then e.vy=appr(e.vy,-3.5,0.25) e.y+=e.vy if e.y<-16 then e.alive=false end end
    if e.alive and ov(px,py,6,5,e.x,e.y,8,8) then collect_fruit(e) end
   elseif e.t==8 then
    if ov(px,py,6,5,e.x,e.y,8,8) then has_key=true e.alive=false end
   elseif e.t==20 then
    if has_key and e.state==0 then e.state=1 e.timer=20 end
    if e.state==1 then e.timer-=1 if e.timer<=0 then e.alive=false if band(eflags(e),1)==0 then spawn_fruit(e.x-4,e.y-4,e.s) end end end
   elseif e.t==23 then
    if e.state==0 and (ov(px,py+1,6,5,e.x,e.y,8,8) or ov(px-1,py,8,5,e.x,e.y,8,8)) then e.state=1 e.timer=15
    elseif e.state==1 then e.timer-=1 if e.timer<=0 then e.state=2 e.timer=60 end
    elseif e.state==2 then e.timer-=1 if e.timer<=0 and not ov(px,py,6,5,e.x,e.y,8,8) then e.state=0 end end
   elseif e.t==11 or e.t==12 then
    local dir=e.t==11 and -1 or 1
    local old=e.x
    e.x+=dir*0.65
    if e.x<-16 then e.x=128 elseif e.x>128 then e.x=-16 end
    local dx=e.x-old
    if abs(dx)<8 and ov(px,py+1,6,5,old-4,e.y-2,16,4) then p.x+=dx end
   elseif e.t==96 then
    if e.state==0 and ov(px,py,6,5,e.x,e.y+8,16,9) and psolid(0,1) then
     e.state=1 e.timer=60 paused=60 p.vx=0 p.vy=0
    elseif e.state==1 then
     e.timer-=1
     if e.timer<0 then e.state=2 add(objs,{t=102,x=e.x+4,y=e.y+4,alive=true,vy=-4,target=band(eflags(e),2)!=0 and 3 or 2}) end
    end
   elseif e.t==102 then
    e.vy=appr(e.vy,0,0.5) e.y+=e.vy
    if e.vy==0 and ov(px,py,6,5,e.x,e.y,8,8) then maxdash=e.target p.djump=maxdash e.alive=false end
   elseif e.t==129 then
    if ov(px,py,6,5,e.x,e.y,8,8) then climb_enabled=true stamina=1100 collect_src(e.s) e.alive=false end
   end
  end
 end
end

function roff(dx,dy,r)
 r%=4
 if r==1 then return -dy,dx end
 if r==2 then return -dx,-dy end
 if r==3 then return dy,-dx end
 return dx,dy
end
function sprr(id,x,y,r,fx,fy)
 r%=4
 if r==0 then spr(id,x,y,1,1,fx,fy) return end
 local sx=(id%16)*8 local sy=flr(id/16)*8
 for yy=0,7 do
  for xx=0,7 do
   local qx=fx and 7-xx or xx
   local qy=fy and 7-yy or yy
   local c=sget(sx+qx,sy+qy)
   if c!=0 then
    local dx=xx local dy=yy
    if r==1 then dx=7-yy dy=xx
    elseif r==2 then dx=7-xx dy=7-yy
    elseif r==3 then dx=yy dy=7-xx end
    pset(x+dx,y+dy,c)
   end
  end
 end
end
function child(id,x,y,dx,dy,r,fx,fy)
 local rx,ry=roff(dx,dy,r)
 sprr(id,x+rx,y+ry,r,fx,fy)
end
function piece(e)
 local r=erot(e)
 if e.t==64 then
  local ids={64,65,80,81}
  for sy=0,1 do for sx=0,1 do
   local dx=sx local dy=sy
   if r==1 then dx=1-sy dy=sx elseif r==2 then dx=1-sx dy=1-sy elseif r==3 then dx=sy dy=1-sx end
   sprr(ids[sy*2+sx+1],e.x+dx*8,e.y+dy*8,r)
  end end
 elseif e.t==96 then
  local ids={96,97,112,113}
  for sy=0,1 do for sx=0,1 do
   local dx=sx local dy=sy
   if r==1 then dx=1-sy dy=sx elseif r==2 then dx=1-sx dy=1-sy elseif r==3 then dx=sy dy=1-sx end
   sprr(ids[sy*2+sx+1],e.x+dx*8,e.y+dy*8,r)
  end end
 elseif e.t==86 then
  child(70,e.x,e.y,0,-8,r) child(71,e.x,e.y,8,-8,r) child(86,e.x,e.y,0,0,r) child(87,e.x,e.y,8,0,r)
 elseif e.t==11 or e.t==12 then
  child(11,e.x,e.y,-4,-1,r) child(12,e.x,e.y,4,-1,r)
 elseif e.t==28 then
  child(45,e.x,e.y,-6,-2,r) sprr(28,e.x,e.y,r) child(45,e.x,e.y,6,-2,r,true,false)
 elseif e.t==22 then
  child(13,e.x,e.y,0,6,r) sprr(22,e.x,e.y,r)
 elseif e.t==129 then
  sprr(20,e.x,e.y,r)
  rectfill(e.x+3,e.y+2,e.x+4,e.y+5,12) rectfill(e.x+2,e.y+3,e.x+5,e.y+4,12)
 else
  sprr(e.t,e.x,e.y,r)
 end
end
function draw_tiles(flag)
 for y=0,15 do
  for x=0,15 do
   local id=tile(x,y)
   if id!=0 and fget(id,flag) then sprr(id,x*8,y*8,rot_at(x,y)) end
  end
 end
end
function draw_entities(first)
 for e in all(objs) do
  if e.alive then
   local early=e.t==11 or e.t==12 or e.t==96
   if early==first then
    if e.t==22 and e.state==1 then
    elseif e.t==23 and e.state==2 then
    elseif e.t==102 then spr(102,e.x,e.y)
    elseif e.t==18 and e.timer>0 then sprr(19,e.x,e.y,erot(e))
    else piece(e) end
   end
  end
 end
end
function draw_player()
 if dead>0 then return end
 spr(p.spr,p.x,p.y,1,1,p.flip,false)
end

function _init()
 poke(0x5f2d,1) -- devkit mouse; browser maps C to mouse button 1 for grab.
 room=0
 collected={}
 maxdash=1
 climb_enabled=false
 stamina=1100
 deaths=0
 dead=0
 paused=0
 won=false
 room_changed=false
 load_room(0)
end
function _update()
 if won then return end
 if dead>0 then dead-=1 if dead==0 then load_room(room) end return end
 if paused>0 then paused-=1 end
 room_changed=false
 -- CEleste/Classic object order: movement uses last frame's velocity, then update.
 move_x(p,p.vx)
 move_y(p,p.vy)
 player_update()
 if room_changed or won or dead>0 then return end
 update_entities()
end
function _draw()
 cls(0)
 draw_tiles(2)
 draw_entities(true)
 draw_tiles(1)
 draw_entities(false)
 draw_player()
 draw_tiles(3)
 if climb_enabled and stamina<1100 then
  rectfill(2,2,25,5,0)
  rectfill(3,3,3+flr(21*stamina/1100),4,11)
 end
 if won then
  rectfill(24,54,104,73,0)
  print("level complete!",38,59,7)
  print("r to restart",42,66,6)
 end
end
