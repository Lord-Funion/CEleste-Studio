const SHARE_ENDPOINT = 'share.php';
const COMMUNITY_ENDPOINT = 'community.php';
const AUTOSAVE_KEY = 'celeste-studio-autosave';
const COMMUNITY_CLIENT_KEY = 'celeste-studio-community-client-v1';
const COMMUNITY_NAME_KEY = 'celeste-studio-community-name-v1';

let pendingNotice = null;
let communityAvailable = false;
let communityOffset = 0;
let communityTotal = 0;
let communityLoading = false;
let communitySelectedId = null;
let communitySearchTimer = null;

function endpointUrl(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

const shareApiUrl = params => endpointUrl(SHARE_ENDPOINT, params);
const communityApiUrl = params => endpointUrl(COMMUNITY_ENDPOINT, params);

function shareUrl(id) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('share', id);
  return url.href;
}

function communityLevelUrl(id) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('level', id);
  return url.href;
}

function stripShareQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function setLevelQuery(id) {
  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  if (id) url.searchParams.set('level', id);
  else url.searchParams.delete('level');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(response.ok ? 'The server returned an invalid response.' : `Server error (${response.status}).`);
  }
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `Server error (${response.status}).`);
  return data;
}

async function loadSharedProjectBeforeStudio() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('share');
  if (!id) return;

  try {
    const response = await fetch(shareApiUrl({ id }), {
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
      download: shareApiUrl({ id, download: 1 }).href
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

  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  document.body.append(temp);
  temp.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  temp.remove();
  return copied;
}

function wireSharingUi() {
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

function getCommunityClientId() {
  let id = localStorage.getItem(COMMUNITY_CLIENT_KEY);
  if (id && /^[A-Za-z0-9_-]{12,128}$/.test(id)) return id;
  if (globalThis.crypto?.randomUUID) id = crypto.randomUUID();
  else id = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(COMMUNITY_CLIENT_KEY, id);
  return id;
}

function currentLevelProject() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) throw new Error('There is no active project to publish.');
  const project = JSON.parse(raw);
  if (!project?.levels?.length) throw new Error('The active project contains no levels.');
  const activeLevel = Math.max(0, Math.min(Number(project.activeLevel) || 0, project.levels.length - 1));
  const level = structuredClone(project.levels[activeLevel]);
  if (!level?.rooms?.length) throw new Error('The active level contains no rooms.');
  const published = {
    ...project,
    title: level.title || project.title || 'Untitled level',
    author: level.author || project.author || '',
    description: level.description || '',
    levels: [level],
    activeLevel: 0,
    activeRoom: 0
  };
  return { project: published, level };
}

function difficultyName(value) {
  return ['Unrated', 'Easy', 'Normal', 'Hard', 'Expert', 'Extreme'][Number(value) || 0] || 'Unrated';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function checkCommunityService() {
  const browse = document.getElementById('communityBrowse');
  const publish = document.getElementById('communityPublish');
  for (const button of [browse, publish]) {
    if (button) {
      button.disabled = true;
      button.title = 'Checking the PHP community service…';
    }
  }

  try {
    const response = await fetch(communityApiUrl({ health: 1 }), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readJsonResponse(response);
    if (!data?.ok) throw new Error('Community service is unavailable.');
    communityAvailable = true;
    if (browse) {
      browse.disabled = false;
      browse.title = 'Browse, rate, comment on, and download community levels';
    }
    if (publish) {
      publish.disabled = false;
      publish.title = 'Publish the currently active level to the public browser';
    }
  } catch {
    communityAvailable = false;
    if (browse) {
      browse.disabled = true;
      browse.title = 'Community browsing requires the PHP-enabled hosted build.';
    }
    if (publish) {
      publish.disabled = true;
      publish.title = 'Community publishing requires the PHP-enabled hosted build.';
    }
  }
}

function createElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== '') element.textContent = text;
  return element;
}

function renderCommunityCard(item) {
  const card = createElement('button', 'community-card');
  card.type = 'button';
  card.dataset.id = item.id;
  if (item.id === communitySelectedId) card.classList.add('active');

  const top = createElement('div', 'community-card-top');
  const title = createElement('strong', '', item.title || 'Untitled level');
  const difficulty = createElement('span', 'community-difficulty', difficultyName(item.difficulty));
  top.append(title, difficulty);

  const byline = createElement('div', 'community-byline', `by ${item.author || 'Unknown'} · published by ${item.publisher || 'Anonymous'}`);
  const description = createElement('p', 'community-card-description', item.description || 'No description.');
  const stats = createElement('div', 'community-stats');
  stats.append(
    createElement('span', '', `👍 ${item.likes}`),
    createElement('span', '', `👎 ${item.dislikes}`),
    createElement('span', '', `💬 ${item.comments}`),
    createElement('span', '', `⬇ ${item.downloads}`),
    createElement('span', '', `👁 ${item.views}`),
    createElement('span', '', `${item.rooms} room${item.rooms === 1 ? '' : 's'}`)
  );
  card.append(top, byline, description, stats);
  card.addEventListener('click', () => loadCommunityDetail(item.id));
  return card;
}

async function loadCommunityList(reset = true) {
  if (!communityAvailable || communityLoading) return;
  communityLoading = true;
  const status = document.getElementById('communityStatus');
  const list = document.getElementById('communityList');
  const more = document.getElementById('communityMore');
  if (!status || !list || !more) return;

  if (reset) {
    communityOffset = 0;
    communityTotal = 0;
    list.innerHTML = '';
  }
  status.textContent = reset ? 'Loading community levels…' : 'Loading more levels…';
  more.disabled = true;

  try {
    const q = document.getElementById('communitySearch')?.value?.trim() || '';
    const sort = document.getElementById('communitySort')?.value || 'popular';
    const response = await fetch(communityApiUrl({ list: 1, sort, q, offset: communityOffset, limit: 24 }), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readJsonResponse(response);
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) list.append(renderCommunityCard(item));
    communityOffset += items.length;
    communityTotal = Number(data.total) || 0;
    status.textContent = communityTotal
      ? `${communityTotal.toLocaleString()} community level${communityTotal === 1 ? '' : 's'} · showing ${Math.min(communityOffset, communityTotal).toLocaleString()}`
      : 'No community levels match this search yet.';
    more.hidden = communityOffset >= communityTotal;
  } catch (error) {
    status.textContent = error?.message || String(error);
    more.hidden = true;
  } finally {
    communityLoading = false;
    more.disabled = false;
  }
}

function renderComment(comment) {
  const row = createElement('article', 'community-comment');
  const head = createElement('div', 'community-comment-head');
  head.append(
    createElement('strong', '', comment.name || 'Anonymous'),
    createElement('time', '', formatDate(comment.createdAt))
  );
  const body = createElement('p', '', comment.body || '');
  row.append(head, body);
  return row;
}

function renderCommunityDetail(item) {
  const root = document.getElementById('communityDetail');
  if (!root) return;
  root.innerHTML = '';

  const title = createElement('h3', '', item.title || 'Untitled level');
  const byline = createElement('p', 'community-detail-byline', `by ${item.author || 'Unknown'} · published by ${item.publisher || 'Anonymous'} · ${formatDate(item.createdAt)}`);
  const description = createElement('p', 'community-detail-description', item.description || 'No description.');
  const info = createElement('div', 'community-detail-info');
  info.append(
    createElement('span', '', difficultyName(item.difficulty)),
    createElement('span', '', `${item.rooms} room${item.rooms === 1 ? '' : 's'}`),
    createElement('span', '', `👁 ${item.views}`),
    createElement('span', '', `⬇ ${item.downloads}`),
    createElement('span', '', `💬 ${item.comments}`)
  );

  const actions = createElement('div', 'community-actions');
  const like = createElement('button', item.myReaction === 'like' ? 'active' : '', `👍 ${item.likes}`);
  like.type = 'button';
  like.title = item.myReaction === 'like' ? 'Remove like' : 'Like this level';
  like.addEventListener('click', () => voteCommunity(item.id, item.myReaction === 'like' ? 'none' : 'like'));

  const dislike = createElement('button', item.myReaction === 'dislike' ? 'active' : '', `👎 ${item.dislikes}`);
  dislike.type = 'button';
  dislike.title = item.myReaction === 'dislike' ? 'Remove dislike' : 'Dislike this level';
  dislike.addEventListener('click', () => voteCommunity(item.id, item.myReaction === 'dislike' ? 'none' : 'dislike'));

  const open = createElement('button', 'primary', 'Open in Studio');
  open.type = 'button';
  open.addEventListener('click', () => openCommunityLevel(item.id));

  const download = createElement('a', 'button', 'Download .celproj');
  download.href = communityApiUrl({ id: item.id, download: 1 }).href;

  const copy = createElement('button', '', 'Copy level link');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    const copied = await copyText(communityLevelUrl(item.id));
    const old = copy.textContent;
    copy.textContent = copied ? 'Copied!' : 'Copy failed';
    setTimeout(() => { copy.textContent = old; }, 1400);
  });

  actions.append(like, dislike, open, download, copy);

  const commentsHeader = createElement('h4', '', `Comments (${item.comments})`);
  const form = createElement('div', 'community-comment-form');
  const name = document.createElement('input');
  name.id = 'communityCommentName';
  name.maxLength = 32;
  name.placeholder = 'Display name';
  name.autocomplete = 'nickname';
  name.value = localStorage.getItem(COMMUNITY_NAME_KEY) || '';
  const body = document.createElement('textarea');
  body.id = 'communityCommentBody';
  body.maxLength = 1000;
  body.placeholder = 'Write a comment…';
  const submit = createElement('button', 'primary', 'Post comment');
  submit.type = 'button';
  submit.addEventListener('click', () => postCommunityComment(item.id));
  form.append(name, body, submit);

  const comments = createElement('div', 'community-comments');
  const rows = Array.isArray(item.commentList) ? [...item.commentList].reverse() : [];
  if (!rows.length) comments.append(createElement('p', 'community-empty', 'No comments yet.'));
  else for (const comment of rows) comments.append(renderComment(comment));

  root.append(title, byline, description, info, actions, commentsHeader, form, comments);
}

