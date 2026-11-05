/**
 * Kezdőlap: csoportosított linkgyűjtemény, kereséssel, áthúzással,
 * valamint megnyitott lapok exportjával és importjával.
 */

import {
  PALETTE,
  countItems,
  findGroup,
  hostOf,
  isWebUrl,
  loadData,
  makeGroup,
  makeItem,
  mutate,
  normalizeUrl,
  onDataChange,
} from './lib/store.js';

import { createFavicon } from './lib/favicon.js';

import {
  BACKUP_APP,
  buildBookmarkHtml,
  dateStamp,
  download,
  materializeGroups,
  parseImportFile,
  serializeBackup,
} from './lib/backup.js';

/* ------------------------------------------------------------------ */
/* Segédek                                                             */
/* ------------------------------------------------------------------ */

const ICON_PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m14 6 4 4"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
};

function icon(name, className) {
  const cls = className || 'icon';
  const body = ICON_PATHS[name] || '';
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/** Kis DOM-építő. */
function h(tag, props, ...children) {
  const node = document.createElement(tag);
  const attributes = props || {};

  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') {
      for (const styleKey of Object.keys(value)) {
        if (styleKey.startsWith('--')) node.style.setProperty(styleKey, value[styleKey]);
        else node.style[styleKey] = value[styleKey];
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }

  for (const child of children.flat(3)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }

  return node;
}

function iconButton(name, label, onClick, extraClass) {
  return h('button', {
    class: 'icon-btn' + (extraClass ? ` ${extraClass}` : ''),
    type: 'button',
    title: label,
    'aria-label': label,
    html: icon(name),
    onclick: onClick,
  });
}

function openUrl(url) {
  try {
    const promise = chrome.tabs.create({ url });
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  } catch (error) {
    window.location.href = url;
  }
}

/* ------------------------------------------------------------------ */
/* Állapot                                                             */
/* ------------------------------------------------------------------ */

const state = {
  data: null,
  view: 'all',
  query: '',
  dialogGroupId: null,
  itemDialog: null,
  pendingImport: null,
  drag: null,
  hint: null,
  openTabs: [],
};

let toastTimer = null;
let searchRenderTimer = null;

const els = {
  groups: document.getElementById('groups'),
  content: document.getElementById('content'),
  title: document.getElementById('viewTitle'),
  subtitle: document.getElementById('viewSubtitle'),
  viewDot: document.getElementById('viewDot'),
  viewActions: document.getElementById('viewActions'),
  search: document.getElementById('search'),
  btnAddItem: document.getElementById('btnAddItem'),
  btnNewGroup: document.getElementById('btnNewGroup'),
  btnData: document.getElementById('btnData'),
  btnSettings: document.getElementById('btnSettings'),

  dlgGroup: document.getElementById('dlgGroup'),
  groupForm: document.getElementById('groupForm'),
  dlgGroupTitle: document.getElementById('dlgGroupTitle'),
  groupName: document.getElementById('groupName'),
  groupColors: document.getElementById('groupColors'),
  groupError: document.getElementById('groupError'),

  dlgItem: document.getElementById('dlgItem'),
  itemForm: document.getElementById('itemForm'),
  dlgItemTitle: document.getElementById('dlgItemTitle'),
  itemTitle: document.getElementById('itemTitle'),
  itemUrl: document.getElementById('itemUrl'),
  itemGroup: document.getElementById('itemGroup'),
  itemError: document.getElementById('itemError'),

  dlgSettings: document.getElementById('dlgSettings'),
  settingsForm: document.getElementById('settingsForm'),
  setStartup: document.getElementById('setStartup'),
  setConfirm: document.getElementById('setConfirm'),
  setTheme: document.getElementById('setTheme'),

  dlgData: document.getElementById('dlgData'),
  tabsScope: document.getElementById('tabsScope'),
  tabsSelectAll: document.getElementById('tabsSelectAll'),
  tabsCount: document.getElementById('tabsCount'),
  tabsList: document.getElementById('tabsList'),
  saveTarget: document.getElementById('saveTarget'),
  btnSaveTabs: document.getElementById('btnSaveTabs'),
  btnExportTabsJson: document.getElementById('btnExportTabsJson'),
  btnExportTabsHtml: document.getElementById('btnExportTabsHtml'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  btnPickFile: document.getElementById('btnPickFile'),
  importError: document.getElementById('importError'),
  importPreview: document.getElementById('importPreview'),
  importFileName: document.getElementById('importFileName'),
  importSummary: document.getElementById('importSummary'),
  btnCancelImport: document.getElementById('btnCancelImport'),
  btnDoImport: document.getElementById('btnDoImport'),
  btnBackup: document.getElementById('btnBackup'),
  btnExportCollectionHtml: document.getElementById('btnExportCollectionHtml'),
  btnGoImport: document.getElementById('btnGoImport'),

  dlgConfirm: document.getElementById('dlgConfirm'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmText: document.getElementById('confirmText'),
  confirmOk: document.getElementById('confirmOk'),
  confirmCancel: document.getElementById('confirmCancel'),

  toast: document.getElementById('toast'),
};

/* ------------------------------------------------------------------ */
/* Indítás                                                             */
/* ------------------------------------------------------------------ */

init().catch((error) => {
  console.error(error);
  els.content.replaceChildren(
    h('div', { class: 'hero' },
      h('h2', {}, 'Hiba történt a kezdőlap betöltésekor'),
      h('p', {}, 'Nyisd meg újra a lapot, vagy töltsd újra a kiegészítőt a chrome://extensions oldalon.'),
    ),
  );
});

async function init() {
  state.data = await loadData();
  applyTheme();
  bindEvents();
  renderAll();

  onDataChange((next) => {
    state.data = next;
    if (state.view !== 'all' && !findGroup(next, state.view)) state.view = 'all';
    renderAll();
  });

  handleAddRequest();
}

/**
 * Jobb gombos menüből érkező kérés: az „Oldal hozzáadása” párbeszéd
 * megnyitása előre kitöltött címmel és hivatkozással.
 */
function handleAddRequest() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('add')) return;

  const title = (params.get('title') || '').trim().slice(0, 300);
  const url = normalizeUrl(params.get('url') || '');

  // A paraméterek eltávolítása, hogy újratöltéskor ne nyíljon meg újra.
  window.history.replaceState(null, '', window.location.pathname);

  const group = state.data.groups[0];
  if (!url || !group) return;

  openItemDialog(group.id, null);
  els.itemUrl.value = url;
  if (title) els.itemTitle.value = title;
}

function applyTheme() {
  const theme = state.data && state.data.settings ? state.data.settings.theme : 'system';
  document.documentElement.dataset.theme = theme;
}

/* ------------------------------------------------------------------ */
/* Renderelés                                                          */
/* ------------------------------------------------------------------ */

function renderAll() {
  const scrollTop = els.content.scrollTop;
  applyTheme();
  renderSidebar();
  renderTopbar();
  renderContent();
  els.content.scrollTop = scrollTop;
}

function renderSidebar() {
  const fragment = document.createDocumentFragment();

  fragment.append(
    navRow({
      id: 'all',
      name: 'Összes oldal',
      count: countItems(state.data),
      isAll: true,
    }),
  );

  for (const group of state.data.groups) {
    fragment.append(
      navRow({
        id: group.id,
        name: group.name,
        color: group.color,
        count: group.items.length,
      }),
    );
  }

  els.groups.replaceChildren(fragment);
}

function navRow(options) {
  const active = state.view === options.id;
  const dot = options.isAll
    ? h('span', { class: 'nav-dot all', html: icon('layers') })
    : h('span', { class: 'nav-dot', style: { background: options.color } });

  return h(
    'div',
    {
      class: 'nav-row',
      role: 'button',
      tabindex: '0',
      draggable: options.isAll ? null : 'true',
      dataset: { groupId: options.id },
      'aria-current': active ? 'true' : 'false',
      'aria-label': options.isAll
        ? 'Összes oldal'
        : `${options.name}, ${options.count} oldal`,
    },
    dot,
    h('span', { class: 'nav-name', text: options.name }),
    h('span', { class: 'nav-count', text: String(options.count) }),
  );
}

function renderTopbar() {
  const group = state.view === 'all' ? null : findGroup(state.data, state.view);
  const total = countItems(state.data);

  if (state.query) {
    els.title.textContent = 'Keresés';
    els.viewDot.classList.add('hidden');
    els.subtitle.textContent = `„${state.query}” – ${countMatches(state.query)} találat`;
  } else if (group) {
    els.title.textContent = group.name;
    els.viewDot.style.background = group.color;
    els.viewDot.classList.remove('hidden');
    els.subtitle.textContent = `${group.items.length} mentett oldal`;
  } else {
    els.title.textContent = 'Összes oldal';
    els.viewDot.classList.add('hidden');
    els.subtitle.textContent = `${total} mentett oldal · ${state.data.groups.length} csoport`;
  }

  els.viewActions.replaceChildren();
  if (group && !state.query) {
    els.viewActions.append(
      iconButton('open', 'A csoport összes oldalának megnyitása', () => openGroup(group.id)),
      iconButton('edit', 'Csoport szerkesztése', () => openGroupDialog(group.id)),
      iconButton('trash', 'Csoport törlése', () => removeGroup(group.id), 'danger'),
    );
  }
}

function countMatches(query) {
  const needle = query.toLowerCase();
  let total = 0;
  for (const group of state.data.groups) {
    total += group.items.filter((item) => matchesQuery(item, group, needle)).length;
  }
  return total;
}

function matchesQuery(item, group, needle) {
  return (
    item.title.toLowerCase().includes(needle) ||
    item.url.toLowerCase().includes(needle) ||
    group.name.toLowerCase().includes(needle)
  );
}

function renderContent() {
  els.content.replaceChildren();
  els.content.classList.remove('centered');

  const hasQuery = Boolean(state.query);
  const needle = state.query.toLowerCase();

  if (!hasQuery && countItems(state.data) === 0) {
    els.content.classList.add('centered');
    els.content.append(buildEmptyState());
    return;
  }

  let sections;
  if (hasQuery) {
    sections = state.data.groups
      .map((group) => ({
        group,
        items: group.items.filter((item) => matchesQuery(item, group, needle)),
      }))
      .filter((section) => section.items.length > 0);
  } else if (state.view === 'all') {
    sections = state.data.groups.map((group) => ({ group, items: group.items }));
  } else {
    const group = findGroup(state.data, state.view);
    sections = group ? [{ group, items: group.items }] : [];
  }

  if (!sections.length) {
    els.content.classList.add('centered');
    els.content.append(buildNoResults());
    return;
  }

  for (const section of sections) {
    const showHeader = hasQuery || state.view === 'all';
    els.content.append(groupSection(section.group, section.items, showHeader));
  }
}

function buildEmptyState() {
  return h(
    'div',
    { class: 'hero' },
    h('img', { src: 'icons/icon128.png', alt: '' }),
    h('h2', {}, 'Kezdd el a gyűjteményed építeni'),
    h('p', {},
      'Mentsd el a fontos oldalakat csoportokba rendezve: a jobb felső „Oldal” gombbal, ' +
      'a jobb gombos menüből, vagy a böngésző eszköztárán lévő ikonnal.'),
    h('div', { class: 'hero-actions' },
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => openItemDialog(state.data.groups[0].id, null),
      }, 'Oldal hozzáadása'),
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => openDataDialog('tabs'),
      }, 'Megnyitott lapok mentése'),
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => openDataDialog('import'),
      }, 'Importálás'),
    ),
  );
}

