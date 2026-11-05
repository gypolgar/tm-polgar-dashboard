# Tesztek

Böngészős tesztkészlet a kiegészítőhöz. A tesztek valódi Chrome-ban futnak, de a
`chrome.*` API-kat a [mock.js](mock.js) utánozza, ezért nem kell a kiegészítőt
telepíteni vagy a Chrome-ot `--load-extension` kapcsolóval indítani.

## Követelmények

- Python 3.9 vagy újabb
- Chrome vagy Chromium (a futtató automatikusan megkeresi)

## Futtatás

A projekt gyökeréből:

```powershell
python tests\run_tests.py
```

Csak egy rész:

```powershell
python tests\run_tests.py --only popup
```

Ha a Chrome nem található, add meg kézzel:

```powershell
python tests\run_tests.py --chrome "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Ugyanez környezeti változóval: `CHROME_PATH`.

A futtató a `tests/_build` mappába másolja a kiegészítőt, a mockot és a
tesztforgatókönyveket, helyi HTTP-n kiszolgálja, majd mindegyik teszthez külön
ideiglenes Chrome-profilt indít. A `_build` eldobható, minden futás újraépíti.

## Tesztek

| Teszt | Mit ellenőriz |
| --- | --- |
| `dashboard` | Oldalsáv, csoportok, kártyák, keresés, duplikáció, lapok exportja (JSON/HTML), teljes gyűjtemény mentése, import (JSON, HTML, korábbi azonosítójú mentés, nyers `collection`), beállítások visszaállítása. |
| `background` | Jobb gombos menük felépítése és újraépítése, egy legfelső szintű menü, előre kitöltött hozzáadás, azonnali mentés csoportba, jelvény, indításkori kezdőlap. |
| `popup` | Eszköztár felugró ablak: mentés, új csoport, hibakezelés. |
| `popup-blocked` | `chrome://` oldal esetén a mentés letiltása és a hibaüzenet. |
| `add` | `?add=1&url=…&title=…` paraméterekkel nyitott, előre kitöltött hozzáadás, majd mentés. |

Sikeres futás esetén a kimenet végén ez áll: `Összesen: 99 teszt, mind sikeres.`
Hiba esetén a futtató kiírja a hibás teszt jelentését, és `1`-es kilépési kóddal
tér vissza (CI-hoz is használható).

## A mock korlátai

- A `chrome.storage.local`, `tabs`, `contextMenus`, `action` és `runtime` API-k
  csak a tesztekhez szükséges részt utánozzák.
- A letöltéseket nem írja lemezre: elfogja a `Blob`-ot, így a fájl tartalma
  közvetlenül ellenőrizhető (`window.__blobs`).
- Nincs valódi hálózat, favicon-letöltés vagy Chrome-profil.
- A valódi telepített kiegészítőt (jobb gombos menü, új lap, eszköztár-ikon)
  továbbra is érdemes kézzel is kipróbálni.

## Új teszt hozzáadása

1. Írj egy modult, amely a végén `#test-results` azonosítójú `<pre>` elembe
   írja az összegzést (a meglévő `test-*-driver.js` fájlok mintájára).
2. A [run_tests.py](run_tests.py) `TEST_FILES` listájába vedd fel a fájlt, a
   `build_harnesses()` függvényben pedig készítsd el a harness HTML-t.
3. Vedd fel az új bejegyzést a `SUITES` tuple-be a virtuális időkerettel
   (`budget`) együtt.
