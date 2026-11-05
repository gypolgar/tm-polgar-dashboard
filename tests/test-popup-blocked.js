/* Böngészős teszt: nem menthető (chrome://) oldal (nem része a kiegészítőnek). */

const $ = (selector) => document.querySelector(selector);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
let failures = 0;

function check(condition, label) {
  results.push(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures += 1;
}

try {
  await sleep(500);

  check($('#btnSave').disabled === true, 'mentés gomb letiltva');
  check($('#titleInput').disabled === true, 'cím mező letiltva');
  check($('#error').hidden === false, 'hibaüzenet megjelenik');
  check($('#error').textContent.includes('nem menthető'), 'hibaüzenet szövege');
  check($('#pageHost').textContent === 'chrome://settings/', 'belső oldal megjelenítve');
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
