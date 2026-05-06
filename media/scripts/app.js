/**
 * app.js — Main entry point for the webview.
 *
 * Responsibilities:
 *  1. Acquire the VS Code API (singleton) and expose it as `App.vscode`.
 *  2. Handle messages sent from the extension host.
 *  3. Wire up all DOM event listeners (buttons, keyboard, etc.).
 *  4. Bootstrap the application once the `init` message arrives.
 *
 * All other logic lives in the modules loaded before this file.
 */
(function () {
  'use strict';

  // ── VS Code API (must be called exactly once) ─────────────────────────────
  window.App = window.App || {};
  window.App.vscode = acquireVsCodeApi();

  var S = window.AppState;

  // ── Extension → Webview messages ──────────────────────────────────────────

  window.addEventListener('message', function (event) {
    var msg = event.data;
    switch (msg.type) {
      case 'init':
        _onInit(msg);
        break;
      case 'reload':
        _onReload(msg);
        break;
      case 'moreRows':
        window.App.LazyLoader.onMoreRows(msg.rows || [], msg.columns || [], msg.offset || 0);
        break;
      case 'saved':
        S.resetPending();
        window.App.Toolbar.markDirty();
        break;
      case 'error':
        console.error('[JSONL Explorer]', msg.message);
        break;
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  function _onInit(msg) {
    S.reset();

    // i18n
    window.I18n.load(msg.locales || {});
    window.I18n.setLanguage(msg.language || 'en');

    // Populate state
    var rows = (msg.rows || []).map(function (r, i) { return S.attachMeta(r, i, false); });
    S.rawRows = rows;
    S.totalLines = msg.totalLines || 0;
    S.batchSize = msg.batchSize || 50;
    S.loadedOffset = rows.length;

    var cols = msg.columns || [];
    S.columnOrder = cols.slice();

    S.rebuildDisplay();

    document.getElementById('fileName').textContent = msg.fileName || 'data.jsonl';

    window.App.Toolbar.applyI18n();
    window.App.Renderer.renderTable();
    window.App.Renderer.updateStatus();
    window.App.Renderer.updateFilterSelect();
    window.App.Toolbar.markDirty();
  }

  function _onReload(msg) {
    // Preserve pending changes across external reloads only if they weren't saved
    var hadPending = S.pendingCount() > 0;

    S.reset();

    var rows = (msg.rows || []).map(function (r, i) { return S.attachMeta(r, i, false); });
    S.rawRows = rows;
    S.totalLines = msg.totalLines || 0;
    S.batchSize = msg.batchSize || 50;
    S.loadedOffset = rows.length;

    var cols = msg.columns || [];
    S.columnOrder = cols.slice();

    S.rebuildDisplay();
    window.App.Renderer.renderTable();
    window.App.Renderer.updateStatus();
    window.App.Renderer.updateFilterSelect();

    if (!hadPending) window.App.Toolbar.markDirty();
  }

  // ── DOM event wiring ──────────────────────────────────────────────────────

  function _wire(id, eventName, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(eventName, handler);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var T = window.App.Toolbar;
    var M = window.App.Modals;
    var E = window.App.Editor;

    // Toolbar buttons
    _wire('btnSave',        'click',  function () { T.saveAll(); });
    _wire('btnOpenEditor',  'click',  function () { T.openInEditor(); });
    _wire('btnRefresh',     'click',  function () { T.requestRefresh(); });
    _wire('btnFilter',      'click',  function () { T.toggleFilter(); });
    _wire('btnStats',       'click',  function () { T.toggleStats(); });
    _wire('btnImport',      'click',  function () { M.openImport(); });
    _wire('btnExportCsv',   'click',  function () { T.exportData('csv'); });
    _wire('btnExportJsonl', 'click',  function () { T.exportData('jsonl'); });
    _wire('btnLang',        'click',  function () { T.toggleLanguage(); });
    _wire('btnAddRowBottom','click',  function () { T.addRowDirect(); });

    // Font controls
    _wire('fontSizeInput',   'change', function () { T.setFontSize(this.value); });
    _wire('fontFamilySelect','change', function () { T.setFontFamily(this.value); });

    // Filter
    _wire('filterCol', 'change', function () { T.applyFilter(); });
    _wire('filterVal', 'input',  function () { T.applyFilter(); });
    _wire('btnClearFilter', 'click', function () { T.clearFilter(); });

    // Preview modal
    _wire('btnCopyJson',    'click', function () { M.copyPreviewJson(); });
    _wire('btnPreviewEdit', 'click', function () { M.editFromPreview(); });
    _wire('btnPreviewClose','click', function () { M.closePreview(); });
    _wire('previewModal',   'click', function (e) {
      if (e.target === document.getElementById('previewModal')) M.closePreview();
    });

    // Edit row modal
    _wire('btnEditCancel', 'click', function () { E.closeEditModal(); });
    _wire('btnEditSave',   'click', function () { E.saveEditModal(); });
    _wire('btnAddField',   'click', function () { E.addFieldRowUI(); });
    _wire('editModal',     'click', function (e) {
      if (e.target === document.getElementById('editModal')) E.closeEditModal();
    });

    // Import modal
    _wire('btnImportCancel', 'click', function () { M.closeImport(); });
    _wire('btnImportRun',    'click', function () { M.doImport(); });
    _wire('importModal',     'click', function (e) {
      if (e.target === document.getElementById('importModal')) M.closeImport();
    });

    // Context menu items
    document.querySelectorAll('[data-ctx-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        T.handleCtxAction(el.dataset.ctxAction);
      });
    });

    // Global: close context menu on click-away; close modals on Escape
    document.addEventListener('click', function () { T.hideContextMenu(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        T.hideContextMenu();
        M.closePreview();
        E.closeEditModal();
        M.closeImport();
      }
    });

    // Init lazy loader
    window.App.LazyLoader.init();
  });
}());
