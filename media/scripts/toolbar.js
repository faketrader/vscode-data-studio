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

  var _ctxRow = null;

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
    updateHistoryButtons();
  }

  /** Updates Undo/Redo button disabled and accessible state from AppState. */
  function updateHistoryButtons() {
    _setHistoryButton('btnUndo', S.canUndo());
    _setHistoryButton('btnRedo', S.canRedo());
  }

  function _setHistoryButton(id, enabled) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
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
    var adds = S.pendingAdds.map(function (r) {
      return {
        rowData: S.stripMeta(r),
        insertAt: r.__insertAt == null ? null : Number(r.__insertAt)
      };
    });

    if (updates.length === 0 && deletes.length === 0 && adds.length === 0) return;

    window.App.vscode.postMessage({ type: 'saveChanges', updates: updates, deletes: deletes, adds: adds });
  }

  // ── Add / delete rows ─────────────────────────────────────────────────────

  /**
   * Appends a blank row to the bottom of the table immediately (no save).
   * The row is tracked in `pendingAdds` and only written on Save.
   */
  function addRowDirect() {
    addRowsAt(null, 1);

    // Scroll to bottom so the new row is visible
    var tc = document.getElementById('tableContainer');
    tc.scrollTop = tc.scrollHeight;
  }

  function createBlankRow(insertAt) {
    var row = {};
    S.columnOrder.forEach(function (c) { row[c] = ''; });
    S.attachMeta(row, -1, true);
    row.__insertAt = insertAt == null ? null : Number(insertAt);
    return row;
  }

  function addRowsAt(insertAt, count) {
    var n = Math.max(1, Math.min(500, parseInt(String(count), 10) || 1));
    S.pushHistory();

    for (var i = 0; i < n; i++) {
      var row = createBlankRow(insertAt == null ? null : Number(insertAt) + (i / 1000));
      S.rawRows.push(row);
      S.pendingAdds.push(row);
    }

    S.rebuildDisplay();
    window.App.Renderer.renderTable();
    window.App.Renderer.updateStatus();
    markDirty();
  }

  function promptRowCount() {
    var text = prompt(window.I18n.t('insertCountPrompt'), '1');
    if (text == null) return 0;
    var n = parseInt(text, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function insertRowsAround(row, direction) {
    if (!row) return;
    var count = promptRowCount();
    if (!count) return;

    if (row.__isNew && row.__insertAt != null) {
      var newAnchor = Number(row.__insertAt);
      addRowsAt(direction === 'above' ? newAnchor - 0.001 : newAnchor + 0.001, count);
      return;
    }

    var anchor = Number(row.__rowIndex) * 2;
    addRowsAt(direction === 'above' ? anchor - 1 : anchor + 1, count);
  }

  /**
   * Marks a row for deletion (deferred — not written until Save).
   * @param {Record<string, unknown>} row
   */
  function deleteRow(row) {
    var displayNo = row.__isNew ? 'N' : String(row.__rowIndex + 1);
    if (!confirm(window.I18n.t('deleteConfirm', displayNo))) return;

    S.pushHistory();

    if (row.__isNew) {
      // Remove from pending adds entirely
      S.pendingAdds = S.pendingAdds.filter(function (r) { return r.__tempId !== row.__tempId; });
      var idx = S.rawRows.indexOf(row);
      if (idx !== -1) S.rawRows.splice(idx, 1);
    } else {
      S.pendingDeletes[String(row.__rowIndex)] = true;
      delete S.pendingUpdates[String(row.__rowIndex)];
      // Keep original row-index mapping stable for pending deletes/updates.
      S.rawRows[row.__rowIndex] = null;
    }

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

  function setLanguage(lang) {
    window.I18n.setLanguage(lang);
    applyI18n();
    markDirty();
  }

  /** Re-applies all translatable strings in the toolbar and status bar. */
  function applyI18n() {
    var t = window.I18n.t;
    var lang = window.I18n.getLang();

    window.I18n.applyToDOM();

    var langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.value = lang;
    document.getElementById('filterVal').placeholder = t('filterPlaceholder');
    document.getElementById('loadingIndicator').querySelector('[data-i18n]').textContent = t('loadingMore');

    markDirty(); // re-render save button label in current language
    updateHistoryButtons();
    window.App.Renderer.updateStatus();
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  function setCtxRow(row) {
    _ctxRow = row || null;
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

  function showExportMenu(anchor) {
    if (!anchor) return;
    var menu = document.getElementById('exportMenu');
    var rect = anchor.getBoundingClientRect();
    menu.classList.add('visible');
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';

    var menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) menu.style.left = (rect.right - menuRect.width) + 'px';
    if (menuRect.bottom > window.innerHeight) menu.style.top = (rect.top - menuRect.height - 4) + 'px';
  }

  function hideExportMenu() {
    var menu = document.getElementById('exportMenu');
    if (menu) menu.classList.remove('visible');
  }

  function handleExportAction(format) {
    hideExportMenu();
    exportData(format === 'csv' ? 'csv' : 'jsonl');
  }

  function handleCtxAction(action) {
    hideContextMenu();
    var row = _ctxRow;
    if (!row) return;

    var ri = S.rawRows.indexOf(row);
    if (ri < 0) return;

    if (action === 'insertAbove') {
      insertRowsAround(row, 'above');
    } else if (action === 'insertBelow') {
      insertRowsAround(row, 'below');
    } else if (action === 'preview') {
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

  function _rerenderAfterHistoryChange() {
    S.rebuildDisplay();
    window.App.Renderer.renderTable();
    window.App.Renderer.updateStatus();
    window.App.Renderer.updateFilterSelect();
    window.App.Renderer.updateColStats();
    markDirty();
  }

  function undo() {
    window.App.Editor.flushActiveEdit();
    if (!S.undo()) return;
    _rerenderAfterHistoryChange();
  }

  function redo() {
    window.App.Editor.flushActiveEdit();
    if (!S.redo()) return;
    _rerenderAfterHistoryChange();
  }

  // ── Misc toolbar ─────────────────────────────────────────────────────────

  function openInEditor() {
    window.App.vscode.postMessage({ type: 'openInEditor' });
  }

  function requestRefresh() {
    S.reset();
    window.App.Renderer.renderTable();
    updateHistoryButtons();
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
    updateHistoryButtons: updateHistoryButtons,
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
    setLanguage: setLanguage,
    applyI18n: applyI18n,
    setCtxRow: setCtxRow,
    showContextMenu: showContextMenu,
    hideContextMenu: hideContextMenu,
    showExportMenu: showExportMenu,
    hideExportMenu: hideExportMenu,
    handleExportAction: handleExportAction,
    handleCtxAction: handleCtxAction,
    undo: undo,
    redo: redo,
    openInEditor: openInEditor,
    requestRefresh: requestRefresh,
    exportData: exportData
  };
}());
