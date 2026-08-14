from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Remove the explicit unlisted project-share button. Legacy ?share= links remain
# readable for backwards compatibility, while public level sharing happens through Community.
replace(
    "index.html",
    '      <button id="shareProject" disabled>Share project</button>\n',
    ''
)

# Room navigation should not require hunting through the sidebar list.
replace(
    "index.html",
    '      <div class="room-actions">\n        <button id="duplicateRoom">Duplicate room</button>',
    '      <div class="room-actions">\n        <button id="previousRoom" title="Previous room ([)">← Previous room</button>\n        <button id="nextRoom" title="Next room (])">Next room →</button>\n        <button id="duplicateRoom">Duplicate room</button>'
)
replace(
    "index.html",
    '        <p><kbd>Ctrl/Cmd+Z</kbd> undo · <kbd>Shift+Ctrl/Cmd+Z</kbd> redo</p>\n        <p>Right-click erases. Drag paints.</p>',
    '        <p><kbd>Ctrl/Cmd+Z</kbd> undo · <kbd>Shift+Ctrl/Cmd+Z</kbd> redo · <kbd>Ctrl/Cmd+S</kbd> save project</p>\n        <p><kbd>[</kbd> previous room · <kbd>]</kbd> next room · Right-click erases · Drag paints.</p>'
)

# Add real keyboard navigation/save shortcuts.
replace(
    "app.js",
    "window.addEventListener('keydown',e=>{\n  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;\n  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}\n  if(e.key.toLowerCase()==='r'&&!$('previewDialog').open){e.preventDefault();rotateSelected(!e.shiftKey);return;}",
    "window.addEventListener('keydown',e=>{\n  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;\n  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('saveProject').click();return;}\n  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}\n  if(e.key==='['&&!$('previewDialog').open){e.preventDefault();switchRoom(-1);return;}\n  if(e.key===']'&&!$('previewDialog').open){e.preventDefault();switchRoom(1);return;}\n  if(e.key.toLowerCase()==='r'&&!$('previewDialog').open){e.preventDefault();rotateSelected(!e.shiftKey);return;}"
)
replace(
    "app.js",
    "function moveRoom(d){const rooms=currentLevel().rooms,i=project.activeRoom,n=i+d;if(n<0||n>=rooms.length)return;pushHistory();[rooms[i],rooms[n]]=[rooms[n],rooms[i]];project.activeRoom=n;commit();renderAll();}\n$('moveRoomUp').onclick=()=>moveRoom(-1);$('moveRoomDown').onclick=()=>moveRoom(1);",
    "function switchRoom(d){const rooms=currentLevel().rooms,i=project.activeRoom,n=Math.max(0,Math.min(rooms.length-1,i+d));if(n===i)return;project.activeRoom=n;commit();renderAll();}\nfunction moveRoom(d){const rooms=currentLevel().rooms,i=project.activeRoom,n=i+d;if(n<0||n>=rooms.length)return;pushHistory();[rooms[i],rooms[n]]=[rooms[n],rooms[i]];project.activeRoom=n;commit();renderAll();}\n$('previousRoom').onclick=()=>switchRoom(-1);$('nextRoom').onclick=()=>switchRoom(1);\n$('moveRoomUp').onclick=()=>moveRoom(-1);$('moveRoomDown').onclick=()=>moveRoom(1);"
)

# Keep docs/tests aligned with the intentionally removed button while preserving
# legacy deep-link compatibility.
replace(
    "README.md",
    "The hosted editor is public: **there is no Studio password gate**. The GoDaddy/cPanel build supports both unlisted project sharing and a public Community Level Browser using small same-origin PHP endpoints.",
    "The hosted editor is public: **there is no Studio password gate**. The GoDaddy/cPanel build supports a public Community Level Browser using a small same-origin PHP endpoint. Older unlisted `?share=` links remain readable for backwards compatibility, but Studio no longer exposes a Share Project button."
)
replace(
    "README.md",
    "## Unlisted project sharing\n\nClick **Share project** to upload the current `.celproj` project data and receive an unlisted link such as `?share=<random-id>`.\n",
    "## Legacy unlisted project links\n\nStudio no longer exposes a **Share project** button. Existing `?share=<random-id>` links can still be opened so older links do not break.\n"
)
replace(
    "README.md",
    "- Unlisted hosted project links\n",
    ""
)
replace(
    "README.md",
    "The local Python server does not execute PHP, so **Share project**, **Browse levels**, and **Publish level** are automatically disabled there. Those features are available on the PHP-enabled hosted build.",
    "The local Python server does not execute PHP, so **Browse levels** and **Publish level** are automatically disabled there. Those community features are available on the PHP-enabled hosted build."
)
replace(
    "tests/public-sharing.test.mjs",
    "  assert.match(html, /id=\"shareProject\"/);",
    "  assert.doesNotMatch(html, /id=\"shareProject\"/);"
)

print("Applied Studio QoL polish")
