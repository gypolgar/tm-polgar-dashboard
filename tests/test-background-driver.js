/* Böngészős teszt a háttérszolgáltatáshoz (nem része a kiegészítőnek). */

import { loadData, mutate } from './lib/store.js';

const results = [];
let failures = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(condition, label) {
  results.push(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures += 1;
}

async function waitFor(fn, label, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      /* még nem elérhető */
    }
    await sleep(40);
  }
  throw new Error('Időtúllépés: ' + label);
}

try {
  /* A háttérszolgáltatás indulásakor automatikusan létrejönnek a menük */
  await waitFor(() => window.__menus.length === 6, 'automatikus menüépítés induláskor');
  check(window.__menus.length === 6, 'induláskor létrejönnek a menük');

  /* Telepítés üres tárolóval */
  await chrome.storage.local.clear();
  window.__createdTabs.length = 0;
  await window.__fireInstalled({ reason: 'install' });

  const seeded = await waitFor(async () => {
    const data = await loadData();
    return data.groups.length ? data : null;
  }, 'kezdő adatok');

  check(seeded.groups.length === 1 && seeded.groups[0].name === 'Kedvencek', 'telepítéskor létrejön a Kedvencek csoport');
  check(seeded.settings.openOnStartup === true, 'alapértelmezett indítási beállítás');
  await waitFor(
    () =>
      window.__menus.length === 4 &&
      window.__menus.some((menu) => menu.id === 'tm-polgar-save:' + seeded.groups[0].id),
    'jobb gombos menük',
  );
  check(window.__menus.length === 4, 'menü: gyökér + hozzáadás + elválasztó + csoport');
  check(window.__menus[0].id === 'tm-polgar-root', 'menü gyökér azonosító');
  check(
    window.__menus.filter((menu) => !menu.parentId).length === 1,
    'csak egy legfelső szintű menü van',
  );
  const addMenu = window.__menus.find((menu) => menu.id === 'tm-polgar-add');
  check(Boolean(addMenu) && addMenu.parentId === 'tm-polgar-root', 'hozzáadás a gyökér alatt');
  check(
    Boolean(addMenu) && addMenu.title.indexOf('Oldal hozzáadása') === 0,
    'hozzáadás menü felirata',
  );
  check(
    window.__menus.some((menu) => menu.type === 'separator' && menu.parentId === 'tm-polgar-root'),
    'elválasztó a hozzáadás után',
  );
  const groupMenu = window.__menus.find((menu) => menu.id === 'tm-polgar-save:' + seeded.groups[0].id);
  check(Boolean(groupMenu) && groupMenu.parentId === 'tm-polgar-root', 'csoport a gyökér alatt');
  await waitFor(
    () => window.__createdTabs.includes('chrome-extension://mockextensionid/newtab.html'),
    'telepítés utáni kezdőlap',
  );
  check(
    window.__createdTabs.filter((url) => url.endsWith('newtab.html')).length === 1,
    'telepítéskor egy kezdőlap nyílik',
  );

  /* Jobb gombos „Oldal hozzáadása” – előre kitöltött szerkesztő */
  window.__createdTabs.length = 0;
  await window.__fireMenuClick(
    { menuItemId: 'tm-polgar-add', pageUrl: 'https://ctx.example/cikk', linkUrl: '' },
    { title: 'Cikk címe' },
  );
  const addTabUrl = await waitFor(
    () => window.__createdTabs.find((url) => url.indexOf('newtab.html?') >= 0),
    'hozzáadás ablak megnyitása',
  );
  const addParams = new URL(addTabUrl).searchParams;
  check(addParams.get('add') === '1', 'hozzáadás kérés jelölve');
  check(addParams.get('url') === 'https://ctx.example/cikk', 'oldal URL átadva');
  check(addParams.get('title') === 'Cikk címe', 'oldal címe átadva');

  /* Hivatkozás hozzáadása kijelöléssel */
  window.__createdTabs.length = 0;
  await window.__fireMenuClick(
    {
      menuItemId: 'tm-polgar-add',
      pageUrl: 'https://ctx.example/cikk',
      linkUrl: 'https://ctx.example/hivatkozas',
      selectionText: 'Hivatkozás szövege',
    },
    { title: 'Cikk címe' },
  );
  const linkTabUrl = await waitFor(
    () => window.__createdTabs.find((url) => url.indexOf('newtab.html?') >= 0),
    'hivatkozás hozzáadásának megnyitása',
  );
  const linkParams = new URL(linkTabUrl).searchParams;
  check(linkParams.get('url') === 'https://ctx.example/hivatkozas', 'hivatkozás URL átadva');
  check(linkParams.get('title') === 'Hivatkozás szövege', 'hivatkozás címe átadva');

  /* Belső oldalhoz nem nyit szerkesztőt */
  window.__createdTabs.length = 0;
  await window.__fireMenuClick(
    { menuItemId: 'tm-polgar-add', pageUrl: 'chrome://settings/', linkUrl: '' },
    { title: 'Beállítások' },
  );
  await sleep(300);
  check(window.__createdTabs.length === 0, 'belső oldalhoz nincs hozzáadás');

  const groupId = seeded.groups[0].id;
  const menuId = 'tm-polgar-save:' + groupId;

  /* Oldal mentése jobb gombos menüből */
  window.__badges.length = 0;
  await window.__fireMenuClick(
    { menuItemId: menuId, pageUrl: 'https://ctx.example/oldal', linkUrl: '' },
    { title: 'Kontextus oldal' },
  );
  const afterPage = await waitFor(async () => {
    const data = await loadData();
    return data.groups[0].items.find((item) => item.url === 'https://ctx.example/oldal') ? data : null;
  }, 'oldal mentése menüből');
  const savedPage = afterPage.groups[0].items.find((item) => item.url === 'https://ctx.example/oldal');
  check(savedPage.title === 'Kontextus oldal', 'mentett oldal címe a lapból');
  check(window.__badges.includes('✓'), 'sikerjelzés a jelvényen');

  /* Ugyanaz újra: nincs duplikáció */
  await window.__fireMenuClick(
    { menuItemId: menuId, pageUrl: 'https://ctx.example/oldal', linkUrl: '' },
    { title: 'Kontextus oldal újra' },
  );
  const afterDuplicate = await loadData();
  check(
    afterDuplicate.groups[0].items.filter((item) => item.url === 'https://ctx.example/oldal').length === 1,
    'nincs duplikált oldal',
  );
  check(
    afterDuplicate.groups[0].items.find((item) => item.url === 'https://ctx.example/oldal').title ===
      'Kontextus oldal újra',
    'ismételt mentés frissíti a címet',
  );

  /* Hivatkozás mentése kijelöléssel */
  await window.__fireMenuClick(
    { menuItemId: menuId, pageUrl: 'https://ctx.example/oldal', linkUrl: 'https://ctx.example/hivatkozas', selectionText: 'Hivatkozás szövege' },
    { title: 'Külső oldal' },
  );
  const afterLink = await waitFor(async () => {
    const data = await loadData();
    return data.groups[0].items.find((item) => item.url === 'https://ctx.example/hivatkozas') ? data : null;
  }, 'hivatkozás mentése');
  check(
    afterLink.groups[0].items.find((item) => item.url === 'https://ctx.example/hivatkozas').title ===
      'Hivatkozás szövege',
    'hivatkozás címe a kijelölésből',
  );

  /* Ismeretlen csoport: az elsőbe ment */
  const beforeUnknown = (await loadData()).groups[0].items.length;
  await window.__fireMenuClick(
    { menuItemId: 'tm-polgar-save:nincs-ilyen', pageUrl: 'https://ctx.example/ismeretlen', linkUrl: '' },
    { title: 'Ismeretlen csoport' },
  );
  const afterUnknown = await waitFor(async () => {
    const data = await loadData();
    return data.groups[0].items.length === beforeUnknown + 1 ? data : null;
  }, 'ismeretlen csoport kezelése');
  check(Boolean(afterUnknown), 'ismeretlen csoportnál az elsőbe ment');

  /* Menük frissülnek adatváltozásra */
  await mutate((data) => {
    data.groups[0].name = 'Átnevezett';
  });
  await waitFor(() => window.__menus.some((menu) => menu.title === 'Átnevezett'), 'menü frissítése', 3000);
  check(window.__menus.some((menu) => menu.title === 'Átnevezett'), 'menü követi a csoportnevet');

  /* Indításkor kezdőlap nyitása */
  window.__createdTabs.length = 0;
  window.__MOCK_TABS = [{ id: 1, url: 'https://example.org/', title: 'Példa' }];
  window.__fireStartup();
  await waitFor(() => window.__createdTabs.length === 1, 'indításkori kezdőlap', 8000);
  check(
    window.__createdTabs[0] === 'chrome-extension://mockextensionid/newtab.html',
    'indításkor a kezdőlap nyílik',
  );

  /* Ha már nyitva van kezdőlap, nem nyit újat */
  window.__createdTabs.length = 0;
  window.__MOCK_TABS = [
    { id: 1, url: 'https://example.org/', title: 'Példa' },
    { id: 2, url: 'chrome-extension://mockextensionid/newtab.html', title: 'Kezdőlap' },
  ];
  window.__fireStartup();
  await sleep(2600);
  check(window.__createdTabs.length === 0, 'meglévő kezdőlapnál nincs duplikáció');

  /* Kikapcsolt indítási beállítás */
  await mutate((data) => {
    data.settings.openOnStartup = false;
  });
  window.__createdTabs.length = 0;
  window.__MOCK_TABS = [{ id: 1, url: 'https://example.org/', title: 'Példa' }];
  window.__fireStartup();
  await sleep(2600);
  check(window.__createdTabs.length === 0, 'kikapcsolva nem nyit kezdőlapot');
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
