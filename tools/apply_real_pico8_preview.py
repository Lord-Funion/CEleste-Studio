#!/usr/bin/env python3
from pathlib import Path

p=Path('app.js')
s=p.read_text()

needle="} from './lib/format.mjs';\n"
addition="} from './lib/format.mjs';\nimport {createPico8Preview} from './lib/pico8-preview.mjs';\n"
if "createPico8Preview" not in s:
    if needle not in s: raise SystemExit('format import marker not found')
    s=s.replace(needle,addition,1)

old="spriteAtlas.onload=()=>{spriteAtlasReady=true;renderPalette();drawEditor();if(preview.running)drawPreview(currentLevel().rooms[preview.room]);};"
new="spriteAtlas.onload=()=>{spriteAtlasReady=true;renderPalette();drawEditor();};"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('sprite atlas onload marker not found')

old_preview="let preview={running:false,keys:new Set(),room:0,x:0,y:0,vx:0,vy:0,won:false,raf:0,lastTime:0,accum:0,maxDashes:1,collectedSources:new Set(),entities:[],climbEnabled:false,climbStamina:1100,climbing:false};\n"
if old_preview in s:s=s.replace(old_preview,'',1)

start=s.find('// PICO-8-faithful playable preview.')
end=s.rfind('\nrenderAll();')
marker='const pico8Preview=createPico8Preview({'
if start>=0:
    if end<start: raise SystemExit('renderAll end marker not found')
    replacement="""// Real PICO-8 preview: Studio generates a cartridge for the current level and\n// executes it inside Fake-08 WebAssembly. Browser JavaScript no longer owns\n// player physics, collision, entity timing, or room transitions.\nconst pico8Preview=createPico8Preview({\n  canvas:previewCanvas,status:$('previewStatus'),dialog:$('previewDialog')\n});\n$('previewButton').onclick=async()=>{\n  const validation=validateLevel(currentLevel());\n  if(!validation.valid)return showValidation(validation);\n  try{await pico8Preview.start(currentLevel());}\n  catch(err){pico8Preview.stop();showMessage('PICO-8 preview failed',err?.message||String(err));}\n};\n$('closePreview').onclick=()=>pico8Preview.stop();\n$('previewDialog').addEventListener('close',()=>pico8Preview.stop(false));\n"""
    s=s[:start]+replacement+s[end:]
elif marker not in s:
    raise SystemExit('neither old nor new preview block found')
p.write_text(s)

p=Path('index.html');s=p.read_text()
s=s.replace('<div class="dialog-head"><div><h2>Playable preview</h2><p>PICO-8 physics: arrows move, Z jumps, X dashes, C grabs/climbs after a Climb Chest (MATH on calculator), R restarts. Complete each room by exiting through the top.</p></div><button id="closePreview">Close</button></div>',
'''<div class="dialog-head"><div><h2>Real PICO-8 emulator preview</h2><p>Studio builds your level into a PICO-8 cartridge and runs it in Fake-08: arrows move, Z jumps, X dashes, C grabs/climbs after a Climb Chest (MATH on calculator), R restarts. Rooms complete by exiting through the top.</p></div><button id="closePreview">Close</button></div>''')
s=s.replace('<p class="hint">Rooms finish only by climbing through the top. The summit flag is optional.</p>','<p class="hint">Rooms finish by exiting through the top edge. The summit flag is optional.</p>')
s=s.replace('app.js?v=20260808-climb-chest','app.js?v=20260808-real-pico8')
p.write_text(s)

p=Path('README.md');s=p.read_text()
old='- PICO-8-style 30 Hz playable preview with acceleration, gravity, coyote time, jump buffering, wall slides/jumps, 8-way dash, spikes, springs, balloons, moving platforms, falling floors, key/chest state, fake-wall breaks, fruit collection, dash upgrades, deaths/restarts, and top-of-room transitions'
new='- Real PICO-8 cartridge preview executed by Fake-08 WebAssembly; Studio generates the current level into a cart so browser JavaScript does not reimplement player physics or collision'
if old in s:s=s.replace(old,new,1)
if '## Real PICO-8 preview' not in s:
    anchor='## Local development\n'
    section='''## Real PICO-8 preview\n\nThe Preview button does not simulate Celeste physics in JavaScript. Studio generates a temporary `.p8` cartridge from the selected level and executes it in a PICO-8-compatible Fake-08 WebAssembly runtime. The cartridge uses the same Celeste atlas, tile flags, room data, gameplay entities, CEleste movement constants/order, arbitrary CELV rotations, and Climb Chest mechanics. JavaScript only generates the cartridge, forwards input, and displays the emulator framebuffer.\n\nThe runtime is a clean implementation based on the MIT-licensed official Celeste Classic reference in `NoelFB/Celeste` plus the current CEleste custom-level behavior. The unlicensed Lexaloffle BBS Celeste cartridge is not redistributed by Studio. Fake-08 is fetched from a pinned upstream build by the deployment workflow; see `THIRD-PARTY-NOTICES.md`.\n\n'''
    if anchor not in s:raise SystemExit('README Local development marker missing')
    s=s.replace(anchor,section+anchor,1)
p.write_text(s)

print('Real Fake-08 PICO-8 preview migration is applied.')
