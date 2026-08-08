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
if start<0: raise SystemExit('old preview block marker not found')
if end<start: raise SystemExit('renderAll end marker not found')
replacement="""// Real PICO-8 preview: Studio generates a cartridge for the current level and\n// executes it inside Fake-08 WebAssembly. Browser JavaScript no longer owns\n// player physics, collision, entity timing, or room transitions.\nconst pico8Preview=createPico8Preview({\n  canvas:previewCanvas,status:$('previewStatus'),dialog:$('previewDialog')\n});\n$('previewButton').onclick=async()=>{\n  const validation=validateLevel(currentLevel());\n  if(!validation.valid)return showValidation(validation);\n  try{await pico8Preview.start(currentLevel());}\n  catch(err){pico8Preview.stop();showMessage('PICO-8 preview failed',err?.message||String(err));}\n};\n$('closePreview').onclick=()=>pico8Preview.stop();\n$('previewDialog').addEventListener('close',()=>pico8Preview.stop(false));\n"""
s=s[:start]+replacement+s[end:]
p.write_text(s)
print('Migrated Studio to real Fake-08 PICO-8 preview.')
