import * as vscode from 'vscode';
import { applyChanges } from '../services/FileService';
import { fromCSV, fromJSONL } from '../services/ExportService';
import type { JsonlRow, SaveChangesPayload } from '../types';

/**
 * Owns all text-document mutations for JSONL files.
 *
 * This class is intentionally VS Code document-centric and contains no webview
 * transport logic, which keeps mutation behavior easy to reason about.
 */
export class JsonlDocumentController {
  constructor(private readonly document: vscode.TextDocument) {}

  public async saveChanges(payload: SaveChangesPayload): Promise<void> {
    const normalized: Required<SaveChangesPayload> = {
      updates: payload.updates ?? [],
      deletes: payload.deletes ?? [],
      adds: payload.adds ?? []
    };

    const newContent = applyChanges(this.document.getText(), normalized);
    await this.replaceWholeDocument(newContent);
  }

  public async reorderRows(fromIndex: number, toIndex: number): Promise<void> {
    const rawLines = this.document.getText().split('\n');
    const validLines = rawLines
      .map((content, i) => ({ i, content }))
      .filter(({ content }) => content.trim());

    if (
      fromIndex < 0 || fromIndex >= validLines.length ||
      toIndex < 0 || toIndex >= validLines.length
    ) {
      return;
    }

    const [moved] = validLines.splice(fromIndex, 1);
    validLines.splice(toIndex, 0, moved);

    let vi = 0;
    const newRawLines = rawLines.map((line) => (line.trim() ? validLines[vi++].content : line));
    await this.replaceWholeDocument(newRawLines.join('\n'));
  }

  public async importRows(content: string, format: string): Promise<void> {
    const rows: JsonlRow[] = format === 'csv' ? fromCSV(content) : fromJSONL(content);
    const newContent = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    await this.replaceWholeDocument(newContent);
  }

  private async replaceWholeDocument(newContent: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(this.document.uri, this.fullDocRange(), newContent);
    await vscode.workspace.applyEdit(edit);
    await this.document.save();
  }

  private fullDocRange(): vscode.Range {
    return new vscode.Range(
      new vscode.Position(0, 0),
      this.document.lineAt(this.document.lineCount - 1).rangeIncludingLineBreak.end
    );
  }
}
