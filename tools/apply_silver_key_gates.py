from pathlib import Path


def edit(path, replacements):
    p = Path(path)
    text = p.read_text()
    original = text
    for old, new in replacements:
        if new in text:
            continue
        if old not in text:
            raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
        text = text.replace(old, new, 1)
    if text != original:
        p.write_text(text)


edit("app.js", [
    (
        "const ENTITY_TYPES = new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129]);\nconst FRUIT_GATED_TYPES = new Set([20,26,28,64,129]);",
        "const ENTITY_TYPES = new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129,130,131]);\nconst FRUIT_GATED_TYPES = new Set([20,26,28,64,129,130]);"
    ),
    (
        "  {id:8,name:'Key',category:'Gameplay',entity:true,description:'Collecting the key unlocks every locked chest in the current room.',color:'#ffe66b'},\n  {id:20,name:'Locked chest'",
        "  {id:8,name:'Key',category:'Gameplay',entity:true,description:'Collecting the key unlocks every locked chest in the current room.',color:'#ffe66b'},\n  {id:130,name:'Silver key',category:'Gameplay',entity:true,options:'link',description:'Collect it to open every silver gate block with the same link group (0–63), even in another room of this custom level.',color:'#c2c3c7'},\n  {id:131,name:'Silver gate',category:'Gameplay',entity:true,options:'link',description:'A solid 8×8 linked gate block. Stack blocks with the same link group to build doors, portcullises, walls, or any keyed barrier shape.',color:'#5f574f'},\n  {id:20,name:'Locked chest'"
    ),
    (
        "function drawLogicalPiece(target,id,dx,dy,cell,alpha=1,rotation=0){\n  if(rotation){const b=pieceBounds(id,cell),cx=dx+b.ox+b.w/2,cy=dy+b.oy+b.h/2;target.save();target.translate(cx,cy);target.rotate((rotation&3)*Math.PI/2);target.translate(-cx,-cy);drawLogicalPiece(target,id,dx,dy,cell,alpha,0);target.restore();return true;}\n  if(id===129){",
        "function drawLogicalPiece(target,id,dx,dy,cell,alpha=1,rotation=0){\n  if(rotation){const b=pieceBounds(id,cell),cx=dx+b.ox+b.w/2,cy=dy+b.oy+b.h/2;target.save();target.translate(cx,cy);target.rotate((rotation&3)*Math.PI/2);target.translate(-cx,-cy);drawLogicalPiece(target,id,dx,dy,cell,alpha,0);target.restore();return true;}\n  if(id===130){\n    const ok=drawPicoSprite(target,8,dx,dy,cell,false,false,alpha);\n    if(ok){target.save();target.globalAlpha=alpha;target.globalCompositeOperation='source-atop';target.fillStyle='#c2c3c7';target.fillRect(dx,dy,cell,cell);target.restore();}\n    return true;\n  }\n  if(id===131){\n    target.save();target.globalAlpha=alpha;target.fillStyle='#5f574f';target.fillRect(dx,dy,cell,cell);const c=cell/8;target.fillStyle='#c2c3c7';target.fillRect(dx+c,dy,2*c,cell);target.fillRect(dx+5*c,dy,2*c,cell);target.fillStyle='#fff1e8';target.fillRect(dx+3*c,dy+3*c,2*c,2*c);target.restore();return true;\n  }\n  if(id===129){"
    ),
    (
        "  if(id===129){drawLogicalPiece(target,id,5,5,24);return;}",
        "  if(id===129||id===130||id===131){drawLogicalPiece(target,id,5,5,24);return;}"
    ),
    (
        "  }else if(item.options==='dashes'){\n    const label=document.createElement('label');label.textContent='Dash upgrade';const sel=document.createElement('select');sel.innerHTML='<option value=\"2\">2 dashes</option><option value=\"3\">3 dashes</option>';sel.value=(placementFlags&2)?'3':'2';sel.onchange=()=>{placementFlags=sel.value==='3'?(placementFlags|2):(placementFlags&~2);};label.append(sel);opts.append(label);\n  }\n}",
        "  }else if(item.options==='dashes'){\n    const label=document.createElement('label');label.textContent='Dash upgrade';const sel=document.createElement('select');sel.innerHTML='<option value=\"2\">2 dashes</option><option value=\"3\">3 dashes</option>';sel.value=(placementFlags&2)?'3':'2';sel.onchange=()=>{placementFlags=sel.value==='3'?(placementFlags|2):(placementFlags&~2);};label.append(sel);opts.append(label);\n  }else if(item.options==='link'){\n    const label=document.createElement('label');label.textContent='Link group ';const input=document.createElement('input');input.type='number';input.min='0';input.max='63';input.step='1';input.value=String(placementFlags&63);input.oninput=()=>{const n=Math.max(0,Math.min(63,Number(input.value)||0));placementFlags=n;input.value=String(n);};label.append(input);opts.append(label);\n  }\n}"
    ),
])

