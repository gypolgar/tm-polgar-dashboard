/* Chrome API-k utánozása a böngészős teszteléshez (nem része a kiegészítőnek). */
(function () {
  'use strict';

  window.__errors = [];
  window.__createdTabs = [];
  window.__downloads = [];
  window.__blobs = {};
  window.__closed = false;
  window.close = function () { window.__closed = true; };

  window.addEventListener('error', function (event) {
    window.__errors.push('Error: ' + event.message + ' @ ' + event.filename + ':' + event.lineno);
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    window.__errors.push('Unhandled: ' + (reason && reason.stack ? reason.stack : String(reason)));
  });

  var nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) {
      window.__downloads.push({ name: this.download, href: this.href });
      return;
    }
    return nativeAnchorClick.call(this);
  };

  var nativeCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    var url = nativeCreateObjectURL.call(URL, blob);
    window.__blobs[url] = blob;
    return url;
  };

  var seed = {
    schema: 1,
    settings: { openOnStartup: true, confirmDelete: false, theme: 'system' },
    groups: [
      {
        id: 'g-fav',
        name: 'Kedvencek',
        color: '#6366f1',
        createdAt: 1,
        items: [
          { id: 'i-1', url: 'https://www.google.com/', title: 'Google', createdAt: 1 },
          { id: 'i-2', url: 'https://hu.wikipedia.org/wiki/Kezd%C5%91lap', title: 'Wikipédia', createdAt: 2 }
        ]
      },
      {
        id: 'g-work',
        name: 'Munka',
        color: '#0ea5e9',
        createdAt: 2,
        items: [
          { id: 'i-3', url: 'https://github.com/', title: 'GitHub', createdAt: 3 },
          { id: 'i-4', url: 'https://developer.mozilla.org/', title: 'MDN', createdAt: 4 }
        ]
      },
      {
        id: 'g-read',
        name: 'Olvasás',
        color: '#22c55e',
        createdAt: 3,
        items: [
          { id: 'i-5', url: 'https://news.ycombinator.com/', title: 'Hacker News', createdAt: 5 }
        ]
      }
    ]
  };

  var store = { collection: seed };
  var listeners = [];

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  window.__MOCK_TABS = [
    { id: 1, url: 'https://example.org/egy', title: 'Első lap' },
    { id: 2, url: 'https://example.org/kettő', title: 'Második lap' },
    { id: 3, url: 'https://example.org/harom', title: 'Harmadik lap' },
    { id: 4, url: 'chrome://settings/', title: 'Beállítások' }
  ];

  var installedListeners = [];
  var startupListeners = [];
  var menuClickListeners = [];

  window.__menus = [];
  window.__badges = [];

  window.__fireInstalled = function (details) {
    return Promise.all(installedListeners.map(function (listener) { return listener(details); }));
  };
  window.__fireStartup = function () {
    return Promise.all(startupListeners.map(function (listener) { return listener(); }));
  };
  window.__fireMenuClick = function (info, tab) {
    return Promise.all(menuClickListeners.map(function (listener) { return listener(info, tab); }));
  };

  window.chrome = {
    runtime: {
      id: 'mockextensionid',
      getURL: function (path) {
        return 'chrome-extension://mockextensionid/' + String(path || '').replace(/^\/+/, '');
      },
      getManifest: function () { return { version: '1.0.0' }; },
      onInstalled: {
        addListener: function (listener) { installedListeners.push(listener); }
      },
      onStartup: {
        addListener: function (listener) { startupListeners.push(listener); }
      }
    },
    storage: {
      local: {
        get: function (key) {
          if (typeof key === 'string') {
            var result = {};
            if (Object.prototype.hasOwnProperty.call(store, key)) result[key] = clone(store[key]);
            return Promise.resolve(result);
          }
          return Promise.resolve(clone(store));
        },
        set: function (values) {
          var changes = {};
          Object.keys(values).forEach(function (key) {
            store[key] = clone(values[key]);
            changes[key] = { newValue: clone(values[key]) };
          });
          return Promise.resolve().then(function () {
            listeners.forEach(function (listener) {
              listener(changes, 'local');
            });
          });
        },
        remove: function (key) {
          delete store[key];
          return Promise.resolve();
        },
        clear: function () {
          store = {};
          return Promise.resolve();
        }
      },
      onChanged: {
        addListener: function (listener) { listeners.push(listener); },
        removeListener: function (listener) {
          listeners = listeners.filter(function (entry) { return entry !== listener; });
        }
      }
    },
    tabs: {
      create: function (options) {
        window.__createdTabs.push(options && options.url);
        return Promise.resolve({ id: 99, url: options && options.url });
      },
      query: function (queryInfo) {
        var tabs = window.__MOCK_TABS.slice();
        if (queryInfo && queryInfo.url) {
          var prefix = String(queryInfo.url).replace(/\*$/, '');
          tabs = tabs.filter(function (tab) {
            return String(tab.url || '').indexOf(prefix) === 0;
          });
        }
        return Promise.resolve(tabs);
      }
    },
    action: {
      setBadgeText: function (options) {
        window.__badges.push(options && options.text);
        return Promise.resolve();
      },
      setBadgeBackgroundColor: function () { return Promise.resolve(); }
    },
    contextMenus: {
      removeAll: function () {
        window.__menus = [];
        return Promise.resolve();
      },
      create: function (options) { window.__menus.push(options); },
      onClicked: {
        addListener: function (listener) { menuClickListeners.push(listener); }
      }
    }
  };
})();
