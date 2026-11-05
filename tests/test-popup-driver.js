/* Böngészős teszt a felugró ablakhoz (nem része a kiegészítőnek). */

import { loadData } from './lib/store.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (element) => (element ? element.textContent.trim() : '');

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
  await waitFor(() => $$('#groupSelect option').length === 3, 'csoportok betöltése');

  check(text($('#pageTitle')) === 'Első lap', 'aktuális lap címe');
  check(text($('#pageHost')) === 'example.org', 'aktuális lap gazdagépe');
  check($('#savedHint').classList.contains('hidden'), 'még nincs mentve jelzés');
  check($('#btnSave').disabled === false, 'mentés gomb aktív');
  check(text($('#btnSave')) === 'Mentés', `mentés gomb felirata (kapott: ${JSON.stringify(text($('#btnSave')))})`);

  /* Új csoport a felugró ablakból */
  $('#btnQuickGroup').click();
  await waitFor(() => !$('#newGroupRow').classList.contains('hidden'), 'új csoport mező');
  check(document.activeElement === $('#newGroupName'), 'új csoport mező fókuszban');
  $('#newGroupName').value = 'Gyors csoport';
  $('#btnCreateGroup').click();
  await waitFor(() => $$('#groupSelect option').length === 4, 'új csoport létrejött');
  const newOption = $$('#groupSelect option').find((option) => option.textContent === 'Gyors csoport');
  check(Boolean(newOption), 'új csoport az opciók között');
  check($('#groupSelect').value === newOption.value, 'új csoport kiválasztva');
  check($('#newGroupRow').classList.contains('hidden'), 'új csoport mező elrejtve');
  check($('#newGroupName').value === '', 'új csoport mező kiürítve');

  /* Mentés */
  $('#titleInput').value = 'Első lap átnevezve';
  $('#btnSave').click();
  await waitFor(() => text($('#btnSave')) === 'Mentve ✓', 'mentés visszajelzés');
  check($('#btnSave').disabled === true, 'mentés után gomb letiltva');
  await waitFor(() => window.__closed === true, 'felugró ablak bezárása');

  const data = await loadData();
  const created = data.groups.find((group) => group.name === 'Gyors csoport');
  check(Boolean(created), 'csoport elmentve');
  check(Boolean(created) && created.items.length === 1, 'egy oldal a csoportban');
  check(
    Boolean(created) && created.items[0].url === 'https://example.org/egy' &&
      created.items[0].title === 'Első lap átnevezve',
    'mentett oldal adatai helyesek',
  );

  /* Új csoport név nélkül nem jön létre */
  $('#btnQuickGroup').click();
  $('#groupSelect').value = created.id;
  $('#newGroupName').value = '   ';
  $('#btnCreateGroup').click();
  await sleep(100);
  const afterEmpty = await loadData();
  check(afterEmpty.groups.length === 4, 'üres névvel nem jön létre csoport');
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
