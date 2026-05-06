/**
 * lazyLoader.js — Infinite-scroll lazy loading.
 *
 * Listens to scroll events on `#tableContainer`. When the user scrolls
 * within `THRESHOLD` pixels of the bottom, requests the next batch of rows
 * from the extension host.
 *
 * A simple debounce prevents flooding the extension with rapid scroll events.
 *
 * Exposes: window.App.LazyLoader
 */
(function () {
  'use strict';

  var THRESHOLD = 250; // px from bottom to trigger load
  var DEBOUNCE_MS = 120;

  var S = window.AppState;
  var _timer = null;

  /**
   * Requests the next batch from the extension if more rows are available
   * and a request is not already in flight.
   */
  function maybeLoadMore() {
    if (S.isLoading || S.loadedOffset >= S.totalLines) return;
    S.isLoading = true;
    _showIndicator();
    window.App.vscode.postMessage({ type: 'loadMore', offset: S.loadedOffset, count: S.batchSize });
  }

  /**
   * Called by app.js when the `moreRows` response arrives.
   * Appends the new rows and re-renders.
   *
   * @param {Array<Record<string, unknown>>} rows
   * @param {string[]} newCols
   * @param {number} offset
   */
  function onMoreRows(rows, newCols, offset) {
    S.isLoading = false;
    _hideIndicator();

    rows.forEach(function (r, i) {
      S.attachMeta(r, offset + i, false);
      S.rawRows[offset + i] = r;
    });

    S.loadedOffset = Math.max(S.loadedOffset, offset + rows.length);

    var changed = false;
    newCols.forEach(function (c) {
      if (S.columnOrder.indexOf(c) === -1) {
        S.columnOrder.push(c);
        changed = true;
      }
    });

    S.rebuildDisplay();

    if (changed) window.App.Renderer.renderTable();
    else window.App.Renderer.renderBody();

    window.App.Renderer.updateStatus();
    window.App.Renderer.updateFilterSelect();
  }

  function _showIndicator() {
    document.getElementById('loadingIndicator').removeAttribute('hidden');
  }

  function _hideIndicator() {
    document.getElementById('loadingIndicator').setAttribute('hidden', '');
  }

  /** Attaches the scroll listener. Called once from app.js after init. */
  function init() {
    var container = document.getElementById('tableContainer');
    container.addEventListener('scroll', function () {
      clearTimeout(_timer);
      _timer = setTimeout(function () {
        var nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - THRESHOLD;
        if (nearBottom) maybeLoadMore();
      }, DEBOUNCE_MS);
    });
  }

  window.App = window.App || {};
  window.App.LazyLoader = {
    init: init,
    onMoreRows: onMoreRows,
    maybeLoadMore: maybeLoadMore
  };
}());
