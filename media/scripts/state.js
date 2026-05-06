/**
 * state.js — Application state container.
 *
 * Single source of truth for all mutable UI state.
 * No rendering logic lives here — pure data management.
 *
 * Exposes: window.AppState
 */
(function () {
  'use strict';

  // ── Raw data ──────────────────────────────────────────────────────────────

  /** @type {Array<Record<string, unknown> | null>} Sparse array; index = original row index. */
  var rawRows = [];
  /** @type {Array<Record<string, unknown>>} Rows visible after filter + sort. */
  var displayRows = [];
  /** @type {string[]} Column keys in display order. */
  var columnOrder = [];

  // ── Pagination ────────────────────────────────────────────────────────────

  var totalLines = 0;
  var loadedOffset = 0;
  var batchSize = 50;
  var isLoading = false;

  // ── Filter ────────────────────────────────────────────────────────────────

  var filterActive = false;
  var filterCol = '';
  var filterText = '';

  // ── Sort ──────────────────────────────────────────────────────────────────

  var sortCol = '';
  var sortDir = 1; // 1 = asc, -1 = desc

  // ── Selection ────────────────────────────────────────────────────────────

  /** @type {Record<string, boolean>} rowKey → selected flag */
  var selectedRows = {};

  // ── Display settings ──────────────────────────────────────────────────────

  /** @type {Record<string, number>} col name → pixel width */
  var columnWidths = {};
  /** @type {Record<string, boolean>} col name → user-resized flag */
  var manualColumnWidths = {};

  // ── Pending changes (not yet saved to disk) ───────────────────────────────

  /** @type {Record<string, Record<string, unknown>>} originalRowIndex → updated row */
  var pendingUpdates = {};
  /** @type {Record<string, boolean>} originalRowIndex → delete flag */
  var pendingDeletes = {};
  /** @type {Array<Record<string, unknown>>} new rows to append */
  var pendingAdds = [];

  // ── Undo / redo history ──────────────────────────────────────────────────

  var HISTORY_LIMIT = 100;
  var undoStack = [];
  var redoStack = [];

  // ── Row metadata ──────────────────────────────────────────────────────────

  var _nextId = 1;

  /**
   * Attaches non-enumerable metadata to a row object.
   * Metadata is stripped before the row is sent to the extension host.
   *
   * @param {Record<string, unknown>} row
   * @param {number} rowIndex  Original file line index (-1 for new rows).
   * @param {boolean} isNew
   * @returns {Record<string, unknown>} The same row, mutated.
   */
  function attachMeta(row, rowIndex, isNew) {
    Object.defineProperties(row, {
      __rowIndex: { value: rowIndex, writable: true, enumerable: false, configurable: true },
      __isNew:    { value: !!isNew,  writable: true, enumerable: false, configurable: true },
      __tempId:   { value: isNew ? 'tmp-' + (_nextId++) : '', writable: true, enumerable: false, configurable: true },
      __localId:  { value: 'loc-' + (_nextId++),              writable: true, enumerable: false, configurable: true },
      __insertAt: { value: null, writable: true, enumerable: false, configurable: true }
    });
    return row;
  }

  /**
   * Returns a plain copy of a row with metadata properties removed.
   * Use before serializing rows for the `saveChanges` message.
   * @param {Record<string, unknown>} row
   * @returns {Record<string, unknown>}
   */
  function stripMeta(row) {
    var out = {};
    var keys = Object.keys(row); // enumerable only — skips __xxx metadata
    for (var i = 0; i < keys.length; i++) out[keys[i]] = row[keys[i]];
    return out;
  }

  /** Number of changes waiting to be saved. */
  function pendingCount() {
    return Object.keys(pendingUpdates).length +
           Object.keys(pendingDeletes).length +
           pendingAdds.length;
  }

  /** Clears all pending change queues after a successful save. */
  function resetPending() {
    pendingUpdates = {};
    pendingDeletes = {};
    pendingAdds = [];
  }

  function _deepCloneValue(v) {
    if (v == null) return v;
    if (typeof v !== 'object') return v;
    if (typeof structuredClone === 'function') return structuredClone(v);
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (_) {
      return v;
    }
  }

  function _serializeRow(row) {
    if (!row) return null;
    var data = {};
    var keys = Object.keys(row);
    for (var i = 0; i < keys.length; i++) data[keys[i]] = _deepCloneValue(row[keys[i]]);
    return {
      data: data,
      meta: {
        rowIndex: row.__rowIndex,
        isNew: !!row.__isNew,
        tempId: row.__tempId || '',
        localId: row.__localId || '',
        insertAt: row.__insertAt == null ? null : Number(row.__insertAt)
      }
    };
  }

  function _deserializeRow(saved) {
    if (!saved) return null;
    var row = saved.data || {};
    Object.defineProperties(row, {
      __rowIndex: { value: saved.meta.rowIndex, writable: true, enumerable: false, configurable: true },
      __isNew:    { value: !!saved.meta.isNew, writable: true, enumerable: false, configurable: true },
      __tempId:   { value: saved.meta.tempId || '', writable: true, enumerable: false, configurable: true },
      __localId:  { value: saved.meta.localId || ('loc-' + (_nextId++)), writable: true, enumerable: false, configurable: true },
      __insertAt: { value: saved.meta.insertAt == null ? null : Number(saved.meta.insertAt), writable: true, enumerable: false, configurable: true }
    });
    return row;
  }

  function _rowKey(row) {
    return row.__isNew ? row.__tempId : String(row.__rowIndex);
  }

  function _captureSnapshot() {
    var serializedRows = rawRows.map(function (r) { return _serializeRow(r); });
    return {
      rawRows: serializedRows,
      displayRows: displayRows.map(function (r) { return r ? _rowKey(r) : ''; }).filter(Boolean),
      columnOrder: columnOrder.slice(),
      columnWidths: Object.assign({}, columnWidths),
      manualColumnWidths: Object.assign({}, manualColumnWidths),
      totalLines: totalLines,
      loadedOffset: loadedOffset,
      batchSize: batchSize,
      isLoading: isLoading,
      filterActive: filterActive,
      filterCol: filterCol,
      filterText: filterText,
      sortCol: sortCol,
      sortDir: sortDir,
      selectedRows: Object.assign({}, selectedRows),
      pendingUpdateKeys: Object.keys(pendingUpdates),
      pendingDeleteKeys: Object.keys(pendingDeletes).filter(function (k) { return pendingDeletes[k]; }),
      pendingAddKeys: pendingAdds.map(function (r) { return r.__tempId; }),
      nextId: _nextId
    };
  }

  function _restoreSnapshot(snapshot) {
    rawRows = snapshot.rawRows.map(function (s) { return _deserializeRow(s); });

    var keyMap = {};
    rawRows.forEach(function (r) {
      if (!r) return;
      keyMap[_rowKey(r)] = r;
    });

    displayRows = snapshot.displayRows
      .map(function (k) { return keyMap[k]; })
      .filter(function (r) { return !!r; });

    columnOrder = snapshot.columnOrder.slice();
    columnWidths = Object.assign({}, snapshot.columnWidths);
    manualColumnWidths = Object.assign({}, snapshot.manualColumnWidths);

    totalLines = snapshot.totalLines;
    loadedOffset = snapshot.loadedOffset;
    batchSize = snapshot.batchSize;
    isLoading = snapshot.isLoading;

    filterActive = snapshot.filterActive;
    filterCol = snapshot.filterCol;
    filterText = snapshot.filterText;

    sortCol = snapshot.sortCol;
    sortDir = snapshot.sortDir;

    selectedRows = Object.assign({}, snapshot.selectedRows);

    pendingUpdates = {};
    snapshot.pendingUpdateKeys.forEach(function (k) {
      var r = keyMap[k];
      if (r) pendingUpdates[k] = r;
    });

    pendingDeletes = {};
    snapshot.pendingDeleteKeys.forEach(function (k) {
      pendingDeletes[k] = true;
    });

    pendingAdds = snapshot.pendingAddKeys
      .map(function (k) { return keyMap[k]; })
      .filter(function (r) { return !!r; });

    _nextId = snapshot.nextId;
  }

  function pushHistory() {
    undoStack.push(_captureSnapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function undo() {
    if (!canUndo()) return false;
    redoStack.push(_captureSnapshot());
    _restoreSnapshot(undoStack.pop());
    return true;
  }

  function redo() {
    if (!canRedo()) return false;
    undoStack.push(_captureSnapshot());
    _restoreSnapshot(redoStack.pop());
    return true;
  }

  /** Full reset — called on init / reload. */
  function reset() {
    rawRows = [];
    displayRows = [];
    columnOrder = [];
    columnWidths = {};
    manualColumnWidths = {};
    totalLines = 0;
    loadedOffset = 0;
    isLoading = false;
    filterActive = false;
    filterCol = '';
    filterText = '';
    sortCol = '';
    sortDir = 1;
    selectedRows = {};
    undoStack = [];
    redoStack = [];
    resetPending();
  }

  // ── Filtering helper ──────────────────────────────────────────────────────

  /**
   * Formats any cell value to a plain string for display and filtering.
   * @param {unknown} v
   * @returns {string}
   */
  function formatValue(v) {
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  /**
   * Returns true if `row` matches the current filter criteria.
   * @param {Record<string, unknown>} row
   * @returns {boolean}
   */
  function matchesFilter(row) {
    if (!filterActive || !filterText) return true;
    var text = filterText.toLowerCase();
    if (filterCol) {
      return formatValue(row[filterCol]).toLowerCase().indexOf(text) !== -1;
    }
    var vals = Object.values(row);
    for (var i = 0; i < vals.length; i++) {
      if (formatValue(vals[i]).toLowerCase().indexOf(text) !== -1) return true;
    }
    return false;
  }

  /**
   * Rebuilds `displayRows` from `rawRows` using the current filter.
   * Call after any data or filter change.
   */
  function rebuildDisplay() {
    var rows = rawRows.filter(function (r) { return r != null && matchesFilter(r); });
    displayRows = rows.slice().sort(function (a, b) {
      var ap = _displayPosition(a);
      var bp = _displayPosition(b);
      if (ap !== bp) return ap - bp;
      return _creationPosition(a) - _creationPosition(b);
    });
  }

  function _displayPosition(row) {
    if (row.__isNew && row.__insertAt != null) return Number(row.__insertAt);
    if (row.__isNew) return Number.MAX_SAFE_INTEGER;
    return row.__rowIndex * 2;
  }

  function _creationPosition(row) {
    if (row.__isNew) return Number(String(row.__tempId || '').replace('tmp-', '')) || Number.MAX_SAFE_INTEGER;
    return row.__rowIndex * 2;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.AppState = {
    // Data
    get rawRows() { return rawRows; },     set rawRows(v) { rawRows = v; },
    get displayRows() { return displayRows; }, set displayRows(v) { displayRows = v; },
    get columnOrder() { return columnOrder; }, set columnOrder(v) { columnOrder = v; },

    // Pagination
    get totalLines() { return totalLines; },   set totalLines(v) { totalLines = v; },
    get loadedOffset() { return loadedOffset; }, set loadedOffset(v) { loadedOffset = v; },
    get batchSize() { return batchSize; },     set batchSize(v) { batchSize = v; },
    get isLoading() { return isLoading; },     set isLoading(v) { isLoading = v; },

    // Filter
    get filterActive() { return filterActive; }, set filterActive(v) { filterActive = v; },
    get filterCol() { return filterCol; },     set filterCol(v) { filterCol = v; },
    get filterText() { return filterText; },   set filterText(v) { filterText = v; },

    // Sort
    get sortCol() { return sortCol; },         set sortCol(v) { sortCol = v; },
    get sortDir() { return sortDir; },         set sortDir(v) { sortDir = v; },

    // Selection
    get selectedRows() { return selectedRows; }, set selectedRows(v) { selectedRows = v; },

    // Display settings
    get columnWidths() { return columnWidths; },
    get manualColumnWidths() { return manualColumnWidths; },

    // Pending changes
    get pendingUpdates() { return pendingUpdates; }, set pendingUpdates(v) { pendingUpdates = v; },
    get pendingDeletes() { return pendingDeletes; }, set pendingDeletes(v) { pendingDeletes = v; },
    get pendingAdds() { return pendingAdds; },       set pendingAdds(v) { pendingAdds = v; },

    pendingCount: pendingCount,
    resetPending: resetPending,
    reset: reset,
    attachMeta: attachMeta,
    stripMeta: stripMeta,
    formatValue: formatValue,
    matchesFilter: matchesFilter,
    rebuildDisplay: rebuildDisplay,
    pushHistory: pushHistory,
    canUndo: canUndo,
    canRedo: canRedo,
    undo: undo,
    redo: redo
  };
}());
