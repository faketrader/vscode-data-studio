/**
 * i18n.js — Internationalization module.
 *
 * Locale data is provided by the extension host on the `init` message.
 * The webview's `app.js` calls `I18n.load(locales)` once on startup.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW LANGUAGE
 * ──────────────────────────────────────────────────────────────────────────
 * 1. Create `src/i18n/locales/<lang>.json` with all keys from `en.json`.
 * 2. Import it in `src/i18n/index.ts` and add it to the `locales` map.
 * 3. The new locale is automatically sent to the webview — no JS changes needed.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Exposes: window.I18n
 */
(function () {
  'use strict';

  /** @type {Record<string, Record<string, string>>} */
  var _locales = {
    en: {
      save: 'Save', openEditor: 'Open in Editor', refresh: 'Refresh',
      filter: 'Filter', stats: 'Stats', import: 'Import',
      exportCsv: 'CSV', exportJsonl: 'JSONL', addRow: 'Add Row',
      addField: 'Add Field', column: 'Column:', contains: 'Contains:',
      clear: 'Clear', filterPlaceholder: 'filter text…',
      loadingMore: 'Loading more rows…', copyJson: 'Copy JSON',
      edit: 'Edit', close: 'Close', cancel: 'Cancel',
      importTitle: 'Import Data',
      importDesc: 'Paste CSV or JSONL content. This replaces all file contents.',
      importRun: 'Import & Replace', noContentImport: 'No content to import.',
      replaceConfirm: 'This will replace the entire file. Continue?',
      deleteConfirm: 'Delete row {0}?',
      ctxPreview: 'Preview', ctxEdit: 'Edit Row', ctxCopy: 'Copy JSON', ctxDelete: 'Delete Row',
      colRename: 'Rename', colDelete: 'Delete Column', colStats: 'Column Stats',
      loaded: 'Loaded: {0}', total: 'Total: {0}', filtered: 'Filtered: {0}',
      selected: 'Selected: {0}', unsaved: '({0} unsaved)',
      rowPreview: 'Row {0} Preview', editRow: 'Edit Row {0}', noData: 'No data'
    }
  };

  var _lang = 'en';

  /**
   * Merges locale dictionaries from the extension host.
   * @param {Record<string, Record<string, string>>} locales
   */
  function load(locales) {
    if (locales && typeof locales === 'object') {
      Object.assign(_locales, locales);
    }
  }

  /**
   * Sets the active language, falling back to 'en' if unknown.
   * @param {string} lang
   */
  function setLanguage(lang) {
    _lang = _locales[lang] ? lang : 'en';
  }

  /** @returns {string} Active language code. */
  function getLang() { return _lang; }

  /**
   * Translates a key with optional positional substitutions.
   * Falls back to English, then to the key itself.
   * @param {string} key
   * @param {...string} args  Replaces `{0}`, `{1}`, … placeholders.
   * @returns {string}
   */
  function t(key) {
    var locale = _locales[_lang] || _locales.en;
    var str = locale[key] != null ? locale[key] : (_locales.en[key] != null ? _locales.en[key] : key);
    for (var i = 1; i < arguments.length; i++) {
      str = str.replace('{' + (i - 1) + '}', String(arguments[i]));
    }
    return str;
  }

  /** Re-renders all `[data-i18n]` elements in the DOM. */
  function applyToDOM() {
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      el.textContent = t(el.getAttribute('data-i18n'));
    }
  }

  window.I18n = { load: load, setLanguage: setLanguage, getLang: getLang, t: t, applyToDOM: applyToDOM };
}());
