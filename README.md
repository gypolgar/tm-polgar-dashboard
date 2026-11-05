# TM Polgar Dashboard – Kezdőlap

Saját kezdőlap böngésző-kiegészítő Chrome-hoz: a mentett oldalakat csoportokba
rendezi, és kezeli a megnyitott lapok, valamint a teljes gyűjtemény
exportját/importját. A felület magyar nyelvű.

## Telepítés

1. Nyisd meg a Chrome-ban a `chrome://extensions` oldalt.
2. Kapcsold be a jobb felső sarokban a **Fejlesztői mód** kapcsolót.
3. Kattints a **Kicsomagolt kiegészítő betöltése** gombra.
4. Válaszd ki ezt a mappát (amelyben a `manifest.json` található).
5. Nyiss egy új lapot – megjelenik a gyűjtemény.

A kiegészítő nem igényel buildelést vagy külső csomagot: a fájlok közvetlenül
futtathatók. Chrome 104 vagy újabb verzió szükséges.

## Indítás és új lap

- **Minden új lapon** automatikusan ez a kezdőlap nyílik meg
  (`chrome_url_overrides.newtab`).
- **Chrome indításakor** a *Beállítások → Megnyitás Chrome indításakor* kapcsoló
  hatására egyszer megnyit egy kezdőlapot. Ha már van nyitva ilyen lap, nem nyit
  újat.
- Ha a Chrome az indításkor a korábbi lapokat állítja vissza, a kiegészítő ezt
  kivárja, és csak utána dönt a kezdőlap megnyitásáról.
- A Chrome saját beállításaiban (*Indításkor*) is beállítható, hogy az új lap
  legyen az első oldal; ehhez nem kell külön módosítás, mert az új lap már eleve
  ez a felület.

## Használat

### Csoportok és oldalak

- **Új csoport**: az oldalsáv tetején. Nevet és színt lehet választani.
- **Oldal hozzáadása**: a jobb felső **Oldal** gombbal. Az URL-nél a `https://`
  elhagyható, a kiegészítő kiegészíti. Csak `http://` és `https://` hivatkozások
  menthetők.
- **Szerkesztés / törlés**: a kártyákon megjelenő gombokkal. Törlésnél
  visszavonási lehetőség jelenik meg; a csoport törlése mindig megerősítést kér.
- **Átrendezés**: a kártyák húzhatók csoportok között, illetve csoporton belül;
  az oldalsávban a csoportok sorrendje is húzással módosítható.
- **Keresés**: a felső keresőmezőben, vagy a `/` illetve `Ctrl/Cmd + K`
  billentyűkombinációval. A keresés a címre, az URL-re és a csoportnevére is
  illeszkedik.
- **Csoport megnyitása**: a csoport nézetében a nyíl ikon egyszerre nyitja meg a
  csoport összes oldalát háttérlapon.

### Megnyitott lapok

Az **Adatkezelés → Megnyitott lapok** fülön:

- kiválasztható a hatókör (aktuális ablak / minden ablak),
- a lapok egyenként kijelölhetők,
- a kijelöltek elmenthetők egy meglévő vagy új csoportba,
- a kijelöltek exportálhatók **JSON**-ba (a kiegészítő vissza tudja importálni)
  vagy **HTML könyvjelzőfájlba** (közvetlenül beolvasható a Chrome-ba).
- A `chrome://` és egyéb belső oldalak nem exportálhatók.

### Importálás

Az **Adatkezelés → Importálás** fülön fájl húzható be vagy választható ki.
Támogatott:

- a kiegészítő saját JSON-mentése,
- a „Megnyitott lapok” JSON-exportja,
- Chrome/Firefox könyvjelző HTML,
- egyszerű URL-listát tartalmazó JSON.

Importálás előtt előnézet mutatja a fájl nevét és a benne lévő csoportok számát.
Választható, hogy a meglévő csoportokhoz **hozzáadja**, vagy azokat **lecserélve**
importálja. Saját JSON-mentés csere módban a beállításokat is visszaállítja.

### Mentés és export

A **Mentés / export** fül a teljes gyűjteményt menti:

- **Gyűjtemény mentése (JSON)** – a csoportokat, a mentett oldalakat és a
  beállításokat tartalmazó fájl, amely az Importálás fülön állítható vissza.
- **Könyvjelzők exportálása (HTML)** – Netscape könyvjelzőfájl, amely a
  Chrome-ba vagy más böngészőbe közvetlenül beolvasható, és a kiegészítő is
  vissza tudja importálni.
