#!/usr/bin/env python3
"""A TM Polgar Dashboard böngészős tesztkészletének futtatója.

A tesztek valódi Chrome-ban futnak, a chrome.* API-kat viszont a tests/mock.js
utánozza, ezért nem kell a kiegészítőt telepíteni. A futtató ideiglenes
tests/_build mappába másolja a kiegészítő fájljait, helyi HTTP-n kiszolgálja,
majd headless Chrome-mal megnyitja a tesztharnesseket.

Használat:
    python tests/run_tests.py
    python tests/run_tests.py --only popup
    python tests/run_tests.py --chrome "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
"""

from __future__ import annotations

import argparse
import html
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
ROOT = TESTS_DIR.parent
BUILD_DIR = TESTS_DIR / "_build"

RUNTIME_FILES = (
    "manifest.json",
    "background.js",
    "newtab.html",
    "newtab.css",
    "newtab.js",
    "popup.html",
    "popup.css",
    "popup.js",
)
RUNTIME_DIRS = ("lib", "icons")

TEST_FILES = (
    "mock.js",
    "test-driver.js",
    "test-background-driver.js",
    "test-add-driver.js",
    "test-popup-driver.js",
    "test-popup-blocked.js",
)

NEWTAB_MARKER = '<script type="module" src="newtab.js"></script>'
POPUP_MARKER = '<script type="module" src="popup.js"></script>'

ADD_QUERY = "?" + urllib.parse.urlencode(
    {
        "add": "1",
        "url": "https://pelda.hu/cikk",
        "title": "Példa cikk címe",
    }
)

SUITES = (
    {
        "key": "dashboard",
        "title": "kezdőlap, export és import",
        "page": "test-harness.html",
        "budget": 35000,
    },
    {
        "key": "background",
        "title": "háttérszolgáltatás és jobb gombos menük",
        "page": "test-background.html",
        "budget": 40000,
    },
    {
        "key": "popup",
        "title": "eszköztár felugró ablak",
        "page": "test-popup.html",
        "budget": 20000,
    },
    {
        "key": "popup-blocked",
        "title": "nem menthető (chrome://) oldal",
        "page": "test-popup-blocked.html",
        "budget": 15000,
    },
    {
        "key": "add",
        "title": "előre kitöltött hozzáadás",
        "page": "test-add.html" + ADD_QUERY,
        "budget": 15000,
    },
)


def inject(source: str, marker: str, module: str, driver: str) -> str:
    """A gyártási HTML-be szúrja a mockot és a tesztforgatókönyvet."""
    if marker not in source:
        raise SystemExit(f"Nem találom a belépési pontot: {marker}")
    block = (
        '<script src="mock.js"></script>\n'
        f'  <script type="module" src="{module}"></script>\n'
        f'  <script type="module" src="{driver}"></script>'
    )
    return source.replace(marker, block, 1)


def build_harnesses() -> None:
    """Friss _build mappa a kiegészítőből, a mockból és a tesztekből."""
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR, ignore_errors=True)
    BUILD_DIR.mkdir(parents=True)

    for name in RUNTIME_FILES:
        shutil.copy2(ROOT / name, BUILD_DIR / name)
    for name in RUNTIME_DIRS:
        shutil.copytree(ROOT / name, BUILD_DIR / name)
    for name in TEST_FILES:
        shutil.copy2(TESTS_DIR / name, BUILD_DIR / name)

    newtab = (ROOT / "newtab.html").read_text(encoding="utf-8")
    popup = (ROOT / "popup.html").read_text(encoding="utf-8")

    harnesses = {
        "test-harness.html": inject(newtab, NEWTAB_MARKER, "newtab.js", "test-driver.js"),
        "test-add.html": inject(newtab, NEWTAB_MARKER, "newtab.js", "test-add-driver.js"),
        "test-popup.html": inject(popup, POPUP_MARKER, "popup.js", "test-popup-driver.js"),
        "test-popup-blocked.html": popup.replace(
            POPUP_MARKER,
            '<script src="mock.js"></script>\n'
            '  <script>window.__MOCK_TABS[0] = '
            '{ id: 9, url: "chrome://settings/", title: "Beállítások" };</script>\n'
            '  <script type="module" src="popup.js"></script>\n'
            '  <script type="module" src="test-popup-blocked.js"></script>',
            1,
        ),
        "test-background.html": (
            "<!DOCTYPE html>\n"
            '<html lang="hu">\n'
            "<head>\n"
            '  <meta charset="utf-8">\n'
            "  <title>Háttér teszt</title>\n"
            "</head>\n"
            "<body>\n"
            '  <script src="mock.js"></script>\n'
            '  <script type="module" src="background.js"></script>\n'
            '  <script type="module" src="test-background-driver.js"></script>\n'
            "</body>\n"
            "</html>\n"
        ),
    }

    for name, content in harnesses.items():
        (BUILD_DIR / name).write_text(content, encoding="utf-8")


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class Server:
    """Egyszerű helyi HTTP-kiszolgáló a _build mappához."""

    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self.port = free_port()
        self.process: subprocess.Popen | None = None

    def start(self) -> None:
        self.process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "http.server",
                str(self.port),
                "--bind",
                "127.0.0.1",
                "--directory",
                str(self.directory),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", self.port), timeout=0.5):
                    return
            except OSError:
                if self.process.poll() is not None:
                    raise SystemExit("A helyi HTTP-kiszolgáló nem indult el.")
                time.sleep(0.1)
        raise SystemExit("A helyi HTTP-kiszolgáló nem válaszolt 10 másodpercen belül.")

    def stop(self) -> None:
        if not self.process or self.process.poll() is not None:
            return
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()

    def url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}/{path}"


