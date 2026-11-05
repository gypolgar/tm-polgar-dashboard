/** Eszköztár-ikon: az aktuális oldal mentése a kiválasztott csoportba. */

import {
  PALETTE,
  findGroup,
  hostOf,
  isWebUrl,
  loadData,
  makeGroup,
  makeItem,
  mutate,
  normalizeUrl,
} from './lib/store.js';

import { createFavicon } from './lib/favicon.js';

const els = {
  pageFavicon: document.getElementById('pageFavicon'),
  pageTitle: document.getElementById('pageTitle'),
  pageHost: document.getElementById('pageHost'),
  savedHint: document.getElementById('savedHint'),
  groupSelect: document.getElementById('groupSelect'),
  btnQuickGroup: document.getElementById('btnQuickGroup'),
  newGroupRow: document.getElementById('newGroupRow'),
  newGroupName: document.getElementById('newGroupName'),
  btnCreateGroup: document.getElementById('btnCreateGroup'),
  titleInput: document.getElementById('titleInput'),
  error: document.getElementById('error'),
  btnSave: document.getElementById('btnSave'),
  btnOpen: document.getElementById('btnOpen'),
};

const state = {
  data: null,
  tab: null,
};

init().catch((error) => {
  console.error(error);
  showError('Hiba történt a felugró ablak betöltésekor.');
});

async function init() {
  state.data = await loadData();
  document.documentElement.dataset.theme = state.data.settings.theme;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    state.tab = tabs && tabs[0] ? tabs[0] : null;
  } catch (error) {
    state.tab = null;
  }

  renderPage();
  renderGroups();
  bindEvents();
}

function renderPage() {
  const tab = state.tab;
  const url = tab && tab.url ? tab.url : '';
  const canSave = isWebUrl(url);

  els.pageTitle.textContent =
    (tab && tab.title) || (canSave ? hostOf(url) : 'Ismeretlen oldal');
  els.pageHost.textContent = canSave ? hostOf(url) : url || '';

  els.pageFavicon.replaceChildren();
  if (url) els.pageFavicon.append(createFavicon(url, (tab && tab.title) || ''));

  els.titleInput.value = (tab && tab.title) || '';
  els.titleInput.disabled = !canSave;
  els.btnSave.disabled = !canSave;

  if (!canSave) {
    showError(
      'Ez az oldal nem menthető (pl. belső chrome:// lap). Nyiss meg egy weboldalt, ' +
      'vagy használd a kezdőlap „Oldal” gombját.',
    );
  }
}

function findSavedGroup() {
  const url = state.tab && state.tab.url ? state.tab.url : '';
  if (!url) return null;
  return (
    state.data.groups.find((group) =>
      group.items.some((item) => item.url === url),
    ) || null
  );
}

function renderGroups(preferredId) {
  els.groupSelect.replaceChildren();

  for (const group of state.data.groups) {
    els.groupSelect.append(new Option(group.name, group.id));
  }

  const saved = findSavedGroup();
  const selected = preferredId || (saved ? saved.id : state.data.groups[0] ? state.data.groups[0].id : '');
  if (selected) els.groupSelect.value = selected;

  renderSavedHint(Boolean(preferredId));
}

function renderSavedHint(keepSelection) {
  const saved = findSavedGroup();

  if (!saved) {
    els.savedHint.classList.add('hidden');
    return;
  }

  els.savedHint.textContent = `Már mentve: ${saved.name}`;
  els.savedHint.classList.remove('hidden');
  if (!keepSelection) els.groupSelect.value = saved.id;
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = !message;
}

async function saveCurrentPage() {
  if (els.btnSave.disabled) return;

  const url = normalizeUrl(state.tab && state.tab.url ? state.tab.url : '');
  if (!url) {
    showError('Érvénytelen hivatkozás, ez az oldal nem menthető.');
    return;
  }

  const title =
    els.titleInput.value.trim() ||
    (state.tab && state.tab.title) ||
    hostOf(url);
  const groupId = els.groupSelect.value;

  let created = false;

  try {
    state.data = await mutate((data) => {
      const group = findGroup(data, groupId);
      if (!group) return;

      const existing = group.items.find((item) => item.url === url);
      if (existing) {
        existing.title = title;
        return;
      }

      const item = makeItem({ url, title });
      if (item) {
        group.items.unshift(item);
        created = true;
      }
    });
  } catch (error) {
    console.error(error);
    showError('A mentés nem sikerült. Próbáld újra.');
    return;
  }

  els.btnSave.textContent = created ? 'Mentve ✓' : 'Cím frissítve ✓';
  els.btnSave.disabled = true;
  window.setTimeout(() => window.close(), 500);
}

async function createGroup() {
  const name = els.newGroupName.value.trim();
  if (!name) {
    els.newGroupName.focus();
    return;
  }

  let newId = '';

  try {
    state.data = await mutate((data) => {
      const group = makeGroup({
        name,
        color: PALETTE[data.groups.length % PALETTE.length],
      });
      data.groups.push(group);
      newId = group.id;
    });
  } catch (error) {
    console.error(error);
    showError('A csoport létrehozása nem sikerült.');
    return;
  }

  els.newGroupName.value = '';
  els.newGroupRow.classList.add('hidden');
  renderGroups(newId);
  showError('');
}

function bindEvents() {
  els.btnSave.addEventListener('click', saveCurrentPage);

  els.btnOpen.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })
      .then(() => window.close())
      .catch(() => window.close());
  });

  els.btnQuickGroup.addEventListener('click', () => {
    els.newGroupRow.classList.toggle('hidden');
    if (!els.newGroupRow.classList.contains('hidden')) els.newGroupName.focus();
  });

  els.btnCreateGroup.addEventListener('click', createGroup);

  els.newGroupName.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    createGroup();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!target || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') return;
    if (target === els.newGroupName) return;
    event.preventDefault();
    saveCurrentPage();
  });
}
