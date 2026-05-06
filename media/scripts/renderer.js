/**
 * renderer.js — Table rendering and status bar.
 *
 * Pure rendering: reads from AppState and writes to the DOM.
 * Does NOT post messages to the extension or mutate AppState.
 *
 * Exposes: window.App.Renderer
 */
(function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Escape a string for safe injection into innerHTML. */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var S = window.AppState;

  // ── Entry points ──────────────────────────────────────────────────────────

  function renderTable() {
    renderHead();
    renderBody();
  }

  // ── Table head ────────────────────────────────────────────────────────────

  function renderHead() {
    var tr = document.querySelector('#tableHead tr');
    tr.innerHTML = '';

    // Row-number column
    var thNum = document.createElement('th');
    thNum.textContent = '#';
    thNum.style.width = '44px';
    thNum.style.cursor = 'default';
    tr.appendChild(thNum);

    S.columnOrder.forEach(function (col, ci) {
      var th = document.createElement('th');
      th.draggable = true;
      th.dataset.col = col;
      th.style.width = (S.columnWidths[col] || 180) + 'px';

      // Inner flex row: label + sort icon
      var inner = document.createElement('div');
      inner.className = 'th-inner';
      var label = document.createElement('span');
      label.textContent = col;
      inner.appendChild(label);

      if (S.sortCol === col) {
        var icon = document.createElement('span');
        icon.className = 'sort-icon';
        icon.textContent = S.sortDir === 1 ? ' ▲' : ' ▼';
        inner.appendChild(icon);
      }

      // Column menu button (⋯)
      var menuBtn = document.createElement('button');
      menuBtn.className = 'col-menu-btn';
      menuBtn.textContent = '⋯';
      menuBtn.title = 'Column options';
      menuBtn.setAttribute('aria-label', 'Column options for ' + col);

      // Column resize handle
      var resizer = document.createElement('div');
      resizer.className = 'col-resizer';
      resizer.setAttribute('aria-hidden', 'true');

      // Bind interactions via ColManager (loaded after this file)
      th.addEventListener('click', function () {
        if (window.App.ColManager.shouldIgnoreHeaderClick()) return;
        window.App.ColManager.sortBy(col);
      });
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.App.ColManager.openColMenu(e, col);
      });
      resizer.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        window.App.ColManager.startResize(e, col, th);
      });

      // Column drag-reorder
      (function (idx) {
        th.addEventListener('dragstart', function (e) {
          if (window.App.ColManager.isResizingCol()) {
            e.preventDefault();
            return;
          }
          window.App.ColManager.dragColStart(idx);
          th.classList.add('dragging');
        });
        th.addEventListener('dragend', function () {
          window.App.ColManager.dragColEnd();
          th.classList.remove('dragging');
          document.querySelectorAll('th').forEach(function (t) { t.classList.remove('drag-over'); });
        });
        th.addEventListener('dragover', function (e) {
          e.preventDefault();
          th.classList.add('drag-over');
        });
        th.addEventListener('dragleave', function () {
          th.classList.remove('drag-over');
        });
        th.addEventListener('drop', function (e) {
          e.preventDefault();
          th.classList.remove('drag-over');
          window.App.ColManager.dropCol(idx);
        });
      }(ci));

      th.appendChild(inner);
      th.appendChild(menuBtn);
      th.appendChild(resizer);
      tr.appendChild(th);
    });

    // Action column header
    var thAct = document.createElement('th');
    thAct.style.width = '32px';
    thAct.style.cursor = 'default';
    tr.appendChild(thAct);
  }

  // ── Table body ────────────────────────────────────────────────────────────

  function renderBody() {
    var tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    var rows = getSortedRows();
    rows.forEach(function (row, vi) {
      if (row == null) return;
      tbody.appendChild(createRow(row, vi));
    });
  }

  function getSortedRows() {
    if (!S.sortCol) return S.displayRows;
    var col = S.sortCol;
    var dir = S.sortDir;
    return S.displayRows.slice().sort(function (a, b) {
      var av = a[col], bv = b[col];
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  // ── Row element ───────────────────────────────────────────────────────────

  function createRow(row, _vi) {
    var tr = document.createElement('tr');
    // Stable row key: original index for saved rows, tempId for new ones
    var rowKey = row.__isNew ? row.__tempId : String(row.__rowIndex);
    var rawIndex = row.__isNew ? -1 : row.__rowIndex;

    tr.dataset.rowKey = rowKey;
    if (window.AppState.selectedRows[rowKey]) tr.classList.add('selected');

    // ── Row-number cell ──
    var tdNum = document.createElement('td');
    tdNum.className = 'row-num';
    tdNum.textContent = row.__isNew ? 'N' : String(row.__rowIndex + 1);
    tdNum.title = 'Drag to reorder; click to select';
    tdNum.draggable = true;

    tdNum.addEventListener('dragstart', function (e) {
      window.App.ColManager.dragRowStart(rawIndex, tr, e);
    });
    tdNum.addEventListener('dragend', function () {
      window.App.ColManager.dragRowEnd();
    });
    tr.addEventListener('dragover', function (e) {
      if (window.App.ColManager.isDraggingRow()) {
        e.preventDefault();
        tr.classList.add('row-drag-over');
      }
    });
    tr.addEventListener('dragleave', function () {
      tr.classList.remove('row-drag-over');
    });
    tr.addEventListener('drop', function (e) {
      e.preventDefault();
      tr.classList.remove('row-drag-over');
      window.App.ColManager.dropRow(rawIndex);
    });

    tr.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      window.App.Toolbar.toggleSelect(rowKey, e.shiftKey, e.ctrlKey || e.metaKey);
    });
    tr.addEventListener('dblclick', function (e) {
      if (e.target.tagName === 'TD' && !e.target.classList.contains('editing-cell')) {
        window.App.Modals.openPreview(rawIndex);
      }
    });
    tr.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      window.App.Toolbar.setCtxRow(rawIndex);
      window.App.Toolbar.showContextMenu(e.clientX, e.clientY);
    });

    tr.appendChild(tdNum);

    // ── Data cells ──
    S.columnOrder.forEach(function (col) {
      var td = document.createElement('td');
      td.dataset.col = col;
      var w = S.columnWidths[col] || 180;
      td.style.width = w + 'px';
      td.style.maxWidth = w + 'px';
      td.textContent = S.formatValue(row[col]);
      if (row._parseError) td.classList.add('cell-parse-error');

      td.addEventListener('dblclick', function () {
        window.App.Editor.startCellEdit(td, row, col);
      });
      tr.appendChild(td);
    });

    // ── Delete button ──
    var tdAct = document.createElement('td');
    tdAct.className = 'row-actions';
    var delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete row';
    delBtn.setAttribute('aria-label', 'Delete row');
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.App.Toolbar.deleteRow(row);
    });
    tdAct.appendChild(delBtn);
    tr.appendChild(tdAct);

    return tr;
  }

  // ── JSON tree for preview ─────────────────────────────────────────────────

  /**
   * Renders a JSON value as a collapsible HTML tree string.
   * @param {unknown} obj
   * @returns {string} HTML string
   */
  function renderJsonTree(obj) {
    if (obj === null) return '<span class="json-null">null</span>';
    if (typeof obj === 'boolean') return '<span class="json-bool">' + obj + '</span>';
    if (typeof obj === 'number') return '<span class="json-num">' + obj + '</span>';
    if (typeof obj === 'string') return '<span class="json-str">"' + escHtml(obj) + '"</span>';

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      var items = obj.map(function (v, i) {
        return '<div>' + renderJsonTree(v) + (i < obj.length - 1 ? ',' : '') + '</div>';
      }).join('');
      return '<span class="json-toggle" onclick="this.parentElement.classList.toggle(\'collapsed\')">[▾]</span>'
        + '<div class="json-nested">' + items + '</div>';
    }

    if (typeof obj === 'object') {
      var keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      var entries = keys.map(function (k, i) {
        return '<div><span class="json-key">"' + escHtml(k) + '"</span>: '
          + renderJsonTree(obj[k])
          + (i < keys.length - 1 ? ',' : '')
          + '</div>';
      }).join('');
      return '<span class="json-toggle" onclick="this.parentElement.classList.toggle(\'collapsed\')">{▾}</span>'
        + '<div class="json-nested">' + entries + '</div>';
    }

    return escHtml(String(obj));
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  function updateStatus() {
    var t = window.I18n.t;
    document.getElementById('statusLoaded').textContent =
      t('loaded', String(S.rawRows.filter(Boolean).length));
    document.getElementById('statusTotal').textContent =
      t('total', String(S.totalLines));

    var filteredEl = document.getElementById('statusFiltered');
    if (S.filterActive) {
      filteredEl.removeAttribute('hidden');
      filteredEl.textContent = t('filtered', String(S.displayRows.length));
    } else {
      filteredEl.setAttribute('hidden', '');
    }

    var selEl = document.getElementById('statusSelected');
    var selCount = Object.keys(S.selectedRows).filter(function (k) { return S.selectedRows[k]; }).length;
    if (selCount > 0) {
      selEl.removeAttribute('hidden');
      selEl.textContent = t('selected', String(selCount));
    } else {
      selEl.setAttribute('hidden', '');
    }
  }

  /** Rebuilds the column filter <select> options. */
  function updateFilterSelect() {
    var sel = document.getElementById('filterCol');
    var cur = sel.value;
    sel.innerHTML = '<option value="">— ' + window.I18n.t('column') + ' all —</option>';
    S.columnOrder.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── Column stats bar ──────────────────────────────────────────────────────

  function updateColStats() {
    var bar = document.getElementById('colStatsBar');
    if (!bar.classList.contains('visible')) return;
    bar.innerHTML = '';

    var selKeys = Object.keys(S.selectedRows).filter(function (k) { return S.selectedRows[k]; });
    var subset = selKeys.length > 0
      ? S.displayRows.filter(function (r) {
          return selKeys.indexOf(r.__isNew ? r.__tempId : String(r.__rowIndex)) !== -1;
        })
      : S.displayRows;

    if (subset.length === 0) {
      bar.innerHTML = '<span>' + window.I18n.t('noData') + '</span>';
      return;
    }

    var hdr = document.createElement('span');
    hdr.className = 'stat-label';
    hdr.textContent = 'Stats (' + subset.length + ' ' + (selKeys.length > 0 ? 'selected' : 'rows') + '):';
    bar.appendChild(hdr);

    S.columnOrder.slice(0, 8).forEach(function (col) {
      var vals = subset
        .map(function (r) { return r[col]; })
        .filter(function (v) { return v != null && v !== ''; });
      var nums = vals.filter(function (v) { return typeof v === 'number'; });

      var item = document.createElement('span');
      if (nums.length > 0) {
        var sum = nums.reduce(function (a, b) { return a + b; }, 0);
        item.innerHTML = '<span class="stat-label">' + escHtml(col) + ':</span> '
          + '<span class="stat-value">n=' + nums.length
          + ' sum=' + sum.toFixed(2)
          + ' avg=' + (sum / nums.length).toFixed(2) + '</span>';
      } else {
        item.innerHTML = '<span class="stat-label">' + escHtml(col) + ':</span> '
          + '<span class="stat-value">' + vals.length + ' values</span>';
      }
      bar.appendChild(item);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.App = window.App || {};
  window.App.Renderer = {
    renderTable: renderTable,
    renderHead: renderHead,
    renderBody: renderBody,
    renderJsonTree: renderJsonTree,
    updateStatus: updateStatus,
    updateFilterSelect: updateFilterSelect,
    updateColStats: updateColStats,
    escHtml: escHtml
  };
}());
