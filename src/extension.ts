import * as vscode from 'vscode';
import { JsonlEditorProvider } from './editor/JsonlEditorProvider';
import { registerAllFormats } from './formats';

export function activate(context: vscode.ExtensionContext): void {
  // Register all format handlers
  registerAllFormats();

  // Register custom editor provider
  const provider = new JsonlEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      JsonlEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false }
    ),
    vscode.commands.registerCommand('dataStudio.openInEditor', (uri?: vscode.Uri) => {
      if (uri) vscode.commands.executeCommand('vscode.openWith', uri, 'default');
    }),
    vscode.commands.registerCommand('dataStudio.refresh', () => {
      provider.refreshActive();
    })
  );
}

// deactivate is optional — VS Code handles cleanup via disposables
export function deactivate(): void { /* intentionally empty */ }
