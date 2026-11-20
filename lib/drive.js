/**
 * Google Drive szinkron a `collection` értékhez.
 *
 * A fájl a Drive rejtett, alkalmazásspecifikus mappájába (appDataFolder) kerül,
 * így nem látszik a sima Drive-listában, de ugyanahhoz a Google-fiókhoz
 * bejelentkezett Chrome-profilok mind elérik.
 *
 * A beállításhoz a manifest.json `oauth2.client_id` mezőjébe kell beírni a
 * Google Cloud Console-ban létrehozott „Chrome extension” OAuth kliens azonosítóját.
 */

import { saveData } from './store.js';

const CLIENT_ID = (() => {
  try {
    return chrome.runtime.getManifest().oauth2?.client_id || '';
  } catch {
    return '';
  }
})();

export const DRIVE_FILE = 'collection.json';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const SYNC_ALARM = 'tm-polgar-drive-sync';

/** A beállítás és a Google-fiók szinkronja csak valódi kliens ID-val működik. */
export function isDriveConfigured() {
  return (
    /\.apps\.googleusercontent\.com$/.test(CLIENT_ID) &&
    !CLIENT_ID.startsWith('REPLACE')
  );
}

/** Egyszerű, gyors hash a tartalom összehasonlításához. */
export function hashData(value) {
  const text = JSON.stringify(value === undefined ? null : value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Tiszta döntési függvény: mi történjen a két verzióval.
 * @returns {'push'|'pull'|'none'}
 */
export function planSync({
  localHash,
  syncedHash,
  remoteModifiedTime,
  syncedRemoteModifiedTime,
  lastSyncAt,
}) {
  if (!remoteModifiedTime) return 'push';

  const localChanged = localHash !== syncedHash;
  const remoteChanged = remoteModifiedTime !== syncedRemoteModifiedTime;

  if (!localChanged && remoteChanged) return 'pull';
  if (localChanged && !remoteChanged) return 'push';
  if (!localChanged && !remoteChanged) return 'none';

  // Mindkét oldal változott: a későbbi időbélyeg nyer.
  return Date.parse(remoteModifiedTime) > Date.parse(lastSyncAt || 0)
    ? 'pull'
    : 'push';
}

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      reject(new Error('A Google-bejelentkezés nem érhető el ebben a környezetben.'));
      return;
    }
    chrome.identity.getAuthToken({ interactive }, (value) => {
      const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
      if (error) reject(new Error(error));
      else if (!value) reject(new Error('Nem sikerült a Google-bejelentkezés.'));
      else resolve(value);
    });
  });
}

function clearToken(value) {
  return new Promise((resolve) => {
    try {
      chrome.identity.removeCachedAuthToken({ token: value }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function authorizedFetch(url, options, interactive) {
  let value = await getToken(interactive);
  const send = (token) =>
    fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });

  let response = await send(value);
  if (response.status === 401) {
    await clearToken(value);
    value = await getToken(true);
    response = await send(value);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google Drive hiba (${response.status}): ${detail.slice(0, 160)}`);
  }
  return response;
}

async function findRemoteFile(interactive) {
  const query = encodeURIComponent(`name = '${DRIVE_FILE}' and trashed = false`);
  const response = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder` +
      '&fields=files(id,modifiedTime)&pageSize=10',
    { method: 'GET' },
    interactive,
  );
  const body = await response.json();
  return (body.files || [])[0] || null;
}

/** A távoli fájl tartalma és módosítási ideje, vagy null, ha még nincs. */
export async function readRemote(interactive = false) {
  const file = await findRemoteFile(interactive);
  if (!file) return null;

  const response = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { method: 'GET' },
    interactive,
  );
  return { data: await response.json(), modifiedTime: file.modifiedTime };
}

/** A `collection` feltöltése (új fájl létrehozása vagy frissítése). */
export async function writeRemote(data, interactive = false) {
  const file = await findRemoteFile(interactive);
  const boundary = `----tm-polgar-dashboard-${Date.now()}`;
  const metadata = JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'] });
  const payload = JSON.stringify(data);
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    payload,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const url = file
    ? `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  await authorizedFetch(
    url,
    {
      method: file ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
    interactive,
  );
}

async function saveMeta(syncedHash, remoteModifiedTime) {
  await chrome.storage.local.set({
    driveSync: {
      syncedHash,
      remoteModifiedTime,
      lastSyncAt: new Date().toISOString(),
    },
  });
}

async function applyRemote(data, modifiedTime) {
  const normalized = await saveData(data);
  await saveMeta(hashData(normalized), modifiedTime);
}

async function pushLocal(collection, interactive) {
  await writeRemote(collection, interactive);
  const file = await findRemoteFile(interactive);
  await saveMeta(hashData(collection), file?.modifiedTime || new Date().toISOString());
}

/**
 * A gyűjtemény szinkronizálása.
 * @param {{mode?: 'auto'|'push'|'pull', interactive?: boolean}} options
 * @returns {Promise<'push'|'pull'|'none'>}
 */
export async function syncCollection(options = {}) {
  const { mode = 'auto', interactive = false } = options;
  if (!isDriveConfigured()) {
    throw new Error('Nincs beállítva Google OAuth kliens azonosító a manifest.json-ben.');
  }

  const stored = await chrome.storage.local.get(['collection', 'driveSync']);
  const local = stored.collection === undefined ? null : stored.collection;
  const meta = stored.driveSync || {};
  const localHash = hashData(local);

  if (mode === 'push') {
    await pushLocal(local, true);
    return 'push';
  }

  const remote = await readRemote(interactive);
  if (!remote) {
    await pushLocal(local, interactive);
    return 'push';
  }

  if (mode === 'pull') {
    await applyRemote(remote.data, remote.modifiedTime);
    return 'pull';
  }

  const action = planSync({
    localHash,
    syncedHash: meta.syncedHash,
    remoteModifiedTime: remote.modifiedTime,
    syncedRemoteModifiedTime: meta.remoteModifiedTime,
    lastSyncAt: meta.lastSyncAt,
  });

  if (action === 'pull') {
    await applyRemote(remote.data, remote.modifiedTime);
  } else if (action === 'push') {
    await pushLocal(local, interactive);
  }
  return action;
}