- **Importálás / visszaállítás…** – átvált az Importálás fülre.

Ugyanez a JSON-fájl a biztonsági mentés szerepét is betölti, ezért érdemes
rendszeresen lementeni.

#### Haladó: a nyers `collection` érték

A kiegészítő a `chrome.storage.local` tárhelyen a `collection` kulcs alatt
tárolja az adatokat. A nyers érték DevTools konzolból is exportálható. Nyisd meg
a kezdőlapot, majd `F12` → Console:

```js
chrome.storage.local.get('collection').then(({ collection }) => {
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'collection.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
```

A visszatöltéshez a fájl tartalmát egy változóba illesztve:

```js
const data = { /* ide kerül a collection JSON tartalma */ };
chrome.storage.local.set({ collection: data }).then(() => location.reload());
```

A nyers `collection` JSON a beépített Importálás fülön is működik: a `schema`,
`settings` és `groups` mezőket tartalmazó fájlt csere módban beolvassa, és a
beállításokat is visszaállítja. Éles adatoknál mindig készíts előbb mentést.

### Beállítások

- **Megnyitás Chrome indításakor** – lásd fent.
- **Megerősítés törlés előtt** – oldalak törlésénél külön megerősítést kér
  (a visszavonás ettől függetlenül elérhető).
- **Megjelenés** – rendszer szerinti, világos vagy sötét téma.

### Eszköztár-ikon és jobb gombos menü

- Az eszköztár ikonjára kattintva az aktuális lap menthető a kiválasztott
  csoportba, vagy ott helyben új csoport hozható létre.
- Weblapon jobb gombbal kattintva a **Mentés a gyűjteménybe** menüben:
  - **Oldal hozzáadása a gyűjteményhez…** – megnyitja a kezdőlap „Oldal
    hozzáadása” ablakát, és előre kitölti az oldal címével és hivatkozásával.
    Így mentés előtt még szerkeszthető a cím, az URL és a célcsoport.
  - **Csoportnév** – az oldal, a hivatkozás vagy a kijelölt szöveg hivatkozása
    azonnal menthető a választott csoportba.
- A menü követi a csoportok változásait. A Chrome csak egy legfelső szintű
  menüpontot jelenít meg a kiegészítőtől, ezért a hozzáadás és a csoportok is a
  **Mentés a gyűjteménybe** alatt találhatók.

## Adattárolás és engedélyek

Az adatok a `chrome.storage.local` tárhelyen, a `collection` kulcs alatt
találhatók. A kiegészítő nem küld adatot hálózatra, és nem használ távoli
szervert.

| Engedély | Miért kell |
| --- | --- |
| `storage` | A csoportok, oldalak és beállítások helyi tárolása. |
| `tabs` | A megnyitott lapok listázása, mentése és megnyitása. |
| `contextMenus` | A jobb gombos „Mentés a gyűjteménybe” menü. |
| `favicon` | Az oldalak ikonjainak helyi, gyorsítótárazott megjelenítése. |

A `chrome://` oldalak és a Chrome belső felületei biztonsági okból nem
menthetők.

## Fájlszerkezet

```
manifest.json          kiegészítő leírója (Manifest V3)
background.js          háttérszolgáltatás: menük, indítás, jelvény
newtab.html/.css/.js   kezdőlap (fő felület)
popup.html/.css/.js    eszköztár felugró ablak
lib/store.js           adatmodell, normalizálás, tárolás
lib/backup.js          export/import (JSON, könyvjelző HTML)
lib/favicon.js         favicon és betűjel tartalék
lib/theme.css          közös megjelenés
icons/                 16/32/48/128 px ikonok
tests/                 böngészős tesztkészlet (mockolt chrome.* API-kkal)
```

## Tesztek

A tesztkészlet valódi Chrome-ban, de mockolt `chrome.*` API-kkal fut, ezért nem
kell a kiegészítőt telepíteni. Python 3.9+ és Chrome szükséges:

```powershell
python tests\run_tests.py
python tests\run_tests.py --only popup
```

Részletek: [tests/README.md](tests/README.md).

## Tippek

- Rendszeresen készíts biztonsági mentést: a böngésző tárolója a kiegészítő
  eltávolításakor törlődhet.
- A kedvenc oldalak gyors eléréséhez használhatod a csoport megnyitása gombot,
  amely egyszerre több lapot nyit meg.
- A keresőmező a `/` billentyűvel bárhonnan elérhető, így gyorsan szűrhető a
  gyűjtemény.
