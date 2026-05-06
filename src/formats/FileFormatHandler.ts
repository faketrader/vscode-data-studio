/**
 * @file formats/FileFormatHandler.ts
 * @description Abstract interface for file format handlers.
 * Allows extending support for new formats (JSONL, CSV, Parquet, etc.)
 */

import type { JsonlRow, LoadResult } from '../types';

export interface FileFormatHandler {
  /** File extensions this handler supports (e.g., ['csv', 'tsv']) */
  extensions: string[];

  /** Display name for this format (e.g., 'CSV', 'JSONL') */
  displayName: string;

  /**
   * Reads a slice of rows from a file.
   * @param filePath Absolute path to the file.
   * @param offset Zero-based index of the first row.
   * @param count Maximum number of rows to return.
   */
  loadRows(filePath: string, offset: number, count: number): Promise<LoadResult>;

  /**
   * Converts rows to file format string.
   * @param data Array of row objects.
   */
  serialize(data: JsonlRow[]): string;

  /**
   * Parses file content into row objects.
   * @param content Raw file content string.
   */
  deserialize(content: string): JsonlRow[];

  /**
   * Applies a batch of mutations (updates, adds, deletes) to file content.
   * @param originalContent Current file text.
   * @param updates Array of row updates.
   * @param adds Array of rows to add.
   * @param deletes Set of row indices to delete.
   */
  applyChanges(
    originalContent: string,
    updates?: Array<{ rowIndex: number; rowData: JsonlRow }>,
    adds?: Array<JsonlRow | { rowData: JsonlRow; insertAt?: number | null }>,
    deletes?: Set<number>
  ): string;
}
