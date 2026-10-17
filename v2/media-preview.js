(function () {
  'use strict';
  const MODULE = 'cc-media-previews-v1';
  if (window[MODULE]) return;
  window[MODULE] = true;

  function currentItems() {
    try { return typeof state !== 'undefined' && Array.isArray(state.content) ? state.content : []; }
    catch (_) { return []; }
  }
  function safeImageUrl(value) {
    try {
      const u = new URL(String(value || ''), location.href);
      return u.protocol === 'https:' ? u.href : '';
    } catch (_) { return ''; }
  }
  function getById(id) { return currentItems().find(function (x) { return x.id === id; }); }
  function idFrom(element) {
    const value = (element && element.getAttribute('onclick')) || '';
    const match = /openDrawer\(['"]([a-f0-9-]{36})['"]\)/i.exec(value);
    return match ? match[1] : '';
  }
  function visualMedia(item) {
    if (!item || !Array.isArray(item.media_urls)) return [];
    return item.media_urls.map(safeImageUrl).filter(Boolean).slice(0, 16);
  }
  function gallery(item, mode) {
    const urls = visualMedia(item);
    if (!urls.length) return null;
    const wrapper = document.createElement('section');
    wrapper.className = 'cc-media-block cc-media-block-' + mode;
    wrapper.setAttribute('aria-label', 'Изображения публикации');
    const label = document.createElement('div');
    label.className = 'cc-media-caption';
    const detail = (item.format === 'Reels')
      ? 'Обложка Reels · видео проверяется отдельно'
      : ('Карусель · ' + urls.length + ' изобр.');
    label.textContent = detail + ' · визуал на согласовании';
    wrapper.appendChild(label);
    const strip = document.createElement('div');
    strip.className = 'cc-media-strip';
    urls.forEach(function (url, i) {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.title = 'Открыть изображение ' + (i + 1) + ' в полном размере';
      a.className = 'cc-media-thumb';
      const image = document.createElement('img');
      image.src = url; image.loading = 'lazy'; image.decoding = 'async';
      image.alt = (item.title || 'Материал') + ', визуал ' + (i + 1);
      image.addEventListener('error', function () { a.classList.add('cc-media-broken'); });
      a.appendChild(image);
      const number = document.createElement('span');
      number.className = 'cc-media-index';
      number.textContent = String(i + 1);
      a.appendChild(number);
      strip.appendChild(a);
    });
    wrapper.appendChild(strip);
    return wrapper;
  }
  function mountApprovals() {
    const root = document.getElementById('approvals');
    if (!root) return;
    root.querySelectorAll('.approval-grid .content-list > .content-card').forEach(function (card) {
      if (card.querySelector('.cc-media-block')) return;
      const item = getById(idFrom(card.querySelector('.content-card-head')));
      const strip = gallery(item, 'approval');
      const head = card.querySelector('.content-card-head');
      if (strip && head) head.insertAdjacentElement('afterend', strip);
    });
  }
  function mountDrawer() {
    const root = document.getElementById('drawerBody');
    if (!root || root.querySelector('.cc-media-block-drawer')) return;
    let item = null;
    try { item = getById(typeof state !== 'undefined' ? state.selectedId : ''); } catch (_) {}
    const strip = gallery(item, 'drawer');
    if (!strip) return;
    const header = root.querySelector('.detail-meta');
    if (header) header.insertAdjacentElement('afterend', strip);
    else root.prepend(strip);
  }
  function mountProduction() {
    const root = document.getElementById('production');
    if (!root) return;
    root.querySelectorAll('.task').forEach(function (card) {
      if (card.querySelector('.cc-media-mini')) return;
      const item = getById(idFrom(card));
      const url = visualMedia(item)[0];
      if (!url) return;
      const image = document.createElement('img');
      image.className = 'cc-media-mini';
      image.src = url; image.loading = 'lazy'; image.alt = 'Обложка ' + (item.title || '');
      card.insertBefore(image, card.firstChild);
    });
  }
  let scheduled = false;
  function mount() {
    scheduled = false;
    try { mountApprovals(); mountDrawer(); mountProduction(); }
    catch (error) { console.warn('[Content Center] image preview unavailable', error); }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame ? window.requestAnimationFrame(mount) : Promise.resolve().then(mount);
  }
  function init() {
    ['approvals', 'drawerBody', 'production'].forEach(function (id) {
      const root = document.getElementById(id);
      if (root && window.MutationObserver) {
        new MutationObserver(schedule).observe(root, { childList: true });
      }
    });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();