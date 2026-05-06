/**
 * @file webview/WebviewContent.ts
 * @description Assembles the HTML string for the custom editor webview.
 *
 * Reads `media/index.html` as a template and substitutes:
 *  - `{{CSP_SOURCE}}` → webview CSP source for local extension resources
 *  - `{{STYLES_URI}}`  → URI of `media/styles/main.css`
 *  - `{{SCRIPTS}}`     → ordered `<script>` tags for all JS modules
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Ordered list of script files under `media/scripts/`. */
const SCRIPT_FILES = [
  'i18n.js',
  'state.js',
  'renderer.js',
  'editor.js',
  'modals.js',
  'toolbar.js',
  'colManager.js',
  'lazyLoader.js',
  'app.js'
] as const;

/**
 * Builds the HTML content for the webview, injecting correct resource URIs.
 *
 * @param webview       The Webview instance (needed for URI conversion and CSP source).
 * @param extensionUri  Root URI of the extension package.
 */
export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const mediaRoot = vscode.Uri.joinPath(extensionUri, 'media');

  const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'styles', 'main.css'));
  const scriptTags = SCRIPT_FILES.map((file) => {
    const uri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'scripts', file));
    return `<script src="${uri}"></script>`;
  }).join('\n  ');

  const templatePath = path.join(extensionUri.fsPath, 'media', 'index.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  return template
    .replaceAll('{{CSP_SOURCE}}', webview.cspSource)
    .replace('{{STYLES_URI}}', stylesUri.toString())
    .replace('{{SCRIPTS}}', scriptTags);
}