async function loadCommunityDetail(id) {
  if (!communityAvailable || !id) return;
  communitySelectedId = id;
  setLevelQuery(id);
  const root = document.getElementById('communityDetail');
  if (root) root.innerHTML = '<div class="community-empty">Loading level details…</div>';

  for (const card of document.querySelectorAll('.community-card')) {
    card.classList.toggle('active', card.dataset.id === id);
  }

  try {
    const response = await fetch(communityApiUrl({ id, clientId: getCommunityClientId() }), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readJsonResponse(response);
    if (!data?.item) throw new Error('The community service returned no level details.');
    renderCommunityDetail(data.item);
  } catch (error) {
    if (root) root.textContent = error?.message || String(error);
  }
}

async function voteCommunity(id, reaction) {
  try {
    const response = await fetch(communityApiUrl(), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'vote', id, reaction, clientId: getCommunityClientId() })
    });
    await readJsonResponse(response);
    await loadCommunityDetail(id);
  } catch (error) {
    showNotice('Could not save reaction', error?.message || String(error));
  }
}

async function postCommunityComment(id) {
  const nameInput = document.getElementById('communityCommentName');
  const bodyInput = document.getElementById('communityCommentBody');
  const name = nameInput?.value?.trim() || 'Anonymous';
  const body = bodyInput?.value?.trim() || '';
  if (!body) {
    bodyInput?.focus();
    return;
  }
  localStorage.setItem(COMMUNITY_NAME_KEY, name.slice(0, 32));
  try {
    const response = await fetch(communityApiUrl(), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'comment', id, name, body, clientId: getCommunityClientId() })
    });
    await readJsonResponse(response);
    if (bodyInput) bodyInput.value = '';
    await loadCommunityDetail(id);
  } catch (error) {
    showNotice('Could not post comment', error?.message || String(error));
  }
}

