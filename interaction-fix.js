// Hardens editor keyboard shortcuts and rotation controls against focus quirks
// and third-party scripts injected by shared hosting. This file intentionally
// uses only the public DOM API so the core editor remains dependency-free.
const editorCanvas = document.getElementById('editorCanvas');
const previewDialog = document.getElementById('previewDialog');
const rotateCW = document.getElementById('rotateCW');
const rotateCCW = document.getElementById('rotateCCW');
const pieceMeta = document.getElementById('pieceMeta');
const cursorStatus = document.getElementById('cursorStatus');

const ROTATABLE_IDS = new Set([
  17, 59, 27, 43,       // spikes: up/right/down/left
  11, 12,               // moving platforms: left/right
  34, 38, 50, 36,       // terrain rotation family
  41, 42, 58, 57        // terrain/decor rotation family
]);

function focusEditor() {
  if (!editorCanvas) return;
  try { editorCanvas.focus({ preventScroll: true }); }
  catch { editorCanvas.focus(); }
}

function selectedPieceId() {
  const match = pieceMeta?.textContent?.match(/\bID\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function syncRotationControls() {
  const id = selectedPieceId();
  if (id == null || !rotateCW || !rotateCCW) return;
  const canRotate = ROTATABLE_IDS.has(id);
  rotateCW.disabled = !canRotate;
  rotateCCW.disabled = !canRotate;
  const hint = canRotate
    ? 'Rotate using the matching Celeste Classic/PICO-8 counterpart.'
    : 'This piece has no distinct 90° counterpart in the original Celeste Classic tile set.';
  rotateCW.title = hint;
  rotateCCW.title = hint;
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
  new MutationObserver(syncRotationControls).observe(pieceMeta, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
queueMicrotask(syncRotationControls);

// Palette/tool clicks should hand focus back to the canvas so the next key is
// an editor shortcut rather than remaining stuck on a button/control.
document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest('.palette-item, [data-tool], #rotateCW, #rotateCCW, #setSpawn')) {
    queueMicrotask(() => {
      syncRotationControls();
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
    syncRotationControls();
    const button = event.shiftKey ? rotateCCW : rotateCW;
    if (button && !button.disabled) {
      button.click();
      syncRotationControls();
      focusEditor();
    } else if (cursorStatus) {
      cursorStatus.textContent = 'This piece has no distinct rotated counterpart';
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
