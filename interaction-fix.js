// Hardens editor keyboard shortcuts and rotation controls against focus quirks
// and third-party scripts injected by shared hosting. This file intentionally
// uses only the public DOM API so the core editor remains dependency-free.
const editorCanvas = document.getElementById('editorCanvas');
const previewDialog = document.getElementById('previewDialog');
const rotateCW = document.getElementById('rotateCW');
const rotateCCW = document.getElementById('rotateCCW');
const pieceMeta = document.getElementById('pieceMeta');
const cursorStatus = document.getElementById('cursorStatus');

const ROTATE_CW = new Map([
  [17,59],[59,27],[27,43],[43,17],
  [11,12],[12,11],
  [34,38],[38,50],[50,36],[36,34],
  [41,42],[42,58],[58,57],[57,41]
]);

function rotateCCWTarget(id) {
  for (const [from, to] of ROTATE_CW) if (to === id) return from;
  return null;
}

function focusEditor() {
  if (!editorCanvas) return;
  try { editorCanvas.focus({ preventScroll: true }); }
  catch { editorCanvas.focus(); }
}

function selectedPieceId() {
  // Prefer the actually highlighted palette item so stale inspector/status text
  // can never make rotation target the previously selected tile.
  const active = document.querySelector('.palette-item.active');
  const activeMatch = active?.title?.match(/\bID\s+(\d+)\b/i);
  if (activeMatch) return Number(activeMatch[1]);
  const match = pieceMeta?.textContent?.match(/\bID\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function rotationTargets(id) {
  return { cw: ROTATE_CW.get(id) ?? null, ccw: rotateCCWTarget(id) };
}

function setRotationStatus(id) {
  if (id == null || !cursorStatus) return;
  const { cw, ccw } = rotationTargets(id);
  if (cw != null && ccw != null) {
    cursorStatus.textContent = `Rotation: ID ${id} → ${cw} clockwise · ${ccw} counter-clockwise`;
  } else {
    cursorStatus.textContent = `ID ${id} has no distinct 90° counterpart`;
  }
}

function syncRotationControls(showStatus = false) {
  const id = selectedPieceId();
  if (id == null || !rotateCW || !rotateCCW) return;
  const { cw, ccw } = rotationTargets(id);
  const canCW = cw != null && cw !== id;
  const canCCW = ccw != null && ccw !== id;
  rotateCW.disabled = !canCW;
  rotateCCW.disabled = !canCCW;
  rotateCW.title = canCW
    ? `Rotate clockwise: PICO-8 ID ${id} → ID ${cw}`
    : 'This piece has no distinct clockwise counterpart in the original Celeste Classic tile set.';
  rotateCCW.title = canCCW
    ? `Rotate counter-clockwise: PICO-8 ID ${id} → ID ${ccw}`
    : 'This piece has no distinct counter-clockwise counterpart in the original Celeste Classic tile set.';
  if (showStatus) setRotationStatus(id);
}

function isEditableTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function clickTool(name) {
  const button = document.querySelector(`[data-tool="${name}"]`);
  if (!button) return false;
  button.click();
  focusEditor();
  return true;
}

// Keep rotation button state synchronized whenever the core editor changes the
// selected palette item or inspector contents.
if (pieceMeta) {
  new MutationObserver(() => syncRotationControls(false)).observe(pieceMeta, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
queueMicrotask(() => syncRotationControls(false));

// Palette/tool clicks should hand focus back to the canvas so the next key is
// an editor shortcut rather than remaining stuck on a button/control.
document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest('.palette-item, [data-tool], #rotateCW, #rotateCCW, #setSpawn')) {
    queueMicrotask(() => {
      syncRotationControls(true);
      focusEditor();
    });
  }
}, true);

// Capture phase makes editor shortcuts deterministic even when hosting injects
// additional bubbling key handlers. Text fields still behave normally; Escape
// leaves a text field and returns focus to the editor.
window.addEventListener('keydown', event => {
  if (previewDialog?.open) return;

  if (isEditableTarget(event.target)) {
    if (event.code === 'Escape' || event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.target.blur();
      focusEditor();
    }
    return;
  }

  const code = event.code || '';
  const key = (event.key || '').toLowerCase();

  if ((event.ctrlKey || event.metaKey) && (code === 'KeyZ' || key === 'z')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById(event.shiftKey ? 'redo' : 'undo')?.click();
    focusEditor();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && (code === 'KeyR' || key === 'r')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    syncRotationControls(false);
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
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const toolsByCode = {
    KeyB: 'pencil',
    KeyE: 'eraser',
    KeyF: 'fill',
    KeyI: 'eyedropper'
  };
  const toolsByKey = { b: 'pencil', e: 'eraser', f: 'fill', i: 'eyedropper' };
  const tool = toolsByCode[code] || toolsByKey[key];
  if (tool && clickTool(tool)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
