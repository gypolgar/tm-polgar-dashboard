/* Böngészős teszt: a Drive szinkron tiszta függvényei (nem része a kiegészítőnek). */

import { hashData, isDriveConfigured, planSync } from './lib/drive.js';

const results = [];
let failures = 0;

function check(condition, label) {
  results.push(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures += 1;
}

try {
  check(typeof hashData === 'function', 'hashData importálható');
  check(hashData({ a: 1 }) === hashData({ a: 1 }), 'hashData determinisztikus');
  check(hashData({ a: 1 }) !== hashData({ a: 2 }), 'hashData érzékeny a tartalomra');
  check(isDriveConfigured() === false, 'tesztkörnyezetben nincs OAuth kliens');

  const base = {
    localHash: 'L',
    syncedHash: 'L',
    remoteModifiedTime: '2026-01-01T10:00:00Z',
    syncedRemoteModifiedTime: '2026-01-01T10:00:00Z',
    lastSyncAt: '2026-01-01T10:00:00Z',
  };

  check(
    planSync({ ...base, remoteModifiedTime: null }) === 'push',
    'nincs távoli fájl → feltöltés',
  );
  check(planSync(base) === 'none', 'egyező állapot → nincs művelet');
  check(
    planSync({ ...base, syncedHash: 'Régi' }) === 'push',
    'csak helyben változott → feltöltés',
  );
  check(
    planSync({ ...base, syncedRemoteModifiedTime: '2026-01-01T09:00:00Z' }) === 'pull',
    'csak távoli változott → letöltés',
  );
  check(
    planSync({
      ...base,
      syncedHash: 'Régi',
      syncedRemoteModifiedTime: '2026-01-01T09:00:00Z',
      lastSyncAt: '2026-01-01T09:30:00Z',
    }) === 'pull',
    'mindkettő változott, távoli frissebb → letöltés',
  );
  check(
    planSync({
      ...base,
      syncedHash: 'Régi',
      syncedRemoteModifiedTime: '2026-01-01T09:00:00Z',
      remoteModifiedTime: '2026-01-01T09:10:00Z',
      lastSyncAt: '2026-01-01T11:00:00Z',
    }) === 'push',
    'mindkettő változott, helyi frissebb → feltöltés',
  );
} catch (error) {
  failures += 1;
  results.push('✗ VÉGREHAJTÁSI HIBA: ' + (error && error.stack ? error.stack : String(error)));
}

const jsErrors = window.__errors || [];
if (jsErrors.length) {
  failures += jsErrors.length;
  results.push('✗ JavaScript hibák:', ...jsErrors);
}

const summary = document.createElement('pre');
summary.id = 'test-results';
summary.textContent =
  `EREDMÉNY: ${failures === 0 ? 'MINDEN TESZT SIKERES' : failures + ' HIBA'}\n` +
  results.join('\n');
document.body.append(summary);
document.title = failures === 0 ? 'TESTS-OK' : 'TESTS-FAIL';
