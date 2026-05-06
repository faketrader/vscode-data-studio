/**
 * editor.js — Inline cell editing and the Edit Row modal.
 *
 * Exposes: window.App.Editor
 */
(function () {
  'use strict';

  var S = window.AppState;

  /** Reference to the currently active cell textarea (null when none). */
  var _activeCellRef = null;

  // ── Inline cell editing ──────────────────────────────────────────────────

  /**
   * Turns a `<td>` into an inline editor.
   *
   * @param {HTMLTableCellElement} td
   * @param {Record<string, unknown>} row  The row object (by reference).
   * @param {string} col  Column key.
   */
  function startCellEdit(td, row, col) {
    if (td.classList.contains('editing-cell')) return;

    var original = td.textContent;
    td.classList.add('editing-cell');
    td.textContent = '';

    var textarea = document.createElement('textarea');
    textarea.value = original;
    td.appendChild(textarea);
    textarea.focus();
    textarea.select();
    _activeCellRef = textarea;

    function commit() {
      var raw = textarea.value;
      td.classList.remove('editing-cell');
      var parsed;
      try { parsed = JSON.parse(raw); } catch (_) { parsed = raw; }

      var before = row[col];
      var changed = JSON.stringify(before) !== JSON.stringify(parsed);
      if (changed) S.pushHistory();

      row[col] = parsed;
      S.rebuildDisplay();
      td.textContent = S.formatValue(parsed);

      if (changed) _trackChange(row);
      _activeCellRef = null;

      window.App.Toolbar.markDirty();
      window.App.Renderer.updateColStats();
    }

    function cancel() {
      td.classList.remove('editing-cell');
      td.textContent = original;
      _activeCellRef = null;
    }

    textarea.addEventListener('blur', commit);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        textarea.removeEventListener('blur', commit);
        cancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.removeEventListener('blur', commit);
        commit();
      }
    });
  }

  /** Commits any active cell edit before we do something else (e.g. Save). */
  function flushActiveEdit() {
    if (_activeCellRef) _activeCellRef.blur();
  }

  // ── Edit row modal ────────────────────────────────────────────────────────

  /** @type {Record<string, unknown> | null} Row being edited */
  var _editRow = null;

  /**
   * Opens the Edit Row modal for the given raw-row index.
   * Pass -1 to open a blank new-row form (unused; use addRowDirect instead).
   *
   * @param {number} rawIndex  Index into AppState.rawRows.
   */
  function openEditModal(rawIndex) {
    _editRow = S.rawRows[rawIndex] || null;
    var row = _editRow ? Object.assign({}, _editRow) : {};

    document.getElementById('editModalTitle').textContent =
      _editRow ? window.I18n.t('editRow', String(rawIndex + 1)) : window.I18n.t('addRow');

    var fields = document.getElementById('editFields');
    fields.innerHTML = '';

    var keysToShow = _editRow ? Object.keys(row) : S.columnOrder.slice();
    keysToShow.forEach(function (k) {
      _addFieldRow(k, S.formatValue(row[k]));
    });

    document.getElementById('editModal').removeAttribute('hidden');
  }

  function closeEditModal() {
    document.getElementById('editModal').setAttribute('hidden', '');
    _editRow = null;
  }

  function saveEditModal() {
    var fieldRows = document.querySelectorAll('#editFields .field-row');
    var obj = {};
    fieldRows.forEach(function (fr) {
      var key = fr.querySelector('.field-key').value.trim();
      if (!key) return;
      var raw = fr.querySelector('.field-val').value;
      var val;
      try { val = JSON.parse(raw); } catch (_) { val = raw; }
      obj[key] = val;
    });

    closeEditModal();

    if (_editRow) {
      S.pushHistory();
      Object.assign(_editRow, obj);
      S.rebuildDisplay();
      window.App.Renderer.renderBody();

      // Register new columns
      var changed = false;
      Object.keys(obj).forEach(function (k) {
        if (S.columnOrder.indexOf(k) === -1) {
          S.columnOrder.push(k);
          changed = true;
        }
      });
      if (changed) window.App.Renderer.renderHead();

      _trackChange(_editRow);
      window.App.Toolbar.markDirty();
    }
  }

  /** Adds a key/value pair input row to the edit modal. */
  function addFieldRowUI() {
    _addFieldRow('', '');
  }

  function _addFieldRow(key, value) {
    var fields = document.getElementById('editFields');
    var div = document.createElement('div');
    div.className = 'field-row';

    var keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'field-key';
    keyInput.value = key || '';
    keyInput.placeholder = 'key';

    var valInput = document.createElement('textarea');
    valInput.className = 'field-val';
    valInput.value = value || '';
    valInput.placeholder = 'value';
    valInput.rows = 2;

    var delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', 'Remove field');
    delBtn.addEventListener('click', function () { div.remove(); });

    div.appendChild(keyInput);
    div.appendChild(valInput);
    div.appendChild(delBtn);
    fields.appendChild(div);
  }

  // ── Change tracking ───────────────────────────────────────────────────────

  /**
   * Registers a row as updated or new in the pending queues.
   * @param {Record<string, unknown>} row
   */
  function _trackChange(row) {
    if (row.__isNew) {
      var idx = S.pendingAdds.indexOf(row);
      if (idx === -1) S.pendingAdds.push(row);
    } else {
      S.pendingUpdates[String(row.__rowIndex)] = row;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.App = window.App || {};
  window.App.Editor = {
    startCellEdit: startCellEdit,
    flushActiveEdit: flushActiveEdit,
    openEditModal: openEditModal,
    closeEditModal: closeEditModal,
    saveEditModal: saveEditModal,
    addFieldRowUI: addFieldRowUI
  };
}());
