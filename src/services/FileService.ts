/**
 * @file services/FileService.ts
 * @description Multi-format file I/O service.
 * Supports multiple file formats via FormatRegistry.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { JsonlRow, LoadResult, SaveChangesPayload } from '../types';
import { FormatRegistry } from '../formats/FormatRegistry';

/**
 * Reads a slice of rows from a file (auto-detects format).
 *
 * Streams the file so it is memory-efficient for large files.
 *
 * @param filePath  Absolute path to the file.
 * @param offset    Zero-based index of the first row to include.
 * @param count     Maximum number of rows to return.
 */
export async function loadRows(filePath: string, offset: number, count: number): Promise<LoadResult> {
  const ext = path.extname(filePath).replace(/^\./, '');
  const handler = FormatRegistry.getByExtension(ext);

  if (!handler) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  return handler.loadRows(filePath, offset, count);
}

/**
 * Applies batched changes to file content and returns the new string.
 * Automatically detects the file format and delegates to the appropriate handler.
 *
 * @param filePath        Absolute path to the file (used for format detection).
 * @param originalContent Current file text.
 * @param payload         Batch of changes from the webview.
 */
export function applyChanges(
  filePath: string,
  originalContent: string,
  payload: SaveChangesPayload
): string {
  const ext = path.extname(filePath).replace(/^\./, '');
  const handler = FormatRegistry.getByExtension(ext);

  if (!handler) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  const deleteSet = new Set(payload.deletes ?? []);
  return handler.applyChanges(originalContent, payload.updates, payload.adds, deleteSet);
}