async function openCommunityLevel(id) {
  if (!confirm('Open this community level in Studio? Your current browser autosave will be replaced. Save your current project first if you want to keep it.')) return;
  try {
    const response = await fetch(communityApiUrl({ id, load: 1 }), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await readJsonResponse(response);
    if (!data?.project?.levels?.length) throw new Error('The community level data is invalid.');
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data.project));
    setLevelQuery('');
    document.getElementById('communityDialog')?.close();
    location.reload();
  } catch (error) {
    showNotice('Could not open level', error?.message || String(error));
  }
}

function openPublishDialog() {
  if (!communityAvailable) return;
  try {
    const { level } = currentLevelProject();
    const dialog = document.getElementById('publishDialog');
    const name = document.getElementById('publisherName');
    const summary = document.getElementById('publishSummary');
    const status = document.getElementById('publishStatus');
    if (summary) summary.textContent = `Publish “${level.title || 'Untitled level'}” (${level.rooms.length} room${level.rooms.length === 1 ? '' : 's'}) to the public Community Level Browser.`;
    if (name) name.value = localStorage.getItem(COMMUNITY_NAME_KEY) || level.author || '';
    if (status) status.textContent = '';
    if (dialog && !dialog.open) dialog.showModal();
  } catch (error) {
    showNotice('Cannot publish level', error?.message || String(error));
  }
}