function buildNoResults() {
  return h(
    'div',
    { class: 'hero' },
    h('h2', {}, 'Nincs találat'),
    h('p', {}, `A(z) „${state.query}” keresésre nincs mentett oldal.`),
    h('div', { class: 'hero-actions' },
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          els.search.value = '';
          state.query = '';
          renderTopbar();
          renderContent();
          els.search.focus();
        },
      }, 'Keresés törlése'),
    ),
  );
}

function groupSection(group, items, showHeader) {
  const section = h('section', {
    class: 'group-section',
    dataset: { groupId: group.id },
  });

  if (showHeader) {
    section.append(
      h('div', { class: 'section-head' },
        h('span', { class: 'dot', style: { background: group.color } }),
        h('h2', { text: group.name }),
        h('span', { class: 'badge', text: String(items.length) }),
        h('div', { class: 'section-actions' },
          iconButton('open', 'Csoport megnyitása', () => openGroup(group.id)),
          iconButton('edit', 'Csoport szerkesztése', () => openGroupDialog(group.id)),
          iconButton('trash', 'Csoport törlése', () => removeGroup(group.id), 'danger'),
        ),
      ),
    );
  }

  if (!items.length) {
    section.append(h('p', { class: 'empty-note' }, 'Ebben a csoportban még nincsenek oldalak.'));
  }

  const grid = h('div', { class: 'grid' });
  for (const item of items) grid.append(itemCard(group, item));
  grid.append(
    h('button', {
      class: 'add-tile',
      type: 'button',
      html: `${icon('plus', 'icon icon-sm')}<span>Oldal</span>`,
      onclick: () => openItemDialog(group.id, null),
    }),
  );

  section.append(grid);
  return section;
}

