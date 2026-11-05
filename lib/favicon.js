/** Favicon vagy tartalék betűjel elkészítése egy adott oldalhoz. */

import { PALETTE, faviconUrl, hostOf } from './store.js';

export function initialOf(text) {
  const value = String(text || '').trim();
  if (!value) return '?';
  const letter = value.match(/[a-z0-9áéíóöőúüű]/i);
  return (letter ? letter[0] : value[0]).toUpperCase();
}

export function colorForText(text) {
  let hash = 0;
  const value = String(text || '');
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Visszaad egy `.favicon` elemet: a Chrome helyi favicon-gyorsítótárából
 * próbálja betölteni az ikont, hiba esetén színes kezdőbetűre vált.
 */
export function createFavicon(url, title) {
  const wrap = document.createElement('div');
  wrap.className = 'favicon';

  const fallback = document.createElement('span');
  fallback.className = 'letter';
  fallback.textContent = initialOf(title || hostOf(url));
  fallback.style.background = colorForText(hostOf(url) || url);

  let source = '';
  try {
    source = faviconUrl(url);
  } catch (error) {
    source = '';
  }

  if (!source) {
    wrap.append(fallback);
    return wrap;
  }

  const image = document.createElement('img');
  image.src = source;
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
  wrap.append(image);

  return wrap;
}
