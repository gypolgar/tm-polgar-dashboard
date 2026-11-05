/**
 * Mentés, export és import segédfüggvények.
 *
 * Saját JSON formátum:
 * {
 *   app: "tm-polgar-dashboard",
 *   version: 1,
 *   exportedAt: "...",
 *   settings: {...},
 *   groups: [{ name, color, createdAt, items: [{ url, title, createdAt }] }]
 * }
 */

import {
  PALETTE,
  cleanText,
  hostOf,
  normalizeUrl,
  uid,
} from './store.js';

export const BACKUP_APP = 'tm-polgar-dashboard';
/** A korábbi kiadások azonosítói, hogy a régi mentések beállításai is átjöjjenek. */
const BACKUP_APPS = [BACKUP_APP, 'teem-polgar-dashboard', 'linkgyujtemeny'];
export const BACKUP_VERSION = 1;

/** Év-hónap-nap, pl. 2026-11-03. */
export function dateStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildBackup(data) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: { ...data.settings },
    groups: data.groups.map((group) => ({
      name: group.name,
      color: group.color,
      createdAt: group.createdAt,
      items: group.items.map((item) => ({
        url: item.url,
        title: item.title,
        createdAt: item.createdAt,
      })),
    })),
  };
}

export function serializeBackup(data) {
  return JSON.stringify(buildBackup(data), null, 2);
}

/** Fájl letöltése a böngésző letöltési mechanizmusával. */
export function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Netscape könyvjelző HTML készítése (Chrome-ba is importálható). */
export function buildBookmarkHtml(groups) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- Ez a fájl a TM Polgar Dashboard kiegészítővel készült. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Könyvjelzők</TITLE>',
    '<H1>Könyvjelzők</H1>',
    '<DL><p>',
  ];

  for (const group of groups) {
    const name = escapeHtml(cleanText(group.name, 80) || 'Csoport');
    lines.push(`    <DT><H3>${name}</H3>`);
    lines.push('    <DL><p>');
    for (const item of group.items) {
      const url = escapeHtml(item.url);
      const title = escapeHtml(cleanText(item.title, 300) || hostOf(item.url) || item.url);
      const addDate = Math.floor((item.createdAt || Date.now()) / 1000);
      lines.push(`        <DT><A HREF="${url}" ADD_DATE="${addDate}">${title}</A>`);
    }
    lines.push('    </DL><p>');
  }

  lines.push('</DL><p>', '');
  return lines.join('\n');
}

const IGNORED_FOLDERS = new Set([
  'bookmarks',
  'bookmarks bar',
  'bookmarks toolbar',
  'bookmarks menu',
  'other bookmarks',
  'könyvjelzők',
  'könyvjelzősáv',
  'könyvjelző menü',
  'egyéb könyvjelzők',
]);

/** A <DL> lista feletti <H3> mappa neve (kétféle DOM-elrendezésre). */
function owningFolder(dl) {
  const previous = dl.previousElementSibling;
  if (previous && previous.tagName === 'DT') {
    const heading = previous.querySelector('h3');
    if (heading) return cleanText(heading.textContent, 80);
  }

  const parent = dl.parentElement;
  if (parent && parent.tagName === 'DT') {
    const heading = Array.from(parent.children).find((child) => child.tagName === 'H3');
    if (heading) return cleanText(heading.textContent, 80);
  }

  return '';
}

/** A hivatkozás mappáinak útvonala a gyökér felé haladva. */
function folderPath(anchor) {
  const folders = [];
  let node = anchor.parentElement;
  while (node) {
    if (node.tagName === 'DL') {
      const folder = owningFolder(node);
      if (folder && !IGNORED_FOLDERS.has(folder.toLowerCase())) folders.push(folder);
    }
    node = node.parentElement;
  }
  return folders.reverse();
}

/**
 * Netscape könyvjelző HTML feldolgozása.
 * Csoportonként a legmélyebb mappa nevét használjuk.
 */
