/**
 * toolbar.js — Toolbar actions, filter, stats, row add/delete, selection.
 *
 * Also owns the Save button dirty-state indicator and context menu.
 *
 * Exposes: window.App.Toolbar
 */
(function () {
  'use strict';

  var S = window.AppState;

  // ── Context menu state ────────────────────────────────────────────────────

  var _ctxRowIndex = -1;

  // ── Save ──────────────────────────────────────────────────────────────────

  /**
   * Updates the Save button label with the number of pending changes.
   * Called whenever a pending change is added or removed.
   */
  function markDirty() {
    var btn = document.getElementById('btnSave');
    if (!btn) return;
    var count = S.pendingCount();
    var label = '💾 ' + window.I18n.t('save');
    if (count > 0) label += ' ' + window.I18n.t('unsaved', String(count));
    btn.textContent = label;
    btn.style.opacity = count > 0 ? '1' : '.75';
  }

  /**
   * Flushes any active inline cell edit, then sends all pending changes
   * to the extension host in a single `saveChanges` message.
   */
  function saveAll() {
    window.App.Editor.flushActiveEdit();

    var updates = Object.keys(S.pendingUpdates).map(function (k) {
      return { rowIndex: parseInt(k, 10), rowData: S.stripMeta(S.pendingUpdates[k]) };
    });
    var deletes = Object.keys(S.pendingDeletes)
      .filter(function (k) { return S.pendingDeletes[k]; })
      .map(function (k) { return parseInt(k, 10); });
    var adds = S.pendingAdds.map(function (r) { return S.stripMeta(r); });

    if (updates.length === 0 && deletes.length === 0 && adds.length === 0) return;

    window.App.vscode.postMessage({ type: 'saveChanges', updates: updates, deletes: deletes, adds: adds });
  }

  // ── Add / delete rows ─────────────────────────────────────────────────────

  /**
   * Appends a blank row to the bottom of the table immediately (no save).
   * The row is tracked in `pendingAdds` and only written on Save.
   */
  function addRowDirect() {
    var row = {};
    S.columnOrder.forEach(function (c) { row[c] = ''; });
    S.attachMeta(row, -1, true);
    S.rawRows.push(row);
    S.rebuildDisplay();
    S.pendingAdds.push(row);

    window.App.Renderer.renderBody();
    window.App.Renderer.updateStatus();
    markDirty();

    // Scroll to bottom so the new row is visible
    var tc = document.getElementById('tableContainer');
    tc.scrollTop = tc.scrollHeight;
  }

  /**
   * Marks a row for deletion (deferred — not written until Save).
   * @param {Record<string, unknown>} row
   */
  function deleteRow(row) {
    var displayNo = row.__isNew ? 'N' : String(row.__rowIndex + 1);
    if (!confirm(window.I18n.t('deleteConfirm', displayNo))) return;

    if (row.__isNew) {
      // Remove from pending adds entirely
      S.pendingAdds = S.pendingAdds.filter(function (r) { return r.__tempId !== row.__tempId; });
    } else {
      S.pendingDeletes[String(row.__rowIndex)] = true;
      delete S.pendingUpdates[String(row.__rowIndex)];
    }

    // Remove from in-memory arrays
    var ri = S.rawRows.indexOf(row);
    if (ri !== -1) S.rawRows.splice(ri, 1);
    S.rebuildDisplay();

    window.App.Renderer.renderBody();
    window.App.Renderer.updateStatus();
    markDirty();
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /**
   * Toggles row selection, supporting single-click, Ctrl+click, and Shift+click.
   * @param {string} rowKey
   * @param {boolean} shift
   * @param {boolean} ctrl
   */
  function toggleSelect(rowKey, shift, ctrl) {
    if (!ctrl && !shift) {
      S.selectedRows = {};
      S.selectedRows[rowKey] = true;
    } else if (ctrl) {
      if (S.selectedRows[rowKey]) delete S.selectedRows[rowKey];
      else S.selectedRows[rowKey] = true;
    } else {
      S.selectedRows[rowKey] = true;
    }

    document.querySelectorAll('#tableBody tr').forEach(function (tr) {
      tr.classList.toggle('selected', !!S.selectedRows[tr.dataset.rowKey]);
    });

    window.App.Renderer.updateStatus();
    window.App.Renderer.updateColStats();
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  function toggleFilter() {
    document.getElementById('filterRow').classList.toggle('visible');
  }

  function applyFilter() {
    S.filterCol = document.getElementById('filterCol').value;
    S.filterText = document.getElementById('filterVal').value.toLowerCase();
    S.filterActive = S.filterText.length > 0;
    S.rebuildDisplay();
    window.App.Renderer.renderBody();
    window.App.Renderer.updateStatus();
  }

  function clearFilter() {
    document.getElementById('filterVal').value = '';
    document.getElementById('filterCol').value = '';
    S.filterActive = false;
    S.filterText = '';
    S.filterCol = '';
    S.rebuildDisplay();
    window.App.Renderer.renderBody();
    window.App.Renderer.updateStatus();
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  function toggleStats() {
    var bar = document.getElementById('colStatsBar');
    bar.classList.toggle('visible');
    if (bar.classList.contains('visible')) window.App.Renderer.updateColStats();
  }

  // ── Font controls ─────────────────────────────────────────────────────────

  function setFontSize(size) {
    var n = Math.max(10, Math.min(24, parseInt(String(size), 10) || 12));
    document.documentElement.style.setProperty('--table-font-size', n + 'px');
    document.getElementById('fontSizeInput').value = String(n);
  }

  function setFontFamily(value) {
    document.documentElement.style.setProperty('--table-font-family', value);
  }

  // ── Language toggle ───────────────────────────────────────────────────────

  function toggleLanguage() {
    var next = window.I18n.getLang() === 'en' ? 'zh' : 'en';
    window.I18n.setLanguage(next);
    applyI18n();
    markDirty();
  }

  /** Re-applies all translatable strings in the toolbar and status bar. */
  function applyI18n() {
    var t = window.I18n.t;
    var lang = window.I18n.getLang();

    window.I18n.applyToDOM();

    document.getElementById('btnLang').textContent = '🌐 ' + (lang === 'zh' ? '中文' : 'EN');
    document.getElementById('filterVal').placeholder = t('filterPlaceholder');
    document.getElementById('loadingIndicator').querySelector('[data-i18n]').textContent = t('loadingMore');

    markDirty(); // re-render save button label in current language
    window.App.Renderer.updateStatus();
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  function setCtxRow(index) {
    _ctxRowIndex = index;
  }

  function showContextMenu(x, y) {
    var menu = document.getElementById('contextMenu');
    menu.classList.add('visible');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Boundary correction
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
  }

  function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('visible');
  }

  function handleCtxAction(action) {
    hideContextMenu();
    var ri = _ctxRowIndex;
    var row = S.rawRows[ri];
    if (!row) return;

    if (action === 'preview') {
      window.App.Modals.openPreview(ri);
    } else if (action === 'edit') {
      window.App.Editor.openEditModal(ri);
    } else if (action === 'copy') {
      var text = JSON.stringify(S.stripMeta(row), null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    } else if (action === 'delete') {
      deleteRow(row);
    }
  }

  // ── Misc toolbar ─────────────────────────────────────────────────────────

  function openInEditor() {
    window.App.vscode.postMessage({ type: 'openInEditor' });
  }

  function requestRefresh() {
    S.reset();
    window.App.Renderer.renderTable();
    window.App.vscode.postMessage({ type: 'loadMore', offset: 0, count: 100 });
  }

  function exportData(format) {
    window.App.vscode.postMessage({
      type: 'exportData',
      format: format,
      data: S.rawRows.filter(Boolean).map(function (r) { return S.stripMeta(r); })
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.App = window.App || {};
  window.App.Toolbar = {
    markDirty: markDirty,
    saveAll: saveAll,
    addRowDirect: addRowDirect,
    deleteRow: deleteRow,
    toggleSelect: toggleSelect,
    toggleFilter: toggleFilter,
    applyFilter: applyFilter,
    clearFilter: clearFilter,
    toggleStats: toggleStats,
    setFontSize: setFontSize,
    setFontFamily: setFontFamily,
    toggleLanguage: toggleLanguage,
    applyI18n: applyI18n,
    setCtxRow: setCtxRow,
    showContextMenu: showContextMenu,
    hideContextMenu: hideContextMenu,
    handleCtxAction: handleCtxAction,
    openInEditor: openInEditor,
    requestRefresh: requestRefresh,
    exportData: exportData
  };
}());