function itemCard(group, item) {
  const card = h(
    'div',
    {
      class: 'card',
      role: 'link',
      tabindex: '0',
      draggable: 'true',
      dataset: { groupId: group.id, itemId: item.id },
      'aria-label': `${item.title} (${hostOf(item.url)})`,
    },
    createFavicon(item.url, item.title),
    h('div', { class: 'card-main' },
      h('span', { class: 'card-title', text: item.title || hostOf(item.url) }),
      h('span', { class: 'card-host', text: hostOf(item.url) }),
    ),
    h('div', { class: 'card-actions' },
      iconButton('edit', 'Oldal szerkesztése', (event) => {
        event.stopPropagation();
        openItemDialog(group.id, item.id);
      }),
      iconButton('trash', 'Oldal törlése', (event) => {
        event.stopPropagation();
        deleteItem(group.id, item.id);
      }, 'danger'),
    ),
  );

  card.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    openUrl(item.url);
  });

  card.addEventListener('keydown', (event) => {
    if (event.target !== card) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openUrl(item.url);
  });

  return card;
}

/* ------------------------------------------------------------------ */
/* Műveletek                                                           */
/* ------------------------------------------------------------------ */

function setView(groupId) {
  state.view = groupId;
  state.query = '';
  els.search.value = '';
  renderAll();
}

function openGroup(groupId) {
  const group = findGroup(state.data, groupId);
  if (!group || !group.items.length) {
    toast('Ebben a csoportban nincsenek megnyitható oldalak.');
    return;
  }

  for (const item of group.items) {
    try {
      chrome.tabs.create({ url: item.url, active: false });
    } catch (error) {
      /* kihagyjuk */
    }
  }
  toast(`${group.items.length} oldal megnyitása folyamatban.`);
}

/* ------------------------------------------------------------------ */
/* Csoport párbeszéd                                                   */
/* ------------------------------------------------------------------ */

