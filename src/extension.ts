import * as vscode from 'vscode';
import { JsonlEditorProvider } from './editor/JsonlEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  // Register custom editor provider for JSONL files
  const provider = new JsonlEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      JsonlEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false }
    ),
    vscode.commands.registerCommand('jsonlExplorer.openInEditor', (uri?: vscode.Uri) => {
      if (uri) vscode.commands.executeCommand('vscode.openWith', uri, 'default');
    }),
    vscode.commands.registerCommand('jsonlExplorer.refresh', () => {
      provider.refreshActive();
    })
  );
}

// deactivate is optional — VS Code handles cleanup via disposables
export function deactivate(): void { /* intentionally empty */ }
