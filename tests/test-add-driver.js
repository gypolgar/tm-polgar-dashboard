/* Böngészős teszt: jobb gombos „Oldal hozzáadása” előkitöltése (nem része a kiegészítőnek). */

import { loadData } from './lib/store.js';

const $ = (selector) => document.querySelector(selector);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
let failures = 0;

function check(condition, label) {
  results.push(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures += 1;
}

async function waitFor(fn, label, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const value = fn();
      if (value) return value;
    } catch (error) {
      /* még nem elérhető */
    }
    await sleep(40);
  }
  throw new Error('Időtúllépés: ' + label);
}

try {
  const dialog = await waitFor(() => {
    const element = $('#dlgItem');
    return element && element.open ? element : null;
  }, 'előkitöltött hozzáadás dialógus');

  check(dialog.open === true, 'hozzáadás dialógus megnyílik');
  check($('#dlgItemTitle').textContent.trim() === 'Oldal hozzáadása', 'dialógus címe');
  check($('#itemUrl').value === 'https://pelda.hu/cikk', 'URL előre kitöltve');
  check($('#itemTitle').value === 'Példa cikk címe', 'cím előre kitöltve');
  check(window.location.search === '', 'URL paraméterek eltávolítva');

  const data = await loadData();
  check($('#itemGroup').value === data.groups[0].id, 'első csoport kiválasztva');

  /* Mentés a dialógusból */
  $('#itemTitle').value = 'Szerkesztett cím';
  $('#itemForm button[type="submit"]').click();
  await waitFor(() => !$('#dlgItem').open, 'mentés a dialógusból');

  const saved = await loadData();
  check(
    saved.groups[0].items.some(
      (item) => item.url === 'https://pelda.hu/cikk' && item.title === 'Szerkesztett cím',
    ),
    'előkitöltött oldal elmentve',
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
