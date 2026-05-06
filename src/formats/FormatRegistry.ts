/**
 * @file formats/FormatRegistry.ts
 * @description Registry for file format handlers.
 * Supports dynamic registration and lookup of format handlers.
 */

import type { FileFormatHandler } from './FileFormatHandler';

export class FormatRegistry {
  private static readonly handlers = new Map<string, FileFormatHandler>();
  private static readonly extensionMap = new Map<string, string>(); // ext -> format

  /**
   * Registers a format handler.
   * @param format Format identifier (e.g., 'jsonl', 'csv').
   * @param handler The handler implementation.
   */
  public static register(format: string, handler: FileFormatHandler): void {
    this.handlers.set(format.toLowerCase(), handler);
    for (const ext of handler.extensions) {
      this.extensionMap.set(ext.toLowerCase(), format.toLowerCase());
    }
  }

  /**
   * Gets a handler by format identifier.
   */
  public static get(format: string): FileFormatHandler | undefined {
    return this.handlers.get(format.toLowerCase());
  }

  /**
   * Gets a handler by file extension (without dot).
   */
  public static getByExtension(extension: string): FileFormatHandler | undefined {
    const format = this.extensionMap.get(extension.toLowerCase().replace(/^\./, ''));
    return format ? this.handlers.get(format) : undefined;
  }

  /**
   * Lists all registered format identifiers.
   */
  public static listFormats(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Lists all registered handlers.
   */
  public static listHandlers(): FileFormatHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Checks if a format is registered.
   */
  public static has(format: string): boolean {
    return this.handlers.has(format.toLowerCase());
  }
}