export function parseBookmarkHtml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  const buckets = new Map();

  for (const anchor of anchors) {
    const url = normalizeUrl(anchor.getAttribute('href'));
    if (!url) continue;

    const path = folderPath(anchor);
    const groupName = path.length ? path[path.length - 1] : 'Importált hivatkozások';

    if (!buckets.has(groupName)) buckets.set(groupName, []);
    buckets.get(groupName).push({
      url,
      title: cleanText(anchor.textContent, 300) || hostOf(url),
    });
  }

  return Array.from(buckets, ([name, items]) => ({ name, items }));
}

function collectItems(list) {
  const items = [];
  const seen = new Set();

  for (const entry of list) {
    const rawUrl =
      typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object'
          ? entry.url || entry.href || entry.link || entry.address
          : '';
    const url = normalizeUrl(rawUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const rawTitle =
      entry && typeof entry === 'object'
        ? entry.title || entry.name || entry.label || ''
        : '';
    items.push({ url, title: cleanText(rawTitle, 300) || hostOf(url) });
  }

  return items;
}

function mapGroups(groups) {
  return groups
    .map((group) => {
      const source = group && typeof group === 'object' ? group : {};
      const items = collectItems(
        Array.isArray(source.items)
          ? source.items
          : Array.isArray(source.links)
            ? source.links
            : [],
      );
      return {
        name: cleanText(source.name, 80) || 'Importált',
        color: source.color,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

/** JSON importálás több gyakori formátumban. */
function parseJsonValue(raw) {
  if (raw && typeof raw === 'object' && Array.isArray(raw.groups)) {
    return mapGroups(raw.groups);
  }

  if (Array.isArray(raw)) {
    return [{ name: 'Importált hivatkozások', items: collectItems(raw) }];
  }

  if (raw && typeof raw === 'object') {
    const single = collectItems([raw]);
    if (single.length) return [{ name: 'Importált hivatkozások', items: single }];
  }

  throw new Error('Ismeretlen JSON-formátum.');
}

export function parseJsonImport(text) {
  return parseJsonValue(JSON.parse(text));
}

/**
 * Fájl szövegének feldolgozása (JSON vagy HTML könyvjelző).
 * @returns {{kind: 'json'|'html', groups: Array<{name, items}>, settings: object|null}}
 */
export function parseImportFile(text, fileName = '') {
  const source = typeof text === 'string' ? text.trim() : '';
  if (!source) throw new Error('A fájl üres.');

  const looksLikeHtml =
    source.startsWith('<') ||
    /\.html?$/i.test(fileName) ||
    /NETSCAPE-Bookmark/i.test(source.slice(0, 300));

  if (looksLikeHtml) {
    const groups = parseBookmarkHtml(source);
    if (!groups.length) throw new Error('Nem találtam hivatkozást a HTML-fájlban.');
    return { kind: 'html', groups, settings: null };
  }

  let groups;
  let settings = null;
  try {
    const raw = JSON.parse(source);
    groups = parseJsonValue(raw);
    const isOwnData =
      raw &&
      typeof raw === 'object' &&
      (BACKUP_APPS.includes(raw.app) ||
        (Number.isFinite(raw.schema) && Array.isArray(raw.groups)));
    if (isOwnData && raw.settings && typeof raw.settings === 'object') {
      settings = raw.settings;
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('A fájl nem érvényes JSON, és nem tűnik könyvjelző HTML-nek sem.');
    }
    throw error;
  }

  if (!groups.length) throw new Error('Nem találtam hivatkozást a JSON-fájlban.');
  return { kind: 'json', groups, settings };
}

/**
 * Importált csoportokból a tárolt adatmodellnek megfelelő csoportokat készít.
 */
export function materializeGroups(groups) {
  return groups.map((group, index) => ({
    id: uid(),
    name: cleanText(group.name, 80) || `Importált ${index + 1}`,
    color: /^#[0-9a-f]{6}$/i.test(group.color || '')
      ? group.color
      : PALETTE[index % PALETTE.length],
    createdAt: Date.now(),
    items: group.items.map((item) => ({
      id: uid(),
      url: item.url,
      title: cleanText(item.title, 300) || hostOf(item.url),
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    })),
  }));
}