function openGroupDialog(groupId) {
  state.dialogGroupId = groupId || null;
  const group = groupId ? findGroup(state.data, groupId) : null;

  els.dlgGroupTitle.textContent = group ? 'Csoport szerkesztése' : 'Új csoport';
  els.groupName.value = group ? group.name : '';
  els.groupError.hidden = true;

  const defaultColor = group
    ? group.color
    : PALETTE[state.data.groups.length % PALETTE.length];
  renderSwatches(defaultColor);

  els.dlgGroup.showModal();
  els.groupName.focus();
  els.groupName.select();
}

function renderSwatches(selectedColor) {
  els.groupColors.replaceChildren();
  for (const color of PALETTE) {
    const button = h('button', {
      class: 'swatch' + (color === selectedColor ? ' selected' : ''),
      type: 'button',
      style: { '--swatch': color },
      'data-color': color,
      'aria-label': `Szín: ${color}`,
      'aria-pressed': color === selectedColor ? 'true' : 'false',
    });
    els.groupColors.append(button);
  }
  els.groupColors.dataset.selected = selectedColor;
}

els.groupColors.addEventListener('click', (event) => {
  const button = event.target.closest('.swatch');
  if (!button) return;
  const color = button.dataset.color;
  els.groupColors.dataset.selected = color;
  for (const swatch of els.groupColors.querySelectorAll('.swatch')) {
    const active = swatch === button;
    swatch.classList.toggle('selected', active);
    swatch.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
});

els.groupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = els.groupName.value.trim();
  if (!name) {
    els.groupError.textContent = 'Adj nevet a csoportnak.';
    els.groupError.hidden = false;
    els.groupName.focus();
    return;
  }

  const color = els.groupColors.dataset.selected || PALETTE[0];
  const editingId = state.dialogGroupId;
  let createdId = null;

  state.data = await mutate((data) => {
    if (editingId) {
      const group = findGroup(data, editingId);
      if (group) {
        group.name = name;
        group.color = color;
      }
      return;
    }

    const group = makeGroup({ name, color });
    data.groups.push(group);
    createdId = group.id;
  });

  if (!editingId && createdId) {
    state.view = createdId;
    state.query = '';
    els.search.value = '';
  }

  els.dlgGroup.close();
  renderAll();
  toast(editingId ? 'Csoport frissítve.' : 'Csoport létrehozva.');
});

async function removeGroup(groupId) {
  const group = findGroup(state.data, groupId);
  if (!group) return;

  const ok = await confirmDialog({
    title: 'Csoport törlése',
    text:
      `Biztosan törlöd a(z) „${group.name}” csoportot? ` +
      `A benne lévő ${group.items.length} oldal is törlődik.`,
    okLabel: 'Törlés',
  });
  if (!ok) return;

  const index = state.data.groups.findIndex((entry) => entry.id === groupId);
  const snapshot = structuredClone(group);

  state.data = await mutate((data) => {
    data.groups = data.groups.filter((entry) => entry.id !== groupId);
  });

  if (state.view === groupId) {
    state.view = 'all';
    renderAll();
  }

  toast('Csoport törölve.', {
    actionLabel: 'Visszavonás',
    onAction: async () => {
      state.data = await mutate((data) => {
        data.groups.splice(Math.min(index, data.groups.length), 0, snapshot);
      });
      renderAll();
      toast('Csoport visszaállítva.');
    },
  });
}

/* ------------------------------------------------------------------ */
/* Oldal párbeszéd                                                     */
/* ------------------------------------------------------------------ */

function openItemDialog(groupId, itemId) {
  const group = findGroup(state.data, groupId) || state.data.groups[0];
  if (!group) return;

  const item = itemId ? group.items.find((entry) => entry.id === itemId) : null;
  state.itemDialog = { groupId: group.id, itemId: itemId || null };

  els.dlgItemTitle.textContent = item ? 'Oldal szerkesztése' : 'Oldal hozzáadása';
  els.itemTitle.value = item ? item.title : '';
  els.itemUrl.value = item ? item.url : '';
  els.itemError.hidden = true;

  els.itemGroup.replaceChildren();
  for (const entry of state.data.groups) {
    els.itemGroup.append(h('option', { value: entry.id }, entry.name));
  }
  els.itemGroup.value = group.id;

  els.dlgItem.showModal();
  window.setTimeout(() => {
    const field = item ? els.itemTitle : els.itemUrl;
    field.focus();
    field.select();
  }, 40);
}

els.itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = normalizeUrl(els.itemUrl.value);
  if (!url) {
    els.itemError.textContent = 'Adj meg egy érvényes http(s) hivatkozást (pl. https://pelda.hu).';
    els.itemError.hidden = false;
    els.itemUrl.focus();
    return;
  }

  const title = els.itemTitle.value.trim() || hostOf(url);
  const targetGroupId = els.itemGroup.value;
  const context = state.itemDialog;
  if (!context) return;

  let duplicate = false;

  state.data = await mutate((data) => {
    const target = findGroup(data, targetGroupId);
    if (!target) return;

    if (context.itemId) {
      const source = findGroup(data, context.groupId);
      const existing = target.items.find(
        (entry) => entry.url === url && entry.id !== context.itemId,
      );
      if (existing) {
        duplicate = true;
        return;
      }

      if (source && source.id === target.id) {
        const item = target.items.find((entry) => entry.id === context.itemId);
        if (item) {
          item.url = url;
          item.title = title;
        }
      } else {
        if (source) {
          source.items = source.items.filter((entry) => entry.id !== context.itemId);
        }
        const item = makeItem({ url, title });
        if (item) target.items.unshift(item);
      }
      return;
    }

    if (target.items.some((entry) => entry.url === url)) {
      duplicate = true;
      return;
    }

    const item = makeItem({ url, title });
    if (item) target.items.unshift(item);
  });

  els.dlgItem.close();
  renderAll();

  if (duplicate) {
    toast('Ez az oldal már szerepel a kiválasztott csoportban.');
  } else {
    toast(context.itemId ? 'Oldal frissítve.' : 'Oldal mentve.');
  }
});

