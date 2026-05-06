/**
 * @file editor/JsonlEditorProvider.ts
 * @description VS Code CustomTextEditorProvider for JSONL files.
 *
 * Responsibilities:
 *  - Lifecycle: create / dispose webview panels
 *  - Routing: dispatch incoming webview messages to the appropriate service
 *  - Persistence: apply changes and save the document
 *
 * File I/O is delegated to FileService; export/import to ExportService.
 */

import * as vscode from 'vscode';
import { loadRows } from '../services/FileService';
import { getWebviewContent } from '../webview/WebviewContent';
import { getAllLocales } from '../i18n';
import { JsonlDocumentController } from './JsonlDocumentController';
import { JsonlMessageRouter } from './JsonlMessageRouter';

export class JsonlEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'dataStudio.Editor';

  /** Active panels keyed by document URI string. */
  private readonly panels = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Reload the active panel for the given file (used by the refresh command). */
  public refreshActive(): void {
    for (const panel of this.panels.values()) {
      panel.webview.postMessage({ type: 'refresh' });
    }
  }

  // ── VS Code API ─────────────────────────────────────────────────────────

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const key = document.uri.toString();
    this.panels.set(key, panel);

    const config = vscode.workspace.getConfiguration('dataStudio');
    const defaultPageSize = config.get<number>('defaultPageSize', 100);
    const batchSize = config.get<number>('lazyLoadBatchSize', 50);
    const language = config.get<string>('language', 'en');
    const controller = new JsonlDocumentController(document);
    const router = new JsonlMessageRouter({
      document,
      panel,
      defaultPageSize,
      batchSize,
      controller
    });

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    panel.webview.html = getWebviewContent(panel.webview, this.context.extensionUri);

    // Send initial data once the webview is ready
    const initial = await loadRows(document.uri.fsPath, 0, defaultPageSize);
    panel.webview.postMessage({
      type: 'init',
      ...initial,
      batchSize,
      language,
      locales: getAllLocales()
    });

    // Message router
    const msgListener = panel.webview.onDidReceiveMessage((msg: Record<string, unknown>) =>
      this.dispatch(msg, panel, router)
    );

    // Reload when the file changes externally (e.g., git checkout, external editor)
    const docListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === key) {
        this.reload(document, defaultPageSize, batchSize, panel);
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(key);
      msgListener.dispose();
      docListener.dispose();
    });
  }

  // ── Message dispatcher ──────────────────────────────────────────────────

  private async dispatch(
    msg: Record<string, unknown>,
    panel: vscode.WebviewPanel,
    router: JsonlMessageRouter
  ): Promise<void> {
    try {
      await router.handle(msg);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Data Studio: ${message}`);
      panel.webview.postMessage({ type: 'error', message });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async reload(
    document: vscode.TextDocument,
    defaultPageSize: number,
    batchSize: number,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    const result = await loadRows(document.uri.fsPath, 0, defaultPageSize);
    panel.webview.postMessage({ type: 'reload', ...result, batchSize });
  }
}
