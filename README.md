# TM Polgar Dashboard – Kezdőlap

[![Tesztek](https://github.com/gypolgar/tm-polgar-dashboard/actions/workflows/tests.yml/badge.svg)](https://github.com/gypolgar/tm-polgar-dashboard/actions/workflows/tests.yml)

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

## Google Drive szinkron

A gyűjtemény ugyanabban a Chrome-profilban, több gépen is ugyanaz marad: a
kiegészítő a `collection` értéket a Google Drive rejtett,
alkalmazásspecifikus mappájába (`appDataFolder`) menti `collection.json` néven.
A fájl nem jelenik meg a sima Drive-listában, de ugyanahhoz a Google-fiókhoz
bejelentkezett gépek elérik.

A szinkron automatikusan lefut:

- minden helyi változás után 5 másodperccel,
- 15 percenként,
- a háttérszolgáltatás indításakor,
- és kézzel az **Adatkezelés → Drive-szinkron** fülön.

Ütközés esetén az újabb verzió nyer. A kézi fülön a **Letöltés Drive-ról** és
**Feltöltés Drive-ba** gombokkal bármelyik irány kényszeríthető, és itt látható
az utolsó szinkron ideje is.

### Beállítás

1. A `manifest.json`-ben szereplő `key` rögzíti a kiegészítő azonosítóját, hogy
   az minden gépen ugyanaz legyen: `lijgfomocjgpopdohhdlhldfcbckbmnd`.
   **Fontos:** ha a kiegészítőt most töltöd át ezzel a manifesttel, a régi
   azonosító alatt tárolt gyűjtemény nem látszik. Előbb az **Adatkezelés →
   Mentés / export** fülön exportáld a JSON-mentést, majd az új azonosítón
   importáld vissza („Csere” módban).
2. Nyisd meg a [Google Cloud Console](https://console.cloud.google.com/) oldalt,
   és hozz létre egy projektet.
3. Engedélyezd a **Google Drive API**-t: *APIs & Services → Library →
   Google Drive API → Enable*.
4. Állítsd be a hozzájárulási képernyőt (*OAuth consent screen*): válassz
   **External** típust, és add hozzá a saját e-mail-címedet a **Test users**
   listához. A szükséges scope
   (`https://www.googleapis.com/auth/drive.appdata`) már szerepel a
   `manifest.json`-ben.
5. Hozz létre OAuth klienst: *APIs & Services → Credentials → Create Credentials
   → OAuth client ID*. Application type: **Chrome extension**.
   - Application ID: `lijgfomocjgpopdohhdlhldfcbckbmnd`
   - Az átirányítási URL: `https://lijgfomocjgpopdohhdlhldfcbckbmnd.chromiumapp.org/`
6. Másold a kapott kliens azonosítót (`…apps.googleusercontent.com`) a
   `manifest.json` `oauth2.client_id` mezőjébe, a `REPLACE_ME…` helyére.
7. A `chrome://extensions` oldalon töltsd újra a kiegészítőt.
8. Nyisd meg az **Adatkezelés → Drive-szinkron** fület, és kattints a
   **Szinkronizálás most** gombra – ilyenkor kér először bejelentkezést a Google.

A kliens azonosító és a manifest `key` mezője nyilvános adat; a hozzá tartozó
magánkulcs nem kerül be a repóba.

### Másik gépen

1. Klónozd a repót: `git clone https://github.com/gypolgar/tm-polgar-dashboard.git`.
2. Használd ugyanaz a `manifest.json`-t (a kliens azonosítóval), így az
   extension ID is ugyanaz marad.
3. Töltsd be kicsomagolt kiegészítőként, és jelentkezz be ugyanazzal a
   Google-fiókkal.
4. Az **Adatkezelés → Drive-szinkron → Letöltés Drive-ról** gombbal hozd le az
   adatokat. Indításkor az automatikus szinkron is megteszi ezt.

## Adattárolás és engedélyek

Az adatok a `chrome.storage.local` tárhelyen, a `collection` kulcs alatt
találhatók. Google Drive szinkron nélkül a kiegészítő nem küld adatot hálózatra;
a szinkron bekapcsolása után a gyűjtemény csak a saját Drive-fiókod rejtett
mappájába kerül.

| Engedély | Miért kell |
| --- | --- |
| `storage` | A csoportok, oldalak és beállítások helyi tárolása. |
| `tabs` | A megnyitott lapok listázása, mentése és megnyitása. |
| `contextMenus` | A jobb gombos „Mentés a gyűjteménybe” menü. |
| `favicon` | Az oldalak ikonjainak helyi, gyorsítótárazott megjelenítése. |
| `identity` | Bejelentkezés a Google-fiókba a Drive-szinkronhoz. |
| `alarms` | A szinkron 15 perces ütemezése. |

A Drive API eléréséhez a `oauth2.scopes` mező a
`https://www.googleapis.com/auth/drive.appdata` jogosultságot kéri.

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
lib/drive.js           Google Drive szinkron (appDataFolder, ütközéskezelés)
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

Minden `main` ágra történő push-nál (és pull requestnél) a tesztek automatikusan
lefutnak a GitHub Actions-ben is: [Tesztek workflow](https://github.com/gypolgar/tm-polgar-dashboard/actions/workflows/tests.yml).

## Tippek

- Rendszeresen készíts biztonsági mentést: a böngésző tárolója a kiegészítő
  eltávolításakor törlődhet.
- A kedvenc oldalak gyors eléréséhez használhatod a csoport megnyitása gombot,
  amely egyszerre több lapot nyit meg.
- A keresőmező a `/` billentyűvel bárhonnan elérhető, így gyorsan szűrhető a
  gyűjtemény.