async function deleteItem(groupId, itemId) {
  const group = findGroup(state.data, groupId);
  const item = group ? group.items.find((entry) => entry.id === itemId) : null;
  if (!group || !item) return;

  if (state.data.settings.confirmDelete) {
    const ok = await confirmDialog({
      title: 'Oldal törlése',
      text: `Törlöd a(z) „${item.title}” oldalt?`,
      okLabel: 'Törlés',
    });
    if (!ok) return;
  }

  const index = group.items.findIndex((entry) => entry.id === itemId);
  const snapshot = structuredClone(item);

  state.data = await mutate((data) => {
    const target = findGroup(data, groupId);
    if (target) target.items = target.items.filter((entry) => entry.id !== itemId);
  });

  toast('Oldal törölve.', {
    actionLabel: 'Visszavonás',
    onAction: async () => {
      state.data = await mutate((data) => {
        const target = findGroup(data, groupId);
        if (target) target.items.splice(Math.min(index, target.items.length), 0, snapshot);
      });
      renderAll();
      toast('Oldal visszaállítva.');
    },
  });
}

/* ------------------------------------------------------------------ */
/* Beállítások                                                         */
/* ------------------------------------------------------------------ */

function openSettings() {
  const settings = state.data.settings;
  els.setStartup.checked = settings.openOnStartup;
  els.setConfirm.checked = settings.confirmDelete;
  els.setTheme.value = settings.theme;
  els.dlgSettings.showModal();
}

els.btnSettings.addEventListener('click', openSettings);

els.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  state.data = await mutate((data) => {
    data.settings.openOnStartup = els.setStartup.checked;
    data.settings.confirmDelete = els.setConfirm.checked;
    data.settings.theme = els.setTheme.value;
  });

  applyTheme();
  els.dlgSettings.close();
  toast('Beállítások mentve.');
});

/* ------------------------------------------------------------------ */
/* Adatkezelés                                                         */
/* ------------------------------------------------------------------ */

function openDataDialog(tabName) {
  showTab(tabName || 'tabs');
  rebuildSaveTargets();
  resetImport();
  els.dlgData.showModal();
  refreshOpenTabs().catch((error) => {
    console.warn(error);
    els.tabsList.replaceChildren(
      h('p', { class: 'hint pad' }, 'A megnyitott lapokat most nem sikerült beolvasni.'),
    );
  });
}

els.btnData.addEventListener('click', () => openDataDialog('tabs'));

function showTab(name) {
  for (const tab of els.dlgData.querySelectorAll('.tab')) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const panel of els.dlgData.querySelectorAll('.tab-panel')) {
    panel.classList.toggle('hidden', panel.dataset.panel !== name);
  }
}

for (const tab of els.dlgData.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
}

function rebuildSaveTargets() {
  els.saveTarget.replaceChildren();
  els.saveTarget.append(h('option', { value: 'new' }, `＋ Új csoport (${dateStamp()})`));
  for (const group of state.data.groups) {
    els.saveTarget.append(h('option', { value: group.id }, group.name));
  }
  els.saveTarget.value = 'new';
}

async function refreshOpenTabs() {
  const scope = els.tabsScope.value;
  const query = scope === 'all' ? {} : { currentWindow: true };
  const tabs = await chrome.tabs.query(query);

  state.openTabs = tabs.filter(
    (tab) => tab.url && isWebUrl(tab.url) && tab.url.indexOf('chrome-extension://') !== 0,
  );

  const list = els.tabsList;
  list.replaceChildren();

  if (!state.openTabs.length) {
    list.append(h('p', { class: 'hint pad' }, 'Nincs exportálható megnyitott lap ebben a hatókörben.'));
    els.tabsCount.textContent = '0 lap';
    els.tabsSelectAll.checked = false;
    return;
  }

  state.openTabs.forEach((tab, index) => {
    list.append(
      h('label', { class: 'tab-row' },
        h('input', { type: 'checkbox', checked: true, value: String(index) }),
        createFavicon(tab.url, tab.title || ''),
        h('span', { class: 'tab-title', text: tab.title || hostOf(tab.url) }),
        h('span', { class: 'tab-host', text: hostOf(tab.url) }),
      ),
    );
  });

  els.tabsSelectAll.checked = true;
  updateTabsCount();
}

function updateTabsCount() {
  const selected = selectedTabs().length;
  els.tabsCount.textContent = `${selected} / ${state.openTabs.length} lap kijelölve`;
}

