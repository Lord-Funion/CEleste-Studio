const SHARE_ENDPOINT = 'share.php';
const AUTOSAVE_KEY = 'celeste-studio-autosave';

let pendingNotice = null;
let sharingAvailable = false;

function apiUrl(params = {}) {
  const url = new URL(SHARE_ENDPOINT, window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

function shareUrl(id) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('share', id);
  return url.href;
}

function stripShareQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(response.ok ? 'The sharing service returned an invalid response.' : `Sharing service error (${response.status}).`);
  }
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `Sharing service error (${response.status}).`);
  return data;
}

async function loadSharedProjectBeforeStudio() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('share');
  if (!id) return;

  try {
    const response = await fetch(apiUrl({ id }), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readJsonResponse(response);
    if (!data?.project?.levels?.length) throw new Error('The shared project is missing level data.');
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data.project));
    pendingNotice = {
      title: 'Shared project loaded',
      message: `Loaded “${data.project.title || 'Untitled project'}”. You can edit it normally; your changes are saved only in this browser until you share again.`,
      link: shareUrl(id),
      download: apiUrl({ id, download: 1 }).href
    };
    stripShareQuery();
  } catch (error) {
    pendingNotice = {
      title: 'Could not load shared project',
      message: error?.message || String(error)
    };
  }
}

async function updateCartButton() {
  const button = document.getElementById('privateCartButton');
  if (!button) return;
  const { getPrivateCartInfo, pickAndStorePrivateCart } = await import('./lib/private-cart.mjs');

  const refresh = async () => {
    const info = await getPrivateCartInfo();
    button.textContent = info ? `Original cart: ${info.name}` : 'Set original Celeste .p8';
    button.title = info
      ? 'Stored only in this browser. Click to replace it.'
      : 'Choose your own original Celeste Classic text .p8 cart. It never uploads to the server.';
  };

  button.onclick = async () => {
    try {
      const saved = await pickAndStorePrivateCart();
      if (saved) await refresh();
    } catch (error) {
      showNotice('Could not store cartridge', error?.message || String(error));
    }
  };

  window.addEventListener('celeste-private-cart-changed', refresh);
  await refresh();
}

function showNotice(title, message, link = '', download = '') {
  const dialog = document.getElementById('shareDialog');
  if (!dialog) {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  document.getElementById('shareTitle').textContent = title;
  document.getElementById('shareMessage').textContent = message;
  const linkWrap = document.getElementById('shareLinkWrap');
  const linkInput = document.getElementById('shareLink');
  const downloadLink = document.getElementById('shareDownload');

  if (link) {
    linkWrap.hidden = false;
    linkInput.value = link;
  } else {
    linkWrap.hidden = true;
    linkInput.value = '';
  }

  if (download) {
    downloadLink.hidden = false;
    downloadLink.href = download;
  } else {
    downloadLink.hidden = true;
    downloadLink.removeAttribute('href');
  }

  if (!dialog.open) dialog.showModal();
}

async function copyText(text) {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the selection-based fallback.
    }
  }

  const input = document.getElementById('shareLink');
  if (!input) return false;
  input.focus();
  input.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

async function checkSharingService() {
  const button = document.getElementById('shareProject');
  if (!button) return;
  button.disabled = true;
  button.title = 'Checking the PHP sharing service…';

  try {
    const response = await fetch(apiUrl({ health: 1 }), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readJsonResponse(response);
    if (!data?.ok) throw new Error('Sharing service is unavailable.');
    sharingAvailable = true;
    button.disabled = false;
    button.title = 'Upload the current .celproj data and copy a share link';
  } catch {
    sharingAvailable = false;
    button.disabled = true;
    button.title = 'Project sharing requires the PHP-enabled hosted build.';
  }
}

async function shareCurrentProject() {
  const button = document.getElementById('shareProject');
  if (!sharingAvailable || !button) return;

  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    showNotice('Nothing to share', 'Make or open a project first, then try again.');
    return;
  }

  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Sharing…';

  try {
    const response = await fetch(apiUrl(), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: raw
    });
    const data = await readJsonResponse(response);
    if (!data?.id) throw new Error('The sharing service did not return a share ID.');

    const link = shareUrl(data.id);
    const download = apiUrl({ id: data.id, download: 1 }).href;
    const copied = await copyText(link);
    showNotice(
      'Project shared',
      copied ? 'The share link was copied to your clipboard.' : 'Copy the link below and send it to whoever you want to share the project with.',
      link,
      download
    );
  } catch (error) {
    showNotice('Could not share project', error?.message || String(error));
  } finally {
    button.textContent = oldText;
    button.disabled = !sharingAvailable;
  }
}

function wireSharingUi() {
  document.getElementById('shareProject')?.addEventListener('click', shareCurrentProject);
  document.getElementById('shareClose')?.addEventListener('click', () => document.getElementById('shareDialog')?.close());
  document.getElementById('shareCopy')?.addEventListener('click', async () => {
    const input = document.getElementById('shareLink');
    if (!input?.value) return;
    const copied = await copyText(input.value);
    const button = document.getElementById('shareCopy');
    const oldText = button.textContent;
    button.textContent = copied ? 'Copied!' : 'Select & copy';
    setTimeout(() => { button.textContent = oldText; }, 1400);
  });
}

function showFatal(error) {
  const dialog = document.getElementById('messageDialog');
  const title = document.getElementById('messageTitle');
  const body = document.getElementById('messageBody');
  if (dialog && title && body) {
    title.textContent = 'CEleste Studio failed to load';
    body.textContent = error?.message || String(error);
    if (!dialog.open) dialog.showModal();
  } else {
    window.alert(`CEleste Studio failed to load\n\n${error?.message || error}`);
  }
}

try {
  await loadSharedProjectBeforeStudio();
  await import('./app.js?v=20260812-public-sharing-v1');
  await import('./interaction-fix.js?v=20260808-rotation-map2');
  await updateCartButton();
  wireSharingUi();
  await checkSharingService();

  if (pendingNotice) {
    showNotice(pendingNotice.title, pendingNotice.message, pendingNotice.link, pendingNotice.download);
  }
} catch (error) {
  console.error(error);
  showFatal(error);
}
