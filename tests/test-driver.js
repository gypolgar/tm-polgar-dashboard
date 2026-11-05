/* Böngészős tesztforgatókönyv (nem része a kiegészítőnek). */

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

function submit(formSelector) {
  const button = $(`${formSelector} button[type="submit"]`);
  if (!button) throw new Error('Nincs submit gomb: ' + formSelector);
  button.click();
}

function setFile(input, name, content, type) {
  const file = new File([content], name, { type });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

try {
  await waitFor(() => $('#content .group-section'), 'kezdeti render');

  check($$('#groups .nav-row').length === 4, 'oldalsáv: Összes + 3 csoport');
  check($$('#content .card').length === 5, `kezdeti kártyaszám 5 (kapott: ${$$('#content .card').length})`);
  check(text($('#viewTitle')) === 'Összes oldal', 'fejléc: Összes oldal');
  check($('#viewDot').classList.contains('hidden'), 'nézet pont elrejtve az Összes nézetben');

  /* Párbeszédablakok bezárása */
  $('#btnAddItem').click();
  await waitFor(() => $('#dlgItem').open, 'oldal dialógus bezárás előtt');
  $('#dlgItem [data-close]').click();
  await waitFor(() => !$('#dlgItem').open, 'oldal dialógus bezárása');

  $('#btnData').click();
  await waitFor(() => $('#dlgData').open, 'adat dialógus bezárás előtt');
  $('#dlgData [data-close]').click();
  await waitFor(() => !$('#dlgData').open, 'adat dialógus bezárása');

  $('#btnNewGroup').click();
  await waitFor(() => $('#dlgGroup').open, 'csoport dialógus bezárás előtt');
  $('#dlgGroup [data-close]').click();
  await waitFor(() => !$('#dlgGroup').open, 'csoport dialógus bezárása');

  /* Új csoport */
  $('#btnNewGroup').click();
  await waitFor(() => $('#dlgGroup').open, 'csoport dialógus');
  check($$('#groupColors .swatch').length === 10, '10 színválasztó');
  $('#groupName').value = 'Teszt csoport';
  $('#groupColors .swatch:nth-child(4)').click();
  submit('#groupForm');
  await waitFor(() => !$('#dlgGroup').open, 'csoport mentése');
  await waitFor(() => $$('#groups .nav-row').length === 5, 'új csoport az oldalsávban');
  check(text($('#viewTitle')) === 'Teszt csoport', 'új csoport kiválasztva');
  check($$('#content .card').length === 0, 'új csoport üres');

  /* Oldal hozzáadása */
  $('#btnAddItem').click();
  await waitFor(() => $('#dlgItem').open, 'oldal dialógus');
  $('#itemUrl').value = 'example.com';
  $('#itemTitle').value = 'Példa oldal';
  submit('#itemForm');
  await waitFor(() => !$('#dlgItem').open, 'oldal mentése');
  await waitFor(() => $$('#content .card').length === 1, 'kártya megjelent');
  check(text($('#content .card .card-title')) === 'Példa oldal', 'kártya címe');
  check(text($('#content .card .card-host')) === 'example.com', 'kártya gazdagépe');

  /* Duplikált oldal */
  $('#btnAddItem').click();
  await waitFor(() => $('#dlgItem').open, 'oldal dialógus újra');
  $('#itemUrl').value = 'https://example.com/';
  $('#itemTitle').value = 'Duplikált';
  submit('#itemForm');
  await waitFor(() => !$('#dlgItem').open, 'duplikált mentés lezárult');
  check(text($('#toast')).includes('már szerepel'), 'duplikált URL jelezve');
  check($$('#content .card').length === 1, 'duplikált nem jött létre');

  /* Szerkesztés */
  $('#content .card .card-actions .icon-btn').click();
  await waitFor(() => $('#dlgItem').open, 'szerkesztő dialógus');
  $('#itemTitle').value = 'Módosított cím';
  submit('#itemForm');
  await waitFor(() => !$('#dlgItem').open, 'szerkesztés mentése');
  await waitFor(() => text($('#content .card .card-title')) === 'Módosított cím', 'cím frissült');

  /* Keresés */
  $('#search').value = 'módosított';
  $('#search').dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => text($('#viewTitle')) === 'Keresés', 'keresés mód');
  check($$('#content .card').length === 1, 'keresés: egy találat');

  $('#search').value = 'semmi nincs ilyen';
  $('#search').dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => text($('#content')).includes('Nincs találat'), 'nincs találat állapot');

  $('#search').value = '';
  $('#search').dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => text($('#viewTitle')) === 'Teszt csoport', 'keresés törlése');

  /* Törlés + visszavonás */
  $('#content .card .card-actions .icon-btn.danger').click();
  await waitFor(() => $$('#content .card').length === 0, 'kártya törölve');
  await waitFor(() => $('.toast-action'), 'visszavonás gomb');
  $('.toast-action').click();
  await waitFor(() => $$('#content .card').length === 1, 'visszavonás működik');
  check(text($('#content .card .card-title')) === 'Módosított cím', 'visszaállított cím helyes');

  /* Megnyitott lapok mentése */
  const beforeGroups = (await loadData()).groups.length;
  $('#btnData').click();
  await waitFor(() => $('#dlgData').open, 'adat dialógus');
  await waitFor(() => $$('#tabsList .tab-row').length === 3, 'három exportálható lap');
  check($$('#tabsList .tab-row').length === 3, 'chrome:// lap kiszűrve');
  check(text($('#tabsCount')).includes('3 / 3'), 'kijelölt lapok számlálója');
  $('#btnSaveTabs').click();
  await waitFor(() => !$('#dlgData').open, 'lapok mentése');
  const afterSave = await loadData();
  check(afterSave.groups.length === beforeGroups + 1, 'új csoport a lapokból');
  check(text($('#viewTitle')).includes('Megnyitott lapok'), 'mentett lapok csoport kiválasztva');
  check($$('#content .card').length === 3, 'három kártya az új csoportban');

  /* Exportok */
  const downloadsBefore = window.__downloads.length;
  $('#btnData').click();
  await waitFor(() => $('#dlgData').open, 'adat dialógus 2');
  await waitFor(() => $$('#tabsList .tab-row').length === 3, 'lapok újra betöltve');
  $('#btnExportTabsJson').click();
  await waitFor(() => window.__downloads.length === downloadsBefore + 1, 'JSON export');
  const jsonDownload = window.__downloads[window.__downloads.length - 1];
  check(jsonDownload.name.endsWith('.json'), 'JSON export fájlnév');

  $('#btnExportTabsHtml').click();
  await waitFor(() => window.__downloads.length === downloadsBefore + 2, 'HTML export');
  const htmlDownload = window.__downloads[window.__downloads.length - 1];
  check(htmlDownload.name.endsWith('.html'), 'HTML export fájlnév');

  /* Teljes gyűjtemény mentése */
  $('.tab[data-tab="backup"]').click();
  $('#btnBackup').click();
  await waitFor(() => window.__downloads.length === downloadsBefore + 3, 'gyűjtemény mentése');
  const backup = window.__downloads[window.__downloads.length - 1];
  check(backup.name.startsWith('tm-polgar-dashboard-mentes-'), 'mentés fájlnév');
  const backupData = JSON.parse(await window.__blobs[backup.href].text());
  check(backupData.app === 'tm-polgar-dashboard', 'mentés formátuma');
  check(Array.isArray(backupData.groups) && backupData.groups.length >= 1, 'mentés tartalmaz csoportokat');

  /* Gyűjtemény exportálása könyvjelző HTML-ként */
  $('#btnExportCollectionHtml').click();
  await waitFor(
    () => window.__downloads.length === downloadsBefore + 4,
    'gyűjtemény HTML export',
  );
  const collectionHtml = window.__downloads[window.__downloads.length - 1];
  check(
    collectionHtml.name.startsWith('tm-polgar-dashboard-konyvjelzok-') &&
      collectionHtml.name.endsWith('.html'),
    'gyűjtemény HTML fájlnév',
  );
  const collectionHtmlText = await window.__blobs[collectionHtml.href].text();
  check(
    collectionHtmlText.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>'),
    'gyűjtemény HTML formátum',
  );
  check(
    collectionHtmlText.includes('Kedvencek') && collectionHtmlText.includes('https://github.com/'),
    'gyűjtemény HTML tartalma',
  );

  /* JSON import */
  $('.tab[data-tab="import"]').click();
  const jsonPayload = JSON.stringify({
    app: 'tm-polgar-dashboard',
    version: 1,
    groups: [
      {
        name: 'Importált JSON',
        items: [{ url: 'https://pelda.hu/oldal', title: 'Importált oldal' }]
      }
    ]
  });
  setFile($('#fileInput'), 'teszt.json', jsonPayload, 'application/json');
  await waitFor(() => !$('#importPreview').classList.contains('hidden'), 'import előnézet');
  check(text($('#importSummary')).includes('1 csoport'), 'import összegzés');
  const groupsBeforeImport = (await loadData()).groups.length;
  $('#btnDoImport').click();
  await waitFor(() => !$('#dlgData').open, 'import lezárult');
  const afterImport = await loadData();
  check(afterImport.groups.length === groupsBeforeImport + 1, 'JSON import hozzáadva');
  check(
    afterImport.groups.some((group) => group.name === 'Importált JSON' && group.items.length === 1),
    'importált csoport tartalma',
  );

  /* Korábbi azonosítóval (linkgyujtemeny) készült mentés importja */
  $('#btnData').click();
  await waitFor(() => $('#dlgData').open, 'adat dialógus (régi mentés)');
  $('.tab[data-tab="import"]').click();
  const legacyPayload = JSON.stringify({
    app: 'linkgyujtemeny',
    version: 1,
    settings: { theme: 'dark' },
    groups: [
      {
        name: 'Régi mentés',
        items: [{ url: 'https://regi.example/', title: 'Régi oldal' }],
      },
    ],
  });
  setFile($('#fileInput'), 'regi-mentes.json', legacyPayload, 'application/json');
  await waitFor(() => !$('#importPreview').classList.contains('hidden'), 'régi mentés előnézet');
  check(text($('#importSummary')).includes('beállítások is'), 'régi mentés beállításai felismerve');
  $('#btnDoImport').click();
  await waitFor(() => !$('#dlgData').open, 'régi mentés import lezárult');
  const afterLegacy = await loadData();
  check(
    afterLegacy.groups.some((group) => group.name === 'Régi mentés'),
    'régi azonosítójú mentés importálva',
  );

  /* HTML könyvjelző import */
  $('#btnData').click();
  await waitFor(() => $('#dlgData').open, 'adat dialógus 3');
  $('.tab[data-tab="import"]').click();
  const bookmarkHtml = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<DL><p>',
    '<DT><H3>HTML mappa</H3>',
    '<DL><p>',
    '<DT><A HREF="https://html-import.example/1">Első</A>',
    '<DT><A HREF="https://html-import.example/2">Második</A>',
    '</DL><p>',
    '</DL>',
  ].join('\n');
  setFile($('#fileInput'), 'bookmarks.html', bookmarkHtml, 'text/html');
  await waitFor(() => !$('#importPreview').classList.contains('hidden'), 'HTML import előnézet');
  $('#btnDoImport').click();
  await waitFor(() => !$('#dlgData').open, 'HTML import lezárult');
  const afterHtml = await loadData();
  check(
    afterHtml.groups.some((group) => group.name === 'HTML mappa' && group.items.length === 2),
    'HTML könyvjelző import',
  );

  /* Beállítások */
  $('#btnSettings').click();
  await waitFor(() => $('#dlgSettings').open, 'beállítások dialógus');
  $('#setTheme').value = 'dark';
  $('#setStartup').checked = false;
  submit('#settingsForm');
  await waitFor(() => !$('#dlgSettings').open, 'beállítások mentése');
  const settingsData = await loadData();
  check(settingsData.settings.theme === 'dark', 'téma mentve');
  check(settingsData.settings.openOnStartup === false, 'indítási beállítás mentve');
  check(document.documentElement.dataset.theme === 'dark', 'téma alkalmazva');

  /* Csoport törlése + visszavonás */
  const name = 'Teszt csoport';
  const row = $$('#groups .nav-row').find((item) => text(item.querySelector('.nav-name')) === name);
  check(Boolean(row), 'teszt csoport sora megtalálható');
  if (row) row.click();
  await waitFor(() => text($('#viewTitle')) === name, 'csoport kiválasztva');
  $('#viewActions .icon-btn.danger').click();
  await waitFor(() => $('#dlgConfirm').open, 'megerősítő dialógus');
  $('#confirmOk').click();
  await waitFor(
    () => !$$('#groups .nav-row').some((item) => text(item.querySelector('.nav-name')) === name),
    'csoport törölve',
  );
  check(text($('#viewTitle')) === 'Összes oldal', 'törlés után Összes nézet');
  await waitFor(() => $('.toast-action'), 'csoport visszavonás gomb');
  $('.toast-action').click();
  await waitFor(
    () => $$('#groups .nav-row').some((item) => text(item.querySelector('.nav-name')) === name),
    'csoport visszaállítva',
  );

  /* Csoport megnyitása */
  const restoredRow = $$('#groups .nav-row').find((item) => text(item.querySelector('.nav-name')) === name);
  if (restoredRow) restoredRow.click();
  await waitFor(() => text($('#viewTitle')) === name, 'visszaállított csoport kiválasztva');
  const tabsBeforeOpen = window.__createdTabs.length;
  const openButton = $('#viewActions .icon-btn');
  if (openButton) openButton.click();
  await waitFor(() => window.__createdTabs.length === tabsBeforeOpen + 1, 'csoport megnyitása');
  check(window.__createdTabs.length === tabsBeforeOpen + 1, 'csoport megnyitása új lapokat nyit');

  /* Saját mentés visszaállítása csere móddal (gyűjtemény + beállítások) */
  $('#btnData').click();
  await waitFor(() => $('#dlgData').open, 'adat dialógus visszaállításhoz');
  $('.tab[data-tab="import"]').click();
  const restorePayload = JSON.stringify({
    schema: 1,
    settings: { openOnStartup: true, confirmDelete: true, theme: 'light' },
    groups: [
      {
        name: 'Visszaállított gyűjtemény',
        color: '#0ea5e9',
        items: [{ url: 'https://restore.example/', title: 'Visszaállított oldal' }],
      },
    ],
  });
  setFile($('#fileInput'), 'mentes.json', restorePayload, 'application/json');
  await waitFor(() => !$('#importPreview').classList.contains('hidden'), 'visszaállítás előnézet');
  check(text($('#importSummary')).includes('beállítások is'), 'előnézet jelzi a beállításokat');
  $('input[name="importMode"][value="replace"]').checked = true;
  $('#btnDoImport').click();
  await waitFor(() => !$('#dlgData').open, 'visszaállítás lezárult');
  const restoredData = await loadData();
  check(restoredData.groups.length === 1, 'csere: csak a visszaállított csoport marad');
  check(
    restoredData.groups[0].name === 'Visszaállított gyűjtemény' &&
      restoredData.groups[0].items.length === 1,
    'visszaállított gyűjtemény tartalma',
  );
  check(restoredData.settings.theme === 'light', 'téma visszaállítva');
  check(restoredData.settings.openOnStartup === true, 'indítási beállítás visszaállítva');
  check(restoredData.settings.confirmDelete === true, 'törlés megerősítése visszaállítva');
  check(document.documentElement.dataset.theme === 'light', 'visszaállított téma alkalmazva');
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