async function publishCurrentLevel() {
  const button = document.getElementById('publishConfirm');
  const status = document.getElementById('publishStatus');
  const nameInput = document.getElementById('publisherName');
  if (!button || !communityAvailable) return;

  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Publishing…';
  if (status) status.textContent = 'Uploading a public copy of the active level…';

  try {
    const { project } = currentLevelProject();
    const publisher = nameInput?.value?.trim() || 'Anonymous';
    localStorage.setItem(COMMUNITY_NAME_KEY, publisher.slice(0, 32));
    const response = await fetch(communityApiUrl(), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'publish', publisher, clientId: getCommunityClientId(), project })
    });
    const data = await readJsonResponse(response);
    if (!data?.item?.id) throw new Error('The community service did not return the published level.');
    document.getElementById('publishDialog')?.close();
    const browser = document.getElementById('communityDialog');
    if (browser && !browser.open) browser.showModal();
    await loadCommunityList(true);
    await loadCommunityDetail(data.item.id);
  } catch (error) {
    if (status) status.textContent = error?.message || String(error);
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function openCommunityBrowser() {
  if (!communityAvailable) return;
  const dialog = document.getElementById('communityDialog');
  if (dialog && !dialog.open) dialog.showModal();
  loadCommunityList(true);
}

function wireCommunityUi() {
  document.getElementById('communityBrowse')?.addEventListener('click', openCommunityBrowser);
  document.getElementById('communityPublish')?.addEventListener('click', openPublishDialog);
  document.getElementById('communityClose')?.addEventListener('click', () => document.getElementById('communityDialog')?.close());
  document.getElementById('publishClose')?.addEventListener('click', () => document.getElementById('publishDialog')?.close());
  document.getElementById('publishConfirm')?.addEventListener('click', publishCurrentLevel);
  document.getElementById('communityRefresh')?.addEventListener('click', () => loadCommunityList(true));
  document.getElementById('communitySort')?.addEventListener('change', () => loadCommunityList(true));
  document.getElementById('communityMore')?.addEventListener('click', () => loadCommunityList(false));
  document.getElementById('communitySearch')?.addEventListener('input', () => {
    clearTimeout(communitySearchTimer);
    communitySearchTimer = setTimeout(() => loadCommunityList(true), 300);
  });
}

async function openDeepLinkedCommunityLevel() {
  if (!communityAvailable) return;
  const id = new URLSearchParams(window.location.search).get('level');
  if (!id || !/^[a-f0-9]{32}$/i.test(id)) return;
  const dialog = document.getElementById('communityDialog');
  if (dialog && !dialog.open) dialog.showModal();
  await loadCommunityList(true);
  await loadCommunityDetail(id.toLowerCase());
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
  await import('./app.js?v=20260814-editor-qol');
  await import('./interaction-fix.js?v=20260808-rotation-map2');
  await updateCartButton();
  wireSharingUi();
  wireCommunityUi();
  await checkCommunityService();

  if (pendingNotice) {
    showNotice(pendingNotice.title, pendingNotice.message, pendingNotice.link, pendingNotice.download);
  }
  await openDeepLinkedCommunityLevel();
} catch (error) {
  console.error(error);
  showFatal(error);
}
