/**
 * colManager.js — Column resize, drag-reorder, column menu, row drag-reorder.
 *
 * Exposes: window.App.ColManager
 */
(function () {
  'use strict';

  var S = window.AppState;

  // ── Column drag-reorder ───────────────────────────────────────────────────

  var _dragColIndex = -1;
  var _isResizingCol = false;
  var _suppressHeaderClickUntil = 0;

  function dragColStart(index) { _dragColIndex = index; }

  function dragColEnd() { _dragColIndex = -1; }

  function dropCol(targetIndex) {
    if (_dragColIndex === -1 || _dragColIndex === targetIndex) return;
    var moved = S.columnOrder.splice(_dragColIndex, 1)[0];
    S.columnOrder.splice(targetIndex, 0, moved);
    _dragColIndex = -1;
    window.App.Renderer.renderTable();
  }

  // ── Sort ──────────────────────────────────────────────────────────────────

  function sortBy(col) {
    if (S.sortCol === col) {
      if (S.sortDir === 1) {
        S.sortDir = -1;
      } else {
        S.sortCol = '';
        S.sortDir = 1;
      }
    } else {
      S.sortCol = col;
      S.sortDir = 1;
    }
    window.App.Renderer.renderTable();
  }

  // ── Column resize ─────────────────────────────────────────────────────────

  /**
   * Starts a column resize drag operation.
   * @param {MouseEvent} e
   * @param {string} col
   * @param {HTMLTableCellElement} th
   */
  function startResize(e, col, th) {
    e.preventDefault();
    var startX = e.clientX;
    var startW = th.offsetWidth;
    _isResizingCol = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      var w = Math.max(60, startW + (ev.clientX - startX));
      S.columnWidths[col] = w;
      th.style.width = w + 'px';
      // Sync all data cells in this column
      document.querySelectorAll('td[data-col]').forEach(function (td) {
        if (td.dataset.col === col) {
          td.style.width = w + 'px';
          td.style.maxWidth = w + 'px';
        }
      });
    }

    function onUp() {
      _isResizingCol = false;
      _suppressHeaderClickUntil = Date.now() + 180;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function isResizingCol() {
    return _isResizingCol;
  }

  function shouldIgnoreHeaderClick() {
    return _isResizingCol || Date.now() < _suppressHeaderClickUntil;
  }

  // ── Column menu ───────────────────────────────────────────────────────────

  /**
   * Shows a small action prompt for a column.
   * Supported actions: rename, delete, stats.
   *
   * @param {MouseEvent} _e
   * @param {string} col
   */
  function openColMenu(_e, col) {
    var action = prompt(
      '"' + col + '" — ' + window.I18n.t('colRename') + ' / ' + window.I18n.t('colDelete') + ' / ' + window.I18n.t('colStats'),
      'rename'
    );
    if (!action) return;

    if (action === 'rename') {
      _renameColumn(col);
    } else if (action === 'delete') {
      _deleteColumn(col);
    } else if (action === 'stats') {
      _showColStats(col);
    }
  }

  function _renameColumn(col) {
    var newName = prompt(window.I18n.t('colRename') + ' "' + col + '" →', col);
    if (!newName || newName === col) return;

    S.rawRows.forEach(function (r) {
      if (!r || !(col in r)) return;
      r[newName] = r[col];
      delete r[col];
      _trackRowChange(r);
    });

    var oi = S.columnOrder.indexOf(col);
    if (oi !== -1) S.columnOrder[oi] = newName;

    S.rebuildDisplay();
    window.App.Renderer.renderTable();
    window.App.Toolbar.markDirty();
  }

  function _deleteColumn(col) {
    if (!confirm(window.I18n.t('colDelete') + ' "' + col + '"?')) return;

    S.rawRows.forEach(function (r) {
      if (!r || !(col in r)) return;
      delete r[col];
      _trackRowChange(r);
    });

    var oi = S.columnOrder.indexOf(col);
    if (oi !== -1) S.columnOrder.splice(oi, 1);

    S.rebuildDisplay();
    window.App.Renderer.renderTable();
    window.App.Toolbar.markDirty();
  }

  function _showColStats(col) {
    var vals = S.displayRows
      .map(function (r) { return r[col]; })
      .filter(function (v) { return v != null; });
    var nums = vals.filter(function (v) { return typeof v === 'number'; });
    var unique = new Set(vals.map(String)).size;
    var msg = 'Column: ' + col + '\nValues: ' + vals.length + '\nUnique: ' + unique;
    if (nums.length > 0) {
      var sum = nums.reduce(function (a, b) { return a + b; }, 0);
      msg += '\nSum: ' + sum + '\nAvg: ' + (sum / nums.length).toFixed(4)
        + '\nMin: ' + Math.min.apply(null, nums)
        + '\nMax: ' + Math.max.apply(null, nums);
    }
    alert(msg);
  }

  function _trackRowChange(row) {
    if (row.__isNew) {
      if (S.pendingAdds.indexOf(row) === -1) S.pendingAdds.push(row);
    } else {
      S.pendingUpdates[String(row.__rowIndex)] = row;
    }
  }

  // ── Row drag-reorder ──────────────────────────────────────────────────────

  var _dragRowIndex = -1;
  var _dragRowEl = null;

  function isDraggingRow() { return _dragRowIndex !== -1; }

  /**
   * @param {number} rawIndex  The row's index in AppState.rawRows.
   * @param {HTMLTableRowElement} trEl
   * @param {DragEvent} e
   */
  function dragRowStart(rawIndex, trEl, e) {
    _dragRowIndex = rawIndex;
    _dragRowEl = trEl;
    trEl.classList.add('row-dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function dragRowEnd() {
    if (_dragRowEl) _dragRowEl.classList.remove('row-dragging');
    _dragRowIndex = -1;
    _dragRowEl = null;
    document.querySelectorAll('tr.row-drag-over').forEach(function (tr) {
      tr.classList.remove('row-drag-over');
    });
  }

  function dropRow(targetRawIndex) {
    var from = _dragRowIndex;
    dragRowEnd();
    if (from === -1 || from === targetRawIndex) return;

    // Optimistic local reorder
    var moved = S.rawRows.splice(from, 1)[0];
    S.rawRows.splice(targetRawIndex, 0, moved);
    S.rebuildDisplay();
    window.App.Renderer.renderBody();
    window.App.Renderer.updateStatus();

    // Persist via extension
    window.App.vscode.postMessage({ type: 'reorderRows', fromIndex: from, toIndex: targetRawIndex });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.App = window.App || {};
  window.App.ColManager = {
    dragColStart: dragColStart,
    dragColEnd: dragColEnd,
    dropCol: dropCol,
    sortBy: sortBy,
    startResize: startResize,
    isResizingCol: isResizingCol,
    shouldIgnoreHeaderClick: shouldIgnoreHeaderClick,
    openColMenu: openColMenu,
    isDraggingRow: isDraggingRow,
    dragRowStart: dragRowStart,
    dragRowEnd: dragRowEnd,
    dropRow: dropRow
  };
}());