function selectedTabs() {
  const checked = els.tabsList.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checked)
    .map((checkbox) => state.openTabs[Number(checkbox.value)])
    .filter(Boolean);
}

els.tabsScope.addEventListener('change', () => {
  refreshOpenTabs().catch(() => {});
});

els.tabsSelectAll.addEventListener('change', () => {
  for (const checkbox of els.tabsList.querySelectorAll('input[type="checkbox"]')) {
    checkbox.checked = els.tabsSelectAll.checked;
  }
  updateTabsCount();
});

els.tabsList.addEventListener('change', updateTabsCount);

els.btnSaveTabs.addEventListener('click', async () => {
  const tabs = selectedTabs();
  if (!tabs.length) {
    toast('Nincs kijelölt lap.');
    return;
  }

  const targetValue = els.saveTarget.value;
  let targetName = '';

  state.data = await mutate((data) => {
    let group;

    if (targetValue === 'new') {
      group = makeGroup({
        name: `Megnyitott lapok – ${dateStamp()}`,
        color: PALETTE[data.groups.length % PALETTE.length],
      });
      data.groups.unshift(group);
    } else {
      group = findGroup(data, targetValue);
    }

    if (!group) return;
    targetName = group.name;

    for (const tab of tabs) {
      if (group.items.some((item) => item.url === tab.url)) continue;
      const item = makeItem({ url: tab.url, title: tab.title });
      if (item) group.items.push(item);
    }

    state.view = group.id;
    state.query = '';
    els.search.value = '';
  });

  els.dlgData.close();
  renderAll();
  toast(`${tabs.length} lap mentve ide: ${targetName || 'gyűjtemény'}.`);
});

function exportSelectedTabs(format) {
  const tabs = selectedTabs();
  if (!tabs.length) {
    toast('Nincs kijelölt lap.');
    return;
  }

  const groupName = `Megnyitott lapok – ${dateStamp()}`;
  const items = tabs.map((tab) => ({
    url: tab.url,
    title: tab.title || hostOf(tab.url),
    createdAt: Date.now(),
  }));

  if (format === 'html') {
    download(
      `megnyitott-lapok-${dateStamp()}.html`,
      buildBookmarkHtml([{ name: groupName, items }]),
      'text/html',
    );
  } else {
    const payload = {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: [{ name: groupName, color: PALETTE[0], items }],
    };
    download(
      `megnyitott-lapok-${dateStamp()}.json`,
      JSON.stringify(payload, null, 2),
    );
  }

  toast(`${tabs.length} lap exportálva.`);
}

els.btnExportTabsJson.addEventListener('click', () => exportSelectedTabs('json'));
els.btnExportTabsHtml.addEventListener('click', () => exportSelectedTabs('html'));

els.btnBackup.addEventListener('click', () => {
  download(`tm-polgar-dashboard-mentes-${dateStamp()}.json`, serializeBackup(state.data));
  toast('Gyűjtemény mentve JSON-fájlba.');
});

els.btnExportCollectionHtml.addEventListener('click', () => {
  if (!countItems(state.data)) {
    toast('Nincs exportálható oldal a gyűjteményben.');
    return;
  }

  download(
    `tm-polgar-dashboard-konyvjelzok-${dateStamp()}.html`,
    buildBookmarkHtml(state.data.groups),
    'text/html',
  );
  toast('Gyűjtemény exportálva könyvjelző HTML-ként.');
});

els.btnGoImport.addEventListener('click', () => showTab('import'));

/* ------------------------------------------------------------------ */
/* Importálás                                                          */
/* ------------------------------------------------------------------ */

function resetImport() {
  state.pendingImport = null;
  els.importPreview.classList.add('hidden');
  els.dropZone.classList.remove('hidden', 'dragover');
  els.importError.hidden = true;
  els.fileInput.value = '';

  const merge = els.dlgData.querySelector('input[name="importMode"][value="merge"]');
  if (merge) merge.checked = true;
}

function showImportError(message) {
  els.importError.textContent = message;
  els.importError.hidden = false;
}

async function handleImportFile(file) {
  if (!file) return;

  els.importError.hidden = true;

  if (file.size > 8 * 1024 * 1024) {
    showImportError('A fájl túl nagy (legfeljebb 8 MB lehet).');
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseImportFile(text, file.name);
    const count = parsed.groups.reduce((total, group) => total + group.items.length, 0);

    if (!count) throw new Error('A fájlban nincs importálható hivatkozás.');

    state.pendingImport = {
      fileName: file.name,
      groups: parsed.groups,
      settings: parsed.settings || null,
    };
    els.importFileName.textContent = file.name;
    els.importSummary.textContent =
      `${parsed.groups.length} csoport · ${count} hivatkozás` +
      (parsed.settings ? ' · beállítások is' : '');
    els.dropZone.classList.add('hidden');
    els.importPreview.classList.remove('hidden');
  } catch (error) {
    showImportError(error && error.message ? error.message : 'A fájl feldolgozása nem sikerült.');
  }
}

els.btnPickFile.addEventListener('click', () => els.fileInput.click());

els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files && els.fileInput.files[0];
  handleImportFile(file);
});