def find_chrome(explicit: str | None) -> str:
    if explicit:
        path = Path(explicit)
        if path.is_file():
            return str(path)
        raise SystemExit(f"Nem találom a Chrome-ot: {explicit}")

    env_path = os.environ.get("CHROME_PATH")
    if env_path and Path(env_path).is_file():
        return env_path

    candidates: list[str] = []
    if sys.platform.startswith("win"):
        local = os.environ.get("LOCALAPPDATA", "")
        candidates += [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.join(local, r"Google\Chrome\Application\chrome.exe"),
        ]
    elif sys.platform == "darwin":
        candidates.append(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        )
    else:
        for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
            found = shutil.which(name)
            if found:
                candidates.append(found)

    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate

    found = shutil.which("chrome") or shutil.which("google-chrome")
    if found:
        return found

    raise SystemExit(
        "Nem találom a Chrome-ot. Add meg a --chrome kapcsolóval, "
        "vagy állítsd be a CHROME_PATH környezeti változót."
    )


def parse_report(output: str) -> tuple[bool, str, int, int]:
    match = re.search(r'<pre id="test-results">(.*?)</pre>', output, re.DOTALL)
    if not match:
        return False, "", 0, 0

    report = html.unescape(match.group(1)).strip()
    passed = len(re.findall(r"(?m)^\s*✓", report))
    failed = len(re.findall(r"(?m)^\s*✗", report))
    ok = report.startswith("EREDMÉNY: MINDEN TESZT SIKERES")
    return ok, report, passed, failed


def run_suite(chrome: str, server: Server, suite: dict) -> tuple[bool, str, int, int]:
    profile = Path(tempfile.mkdtemp(prefix="tm-polgar-dashboard-test-"))
    url = server.url(suite["page"])
    command = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-background-networking",
        f"--user-data-dir={profile}",
        f"--virtual-time-budget={suite['budget']}",
        "--dump-dom",
        url,
    ]

    try:
        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=suite["budget"] / 1000 + 60,
        )
    except subprocess.TimeoutExpired:
        return False, "időtúllépés a Chrome indításakor", 0, 0
    finally:
        shutil.rmtree(profile, ignore_errors=True)

    output = completed.stdout.decode("utf-8", errors="replace")
    return parse_report(output)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="A TM Polgar Dashboard böngészős tesztjeinek futtatása."
    )
    parser.add_argument(
        "--chrome",
        help="A Chrome futtatható fájlja (alapból automatikus keresés).",
    )
    parser.add_argument(
        "--only",
        help="Csak a megadott részt futtatja (pl. dashboard, popup, add).",
    )
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    chrome = find_chrome(args.chrome)
    build_harnesses()

    suites = list(SUITES)
    if args.only:
        needle = args.only.lower()
        suites = [
            suite
            for suite in suites
            if needle in suite["key"] or needle in suite["title"].lower()
        ]
        if not suites:
            raise SystemExit(f"Nincs ilyen teszt: {args.only}")

    server = Server(BUILD_DIR)
    server.start()

    print("TM Polgar Dashboard tesztkészlet")
    print(f"Chrome: {chrome}")
    print(f"Szerver: {server.url('')} (tests/_build)")
    print()

    total_passed = 0
    total_failed = 0
    failed_suites: list[str] = []

    try:
        for suite in suites:
            ok, report, passed, failed = run_suite(chrome, server, suite)
            total_passed += passed
            total_failed += failed

            status = "SIKERES" if ok else "HIBA"
            print(f"▶ {suite['title']} ... {status} ({passed}/{passed + failed})")

            if not ok:
                failed_suites.append(suite["key"])
                if report:
                    for line in report.splitlines():
                        print(f"    {line}")
                else:
                    print("    Nincs tesztösszegzés – a tesztoldal nem futott le.")
                print()
    finally:
        server.stop()

    print()
    if failed_suites:
        print(f"Összesen: {total_passed} sikeres, {total_failed} hiba")
        print("Hibás tesztek: " + ", ".join(failed_suites))
        return 1

    print(f"Összesen: {total_passed} teszt, mind sikeres.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
