/**
 * Közös adatkezelés a kezdőlap, a felugró ablak és a háttérszolgáltatás számára.
 *
 * Tárolt forma:
 * {
 *   schema: 1,
 *   groups: [{ id, name, color, createdAt, items: [{ id, url, title, createdAt }] }],
 *   settings: { openOnStartup, confirmDelete, theme }
 * }
 */

const STORAGE_KEY = 'collection';

export const SCHEMA_VERSION = 1;

export const PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#64748b',
];

export const DEFAULT_SETTINGS = Object.freeze({
  openOnStartup: true,
  confirmDelete: false,
  theme: 'system',
});

/** Egyedi azonosító. */
export function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Szöveg tisztítása: felesleges szóközök, hosszkorlát. */
export function cleanText(value, maxLength = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * URL normalizálása. Ha nincs protokoll, https://-t feltételezünk.
 * Csak http(s) hivatkozásokat fogadunk el, más esetben null.
 */
export function normalizeUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  let candidate = raw;
  if (/^https?:\/\//i.test(candidate)) {
    // már jó
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    // más protokoll (ftp://, file://, ...) – később kiszűrjük
  } else {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Megjelenítéshez használt gazdagép (www. nélkül). */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** Favicon URL a Chrome beépített, helyi favicon-gyorsítótárazójából. */
export function faviconUrl(url, size = 64) {
  try {
    return chrome.runtime.getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`,
    );
  } catch {
    return '';
  }
}

export function isWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

export function findGroup(data, groupId) {
  if (!data || !Array.isArray(data.groups)) return null;
  return data.groups.find((group) => group.id === groupId) || null;
}

export function countItems(data) {
  if (!data || !Array.isArray(data.groups)) return 0;
  return data.groups.reduce((total, group) => total + group.items.length, 0);
}

export function makeItem(input = {}) {
  const url = normalizeUrl(input.url);
  if (!url) return null;
  const createdAt = Number.isFinite(input.createdAt) ? input.createdAt : Date.now();
  return {
    id: typeof input.id === 'string' && input.id ? input.id : uid(),
    url,
    title: cleanText(input.title, 300) || hostOf(url) || url,
    createdAt,
  };
}

export function makeGroup(input = {}) {
  const items = Array.isArray(input.items)
    ? input.items.map((item) => makeItem(item)).filter(Boolean)
    : [];
  return {
    id: typeof input.id === 'string' && input.id ? input.id : uid(),
    name: cleanText(input.name, 80) || 'Névtelen csoport',
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : PALETTE[0],
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
    items,
  };
}

export function blankData() {
  return {
    schema: SCHEMA_VERSION,
    groups: [makeGroup({ name: 'Kedvencek', color: PALETTE[0] })],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS };
  settings.openOnStartup = source.openOnStartup !== false;
  settings.confirmDelete = source.confirmDelete === true;
  settings.theme = ['system', 'light', 'dark'].includes(source.theme)
    ? source.theme
    : DEFAULT_SETTINGS.theme;
  return settings;
}

function normalizeGroup(raw, index) {
  if (!raw || typeof raw !== 'object') return null;

  const seenUrls = new Set();
  const items = [];
  if (Array.isArray(raw.items)) {
    for (const entry of raw.items) {
      const item = makeItem(entry || {});
      if (!item || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      items.push(item);
    }
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name: cleanText(raw.name, 80) || `Csoport ${index + 1}`,
    color: /^#[0-9a-f]{6}$/i.test(raw.color || '')
      ? raw.color
      : PALETTE[index % PALETTE.length],
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    items,
  };
}

/** Bármilyen bemenetből érvényes adatmodellt készít. */
export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return blankData();

  const groups = Array.isArray(raw.groups)
    ? raw.groups.map((group, index) => normalizeGroup(group, index)).filter(Boolean)
    : [];

  const seenIds = new Set();
  for (const group of groups) {
    if (seenIds.has(group.id)) group.id = uid();
    seenIds.add(group.id);
  }

  if (!groups.length) groups.push(makeGroup({ name: 'Kedvencek' }));

  return {
    schema: SCHEMA_VERSION,
    groups,
    settings: normalizeSettings(raw.settings),
  };
}

export async function loadData() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeData(stored ? stored[STORAGE_KEY] : null);
}

export async function saveData(data) {
  const normalized = normalizeData(data);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

/**
 * Olvas–módosít–ír: a callback a friss adatot kapja, módosíthatja,
 * a visszatérési értéke (ha van) lesz a mentett adat.
 */
export async function mutate(callback) {
  const data = await loadData();
  const returned = await callback(data);
  return saveData(returned && typeof returned === 'object' ? returned : data);
}

/** Figyeli az adatváltozásokat (más nézetekből, pl. felugró ablakból is). */
export function onDataChange(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
    callback(normalizeData(changes[STORAGE_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Oldal hozzáadása csoporthoz. Ha a hivatkozás már szerepel a csoportban,
 * csak a címet frissíti.
 * @returns {{item: object, created: boolean}|null}
 */
export function addPage(data, groupId, url, title = '') {
  const group = findGroup(data, groupId) || data.groups[0] || null;
  const item = makeItem({ url, title });
  if (!group || !item) return null;

  const existing = group.items.find((entry) => entry.url === item.url);
  if (existing) {
    if (title) existing.title = cleanText(title, 300) || existing.title;
    return { item: existing, created: false };
  }

  group.items.unshift(item);
  return { item, created: true };
}