for (const eventName of ['dragenter', 'dragover']) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.dropZone.classList.add('dragover');
  });
}

els.dropZone.addEventListener('dragleave', (event) => {
  if (!els.dropZone.contains(event.relatedTarget)) {
    els.dropZone.classList.remove('dragover');
  }
});

els.dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  els.dropZone.classList.remove('dragover');
  const file = event.dataTransfer && event.dataTransfer.files
    ? event.dataTransfer.files[0]
    : null;
  handleImportFile(file);
});

els.dlgData.addEventListener('dragover', (event) => {
  event.preventDefault();
});

els.dlgData.addEventListener('drop', (event) => {
  if (!event.target.closest('#dropZone')) event.preventDefault();
});

els.btnCancelImport.addEventListener('click', resetImport);

els.btnDoImport.addEventListener('click', async () => {
  const pending = state.pendingImport;
  if (!pending) return;

  const modeInput = els.dlgData.querySelector('input[name="importMode"]:checked');
  const mode = modeInput ? modeInput.value : 'merge';
  const imported = materializeGroups(pending.groups);
  const count = imported.reduce((total, group) => total + group.items.length, 0);

  if (!imported.length) {
    showImportError('Nincs importálható csoport a fájlban.');
    return;
  }

  state.data = await mutate((data) => {
    if (mode === 'replace') {
      data.groups = imported;
      if (pending.settings) {
        data.settings = { ...data.settings, ...pending.settings };
      }
    } else {
      data.groups.push(...imported);
    }
  });

  state.view = 'all';
  state.query = '';
  els.search.value = '';
  els.dlgData.close();
  resetImport();
  renderAll();

  const settingsRestored = mode === 'replace' && Boolean(pending.settings);
  toast(
    mode === 'replace'
      ? `${count} hivatkozás importálva – a korábbi gyűjtemény` +
        `${settingsRestored ? ' és a beállítások' : ''} visszaállítva.`
      : `${count} hivatkozás importálva ${imported.length} csoportba.`,
  );
});

/* ------------------------------------------------------------------ */
/* Megerősítő párbeszéd                                                */
/* ------------------------------------------------------------------ */

function confirmDialog(options) {
  const dialog = els.dlgConfirm;
  els.confirmTitle.textContent = options.title || 'Biztos?';
  els.confirmText.textContent = options.text || '';
  els.confirmOk.textContent = options.okLabel || 'Törlés';
  els.confirmOk.classList.toggle('btn-danger', options.danger !== false);
  els.confirmOk.classList.toggle('btn-primary', options.danger === false);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      resolve(value);
    };

    els.confirmOk.onclick = () => finish(true);
    els.confirmCancel.onclick = () => finish(false);
    dialog.onclick = (event) => {
      if (event.target === dialog) finish(false);
    };
    dialog.oncancel = (event) => {
      event.preventDefault();
      finish(false);
    };

    dialog.showModal();
  });
}

/* ------------------------------------------------------------------ */
/* Értesítés                                                           */
/* ------------------------------------------------------------------ */

function toast(message, options) {
  const config = options || {};
  els.toast.replaceChildren(h('span', { class: 'toast-msg', text: message }));

  if (config.actionLabel && typeof config.onAction === 'function') {
    els.toast.append(
      h('button', {
        class: 'toast-action',
        type: 'button',
        text: config.actionLabel,
        onclick: () => {
          els.toast.classList.remove('show');
          config.onAction();
        },
      }),
    );
  }

  els.toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove('show');
  }, config.duration || 4200);
}

/* ------------------------------------------------------------------ */
/* Áthúzás (drag & drop)                                               */
/* ------------------------------------------------------------------ */

function clearHint() {
  if (state.hint) state.hint.classList.remove('drop-hint');
  state.hint = null;
}

function setHint(element) {
  if (state.hint === element) return;
  clearHint();
  state.hint = element;
  if (element) element.classList.add('drop-hint');
}

function endDrag() {
  if (state.drag && state.drag.element) {
    state.drag.element.classList.remove('dragging');
  }
  state.drag = null;
  clearHint();
}

els.content.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.card');
  if (!card) return;

  state.drag = {
    kind: 'item',
    groupId: card.dataset.groupId,
    itemId: card.dataset.itemId,
    element: card,
  };
  card.classList.add('dragging');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    try {
      const title = card.querySelector('.card-title');
      event.dataTransfer.setData('text/plain', title ? title.textContent : '');
    } catch (error) {
      /* egyes böngészők nem engedik */
    }
  }
});

els.content.addEventListener('dragover', (event) => {
  if (!state.drag) return;

  const card = event.target.closest('.card');
  if (card) {
    if (card === state.drag.element) {
      clearHint();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    setHint(card);
    return;
  }

  const section = event.target.closest('.group-section');
  if (section) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    setHint(section);
  }
});

els.content.addEventListener('dragleave', (event) => {
  if (!els.content.contains(event.relatedTarget)) clearHint();
});

