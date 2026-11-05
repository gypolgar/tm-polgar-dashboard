/**
 * Háttérszolgáltatás:
 *  - jobb gombos menü a gyűjteménybe mentéshez,
 *  - kezdőlap megnyitása Chrome indításakor (beállítás alapján),
 *  - első telepítéskor a kezdőlap megnyitása.
 */

import {
  addPage,
  blankData,
  findGroup,
  loadData,
  makeGroup,
  normalizeUrl,
  saveData,
} from './lib/store.js';

const MENU_ADD = 'tm-polgar-add';
const MENU_ROOT = 'tm-polgar-root';
const MENU_SEPARATOR = 'tm-polgar-separator';
const MENU_PREFIX = 'tm-polgar-save:';
const CONTEXTS = ['page', 'link', 'selection'];

let menuRebuildTimer = null;
let menuRebuildChain = Promise.resolve();

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureSeed();
  await queueMenuRebuild();

  if (details.reason === 'install') {
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') });
    } catch (error) {
      console.warn('A kezdőlap megnyitása nem sikerült:', error);
    }
  }
});

chrome.runtime.onStartup.addListener(() => {
  maybeOpenDashboard().catch((error) => {
    console.warn('Indítási kezdőlap hiba:', error);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuId = String(info.menuItemId || '');

  if (menuId === MENU_ADD) {
    openAddDialog(info, tab).catch((error) => {
      console.warn('Az oldal hozzáadása nem sikerült:', error);
    });
    return;
  }

  if (!menuId.startsWith(MENU_PREFIX)) return;

  const groupId = menuId.slice(MENU_PREFIX.length);
  const isLink = Boolean(info.linkUrl);
  const url = isLink ? info.linkUrl : info.pageUrl || (tab && tab.url);
  const title = isLink ? info.selectionText || '' : (tab && tab.title) || '';

  saveLink(groupId, url, title).catch((error) => {
    console.warn('Mentés jobb gombos menüből nem sikerült:', error);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.collection) return;
  clearTimeout(menuRebuildTimer);
  menuRebuildTimer = setTimeout(() => {
    queueMenuRebuild();
  }, 250);
});

async function ensureSeed() {
  const stored = await chrome.storage.local.get('collection');
  if (!stored || !stored.collection) {
    await saveData(blankData());
  }
}

async function rebuildMenus() {
  const data = await loadData();

  await chrome.contextMenus.removeAll();

  // Csak egy legfelső szintű menü lehet, különben a Chrome az összes
  // menüpontot egy közös alcím alá vonja össze.
  chrome.contextMenus.create({
    id: MENU_ROOT,
    title: 'Mentés a gyűjteménybe',
    contexts: CONTEXTS,
  });

  chrome.contextMenus.create({
    id: MENU_ADD,
    parentId: MENU_ROOT,
    title: 'Oldal hozzáadása a gyűjteményhez…',
    contexts: CONTEXTS,
  });

  chrome.contextMenus.create({
    id: MENU_SEPARATOR,
    parentId: MENU_ROOT,
    type: 'separator',
    contexts: CONTEXTS,
  });

  const groups = data.groups.slice(0, 25);
  for (const group of groups) {
    chrome.contextMenus.create({
      id: `${MENU_PREFIX}${group.id}`,
      parentId: MENU_ROOT,
      title: group.name,
      contexts: CONTEXTS,
    });
  }

  if (!groups.length) {
    chrome.contextMenus.create({
      id: `${MENU_PREFIX}default`,
      parentId: MENU_ROOT,
      title: 'Kedvencek',
      contexts: CONTEXTS,
    });
  }
}

/** A menük újraépítését sorba állítja, hogy ne fussanak egymással párhuzamosan. */
function queueMenuRebuild() {
  menuRebuildChain = menuRebuildChain
    .then(() => rebuildMenus())
    .catch((error) => {
      console.warn('A jobb gombos menük frissítése nem sikerült:', error);
    });
  return menuRebuildChain;
}

async function saveLink(groupId, url, title) {
  let created = false;

  await mutateCollection((data) => {
    let targetId = groupId;
    if (groupId === 'default' || !findGroup(data, groupId)) {
      if (!data.groups.length) {
        const group = makeGroup({ name: 'Kedvencek' });
        data.groups.push(group);
      }
      targetId = data.groups[0].id;
    }

    const result = addPage(data, targetId, url, title);
    created = Boolean(result && result.created);
  });

  flashBadge(created);
}

/**
 * Jobb gombos menüből a kezdőlap „Oldal hozzáadása” párbeszédét nyitja meg,
 * előre kitöltve az oldal vagy a hivatkozás adataival.
 */
async function openAddDialog(info, tab) {
  const isLink = Boolean(info.linkUrl);
  const url = normalizeUrl(
    isLink ? info.linkUrl : info.pageUrl || (tab && tab.url) || '',
  );
  if (!url) return;

  const title = isLink
    ? info.selectionText || ''
    : (tab && tab.title) || '';

  const target = new URL(chrome.runtime.getURL('newtab.html'));
  target.searchParams.set('add', '1');
  target.searchParams.set('url', url);
  if (title) target.searchParams.set('title', title);

  await chrome.tabs.create({ url: target.href });
}

async function mutateCollection(callback) {
  const data = await loadData();
  callback(data);
  await saveData(data);
}

function flashBadge(created) {
  chrome.action.setBadgeBackgroundColor({ color: created ? '#22c55e' : '#94a3b8' });
  chrome.action.setBadgeText({ text: '✓' });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
  }, 1600);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function maybeOpenDashboard() {
  const data = await loadData();
  if (!data.settings.openOnStartup) return;

  // Hagyjuk, hogy a Chrome befejezze a munkamenet visszaállítását,
  // és ne nyissunk második kezdőlapot, ha már van ilyen.
  await delay(1800);

  const url = chrome.runtime.getURL('newtab.html');
  const existing = await chrome.tabs.query({ url: `${url}*` });
  if (existing.length) return;

  await chrome.tabs.create({ url });
}

/*
 * A háttérszolgáltatás minden elindulásakor gondoskodunk az adatokról és a
 * jobb gombos menükről. Ez akkor is szükséges, ha a Chrome a szolgáltatást
 * leállította, vagy a kiegészítő újratöltése után nem fut le az onInstalled.
 */
ensureSeed()
  .then(() => queueMenuRebuild())
  .catch((error) => {
    console.warn('A háttér inicializálása nem sikerült:', error);
  });
