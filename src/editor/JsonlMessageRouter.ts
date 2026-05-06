import * as path from 'node:path';
import * as vscode from 'vscode';
import { loadRows } from '../services/FileService';
import { toCSV } from '../services/ExportService';
import type { JsonlRow, SaveChangesPayload } from '../types';
import { JsonlDocumentController } from './JsonlDocumentController';

interface JsonlMessageRouterOptions {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  defaultPageSize: number;
  batchSize: number;
  controller: JsonlDocumentController;
}

/** Handles webview messages and delegates work to focused collaborators. */
export class JsonlMessageRouter {
  constructor(private readonly options: JsonlMessageRouterOptions) {}

  public async handle(msg: Record<string, unknown>): Promise<void> {
    switch (msg.type) {
      case 'loadMore':
        await this.loadMore(Number(msg.offset ?? 0), Number(msg.count ?? this.options.batchSize));
        return;

      case 'saveChanges':
        await this.options.controller.saveChanges(msg as unknown as SaveChangesPayload);
        await this.reload();
        this.options.panel.webview.postMessage({ type: 'saved' });
        return;

      case 'reorderRows':
        await this.options.controller.reorderRows(Number(msg.fromIndex ?? -1), Number(msg.toIndex ?? -1));
        return;

      case 'openInEditor':
        await vscode.commands.executeCommand('vscode.openWith', this.options.document.uri, 'default');
        return;

      case 'exportData':
        await this.exportData(this.asString(msg.format, 'jsonl'), (msg.data as JsonlRow[]) ?? []);
        return;

      case 'importData':
        await this.options.controller.importRows(
          this.asString(msg.content, ''),
          this.asString(msg.format, 'jsonl')
        );
        await this.reload();
        vscode.window.showInformationMessage('Import successful');
        return;

      default:
        return;
    }
  }

  private async loadMore(offset: number, count: number): Promise<void> {
    const result = await loadRows(this.options.document.uri.fsPath, offset, count);
    this.options.panel.webview.postMessage({ type: 'moreRows', ...result, offset });
  }

  private async reload(): Promise<void> {
    const result = await loadRows(this.options.document.uri.fsPath, 0, this.options.defaultPageSize);
    this.options.panel.webview.postMessage({ type: 'reload', ...result, batchSize: this.options.batchSize });
  }

  private async exportData(format: string, data: JsonlRow[]): Promise<void> {
    const ext = format === 'csv' ? 'csv' : 'jsonl';
    const stem = path.basename(this.options.document.uri.fsPath, path.extname(this.options.document.uri.fsPath));
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(this.options.document.uri.fsPath), `${stem}_export.${ext}`)
    );

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { CSV: ['csv'], JSONL: ['jsonl', 'ndjson'] }
    });
    if (!saveUri) return;

    const content = format === 'csv'
      ? toCSV(data)
      : data.map((r) => JSON.stringify(r)).join('\n') + '\n';

    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf8'));
    vscode.window.showInformationMessage(`Exported to ${saveUri.fsPath}`);
  }

  private asString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
  }
}