els.content.addEventListener('drop', async (event) => {
  if (!state.drag) return;

  const drag = state.drag;
  const card = event.target.closest('.card');
  const section = event.target.closest('.group-section');
  event.preventDefault();

  try {
    if (card && card !== drag.element) {
      const rect = card.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      await moveItem(drag.groupId, drag.itemId, card.dataset.groupId, card.dataset.itemId, before);
    } else if (section) {
      await moveItem(drag.groupId, drag.itemId, section.dataset.groupId, null, true);
    }
  } finally {
    endDrag();
  }
});

els.groups.addEventListener('dragstart', (event) => {
  const row = event.target.closest('.nav-row');
  if (!row || row.dataset.groupId === 'all') {
    event.preventDefault();
    return;
  }

  state.drag = {
    kind: 'group',
    groupId: row.dataset.groupId,
    element: row,
  };
  row.classList.add('dragging');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    try {
      const name = row.querySelector('.nav-name');
      event.dataTransfer.setData('text/plain', name ? name.textContent : '');
    } catch (error) {
      /* kihagyjuk */
    }
  }
});

els.groups.addEventListener('dragover', (event) => {
  if (!state.drag) return;

  const row = event.target.closest('.nav-row');
  if (!row) return;
  if (state.drag.kind === 'group' && row.dataset.groupId === 'all') return;

  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  setHint(row);
});

els.groups.addEventListener('dragleave', (event) => {
  if (!els.groups.contains(event.relatedTarget)) clearHint();
});

els.groups.addEventListener('drop', async (event) => {
  if (!state.drag) return;

  const drag = state.drag;
  const row = event.target.closest('.nav-row');
  if (!row) return;

  event.preventDefault();
  const targetId = row.dataset.groupId;

  try {
    if (drag.kind === 'group' && targetId !== 'all' && targetId !== drag.groupId) {
      const rect = row.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      await moveGroup(drag.groupId, targetId, before);
    } else if (drag.kind === 'item' && targetId !== 'all') {
      await moveItem(drag.groupId, drag.itemId, targetId, null, true);
    }
  } finally {
    endDrag();
  }
});

document.addEventListener('dragend', endDrag);

async function moveItem(fromGroupId, itemId, toGroupId, targetItemId, before) {
  state.data = await mutate((data) => {
    const source = findGroup(data, fromGroupId);
    const target = findGroup(data, toGroupId);
    if (!source || !target) return;

    const sourceIndex = source.items.findIndex((item) => item.id === itemId);
    if (sourceIndex < 0) return;

    const item = source.items.splice(sourceIndex, 1)[0];

    let insertAt;
    if (targetItemId) {
      insertAt = target.items.findIndex((entry) => entry.id === targetItemId);
      if (insertAt < 0) insertAt = target.items.length;
      else if (!before) insertAt += 1;
    } else {
      insertAt = target.items.length;
    }

    if (source === target && sourceIndex < insertAt) insertAt -= 1;
    target.items.splice(Math.max(0, insertAt), 0, item);
  });

  renderAll();
}

async function moveGroup(groupId, targetGroupId, before) {
  state.data = await mutate((data) => {
    const index = data.groups.findIndex((group) => group.id === groupId);
    if (index < 0) return;

    const group = data.groups.splice(index, 1)[0];
    let insertAt = data.groups.findIndex((entry) => entry.id === targetGroupId);
    if (insertAt < 0) insertAt = data.groups.length;
    else if (!before) insertAt += 1;

    data.groups.splice(insertAt, 0, group);
  });

  renderAll();
}

/* ------------------------------------------------------------------ */
/* Események                                                           */
/* ------------------------------------------------------------------ */

function bindEvents() {
  for (const button of document.querySelectorAll('dialog [data-close]')) {
    button.addEventListener('click', () => {
      const dialog = button.closest('dialog');
      if (dialog && dialog.open) dialog.close();
    });
  }

  els.btnNewGroup.addEventListener('click', () => openGroupDialog(null));

  els.btnAddItem.addEventListener('click', () => {
    const groupId = state.view === 'all'
      ? state.data.groups[0].id
      : state.view;
    openItemDialog(groupId, null);
  });

  els.groups.addEventListener('click', (event) => {
    const row = event.target.closest('.nav-row');
    if (!row) return;
    setView(row.dataset.groupId);
  });

  els.groups.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('.nav-row');
    if (!row) return;
    event.preventDefault();
    setView(row.dataset.groupId);
  });

  els.search.addEventListener('input', () => {
    state.query = els.search.value.trim();
    window.clearTimeout(searchRenderTimer);
    searchRenderTimer = window.setTimeout(() => {
      renderTopbar();
      renderContent();
    }, 60);
  });

  els.search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      els.search.value = '';
      state.query = '';
      renderTopbar();
      renderContent();
      els.search.blur();
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (!state.query) return;

    const firstCard = els.content.querySelector('.card');
    if (firstCard) {
      firstCard.click();
      return;
    }

    const url = normalizeUrl(state.query);
    if (url) {
      els.search.value = '';
      state.query = '';
      renderTopbar();
      renderContent();
      openUrl(url);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;

    const target = event.target;
    const typing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    const isSlash = event.key === '/';
    const isCtrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

    if ((isSlash && !typing) || isCtrlK) {
      event.preventDefault();
      els.search.focus();
      els.search.select();
    }
  });
}