edit("lib/format.mjs", [
    (
        "export function validateLevel(level) {\n  const errors = [], warnings = [];",
        "export function validateLevel(level) {\n  const errors = [], warnings = [];\n  const silverKeys = new Set(), silverGates = new Set();"
    ),
    (
        "      if (![8,11,12,18,20,22,23,26,28,64,86,96,118,129].includes(entity.type)) errors.push(`${label}: unsupported gameplay entity type ${entity.type}.`);\n      if (entity.type === 8) keyCount++;\n      if (entity.type === 20) chestCount++;",
        "      if (![8,11,12,18,20,22,23,26,28,64,86,96,118,129,130,131].includes(entity.type)) errors.push(`${label}: unsupported gameplay entity type ${entity.type}.`);\n      if (entity.type === 8) keyCount++;\n      if (entity.type === 20) chestCount++;\n      if (entity.type === 130) silverKeys.add((entity.flags ?? 0) & 0x3f);\n      if (entity.type === 131) silverGates.add((entity.flags ?? 0) & 0x3f);"
    ),
    (
        "  });\n  try { const size = encodeLevelPayload(level).length; if (size > MAX_APPVAR_PAYLOAD) errors.push(`Encoded level is ${size} bytes, over the AppVar limit.`); }",
        "  });\n  for (const link of silverGates) if (!silverKeys.has(link)) warnings.push(`Silver gate link ${link} has no matching silver key in this level.`);\n  for (const link of silverKeys) if (!silverGates.has(link)) warnings.push(`Silver key link ${link} has no matching silver gate in this level.`);\n  try { const size = encodeLevelPayload(level).length; if (size > MAX_APPVAR_PAYLOAD) errors.push(`Encoded level is ${size} bytes, over the AppVar limit.`); }"
    ),
])

edit("lib/pico8-cart.mjs", [
    (
        "const SUPPORTED_ENTITIES=new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129]);",
        "const SUPPORTED_ENTITIES=new Set([8,11,12,18,20,22,23,26,28,64,86,96,118,129,130,131]);"
    ),
    (
        "const SIMPLE_ROTATION_ENTITIES=new Set([8,18,20,23,26]);",
        "const SIMPLE_ROTATION_ENTITIES=new Set([8,18,20,23,26,130,131]);"
    ),
    (
        "studio_entities=${entityRows}\\nstudio_collected={}\\nstudio_complete=false",
        "studio_entities=${entityRows}\\nstudio_collected={}\\nstudio_gate_links={}\\nstudio_complete=false"
    ),
    (
        "if id==20 or id==26 or id==28 or id==64 or id==129 then return studio_collected[studio_key(e)]==true end",
        "if id==20 or id==26 or id==28 or id==64 or id==129 or id==130 then return studio_collected[studio_key(e)]==true end"
    ),
    (
        "end}\\nadd(types,climb_chest)\\n\\nlocal studio_old_init_object=init_object",
        "end}\\nadd(types,climb_chest)\\n\\nsilver_key={tile=130,if_not_fruit=true,update=function(this)\\n if this.check(player,0,0) then\\n  local link=band(this.studio_flags or 0,63)\\n  studio_gate_links[link]=true\\n  if this.studio_source~=nil then studio_collected[this.studio_source]=true end\\n  destroy_object(this)\\n end\\nend,draw=function(this)\\n local r=this.studio_rot or 0 local s=9+band(flr(frames/8),1)\\n pal(9,6) pal(10,7) studio_rot_spr(s,this.x,this.y,r) pal()\\nend}\\nadd(types,silver_key)\\n\\nsilver_gate={tile=131,update=function(this)\\n if studio_gate_links[band(this.studio_flags or 0,63)] then destroy_object(this) end\\nend,draw=function(this)\\n local r=this.studio_rot or 0\\n rectfill(this.x,this.y,this.x+7,this.y+7,5)\\n if band(r,1)>0 then rectfill(this.x,this.y+1,this.x+7,this.y+2,6) rectfill(this.x,this.y+5,this.x+7,this.y+6,6)\\n else rectfill(this.x+1,this.y,this.x+2,this.y+7,6) rectfill(this.x+5,this.y,this.x+6,this.y+7,6) end\\n rectfill(this.x+3,this.y+3,this.x+4,this.y+4,7)\\nend}\\nadd(types,silver_gate)\\n\\nlocal studio_old_init_object=init_object"
    ),
    (
        "function init_object(type,x,y)\\n if studio_suppress_fruit and type==fruit then return nil end\\n local meta=studio_meta_at(x,y)\\n local o=studio_old_init_object(type,x,y)",
        "function init_object(type,x,y)\\n local meta=studio_meta_at(x,y)\\n if studio_suppress_fruit and type==fruit then return nil end\\n if meta~=nil and meta[4]==131 and studio_gate_links[band(meta[5] or 0,63)] then return nil end\\n local o=studio_old_init_object(type,x,y)"
    ),
    (
        "if meta[4]==20 or meta[4]==26 or meta[4]==28 or meta[4]==64 or meta[4]==129 then o.studio_source=studio_key(meta) end",
        "if meta[4]==20 or meta[4]==26 or meta[4]==28 or meta[4]==64 or meta[4]==129 or meta[4]==130 then o.studio_source=studio_key(meta) end"
    ),
    (
        "  if type==orb and studio_orb_target~=nil then o.studio_target_dashes=studio_orb_target end\\n end\\n return o",
        "  if type==orb and studio_orb_target~=nil then o.studio_target_dashes=studio_orb_target end\\n  if type==player then\\n   local studio_old_solid=o.is_solid\\n   o.is_solid=function(ox,oy) if studio_old_solid(ox,oy) then return true end return o.check(silver_gate,ox,oy) end\\n  end\\n end\\n return o"
    ),
    (
        "if btnp(k_jump) or btnp(k_dash) then studio_collected={} studio_climb=false studio_stamina=110 studio_complete=false begin_game() end",
        "if btnp(k_jump) or btnp(k_dash) then studio_collected={} studio_gate_links={} studio_climb=false studio_stamina=110 studio_complete=false begin_game() end"
    ),
    (
        "studio_collected={} studio_climb=false studio_stamina=110 studio_complete=false\\n studio_old_init()",
        "studio_collected={} studio_gate_links={} studio_climb=false studio_stamina=110 studio_complete=false\\n studio_old_init()"
    ),
])

print("Studio silver key/gate source update complete")
