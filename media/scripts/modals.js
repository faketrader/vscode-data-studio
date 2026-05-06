/**
 * modals.js — Preview modal and Import modal.
 *
 * Exposes: window.App.Modals
 */
(function () {
  'use strict';

  var S = window.AppState;

  // ── Preview modal ─────────────────────────────────────────────────────────

  /** @type {number} Raw index of the currently previewed row. */
  var _previewIndex = -1;

  /**
   * Opens the JSON tree preview for the given raw-row index.
   * @param {number} rawIndex
   */
  function openPreview(rawIndex) {
    _previewIndex = rawIndex;
    var row = S.rawRows[rawIndex];
    if (!row) return;

    document.getElementById('previewTitle').textContent =
      window.I18n.t('rowPreview', String(rawIndex + 1));
    document.getElementById('previewContent').innerHTML =
      window.App.Renderer.renderJsonTree(row);

    document.getElementById('previewModal').removeAttribute('hidden');
  }

  function closePreview() {
    document.getElementById('previewModal').setAttribute('hidden', '');
  }

  function copyPreviewJson() {
    if (_previewIndex < 0) return;
    var text = JSON.stringify(S.rawRows[_previewIndex], null, 2);
    _writeToClipboard(text);
  }

  function editFromPreview() {
    closePreview();
    window.App.Editor.openEditModal(_previewIndex);
  }

  // ── Import modal ──────────────────────────────────────────────────────────

  function openImport() {
    document.getElementById('importModal').removeAttribute('hidden');
  }

  function closeImport() {
    document.getElementById('importModal').setAttribute('hidden', '');
  }

  function doImport() {
    var format = document.getElementById('importFormat').value;
    var content = document.getElementById('importContent').value;
    if (!content.trim()) {
      alert(window.I18n.t('noContentImport'));
      return;
    }
    if (!confirm(window.I18n.t('replaceConfirm'))) return;

    window.App.vscode.postMessage({ type: 'importData', format: format, content: content });
    closeImport();
  }

  // ── Clipboard helper ──────────────────────────────────────────────────────

  function _writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { _fallbackCopy(text); });
    } else {
      _fallbackCopy(text);
    }
  }

  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.App = window.App || {};
  window.App.Modals = {
    openPreview: openPreview,
    closePreview: closePreview,
    copyPreviewJson: copyPreviewJson,
    editFromPreview: editFromPreview,
    openImport: openImport,
    closeImport: closeImport,
    doImport: doImport
  };
}());
